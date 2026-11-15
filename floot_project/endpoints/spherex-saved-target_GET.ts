import {schema,type OutputType} from './spherex-saved-target_GET.schema';
import {db} from '../helpers/db';
import {cacheKey} from '../helpers/spherex-cache';
import {gunzipSync} from 'node:zlib';
import {normalizeLegacyPSFScience,type ScienceFrameData} from '../helpers/science-fits';
import {sql} from 'kysely';

export async function handle(request:Request){
  const parsed=schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!parsed.success)return Response.json({error:'Hedef kodu geçersiz.'},{status:400});
  try{
    const target=await db.selectFrom('spherexTargets')
      .select(['id','labelTr','raDeg','decDeg','detector','lastCheckedAt'])
      .where('id','=',parsed.data.id).executeTakeFirst();
    if(!target)return Response.json({error:'Bilinmeyen gökyüzü hedefi.'},{status:404});
    const catalog=await db.selectFrom('spherexCatalogCache')
      .select(['cachedAt','freshUntil',sql<string>`result_json::text`.as('originalJson')]).where('targetId','=',target.id)
      .orderBy('cachedAt','desc').executeTakeFirst();
    if(!catalog)return Response.json({target:{id:target.id,label_tr:target.labelTr,ra_deg:target.raDeg,
      dec_deg:target.decDeg,detector:target.detector},frames:[],catalog_fresh:false,
      catalog_source:'saved-NASA-index',catalog_last_checked_at:null} satisfies OutputType);
    const stored=JSON.parse(catalog.originalJson) as {
      frames?:{observed_utc:string;source_fits_cutout_url:string}[];
    };
    const candidates=(stored.frames||[]).slice(0,72).map((entry,i)=>{
      const url=new URL(entry.source_fits_cutout_url);
      url.searchParams.set('size','0.2');
      return {file:'saved_'+(i+1)+'.png',observed_utc:entry.observed_utc,
        source_fits_cutout_url:url.toString(),key:cacheKey(url.toString())};
    });
    if(candidates.length===0)return Response.json({error:'Kaydedilmiş katalogda uygun gözlem bulunamadı'},{status:404});
    const prepared=await db.selectFrom('spherexProcessedFrames')
      .select(['cacheKey','previewPng','scienceGzip']).where('cacheKey','in',candidates.map(c=>c.key))
      .execute();
    const byKey=new Map(prepared.map(item=>[item.cacheKey,item]));
    const frames:OutputType['frames']=[];
    for(const entry of candidates){
      const cached=byKey.get(entry.key);
      if(!cached)continue;
      const science=normalizeLegacyPSFScience(JSON.parse(gunzipSync(Buffer.from(cached.scienceGzip,'base64')).toString('utf8')) as ScienceFrameData);
      frames.push({file:entry.file,observed_utc:entry.observed_utc,
        source_fits_cutout_url:entry.source_fits_cutout_url,src:cached.previewPng,science});
      // Preserve additional genuine observations prepared for wavelength
      // matching rather than hiding all visits after the first six.
      if(frames.length===12)break;
    }
    frames.sort((a,b)=>Date.parse(a.observed_utc)-Date.parse(b.observed_utc));
    const result:OutputType={
      target:{id:target.id,label_tr:target.labelTr,ra_deg:target.raDeg,dec_deg:target.decDeg,detector:target.detector},
      frames,catalog_last_checked_at:new Date(catalog.cachedAt).toISOString(),
      catalog_fresh:new Date(catalog.freshUntil).getTime()>Date.now(),
      catalog_source:'saved-NASA-index'
    };
    return Response.json(result,{headers:{'Cache-Control':'public,max-age=120'}});
  }catch(err){
    return Response.json({error:'Kayıtlı bilimsel görüntüler okunamadı: '+(err instanceof Error?err.message:'Hata')},{status:502});
  }
}