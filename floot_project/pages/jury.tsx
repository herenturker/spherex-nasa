import React,{useEffect,useState} from 'react';
import {ArrowLeft,ArrowUpRight,CheckCircle2,AlertTriangle,Telescope,ScanSearch,Layers3,ShieldCheck,Database} from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import {useLanguage} from '../helpers/i18n';
import styles from './jury.module.css';

type ScientificTarget={id:string;label_en:string;label_tr?:string;object_type:string;
  cached_frame_count:number;available_count:number|null;last_checked_at:string|null};
const categories:Record<string,string>={'Galaksi':'Galaxy','Yıldız':'Star',
  'Yıldız Kümesi':'Star cluster','Bulutsu':'Nebula'};

export default function JuryPage(){
  const {language}=useLanguage();
  const [targets,setTargets]=useState<ScientificTarget[]>([]);
  const [verification,setVerification]=useState<{passed:number;total:number;synthetic_only:boolean}|null>(null);
  useEffect(()=>{
    let active=true;
    fetch('/_api/spherex-targets').then(r=>r.json()).then(data=>{
      if(active&&Array.isArray(data.targets))setTargets(data.targets);
    }).catch(()=>{});
    return()=>{active=false};
  },[]);
  useEffect(()=>{
    let active=true;
    fetch('/_api/spherex-self-test',{cache:'no-store'}).then(r=>r.json()).then(data=>{
      if(active&&typeof data.passed==='number'&&typeof data.total==='number')setVerification(data);
    }).catch(()=>{});
    return()=>{active=false};
  },[]);
  const totalFrames=targets.reduce((sum,item)=>sum+item.cached_frame_count,0);
  const challengeIds=['barnard','eps-indi-b','wise-0855','rw-aur','r-dra'];
  const additionalBandIds=['eps-indi-b-d6','wise-0855-d5','wise-0855-d6'];
  const challengeEntries=challengeIds.map(id=>targets.find(t=>t.id===id)).filter((t):t is ScientificTarget=>Boolean(t));
  const additionalBandEntries=additionalBandIds.map(id=>targets.find(t=>t.id===id)).filter((t):t is ScientificTarget=>Boolean(t));
  return <main className={styles.page} data-i18n-root data-i18n-source="en">
    <title>Scientific Methods and Test Targets | SPHEREx Sky Explorer — Men in Hack</title>
    <meta name="description" content="Review the Men in Hack SPHEREx Sky Explorer scientific method: real NASA/IPAC FITS images, five NASA Space Apps Challenge 2026 test targets, WCS alignment, infrared bands and transparent limitations." />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="https://www.cemberlitasmeninhack.com/jury" />
    <div className={styles.glow}/>
    <header className={styles.header}>
      <div><span className={styles.label}>NASA SPACE APPS CHALLENGE 2026 · PLANET X AND SPHEREx</span>
        <h1>SPHEREx <span>Sky Explorer</span></h1>
        <p>An accessible scientific sky-imaging explorer, built from authentic NASA/IPAC infrared observations.</p>
      </div>
      <div className={styles.headerActions}><LanguageSwitcher/><a href="/"><ArrowLeft size={16}/> Open interactive explorer</a></div>
    </header>
    <section className={styles.hero}>
      <div><span className={styles.label}>PROJECT OVERVIEW · SCIENTIFIC EXPLORATION</span>
        <h2>Watch the sky change. Understand what the data can—and cannot—tell us.</h2>
        <p>Select an astronomical target, explore SPHEREx observations in time order, and examine them in a transparent wavelength-aware comparison laboratory. The underlying data remain real NASA measurements. Scientific uncertainty is part of the experience rather than hidden behind compelling animations.</p>
        <a className={styles.launch} href="/#science-lab">Explore the scientific lab <ArrowUpRight size={16}/></a>
      </div>
    </section>
    <section className={styles.archive}>
      <div className={styles.archiveHead}>
        <div><span className={styles.label}>LIVE VERIFIED PROTOTYPE ARCHIVE</span>
          <h2>A curated atlas of NASA observations</h2>
          <p>Target coordinates, genuine IRSA FITS data and reproducible numerical reports.</p>
        </div>
        <div className={styles.archiveStats}>
          <div><strong>{targets.length||'—'}</strong><span>target / detector entries</span></div>
          <div><strong>{targets.length?totalFrames:'—'}</strong><span>processed FITS cutouts</span></div>
        </div>
      </div>
      <div className={styles.atlasGrid}>
        {targets.map(target=><div className={styles.atlasTarget} key={target.id}>
          <span>{categories[target.object_type]||target.object_type}</span>
          <strong>{language==='tr'&&target.label_tr?target.label_tr:target.label_en}</strong>
          <small>{target.cached_frame_count} prepared frames · {target.available_count??'—'} archive records</small>
        </div>)}
      </div>
      <p className={styles.archiveFoot}><Database size={15}/> Dedicated Floot PostgreSQL archive · 24-hour catalog revalidation on target access · Original FITS data remain at NASA/IPAC.</p>
    </section>
    <section className={styles.archive}>
      <div className={styles.archiveHead}>
        <div><span className={styles.label}>CHALLENGE EXAMPLE COVERAGE · TRANSPARENT VALIDATION</span>
          <h2>Five reference objects, plus additional infrared bands</h2>
          <p>The five suggested test objects are distinct from the additional detector views. A prepared FITS frame demonstrates data retrieval, not an independently verified detection.</p>
        </div>
      </div>
      <div className={styles.atlasGrid}>
        {challengeEntries.map(t=><div className={styles.atlasTarget} key={t.id}>
          <span>{t.cached_frame_count>=2?'PREPARED FOR PRELIMINARY COMPARISON':'MORE OBSERVATIONS NEEDED'}</span>
          <strong>{t.label_en}</strong>
          <small>SPHEREx-D2 · {t.cached_frame_count} genuine FITS-derived frames</small>
        </div>)}
        {additionalBandEntries.map(t=><div className={styles.atlasTarget} key={t.id}>
          <span>ADDITIONAL SPECTRAL COVERAGE</span>
          <strong>{t.label_en}</strong>
          <small>{t.id.endsWith('-d5')?'SPHEREx-D5':'SPHEREx-D6'} · {t.cached_frame_count} genuine FITS-derived frames</small>
        </div>)}
      </div>
      <p className={styles.archiveFoot}>A 14-day observation gap and overlapping infrared wavelengths are checked in the scientific report. A date gap alone does not confirm motion; proper-motion fitting, calibration and independent validation remain future work.</p>
    </section>
    <div className={styles.grid}>
      <article><Telescope size={24}/><h3>01 · Retrieve real observations</h3>
        <p>Choose one of the curated sky targets or enter right ascension, declination, and the detector. Query NASA/IPAC SIA2 to retrieve real observations. Reuse checksum-tracked processed FITS cutouts from the persistent project cache, reducing repeated requests to NASA servers.</p>
      </article>
      <article><Layers3 size={24}/><h3>02 · Align the sky, not the camera frame</h3>
        <p>Read Level 2 FITS cutouts and use TAN-SIP celestial WCS transforms to resample each observation onto a common north-up, east-left grid. False-colour infrared visualizations enhance readability; image interpolation is never confused with new telescope resolution.</p>
      </article>
      <article><ScanSearch size={24}/><h3>03 · Compare measured brightness</h3>
        <p>Read IMAGE, FLAGS, VARIANCE and ZODI. Estimate passband overlap from the WCS-WAVE table. Compare approximately compatible observations with a preliminary difference map, an interactive before/after blend, and a per-frame numerical research report.</p>
      </article>
      <article><ShieldCheck size={24}/><h3>04 · Preserve scientific integrity</h3>
        <p>Photometric calibration, mismatched wavelengths, PSFs and noise can imitate astrophysical change. Incompatible samples are excluded from the difference view; results are labeled exploratory, not verified proper motion, exoplanet detection or precision photometry.</p>
      </article>
    </div>
    <section className={styles.how}><span className={styles.label}>A SIMPLE DEMONSTRATION</span>
      <h2>How to explore</h2><ol>
        <li>Open the interactive explorer and select any catalogued target. Previously processed real images appear immediately.</li>
        <li>Press <strong>{language==='en'?'Search NASA':'NASA’da Ara'}</strong> for a new archive search; follow each step in the live processing log.</li>
        <li>Use <strong>Play</strong> or the timeline slider to blink through dated observations.</li>
        <li>Open <strong>{language==='en'?'Sky Change Laboratory':'Gökyüzü Değişim Laboratuvarı'}</strong> and select two observations for the wavelength-controlled difference or blend.</li>
        <li>Read <strong>{language==='en'?'Scientific Analysis and Results':'Bilimsel Analiz ve Sonuçlar'}</strong> for per-frame quality indicators, matched passbands and an openly qualified research summary; export Markdown/JSON evidence.</li>
      </ol>
    </section>
    <section className={styles.caution}><AlertTriangle size={26}/>
      <div><h2>Scientific scope and limits</h2>
        <p>Spatial alignment uses TAN-SIP WCS with nearest-neighbour resampling on a common 96×96 sky grid. A 0.2° FITS cutout is often about 117×117 native pixels, while the 576×576 preview is interpolated solely for visibility. WCS-WAVE provides approximate passband wavelengths; CWAVE/CBAND, full spatially dependent PSF matching and independently validated significance remain future work. SPHEREx maps 102 nominal channels, but this prototype does not ingest the full all-sky spectral cube or assert a new astrophysical discovery.</p>
        <p>Our enhanced research-preview pipeline reads local effective point-spread function (ePSF) information from genuine DR1/QR3 FITS tables, estimates the PSF width, and conditionally applies approximate isotropic width matching for compatible sky frames. Centre-aperture photometry with background subtraction and an empirical anomaly screen support investigation, but neither replaces official SPHEREx spectrophotometry or statistically confirmed moving-object detection.</p>
        {verification&&<p className={styles.verifiedTests}><CheckCircle2 size={16}/> Synthetic software-control tests: {verification.passed}/{verification.total} passed. These check algorithm consistency on simulated controls, <strong>not</strong> real astrophysical discovery accuracy.</p>}
      </div>
    </section>
    <section className={styles.sources}>
      <span className={styles.label}>REPRODUCIBILITY AND SCIENTIFIC SOURCES</span>
      <h2>NASA sources and attributions</h2>
      <p>Scientific imagery and metadata originate from NASA/IPAC IRSA SPHEREx DR1/QR3 public products. DR1 spectral images: <strong>DOI 10.26131/IRSA678</strong>. The persistent cache contains processed images, preserved numeric arrays, provenance links and source-file checksums; original full FITS products remain on the NASA archive.</p>
      <p>Scientific summaries are produced from stored measurements using documented numerical methods. Their interpretations remain preliminary and should be validated before making astronomical discovery claims.</p>
      <div className={styles.links}>
        <a href="https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_dr1.html" target="_blank" rel="noreferrer">NASA SPHEREx DR1 <ArrowUpRight size={13}/></a>
        <a href="https://irsa.ipac.caltech.edu/spherex-archive-documentation/spherex-data-products/" target="_blank" rel="noreferrer">FITS data products <ArrowUpRight size={13}/></a>
        <a href="https://irsa.ipac.caltech.edu/spherex-archive-documentation/spherex-data-access/" target="_blank" rel="noreferrer">IRSA/SIA2 data access <ArrowUpRight size={13}/></a>
      </div>
    </section>
    <footer><CheckCircle2 size={17}/> Open scientific exploration · NASA Space Apps Challenge 2026 · <a className={styles.schoolLink} data-no-translate href="https://cemberlitasanadolu.meb.k12.tr/" target="_blank" rel="noopener noreferrer" aria-label={language==='en'?'Open Çemberlitaş Anatolian High School official website':'Çemberlitaş Anadolu Lisesi resmî web sitesini aç'}>Çemberlitaş Anadolu Lisesi</a> · Men in Hack Team · <a href="/">Launch SPHEREx Sky Explorer</a></footer>
  </main>;
}