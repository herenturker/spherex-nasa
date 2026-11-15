import type {OutputType} from './spherex-self-test_GET.schema';
import {apertureAtSkyCenter,pairDiagnostic} from '../helpers/astro-photometry';
import {normalizeLegacyPSFScience,type ScienceFrameData,type PSFDiagnostic} from '../helpers/science-fits';

const psf:PSFDiagnostic={status:'measured-from-EPSF',detector_zone_x:10,detector_zone_y:10,
  sigma_native_pix:.31,fwhm_arcsec_approx:4.49,oversampling:5,
  method:'local-EPSF-second-moment'};
function frame(intensity=1,band=1.5):ScienceFrameData{
  const size=96,n=size*size;
  return {
    grid_size:size,grid_field_deg:.16,
    flux:new Array(n).fill(intensity),variance:new Array(n).fill(.0025),
    wavelength_um:new Array(n).fill(band),bandwidth_um:new Array(n).fill(.04),
    center_wavelength_um:band,center_bandwidth_um:.04,
    valid_fraction:1,flagged_fraction:0,
    native_width:117,native_height:117,preview_width:576,preview_height:576,
    wcs:'TAN-SIP',units:'MJy/sr',wavelength_status:'WCS-WAVE-approximate',
    p02:intensity,p98:intensity,median:intensity,masked_pixels:0,psf
  };
}
export async function handle(){
  const cases:OutputType['tests']=[];
  const record=(name:string,passed:boolean,detail:string)=>cases.push({name,passed,detail});
  try{
    const base=frame(),same=frame();
    const equality=pairDiagnostic(base,same);
    record('Identical frames reject false changes',
      equality.screening_pixels_above_6===0&&equality.peak_conservative_score===0,
      'Equivalent aligned frames must produce zero candidate-screen pixels');
    const injected=frame();
    injected.flux[48*96+48]=20;
    const changed=pairDiagnostic(base,injected);
    record('Synthetic known pixel perturbation is visible',
      changed.screening_pixels_above_6>0&&
      (changed.peak_conservative_score??0)>6,
      'A deliberately injected artificial change must pass the preliminary screen');
    record('Single-pixel glitch is not a coherent candidate region',
      changed.coherent_regions_for_review===0,
      'A single isolated spike is not a coherent multi-pixel region');
    const extended=frame();
    for(let y=46;y<=49;y++)for(let x=46;x<=49;x++)extended.flux[y*96+x]=20;
    const grouped=pairDiagnostic(base,extended);
    record('Injected multi-pixel residual becomes a review-only region',
      grouped.coherent_regions_for_review===1&&
      (grouped.strongest_region?.area_pixels??0)>=4&&
      grouped.strongest_region?.polarity==='brightened',
      'A synthetic coherent cluster is marked for human review, never a confirmed discovery');
    const reverse=pairDiagnostic(extended,base);
    record('Time reversal changes the residual sign',
      reverse.strongest_region?.polarity==='dimmed',
      'A flux change reverses brightened/dimmed when A/B swap');
    const bandMismatch=pairDiagnostic(base,frame(1,2.2));
    record('Mismatched infrared bands blocked',
      bandMismatch.spectrally_matched_pixels===0&&
      bandMismatch.screening_status==='insufficient-overlap'&&
      bandMismatch.coherent_regions_for_review===0,
      'Different bands cannot be compared as if they were the same wavelength');
    const noPSF=frame();
    noPSF.psf=null;
    const missing=pairDiagnostic(base,noPSF);
    record('Missing EPSF not misrepresented as matched',
      missing.psf_status==='not-available'&&
      missing.screening_status==='limited-PSF',
      'No computed PSF claim when the metadata are missing');
    const accurate=frame();
    accurate.psf={...psf,sigma_native_pix:.47};
    const broaden=pairDiagnostic(base,accurate);
    record('Different measured EPSF widths invoke approximate matching',
      broaden.psf_status==='approximate-local-EPSF-homogenized'&&
      (broaden.blur_a_grid_px??0)>0&&
      broaden.blur_b_grid_px===0,
      'Broaden the narrower PSF model only; never deconvolve beyond native resolution');
    const old=frame();old.psf={...psf,oversampling:10,sigma_native_pix:.25,fwhm_arcsec_approx:3.62};
    const fixed=normalizeLegacyPSFScience(old);
    record('DR1 legacy EPSF oversampling factor corrected from 10 to 5',
      fixed.psf?.oversampling===5&&fixed.psf?.sigma_native_pix===.5&&
      normalizeLegacyPSFScience(fixed).psf?.sigma_native_pix===.5,
      'Cached old calibration doubles once, preserving its raw NASA FITS provenance');
    const low=frame();low.valid_fraction=.4;
    const lowResult=pairDiagnostic(base,low);
    record('Low coverage excludes candidate regions',
      lowResult.screening_status==='low-quality'&&
      lowResult.coherent_regions_for_review===0&&
      lowResult.peak_conservative_score===null,
      'Under 50% usable pixels blocks candidate screening, but remains viewable');
    const aperture=apertureAtSkyCenter(base);
    record('Constant field cancels in background-subtracted aperture',
      aperture.status==='estimated'&&
      Math.abs(aperture.aperture_sum_MJy_sr_pixel??999)<1e-9,
      'A constant background should yield zero central excess');
    const invalid=frame();
    invalid.flux.fill(null);
    const missingAperture=apertureAtSkyCenter(invalid);
    record('All-masked field does not output invented photometry',
      missingAperture.status==='insufficient-valid-pixels'&&
      missingAperture.aperture_sum_MJy_sr_pixel===null,
      'Invalid scientific pixels must not create a flux measurement');
    const maskedCore=frame();
    for(let y=46;y<=49;y++)for(let x=46;x<=49;x++)
      maskedCore.flux[y*96+x]=null;
    const missingCore=apertureAtSkyCenter(maskedCore);
    record('Missing central source cannot create forced photometry',
      missingCore.status==='insufficient-valid-pixels'&&
      missingCore.aperture_sum_MJy_sr_pixel===null,
      'Masked or saturated central source pixels must block point-source claims');
    // Fixed-seed Monte Carlo checks for reproducibility. These assess only the
    // synthetic independent-Gaussian null; real SPHEREx noise is correlated
    // and the true astronomical false-alarm rate remains uncalibrated.
    let state=20261114;
    const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return (state+.5)/4294967296};
    const gaussian=()=>Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
    let nullRegions=0,recovered=0;
    const trials=24;
    for(let trial=0;trial<trials;trial++){
      const noiseA=frame(),noiseB=frame(),withInjection=frame();
      for(let k=0;k<noiseA.flux.length;k++){
        noiseA.flux[k]=1+.05*gaussian();
        noiseB.flux[k]=1+.05*gaussian();
        withInjection.flux[k]=noiseB.flux[k];
      }
      if(pairDiagnostic(noiseA,noiseB).coherent_regions_for_review>0)nullRegions++;
      for(let y=44;y<48;y++)for(let x=44;x<48;x++){
        const k=y*96+x;
        withInjection.flux[k]=(withInjection.flux[k]??1)+1.0;
      }
      if(pairDiagnostic(noiseA,withInjection).coherent_regions_for_review>0)recovered++;
    }
    record('Fixed-seed synthetic noise-only false-alarm control',
      nullRegions===0,
      nullRegions+'/'+trials+' independent Gaussian noise-only trials produced a coherent region; real-sky rate is unknown');
    record('Fixed-seed synthetic injected-source recovery',
      recovered===trials,
      recovered+'/'+trials+' strong synthetic multi-pixel injections recovered; not an astrophysical sensitivity estimate');
  }catch(error){
    record('Self-test execution',false,error instanceof Error?error.message:'Unknown test error');
  }
  const passed=cases.filter(item=>item.passed).length;
  const response:OutputType={
    test_suite:'SPHEREx prototype photometry and EPSF screening tests',
    synthetic_only:true,passed,total:cases.length,tests:cases,
    note:'Synthetic software-control tests only. Passing tests do not establish real-source photometric accuracy, statistical false-alarm rates, proper motion or exoplanet discoveries.'
  };
  return Response.json(response,{headers:{'Cache-Control':'no-store'}});
}