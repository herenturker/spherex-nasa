import React,{useEffect,useMemo,useRef,useState} from 'react';
import {FileText,CheckCircle2,AlertCircle,Download,ChevronDown,ChevronUp,BarChart2,ShieldCheck,Database} from 'lucide-react';
import {prepareResearchReport,reportToMarkdown,type ReportInputFrame} from '../helpers/spherex-report';
import {localizeResearchReport,researchMarkdownEnglish} from '../helpers/research-language';
import {useLanguage} from '../helpers/i18n';
import {liveStatusEnglish} from '../helpers/live-status-en';
import {startFileExport} from '../helpers/startFileExport';
import type {PreparedExport} from '../helpers/startFileExport';
import SafeExportActions from './SafeExportActions';
import {exportTargetName} from '../helpers/export-filename';
import styles from './ScienceReport.module.css';
type Props={target:string;targetId?:string|null;frames:ReportInputFrame[];processing:boolean};
const pct=(v:number|null)=>v===null?'—':('%'+(v*100).toFixed(1));
const num=(v:number|null,n=3)=>v===null?'—':v.toFixed(n);
const date=(s:string)=>{try{return new Date(s).toLocaleDateString('tr-TR',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'})}catch{return s}};
export default function ScienceReport({target,targetId,frames,processing}:Props){
  const {language}=useLanguage();
  const [expanded,setExpanded]=useState(true);
  const [preparedFile,setPreparedFile]=useState<PreparedExport|null>(null);
  const preparedUrl=useRef<string|null>(null);
  const [saveWarning,setSaveWarning]=useState('');
  const [archiveStatus,setArchiveStatus]=useState('');
  const [controlTests,setControlTests]=useState<{passed:number;total:number;synthetic_only:boolean}|null>(null);
  const savedRun=useRef('');
  useEffect(()=>()=>{if(preparedUrl.current)URL.revokeObjectURL(preparedUrl.current)},[]);
  useEffect(()=>{
    if(preparedUrl.current){URL.revokeObjectURL(preparedUrl.current);preparedUrl.current=null;}
    setPreparedFile(null);
    setSaveWarning('');
  },[target,targetId]);
  function download(name:string,contents:string,type:string){
    try{
      const next=startFileExport(name,contents,type);
      if(preparedUrl.current)URL.revokeObjectURL(preparedUrl.current);
      preparedUrl.current=next.url;
      setPreparedFile(next);
      setSaveWarning('');
    }catch{
      setSaveWarning(language==='en'?'Unable to prepare the export. Try again.':'Dosya dışa aktarımı hazırlanamadı. Yeniden deneyin.');
    }
  }
  const sourceReport=useMemo(()=>prepareResearchReport(target,frames),[target,frames]);
  const fileTarget=exportTargetName(target);
  const report=useMemo(()=>localizeResearchReport(sourceReport,language),[sourceReport,language]);
  const scientific=report.ready_frames;
  const epsfReady=report.frames.filter(frame=>frame.psf_fwhm_arcsec!==null).length;
  const missingCentralCount=report.frames.filter(frame=>
    frame.status==='ready'&&frame.aperture?.status==='insufficient-valid-pixels').length;
  const best=report.best_pair;
  useEffect(()=>{
    let active=true;
    fetch('/_api/spherex-self-test').then(r=>r.json()).then(data=>{
      if(active&&typeof data.passed==='number'&&typeof data.total==='number')
        setControlTests({passed:data.passed,total:data.total,synthetic_only:!!data.synthetic_only});
    }).catch(()=>{});
    return()=>{active=false};
  },[]);
  useEffect(()=>{
    if(!targetId||targetId==='custom'||targetId==='coordinates'||processing||report.ready_frames<2)return;
    const key=targetId+'|'+report.ready_frames+'|'+report.frames.map(f=>
      f.date+'|'+(f.psf_fwhm_arcsec??'no-epsf')).join(',');
    if(savedRun.current===key)return;
    savedRun.current=key;
    const controller=new AbortController();
    async function persist(){
      try{
        const response=await fetch('/_api/spherex-report',{method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({id:targetId}),signal:controller.signal});
        const data=await response.json();
        if(controller.signal.aborted)return;
        setArchiveStatus(response.ok&&data.stored?
          'Bilimsel özet kalıcı rapor arşivine kaydedildi · '+data.ready_frames+' kare · '+data.comparisons+' karşılaştırma':
          'Rapor bu ekranda hazır; kalıcı arşiv kaydı için NASA’dan işlenmiş en az iki kayıtlı kare gerekir.');
      }catch{
        if(!controller.signal.aborted)setArchiveStatus('Rapor indirilebilir; arşiv bağlantısında geçici sorun var.');
      }
    }
    void persist();
    return()=>controller.abort();
  },[targetId,processing,report.ready_frames,report.frames.map(f=>
    f.date+'|'+(f.psf_fwhm_arcsec??'no-epsf')).join(',')]);
  return <section id="science-report" className={styles.panel} aria-label="Bilimsel analiz ve sonuçlar">
    <header className={styles.heading}>
      <div className={styles.headingTitle}><span className={styles.headingIcon}><FileText size={24}/></span>
        <div><span className={styles.eyebrow}>NASA / SPHEREx · AÇIK BİLİM</span>
          <h2>Bilimsel Analiz ve Sonuçlar</h2>
          <p>{target} · her gözlem için ölçümlere dayalı, doğrulanabilir ön rapor</p>
        </div>
      </div>
      <button type="button" className={styles.collapse} onClick={()=>setExpanded(!expanded)}>
        {expanded?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
        {expanded?'Daralt':'Raporu aç'}
      </button>
    </header>
    <div className={styles.scoreRow}>
      <div><span>Toplam görüntü</span><strong>{report.total_frames}</strong><small>NASA gözlem karesi</small></div>
      <div><span>Bilimsel katmanlar hazır</span><strong>{scientific} / {report.total_frames}</strong>
        <small>{processing?'FITS hesaplaması sürüyor':'Kaydedilen hesaplamalar'}</small></div>
      <div><span>Geçerli örnek oranı</span><strong>{scientific?pct(report.data_coverage):'—'}</strong>
        <small>Hazır karelerin grid ortalaması</small></div>
      <div><span>İncelenen çiftler</span><strong>{report.comparisons.length}</strong><small>{report.comparisons.filter(pair=>pair.spectral_overlap>=300).length} {language==='en'?'pairs with 300+ approximately matched spectral pixels':'çiftte 300+ yaklaşık bant uyumlu piksel'}</small></div>
    </div>
    <div className={styles.progressTrack}><div className={styles.progressFill}
      style={{width:(report.total_frames?100*scientific/report.total_frames:0)+'%'}}/></div>
    {missingCentralCount>0&&<div className={styles.centralPhotometryWarning} role="note" data-no-translate>
      <AlertCircle size={19}/>
      <div>
        <strong>{language==='en'
          ?'Central-star photometry is unavailable in '+missingCentralCount+' of '+scientific+' science frames'
          :scientific+' bilimsel karenin '+missingCentralCount+' tanesinde merkezi yıldız fotometrisi yapılamıyor'}</strong>
        <p>{language==='en'
          ?'The central pixels or background annulus do not meet the data-quality conditions. A dark/blank stellar core may reflect masked or unavailable pixels; saturation has not been independently established. The field median (MJy/sr) and local ePSF width are NOT measurements of the star’s total brightness, variability amplitude, or period. No central source flux is reported for these frames.'
          :'Merkez pikseller veya çevre arka plan halkası veri kalitesi koşullarını karşılamıyor. Koyu/boş yıldız çekirdeği maskelenmiş ya da kullanılamayan piksellerden kaynaklanabilir; doygunluk bağımsız olarak doğrulanmadı. Alan medyanı (MJy/sr) ve yerel ePSF genişliği, yıldızın toplam parlaklığı, değişim genliği veya periyodunun ölçümü DEĞİLDİR. Bu kareler için merkezi kaynak akısı raporlanmıyor.'}</p>
      </div>
    </div>}
    {archiveStatus&&<div className={styles.archiveStatus}><Database size={16}/>{language==='en'?liveStatusEnglish(archiveStatus):archiveStatus}</div>}
    {expanded&&<div className={styles.body}>
      <section className={styles.section}>
        <span className={styles.index}>01 — ARAŞTIRMANIN KONUSU</span>
        <h3>Hangi verileri inceliyoruz?</h3>
        <p>Seçilen astronomik hedef <strong>{target}</strong>. Yüklenmiş <strong>{report.total_frames}</strong> SPHEREx gözlem görüntüsünün <strong>{scientific}</strong> tanesinde IMAGE, FLAGS, VARIANCE, ZODI ve WCS tabanlı bilimsel işlemler hazırlandı. Bu görüntüler gerçek kızılötesi ölçümleridir; ekrandaki pastel renkler bilimsel parlaklık değerlerini anlaşılır göstermek için kullanılan bir renk paletidir.</p>
      </section>
      <section className={styles.section}>
        <span className={styles.index}>02 — KARE BAZINDA VERİ KALİTESİ</span>
        <h3>Her fotoğrafın analiz durumu</h3>
        <p><b>EPSF incelemesi:</b> {epsfReady}/{scientific} bilimsel karede NASA'nın yerel noktasal kaynak yanıtı okunmuş.
          {epsfReady<scientific?' Eksik EPSF katmanları için yukarıdaki “Bilimsel FITS / EPSF ölçümlerini yenile” düğmesi kullanılabilir.':''}
        </p>
        <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr><th>Kare</th><th>Gözlem tarihi (UTC)</th><th>Analiz</th><th>Geçerli</th><th>İşaretli</th><th>Dalga boyu</th><th>Medyan ışık</th><th>EPSF genişliği</th><th>Merkezi açıklık toplamı</th></tr></thead>
          <tbody>{report.frames.map(item=><tr key={item.ordinal}>
            <td>{item.ordinal}</td><td>{new Date(item.date).toLocaleDateString(language==='en'?'en-US':'tr-TR',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'})}</td><td>{item.status==='ready'?<span className={styles.ready}><CheckCircle2 size={14}/> Hazır</span>:<span className={styles.pending}><AlertCircle size={14}/> Bekliyor</span>}</td>
            <td>{pct(item.coverage)}</td><td>{pct(item.flagged)}</td>
            <td>{item.wave_um===null?'—':num(item.wave_um,3)+' µm'}</td>
            <td>{item.median_flux===null?'—':num(item.median_flux,4)+' MJy/sr'}</td>
            <td>{item.psf_fwhm_arcsec===null?'Ölçülmedi':num(item.psf_fwhm_arcsec,2)+'″ (yakl.)'}</td>
            <td>{item.aperture?.status==='estimated'?
              num(item.aperture.aperture_sum_MJy_sr_pixel,3)+' (ön ölçüm)':'—'}</td>
          </tr>)}</tbody>
        </table></div>
        <p className={styles.note}>“Geçerli” oranı kalite maskeleri sonrası analize dahil edilen ortak grid piksellerini gösterir. EPSF FWHM, gerçek NASA ePSF modelinin ikinci momentinden alınmış yaklaşık yerel bir genişlik ölçümüdür. Merkezi açıklık toplamı ancak hedef merkezindeki geçerli pikseller yeterliyse raporlanır; maske altındaki yıldız parlaklığı çevresinden uydurulmaz. Değer MJy/sr × grid piksel biriminde ön ölçümdür, kalibre edilmiş kaynak akısı (µJy) değildir.</p>
      </section>
      <section className={styles.section}>
        <span className={styles.index}>03 — ZAMAN İÇİNDE KARŞILAŞTIRMA</span>
        <h3>Görüntüler birbirleriyle ne kadar uyumlu?</h3>
        {best?.spectral_overlap===0&&<p className={styles.note}>Bu hedefte karşılaştırılabilir dalga boyu pikselleri yok. Görüntüler gerçek NASA verileridir ancak mevcut gözlem çiftlerinden güvenilir zaman değişimi ölçülemez. Aynı dalga boyundaki başka NASA ziyaretleri gerekir.</p>}
        {best?<div className={styles.matchCard}>
          <div><BarChart2 size={22}/><strong>{best.spectral_overlap>0?'En yüksek spektral örtüşme':'Bant eşleşmesi bulunamadı'}</strong><small>{language==='en'?'Frames '+best.a+' and '+best.b:'Kare '+best.a+' ve '+best.b}</small></div>
          <div className={styles.matchStats}>
            <span><b>{best.spatial_overlap.toLocaleString(language==='en'?'en-US':'tr-TR')}</b> ortak gökyüzü pikseli</span>
            <span><b>{best.spectral_overlap.toLocaleString(language==='en'?'en-US':'tr-TR')}</b> yaklaşık bant uyumlu piksel</span>
            <span><b>{pct(best.overlap_fraction)}</b> bant uyumluluğu</span>
          </div>
          <p>{best.note}</p>
        </div>:<p>Henüz iki farklı bilimsel görüntü hazırlanmadığından karşılaştırma oluşturulamadı.</p>}
        {best?.validation&&<div className={styles.validationCard}>
          <strong><ShieldCheck size={17}/> EPSF destekli karşılaştırma kontrolü</strong>
          <p>{best.validation.psf_status==='approximate-local-EPSF-homogenized'
            ? best.spectral_overlap<300
              ? 'İki karenin gerçek ePSF genişliği ölçüldü. Ancak aynı dalga boyunda yeterli veri yok; EPSF bilgisi bu iki kare için bilimsel fark ölçümü sağlamaz.'
              : 'İki karenin gerçek ePSF genişliği ölçüldü. Görüntüler yaklaşık izotropik Gauss genişliğine göre eşitlendi.'
            : 'İki kare için EPSF bilgisi eksik. PSF eşleştirmesi uygulanmadı; sonuç yalnızca keşif amaçlıdır.'}</p>
          <div className={styles.validationStats}>
            <span>PSF sonrası yaklaşık bant uyumlu örnek <b>{best.validation.spectrally_matched_pixels.toLocaleString(language==='en'?'en-US':'tr-TR')}</b></span>
            <span>Empirik fark saçılımı <b>{num(best.validation.empirical_scatter_MJy_sr,5)} MJy/sr</b></span>
            <span>6 eşik üstü tarama pikselleri <b>{best.validation.screening_pixels_above_6}</b></span>
            <span>Komşu yüksek skorlu inceleme bölgeleri <b>{best.validation.coherent_regions_for_review??0}</b></span>
            <span>Ön kontrol sonucu <b>{best.validation.screening_status==='insufficient-overlap'?'Yetersiz örtüşme':best.validation.screening_status==='limited-PSF'?'EPSF eksik':best.validation.screening_status==='low-quality'?'Düşük piksel kapsamı — aday taraması kapalı':'Görsel incelemeye uygun'}</b></span>
          </div>
          <p className={styles.note}>Yan yana en az dört yüksek skorlu piksel bir inceleme bölgesi sayılır; tek piksellik sıçramalar böylece ayrılır. Bu tarama; korele gürültü, PSF'nin alan içindeki değişimi ve sistematik belirsizlikler nedeniyle kalibre edilmiş bir p-değeri, doğrulanmış istatistiksel anlamlılık veya gök cismi keşfi anlamına gelmez.</p>
        </div>}
        {report.comparisons.length>0&&<details className={styles.pairDetails}><summary>{language==='en'?'Spectral overlap across all date pairs':'Tüm tarih çiftlerinin bilimsel örtüşme tablosu'} ({report.comparisons.length} {language==='en'?(report.comparisons.length===1?'pair':'pairs'):'çift'})</summary>
          <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>Kare A / B</th><th>Ortak piksel</th><th>Bant uyumlu</th><th>İnceleme bölgesi</th><th>Medyan fark</th><th>Robust MAD</th></tr></thead>
            <tbody>{report.comparisons.map(item=><tr key={item.a+'-'+item.b}>
              <td>{item.a} → {item.b}</td><td>{item.spatial_overlap}</td><td>{item.spectral_overlap}</td>
              <td>{item.spectral_overlap>=300?(item.validation?.coherent_regions_for_review??0):'Uygun değil'}</td>
              <td>{num(item.offset_median,5)}</td><td>{num(item.mad,5)}</td>
            </tr>)}</tbody>
          </table></div>
        </details>}
      </section>
      <section className={styles.section}>
        <span className={styles.index}>04 — BULGULAR VE BİLİMSEL YORUM</span>
        <h3>Sonuçlar bize ne söylüyor?</h3>
        <p>{report.interpretation}</p>
        <p>Ölçüm yaklaşımımızı güçlendirdik: NASA ePSF modelinden yerel noktasal kaynak genişliği çıkarılabiliyor; merkezi açıklık ve arka plan halkası kullanılarak yaklaşık parlaklık ölçümü yapılabiliyor. Bununla birlikte farklı dalga boyu, eksik tam PSF ve fotometrik kalibrasyon nedeniyle bu çıktı henüz hassas astronomik fotometri veya hareket doğrulaması değildir.</p>
        <div className={styles.caution}><ShieldCheck size={20}/><p><b>Bilimsel dürüstlük:</b> Doğrulanmış gök cismi hareketi, değişken yıldız veya ötegezegen keşfi iddiasında bulunmuyoruz. Otomatik rapor ölçümlerin durumunu ve güvenilir karşılaştırma koşullarını açıklar; belirsizliği saklamaz.</p></div>
      </section>
      <section className={styles.section}>
        <span className={styles.index}>05 — YÖNTEM VE TEKRAR ÜRETİLEBİLİRLİK</span>
        <h3>Bu rapor nasıl üretildi?</h3>
        <p>{report.method}</p><p>{report.disclaimer}</p>
        {controlTests&&<p className={styles.note}><b>Yazılım öz doğrulama testleri:</b> {controlTests.passed}/{controlTests.total} başarılı. Bunlar bilinen yapay değişimler, sabit arka plan, yanlış dalga boyu, eksik EPSF, tek piksel sıçraması ve sabit tohumlu gürültü kontrollerini içerir. <b>Sentetik yazılım testleridir; gerçek uzaydaki yanlış alarm olasılığını veya doğrulanmış hareket tespitini ölçmezler.</b></p>}
        <p>Veri kaynağı: <a href="https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_dr1.html" target="_blank" rel="noreferrer">NASA/IPAC SPHEREx DR1</a> · DOI <b>10.26131/IRSA678</b>. Bulgular, sayısal ölçümlerden tekrar üretilebilen hesaplamalara dayanır; belirsizlik ve analiz sınırları yukarıda belirtilmiştir.</p>
        <p><b>Bağımsız doğrulama için NASA aracı:</b> <a href="https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html" target="_blank" rel="noreferrer">IRSA SPHEREx Spectrophotometry Tool</a> noktasal kaynaklar için enstrümanın konum-bağımlı PSF modelini, yerel arka planı ve piksel solid-angle kalibrasyonunu kullanarak Tractor tabanlı zorunlu fotometri uygular. Bu prototipin merkezi açıklık ölçümleri onun sonuçlarıyla karıştırılmamalıdır.</p>
      </section>
      <footer className={styles.actions}>
        <button type="button" onClick={()=>download('SPHEREx_'+fileTarget+(language==='en'?'_Scientific_Report_EN.md':'_Bilimsel_Rapor_TR.md'),language==='en'?researchMarkdownEnglish(sourceReport):reportToMarkdown(sourceReport),'text/markdown;charset=utf-8')}><Download size={17}/> Raporu indir · Markdown</button>
        <button type="button" onClick={()=>download('SPHEREx_'+fileTarget+(language==='en'?'_Scientific_Data_EN.json':'_Bilimsel_Veriler_TR.json'),JSON.stringify(report,null,2),'application/json;charset=utf-8')}><Database size={17}/> Ölçüm özetini indir · JSON</button>
        <span>NASA/IPAC kaynaklı gerçek ölçümlere dayanan bilimsel ön-rapor</span>
      </footer>
      {preparedFile&&<SafeExportActions prepared={preparedFile} language={language}/>}
      {saveWarning&&<p className={styles.saveWarning} role="alert">{saveWarning}</p>}
    </div>}
  </section>;
}