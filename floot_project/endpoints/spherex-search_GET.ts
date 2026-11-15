import { schema, type OutputType } from './spherex-search_GET.schema';
import { SPHEREX_INDEX_SNAPSHOTS, SNAPSHOT_FETCHED_UTC } from '../helpers/spherex-index-snapshots';
import {cacheKey,loadCachedCatalog,saveCatalog} from '../helpers/spherex-cache';

/**
 * SPHEREx spectral-image inventory through IRSA SIA2.
 * Unlike the previous TAP query, this does not join artifact/plane tables
 * and does not require ADQL polygon matching or an ORDER BY over the join.
 * It returns the on-prem access_url for a FITS spectral image, not fabricated data.
 */
export async function handle(request: Request) {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return Response.json({ error: 'RA 0–360°, Dec −90° ile +90° arasında olmalıdır.' }, { status: 400 });
  }

  const { ra, dec, detector } = parsed.data;
  const r = Number(ra.toFixed(6));
  const d = Number(dec.toFixed(6));
  const key=cacheKey('sia2|'+r.toFixed(6)+'|'+d.toFixed(6)+'|'+detector);
  let cachedCatalog:Awaited<ReturnType<typeof loadCachedCatalog>>=null;
  try{
    cachedCatalog=await loadCachedCatalog(key);
    if(cachedCatalog?.fresh){
      const stored=cachedCatalog.data as OutputType;
      return Response.json({...stored,catalog_source:'cache',
        catalog_origin:stored.catalog_source==='snapshot'?'snapshot':'live',
        catalog_cache_hit:true,
        catalog_cached_at:new Date(cachedCatalog.cachedAt).toISOString(),
        note:'Önceki gerçek NASA SIA2 sorgu sonucu (24 saat katalog önbelleği); FITS ayrıca saklanır. '+stored.note},
        {headers:{'Cache-Control':'public,max-age=300','X-SPHEREx-Catalog':'HIT'}});
    }
  }catch(error){console.warn('SPHEREx katalog önbelleği okunamadı',String(error))}
  const collections = ['spherex_dr1', 'spherex_qr3'];
  type Observation = { url: string; mjd: number; collection: string };
  let observations: Observation[] = [];
  const errors: string[] = [];
  const detectedCollections: string[] = [];
  let catalogSource: 'live'|'snapshot' = 'live';

  try {
    for (const collection of collections) {
      // DR1 first; only search QR3 when DR1 yields few usable observations.
      if (observations.length >= 12) break;

      const url = new URL('https://irsa.ipac.caltech.edu/SIA');
      url.searchParams.set('COLLECTION', collection);
      // 0.004° = 14.4 arcsec; catalog entries still need to cover this position.
      url.searchParams.set('POS', 'CIRCLE ' + r + ' ' + d + ' 0.004');
      url.searchParams.set('MAXREC', '300');
      url.searchParams.set('RESPONSEFORMAT', 'JSON');

      try {
        let response: Response | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          response = await fetch(url, {
            headers: { 'User-Agent': 'SPHERExSkyExplorer/1.1 NASA Space Apps 2026' },
            signal: AbortSignal.timeout(30000),
          });
          if (response.ok) break;
          // Brief, bounded backoff for short-lived gateway errors, respecting
          // Retry-After when the service provides it. Never flood the archive.
          if (attempt === 1 || ![429, 502, 503, 504].includes(response.status)) break;
          const fromHeader = Number(response.headers.get('Retry-After'));
          const delayMs = Number.isFinite(fromHeader) && fromHeader > 0
            ? Math.min(30000, fromHeader * 1000)
            : 4000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        if (!response?.ok) throw new Error('SIA2 ' + collection + ' HTTP ' + response?.status);
        const responseJson: any = await response.json();
        const resource = responseJson?.VOTABLE?.RESOURCE_ARRAY?.find(
          (entry: any) => entry?.['<xmlattr>']?.type === 'results'
        );
        const status = resource?.INFO_ARRAY?.find(
          (entry: any) => entry?.['<xmlattr>']?.name === 'QUERY_STATUS'
        )?.['<xmlattr>']?.value;
        if (status && status !== 'OK' && status !== 'OVERFLOW') {
          throw new Error('SIA2 ' + collection + ' QUERY_STATUS ' + status);
        }
        const table = resource?.TABLE;
        if (!table) throw new Error('SIA2 ' + collection + ' geçerli veri tablosu döndürmedi');
        const fieldNames: string[] = Array.isArray(table.FIELD_ARRAY)
          ? table.FIELD_ARRAY.map((field: any) => String(field?.['<xmlattr>']?.name || ''))
          : [];
        const detectorIndex = fieldNames.indexOf('energy_bandpassname');
        const urlIndex = fieldNames.indexOf('access_url');
        const mjdIndex = fieldNames.indexOf('t_min');
        if (detectorIndex < 0 || urlIndex < 0 || mjdIndex < 0) {
          throw new Error('NASA SIA2 yanıtında gerekli sütunlar yok');
        }

        const rows: unknown[][] = Array.isArray(table.DATA?.TABLEDATA) ? table.DATA.TABLEDATA : [];
        for (const row of rows) {
          if (!Array.isArray(row) || String(row[detectorIndex]) !== detector) continue;
          const fitsUrl = String(row[urlIndex] || '');
          const time = Number(row[mjdIndex]);
          if (!Number.isFinite(time) || time < 40000 || time > 90000) continue;
          // Whitelist real, on-prem NASA spectral images. Cutouts are handled by IRSA.
          if (!/^https:\/\/irsa\.ipac\.caltech\.edu\/ibe\/data\/spherex\/(dr1|qr3)\/level2\//.test(fitsUrl) ||
              !fitsUrl.endsWith('.fits')) continue;
          observations.push({ url: fitsUrl, mjd: time, collection });
        }
        detectedCollections.push(collection);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'SIA2 katalog hatası');
      }
    }

    // Two release collections may contain separate observations; do not invent extra images.
    observations = observations.filter((row, index, array) =>
      array.findIndex(item => item.url === row.url) === index
    ).sort((a, b) => a.mjd - b.mjd);

    if (!observations.length && errors.length === collections.length) {
      // Genuine catalog metadata collected previously from NASA/IPAC, not
      // invented links. Strictly match the two documented example targets.
      // All actual FITS imagery is STILL fetched live by the frame endpoint.
      const snapshotKey = detector === 'SPHEREx-D2' &&
        Math.abs(r - 269.4463) < 0.00001 && Math.abs(d - 4.7672) < 0.00001
        ? 'barnard'
        : detector === 'SPHEREx-D2' &&
          Math.abs(r - 210.80227) < 0.00001 && Math.abs(d - 54.34895) < 0.00001
          ? 'm101' : null;
      if (!snapshotKey) {
        throw new Error('NASA SIA2 servisleri yanıt vermedi: ' + errors.join(' | '));
      }
      observations = SPHEREX_INDEX_SNAPSHOTS[snapshotKey].rows.map(item => ({
        url: item.url, mjd: item.mjd, collection: 'spherex_dr1'
      }));
      catalogSource = 'snapshot';
      console.log('NASA SIA2 unavailable; using recorded NASA/IRSA DR1 index for '+snapshotKey+
        ' ('+SNAPSHOT_FETCHED_UTC+'). All imagery remains live.');
    }

    // First spread candidate observations across distinct dates. If NASA's FITS
    // cutout service fails for several dates, include extra real exposures from
    // the SAME sky position/detector, not invented placeholders.
    const uniqueDays: Observation[] = [];
    const days = new Set<string>();
    for (const item of observations) {
      const date = new Date((item.mjd - 40587) * 86400000);
      if (!Number.isFinite(date.getTime())) continue;
      const day = date.toISOString().slice(0, 10);
      if (days.has(day)) continue;
      days.add(day);
      uniqueDays.push(item);
    }
    const pool = uniqueDays.length >= 2 ? uniqueDays : observations;
    const selected: Observation[] = [];
    const max = Math.min(12, pool.length);
    for (let i = 0; i < max; i++) {
      const index = max === 1 ? 0 : Math.round(i * (pool.length - 1) / (max - 1));
      const item = pool[index];
      if (item && !selected.some(entry => entry.url === item.url)) selected.push(item);
    }
    // Up to 18 alternative images; frontend stops once six actual downloads work.
    // Additional frames may share a date; that fact is preserved in observed_utc.
    for (const item of observations) {
      if (selected.length >= 18) break;
      if (!selected.some(existing => existing.url === item.url)) selected.push(item);
    }

    const responseData: OutputType = {
      ra_deg: r, dec_deg: d, detector,
      available_count: observations.length,
      frames: selected.map(item => ({
        observed_utc: new Date((item.mjd - 40587) * 86400000).toISOString(),
        source_fits_cutout_url: item.url + '?center=' + r + ',' + d + 'd&size=0.1',
      })),
      catalog_source: catalogSource,
      ...(catalogSource === 'snapshot' ? {snapshot_utc: SNAPSHOT_FETCHED_UTC} : {}),
      note: (catalogSource === 'snapshot'
        ? 'NASA SIA2 çevrimdışı/geçici hata: '+SNAPSHOT_FETCHED_UTC+' tarihli gerçek NASA katalog indeksi kullanıldı. FITS görüntüleri canlı indirilir. '
        : 'NASA/IPAC SIA2 (' + detectedCollections.join(', ') + '). ') +
        'Aynı RA/Dec ve dedektör; farklı tarihler. Görüntülerin dalga boyu, PSF ve fotometrik ölçeği farklı olabilir. Bu bir hareket ölçümü değildir.',
    };

    try{
      await saveCatalog(key,r,d,detector,responseData,observations.length);
    }catch(error){console.warn('SPHEREx katalog önbelleği yazılamadı',String(error))}
    return Response.json(responseData, { headers: { 'Cache-Control': 'public, max-age=120','X-SPHEREx-Catalog':'MISS' } });
  } catch (error) {
    if(cachedCatalog){
      const stored=cachedCatalog.data as OutputType;
      return Response.json({...stored,catalog_source:'stale-cache',
        catalog_origin:stored.catalog_source==='snapshot'?'snapshot':'live',
        catalog_cache_hit:true,catalog_cached_at:new Date(cachedCatalog.cachedAt).toISOString(),
        note:'NASA katalog servisi geçici olarak erişilemedi; önceki gerçek NASA katalog indeksinin süresi geçmiş yedeği kullanılıyor. FITS görüntüleri doğrulanarak indirilir. '+stored.note});
    }
    const reason = error instanceof Error ? error.message : 'Bilinmeyen hata';
    return Response.json({ error: 'NASA/IPAC SIA2 katalog sorgusu tamamlanamadı: ' + reason }, { status: 502 });
  }
}
