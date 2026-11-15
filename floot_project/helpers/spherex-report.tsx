import type {ScienceFrameData} from './science-fits';
import {apertureAtSkyCenter,pairDiagnostic,type AperturePhotometry,type PairDiagnostic} from './astro-photometry';
import {MIN_SCIENCE_BASELINE_DAYS,pairBaselineDays} from './science-default-pair';
export type ReportInputFrame={
  observed_utc:string;source_fits_cutout_url?:string;
  science?:ScienceFrameData;
};
export type QualityFrame={
  ordinal:number;date:string;status:'ready'|'pending';
  coverage:number|null;flagged:number|null;
  wave_um:number|null;bandwidth_um:number|null;
  median_flux:number|null;spread_flux:number|null;
  source:string|null;native_width:number|null;native_height:number|null;
  psf_fwhm_arcsec:number|null;aperture:AperturePhotometry|null;
};
export type ComparisonResult={
  a:number;b:number;date_a:string;date_b:string;
  baseline_days:number;long_epoch:boolean;
  spatial_overlap:number;spectral_overlap:number;
  overlap_fraction:number;offset_median:number|null;mad:number|null;
  z3_pixel_count:number;note:string;
  validation:PairDiagnostic|null;
};
export type ResearchReport={
  title:string;target:string;total_frames:number;ready_frames:number;
  frames:QualityFrame[];comparisons:ComparisonResult[];
  best_pair:ComparisonResult|null;data_coverage:number;
  observation_first:string|null;observation_last:string|null;
  method:string;interpretation:string;disclaimer:string;
};
const finite=(x:number|null|undefined):x is number=>typeof x==='number'&&Number.isFinite(x);
function median(values:number[]):number|null{
  if(!values.length)return null;
  const sorted=values.sort((a,b)=>a-b);
  const mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}
