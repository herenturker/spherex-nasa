import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Activity,ScanSearch,Layers3,Info,AlertTriangle,Maximize2,Beaker,CheckCircle2,Download} from 'lucide-react';
import type {ScienceFrameData} from '../helpers/science-fits';
import {matchPSFWidths} from '../helpers/astro-photometry';
import {chooseDefaultComparison,MIN_SCIENCE_BASELINE_DAYS,pairBaselineDays} from '../helpers/science-default-pair';
import {useLanguage} from '../helpers/i18n';
import {translateTurkish} from '../helpers/locale-phrases';
import {startFileExport} from '../helpers/startFileExport';
import type {PreparedExport} from '../helpers/startFileExport';
import SafeExportActions from './SafeExportActions';
import {exportTargetName} from '../helpers/export-filename';
import styles from './ScienceLab.module.css';

export type LabFrame={observed_utc:string;science?:ScienceFrameData;source_fits_cutout_url?:string};
type Props={frames:LabFrame[];target:string;loading:boolean;onProcess:()=>void;processing:boolean;cutoutSize:'0.1'|'0.2';onCutoutChange:(next:'0.1'|'0.2')=>void};
const time=(iso:string,language:'en'|'tr')=>{try{return new Date(iso).toLocaleString(language==='en'?'en-US':'tr-TR',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' UTC'}catch{return iso}};
const valid=(v:number|null):v is number=>v!==null&&Number.isFinite(v);
function quantile(values:number[],fraction:number){
  if(!values.length)return 0;
  values.sort((a,b)=>a-b);
  return values[Math.floor((values.length-1)*fraction)];
}
const mix=(a:number,b:number,t:number)=>Math.round(a*(1-t)+b*t);
function falseColor(t:number):[number,number,number]{
  const stops:[[number,number,number],[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[
    [12,22,48],[64,58,126],[127,91,181],[223,153,155],[255,239,193]];
  const s=Math.max(0,Math.min(1,t))*(stops.length-1),k=Math.min(stops.length-2,Math.floor(s)),f=s-k;
  return [mix(stops[k][0],stops[k+1][0],f),mix(stops[k][1],stops[k+1][1],f),mix(stops[k][2],stops[k+1][2],f)];
}
export default function ScienceLab({frames,target,loading,onProcess,processing,cutoutSize,onCutoutChange}:Props){
  const {language}=useLanguage();
  const scientific=useMemo(()=>frames.map((frame,index)=>({frame,index})).filter(item=>item.frame.science),[frames]);
  const epsfCount=scientific.filter(item=>item.frame.science?.psf?.status==='measured-from-EPSF').length;
  // Derive the best scientifically comparable pair synchronously on the
  // first render of every new dataset, rather than correcting stale indexes
  // in a later effect. Users may still override either visit or view mode.
  const [manualChoice,setManualChoice]=useState<{
    frames:LabFrame[];a:number;b:number;mode:'difference'|'blend'
  }|null>(null);
  const [blend,setBlend]=useState(50);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [preparedPNG,setPreparedPNG]=useState<PreparedExport|null>(null);
  const [pngError,setPngError]=useState('');
  const preparedPNGUrl=useRef<string|null>(null);
  const [preparedTextFile,setPreparedTextFile]=useState<PreparedExport|null>(null);
  const preparedTextUrl=useRef<string|null>(null);
  const [textExportWarning,setTextExportWarning]=useState('');
  const fileTarget=exportTargetName(target);
  const bestComparison=useMemo(()=>chooseDefaultComparison(scientific.map(item=>item.frame)),[scientific]);
  const custom=manualChoice?.frames===frames
    && manualChoice.a<scientific.length&&manualChoice.b<scientific.length;
  const a=custom?manualChoice.a:bestComparison.first;
  const b=custom?manualChoice.b:bestComparison.second;
  const mode=custom?manualChoice.mode:(bestComparison.scientificallyComparable?'difference':'blend');
  function setChoice(next:Partial<{a:number;b:number;mode:'difference'|'blend'}>){
    setManualChoice({frames,a,b,mode,...next});
  }
  const selectedBaselineDays=scientific[a]&&scientific[b]
    ?pairBaselineDays(scientific[a].frame.observed_utc,scientific[b].frame.observed_utc):0;
  const preferredBaselineDays=scientific[bestComparison.first]&&scientific[bestComparison.second]
    ?pairBaselineDays(scientific[bestComparison.first].frame.observed_utc,scientific[bestComparison.second].frame.observed_utc):0;
  const first=scientific[a]?.frame.science;
  const second=scientific[b]?.frame.science;
  const matched=useMemo(()=>first&&second?matchPSFWidths(first,second):null,[first,second]);
  const stats=useMemo(()=>{
    if(!first||!second||first.grid_size!==second.grid_size)return null;
    const common:number[]=[];
    const spatialValues:number[]=[];
    const residual:number[]=[];
    let spatialOverlap=0;
    let spectralMatched=0;
    for(let i=0;i<first.flux.length;i++){
      const f=matched?.a.flux[i]??null,g=matched?.b.flux[i]??null;
      const v1=matched?.a.variance[i]??null,v2=matched?.b.variance[i]??null;
      if(valid(f)&&valid(g)&&valid(v1)&&valid(v2)){
        spatialOverlap++;
        spatialValues.push(f,g);
        const w1=first.wavelength_um?.[i],w2=second.wavelength_um?.[i];
        const bw1=first.bandwidth_um?.[i],bw2=second.bandwidth_um?.[i];
        // Approximate FWHM passband overlap; not a substitute for calibrated
        // spectral-channel matching or a PSF-corrected detection.
        if(valid(w1)&&valid(w2)&&valid(bw1)&&valid(bw2)&&
           Math.abs(w1-w2)<=0.5*(bw1+bw2)){
          spectralMatched++;
          common.push(f,g);
          residual.push(g-f);
        }
      }
    }
    const baseline=quantile([...residual],.5);
    const absCentered=residual.map(v=>Math.abs(v-baseline));
    const scaleValues=common.length?common:spatialValues;
    return {overlap:residual.length,spatialOverlap,spectralMatched,total:first.grid_size**2,baseline,
      p90:quantile(absCentered,.90),commonLo:quantile([...scaleValues],.02),commonHi:quantile([...scaleValues],.99),
      viewScale:Math.max(.00001,quantile(absCentered,.95))};
  },[first,second,matched]);
  // Keep the generated Blob URL alive until the visitor has actually saved or
  // opened it. In particular, iPad Safari's "View / Download" sheet may act
  // after the originating click handler has finished.
  useEffect(()=>()=>{if(preparedPNGUrl.current)URL.revokeObjectURL(preparedPNGUrl.current)},[]);
  useEffect(()=>()=>{if(preparedTextUrl.current)URL.revokeObjectURL(preparedTextUrl.current)},[]);
  useEffect(()=>{
    // Never offer an earlier target's download under a newly selected star.
    if(preparedTextUrl.current){URL.revokeObjectURL(preparedTextUrl.current);preparedTextUrl.current=null;}
    setPreparedTextFile(null);
    setTextExportWarning('');
  },[target]);
  useEffect(()=>{
    if(preparedPNGUrl.current){
      URL.revokeObjectURL(preparedPNGUrl.current);
      preparedPNGUrl.current=null;
      setPreparedPNG(null);
    }
    setPngError('');
  },[frames,a,b,mode,blend]);
  function downloadFile(name:string,contents:string,mime:string){
    try{
      const prepared=startFileExport(name,contents,mime);
      if(preparedTextUrl.current)URL.revokeObjectURL(preparedTextUrl.current);
      preparedTextUrl.current=prepared.url;
      setPreparedTextFile(prepared);
      setTextExportWarning('');
    }catch{
      setTextExportWarning(language==='en'?'File preparation failed. Please retry.':'Dosya hazırlanamadı. Lütfen tekrar deneyin.');
    }
  }
  function downloadVisibleMapPNG(){
    const source=canvasRef.current;
    if(!source||!source.width||!source.height){
      setPngError(language==='en'?'The image is not ready yet.':'Görsel henüz hazır değil.');
      return;
    }
    // Preserve the exact active map/blend and selected A/B observations.
    // Upscaling is for readable presentation only, not added FITS resolution.
    const exportCanvas=document.createElement('canvas');
    exportCanvas.width=576;
    exportCanvas.height=576;
    const context=exportCanvas.getContext('2d');
    if(!context){
      setPngError(language==='en'?'The image could not be prepared.':'Görsel hazırlanamadı.');
      return;
    }
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    context.drawImage(source,0,0,exportCanvas.width,exportCanvas.height);
    const safeTarget=target.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,50)||'SPHEREx';
    const stamp=(iso:string)=>iso.replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z').replace(/[^0-9TZ]/g,'');
    const name='SPHEREx_'+safeTarget+'_'+(mode==='difference'?'Difference':'Blend')+
      '_'+stamp(scientific[a].frame.observed_utc)+'_'+stamp(scientific[b].frame.observed_utc)+'.png';
    try{
      // Create a real PNG File but do not open it in the current Safari tab.
      // Users can preview in-page or explicitly save through SafeExportActions.
      const dataURL=exportCanvas.toDataURL('image/png');
      if(!dataURL.startsWith('data:image/png;base64,'))throw new Error('PNG export failed');
      const decoded=window.atob(dataURL.substring(dataURL.indexOf(',')+1));
      const bytes=new Uint8Array(decoded.length);
      for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
      const file=new File([bytes],name,{type:'image/png'});
      const url=URL.createObjectURL(file);
      if(preparedPNGUrl.current)URL.revokeObjectURL(preparedPNGUrl.current);
      preparedPNGUrl.current=url;
      setPreparedPNG({url,name,file});
      setPngError('');
    }catch{
      setPngError(language==='en'
        ?'PNG export failed. Please try again or use another browser.'
        :'PNG oluşturulamadı. Tekrar deneyin veya farklı bir tarayıcı kullanın.');
    }
  }
  function exportScienceCSV(){
    if(!first||!second||!stats)return;
    const size=first.grid_size,columns=[
      'grid_x','grid_y','ra_deg_approx','dec_deg_approx','flux_a_MJy_sr_minus_ZODI',
      'flux_b_MJy_sr_minus_ZODI','variance_a','variance_b','wave_a_um','wave_b_um',
      'band_a_um','band_b_um','wavelength_overlap','difference_b_minus_a'
    ];
    const centerRa=Number(new URL(scientific[a].frame.source_fits_cutout_url||'https://irsa.ipac.caltech.edu').searchParams.get('center')?.split(',')[0]||'NaN');
    const centerDec=Number(new URL(scientific[a].frame.source_fits_cutout_url||'https://irsa.ipac.caltech.edu').searchParams.get('center')?.split(',')[1]?.replace('d','')||'NaN');
    const rows:string[]=[columns.join(',')];
    for(let i=0;i<size*size;i++){
      const x=i%size,y=Math.floor(i/size);
      const f=first.flux[i],g=second.flux[i];
      const va=first.variance[i],vb=second.variance[i];
      const wa=first.wavelength_um[i],wb=second.wavelength_um[i];
      const ba=first.bandwidth_um[i],bb=second.bandwidth_um[i];
      const overlap=valid(f)&&valid(g)&&valid(va)&&valid(vb)&&
        valid(wa)&&valid(wb)&&valid(ba)&&valid(bb)&&
        Math.abs(wa-wb)<=0.5*(ba+bb);
      const lon=Number.isFinite(centerRa)&&Number.isFinite(centerDec)
        ?centerRa-(x-(size-1)/2)*first.grid_field_deg/size/Math.cos(centerDec*Math.PI/180):null;
      const lat=Number.isFinite(centerDec)
        ?centerDec+((size-1)/2-y)*first.grid_field_deg/size:null;
      const fmt=(v:number|null)=>v===null||!Number.isFinite(v)?'':String(v);
      rows.push([x,y,fmt(lon),fmt(lat),fmt(f),fmt(g),fmt(va),fmt(vb),
        fmt(wa),fmt(wb),fmt(ba),fmt(bb),Number(overlap),
        overlap?String(g-f):''].join(','));
    }
    downloadFile('SPHEREx_'+fileTarget+'_aligned_science_comparison.csv',rows.join('\n'),'text/csv;charset=utf-8');
  }
  function exportScienceMeta(){
    if(!first||!second||!stats)return;
    const exportData={
      project:'SPHEREx Sky Explorer',created_utc:new Date().toISOString(),target:language==='en'?translateTurkish(target):target,
      method:'TAN-SIP nearest neighbour, approximately overlapping WCS-WAVE FWHM, IMAGE minus ZODI',
      confidence:'Exploratory only: NOT a confirmed motion/variability/planet detection',
      band_limit:'WCS-WAVE is approximate; CWAVE/CBAND, PSF and calibrated significance required',
      reference:[
        {utc:scientific[a].frame.observed_utc,url:scientific[a].frame.source_fits_cutout_url,lambda_um:first.center_wavelength_um,bandwidth_um:first.center_bandwidth_um},
        {utc:scientific[b].frame.observed_utc,url:scientific[b].frame.source_fits_cutout_url,lambda_um:second.center_wavelength_um,bandwidth_um:second.center_bandwidth_um}
      ],
      stats:{spatial_overlap:stats.spatialOverlap,spectral_overlap:stats.spectralMatched,total_grid_pixels:stats.total,
        difference_median_center:stats.overlap>=300&&a!==b?stats.baseline:null,
        p90_absolute_residual:stats.overlap>=300&&a!==b?stats.p90:null,
        science_grid_size:first.grid_size,field_deg:first.grid_field_deg},
      attribution:'NASA/IPAC IRSA SPHEREx DR1/QR3 public spectral image archive'
    };
    downloadFile('SPHEREx_'+fileTarget+'_science_provenance.json',JSON.stringify(exportData,null,2),'application/json;charset=utf-8');
  }
  useLayoutEffect(()=>{
    const canvas=canvasRef.current;
    if(!first||!second||!stats||!canvas)return;
    const size=first.grid_size;
    canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext('2d');
    if(!ctx)return;
    const data=ctx.createImageData(size,size);
    for(let i=0;i<size*size;i++){
      const f=matched?.a.flux[i]??null,g=matched?.b.flux[i]??null,off=i*4;
      const w1=first.wavelength_um?.[i],w2=second.wavelength_um?.[i];
      const bw1=first.bandwidth_um?.[i],bw2=second.bandwidth_um?.[i];
      const compatible=valid(w1)&&valid(w2)&&valid(bw1)&&valid(bw2)&&
        Math.abs(w1-w2)<=0.5*(bw1+bw2);
      if(!valid(f)||!valid(g)||(mode==='difference'&&!compatible)){
        data.data[off]=14;data.data[off+1]=22;data.data[off+2]=41;data.data[off+3]=255;
        continue;
      }
      let rgb:[number,number,number];
      if(mode==='blend'){
        const denom=Math.max(.00001,stats.commonHi-stats.commonLo);
        const left=Math.asinh(5*Math.max(0,Math.min(1,(f-stats.commonLo)/denom)))/Math.asinh(5);
        const right=Math.asinh(5*Math.max(0,Math.min(1,(g-stats.commonLo)/denom)))/Math.asinh(5);
        rgb=falseColor(mix(left*1000,right*1000,blend/100)/1000);
      }else{
        const intensity=Math.max(-1,Math.min(1,((g-f)-stats.baseline)/stats.viewScale));
        // Negative: blue, near zero: dark-neutral, positive: coral.
        if(intensity<0){
          const t=-intensity;
          rgb=[Math.round(28-13*t),Math.round(38+137*t),Math.round(68+187*t)];
        }else{
          const t=intensity;
          rgb=[Math.round(28+225*t),Math.round(38+110*t),Math.round(68+61*t)];
        }
      }
      data.data[off]=rgb[0];data.data[off+1]=rgb[1];data.data[off+2]=rgb[2];data.data[off+3]=255;
    }
    ctx.putImageData(data,0,0);
  },[a,b,first,second,matched,stats,mode,blend]);
  const allReady=scientific.length>=2;
  return <section className={styles.lab} id="science-lab" aria-label={language==='en'?'SPHEREx scientific exploration laboratory':'SPHEREx bilimsel keşif laboratuvarı'}>
    <div className={styles.head}>
      <div className={styles.headTitle}>
        <span className={styles.badge}><Beaker size={21}/></span>
        <div><span className={styles.eyebrow}>SPHEREx · BİLİMSEL ARAŞTIRMA</span>
          <h2>{language==='en'?'Sky Change Laboratory':'Gökyüzü Değişim Laboratuvarı'}</h2>
          <p>Gerçek FITS parlaklık değerleri, WCS hizalaması ve kalite kontrolü</p>
        </div>
      </div>
      <span className={styles.status}>{scientific.length}/{frames.length} bilimsel kare · EPSF {epsfCount}/{scientific.length}</span>
    </div>
    <p className={styles.targetProvenance} data-no-translate>
      {language==='en'?'Analysed sky region: ':'Analiz edilen gökyüzü bölgesi: '}
      <strong>{target}</strong>
    </p>
    {target.toLowerCase().includes('wise 0855')&&<p className={styles.targetCaution} role="note" data-no-translate>
      <AlertTriangle size={17}/>
      {language==='en'
        ?'WISE 0855−0714 is an extremely faint Y-type brown dwarf. These are genuine NASA SPHEREx images of its selected sky field, NOT a verified detection or positional measurement of the dwarf itself. Bright points may be unrelated background sources. Matching wavelengths and comparing dates alone cannot establish its motion.'
        :'WISE 0855−0714 son derece sönük Y tipi bir kahverengi cücedir. Bunlar seçilen gökyüzü alanının gerçek NASA SPHEREx görüntüleridir; cismin doğrulanmış tespiti veya konum ölçümü DEĞİLDİR. Parlak noktalar ilgisiz arka plan kaynakları olabilir. Dalga boyu ve tarih eşleşmesi tek başına hareketini kanıtlamaz.'}
    </p>}
    {target.toLowerCase().includes('rw aur')&&<p className={styles.targetCaution} role="note" data-no-translate>
      <AlertTriangle size={17}/>
      {language==='en'
        ?'RW Aurigae is a variable T Tauri binary system. The SPHEREx field covers the system; the images and preliminary brightness differences must not be described as a resolved or independently confirmed variability measurement of a specific component (A or B).'
        :'RW Aurigae değişken bir T Tauri çift yıldız sistemidir. SPHEREx alanı sistemi kapsar; bu görüntüler ve ön parlaklık farkları, A veya B bileşenlerinden birine ait ayrıştırılmış ve bağımsızca doğrulanmış değişkenlik ölçümü olarak sunulmamalıdır.'}
    </p>}
    <div className={styles.insights}>
      <div className={styles.insight}><Maximize2 size={18}/><span>Önizleme</span><strong>576×576</strong><small>Interpolasyon; doğal teleskop çözünürlüğü değildir</small></div>
      <div className={styles.insight}><ScanSearch size={18}/><span>Koordinat</span><strong>WCS TAN-SIP</strong><small>Kuzey yukarı · doğu sol</small></div>
      <div className={styles.insight}><Layers3 size={18}/><span>FITS katmanları</span><strong>4 veri katmanı</strong><small>IMAGE, FLAGS, VARIANCE, ZODI</small></div>
    </div>
        <div className={styles.sectionControls}>
      <label>FITS görüntü kesiti
        <select value={cutoutSize} disabled={loading||processing} onChange={e=>onCutoutChange(e.target.value as '0.1'|'0.2')}>
          <option value="0.1">0,1° · hızlı</option>
          <option value="0.2">0,2° · geniş alan</option>
        </select>
      </label>
      <button className={styles.processButton} type="button" disabled={processing||loading||frames.length===0} onClick={onProcess}>
        <ScanSearch size={16}/>{processing?'FITS / EPSF yeniden okunuyor…':epsfCount===scientific.length&&scientific.length===frames.length?'Bilimsel FITS / EPSF ölçümlerini yenile':'Eksik bilimsel FITS / EPSF katmanlarını hazırla'}
      </button>
    </div>
    {!allReady ? <div className={styles.empty}>
      <Info size={24}/><div>
        <strong>Karşılaştırma için en az iki bilimsel kare gerekli.</strong>
        <p>Yeni NASA aramalarında gelişmiş FITS motoru çalışır. Kayıtlı PNG paketleri için yukarıdaki “bilimsel olarak hazırla” düğmesiyle orijinal NASA FITS dosyalarını yeniden okuyabiliriz.</p>
      </div>
    </div> :
      <div className={styles.analysis}>
        <div className={styles.selection}>
          <label>Gözlem A
            <select value={a} onChange={e=>setChoice({a:Number(e.target.value)})}>
              {scientific.map((item,i)=><option key={i} value={i}>{i+1}. {time(item.frame.observed_utc,language)}</option>)}
            </select>
          </label>
          <label>Gözlem B
            <select value={b} onChange={e=>setChoice({b:Number(e.target.value)})}>
              {scientific.map((item,i)=><option key={i} value={i}>{i+1}. {time(item.frame.observed_utc,language)}</option>)}
            </select>
          </label>
        </div>
        <p className={styles.sameFrame}>{bestComparison.scientificallyComparable?
          (preferredBaselineDays>=MIN_SCIENCE_BASELINE_DAYS
            ?(language==='en'
              ?'Two observations at least 14 days apart with sufficient wavelength overlap were selected automatically. The difference map is not a verified discovery.'
              :'Başlangıçta en az 14 gün aralıklı, yeterli spektral eşleşmeli iki gözlem seçildi. Fark haritası doğrulanmış keşif değildir.')
            :(language==='en'
              ?'Sufficient wavelength overlap was found only for closely spaced observations. No long-term motion should be inferred.'
              :'Yeterli spektral eşleşme yalnızca kısa aralıklı gözlemlerde bulundu. Uzun dönemli hareket sonucu çıkarılmamalıdır.')):
          (language==='en'
            ?'PREVIEW / CONTROL: This target has no pair of observations from different dates with sufficient wavelength overlap. The same NASA frame may be shown in A and B as a visual reference only, not as evidence of motion or change. You may manually select other dates.'
            :'ÖNİZLEME / KONTROL: Bu hedefte yeterli dalga boyu uyumuna sahip iki farklı tarih yok. Başlangıçta aynı NASA karesi A ve B olarak görsel kontrol için gösterilir; değişim veya hareket ölçümü değildir. Diğer tarihleri elle seçebilirsiniz.')}</p>
        <div className={styles.modeButtons}>
          {bestComparison.scientificallyComparable&&
            <button type="button" className={styles.processButton}
              onClick={()=>setChoice({a:bestComparison.first,b:bestComparison.second,mode:'difference'})}>
              <ScanSearch size={15}/> {a===bestComparison.first&&b===bestComparison.second&&mode==='difference'
                ? (language==='en'?'✓ Automatically selected':'✓ Otomatik seçili')
                : (language==='en'?'Select best matching pair':'En uygun çifti seç')}
                {' · '}{preferredBaselineDays.toFixed(0)} {language==='en'?'days':'gün'}
                {' · '}{bestComparison.matched.toLocaleString(language==='en'?'en-US':'tr-TR')} {language==='en'?'pixels':'piksel'}
            </button>}
          <button type="button" className={mode==='difference'?styles.modeActive:styles.modeButton} onClick={()=>setChoice({mode:'difference'})}><Activity size={16}/> Göreli fark haritası</button>
          <button type="button" className={mode==='blend'?styles.modeActive:styles.modeButton} onClick={()=>setChoice({mode:'blend'})}><Layers3 size={16}/> Önce / sonra karışımı</button>
          <button type="button" className={styles.exportButton} onClick={exportScienceCSV}><Download size={15}/> Bilimsel CSV</button>
          <button type="button" className={styles.exportButton} onClick={exportScienceMeta}><Download size={15}/> Kaynak/Metot JSON</button>
        </div>
        {preparedTextFile&&<SafeExportActions prepared={preparedTextFile} language={language}/>}
        {textExportWarning&&<p className={styles.pngError} role="alert">{textExportWarning}</p>}
        {mode==='blend'&&<label className={styles.blendLabel}>Gözlem A <input type="range" min={0} max={100} value={blend} onChange={e=>setBlend(Number(e.target.value))}/> Gözlem B <strong>%{blend}</strong></label>}
        {a===b&&<p className={styles.sameFrame}>{language==='en'
          ?'A and B show the same frame (reference preview); this is not a comparison over time. Choose different dates with matching wavelengths to investigate scientific change.'
          :'A ve B aynı görüntü (referans önizleme): bu gerçek bir zaman karşılaştırması değildir. Bilimsel değişim için farklı ve dalga boyu uyumlu bir tarih seçin.'}</p>}
        {a!==b&&selectedBaselineDays<MIN_SCIENCE_BASELINE_DAYS&&
          <p className={styles.sameFrame}><AlertTriangle size={15}/> {language==='en'
            ?<>The selected observations are only {selectedBaselineDays.toFixed(2)} days apart. This pair is insufficient to establish long-term astronomical motion.</>
            :<>Seçilen gözlemler yalnızca {selectedBaselineDays.toFixed(2)} gün aralıklı. Bu çift, uzun dönemli astronomik hareketi kanıtlamak için yeterli değildir.</>}</p>}
        {mode==='difference'&&stats&&stats.overlap<300&&<p className={styles.sameFrame}>Bu iki gözlemin eşleşen dalga boyu pikselleri çok az ({stats.overlap}). Bu harita hareket kanıtı değildir; başka iki tarih seçin veya karışım görünümünü kullanın.</p>}
        <div className={styles.resultGrid}>
          <div className={styles.mapPanel}>
            <div className={styles.mapHeader}>ORTAK GÖKYÜZÜ KOORDİNATLARINDA {a===b?'REFERANS ÖNİZLEMESİ':mode==='difference'?'GÖRELi FARK':'KARIŞIM'} <span>N ↑ · E ←</span></div>
            {mode==='difference'&&(a===b||!stats||stats.overlap<300)
              ? <div className={styles.empty} role="status"><AlertTriangle size={24}/><div><strong>Bu iki gözlemden güvenilir fark haritası üretilemiyor.</strong><p>Yaklaşık ortak dalga boyu pikselleri: {stats?.overlap??0}. {bestComparison.matched>=300?'“En uygun tarih çifti” düğmesiyle karşılaştırılabilir gözlemleri açabilirsiniz.':'Bu hedefte uygun dalga boyunda yeni gözlemler gereklidir.'}</p></div></div>
              : <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={mode==='difference'?'İki gerçek SPHEREx karesi arasındaki göreli farkların görsel haritası':'İki WCS hizalanmış SPHEREx karesinin harmanlanmış önizlemesi'} />}
            {!(mode==='difference'&&(a===b||!stats||stats.overlap<300))&&
              <div className={styles.imageDownload}>
                <button type="button" className={styles.exportButton} onClick={downloadVisibleMapPNG}
                  aria-label={language==='en'?'Download displayed sky image as PNG':'Görüntülenen gökyüzü görselini PNG olarak indir'}>
                  <Download size={16}/>{language==='en'?'Download image (PNG)':'Görseli PNG indir'}
                </button>
                <span>{language==='en'?'576×576 visual export · not original FITS data':'576×576 görsel dışa aktarım · orijinal FITS değildir'}</span>
                {preparedPNG&&<SafeExportActions prepared={preparedPNG} language={language} isImage/>}
                {pngError&&<p className={styles.pngError} role="alert">{pngError}</p>}
              </div>}
            {mode==='difference'&&<div className={styles.legend}><span><i className={styles.negative}/> B daha düşük</span><span><i className={styles.neutral}/> Yakın</span><span><i className={styles.positive}/> B daha yüksek</span></div>}
            <p className={styles.mapDisclaimer} role="note">
              <Info size={15}/>
              {language==='en'
                ? mode==='difference'
                  ?'Exploratory infrared brightness difference (B − A), not a measured stellar position or confirmed proper motion. Instrumental effects, wavelength and PSF differences may contribute.'
                  :'Exploratory blend of two infrared observations. This view does not establish stellar movement or a new discovery.'
                : mode==='difference'
                  ?'Keşif amaçlı kızılötesi parlaklık farkı (B − A); yıldız konumu ölçümü veya doğrulanmış öz hareket değildir. Aletsel etkiler, dalga boyu ve PSF farklılıkları katkıda bulunabilir.'
                  :'İki kızılötesi gözlemin keşif amaçlı karışımı. Bu görünüm yıldız hareketi veya yeni bir keşif kanıtı değildir.'}
            </p>
          </div>
          <div className={styles.metrics}>
            <span className={styles.eyebrow}>ANALİZ METRİKLERİ</span>
            <div><span>WCS mekânsal örtüşme</span><strong>{stats?.spatialOverlap.toLocaleString(language==='en'?'en-US':'tr-TR')??'—'} / {stats?.total.toLocaleString(language==='en'?'en-US':'tr-TR')??'—'}</strong></div>
            <div><span>Yaklaşık spektral eşleşme</span><strong>{stats?.spectralMatched.toLocaleString(language==='en'?'en-US':'tr-TR')??'—'} {language==='en'?'pixels':'piksel'}</strong></div>
            <div><span>{language==='en'?'Observation A–B time baseline':'Gözlem A–B zaman aralığı'}</span><strong>{selectedBaselineDays.toFixed(1)} {language==='en'?'days':'gün'} · {selectedBaselineDays>=MIN_SCIENCE_BASELINE_DAYS
              ?(language==='en'?'long baseline':'uzun dönem')
              :(language==='en'?'short baseline':'kısa dönem')}</strong></div>
            <div><span>A merkez dalga boyu (yaklaşık)</span><strong>{first?.center_wavelength_um?.toFixed(3)??'—'} µm</strong></div>
            <div><span>B merkez dalga boyu (yaklaşık)</span><strong>{second?.center_wavelength_um?.toFixed(3)??'—'} µm</strong></div>
            <div><span>A kullanılabilir grid</span><strong>%{Math.round((first?.valid_fraction??0)*100)}</strong></div>
            <div><span>B kullanılabilir grid</span><strong>%{Math.round((second?.valid_fraction??0)*100)}</strong></div>
            <div><span>{language==='en'?'A source dimensions':'A kaynak boyutu'}</span><strong>{first?.native_width} × {first?.native_height}</strong></div>
            <div><span>{language==='en'?'B source dimensions':'B kaynak boyutu'}</span><strong>{second?.native_width} × {second?.native_height}</strong></div>
            <div><span>PSF genişlik uyumu</span><strong>{matched?.status==='approximate-local-EPSF-homogenized'
              ? 'EPSF ölçüldü; yaklaşık Gauss uygulandı'
              : 'EPSF iki karede hazır değil'}</strong></div>
            <div data-no-translate><span>{mode==='blend'?(language==='en'?'Visualization':'Görselleştirme'):(language==='en'?'Difference visualization':'Fark görselleştirme')}</span><strong>{mode==='blend'?(language==='en'?'Weighted infrared blend':'Ağırlıklı kızılötesi karışım'):(language==='en'?'Median-centered':'Medyan merkezli')}</strong></div>
            <div><span>Medyan B−A arka plan farkı</span><strong>{!stats||stats.overlap<300?'Ölçülemedi':a===b?'Aynı kare (kontrol)':stats.baseline.toFixed(4)+' MJy/sr'}</strong></div>
            <div><span>%90 mutlak medyan dışı fark</span><strong>{!stats||stats.overlap<300?'Ölçülemedi':a===b?'Aynı kare (kontrol)':stats.p90.toFixed(4)+' MJy/sr'}</strong></div>
            <div className={styles.quality}><CheckCircle2 size={17}/> FITS FLAGS / VARIANCE kullanıldı</div>
          </div>
        </div>
        <div className={styles.scienceWarning}><AlertTriangle size={21}/><p><strong>ÖNEMLİ BİLİMSEL SINIR:</strong> Görüntüler WCS ile hizalandı; fark haritası yalnızca yaklaşık WCS-WAVE filtre bantları örtüşen pikselleri gösteriyor (koyu alanlar dışarıda). İki karede gerçek EPSF hazırsa yerel PSF genişlikleri yaklaşık izotropik Gauss yöntemiyle uyumlu hâle getiriliyor; bu işlem tam alan-bağımlı EPSF konvolüsyonu değildir. <b>Bu bir keşif amaçlı ön incelemedir.</b> Kesin değişim/hareket tespiti için CWAVE/CBAND kalibrasyonu, tam EPSF/PSF eşleştirmesi, fotometrik normalizasyon, bağımsız kontrol verisi ve istatistiksel doğrulama gereklidir. CSV içindeki koordinatlar gridin yaklaşık RA/Dec örnekleme konumlarıdır. İnterpolasyon gerçek teleskop çözünürlüğünü artırmaz.</p></div>
      </div>
    }
    <details className={styles.methodology}>
      <summary>Bilimsel yöntem, veri bütünlüğü ve NASA kaynakları</summary>
      <div>
        <p>Orijinal SPHEREx Level 2 FITS verileri NASA/IPAC IRSA arşivinden alınır. IMAGE (MJy/sr) katmanından modellenen ZODI arka planı çıkarılır. Problemli FLAGS pikselleri dışlanır, VARIANCE doğrulama amacıyla korunur. WCS TAN-SIP ile ortak RA/Dec gridine en yakın komşu yöntemiyle yeniden örnekleme yapılır. WCS-WAVE tablosundan yaklaşık dalga boyu ve bant genişliği elde edilerek örtüşen bantlarda keşif amaçlı fark haritası çizilir.</p>
        <p>Bilimsel yayımlamaya uygun fotometri, PSF eşleştirmesi, resmî CWAVE/CBAND kalibrasyon ürünleri, güven aralıkları ve hareket doğrulaması bu prototipin henüz tamamlanmamış adımlarıdır. Sahte renk ve interpolasyon bilimsel veri çözünürlüğünü artırmaz. Uygulama NASA'nın resmî ürünü değildir.</p>
        <p><b>Veri bütünlüğü:</b> Görüntüler NASA/IPAC arşivindeki gerçek SPHEREx ölçümlerinden üretilir. Önizleme interpolasyonu teleskobun doğal çözünürlüğünü yükseltmez. Bilimsel sonuçların bağımsız doğrulanması gerekir.</p>
        <p>NASA verisi ve bilimsel teknik kaynaklar: <a href="https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_dr1.html" target="_blank" rel="noreferrer">SPHEREx DR1 (DOI:10.26131/IRSA678)</a>, <a href="https://irsa.ipac.caltech.edu/spherex-archive-documentation/spherex-data-products/" target="_blank" rel="noreferrer">SPHEREx FITS veri ürünleri</a>, <a href="https://irsa.ipac.caltech.edu/spherex-archive-documentation/spherex-data-access/" target="_blank" rel="noreferrer">NASA/IPAC SIA2 &amp; FITS Cutout</a>.</p>
        <p>Bu çalışma NASA Jet Propulsion Laboratory ve California Institute of Technology ortak girişimi olan, NASA tarafından finanse edilen SPHEREx görevinin yayımladığı verilere dayanır.</p>
      </div>
    </details>
    <div className={styles.foot}>NASA/IPAC IRSA DR1/QR3 · Kaynak veriler MJy/sr · IMAGE − ZODI ön-işleme · WCS TAN-SIP ve WCS-WAVE yaklaşık band örtüşmesi · Gökyüzü referans gridinde en yakın komşu örnekleme · {target}</div>
  </section>;
}