import type {ScienceFrameData,PSFDiagnostic} from './science-fits';

// Reproducible diagnostics for a hackathon/exploration product.
// NOT the official SPHEREx L3 forced-photometry pipeline.
export type AperturePhotometry={
  method:'central-circular-aperture-background-annulus';
  aperture_radius_grid_px:2.5;annulus_inner_grid_px:5;annulus_outer_grid_px:8;
  aperture_sample_count:number;background_sample_count:number;
  center_valid_count:number;
  background_MJy_sr:number|null;
  aperture_sum_MJy_sr_pixel:number|null;
  formal_uncertainty_MJy_sr_pixel:number|null;
  band_center_um:number|null;
  status:'estimated'|'insufficient-valid-pixels';
};
export type PairDiagnostic={
  psf_status:'approximate-local-EPSF-homogenized'|'not-available';
  width_a_native_px:number|null;width_b_native_px:number|null;
  blur_a_grid_px:number|null;blur_b_grid_px:number|null;
  registered_valid_pixels:number;spectrally_matched_pixels:number;
  residual_median_MJy_sr:number|null;empirical_scatter_MJy_sr:number|null;
  peak_conservative_score:number|null;
  screening_pixels_above_6:number;
  coherent_regions_for_review:number;
  strongest_region:{
    center_grid_x:number;center_grid_y:number;
    area_pixels:number;peak_screening_score:number;polarity:'brightened'|'dimmed';
  }|null;
  central_aperture_delta_MJy_sr_pixel:number|null;
  central_aperture_formal_sigma:number|null;
  screening_status:'insufficient-overlap'|'limited-PSF'|'low-quality'|'visual-review-only';
};
const valid=(v:number|null|undefined):v is number=>
  typeof v==='number'&&Number.isFinite(v);
function med(v:number[]):number|null{
  if(!v.length)return null;
  v.sort((a,b)=>a-b);
  return v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2;
}
export function apertureAtSkyCenter(data:ScienceFrameData):AperturePhotometry{
  const n=data.grid_size,mid=(n-1)/2;
  const aperture:{value:number;v:number}[]=[];
  const annulus:number[]=[];
  let coreValid=0;
  for(let i=0;i<n*n;i++){
    const intensity=data.flux[i],v=data.variance[i];
    if(!valid(intensity)||!valid(v)||v<=0)continue;
    const radius=Math.hypot(i%n-mid,Math.floor(i/n)-mid);
    if(radius<1.5)coreValid++;
    if(radius<=2.5)aperture.push({value:intensity,v});
    if(radius>=5&&radius<=8)annulus.push(intensity);
  }
  const baseline=med(annulus);
  // Do not infer a central object's brightness from a bright surrounding
  // annulus if the object's core is saturated, flagged or otherwise missing.
  const status=coreValid>=3&&aperture.length>=10&&annulus.length>=25&&baseline!==null?
    'estimated':'insufficient-valid-pixels';
  const scatter=baseline===null?null:med(annulus.map(value=>Math.abs(value-baseline)));
  // This is a conservative background-variation term for the mean background;
  // it does not capture spatially correlated errors or absolute calibration.
  const noiseOfBackground=scatter===null?0:
    1.4826*scatter/Math.sqrt(Math.max(1,annulus.length));
  const total=baseline===null?null:aperture.reduce((sum,item)=>sum+item.value-baseline,0);
  const totalVar=aperture.reduce((sum,item)=>sum+item.v,0)+
    (aperture.length*noiseOfBackground)**2;
  return {
    method:'central-circular-aperture-background-annulus',
    aperture_radius_grid_px:2.5,annulus_inner_grid_px:5,annulus_outer_grid_px:8,
    aperture_sample_count:aperture.length,background_sample_count:annulus.length,
    center_valid_count:coreValid,
    background_MJy_sr:status==='estimated'?baseline:null,
    aperture_sum_MJy_sr_pixel:status==='estimated'?total:null,
    formal_uncertainty_MJy_sr_pixel:status==='estimated'&&totalVar>0?Math.sqrt(totalVar):null,
    band_center_um:data.center_wavelength_um,
    status
  };
}

