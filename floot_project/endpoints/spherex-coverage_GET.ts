import {db} from '../helpers/db';
import {gunzipSync} from 'node:zlib';
import {normalizeLegacyPSFScience,type ScienceFrameData} from '../helpers/science-fits';
import type {OutputType} from './spherex-coverage_GET.schema';

// Scientific completeness means actual cached FITS-derived layers, not just
// preview-PNG availability. Safe aggregate diagnostics; no private credentials.
export async function handle(){
  try{
    const targets=await db.selectFrom('spherexTargets')
      .select(['id','labelTr','cachedFrameCount']).orderBy('id').execute();
    const frames=await db.selectFrom('spherexProcessedFrames')
      .select(['targetId','scienceGzip','validFraction','sourceSha256']).execute();
    const result:OutputType['targets']=[];
    for(const target of targets){
      const matches=frames.filter(frame=>frame.targetId===target.id);
      let epsfReady=0,waveReady=0,lowCoverage=0,legacyCorrected=0,unreadable=0;
      for(const row of matches){
        try{
          const original=JSON.parse(gunzipSync(Buffer.from(row.scienceGzip,'base64')).toString('utf8')) as ScienceFrameData;
          if(original.psf?.oversampling===10)legacyCorrected++;
          const data=normalizeLegacyPSFScience(original);
          if(data.psf?.status==='measured-from-EPSF')epsfReady++;
          if(data.center_wavelength_um!==null&&data.center_wavelength_um!==undefined)waveReady++;
          if(data.valid_fraction<0.5)lowCoverage++;
        }catch{unreadable++}
      }
      result.push({id:target.id,label:target.labelTr,expected_cached:target.cachedFrameCount,
        processed:matches.length,epsf_ready:epsfReady,wavelength_ready:waveReady,
        low_coverage:lowCoverage,legacy_scale_corrected:legacyCorrected,
        unreadable,sha256_present:matches.filter(item=>!!item.sourceSha256).length});
    }
    return Response.json({targets:result,note:'Cached FITS-derived layer audit; EPSF readiness is not precision-photometry validation.'} satisfies OutputType,
      {headers:{'Cache-Control':'no-store'}});
  }catch(err){
    return Response.json({error:'Bilimsel önbellek kalite denetimi başarısız: '+String(err)},{status:502});
  }
}