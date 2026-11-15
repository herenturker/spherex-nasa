import type {ScienceFrameData} from './science-fits';

type ScienceObservation={observed_utc:string;science?:ScienceFrameData};
const finite=(v:number|null|undefined):v is number=>v!==null&&v!==undefined&&Number.isFinite(v);
export type DefaultComparison={
  first:number;second:number;matched:number;scientificallyComparable:boolean;
};
export const MIN_SCIENCE_BASELINE_DAYS=14;
export function pairBaselineDays(dateA:string,dateB:string){
  const a=Date.parse(dateA),b=Date.parse(dateB);
  return Number.isFinite(a)&&Number.isFinite(b)?Math.abs(b-a)/86400000:0;
}

/**
 * Choose genuinely different visits, not merely two different array indexes.
 * Compare exactly the pixels the laboratory is allowed to use (flux, variance,
 * overlapping approximate passbands). If none qualifies, display a single
 * original observation as a labelled visual control -- never as a detection.
 */
export function chooseDefaultComparison(observations:ScienceObservation[]):DefaultComparison{
  if(!observations.length)return {first:0,second:0,matched:0,scientificallyComparable:false};
  let reference=0,referenceCoverage=-1;
  for(let i=0;i<observations.length;i++){
    const sci=observations[i].science;
    if(!sci)continue;
    const coverage=finite(sci.valid_fraction)?sci.valid_fraction:0;
    if(coverage>referenceCoverage){reference=i;referenceCoverage=coverage;}
  }
  let best:DefaultComparison={first:reference,second:reference,matched:0,scientificallyComparable:false};
  let bestLongEpoch=false;
  for(let i=0;i<observations.length;i++)for(let j=i+1;j<observations.length;j++){
    const a=observations[i],b=observations[j],x=a.science,y=b.science;
    if(!x||!y||a.observed_utc===b.observed_utc)continue;
    if(x.grid_size!==y.grid_size||Math.abs(x.grid_field_deg-y.grid_field_deg)>1e-8)continue;
    if(x.valid_fraction<.5||y.valid_fraction<.5)continue;
    let matched=0;
    for(let k=0;k<x.flux.length;k++){
      if(!finite(x.flux[k])||!finite(y.flux[k])||
        !finite(x.variance[k])||!finite(y.variance[k]))continue;
      const wa=x.wavelength_um[k],wb=y.wavelength_um[k];
      const ba=x.bandwidth_um[k],bb=y.bandwidth_um[k];
      if(finite(wa)&&finite(wb)&&finite(ba)&&finite(bb)&&
        Math.abs(wa-wb)<=.5*(ba+bb))matched++;
    }
    // The provisional grid comparison requires at least 300 consistent pixels.
    if(matched<300)continue;
    const longEpoch=pairBaselineDays(a.observed_utc,b.observed_utc)>=MIN_SCIENCE_BASELINE_DAYS;
    if(!best.scientificallyComparable || (longEpoch&&!bestLongEpoch) ||
       (longEpoch===bestLongEpoch&&matched>best.matched)){
      best={first:i,second:j,matched,scientificallyComparable:true};
      bestLongEpoch=longEpoch;
    }
  }
  return best;
}