type Grid={flux:(number|null)[];variance:(number|null)[]};
export type PSFMatchedPair={
  a:Grid;b:Grid;
  status:'approximate-local-EPSF-homogenized'|'not-available';
  blur_a_grid_px:number|null;blur_b_grid_px:number|null;
};
function smoothWithGaussian(source:ScienceFrameData,sigma:number):Grid{
  if(sigma<.12)return {flux:source.flux,variance:source.variance};
  const n=source.grid_size,rad=Math.min(5,Math.max(1,Math.ceil(3*sigma)));
  const weights:number[]=[];
  for(let i=-rad;i<=rad;i++)weights.push(Math.exp(-.5*(i/sigma)**2));
  const outFlux:(number|null)[]=new Array(n*n).fill(null);
  const outVar:(number|null)[]=new Array(n*n).fill(null);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const at=y*n+x,centerBand=source.wavelength_um[at],
      centerWidth=source.bandwidth_um[at];
    if(!valid(source.flux[at])||!valid(source.variance[at]))continue;
    let sum=0,f=0,v=0,possible=0;
    for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){
      const w=weights[dy+rad]*weights[dx+rad];
      const yy=y+dy,xx=x+dx;
      if(yy<0||xx<0||yy>=n||xx>=n)continue;
      possible+=w;
      const j=yy*n+xx,other=source.flux[j],otherVar=source.variance[j];
      if(!valid(other)||!valid(otherVar)||otherVar<=0)continue;
      const otherBand=source.wavelength_um[j],
        otherWidth=source.bandwidth_um[j];
      if(valid(centerBand)&&valid(otherBand)&&valid(centerWidth)&&valid(otherWidth)&&
        Math.abs(centerBand-otherBand)>.5*(centerWidth+otherWidth))continue;
      sum+=w;f+=w*other;v+=w*w*otherVar;
    }
    // If masked neighbouring pixels dominate, retain a hole rather than
    // inventing signal from the surviving border.
    if(sum<.9*possible)continue;
    outFlux[at]=f/sum;outVar[at]=v/(sum*sum);
  }
  return {flux:outFlux,variance:outVar};
}
function widthOnGrid(psf:PSFDiagnostic,frame:ScienceFrameData){
  const nativeArcsec=6.15;
  const gridArcsec=frame.grid_field_deg*3600/frame.grid_size;
  return psf.sigma_native_pix*nativeArcsec/gridArcsec;
}
export function matchPSFWidths(a:ScienceFrameData,b:ScienceFrameData):PSFMatchedPair{
  const pa=a.psf?.status==='measured-from-EPSF'?a.psf:null;
  const pb=b.psf?.status==='measured-from-EPSF'?b.psf:null;
  const psfStatus=pa&&pb?'approximate-local-EPSF-homogenized':'not-available';
  const sigmaA=pa?widthOnGrid(pa,a):0,sigmaB=pb?widthOnGrid(pb,b):0;
  const commonSigma=Math.max(sigmaA,sigmaB);
  const blurA=pa&&pb?Math.sqrt(Math.max(0,commonSigma**2-sigmaA**2)):null;
  const blurB=pa&&pb?Math.sqrt(Math.max(0,commonSigma**2-sigmaB**2)):null;
  const fa=pa&&pb?smoothWithGaussian(a,blurA||0):{flux:a.flux,variance:a.variance};
  const fb=pa&&pb?smoothWithGaussian(b,blurB||0):{flux:b.flux,variance:b.variance};
  return {a:fa,b:fb,status:psfStatus,blur_a_grid_px:blurA,blur_b_grid_px:blurB};
}
export function pairDiagnostic(a:ScienceFrameData,b:ScienceFrameData):PairDiagnostic{
  const aligned=a.grid_size===b.grid_size&&
    Math.abs(a.grid_field_deg-b.grid_field_deg)<1e-8;
  const pa=a.psf?.status==='measured-from-EPSF'?a.psf:null;
  const pb=b.psf?.status==='measured-from-EPSF'?b.psf:null;
  const matched=matchPSFWidths(a,b);
  const fa=matched.a,fb=matched.b;
  const psfStatus=matched.status,blurA=matched.blur_a_grid_px,blurB=matched.blur_b_grid_px;
  if(!aligned)return {psf_status:psfStatus,width_a_native_px:pa?.sigma_native_pix??null,
    width_b_native_px:pb?.sigma_native_pix??null,blur_a_grid_px:blurA,blur_b_grid_px:blurB,
    registered_valid_pixels:0,spectrally_matched_pixels:0,residual_median_MJy_sr:null,
    empirical_scatter_MJy_sr:null,peak_conservative_score:null,screening_pixels_above_6:0,
    central_aperture_delta_MJy_sr_pixel:null,central_aperture_formal_sigma:null,
    coherent_regions_for_review:0,strongest_region:null,
    screening_status:'insufficient-overlap'};
  let registered=0;
  const differences:{index:number;value:number;formalVar:number}[]=[];
  for(let i=0;i<a.grid_size*a.grid_size;i++){
    const av=fa.flux[i],bv=fb.flux[i],va=fa.variance[i],vb=fb.variance[i];
    if(!valid(av)||!valid(bv)||!valid(va)||!valid(vb))continue;
    registered++;
    const wa=a.wavelength_um[i],wb=b.wavelength_um[i],
      ba=a.bandwidth_um[i],bb=b.bandwidth_um[i];
    if(!valid(wa)||!valid(wb)||!valid(ba)||!valid(bb)||ba<=0||bb<=0)continue;
    if(Math.abs(wa-wb)>.5*(ba+bb))continue;
    differences.push({index:i,value:bv-av,formalVar:va+vb});
  }
  const offset=med(differences.map(item=>item.value));
  const mad=offset===null?null:med(differences.map(item=>Math.abs(item.value-offset)));
  const empiricalSigma=mad===null?null:1.4826*mad;
  // A low-coverage or uncalibrated-width pair may be displayed but must not
  // emit automated candidate regions, regardless of isolated high scores.
  const lowQuality=a.valid_fraction<.5||b.valid_fraction<.5;
  const eligible=!lowQuality&&!!pa&&!!pb&&differences.length>=300;
  let score=0,screened=0;
  // Coherent neighbourhoods are a screening aid, not independent 6-sigma
  // detections. Require at least four adjacent matched-sign pixels to avoid
  // counting isolated bad or cosmic-ray pixels as candidate objects.
  const scoreMap=new Float64Array(a.grid_size*a.grid_size);
  const signMap=new Int8Array(a.grid_size*a.grid_size);
  if(eligible&&offset!==null&&empiricalSigma!==null){
    for(const item of differences){
      // Empirical field scatter + formal image variance. This deliberately
      // screens conservatively, but is NOT a calibrated p-value.
      const denominator=Math.sqrt(item.formalVar+empiricalSigma**2);
      const z=denominator>0?Math.abs(item.value-offset)/denominator:0;
      score=Math.max(score,z);
      if(z>=6){
        screened++;
        scoreMap[item.index]=z;
        signMap[item.index]=item.value-offset>0?1:-1;
      }
    }
  }
  const seen=new Uint8Array(scoreMap.length),regions:{
    center_grid_x:number;center_grid_y:number;area_pixels:number;
    peak_screening_score:number;polarity:'brightened'|'dimmed';
  }[]=[];
  for(let i=0;i<scoreMap.length;i++){
    if(seen[i]||!signMap[i])continue;
    const stack=[i];seen[i]=1;
    let count=0,sx=0,sy=0,peak=0;
    const polarity=signMap[i];
    while(stack.length){
      const k=stack.pop()!,x=k%a.grid_size,y=Math.floor(k/a.grid_size);
      count++;sx+=x;sy+=y;peak=Math.max(peak,scoreMap[k]);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;
        const xx=x+dx,yy=y+dy;
        if(xx<0||yy<0||xx>=a.grid_size||yy>=a.grid_size)continue;
        const j=yy*a.grid_size+xx;
        if(!seen[j]&&signMap[j]===polarity){seen[j]=1;stack.push(j)}
      }
    }
    if(count>=4)regions.push({
      center_grid_x:Number((sx/count).toFixed(2)),
      center_grid_y:Number((sy/count).toFixed(2)),
      area_pixels:count,peak_screening_score:Number(peak.toFixed(2)),
      polarity:polarity===1?'brightened':'dimmed'
    });
  }
  regions.sort((x,y)=>y.peak_screening_score-x.peak_screening_score);
  const aa=apertureAtSkyCenter(a),ab=apertureAtSkyCenter(b);
  const waveA=aa.band_center_um,waveB=ab.band_center_um;
  const spectrallyCompatible=valid(waveA)&&valid(waveB)&&
    valid(a.center_bandwidth_um)&&valid(b.center_bandwidth_um)&&
    Math.abs(waveA-waveB)<=.5*(a.center_bandwidth_um+b.center_bandwidth_um);
  const photoAvailable=spectrallyCompatible&&
    valid(aa.aperture_sum_MJy_sr_pixel)&&valid(ab.aperture_sum_MJy_sr_pixel)&&
    valid(aa.formal_uncertainty_MJy_sr_pixel)&&valid(ab.formal_uncertainty_MJy_sr_pixel);
  return {
    psf_status:psfStatus,width_a_native_px:pa?.sigma_native_pix??null,
    width_b_native_px:pb?.sigma_native_pix??null,
    blur_a_grid_px:blurA,blur_b_grid_px:blurB,
    registered_valid_pixels:registered,
    spectrally_matched_pixels:differences.length,
    residual_median_MJy_sr:offset,empirical_scatter_MJy_sr:empiricalSigma,
    peak_conservative_score:eligible?score:null,
    screening_pixels_above_6:screened,
    coherent_regions_for_review:regions.length,strongest_region:regions[0]||null,
    central_aperture_delta_MJy_sr_pixel:photoAvailable?
      ab.aperture_sum_MJy_sr_pixel!-aa.aperture_sum_MJy_sr_pixel!:null,
    central_aperture_formal_sigma:photoAvailable?
      Math.sqrt(aa.formal_uncertainty_MJy_sr_pixel!**2+
        ab.formal_uncertainty_MJy_sr_pixel!**2):null,
    screening_status:lowQuality?'low-quality':differences.length<300?'insufficient-overlap':
      pa&&pb?'visual-review-only':'limited-PSF'
  };
}