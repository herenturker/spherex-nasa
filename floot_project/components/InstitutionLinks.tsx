import React from 'react';
import {useLanguage} from '../helpers/i18n';
import styles from './InstitutionLinks.module.css';

/**
 * Research and competition links. The event mark is sourced from the official
 * NASA Space Apps 2026 brand kit. NASA's separately controlled insignia is not
 * used to imply that this independent student application is agency-sponsored.
 */
export default function InstitutionLinks({placement}:{placement:'hero'|'footer'}){
  const {language}=useLanguage();
  return <nav className={placement==='hero'?styles.hero:styles.footer} aria-label={language==='en'?'Competition and NASA links':'Yarışma ve NASA bağlantıları'} data-no-translate>
    <a className={styles.logoTile} href="https://www.spaceappschallenge.org/" target="_blank" rel="noopener noreferrer"
      aria-label={language==='en'?'NASA Space Apps Challenge homepage':'NASA Space Apps Challenge ana sayfası'}
      title="NASA Space Apps Challenge">
      <img src="/_cdn/static/fcb4d07b-b716-4a0a-bef9-47b7a0371fa2-space-apps-2026-black-motif.png"
        alt="NASA Space Apps Challenge 2026" loading={placement==='footer'?'lazy':'eager'}/>
    </a>
    <a className={styles.nasaTile} href="https://www.nasa.gov/" target="_blank" rel="noopener noreferrer"
      aria-label={language==='en'?'NASA official homepage':'NASA resmî ana sayfası'}
      title={language==='en'?'NASA official website':'NASA resmî sitesi'}>
      <span className={styles.nasaText}>NASA</span>
      <span className={styles.nasaSub}>{language==='en'?'OFFICIAL SITE':'RESMÎ SİTE'}</span>
    </a>
  </nav>;
}