import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {LanguageProvider,useLanguage} from './i18n';
import {translateTurkish} from './locale-phrases';
import {localizeResearchReport,researchMarkdownEnglish} from './research-language';
import {prepareResearchReport} from './spherex-report';
function Probe(){
  const {language,setLanguage}=useLanguage();
  return <main data-i18n-root data-i18n-source="tr">
    <h1>Gökyüzüne bak.</h1>
    <p>NASA Space Apps Challenge 2026 · SPHEREx Sky Explorer · Çembertaş Anadolu Lisesi Men in Hack Team · Veriler: NASA/IPAC Infrared Science Archive</p>
    <p data-testid="library-status">19 gökyüzü bölgesi / dedektör kaydı hazır. “Arşivde Ara” ile gerçek SPHEREx kayıtları kontrol edilir.</p>
    <div>{language}</div>
    <button onClick={()=>setLanguage(language==='en'?'tr':'en')}>Change language</button>
  </main>;
}
describe('SPHEREx bilingual interface',()=>{
  afterEach(()=>{cleanup();localStorage.clear()});
  it('opens English, switches to Turkish, and back without destroying original text',async()=>{
    localStorage.clear();
    render(<LanguageProvider><Probe/></LanguageProvider>);
    await waitFor(()=>expect(screen.getByText('Look at the sky.')).toBeTruthy());
    await waitFor(()=>expect(screen.getByTestId('library-status').textContent).toContain('19 sky-region/detector entries are ready.'));
    expect(screen.getByText(/Çemberlitaş Anatolian High School Men in Hack Team/)).toBeTruthy();
    fireEvent.click(screen.getByText('Change language'));
    await waitFor(()=>expect(screen.getByText('Gökyüzüne bak.')).toBeTruthy());
    await waitFor(()=>expect(screen.getByTestId('library-status').textContent).toContain('19 gökyüzü bölgesi / dedektör kaydı hazır.'));
    expect(screen.getByText(/Çembertaş Anadolu Lisesi Men in Hack Team/)).toBeTruthy();
    fireEvent.click(screen.getByText('Change language'));
    await waitFor(()=>expect(screen.getByText('Look at the sky.')).toBeTruthy());
    await waitFor(()=>expect(screen.getByTestId('library-status').textContent).toContain('19 sky-region/detector entries are ready.'));
  });
  it('preserves original scientific acronyms',()=>{
    expect(translateTurkish('Bilimsel Analiz ve Sonuçlar · WCS · EPSF')).toBe('Scientific Analysis and Results · WCS · EPSF');
  });
  it('fully translates the purple live-library status in English without Turkish fragments',()=>{
    const tr='19 gökyüzü bölgesi / dedektör kaydı hazır. “Arşivde Ara” ile gerçek SPHEREx kayıtları kontrol edilir.';
    expect(translateTurkish(tr)).toBe('19 sky-region/detector entries are ready. Use “Search NASA” to verify genuine SPHEREx archive records.');
    expect(translateTurkish(tr)).not.toMatch(/gökyüzü|dedektör kaydı|Arşivde Ara|kontrol edilir/);
  });
  it('translates library updates and saved-cache status in English',()=>{
    const tr='Bilimsel önbellek: 9 gerçek FITS karesi hazır. Yeni kayıtlar için NASA’da Ara düğmesini kullanabilirsiniz.';
    expect(translateTurkish(tr)).toBe('Scientific cache: 9 genuine FITS frames ready. Use “Search NASA” to look for additional observations.');
  });
  it('produces an English scientific Markdown report without Turkish disclaimer',()=>{
    const report=prepareResearchReport('M101 Galaksisi',[]);
    const english=localizeResearchReport(report,'en');
    expect(english.title).toContain('Scientific Observation');
    expect(english.target).toBe('M101 Galaxy');
    const markdown=researchMarkdownEnglish(report);
    expect(markdown).toContain('Scientific interpretation');
    expect(markdown).toContain('confirmed');
    expect(markdown).not.toContain('Bilimsel Gözlem');
  });
});