import {db} from '../helpers/db';
import type {OutputType} from './spherex-targets_GET.schema';
export async function handle(){
  try{
    const targets=await db.selectFrom('spherexTargets').selectAll().orderBy('labelTr','asc').execute();
    const output:OutputType={targets:targets.map(item=>({
      id:item.id,label_tr:item.labelTr,label_en:item.labelEn,object_type:item.objectType,
      ra_deg:item.raDeg,dec_deg:item.decDeg,detector:item.detector,
      description_tr:item.descriptionTr,bundled_zip:item.bundledZip,
      available_count:item.availableCount,cached_frame_count:item.cachedFrameCount,
      last_checked_at:item.lastCheckedAt?new Date(item.lastCheckedAt).toISOString():null,
      source:item.catalogSource
    })),cache_policy:'24h-index-on-demand;immutable-FITS'};
    return Response.json(output,{headers:{'Cache-Control':'public,max-age=60'}});
  }catch(error){
    return Response.json({error:'SPHEREx hedef listesi okunamadı'},{status:503});
  }
}