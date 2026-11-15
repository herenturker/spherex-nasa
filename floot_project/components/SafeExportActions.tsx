import React,{useEffect,useState} from 'react';
import {Download,Eye,Share2,X} from 'lucide-react';
import type {PreparedExport} from '../helpers/startFileExport';
import styles from './SafeExportActions.module.css';

type Props={prepared:PreparedExport;language:'en'|'tr';isImage?:boolean};
/** Preview stays in this React page. Never navigate to a blob: or JSON URL. */
export default function SafeExportActions({prepared,language,isImage=false}:Props){
  const [visible,setVisible]=useState(false);
  const [problem,setProblem]=useState('');
  useEffect(()=>{setVisible(false);setProblem('')},[prepared.url]);
  useEffect(()=>{
    if(!visible)return;
    const handler=(event:KeyboardEvent)=>{if(event.key==='Escape')setVisible(false)};
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  },[visible]);
  function saveFile(){
    const appleTouch=/iPad|iPhone|iPod/i.test(navigator.userAgent)||
      (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    if(appleTouch&&typeof navigator.share==='function'&&
      (typeof navigator.canShare!=='function'||navigator.canShare({files:[prepared.file]}))){
      void navigator.share({files:[prepared.file],title:prepared.name}).catch((error:unknown)=>{
        if(error instanceof Error&&error.name==='AbortError')return;
        setProblem(language==='en'?'Use the direct save link below.':'Aşağıdaki doğrudan kaydetme bağlantısını kullanın.');
      });
      return;
    }
    const a=document.createElement('a');
    a.href=prepared.url;a.download=prepared.name;
    // Safari may offer View instead of downloading a file. If it follows
    // the blob URL, keep the user's observing session in its original tab.
    a.target='_blank';a.rel='noopener noreferrer';
    document.body.appendChild(a);a.click();a.remove();
  }
  const text=prepared.contents||'';
  return <>
    <div className={styles.actions} data-no-translate>
      <strong>{prepared.name}</strong>
      <button type="button" onClick={()=>setVisible(true)}><Eye size={16}/>{language==='en'?'Preview here':'Burada görüntüle'}</button>
      <button type="button" onClick={saveFile}><Share2 size={16}/>{language==='en'?'Save / Share file':'Dosyalara kaydet / Paylaş'}</button>
      <a href={prepared.url} download={prepared.name} target="_blank" rel="noopener noreferrer" onClick={()=>setProblem('')}><Download size={16}/>{language==='en'?'Direct download':'Doğrudan indir'}</a>
      {problem&&<small role="alert">{problem}</small>}
      <small>{language==='en'?'The preview stays on this page; your sky target and selected observations will not change.':'Önizleme bu sayfada kalır; seçili yıldız ve gözlem çifti değişmez.'}</small>
    </div>
    {visible&&<div className={styles.overlay} role="presentation">
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={prepared.name} data-no-translate>
        <header><strong>{prepared.name}</strong><button type="button" aria-label={language==='en'?'Close preview':'Önizlemeyi kapat'} onClick={()=>setVisible(false)}><X size={20}/></button></header>
        {isImage?<img src={prepared.url} alt={prepared.name} className={styles.image}/>:
          <pre className={styles.contents}>{text.slice(0,30000)}</pre>}
        {!isImage&&text.length>30000&&<p>{language==='en'?'Showing first 30,000 characters. Save the file to see all rows.':'İlk 30.000 karakter gösteriliyor. Tam içerik için dosyayı kaydedin.'}</p>}
        <footer><button type="button" onClick={saveFile}><Download size={16}/>{language==='en'?'Save file':'Dosyayı kaydet'}</button><button type="button" onClick={()=>setVisible(false)}>{language==='en'?'Return to sky explorer':'Gökyüzü keşfine dön'}</button></footer>
      </div>
    </div>}
  </>;
}