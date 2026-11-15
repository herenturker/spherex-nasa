import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Play, Pause, ChevronLeft, ChevronRight, ChevronDown, UploadCloud, Telescope, Orbit, Globe2, Clock3, ArrowUpRight, Layers3, Info, LoaderCircle, CheckCircle2, AlertTriangle, RotateCcw, FileText, Download } from 'lucide-react';
import ScienceLab from '../components/ScienceLab';
import ScienceReport from '../components/ScienceReport';
import SafeExportActions from '../components/SafeExportActions';
import {startFileExport,type PreparedExport} from '../helpers/startFileExport';
import LanguageSwitcher from '../components/LanguageSwitcher';
import InstitutionLinks from '../components/InstitutionLinks';
import {useLanguage} from '../helpers/i18n';
import {translateTurkish} from '../helpers/locale-phrases';
import {liveStatusEnglish} from '../helpers/live-status-en';
import type { ScienceFrameData } from '../helpers/science-fits';
import styles from './_index.module.css';

type Frame = { file: string; observed_utc: string; source_fits_cutout_url?: string; index?: number };
type Manifest = { project?: string; target_name?: string; target_id?: string; ra_deg: number; dec_deg: number; detector: string; source?: string; frames: Frame[] };
type PresetKey = 'm101' | 'barnard';
const DATASETS: Record<PresetKey, {label: string; url: string}> = {
  m101: {label:'M101 Galaksisi', url:'/_cdn/static/1ba79d16-e9f4-4076-ab91-4ba594251f9e-SPHEREx_Web_Data_Starter.zip'},
  barnard: {label:'Barnard Yıldızı', url:'/_cdn/static/d01e83d9-e254-4e85-8dec-2a61ca4610ab-SPHEREx_barnard_Web_Data.zip'}
};
type LoadedFrame = Frame & { src: string; science?:ScienceFrameData };
type LogLevel = 'info' | 'success' | 'retry' | 'warning' | 'error';
type OperationLog = { id: string; timestamp: string; level: LogLevel; message: string; detail?: string };
type ProgressState = { phase:'idle'|'querying'|'downloading'|'complete'|'partial'|'error'; current:number; goal:number; attempt:number; tried:number };
type SearchRequest = {ra:number; dec:number; detector:string; target:string};
type LibraryTarget={id:string;label_tr:string;label_en:string;object_type:string;
  ra_deg:number;dec_deg:number;detector:string;description_tr:string;
  bundled_zip:boolean;available_count:number|null;cached_frame_count:number;
  last_checked_at:string|null;source:string|null};
const FALLBACK_TARGETS:LibraryTarget[]=[
  {id:'m101',label_tr:'M101 · Fırıldak Gökadası',label_en:'M101 · Pinwheel Galaxy',object_type:'Galaksi',
    ra_deg:210.80227,dec_deg:54.34895,detector:'SPHEREx-D2',
    description_tr:'Kaydedilmiş NASA görüntüleri',bundled_zip:true,
    available_count:null,cached_frame_count:0,last_checked_at:null,source:null},
  {id:'barnard',label_tr:'Barnard Yıldızı',label_en:"Barnard's Star",object_type:'Yıldız',
    ra_deg:269.4463,dec_deg:4.7672,detector:'SPHEREx-D2',
    description_tr:'Kaydedilmiş NASA görüntüleri',bundled_zip:true,
    available_count:null,cached_frame_count:0,last_checked_at:null,source:null}
];
const CHALLENGE_TARGET_IDS=['barnard','eps-indi-b','wise-0855','rw-aur','r-dra'] as const;
const SPECTRAL_TARGET_IDS=['eps-indi-b-d6','wise-0855-d5','wise-0855-d6'] as const;
const EXAMPLE_TARGET_IDS=['m101','m104','m42'] as const;

