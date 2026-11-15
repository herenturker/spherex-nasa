import {schema,type OutputType} from './spherex-report_POST.schema';
import {db} from '../helpers/db';
import {prepareResearchReport} from '../helpers/spherex-report';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeLegacyPSFScience,type ScienceFrameData} from '../helpers/science-fits';
import {sql} from 'kysely';
export async function handle(request:Request){
  let body:unknown;
  try{body=await request.json()}catch{return Response.json({error:'JSON bekleniyor'},{status:400})}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return Response.json({error:'Geçerli kayıtlı hedef kodu gerekli'},{status:400});
  try{
    const target=await db.selectFrom('spherexTargets')
      .select(['id','labelTr']).where('id','=',parsed.data.id).executeTakeFirst();
    if(!target)return Response.json({error:'Bu hedef katalogda kayıtlı değil'},{status:404});
    const catalog=await db.selectFrom('spherexCatalogCache')
      .select(sql<string>`result_json::text`.as('originalJson'))
      .where('targetId','=',target.id).orderBy('cachedAt','desc').executeTakeFirst();
    if(!catalog)return Response.json({error:'NASA katalog indeksi önce araştırılmalı'},{status:409});
    const catalogue=JSON.parse(catalog.originalJson) as {frames?:{
      observed_utc:string;source_fits_cutout_url:string}[]};
    const expected=(catalogue.frames||[]).slice(0,72).map(f=>{
      const url=new URL(f.source_fits_cutout_url);
      url.searchParams.set('size','0.2');
      return {date:f.observed_utc,url:url.toString()};
    });
    const saved=await db.selectFrom('spherexProcessedFrames')
      .select(['cacheKey','sourceUrl','scienceGzip','sourceSha256']).where('targetId','=',target.id)
      .orderBy('createdAt','desc').limit(120).execute();
    const scienceByUrl=new Map(saved.map(item=>[item.sourceUrl,item]));
    const frames=expected.filter(item=>scienceByUrl.has(item.url)).slice(0,12).map(item=>({
      observed_utc:item.date,source_fits_cutout_url:item.url,
      science:normalizeLegacyPSFScience(JSON.parse(gunzipSync(Buffer.from(scienceByUrl.get(item.url)!.scienceGzip,'base64')).toString('utf8')) as ScienceFrameData)
    }));
    if(frames.length<2)return Response.json({error:'Bilimsel rapor için en az iki kalıcı FITS görüntüsü gerekli'},{status:409});
    const report=prepareResearchReport(target.labelTr,frames);
    const modelVersion='epsf-screening-v4-long-epoch-priority';
    const hash=createHash('sha256').update(modelVersion+'|'+frames.map(item=>{
      const source=scienceByUrl.get(item.source_fits_cutout_url)!;
      return item.source_fits_cutout_url+'|'+source.sourceSha256+'|'+
        (item.science.psf?.sigma_native_pix??'no-epsf');
    }).join('|')).digest('hex').slice(0,16);
    const key=target.id+'_'+hash;
    const now=new Date();
    await db.insertInto('spherexReports').values({reportKey:key,targetId:target.id,
      reportJson:report as any,createdAt:now})
      .onConflict(oc=>oc.column('reportKey').doUpdateSet({
        reportJson:report as any,createdAt:now
      })).execute();
    const output:OutputType={report_key:key,target_id:target.id,stored:true,
      ready_frames:frames.length,comparisons:report.comparisons.length,saved_at:now.toISOString()};
    return Response.json(output);
  }catch(err){
    return Response.json({error:'Bilimsel rapor arşivi: '+(err instanceof Error?err.message:'Bilinmeyen hata')},{status:502});
  }
}