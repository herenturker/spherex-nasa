import type {ResearchReport,ComparisonResult} from './spherex-report';
import type {Language} from './i18n';
import {translateTurkish} from './locale-phrases';
const methodEn='NASA/IPAC Level 2 FITS IMAGE minus ZODI brightness measurements, FLAGS/VARIANCE masking, and TAN-SIP WCS nearest-neighbour resampling to a common 96×96 celestial grid. Approximate WCS-WAVE passband overlap is checked for each comparison. Local effective PSF widths are estimated from original EPSF tables, followed by approximate isotropic Gaussian-width matching where applicable. Central-aperture and background estimates, median differences, robust MAD, and clusters of at least four adjacent high-score pixels are reported. These exploratory procedures do not constitute precision Level 3 photometry or verified discovery.';
const disclaimerEn='This numerical report is preliminary and exploratory. Local EPSF second-moment width and approximate isotropic Gaussian matching do not equal full field-dependent EPSF convolution. Central-aperture sums are in MJy/sr × grid pixel units, not calibrated source fluxes in µJy. WCS-WAVE provides approximate passband information; full CWAVE/CBAND, spatially dependent PSF and pixel solid-angle calibration remain outstanding. Correlated resampling noise, background variability, repeated testing and systematic uncertainty prevent screening thresholds and coherent regions from being interpreted as calibrated p-values, confirmed variability, proper motion or discoveries of new celestial objects.';
function englishInterpretation(r:ResearchReport){
  const best=r.best_pair;
  let s=r.ready_frames<2
    ?'A temporal comparison requires science measurements from at least two real FITS frames.'
    :!best||best.spectral_overlap<300
      ?'The images are available, but the date pairs lack sufficient matching wavelengths for a reliable temporal-change interpretation. More observations at comparable wavelengths are needed.'
      :'The strongest approximately passband-matched observation pair comprises frames '+best.a+' and '+best.b+'. Brightness differences were calculated for '+best.spectral_overlap+' common spectral samples. Apparent differences can arise from observing conditions, band response, PSF, background and statistical uncertainty. No calibrated variable source or moving object has been identified.';
  const missing=r.frames.filter(f=>f.aperture?.status==='insufficient-valid-pixels').length;
  if(missing>0)s+=' In '+missing+' frames, too few valid central or background pixels were available for aperture photometry; no source flux was fabricated.';
  return s;
}
function noteEn(c:ComparisonResult){
  if(!c.validation&&c.spatial_overlap===0)return 'Incompatible sky coordinate grids; direct comparison cannot be made.';
  if(c.spectral_overlap<300)return 'Insufficient matching wavelength samples; this pair cannot support a scientific-change interpretation.';
  return 'Approximate wavelength overlap exists. Differences do not substantiate discovery without further photometric calibration and independent validation.';
}
export function localizeResearchReport(r:ResearchReport,language:Language):ResearchReport{
  if(language==='tr')return r;
  const comparisons=r.comparisons.map(c=>({...c,note:noteEn(c)}));
  const best=r.best_pair?comparisons.find(c=>c.a===r.best_pair?.a&&c.b===r.best_pair?.b)||null:null;
  return {...r,title:'SPHEREx Scientific Observation and Preliminary Analysis Report',
    target:translateTurkish(r.target),
    method:methodEn,disclaimer:disclaimerEn,interpretation:englishInterpretation(r),
    comparisons,best_pair:best};
}
const num=(x:number|null|undefined,d=3)=>x===null||x===undefined||!Number.isFinite(x)?'not measured':x.toFixed(d);
export function researchMarkdownEnglish(original:ResearchReport){
  const r=localizeResearchReport(original,'en'),best=r.best_pair;
  const rows=r.frames.map(f=>'| '+f.ordinal+' | '+f.date+' | '+(f.status==='ready'?'Ready':'Pending')+
    ' | '+num(f.coverage===null?null:f.coverage*100,1)+'% | '+num(f.wave_um)+
    ' | '+num(f.median_flux,4)+' | '+num(f.psf_fwhm_arcsec)+
    ' | '+num(f.aperture?.aperture_sum_MJy_sr_pixel,4)+' |').join('\n');
  return [
    '# '+r.title,'',
    '**Target:** '+r.target,
    '**Processed scientific FITS frames:** '+r.ready_frames+'/'+r.total_frames,
    '**Observation interval:** '+(r.observation_first||'—')+' — '+(r.observation_last||'—'),'',
    '## 1. Data provenance and scientific scope',
    'Genuine NASA/IPAC IRSA SPHEREx DR1/QR3 Level 2 spectral-image cutouts; '+r.ready_frames+' frames include prepared scientific layers.','',
    '## 2. Data quality by frame',
    '| Frame | UTC observation | Status | Valid coverage | Wavelength (µm) | Median IMAGE−ZODI (MJy/sr) | Approximate EPSF FWHM (arcsec) | Central aperture (MJy/sr × pixel) |',
    '|---|---|---|---|---|---|---|---|',rows,'',
    '## 3. Preliminary comparison across epochs',
    best?'Best pair: frames '+best.a+' and '+best.b+'; spatially overlapping pixels: '+
      best.spatial_overlap+'; approximately matched spectral pixels: '+best.spectral_overlap+
      '; median difference: '+num(best.offset_median,6)+' MJy/sr; robust MAD: '+num(best.mad,6)+' MJy/sr.':
      'No valid comparison pair has been prepared.','',
    '## 3b. EPSF and preliminary photometry quality gates',
    best?.validation?'PSF status: '+best.validation.psf_status+
      '. Matched samples after PSF matching: '+best.validation.spectrally_matched_pixels+
      '. Conservative screening score: '+num(best.validation.peak_conservative_score)+
      '. Pixels over threshold 6: '+best.validation.screening_pixels_above_6+
      '. Coherent regions for human review: '+best.validation.coherent_regions_for_review+
      '. Screening status: '+best.validation.screening_status+
      '. These are not confirmed celestial changes.':
      'Independent PSF-based validation is not available for this pair.','',
    '## 4. Scientific interpretation',r.interpretation,'',
    '## 5. Methods and limitations',r.method,'',r.disclaimer,'',
    '## Sources','- NASA/IPAC IRSA SPHEREx DR1 Spectral Images, DOI: 10.26131/IRSA678.',
    '- https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_dr1.html',
    '- https://irsa.ipac.caltech.edu/spherex-archive-documentation/spherex-data-products/',''
  ].join('\n');
}