function percentile(values:number[],p:number):number|null{
  if(!values.length)return null;
  const sorted=values.sort((a,b)=>a-b);
  return sorted[Math.floor((sorted.length-1)*p)];
}
function compare(a:ScienceFrameData,b:ScienceFrameData,ai:number,bi:number,
  aDate:string,bDate:string):ComparisonResult{
  let spatial=0,matched=0,z3=0;
  const diffs:number[]=[];
  const candidates:{difference:number;noise:number}[]=[];
  if(a.grid_size!==b.grid_size||Math.abs(a.grid_field_deg-b.grid_field_deg)>.0001)
    return {a:ai,b:bi,date_a:aDate,date_b:bDate,
      baseline_days:pairBaselineDays(aDate,bDate),long_epoch:pairBaselineDays(aDate,bDate)>=MIN_SCIENCE_BASELINE_DAYS,
      spatial_overlap:0,spectral_overlap:0,overlap_fraction:0,
      offset_median:null,mad:null,z3_pixel_count:0,note:'Farklı koordinat gridleri; doğrudan karşılaştırma yapılamaz',
      validation:null};
  for(let k=0;k<a.flux.length;k++){
    const fa=a.flux[k],fb=b.flux[k],va=a.variance[k],vb=b.variance[k];
    if(!finite(fa)||!finite(fb)||!finite(va)||!finite(vb))continue;
    spatial++;
    const wa=a.wavelength_um?.[k],wb=b.wavelength_um?.[k];
    const ba=a.bandwidth_um?.[k],bb=b.bandwidth_um?.[k];
    if(!finite(wa)||!finite(wb)||!finite(ba)||!finite(bb))continue;
    if(Math.abs(wa-wb)>.5*(ba+bb))continue;
    matched++;
    const difference=fb-fa;
    diffs.push(difference);
    candidates.push({difference,noise:Math.sqrt(Math.max(va+vb,0))});
  }
  const offset=median(diffs);
  const mad=offset===null?null:median(diffs.map(d=>Math.abs(d-offset)));
  if(offset!==null)for(const item of candidates){
    // Pixel-level heuristic ONLY. Correlated resampling and PSF mismatch can
    // yield false positives. Never label these as detections.
    if(item.noise>0&&Math.abs(item.difference-offset)/item.noise>3)z3++;
  }
  return {a:ai,b:bi,date_a:aDate,date_b:bDate,
    baseline_days:pairBaselineDays(aDate,bDate),long_epoch:pairBaselineDays(aDate,bDate)>=MIN_SCIENCE_BASELINE_DAYS,
    spatial_overlap:spatial,
    spectral_overlap:matched,overlap_fraction:spatial?matched/spatial:0,
    offset_median:offset,mad,z3_pixel_count:z3,
    note:matched<300?'Yetersiz spektral eşleşme; bu çiftle bilimsel değişim yorumu önerilmez':
      'Yaklaşık dalga boyu örtüşmesi var; ölçüm koşulları ve tam kalibrasyon doğrulanmadan keşif iddiası kurulamaz',
    validation:pairDiagnostic(a,b)};
}
export function prepareResearchReport(target:string,frames:ReportInputFrame[]):ResearchReport{
  const details:QualityFrame[]=frames.map((frame,i)=>{
    const s=frame.science;
    if(!s)return {ordinal:i+1,date:frame.observed_utc,status:'pending',coverage:null,flagged:null,
      wave_um:null,bandwidth_um:null,median_flux:null,spread_flux:null,source:frame.source_fits_cutout_url||null,
      native_width:null,native_height:null,psf_fwhm_arcsec:null,aperture:null};
    const measurements=s.flux.filter(finite);
    const m=median(measurements);
    const p10=percentile(measurements,.1),p90=percentile(measurements,.9);
    return {ordinal:i+1,date:frame.observed_utc,status:'ready',
      coverage:s.valid_fraction,flagged:s.flagged_fraction,
      wave_um:s.center_wavelength_um,bandwidth_um:s.center_bandwidth_um,
      median_flux:m,spread_flux:p10===null||p90===null?null:p90-p10,
      source:frame.source_fits_cutout_url||null,
      native_width:s.native_width,native_height:s.native_height,
      psf_fwhm_arcsec:s.psf?.fwhm_arcsec_approx??null,
      aperture:apertureAtSkyCenter(s)};
  });
  const indexed=frames.map((frame,i)=>({frame,i})).filter(item=>item.frame.science);
  const comparisons:ComparisonResult[]=[];
  for(let i=0;i<indexed.length;i++)for(let j=i+1;j<indexed.length;j++){
    const a=indexed[i],b=indexed[j];
    comparisons.push(compare(a.frame.science!,b.frame.science!,a.i+1,b.i+1,
      a.frame.observed_utc,b.frame.observed_utc));
  }
  const best=[...comparisons].sort((a,b)=>
    Number(b.spectral_overlap>=300)-Number(a.spectral_overlap>=300)||
    Number(b.long_epoch&&b.spectral_overlap>=300)-
      Number(a.long_epoch&&a.spectral_overlap>=300)||
    b.spectral_overlap-a.spectral_overlap)[0]||null;
  const withAnalysis=details.filter(d=>d.status==='ready');
  const chronological=details.map(f=>f.date).filter(Boolean).sort();
  const dataCoverage=withAnalysis.length?
    withAnalysis.reduce((s,f)=>s+(f.coverage||0),0)/withAnalysis.length:0;
  let interpretation:string;
  if(withAnalysis.length<2){
    interpretation='En az iki FITS görüntüsünün bilimsel katmanları hazırlandıktan sonra görüntüler arası karşılaştırma hesaplanabilir.';
  }else if(!best||best.spectral_overlap<300){
    interpretation='Görüntüler hazır; ancak incelenen tarih çiftlerinde yeterli ortak dalga boyu örtüşmesi bulunmadı. Bu veriyle güvenilir zamansal değişim yorumu yapılamaz. Başka dedektör, tarih veya spektral kanal seçimi gerekir.';
  }else{
    interpretation=(best.long_epoch?'En az 14 gün ayrı ve spektral eşleşmesi yeterli gözlem çifti ':'Spektral eşleşmesi yeterli ancak 14 günden kısa dönemli gözlem çifti ')+best.a+' ve '+best.b+
      ' numaralı karelerdir (gözlemler arası '+best.baseline_days.toFixed(1)+' gün). '+best.spectral_overlap+' ortak spektral örnek üzerinde parlaklık farklarının dağılımı hesaplandı. '+
      'Bu farkların önemli bir bölümü ölçüm koşulları, bant yanıtı, PSF, arka plan ve istatistiksel belirsizliklerden kaynaklanabilir. '+
      (best.long_epoch?'':'Bu çift aylar ölçeğindeki değişimi göstermek için yeterli değildir. ')+
      'Henüz kalibre edilmiş bir değişken nesne veya hareket tespiti yapılmamıştır.';
  }
  const missingCentral=withAnalysis.filter(item=>
    item.aperture?.status==='insufficient-valid-pixels').length;
  if(missingCentral>0){
    interpretation+=' Ayrıca '+missingCentral+' bilimsel karede hedefin merkezindeki '+
      'pikseller veya çevre arka planı, güvenilir merkezi açıklık ölçümü için yeterli değildir; '+
      'bu kareler için kaynak akısı ölçülmüş gibi bir sonuç üretilmedi.';
  }
  return {
    title:'SPHEREx Bilimsel Gözlem ve Ön Analiz Raporu',target,total_frames:frames.length,
    ready_frames:withAnalysis.length,frames:details,comparisons,best_pair:best,data_coverage:dataCoverage,
    observation_first:chronological[0]||null,observation_last:chronological.at(-1)||null,
    method:'NASA/IPAC Level 2 FITS IMAGE−ZODI parlaklığı; FLAGS/VARIANCE; TAN-SIP WCS ile ortak 96×96 grid, en yakın komşu örnekleme; yaklaşık WCS-WAVE bant örtüşmesi. En az 300 spektral eşleşen piksel varsa 14 gün veya daha fazla ayrı gözlem dönemleri önceliklendirilir. Orijinal EPSF tablosundan varsa yerel PSF ikinci moment genişliği okunur ve iki kare için yaklaşık izotropik Gauss genişlik eşleştirmesi yapılır. Merkezi açıklık/arka plan halkası ölçümü, medyan fark, robust MAD ve en az dört bağlantılı yüksek skorlu pikselden oluşan inceleme bölgeleri raporlanır. Bunlar hassas L3 fotometri veya doğrulanmış keşif değildir.',
    interpretation,
    disclaimer:'Bu rapor sayısal verilere dayanan keşif amaçlı bir ön analizdir. EPSF ölçümü yereldir ve yaklaşık izotropik Gauss eşleştirmesi tam pozisyona bağlı EPSF konvolüsyonu değildir. Merkezi açıklık toplamı MJy/sr × grid piksel biriminde ön ölçümdür; resmî noktasal kaynak fotometrisi veya mutlak µJy fotometrisi değildir. WCS-WAVE yalnızca görselleştirme amaçlı yaklaşık bant bilgisidir; CWAVE/CBAND, tam PSF ve piksel solid angle kalibrasyonu eksiktir. Yeniden örneklemenin korele gürültüsü, arka plan değişkenliği ve sistematikler nedeniyle Yüksek tarama skoru veya komşu piksel bölgesi, çoklu sınama ve sistematik belirsizlikler nedeniyle kalibre edilmiş p-değeri, doğrulanmış istatistiksel keşif veya gerçek hareket kanıtı değildir.'
  };
}
export function reportToMarkdown(r:ResearchReport){
  const f=(value:number|null,dec=3)=>finite(value)?value.toFixed(dec):'ölçülmedi';
  const rows=r.frames.map(row=>`| ${row.ordinal} | ${row.date} | ${row.status==='ready'?'Hazır':'Bekliyor'} | ${f(row.coverage===null?null:row.coverage*100,1)}% | ${f(row.wave_um)} | ${f(row.median_flux,4)} | ${f(row.psf_fwhm_arcsec)} | ${f(row.aperture?.aperture_sum_MJy_sr_pixel??null,4)} |`).join('\n');
  return `# ${r.title}

**Hedef:** ${r.target}
**Bilimsel FITS analiz durumu:** ${r.ready_frames}/${r.total_frames} kare
**Gözlem aralığı:** ${r.observation_first||'—'} — ${r.observation_last||'—'}

## 1. Veri kaynağı ve bilimsel kapsam
NASA/IPAC IRSA SPHEREx DR1/QR3 Level 2 Spektral Görüntüler. Bu veri kümesi gökyüzü konumuna ait kesitlerdir. ${r.ready_frames} bilimsel karede analiz katmanları hazırlandı.

## 2. Veri kalitesi ve kare bazında değerlendirme
| Kare | Gözlem UTC | İşlem | Geçerli kapsam | Dalga boyu (µm) | Medyan IMAGE−ZODI (MJy/sr) | EPSF yaklaşık FWHM (yay saniyesi) | Merkezi açıklık (MJy/sr×piksel) |
|---|---|---|---|---|---|---|---|
${rows}

## 3. Görüntüler arası ön karşılaştırma
${r.best_pair?`Öncelikli gözlem çifti: ${r.best_pair.a} ve ${r.best_pair.b} numaralı kareler; aralık: ${f(r.best_pair.baseline_days,1)} gün (${r.best_pair.long_epoch?'14+ gün':'kısa dönem'}); ortak pikseller: ${r.best_pair.spatial_overlap}; yaklaşık bant eşleşmesi: ${r.best_pair.spectral_overlap}; medyan fark: ${f(r.best_pair.offset_median,6)} MJy/sr; robust MAD: ${f(r.best_pair.mad,6)} MJy/sr.`:'Yeterli sayıda analiz edilebilir karşılaştırma yok.'}

## 3b. EPSF / ön fotometri kalite kapıları
${r.best_pair?.validation?`PSF veri durumu: ${r.best_pair.validation.psf_status}. PSF sonrası ortak spektral örnek: ${r.best_pair.validation.spectrally_matched_pixels}. En yüksek konservatif tarama skoru: ${f(r.best_pair.validation.peak_conservative_score)}. 6 eşik üstü tarama pikseli: ${r.best_pair.validation.screening_pixels_above_6}. Komşu yüksek skorlu inceleme bölgesi: ${r.best_pair.validation.coherent_regions_for_review}. Durum: ${r.best_pair.validation.screening_status}.`:'Tam EPSF ve bağımsız doğrulama bilgisi bu gözlem çiftinde hazır değil.'}

## 4. Bilimsel yorum
${r.interpretation}

## 5. Yöntem ve sınırlılıklar
${r.method}

${r.disclaimer}

## Kaynaklar
- NASA/IPAC IRSA SPHEREx DR1 Spectral Images, DOI: 10.26131/IRSA678.
- https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_dr1.html
- https://irsa.ipac.caltech.edu/spherex-archive-documentation/spherex-data-products/

`;
}