import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {db} from './db';
import {sql} from 'kysely';
import {normalizeLegacyPSFScience,type ScienceFrameData} from './science-fits';
import {preserveCatalogObservations} from './spherex-catalog-merge';

export function cacheKey(value:string){return createHash('sha256').update(value).digest('hex')}
export async function findTargetForPosition(ra:number,dec:number,detector?:string){
  return db.selectFrom('spherexTargets').select(['id','labelTr','raDeg','decDeg','detector'])
    .where('raDeg','>=',ra-.00003).where('raDeg','<=',ra+.00003)
    .where('decDeg','>=',dec-.00003).where('decDeg','<=',dec+.00003)
    .$if(Boolean(detector),qb=>qb.where('detector','=',detector!))
    .executeTakeFirst();
}
export async function loadCachedCatalog(cacheKeyValue:string){
  const result=await db.selectFrom('spherexCatalogCache')
    // Floot's Kysely CamelCasePlugin rewrites nested JSON keys on SELECT.
    // Read the original JSON text to preserve NASA endpoint snake_case keys.
    .select(['cachedAt','freshUntil',sql<string>`result_json::text`.as('originalJson')])
    .where('cacheKey','=',cacheKeyValue).executeTakeFirst();
  if(!result)return null;
  return {data:JSON.parse(result.originalJson),cachedAt:result.cachedAt,
    fresh:new Date(result.freshUntil).getTime()>Date.now()};
}
export async function saveCatalog(cacheKeyValue:string,ra:number,dec:number,detector:string,result:unknown,availableCount:number){
  const target=await findTargetForPosition(ra,dec,detector);
  // Catalogue TTL expiry is not a scientific-data deletion event. Keep old
  // real NASA file references even if today's SIA result selects fewer dates.
  const existing=await loadCachedCatalog(cacheKeyValue);
  const preserved=preserveCatalogObservations(existing?.data,result);
  await db.insertInto('spherexCatalogCache').values({
    cacheKey:cacheKeyValue,targetId:target?.id??null,raDeg:ra,decDeg:dec,
    detector,resultJson:preserved as any,cachedAt:new Date(),freshUntil:new Date(Date.now()+86400000)
  }).onConflict(oc=>oc.column('cacheKey').doUpdateSet({
    resultJson:preserved as any,cachedAt:new Date(),freshUntil:new Date(Date.now()+86400000)
  })).execute();
  if(target)await db.updateTable('spherexTargets').set({
    availableCount,catalogSource:'NASA SIA2 / confirmed',lastCheckedAt:new Date(),
    updatedAt:new Date()
  }).where('id','=',target.id).execute();
}
export async function loadCachedScience(url:string){
  const cached=await db.selectFrom('spherexProcessedFrames').select([
    'previewPng','scienceGzip','nativeWidth','nativeHeight','notes'
  ]).where('cacheKey','=',cacheKey(url)).executeTakeFirst();
  if(!cached)return null;
  const science=normalizeLegacyPSFScience(JSON.parse(gunzipSync(Buffer.from(cached.scienceGzip,'base64')).toString('utf8')) as ScienceFrameData);
  return {png:cached.previewPng,width:science.preview_width,height:science.preview_height,
    native_width:cached.nativeWidth,native_height:cached.nativeHeight,science,note:cached.notes,
    from_cache:true};
}
export async function saveScience(url:string,bytes:Uint8Array,result:{
  png:string;native_width:number;native_height:number;science:ScienceFrameData;note:string;
}){
  const match=new URL(url).searchParams.get('center')?.match(/^([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?)d?$/);
  // The same field has different science products in each SPHEREx detector.
  // The Level-2 NASA URL carries the detector before the FITS filename.
  const detectorNumber=new URL(url).pathname.match(/\/([1-6])\/level2_/i)?.[1];
  const target=match&&detectorNumber
    ?await findTargetForPosition(Number(match[1]),Number(match[2]),'SPHEREx-D'+detectorNumber)
    :null;
  const scienceGzip=gzipSync(JSON.stringify(result.science),{level:6}).toString('base64');
  // Genuine long-wavelength D5/D6 science previews contain more structured
  // detector noise and need about 1.1–1.3 MB in lossless PNG form. The old
  // 800 kB guard silently skipped valid images, leaving the target empty.
  // Preserve the scientific preview at native generated resolution, while
  // retaining a strict per-record upper bound for database safety.
  if(scienceGzip.length>2_000_000||result.png.length>1_650_000)
    throw new Error('Bilimsel önbellek kayıt boyutu güvenli sınırı aştı');
  // FITS filenames contain SPHEREx survey week/reduction identifiers, not a
  // reliable UTC observation timestamp. Resolve time from the NASA SIA2
  // catalogue entry that supplied this exact source FITS URL.
  let observedUtc:Date|null=null;
  if(target){
    const catalog=await db.selectFrom('spherexCatalogCache')
      .select(sql<string>`result_json::text`.as('originalJson'))
      .where('targetId','=',target.id).orderBy('cachedAt','desc').executeTakeFirst();
    if(catalog){
      try{
        const entries=JSON.parse(catalog.originalJson) as {
          frames?:{source_fits_cutout_url:string;observed_utc:string}[];
        };
        const pathname=new URL(url).pathname;
        const entry=entries.frames?.find(row=>new URL(row.source_fits_cutout_url).pathname===pathname);
        if(entry&&Number.isFinite(Date.parse(entry.observed_utc))){
          observedUtc=new Date(entry.observed_utc);
        }
      }catch{
        // Missing/malformed catalogue time must remain null, not be invented.
      }
    }
  }
  await db.insertInto('spherexProcessedFrames').values({
    cacheKey:cacheKey(url),targetId:target?.id??null,
    observedUtc:observedUtc&&Number.isFinite(observedUtc.getTime())?observedUtc:null,
    sourceUrl:url,previewPng:result.png,scienceGzip,
    sourceSha256:createHash('sha256').update(bytes).digest('hex'),
    nativeWidth:result.native_width,nativeHeight:result.native_height,
    validFraction:result.science.valid_fraction,waveCenterUm:result.science.center_wavelength_um,
    notes:result.note
  }).onConflict(oc=>oc.column('cacheKey').doUpdateSet({
    previewPng:result.png,scienceGzip,
    sourceSha256:createHash('sha256').update(bytes).digest('hex'),
    ...(observedUtc?{observedUtc}:{}),
    nativeWidth:result.native_width,nativeHeight:result.native_height,
    validFraction:result.science.valid_fraction,
    waveCenterUm:result.science.center_wavelength_um,
    notes:result.note,createdAt:new Date()
  })).execute();
  if(target){
    const counts=await db.selectFrom('spherexProcessedFrames')
      .select(eb=>eb.fn.countAll<number>().as('total')).where('targetId','=',target.id).executeTakeFirst();
    await db.updateTable('spherexTargets').set({cachedFrameCount:Number(counts?.total||0),updatedAt:new Date()})
      .where('id','=',target.id).execute();
  }
}