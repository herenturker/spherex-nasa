import {liveStatusEnglish} from './live-status-en';
import {translateTurkish} from './locale-phrases';

describe('English-only scientific explorer and live NASA processing log',()=>{
  const examples:[string,string][]=[
    ['NASA/IPAC gerçek katalog indeksi: önbellek (24 saat TTL); FITS kontrol edildi',
     'Genuine NASA/IPAC catalog index: 24-hour cache; FITS files verified'],
    ['Aday 1/18 seçildi: 2025-09-09T19:59:56.947Z. Aynı RA/Dec ve SPHEREx-D2 kullanılacak.',
     'Candidate 1/18 selected: 2025-09-09T19:59:56.947Z. The same RA/Dec and SPHEREx-D2 will be used.'],
    ['Aday 1 için FITS indirme denemesi 1/3. 0/6 kare hazır.',
     'Candidate 1 FITS download attempt 1/3. 0/6 frames ready.'],
    ['✓ Bilimsel FITS 1/6 hazır — %17. NASA FITS indirildi, analiz önbelleğine kaydedildi. WCS/FLAGS/VARIANCE/ZODI. Gözlem: 2025-09-09T19:59:56.947Z.',
     '✓ Scientific FITS 1/6 ready — 17%. NASA FITS downloaded and saved to the science cache. WCS/FLAGS/VARIANCE/ZODI. Observation: 2025-09-09T19:59:56.947Z.'],
    ['NASA SIA2 katalog sorgusu — deneme 1/1. Sunucu yanıtı bekleniyor…',
     'NASA SIA2 catalog query — attempt 1/1. Waiting for the server response…'],
    ['NASA katalog indeksi 24 saatlik önbellekten alındı. Kaynak: gerçek NASA/IPAC gözlem kayıtları. FITS dosyaları da kalıcı önbellekte varsa tekrar indirilmez.',
     'The NASA catalog index was loaded from the 24-hour cache of genuine NASA/IPAC records. Saved FITS data are reused instead of downloading again.'],
    ['NASA FITS işlemi sürüyor… 5/6 görüntü hazır; 15 saniye geçti.',
     'NASA FITS processing continues… 5/6 images ready; 15 seconds elapsed.'],
    ['NASA/IPAC katalog yanıtı bekleniyor… 30 saniye geçti; henüz yeni istek gönderilmedi.',
     'Waiting for the NASA/IPAC catalog response… 30 seconds elapsed; no additional request sent.'],
    ['Bilimsel özet kalıcı rapor arşivine kaydedildi · 6 kare · 15 karşılaştırma',
     'Scientific summary saved to the persistent report archive · 6 frames · 15 comparisons'],
    ['EPSF güncellemesi denendi: 6/6 kare yeniden işlendi. Eksik kalanların önceki gerçek görüntüleri korundu; eksik EPSF raporda gösterilir.',
     'EPSF update attempted: 6/6 frames reprocessed. Previous genuine images were preserved; any missing EPSF is disclosed in the report.'],
  ];
  for(const [source,expected] of examples){
    it('fully localizes '+source.slice(0,55),()=>{
      expect(liveStatusEnglish(source)).toBe(expected);
    });
  }
  it('preserves dates and counts in the completed report',()=>{
    const text='🏆 TAMAMLANDI — 6/6 gerçek SPHEREx görüntüsü hazır (NASA katalog önbelleği / gerçek FITS). 6 aday denendi.';
    const result=liveStatusEnglish(text);
    expect(result).toContain('6/6 genuine SPHEREx images ready');
    expect(result).toContain('NASA catalog cache / genuine FITS');
    expect(result).toContain('6 candidates attempted');
    expect(result).not.toMatch(/gerçek|görüntüsü|aday denendi|önbelleği/);
  });
  it('translates the UI copy omitted by the former phrase glossary',()=>{
    expect(translateTurkish('Tüm hedefleri görmek için kutuya veya aşağı oka dokunun.'))
      .toBe('Tap the field or down arrow to see all targets.');
    expect(translateTurkish('Gözlem A–B zaman aralığı')).toBe('Observation A–B time baseline');
    expect(translateTurkish('Bilimsel CSV')).toBe('Scientific CSV');
    expect(translateTurkish('Google Colab\'den indirilen ZIP paketini seçin. Görüntüler bu tarayıcı oturumunda açılır.'))
      .toBe('Select the ZIP package downloaded from Google Colab. Its images open in this browser session.');
  });
  it('translates a NASA science write error rather than leaking Turkish',()=>{
    const source='Gerçek NASA FITS görüntüsü işlendi fakat kalıcı veritabanına kaydedilemedi: bağlantı hatası. Aynı gözlem için kaydetme işlemi yeniden denenebilir.';
    const output=liveStatusEnglish(source);
    expect(output).toContain('could not be saved to persistent storage');
    expect(output).toContain('Saving may be retried');
    expect(output).not.toContain('kaydedilemedi');
    expect(output).not.toContain('bağlantı hatası');
  });
  it('translates nested backend errors inside a failed NASA search',()=>{
    const input='M42 · Orion Bulutsusu için CANLI ARAMA TAMAMLANAMADI. NASA/IPAC SIA2 katalog sorgusu tamamlanamadı: bağlantı hatası';
    const output=liveStatusEnglish(input);
    expect(output).toContain('LIVE SEARCH FAILED for M42 · Orion Nebula');
    expect(output).toContain('NASA/IPAC SIA2 catalog search could not be completed: connection error');
    expect(output).not.toMatch(/Bulutsusu|bağlantı|tamamlanamadı/);
  });
  it('translates the source provenance, including the cached catalog description',()=>{
    expect(liveStatusEnglish('NASA/IPAC gerçek katalog indeksi: önbellek (24 saat TTL); FITS kontrol edildi'))
      .toBe('Genuine NASA/IPAC catalog index: 24-hour cache; FITS files verified');
  });
});