export default function HomePage() {
  const {language}=useLanguage();
  const liveText=(value:string)=>language==='en'?liveStatusEnglish(value):value;
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [frames, setFrames] = useState<LoadedFrame[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [compare, setCompare] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeTarget, setActiveTarget] = useState<string>('barnard');
  const [libraryTargets,setLibraryTargets] = useState<LibraryTarget[]>(FALLBACK_TARGETS);
  const [showMoreTargets,setShowMoreTargets] = useState(false);
  const [libraryStatus,setLibraryStatus]=useState('');
  const [raInput, setRaInput] = useState('269.4463');
  const [decInput, setDecInput] = useState('4.7672');
  const [detectorInput, setDetectorInput] = useState('SPHEREx-D2');
  const [searching, setSearching] = useState(false);
  const [cutoutSize,setCutoutSize] = useState<'0.1'|'0.2'>('0.2');
  const [scientificProcessing,setScientificProcessing] = useState(false);
  const [scienceProgressText,setScienceProgressText] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const [searchSummary, setSearchSummary] = useState<{archived:number; candidates:number; tried:number; completed:number; skipped:number} | null>(null);
  // Günlük yalnızca o anda başlatılan NASA aramasını anlatır; eski oturumlar yüklenmez.
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [progress, setProgress] = useState<ProgressState>({phase:'idle',current:0,goal:6,attempt:0,tried:0});
  const [retryAvailable,setRetryAvailable] = useState(false);
  const [elapsedSeconds,setElapsedSeconds] = useState(0);
  const [successToast, setSuccessToast] = useState<{title:string; subtitle:string; remaining:number} | null>(null);
  const lastSearchRef = useRef<SearchRequest|null>(null);
  const staleRefreshTriggeredRef=useRef<Set<string>>(new Set());
  const searchRunningRef = useRef(false);
  const progressRef = useRef<ProgressState>({phase:'idle',current:0,goal:6,attempt:0,tried:0});
  const logSequence = useRef(0);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const viewerSectionRef = useRef<HTMLDivElement>(null);
  const urlsRef = useRef<string[]>([]);
  const initialLoadStarted = useRef(false);
  const [preparedLog,setPreparedLog]=useState<PreparedExport|null>(null);
  const preparedLogUrl=useRef<string|null>(null);
  useEffect(()=>()=>{if(preparedLogUrl.current)URL.revokeObjectURL(preparedLogUrl.current)},[]);
  function reflectSelectedTarget(id:string){
    // Preserve the exact scientific target on refresh/share while retaining
    // Barnard as the default for a fresh visit to the bare homepage URL.
    const url=new URL(window.location.href);
    if(id==='barnard'||id==='custom'||id==='coordinates')url.searchParams.delete('target');
    else url.searchParams.set('target',id);
    window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
    try{window.sessionStorage.setItem('spherex-last-target',JSON.stringify({id,at:Date.now()}));}catch{}
  }
  const hasData = frames.length > 0;
  const frame = frames[index] ?? null;
  const activeCatalogRecord=libraryTargets.find(item=>item.id===activeTarget);
  const challengeTargets=CHALLENGE_TARGET_IDS.map(id=>libraryTargets.find(t=>t.id===id)).filter((t):t is LibraryTarget=>Boolean(t));
  const spectralTargets=SPECTRAL_TARGET_IDS.map(id=>libraryTargets.find(t=>t.id===id)).filter((t):t is LibraryTarget=>Boolean(t));
  const exampleTargets=EXAMPLE_TARGET_IDS.map(id=>libraryTargets.find(t=>t.id===id)).filter((t):t is LibraryTarget=>Boolean(t));
  const extraTargets=libraryTargets.filter(t=>!([...CHALLENGE_TARGET_IDS,...SPECTRAL_TARGET_IDS,...EXAMPLE_TARGET_IDS] as string[]).includes(t.id));
  const targetBusy=busy||searching||scientificProcessing;
  const recognizableTarget = manifest && Math.abs(manifest.ra_deg-269.4463)<0.002 && Math.abs(manifest.dec_deg-4.7672)<0.002 ? (language==='en'?"Barnard's Star":'Barnard Yıldızı') : manifest && Math.abs(manifest.ra_deg-210.80227)<0.002 && Math.abs(manifest.dec_deg-54.34895)<0.002 ? (language==='en'?'M101 Galaxy':'M101 Galaksisi') : null;
  const targetTitle = activeCatalogRecord
    ? (language==='en'?activeCatalogRecord.label_en:activeCatalogRecord.label_tr)
    : recognizableTarget??(manifest?.target_name?(language==='en'?translateTurkish(manifest.target_name):manifest.target_name.replace('Yildizi','Yıldızı')):'Yüklenen Gökyüzü Bölgesi');

  function appendLog(level:LogLevel, message:string, detail?:string) {
    const timestamp=new Date().toISOString();
    const entry:OperationLog={id:timestamp+'-'+(++logSequence.current),timestamp,level,message,detail};
    setOperationLogs(previous=>[...previous,entry].slice(-500));
  }

  // Sağ tarafta değişen HER durum mesajı, soldaki günlüğe yeni ve kalıcı bir satırdır.
  function reportStatus(message:string, level:LogLevel='info') {
    setSearchMessage(message);
    appendLog(level,message);
  }
  function setSearchProgress(next:ProgressState) {
    progressRef.current=next;
    setProgress(next);
  }
  const pause=(ms:number)=>new Promise<void>(resolve=>window.setTimeout(resolve,ms));
  function scienceUrl(original:string){
    const u=new URL(original);
    u.searchParams.set('size',cutoutSize);
    return u.toString();
  }

  function showSuccess(title:string, subtitle:string){
    setSuccessToast({title,subtitle,remaining:3});
  }

  function exportLogs(){
    const header=language==='en'
      ?'SPHEREx Sky Explorer — Processing Log\nTimestamps use the local device time zone.\n\n'
      :'SPHEREx Sky Explorer — İşlem Günlüğü\nİşlem zamanları cihazın yerel saat dilimindedir.\n\n';
    const locale=language==='en'?'en-US':'tr-TR';
    const localized=(value:string)=>language==='en'?liveStatusEnglish(value):value;
    const lines=operationLogs.map(row => '['+new Date(row.timestamp).toLocaleString(locale)+'] '+row.level.toUpperCase()+' | '+localized(row.message)+(row.detail?' — '+localized(row.detail):''));
    const result=startFileExport(language==='en'?'SPHEREx_Processing_Log_EN.txt':'SPHEREx_Islem_Gunlugu_TR.txt',
      header+lines.join('\n'),'text/plain;charset=utf-8');
    if(preparedLogUrl.current)URL.revokeObjectURL(preparedLogUrl.current);
    preparedLogUrl.current=result.url;
    setPreparedLog(result);
  }

  useEffect(()=>{
    const node=logScrollRef.current;
    if(node)node.scrollTop=node.scrollHeight;
  },[operationLogs]);

  useEffect(()=>{
    if(!searching)return;
    const started=Date.now();
    let lastHeartbeat=0;
    const id=window.setInterval(()=>{
      const seconds=Math.floor((Date.now()-started)/1000);
      setElapsedSeconds(seconds);
      // NASA tek bir yanıt için uzun süre bekletebilir. Bu sırada kullanıcıya
      // bağlantının hâlâ beklenmekte olduğunu, ek ağ isteği göndermeden bildir.
      if(seconds>=15 && seconds-lastHeartbeat>=15){
        lastHeartbeat=seconds;
        const current=progressRef.current;
        reportStatus(current.phase==='querying'
          ? 'NASA/IPAC katalog yanıtı bekleniyor… '+seconds+' saniye geçti; henüz yeni istek gönderilmedi.'
          : 'NASA FITS işlemi sürüyor… '+current.current+'/'+current.goal+' görüntü hazır; '+seconds+' saniye geçti.','info');
      }
    },1000);
    return ()=>window.clearInterval(id);
  },[searching]);

  useEffect(()=>{
    if(!successToast)return;
    const countdown=window.setTimeout(()=>{
      setSuccessToast(current=>current && current.remaining>1 ? {...current,remaining:current.remaining-1} : null);
    },1000);
    return ()=>window.clearTimeout(countdown);
  },[successToast]);

  useEffect(() => {
    if (!playing || frames.length < 2 || compare) return;
    const id = window.setInterval(() => setIndex(i => (i + 1) % frames.length), speed);
    return () => window.clearInterval(id);
  }, [playing, frames.length, speed, compare]);

  useEffect(() => () => urlsRef.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    const requestedFromUrl=new URL(window.location.href).searchParams.get('target');
    let remembered:string|null=null;
    try{
      const saved=JSON.parse(window.sessionStorage.getItem('spherex-last-target')||'null');
      if(saved&&typeof saved.id==='string'&&Date.now()-saved.at<7200000)remembered=saved.id;
    }catch{}
    const requested=requestedFromUrl||remembered;
    const validTarget=requested&&([...CHALLENGE_TARGET_IDS,...SPECTRAL_TARGET_IDS,...EXAMPLE_TARGET_IDS] as string[]).includes(requested);
    if(!validTarget||requested==='barnard'){
      void loadPreset('barnard',false);
      return;
    }
    // Direct URL / Safari refresh: restore the selected data set, not a
    // misleading Barnard report from the home-page default.
    void (async()=>{
      setBusy(true);
      try{
        const res=await fetch('/_api/spherex-saved-target?'+new URLSearchParams({id:requested}),{cache:'no-store'});
        const saved=await res.json();
        if(!res.ok||!Array.isArray(saved.frames)||saved.frames.length<2||saved.target?.id!==requested)
          throw new Error('No saved science data for target');
        const prepared=saved.frames as LoadedFrame[];
        setManifest({project:'SPHEREx Sky Explorer · NASA Space Apps Challenge 2026',
          target_name:saved.target.label_tr,target_id:requested,
          ra_deg:saved.target.ra_deg,dec_deg:saved.target.dec_deg,detector:saved.target.detector,
          source:'Önceden işlenmiş gerçek NASA SPHEREx FITS verileri · kalıcı veritabanı',
          frames:prepared.map(({src,science,...other})=>other)});
        setFrames(prepared);setActiveTarget(requested);setIndex(0);setPlaying(false);setCompare(false);
        reflectSelectedTarget(requested);
        setRaInput(String(saved.target.ra_deg));setDecInput(String(saved.target.dec_deg));
        setDetectorInput(saved.target.detector);
        setLibraryStatus(saved.target.label_tr+' · URL üzerinden '+prepared.length+' doğrulanabilir bilimsel kare geri yüklendi.');
        setBusy(false);
      }catch{
        setBusy(false);
        void loadPreset('barnard',false);
      }
    })();
  }, []);

  async function reloadLibrary(){
    try{
      const res=await fetch('/_api/spherex-targets',{cache:'no-store'});
      const data=await res.json();
      if(!res.ok||!Array.isArray(data.targets))throw new Error(data.error||'Katalog yanıtı yok');
      setLibraryTargets(data.targets);
      setLibraryStatus(data.targets.length+' gökyüzü bölgesi / dedektör kaydı hazır. “Arşivde Ara” ile gerçek SPHEREx kayıtları kontrol edilir.');
    }catch{
      setLibraryStatus('Hedef kataloğuna şu an ulaşılamadı; iki hazır hedef kullanılabilir.');
    }
  }
  useEffect(()=>{void reloadLibrary()},[]);

  // A stale *catalogue* is never a reason to replace the user's displayed
  // scientific observations. Refresh metadata only, keeping frames and ePSF
  // measurements exactly as loaded from the permanent science archive.
  async function refreshCatalogOnly(target:SearchRequest){
    try{
      const params=new URLSearchParams({
        ra:String(target.ra),dec:String(target.dec),detector:target.detector
      });
      const response=await fetch('/_api/spherex-search?'+params.toString(),{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'NASA katalog sorgusu başarısız');
      setLibraryStatus(target.target+' · kayıtlı bilimsel görüntüler değişmedi. '+
        (data.catalog_source==='stale-cache'?
          'NASA geçici olarak yanıt vermedi; eski gerçek katalog bilgisi korundu.':
          'NASA katalog kontrolü tamamlandı; yeni görüntüleri indirmek isterseniz “NASA’da Ara” düğmesini kullanın.'));
    }catch(error){
      setLibraryStatus(target.target+' · kayıtlı bilimsel görüntüler korundu. NASA katalog güncellemesi şu anda yapılamadı.');
    }
  }

  async function selectLibraryTarget(id:string){
    if(searching||busy||scientificProcessing)return;
    if(id==='custom'){
      setActiveTarget('custom');
      setLibraryStatus('Özel koordinatlar bir veri paketi değildir: aşağıdaki RA/Dec kutularına istediğiniz gökyüzü koordinatını girip NASA’da Ara’ya basın.');
      return;
    }
    const target=libraryTargets.find(t=>t.id===id);
    if(!target)return;
    setRaInput(String(target.ra_deg));
    setDecInput(String(target.dec_deg));
    setDetectorInput(target.detector);
    if(id==='m101'||id==='barnard'){
      await loadPreset(id);
      return;
    }
    setBusy(true);
    setError('');
    setLibraryStatus(target.label_tr+' için daha önce hazırlanmış gerçek FITS görüntüleri aranıyor…');
    let storedFrames:LoadedFrame[]=[];
    let catalogNeedsRefresh=false;
    try{
      const res=await fetch('/_api/spherex-saved-target?'+new URLSearchParams({id}),{cache:'no-store'});
      const saved=await res.json();
      if(res.ok&&Array.isArray(saved.frames)&&saved.frames.length>=2){
        storedFrames=saved.frames as LoadedFrame[];
        setManifest({
          project:'SPHEREx Sky Explorer · NASA Space Apps 2026',
          target_name:target.label_tr,target_id:id,
          ra_deg:target.ra_deg,dec_deg:target.dec_deg,detector:target.detector,
          source:'Önceden işlenmiş gerçek NASA SPHEREx FITS verileri · kalıcı veritabanı',
          frames:storedFrames.map(({src,science,...other})=>other)
        });
        setFrames(storedFrames);
        setActiveTarget(id);
        reflectSelectedTarget(id);
        setIndex(0);setCompare(false);setPlaying(false);
        setLibraryStatus(target.label_tr+' · '+storedFrames.length+' bilimsel kare kalıcı önbellekten açıldı. Katalog kontrolü: '+
          (saved.catalog_last_checked_at?new Date(saved.catalog_last_checked_at).toLocaleString('tr-TR'):'henüz yapılmadı')+
          '. Güncellemek için NASA’da Ara’ya basın.');
        catalogNeedsRefresh=!saved.catalog_fresh;
        showSuccess('Kaydedilmiş bilimsel görüntüler hazır',storedFrames.length+' gerçek SPHEREx karesi açıldı');
      }
    }catch(error){
      console.warn('SPHEREx yerel arşiv sorgusu',String(error));
    }finally{setBusy(false)}
    if(storedFrames.length>=2){
      if(catalogNeedsRefresh&&!staleRefreshTriggeredRef.current.has(id)){
        staleRefreshTriggeredRef.current.add(id);
        setLibraryStatus(target.label_tr+' için kayıtlı görüntüler açık; 24 saatlik katalog süresi dolduğu için NASA güncellemesi otomatik başlatılıyor.');
        void refreshCatalogOnly({ra:target.ra_deg,dec:target.dec_deg,
          detector:target.detector,target:target.label_tr});
      }
      return;
    }
    setLibraryStatus(target.label_tr+' için kayıtlı görüntü bulunmadı; NASA arşivinden indiriliyor.');
    await searchSky(null,false,{ra:target.ra_deg,dec:target.dec_deg,detector:target.detector,target:target.label_tr});
  }

  async function loadPreset(target: PresetKey, showFeedback=true) {
    if(searching||scientificProcessing)return;
    setBusy(true); setError(''); setPlaying(false);setSearchMessage('');setSearchSummary(null);
    setSuccessToast(null);
    setOperationLogs([]);
    setRetryAvailable(false);
    setElapsedSeconds(0);
    setSearchProgress({phase:'idle',current:0,goal:6,attempt:0,tried:0});
    try {
      // The persistent NASA library is preferred; the original bundled ZIP
      // remains an offline fallback and is never mistaken for a live archive query.
      try{
        const cachedResponse=await fetch('/_api/spherex-saved-target?'+new URLSearchParams({id:target}),{
          cache:'no-store',signal:AbortSignal.timeout(20000)
        });
        if(cachedResponse.ok){
          const saved=await cachedResponse.json();
          if(Array.isArray(saved.frames)&&saved.frames.length>=2){
            const prepared=saved.frames as LoadedFrame[];
            setManifest({
              project:'SPHEREx Sky Explorer · NASA Space Apps Challenge 2026',
              target_name:saved.target.label_tr,target_id:target,
              ra_deg:saved.target.ra_deg,dec_deg:saved.target.dec_deg,detector:saved.target.detector,
              source:'Önceden işlenmiş gerçek NASA FITS arşivi · 24 saatlik katalog doğrulaması',
              frames:prepared.map(({src,science,...other})=>other)
            });
            setFrames(prepared);
            setRaInput(String(saved.target.ra_deg));setDecInput(String(saved.target.dec_deg));
            setDetectorInput(saved.target.detector);
            setActiveTarget(target);setIndex(0);setCompare(false);
            reflectSelectedTarget(target);
            setLibraryStatus('Bilimsel önbellek: '+prepared.length+' gerçek FITS karesi hazır. Yeni kayıtlar için NASA’da Ara düğmesini kullanabilirsiniz.');
            if(showFeedback)showSuccess('Bilimsel görüntüler açıldı!',prepared.length+' kalıcı SPHEREx karesi hazır');
            setBusy(false);
            if(!saved.catalog_fresh&&!staleRefreshTriggeredRef.current.has(target)){
              staleRefreshTriggeredRef.current.add(target);
              setLibraryStatus('Eski bilimsel kareler açıldı. 24 saatlik katalog süresi dolmuş; NASA indeksi arka planda doğrulanıyor…');
              void refreshCatalogOnly({ra:saved.target.ra_deg,dec:saved.target.dec_deg,
                detector:saved.target.detector,target:saved.target.label_tr});
            }
            return;
          }
        }
      }catch(err){console.warn('Kalıcı SPHEREx arşivi açılamadı; ZIP yedeğine geçiliyor.',String(err))}
      const response = await fetch(DATASETS[target].url);
      if (!response.ok) throw new Error('Kayıtlı SPHEREx paketi alınamadı: HTTP ' + response.status);
      await loadZip(await response.blob(), target, showFeedback);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hedef verisi yüklenemedi');
      setBusy(false);
    }
  }

  async function searchSky(e:React.FormEvent<HTMLFormElement>|null, slowRetry=false,override?:SearchRequest) {
    e?.preventDefault();
    if(searchRunningRef.current||scientificProcessing)return;
    const previous=slowRetry ? lastSearchRef.current : null;
    const ra=previous ? previous.ra : override ? override.ra : Number(raInput.trim().replace(',','.'));
    const dec=previous ? previous.dec : override ? override.dec : Number(decInput.trim().replace(',','.'));
    const detector=previous ? previous.detector : override?.detector || detectorInput;
    if(!Number.isFinite(ra)||!Number.isFinite(dec)||ra<0||ra>360||dec< -90||dec>90){
      setOperationLogs([]);
      reportStatus('RA 0–360°, Dec −90° ile +90° arasında bir koordinat olmalıdır.','error');
      return;
    }
    const searchedTarget=previous?.target || override?.target ||
      (Math.abs(ra-269.4463)<0.002 && Math.abs(dec-4.7672)<0.002 ? 'Barnard Yıldızı' :
      Math.abs(ra-210.80227)<0.002 && Math.abs(dec-54.34895)<0.002 ? 'M101 Galaksisi' :
      'RA '+ra.toFixed(5)+'° / Dec '+dec.toFixed(5)+'° bölgesi');
    lastSearchRef.current={ra,dec,detector,target:searchedTarget};
    searchRunningRef.current=true;
    const previousTarget=targetTitle;
    const previousFrameCount=frames.length;
    setOperationLogs([]);
    setRetryAvailable(false);
    setSearchMessage('');
    setSearchSummary(null);
    setSuccessToast(null);
    setPlaying(false);
    setElapsedSeconds(0);
    setSearching(true);
    setSearchProgress({phase:'querying',current:0,goal:6,attempt:0,tried:0});
    reportStatus(searchedTarget+' için canlı NASA/IPAC SIA2 sorgusu başlatıldı. RA '+ra.toFixed(5)+'°, Dec '+dec.toFixed(5)+'° · '+detector+'.','info');
    if(slowRetry){
      reportStatus('YAVAŞ TEKRAR DENEME: NASA SIA2 katalog sorgusu en fazla 3 defa denenecek. FITS istekleri arasında uzun aralar bırakılacak.','retry');
    }

    try {
      const params=new URLSearchParams({ra:String(ra),dec:String(dec),detector});
      const queryTries=slowRetry?3:1;
      let result:any=null;
      for(let queryAttempt=1;queryAttempt<=queryTries;queryAttempt++){
        reportStatus('NASA SIA2 katalog sorgusu — deneme '+queryAttempt+'/'+queryTries+'. Sunucu yanıtı bekleniyor…',queryAttempt>1?'retry':'info');
        try {
          const response=await fetch('/_api/spherex-search?'+params.toString(),{cache:'no-store'});
          const data=await response.json();
          if(!response.ok)throw new Error(data.error || 'NASA katalog sorgusu HTTP '+response.status);
          result=data;
          break;
        }catch(error){
          const reason=error instanceof Error?error.message:'Bilinmeyen bağlantı hatası';
          reportStatus('NASA SIA2 katalog sorgusu '+queryAttempt+'/'+queryTries+' başarısız: '+reason,'warning');
          const transient=/HTTP (429|500|502|503|504)|timeout|aborted|Failed to fetch|NetworkError/i.test(reason);
          if(!slowRetry||!transient||queryAttempt===queryTries)throw error;
          const waitSeconds=queryAttempt===1?8:16;
          reportStatus('NASA sunucusunu zorlamamak için '+waitSeconds+' saniye bekleniyor; ardından katalog yeniden sorgulanacak.','retry');
          await pause(waitSeconds*1000);
        }
      }
      if(!result || !Array.isArray(result.frames)||result.frames.length===0){
        reportStatus(searchedTarget+' için '+detector+' dedektöründe uygun gözlem bulunamadı. Diğer koordinat veya dedektörü deneyin.','warning');
        setSearchProgress({phase:'partial',current:0,goal:6,attempt:0,tried:0});
        return;
      }
      const goal=Math.min(6,result.frames.length);
      setSearchProgress({phase:'downloading',current:0,goal,attempt:0,tried:0});
      if(result.catalog_source === 'snapshot'){
        reportStatus('NASA SIA2 şu anda yanıt vermedi. '+String(result.snapshot_utc||'önceden')+
          ' tarihinde NASA’dan alınmış GERÇEK katalog indeksinin yedeği kullanıldı. Görüntüler şimdi NASA’dan canlı indirilecek.','warning');
      }else if(result.catalog_source==='cache'||result.catalog_source==='stale-cache'){
        reportStatus('NASA katalog indeksi '+(result.catalog_source==='stale-cache'?'süresi geçmiş kayıttan':'24 saatlik önbellekten')+
          ' alındı. Kaynak: gerçek NASA/IPAC gözlem kayıtları. FITS dosyaları da kalıcı önbellekte varsa tekrar indirilmez.',result.catalog_source==='stale-cache'?'warning':'info');
      }else{
        reportStatus('NASA SIA2 kataloğu yanıtladı: '+result.available_count+' uygun '+detector+' kaydı, '+result.frames.length+' aday gözlem bulundu. Hedef '+goal+' gerçek kare.','success');
      }
      const loaded:LoadedFrame[]=[];
      const failures:string[]=[];
      let candidateCount=0;
      for(let i=0;i<result.frames.length&&loaded.length<goal;i++){
        const candidate=result.frames[i];
        candidateCount++;
        if(slowRetry&&i>0){
          reportStatus('NASA sunucusuna yeni FITS isteği göndermeden önce 3 saniye bekleniyor.','retry');
          await pause(3000);
        }
        reportStatus('Aday '+candidateCount+'/'+result.frames.length+' seçildi: '+candidate.observed_utc+'. Aynı RA/Dec ve '+detector+' kullanılacak.','info');
        let success=false;
        let reason='';
        for(let attempt=1;attempt<=3;attempt++){
          setSearchProgress({phase:'downloading',current:loaded.length,goal,attempt,tried:candidateCount});
          reportStatus('Aday '+candidateCount+' için FITS indirme denemesi '+attempt+'/3. '+loaded.length+'/'+goal+' kare hazır.','info');
          try {
            const sourceUrl=scienceUrl(candidate.source_fits_cutout_url);
            const imgResponse=await fetch('/_api/spherex-science?'+new URLSearchParams({url:sourceUrl}).toString());
            const converted=await imgResponse.json();
            if(!imgResponse.ok||!String(converted.png||'').startsWith('data:image/png;base64,')){
              throw new Error(converted.error||'NASA bilimsel FITS dosyası işlenemedi.');
            }
            loaded.push({file:'live_'+(i+1)+'.png',observed_utc:candidate.observed_utc,
              source_fits_cutout_url:sourceUrl,src:converted.png,index:i+1,science:converted.science});
            setSearchProgress({phase:'downloading',current:loaded.length,goal,attempt:0,tried:candidateCount});
            reportStatus('✓ Bilimsel FITS '+loaded.length+'/'+goal+' hazır — %'+Math.round(loaded.length/goal*100)+'. '+
              (converted.from_cache?'Önceki gerçek NASA görüntüsü kalıcı önbellekten':'NASA FITS indirildi, analiz önbelleğine kaydedildi')+
              '. WCS/FLAGS/VARIANCE/ZODI. Gözlem: '+candidate.observed_utc+'.','success');
            success=true;break;
          }catch(error){
            reason=error instanceof Error?error.message:'Bilinmeyen FITS hatası';
            reportStatus('Aday '+candidateCount+' / deneme '+attempt+'/3 başarısız: '+reason,'warning');
            const transient=/HTTP (429|500|502|503|504)|Failed to fetch|NetworkError|timeout|AbortError/i.test(reason);
            if(!transient||attempt===3)break;
            const waitSeconds=/HTTP 429/.test(reason) ? (slowRetry?30:15) : (slowRetry?attempt*6:attempt*3);
            reportStatus('Aynı FITS dosyası için '+waitSeconds+' saniye bekleniyor; sonra deneme '+(attempt+1)+'/3 başlayacak.','retry');
            await pause(waitSeconds*1000);
          }
        }
        if(!success){
          failures.push('Aday '+candidateCount+': '+reason);
          reportStatus('Aday '+candidateCount+' üç denemeden sonra atlandı; aynı koordinatlarda farklı tarihli gözleme geçiliyor.','warning');
        }
      }
      if(loaded.length===0)throw new Error('NASA kataloğu yanıtladı ancak hiçbir FITS görüntüsü alınamadı. '+(failures[0]||''));
      urlsRef.current.forEach(url=>URL.revokeObjectURL(url));urlsRef.current=[];
      const matchingTarget=libraryTargets.find(t=>Math.abs(t.ra_deg-ra)<.00003&&
        Math.abs(t.dec_deg-dec)<.00003&&t.detector===detector);
      const next:Manifest={project:'NASA Space Apps 2026 — Planet X and SPHEREx',
        target_name:matchingTarget?.label_tr||searchedTarget,
        target_id:matchingTarget?.id||'coordinates',ra_deg:ra,dec_deg:dec,detector,
        source:result.catalog_source==='snapshot'
          ? 'NASA/IPAC: kaydedilmiş gerçek katalog indeksi; FITS kontrol edildi'
          : result.catalog_cache_hit?'NASA/IPAC gerçek katalog indeksi: önbellek (24 saat TTL); FITS kontrol edildi'
          : 'NASA/IPAC IRSA SIA2 — canlı koordinat sorgusu',
        frames:loaded.map(({src,science,...other})=>other)};
      setManifest(next);
      setFrames(loaded);
      setIndex(0);
      setCompare(false);
      setActiveTarget(matchingTarget?.id||'custom');
      reflectSelectedTarget(matchingTarget?.id||'custom');
      setSearchSummary({archived:result.available_count,candidates:result.frames.length,tried:candidateCount,
        completed:loaded.length,skipped:failures.length});
      const complete=loaded.length>=goal;
      setSearchProgress({phase:complete?'complete':'partial',current:loaded.length,goal,attempt:0,tried:candidateCount});
      if(complete){
        reportStatus('🏆 TAMAMLANDI — '+loaded.length+'/'+goal+' gerçek SPHEREx görüntüsü hazır'+
          (result.catalog_cache_hit?' (NASA katalog önbelleği / gerçek FITS)':result.catalog_source==='snapshot'?' (NASA katalog indeks yedeği / gerçek FITS)':' (canlı NASA kataloğu / gerçek FITS)')+'. '+candidateCount+
          ' aday denendi'+(failures.length?', '+failures.length+' aday yerine başka tarihli gözlem kullanıldı.':'.'),'success');
        void reloadLibrary();
        setRetryAvailable(false);
        showSuccess('Görüntüler başarıyla yüklendi!',loaded.length+' gerçek SPHEREx karesi oynatıcıda hazır');
      }else{
        reportStatus('KISMİ SONUÇ — '+loaded.length+'/'+goal+' gerçek görüntü hazır. Eksikler için daha yavaş tekrar deneyebilirsiniz.','warning');
        setRetryAvailable(true);
      }
      window.requestAnimationFrame(()=>viewerSectionRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
    }catch(error){
      const reason=error instanceof Error?error.message:'Bilinmeyen hata';
      const readable=/timeout|aborted/i.test(reason)
        ? 'NASA/IPAC isteği zaman aşımına uğradı. '+reason : reason;
      reportStatus(searchedTarget+' için CANLI ARAMA TAMAMLANAMADI. '+readable,'error');
      if(previousFrameCount){
        reportStatus('Önceki '+previousTarget+' veri seti ('+previousFrameCount+
          ' kare) korunuyor; bu aramada başka hedefin görüntüsü kullanılmadı.','info');
      }
      setSearchProgress({...progressRef.current,phase:'error',attempt:0});
      setRetryAvailable(true);
      reportStatus('⚠️ Tekrar Dene düğmesiyle aynı RA/Dec ve dedektörü daha seyrek NASA istekleriyle yeniden deneyebilirsiniz.','warning');
    }finally{
      searchRunningRef.current=false;
      setSearching(false);
    }
  }

  async function loadZip(file: Blob, target: PresetKey | 'custom' = 'custom', showFeedback=true) {
    setBusy(true); setError(''); setPlaying(false);
    try {
      const zip = await JSZip.loadAsync(file);
      const manifestEntry = Object.values(zip.files).find(f => !f.dir && f.name.split('/').pop() === 'images.json');
      if (!manifestEntry) throw new Error('ZIP içinde images.json bulunamadı.');
      const parsed: Manifest = JSON.parse(await manifestEntry.async('string'));
      if (!Array.isArray(parsed.frames) || !parsed.frames.length) throw new Error('images.json içinde görüntü listesi yok.');
      const base = manifestEntry.name.replace(/images\.json$/, '');
      const loaded: LoadedFrame[] = [];
      const pendingUrls: string[] = [];
      try {
        for (const f of parsed.frames) {
          const entry = zip.file(base + f.file) ?? zip.file(f.file) ?? Object.values(zip.files).find(v => !v.dir && v.name.split('/').pop() === f.file);
          if (!entry) throw new Error(f.file + ' ZIP içinde bulunamadı.');
          const bytes = await entry.async('blob');
          const url = URL.createObjectURL(new Blob([bytes], {type:'image/png'}));
          pendingUrls.push(url);
          loaded.push({...f, src:url});
        }
      } catch (e) {
        pendingUrls.forEach(url => URL.revokeObjectURL(url));
        throw e;
      }
      urlsRef.current.forEach(url => URL.revokeObjectURL(url));
      urlsRef.current = pendingUrls;
      setManifest(parsed);
      if(target !== 'custom'){setRaInput(String(parsed.ra_deg));setDecInput(String(parsed.dec_deg));setDetectorInput(parsed.detector);}
      setActiveTarget(target);
      reflectSelectedTarget(target);
      setCompare(false);
      setFrames(loaded.sort((a,b) => a.observed_utc.localeCompare(b.observed_utc)));
      setIndex(0);
      if(showFeedback)showSuccess('Görüntüler başarıyla yüklendi!',loaded.length+' kayıtlı SPHEREx karesi hazır');
    } catch (e) {
      const reason=e instanceof Error ? e.message : 'ZIP dosyası okunamadı.';
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setOperationLogs([]);
      setSearchMessage('');
      setRetryAvailable(false);
      setSearchProgress({phase:'idle',current:0,goal:6,attempt:0,tried:0});
      void loadZip(f, 'custom');
    }
    e.target.value = '';
  }

  async function processScienceFrames(){
    if(scientificProcessing||searching||!frames.length)return;
    setScientificProcessing(true);
    setPlaying(false);
    let completed=0;
    const count=frames.filter(item=>item.source_fits_cutout_url&&!item.science?.psf).length;
    let attempted=0;
    try{
      for(let i=0;i<frames.length;i++){
        const item=frames[i];
        if(!item.source_fits_cutout_url||item.science?.psf?.status==='measured-from-EPSF')continue;
        attempted++;
        const sourceUrl=scienceUrl(item.source_fits_cutout_url);
        setScienceProgressText('Eksik EPSF kontrolü '+attempted+'/'+count+': orijinal NASA FITS yeniden okunuyor…');
        let success=false;
        for(let attempt=1;attempt<=1;attempt++){
          try{
            const res=await fetch('/_api/spherex-science?'+new URLSearchParams({url:sourceUrl,upgrade:'epsf'}).toString());
            const data=await res.json();
            if(!res.ok||!data.science)throw new Error(data.error||'FITS bilimsel katmanları alınamadı');
            setFrames(previous=>previous.map((frame,j)=>j===i
              ? {...frame,src:data.png,science:data.science,source_fits_cutout_url:sourceUrl}
              : frame));
            success=true;
            completed++;
            setScienceProgressText(completed+'/'+count+' gerçek FITS karesi WCS gridine dönüştürüldü.');
            break;
          }catch(err){
            if(attempt===1){
              setScienceProgressText((i+1)+'. kare hazırlanamadı: '+(err instanceof Error?err.message:'Hata')+'. Önceki görüntü korundu.');
            }
          }
        }
        // Space the requests even after success; NASA should never be flooded.
        if(attempted<count)await pause(success?1500:5500);
      }
      setScienceProgressText('EPSF güncellemesi denendi: '+completed+'/'+count+' kare yeniden işlendi. Eksik kalanların önceki gerçek görüntüleri korundu; eksik EPSF raporda gösterilir.');
    }finally{setScientificProcessing(false);}
  }

  const dateText = (raw?: string) => raw ? new Date(raw).toLocaleString(language==='en'?'en-US':'tr-TR', {timeZone:'UTC', day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}) + ' UTC' : '—';

  return (
    <div className={styles.page} data-i18n-root data-i18n-source="tr">
      <title>{language==='tr'?'Çemberlitaş Anadolu Lisesi - SPHEREx Sky Explorer — NASA Space Apps Challenge 2026':'Cemberlitas Anatolian High School - SPHEREx Sky Explorer — NASA Space Apps Challenge 2026'}</title>
      <meta name="description" content={language==='tr'?"Çemberlitaş Anadolu Lisesi Men in Hack takımı, NASA Space Apps Challenge 2026 için SPHEREx Sky Explorer projesini sunar. Gerçek NASA/IPAC gözlemlerini, Barnard Yıldızı'nı ve beş test hedefini keşfedin.":"Men in Hack at Çemberlitaş Anatolian High School presents SPHEREx Sky Explorer for NASA Space Apps Challenge 2026. Explore real NASA/IPAC infrared images, Barnard's Star and five challenge test targets."} />
      <meta name="keywords" content="SPHEREx, SPHEREx Sky Explorer, NASA Space Apps Challenge 2026, Çemberlitaş Anadolu Lisesi, Cemberlitas Anatolian High School, Men in Hack, NASA IPAC IRSA, Planet X, Barnard's Star, Barnard Yıldızı, Epsilon Indi B, WISE 0855-0714, RW Aurigae, R Draconis, M101, M104, M42, infrared astronomy, FITS, sky comparison" />
      <meta name="robots" content="index, follow, max-image-preview:large" />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:locale:alternate" content="tr_TR" />
      <meta property="og:site_name" content="SPHEREx Sky Explorer | Men in Hack" />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="canonical" href="https://www.cemberlitasmeninhack.com/" />
      <link rel="alternate" hrefLang="en" href="https://www.cemberlitasmeninhack.com/" />
      <link rel="alternate" hrefLang="tr" href="https://www.cemberlitasmeninhack.com/tr" />
      <link rel="alternate" hrefLang="x-default" href="https://www.cemberlitasmeninhack.com/" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({
        "@context":"https://schema.org","@type":"WebApplication",
        name:"SPHEREx Sky Explorer",
        alternateName:["Men in Hack NASA Space Apps Challenge 2026","Çemberlitaş Anadolu Lisesi SPHEREx"],
        url:"https://www.cemberlitasmeninhack.com/",
        description:"Bilingual educational astronomy explorer using real NASA/IPAC IRSA SPHEREx FITS observations to inspect sky regions, time series and preliminary infrared comparisons.",
        inLanguage:["en","tr"],applicationCategory:"EducationalApplication",operatingSystem:"Web",
        creator:{"@type":"Organization",name:"Men in Hack",parentOrganization:{"@type":"EducationalOrganization",name:"Çemberlitaş Anadolu Lisesi",alternateName:"Cemberlitas Anatolian High School"}},
        about:["NASA Space Apps Challenge 2026","SPHEREx","Barnard's Star","Epsilon Indi B","WISE 0855−0714","RW Aurigae","R Draconis","M101 Galaxy","FITS"],
        isBasedOn:"https://irsa.ipac.caltech.edu/Missions/spherex.html"
      })}} />
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.brand}><a className={styles.logo} href="https://www.spaceappschallenge.org/" target="_blank" rel="noreferrer" aria-label="NASA Space Apps Challenge 2026 official event logo"><img src="/_cdn/static/fcb4d07b-b716-4a0a-bef9-47b7a0371fa2-space-apps-2026-black-motif.png" alt="NASA Space Apps Challenge 2026" /></a><div className={styles.brandCopy}><strong>SPHEREx <span>Sky Explorer</span></strong><small>NASA SPACE APPS CHALLENGE 2026</small><small className={styles.schoolShowcase} data-no-translate>{language==='en'?'Çemberlitaş Anatolian High School Showcase':'Çemberlitaş Anadolu Lisesi Sunumu'}</small></div></div>
        <div className={styles.headerRight}><span className={styles.status}><span className={styles.dot} />{hasData ? 'GERÇEK SPHEREx VERİSİ YÜKLENDİ' : 'VERİ YÜKLENMESİ BEKLENİYOR'}</span><LanguageSwitcher/><a className={styles.archiveLink} href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noreferrer">NASA Veri Arşivi <ArrowUpRight size={15}/></a></div>
      </header>
      <main className={styles.main}>
        <section className={styles.intro}>
          <div className={styles.introCopy}><div className={styles.kicker}><Telescope size={16}/> ZAMAN İÇİNDE GÖKYÜZÜ KEŞFİ</div><h1>Gökyüzüne bak. <em>Zamandaki değişimi gör.</em></h1><p>NASA SPHEREx teleskobunun gerçek kızılötesi gözlemlerini tarih sırasıyla inceleyin. Aynı gökyüzü bölgesindeki farklı görüntüler arasında gezinin.</p><a href="#science-lab" className={styles.scienceShortcut}><Telescope size={17}/> Bilimsel karşılaştırma laboratuvarına git <ArrowUpRight size={15}/></a></div>
          <InstitutionLinks placement="hero"/>
          <a className={styles.heroPhotoCredit} data-no-translate href="https://science.nasa.gov/asset/hubble/cats-head-nebula-webb-miri-image/" target="_blank" rel="noopener noreferrer" aria-label={language==='en'?'Background photo source: NASA Webb MIRI Cat’s Head Nebula':'Arka plan fotoğrafının kaynağı: NASA Webb MIRI Cat’s Head Nebula'}>{language==='en'?'BACKGROUND · WEBB MIRI / CAT’S HEAD NEBULA':'ARKA PLAN · WEBB MIRI / CAT’S HEAD NEBULA'} <ArrowUpRight size={11}/></a>
        </section>
        <nav className={styles.quickTargets} aria-label={language==='en'?'Quick sky target selection':'Hızlı gökyüzü hedef seçimi'}>
          <div className={styles.quickTargetIntro}>
            <span>{language==='en'?'OBSERVATION TARGETS':'GÖZLEM HEDEFLERİ'}</span>
            <strong>{hasData ? (language==='en'?'Currently viewing: ':'Şu an görüntülenen: ')+targetTitle : language==='en'?'Choose a target':'Bir hedef seçin'}</strong>
          </div>
          <div className={styles.quickTargetGroups}>
            <div className={styles.targetGroup}>
              <div className={styles.targetGroupTitle}><Telescope size={14}/>{language==='en'?'NASA CHALLENGE · SUGGESTED TEST TARGETS':'NASA YARIŞMASI · ÖNERİLEN TEST HEDEFLERİ'}</div>
              <div className={styles.quickTargetButtons}>
                {challengeTargets.map(target=><button key={target.id} type="button"
                  aria-pressed={activeTarget===target.id}
                  className={activeTarget===target.id?styles.quickTargetActive:styles.quickTargetButton}
                  disabled={targetBusy} onClick={()=>{if(activeTarget!==target.id)void selectLibraryTarget(target.id);}}>
                  {language==='en'?target.label_en:target.label_tr}
                  <span>{target.cached_frame_count>0?target.cached_frame_count+' '+(language==='en'?'frames':'kare'):(language==='en'?'Search NASA':'NASA’da ara')}</span>
                </button>)}
              </div>
            </div>
            <div className={styles.targetGroup}>
              <div className={styles.targetGroupTitle}><Layers3 size={14}/>{language==='en'?'ADDITIONAL INFRARED BANDS · SCIENCE PREVIEWS':'EK KIZILÖTESİ BANTLAR · BİLİMSEL ÖN İNCELEME'}</div>
              <div className={styles.quickTargetButtons}>
                {spectralTargets.map(target=><button key={target.id} type="button"
                  aria-pressed={activeTarget===target.id}
                  className={activeTarget===target.id?styles.quickTargetActive:styles.quickTargetButton}
                  disabled={targetBusy} onClick={()=>{if(activeTarget!==target.id)void selectLibraryTarget(target.id);}}>
                  {language==='en'?target.label_en:target.label_tr}
                  <span>{target.cached_frame_count>0?target.cached_frame_count+' '+(language==='en'?'frames':'kare'):(language==='en'?'Search NASA':'NASA’da ara')}</span>
                </button>)}
              </div>
              <p className={styles.catalogCacheNote}>{language==='en'?'D5/D6 are different infrared bands; do not interpret brightness differences between detectors as time variability.':'D5/D6 farklı kızılötesi bantlardır; dedektörler arasındaki parlaklık farkı zamanla değişim olarak yorumlanamaz.'}</p>
            </div>
            <div className={styles.targetGroup}>
              <div className={styles.targetGroupTitle}><Orbit size={14}/>{language==='en'?'FEATURED SKY REGIONS':'ÖRNEK GÖKYÜZÜ BÖLGELERİ'}</div>
              <div className={styles.quickTargetButtons}>
                {exampleTargets.map(target=><button key={target.id} type="button"
                  aria-pressed={activeTarget===target.id}
                  className={activeTarget===target.id?styles.quickTargetActive:styles.quickTargetButton}
                  disabled={targetBusy} onClick={()=>{if(activeTarget!==target.id)void selectLibraryTarget(target.id);}}>
                  {language==='en'?target.label_en:target.label_tr}
                  <span>{target.cached_frame_count>0?target.cached_frame_count+' '+(language==='en'?'frames':'kare'):(language==='en'?'Search NASA':'NASA’da ara')}</span>
                </button>)}
                <button type="button" className={styles.quickTargetAll} aria-controls="quickExtraTargets" aria-expanded={showMoreTargets}
                  onClick={()=>setShowMoreTargets(value=>!value)}>
                  {language==='en'?'All targets':'Tüm hedefler'} <ChevronDown size={17} className={showMoreTargets?styles.chevronOpen:undefined}/>
                </button>
              </div>
              {showMoreTargets && <div className={styles.quickTargetExtras} id="quickExtraTargets">
                {extraTargets.map(target=><button key={target.id} type="button"
                  aria-pressed={activeTarget===target.id}
                  className={activeTarget===target.id?styles.quickTargetActive:styles.quickTargetButton}
                  disabled={targetBusy} onClick={()=>{if(activeTarget!==target.id)void selectLibraryTarget(target.id);}}>
                  {language==='en'?target.label_en:target.label_tr}
                  <span>{target.cached_frame_count>0?target.cached_frame_count+' '+(language==='en'?'frames':'kare'):(language==='en'?'Search NASA':'NASA’da ara')}</span>
                </button>)}
                <button type="button" className={styles.quickTargetButton} disabled={targetBusy} onClick={()=>void selectLibraryTarget('custom')}>
                  {language==='en'?'Custom RA / Dec':'Özel RA / Dec'} <ArrowUpRight size={13}/>
                </button>
              </div>}
            </div>
          </div>
        </nav>
        <section className={styles.workspace}>
          <div className={styles.leftColumn}>
          <div className={styles.skyPanel} ref={viewerSectionRef}>
            <div className={styles.panelTop}><div><span className={styles.eyebrow}>GÖKYÜZÜ GÖZLEM ALANI</span><h2>{manifest ? targetTitle + ' · ' + manifest.detector + (activeTarget==='custom' && recognizableTarget ? ' · Canlı arama' : '') : 'Gözlem görüntüleyici'}</h2></div><span className={styles.frameCount}>{hasData ? (index+1) + ' / ' + frames.length + ' KARE' : '0 KARE'}</span></div>
            <div className={styles.viewer}>
              {hasData && frame ? (
                compare ? <div className={styles.comparison}><div><img src={frames[0].src} alt="İlk SPHEREx gözlemi" /><label>İLK GÖZLEM · {dateText(frames[0].observed_utc)}</label></div><div><img src={frame.src} alt="Seçilen SPHEREx gözlemi"/><label>SEÇİLEN · {dateText(frame.observed_utc)}</label></div></div>
                : <img className={styles.skyImage} src={frame.src} alt={'SPHEREx kızılötesi gökyüzü görüntüsü, ' + dateText(frame.observed_utc)} />
              ) : <div className={styles.empty}><div className={styles.emptyOrb}><Telescope size={54} strokeWidth={1.2}/></div><strong>Gerçek gökyüzü görüntülerini bekliyoruz</strong><p>Google Colab'de oluşturulan <code>SPHEREx_Web_Data_Starter.zip</code> dosyasını yükleyin. Demo amaçlı sahte NASA görüntüsü gösterilmiyor.</p><button className={styles.primaryButton} onClick={() => fileInput.current?.click()}><UploadCloud size={18}/> SPHEREx ZIP Yükle</button></div>}
      {hasData && <div className={styles.imageTag}>NASA/IPAC · {frame?.science?'WCS hizalı · kızılötesi sahte renk · IMAGE−ZODI':'Kızılötesi · önizleme'}</div>}
            </div>
            <div className={styles.player}>
              <div className={styles.playerDates}><span><Clock3 size={14}/> {dateText(frame?.observed_utc)}</span><span>{frames.length} gözlem</span></div>
              <input className={styles.timeline} aria-label="Gözlem zaman çizelgesi" type="range" min={0} max={Math.max(0,frames.length - 1)} value={index} disabled={!hasData} onChange={e => {setPlaying(false);setIndex(Number(e.target.value));}}/>
              <div className={styles.controls}><div className={styles.buttons}><button disabled={!hasData} title="Önceki" onClick={() => {setPlaying(false);setIndex(i=>Math.max(0,i-1));}}><ChevronLeft size={22}/></button><button className={styles.playButton} disabled={frames.length<2 || compare} title={playing?'Durdur':'Oynat'} onClick={()=>setPlaying(p=>!p)}>{playing ? <Pause size={22} fill="currentColor"/> : <Play size={22} fill="currentColor"/>}</button><button disabled={!hasData} title="Sonraki" onClick={() => {setPlaying(false);setIndex(i=>Math.min(frames.length-1,i+1));}}><ChevronRight size={22}/></button></div><div className={styles.options}><label>Hız <select value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={1700}>Yavaş</option><option value={1000}>Normal</option><option value={450}>Hızlı</option></select></label><button className={compare?styles.selectedToggle:styles.toggle} disabled={!hasData} onClick={()=>{setPlaying(false);setCompare(v=>!v);}}><Layers3 size={16}/> Yan yana karşılaştır</button></div></div>
            </div>
          </div>
          <section className={styles.operationConsole} aria-label="SPHEREx işlem günlüğü">
            <div className={styles.consoleHeader}>
              <div className={styles.consoleTitleBlock}>
                <span className={styles.consoleSymbol}><FileText size={21}/></span>
                <div>
                  <span className={styles.consoleEyebrow}>NASA / IPAC · OPERASYON MERKEZİ</span>
                  <h3>Canlı İşlem Günlüğü</h3>
                </div>
              </div>
              <div className={styles.consoleActions}>
                <span className={styles.consoleLive}><span className={styles.consoleDot}/> {searching?'NASA ARAMASI SÜRÜYOR':progress.phase==='complete'?'TAMAMLANDI':progress.phase==='error'?'CANLI ARAMA HATASI':progress.phase==='partial'?'KISMİ SONUÇ':'ARAMA BEKLENİYOR'}</span>
                <button type="button" className={styles.logExport} disabled={operationLogs.length===0} onClick={exportLogs} title="İşlem günlüğünü TXT olarak indir"><Download size={15}/> Kaydı indir</button>
              </div>
            </div>
            {preparedLog&&<SafeExportActions prepared={preparedLog} language={language}/>}
            <div className={styles.consoleProgress}>
              <div className={styles.progressBlock}>
                <div className={styles.progressLabel}><span>Bu aramada hazırlanan görüntüler</span><strong>{progress.current}/{progress.goal} · %{Math.round((progress.current/Math.max(1,progress.goal))*100)}</strong></div>
                <div className={styles.progressTrack} role="progressbar" aria-label="Hazırlanan görüntüler" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.current/Math.max(1,progress.goal)*100)}>
                  <span className={styles.progressFill} style={{width:Math.min(100,progress.current/Math.max(1,progress.goal)*100)+'%'}}/>
                  {searching && progress.phase==='querying' && <span className={styles.progressIndeterminate}/>}
                </div>
              </div>
              <div className={styles.progressBlock}>
                <div className={styles.progressLabel}><span>Aktif FITS dosyası · deneme</span><strong>{progress.attempt ? progress.attempt+'/3 · %'+Math.floor(progress.attempt/3*100) : 'Beklemede'}</strong></div>
                <div className={styles.progressTrack} role="progressbar" aria-label="Aktif indirme denemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress.attempt/3*100)}>
                  <span className={styles.retryFill} style={{width:Math.floor(progress.attempt/3*100)+'%'}}/>
                </div>
              </div>
              <span className={styles.progressHint}>{searching?'İşlem devam ediyor · '+elapsedSeconds+' saniye geçti · ':'Yalnızca son canlı NASA aramasının sonuçları · '}İkinci çubuk indirilen bayt oranını değil, aynı FITS dosyasına ait deneme sayısını gösterir.</span>
            </div>
            <div className={styles.logSectionHeading}>
              <span><Clock3 size={14}/> ZAMAN DAMGALI İŞLEMLER</span>
              <span>{operationLogs.length} satır · yalnızca mevcut arama</span>
            </div>
            <div className={styles.logList} ref={logScrollRef} role="log" aria-label="Görüntü işleme geçmişi" aria-live="off">
              {operationLogs.length===0 ? <div className={styles.logEmpty}><FileText size={36} strokeWidth={1.25} aria-hidden="true"/><strong>{language==='en'?'Ready to record the next NASA search':'Yeni NASA aramasını kaydetmeye hazır'}</strong><p>Bu panel eski aramaların geçmişi değildir. Sağdaki “NASA’da Ara” düğmesine bastığınızda sağdaki her yeni durum mesajı tarih ve saatle burada ayrı satır olarak belirecek.</p></div>
               : operationLogs.map(entry => <div className={styles.logLine} data-level={entry.level} key={entry.id}>
                  <div className={styles.logIcon}>
                    {entry.level==='success'? <CheckCircle2 size={16}/> : entry.level==='retry'? <RotateCcw size={16}/> : entry.level==='warning'? <AlertTriangle size={16}/> : entry.level==='error'? <AlertTriangle size={16}/> : <Info size={16}/>}
                  </div>
                  <div className={styles.logText}>
                    <strong>{liveText(entry.message)}</strong>
                    {entry.detail && <span>{liveText(entry.detail)}</span>}
                  </div>
                  <time className={styles.logTime} dateTime={entry.timestamp} title={new Date(entry.timestamp).toLocaleString('tr-TR')}>
                    {new Date(entry.timestamp).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                  </time>
                </div>)}
            </div>
            {progress.phase==='complete' && <div className={styles.completionBar}><span className={styles.trophy}>🏆</span><div><strong>İşlem başarıyla tamamlandı</strong><small>{progress.current} gerçek görüntü hazır · ayrıntılar yukarıda kayıtlı</small></div><CheckCircle2 size={23}/></div>}
            {progress.phase==='error' && hasData && <div className={styles.partialBar}><Info size={19}/> Canlı arama başarısız; önceden yüklenen {targetTitle} görüntüleri ({frames.length} kare) oynatıcıda kullanılabilir. Bu işlemde başka hedefin görüntüsü eklenmedi.</div>}
            {progress.phase==='partial' && <div className={styles.partialBar}><AlertTriangle size={18}/> Kısmi sonuç: erişilebilen {progress.current}/{progress.goal} görüntü hazır.</div>}
          </section>
          </div>
          <aside className={styles.side}>
            <div className={styles.sideCard}>
              <span className={styles.eyebrow}>GÖZLEM HEDEFİ · SPHEREx KATALOĞU</span>
              <h3>{targetTitle}</h3>
              <label className={styles.targetLabel} htmlFor="targetSelect">
                <span>{language==='en'?'Select target':'Hedef seç'}</span>
                <span className={styles.targetLabelCount}>{libraryTargets.length} {language==='en'?'target/band entries':'hedef/bant kaydı'} <ChevronDown size={15}/></span>
              </label>
              <div className={styles.targetSelectWrap}>
              <select className={styles.targetSelect} id="targetSelect" aria-label={language==='en'?'Select observation target':'Gözlem hedefi seçimi'}
                value={activeTarget} disabled={busy || searching || scientificProcessing}
                onChange={e=>{if(e.target.value!==activeTarget)void selectLibraryTarget(e.target.value)}}>
                <optgroup label={language==='en'?'NASA challenge · suggested test targets':'NASA yarışması · önerilen test hedefleri'}>
                  {libraryTargets.filter(target=>['barnard','eps-indi-b','wise-0855','rw-aur','r-dra'].includes(target.id)).map(target=><option key={target.id} value={target.id}>
                    {language==='en'?target.label_en:target.label_tr} · {target.cached_frame_count>0?target.cached_frame_count+(language==='en'?' cached':' önbellekte'):(language==='en'?'archive search needed':'arşiv araması gerekli')}
                  </option>)}
                </optgroup>
                <optgroup label={language==='en'?'Additional infrared bands (D5 / D6)':'Ek kızılötesi bantlar (D5 / D6)'}>
                  {spectralTargets.map(target=><option key={target.id} value={target.id}>
                    {language==='en'?target.label_en:target.label_tr} · {target.cached_frame_count>0?target.cached_frame_count+(language==='en'?' cached':' önbellekte'):(language==='en'?'archive search needed':'arşiv araması gerekli')}
                  </option>)}
                </optgroup>
                <optgroup label={language==='en'?'Other verified sky regions':'Diğer kayıtlı gökyüzü bölgeleri'}>
                  {extraTargets.concat(exampleTargets).map(target=><option key={target.id} value={target.id}>
                    {language==='en'?target.label_en:target.label_tr} · {target.cached_frame_count>0?target.cached_frame_count+(language==='en'?' cached':' önbellekte'):target.bundled_zip?(language==='en'?'ready ZIP':'hazır ZIP'):(language==='en'?'NASA catalog search':'NASA katalog sorgusu')}
                  </option>)}
                </optgroup>
                <option value="custom">{language==='en'?'Custom sky region · enter RA / Dec':'Başka bir bölge · RA/Dec koordinatlarını kendim gireceğim'}</option>
              </select>
              <ChevronDown size={20} className={styles.targetSelectChevron} aria-hidden="true"/>
              </div>
              <p className={styles.targetSelectHint}>{language==='en'?'Tap the field or downward arrow to explore all targets.':'Tüm hedefleri görmek için kutuya veya aşağı oka dokunun.'}</p>
              <p className={styles.catalogCacheNote}>{language==='en'?'Five suggested challenge test objects are listed above, with additional D5/D6 detector views. Cached frame counts are shown per band. Matching dates and wavelengths enable preliminary comparisons, not confirmed motion or discoveries.':'Yarışmada örnek verilen beş test nesnesi ve ek D5/D6 dedektör görüntüleri yukarıda listelenir. Kare sayıları bant başınadır. Tarih ve dalga boyu uyumlu görüntüler ön karşılaştırmaya elverişlidir; doğrulanmış hareket veya keşif değildir.'}</p>
              <p className={styles.catalogHelper} role="status">{liveText(libraryStatus||'Seçilen isim bir gökyüzü koordinatıdır; NASA görüntü sayısı hedefe göre değişebilir.')}</p>
              {activeCatalogRecord&&<div className={styles.catalogMetrics}>
                <span><b>{activeCatalogRecord.cached_frame_count}</b> bilimsel kare saklı</span>
                <span><b>{activeCatalogRecord.available_count??'—'}</b> {language==='en'?'latest NASA SIA2 index matches':'son NASA SIA2 indeks eşleşmesi'}</span>
                <span>Son arşiv kontrolü: <b>{activeCatalogRecord.last_checked_at?dateText(activeCatalogRecord.last_checked_at):'Henüz yok'}</b></span>
              </div>}
              {activeCatalogRecord&&activeCatalogRecord.available_count===0&&activeCatalogRecord.cached_frame_count>0&&
                <p className={styles.catalogCacheNote} role="note">{language==='en'
                  ?'The latest SIA2 catalogue query returned zero matches, while previously verified NASA FITS frames remain preserved in the science archive. These are different checks: zero SIA2 results do not imply that previously archived detector images are synthetic or missing. Inspect the original FITS source links for provenance.'
                  :'Son SIA2 katalog sorgusunda sıfır eşleşme görülürken daha önce doğrulanmış NASA FITS kareleri bilimsel arşivde korunmaktadır. Bunlar farklı kontrollerdir: SIA2 sonucunun sıfır olması, daha önce arşivlenmiş dedektör görüntülerinin yapay veya eksik olduğunu göstermez. Veri kökeni için orijinal FITS kaynak bağlantıları incelenebilir.'}</p>}
              <p className={styles.catalogCacheNote}>NASA gözlem indeksi 24 saat önbellekte tutulur. Süresi dolan indeks, hedef yeniden açıldığında otomatik sorgulanır. Gerçek FITS görüntüleri korunur. Siteyi kimse açmıyorsa sunucuya gereksiz istek gönderilmez.</p>
              <span className={styles.eyebrow}>GÖZLEM AYARLARI</span><h3>Seçili bölge</h3>
              <div className={styles.coords}><div><span>RIGHT ASCENSION</span><strong>{manifest ? manifest.ra_deg.toFixed(5)+'°' : '—'}</strong></div><div><span>DECLINATION</span><strong>{manifest ? manifest.dec_deg.toFixed(5)+'°' : '—'}</strong></div></div>
              <div className={styles.metaRow}><span>Hedef</span><b>{manifest ? targetTitle : '—'}</b></div>
              <div className={styles.metaRow}><span>Dedektör</span><b>{manifest?.detector ?? '—'}</b></div>
              <div className={styles.metaRow}><span>Gözlem sayısı</span><b>{frames.length}</b></div>
              <div className={styles.metaRow}><span>Veri kaynağı</span><b>{liveText(manifest?.source || 'NASA/IPAC IRSA')}</b></div>
            </div>
            <div className={styles.sideCard}>
              <span className={styles.eyebrow}>CANLI NASA ARŞİV ARAMASI</span>
              <h3>Koordinatla keşfet</h3>
              <p>RA = gökyüzündeki sağ açıklık, Dec = dik açıklık (enlem benzeri açı). Bir hedefi listeden seçtiğinizde koordinatlar otomatik doldurulur. Başka bir alanı araştırmak için dereceleri kendiniz girebilirsiniz.</p>
              <form className={styles.skySearchForm} onSubmit={searchSky}>
                <div className={styles.skySearchPair}>
                  <label>RA (0–360°)<input inputMode="decimal" value={raInput} onChange={e=>setRaInput(e.target.value)} disabled={searching} placeholder="210.80227" /></label>
                  <label>Dec (−90° / +90°)<input inputMode="decimal" value={decInput} onChange={e=>setDecInput(e.target.value)} disabled={searching} placeholder="54.34895" /></label>
                </div>
                <label>SPHEREx dedektörü
                  <select value={detectorInput} onChange={e=>setDetectorInput(e.target.value)} disabled={searching}>
                    {['SPHEREx-D1','SPHEREx-D2','SPHEREx-D3','SPHEREx-D4','SPHEREx-D5','SPHEREx-D6'].map(item=><option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <button type="submit" className={styles.uploadButton} disabled={searching || busy || scientificProcessing}>
                  <Telescope size={17}/>{searching?'NASA verileri işleniyor…':'NASA’da Ara'}
                </button>
              </form>
              {retryAvailable && !searching && (progress.phase==='error'||progress.phase==='partial') && <div className={styles.retryPanel}>
                <div className={styles.retryWarning}><AlertTriangle size={28} color="#222437" fill="#f7cc5d" strokeWidth={2.4}/><div><strong>NASA bağlantısı tamamlanamadı</strong><span>{lastSearchRef.current?.target || 'Seçili koordinatlar'} · Aynı hedef korunacak</span></div></div>
                <button type="button" className={styles.slowRetryButton} disabled={busy} onClick={()=>void searchSky(null,true)}><RotateCcw size={18}/> Tekrar Dene <small>Yavaş mod</small></button>
                <p className={styles.retryExplanation}>Yeni deneme mevcut işlem günlüğünü temizler. Aynı koordinatları korur ve istekler arasında daha uzun süre bekler.</p>
              </div>}
              {searchMessage && <div className={styles.searchMessage} role="status" aria-live="polite">
                {searching ? <LoaderCircle className={styles.searchSpinner} size={19} aria-hidden="true"/> : searchMessage.startsWith('✓') ? <CheckCircle2 size={19} aria-hidden="true"/> : <Info size={19} aria-hidden="true"/>}
                <span>{liveText(searchMessage)}</span>
              </div>}
              {searchSummary && !searching && <div className={styles.searchCounts}>
                <span><b>{searchSummary.archived}</b> arşiv kaydı</span>
                <span><b>{searchSummary.tried}</b> aday denendi</span>
                <span><b>{searchSummary.completed}</b> görüntü hazır</span>
                <span><b>{searchSummary.skipped}</b> erişilemeyen aday</span>
              </div>}
              <p className={styles.searchCaution}>Arama aynı RA/Dec bölgesini ve seçili dedektörü kullanır. Başka tarihten gözlem seçilmesi aynı cisim olduğu anlamına gelmez; aynı dedektör aynı dalga boyunu da garanti etmez. FITS karelerinin kontrastı ayrı ayarlanır; bu, hassas astrometrik hareket ölçümü değildir.</p>
            </div>
            <div className={styles.sideCard}><span className={styles.eyebrow}>VERİ YÜKLE</span><h3>Colab çıktısı</h3><p>Google Colab'den indirilen ZIP paketini seçin. Görüntüler bu tarayıcı oturumunda açılır.</p><input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={onFileChange}/><button className={styles.uploadButton} disabled={busy || searching || scientificProcessing} onClick={()=>fileInput.current?.click()}><UploadCloud size={17}/>{busy?'Dosya işleniyor…':'ZIP paketini aç'}</button>{error && <p className={styles.error}>{liveText(error)}</p>}</div>
            <div className={styles.note}><Info size={17}/><p>Görüntüler araştırma amaçlı önizlemedir. Farklı dalga boyları ve gözlem koşulları değişim izlenimi yaratabilir; tek başına yeni gezegen keşfini kanıtlamaz.</p></div>
          </aside>
        </section>
        <ScienceLab frames={frames} target={targetTitle} loading={searching||busy} processing={scientificProcessing} onProcess={()=>void processScienceFrames()} cutoutSize={cutoutSize} onCutoutChange={setCutoutSize}/>
        {scienceProgressText&&<p className={styles.scienceProgressNote} role="status">{liveText(scienceProgressText)}</p>}
        <ScienceReport frames={frames} target={targetTitle}
          targetId={activeTarget==='custom'?null:activeTarget} processing={searching||scientificProcessing}/>
        {hasData && <section className={styles.sourceBar}><Globe2 size={18}/><span>Seçili gözlem: {dateText(frame?.observed_utc)}</span>{frame?.source_fits_cutout_url && <a href={frame.source_fits_cutout_url} target="_blank" rel="noreferrer">Orijinal NASA FITS dosyası <ArrowUpRight size={14}/></a>}</section>}
      </main>
      {successToast && <div className={styles.successOverlay} role="status" aria-live="polite" aria-label="Görüntü yükleme tamamlandı">
        <div className={styles.successDialog}>
          <div className={styles.successOrbit}><CheckCircle2 size={47} strokeWidth={1.7}/></div>
          <span className={styles.successKicker}>SPHEREx · VERİ ALIMI TAMAMLANDI</span>
          <h2>{liveText(successToast.title)}</h2>
          <p>{liveText(successToast.subtitle)}</p>
          <div className={styles.countdownRow}><span>Görüntüleyiciye odaklanılıyor</span><span className={styles.countdownNumber}>{successToast.remaining}</span></div>
          <div className={styles.countdownTrack}><span key={successToast.remaining} className={styles.countdownFill}/></div>
        </div>
      </div>}
      <InstitutionLinks placement="footer"/>
      <footer className={styles.footer}>NASA Space Apps Challenge 2026 · SPHEREx Sky Explorer · <a className={styles.schoolLink} data-no-translate href="https://cemberlitasanadolu.meb.k12.tr/" target="_blank" rel="noopener noreferrer" aria-label={language==='en'?'Open Çemberlitaş Anatolian High School official website':'Çemberlitaş Anadolu Lisesi resmî web sitesini aç'}>{language==='en'?'Çemberlitaş Anatolian High School':'Çembertaş Anadolu Lisesi'}</a> Men in Hack Team · Veriler: NASA/IPAC Infrared Science Archive</footer>
    </div>
  );
}