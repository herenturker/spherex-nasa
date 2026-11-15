import React from 'react';
import {useLanguage} from '../helpers/i18n';
import styles from './LanguageSwitcher.module.css';
export default function LanguageSwitcher(){
  const {language,setLanguage}=useLanguage();
  return <div className={styles.root} role="group" aria-label={language==='en'?'Language selection':'Dil seçimi'} data-no-translate>
    <span className={styles.caption}>{language==='en'?'Language':'Dil'}</span>
    <button type="button" className={language==='en'?styles.active:styles.inactive}
      aria-label="English" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>
      <span className={styles.flag} aria-hidden="true">🇺🇸</span><span>English</span>
    </button>
    <button type="button" className={language==='tr'?styles.active:styles.inactive}
      aria-label="Türkçe" aria-pressed={language==='tr'} onClick={()=>setLanguage('tr')}>
      <span className={styles.flag} aria-hidden="true">🇹🇷</span><span>Türkçe</span>
    </button>
  </div>;
}