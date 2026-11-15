import {translateTurkish} from './locale-phrases';

/** Translate whole live NASA messages, including variable dates and counts.
 * Turkish originals are preserved in state for lossless language switching.
 * Static interface labels continue to use the curated locale glossary.
 */
const fullRules:[RegExp,string][]=[
  [/^NASA\/IPAC gerçek katalog indeksi: önbellek \(24 saat TTL\); FITS kontrol edildi$/, 'Genuine NASA/IPAC catalog index: 24-hour cache; FITS files verified'],
  [/^NASA\/IPAC: kaydedilmiş gerçek katalog indeksi; FITS kontrol edildi$/, 'NASA/IPAC: genuine saved catalog index; FITS files verified'],
  [/^NASA\/IPAC IRSA SIA2 — canlı koordinat sorgusu$/, 'NASA/IPAC IRSA SIA2 — live coordinate query'],
  [/^Önceden işlenmiş gerçek NASA SPHEREx FITS verileri · kalıcı veritabanı$/, 'Previously processed genuine NASA SPHEREx FITS data · persistent database'],
  [/^Önceden işlenmiş gerçek NASA FITS arşivi · 24 saatlik katalog doğrulaması$/, 'Previously processed genuine NASA FITS archive · 24-hour catalog verification'],
  [/^RA 0–360°, Dec −90° ile \+90° arasında bir koordinat olmalıdır\.$/, 'RA must be 0–360° and Dec must be between −90° and +90°.'],
  [/^NASA\/IPAC katalog yanıtı bekleniyor… (\d+) saniye geçti; henüz yeni istek gönderilmedi\.$/, 'Waiting for the NASA/IPAC catalog response… $1 seconds elapsed; no additional request sent.'],
  [/^NASA FITS işlemi sürüyor… ([\d/]+) görüntü hazır; (\d+) saniye geçti\.$/, 'NASA FITS processing continues… $1 images ready; $2 seconds elapsed.'],
  [/^YAVAŞ TEKRAR DENEME: NASA SIA2 katalog sorgusu en fazla 3 defa denenecek\. FITS istekleri arasında uzun aralar bırakılacak\.$/, 'SLOW RETRY: NASA SIA2 catalog search will be attempted up to three times, with longer pauses between FITS requests.'],
  [/^NASA SIA2 katalog sorgusu — deneme ([\d/]+)\. Sunucu yanıtı bekleniyor…$/, 'NASA SIA2 catalog query — attempt $1. Waiting for the server response…'],
  [/^NASA SIA2 katalog sorgusu ([\d/]+) başarısız: (.+)$/, 'NASA SIA2 catalog query attempt $1 failed: $2'],
  [/^NASA sunucusunu zorlamamak için (\d+) saniye bekleniyor; ardından katalog yeniden sorgulanacak\.$/, 'Waiting $1 seconds before retrying the catalog to avoid overloading NASA servers.'],
  [/^NASA SIA2 şu anda yanıt vermedi\. (.+) tarihinde NASA’dan alınmış GERÇEK katalog indeksinin yedeği kullanıldı\. Görüntüler şimdi NASA’dan canlı indirilecek\.$/, 'NASA SIA2 did not respond. A genuine catalog snapshot retrieved on $1 was used; FITS images will now be requested from NASA.'],
  [/^NASA SIA2 kataloğu yanıtladı: (\d+) uygun (SPHEREx-D\d) kaydı, (\d+) aday gözlem bulundu\. Hedef (\d+) gerçek kare\.$/, 'NASA SIA2 responded: $1 matching $2 records and $3 candidate observations. Goal: $4 genuine frames.'],
  [/^NASA sunucusuna yeni FITS isteği göndermeden önce 3 saniye bekleniyor\.$/, 'Waiting 3 seconds before sending another FITS request to NASA.'],
  [/^Aday ([\d/]+) seçildi: (.+?)\. Aynı RA\/Dec ve (SPHEREx-D\d) kullanılacak\.$/, 'Candidate $1 selected: $2. The same RA/Dec and $3 will be used.'],
  [/^Aday (\d+) için FITS indirme denemesi ([\d/]+)\. ([\d/]+) kare hazır\.$/, 'Candidate $1 FITS download attempt $2. $3 frames ready.'],
  [/^Aday (\d+) \/ deneme ([\d/]+) başarısız: (.+)$/, 'Candidate $1 / attempt $2 failed: $3'],
  [/^Aynı FITS dosyası için (\d+) saniye bekleniyor; sonra deneme ([\d/]+) başlayacak\.$/, 'Waiting $1 seconds before FITS download attempt $2.'],
  [/^Aday (\d+) üç denemeden sonra atlandı; aynı koordinatlarda farklı tarihli gözleme geçiliyor\.$/, 'Candidate $1 skipped after three attempts; trying a different observation date at the same coordinates.'],
  [/^KISMİ SONUÇ — ([\d/]+) gerçek görüntü hazır\. Eksikler için daha yavaş tekrar deneyebilirsiniz\.$/, 'PARTIAL RESULT — $1 genuine images ready. Use slow retry for any missing frames.'],
  [/^⚠️ Tekrar Dene düğmesiyle aynı RA\/Dec ve dedektörü daha seyrek NASA istekleriyle yeniden deneyebilirsiniz\.$/, '⚠️ Use “Try again” to repeat the same RA/Dec and detector with fewer NASA requests.'],
  [/^NASA\/IPAC isteği zaman aşımına uğradı\. (.+)$/, 'NASA/IPAC request timed out. $1'],
  [/^NASA kataloğu yanıtladı ancak hiçbir FITS görüntüsü alınamadı\. (.+)$/, 'NASA catalog responded, but no FITS images were retrieved. $1'],
  [/^Aday (\d+): (.+)$/, 'Candidate $1: $2'],
  [/^Eksik EPSF kontrolü ([\d/]+): orijinal NASA FITS yeniden okunuyor…$/, 'Missing EPSF check $1: rereading the original NASA FITS…'],
  [/^([\d/]+) gerçek FITS karesi WCS gridine dönüştürüldü\.$/, '$1 genuine FITS frames mapped to the WCS grid.'],
  [/^(\d+)\. kare hazırlanamadı: (.+)\. Önceki görüntü korundu\.$/, 'Frame $1 could not be prepared: $2. The previous image was preserved.'],
  [/^EPSF güncellemesi denendi: ([\d/]+) kare yeniden işlendi\. Eksik kalanların önceki gerçek görüntüleri korundu; eksik EPSF raporda gösterilir\.$/, 'EPSF update attempted: $1 frames reprocessed. Previous genuine images were preserved; any missing EPSF is disclosed in the report.'],
  [/^Bilimsel özet kalıcı rapor arşivine kaydedildi · (\d+) kare · (\d+) karşılaştırma$/, 'Scientific summary saved to the persistent report archive · $1 frames · $2 comparisons'],
  [/^Rapor bu ekranda hazır; kalıcı arşiv kaydı için NASA’dan işlenmiş en az iki kayıtlı kare gerekir\.$/, 'The report is available on screen; persistent archival requires at least two saved NASA science frames.'],
  [/^Rapor indirilebilir; arşiv bağlantısında geçici sorun var\.$/, 'The report can be downloaded, but there is a temporary archive connection issue.'],
  [/^(.+) için kayıtlı görüntü bulunmadı; NASA arşivinden indiriliyor\.$/, 'No saved images found for $1; downloading observations from the NASA archive.'],
  [/^(.+) için daha önce hazırlanmış gerçek FITS görüntüleri aranıyor…$/, 'Looking for previously processed genuine FITS images for $1…'],
  [/^(\d+) gerçek SPHEREx karesi açıldı$/, '$1 genuine SPHEREx frames loaded'],
  [/^(\d+) kayıtlı SPHEREx karesi hazır$/, '$1 saved SPHEREx frames ready'],
  [/^(\d+) kalıcı SPHEREx karesi hazır$/, '$1 persistent SPHEREx frames ready'],
  [/^(\d+) gerçek SPHEREx karesi oynatıcıda hazır$/, '$1 genuine SPHEREx frames ready in the player'],
  [/^NASA\/IPAC SIA2 katalog sorgusu tamamlanamadı: (.+)$/, 'NASA/IPAC SIA2 catalog search could not be completed: $1'],
  [/^NASA SIA2 servisleri yanıt vermedi: (.+)$/, 'NASA SIA2 services did not respond: $1'],
  [/^SIA2 (.+) geçerli veri tablosu döndürmedi$/, 'SIA2 $1 did not return a valid data table'],
  [/^NASA SIA2 yanıtında gerekli sütunlar yok$/, 'The required columns are missing from the NASA SIA2 response'],
  [/^Bilimsel FITS hazırlığı başarısız: (.+)$/, 'Scientific FITS processing failed: $1'],
  [/^Gerçek NASA FITS görüntüsü işlendi fakat kalıcı veritabanına kaydedilemedi: (.+)\. Aynı gözlem için kaydetme işlemi yeniden denenebilir\.$/, 'The genuine NASA FITS image was processed but could not be saved to persistent storage: $1. Saving may be retried for this observation.'],
  [/^FITS bağlantısı geçersiz\.$/, 'Invalid FITS link.'],
  [/^URL geçersiz\.$/, 'Invalid URL.'],
  [/^Yalnızca güvenli NASA\/IPAC SPHEREx kesit URL ve koordinatları kabul edilir\.$/, 'Only trusted NASA/IPAC SPHEREx cutout URLs and coordinates are accepted.'],
  [/^NASA FITS bağlantısı yanıt vermedi$/, 'NASA FITS server did not respond'],
  [/^FITS veri boyutu sınır dışı$/, 'FITS file exceeds the allowed size'],
  [/^FITS bozuk veya çok büyük$/, 'FITS file is corrupted or too large'],
  [/^NASA bilimsel FITS dosyası işlenemedi\.$/, 'The NASA scientific FITS file could not be processed.'],
  [/^Bilimsel önbellek kayıt boyutu güvenli sınırı aştı$/, 'The scientific cache record exceeds the safe size limit'],
  [/^Kayıtlı bilimsel görüntüler okunamadı: (.+)$/, 'Saved scientific frames could not be read: $1'],
  [/^Kaydedilmiş katalogda uygun gözlem bulunamadı$/, 'No suitable observation found in the saved catalog'],
  [/^Hedef kodu geçersiz\.$/, 'Invalid target code.'],
  [/^Bilinmeyen gökyüzü hedefi\.$/, 'Unknown sky target.'],
  [/^ZIP içinde images\.json bulunamadı\.$/, 'The ZIP archive does not contain images.json.'],
  [/^images\.json içinde görüntü listesi yok\.$/, 'The images.json manifest does not contain any frame list.'],
  [/^(.+) ZIP içinde bulunamadı\.$/, '$1 was not found in the ZIP archive.'],
  [/^Kayıtlı SPHEREx paketi alınamadı: HTTP (\d+)$/, 'Saved SPHEREx package could not be downloaded: HTTP $1'],
  [/^Hedef verisi yüklenemedi$/, 'Target data could not be loaded'],
  [/^ZIP dosyası okunamadı\.$/, 'The ZIP file could not be read.'],
  [/^Bilinmeyen bağlantı hatası$/, 'Unknown connection error'],
  [/^Bilinmeyen FITS hatası$/, 'Unknown FITS error'],
  [/^Bilinmeyen hata$/, 'Unknown error'],
  [/^bağlantı hatası$/, 'connection error'],
  [/^NASA katalog sorgusu HTTP (\d+)$/, 'NASA catalog query HTTP $1'],
];

// Preserve message structure for variable-length phrases not represented by a
// single glossary entry. These are applied before generic glossary fallback.
const parts:[RegExp,string][]=[
  [/^(.+) için canlı NASA\/IPAC SIA2 sorgusu başlatıldı\. RA ([\d.]+)°, Dec ([-\d.]+)° · (SPHEREx-D\d)\.$/, 'Started live NASA/IPAC SIA2 search for $1. RA $2°, Dec $3° · $4.'],
  [/^(.+) için (SPHEREx-D\d) dedektöründe uygun gözlem bulunamadı\. Diğer koordinat veya dedektörü deneyin\.$/, 'No matching observations found for $1 with $2. Try other coordinates or detectors.'],
  [/^NASA katalog indeksi 24 saatlik önbellekten alındı\. Kaynak: gerçek NASA\/IPAC gözlem kayıtları\. FITS dosyaları da kalıcı önbellekte varsa tekrar indirilmez\.$/, 'The NASA catalog index was loaded from the 24-hour cache of genuine NASA/IPAC records. Saved FITS data are reused instead of downloading again.'],
  [/^NASA katalog indeksi süresi geçmiş kayıttan alındı\. Kaynak: gerçek NASA\/IPAC gözlem kayıtları\. FITS dosyaları da kalıcı önbellekte varsa tekrar indirilmez\.$/, 'A previously saved genuine NASA/IPAC catalog index was used after its 24-hour cache expired. Stored FITS data are reused whenever available.'],
  [/^✓ Bilimsel FITS ([\d/]+) hazır — %(\d+)\. NASA FITS indirildi, analiz önbelleğine kaydedildi\. WCS\/FLAGS\/VARIANCE\/ZODI\. Gözlem: (.+)\.$/, '✓ Scientific FITS $1 ready — $2%. NASA FITS downloaded and saved to the science cache. WCS/FLAGS/VARIANCE/ZODI. Observation: $3.'],
  [/^✓ Bilimsel FITS ([\d/]+) hazır — %(\d+)\. Önceki gerçek NASA görüntüsü kalıcı önbellekten\. WCS\/FLAGS\/VARIANCE\/ZODI\. Gözlem: (.+)\.$/, '✓ Scientific FITS $1 ready — $2%. Genuine NASA frame reused from persistent storage. WCS/FLAGS/VARIANCE/ZODI. Observation: $3.'],
  [/^Önceki (.+) veri seti \((\d+) kare\) korunuyor; bu aramada başka hedefin görüntüsü kullanılmadı\.$/, 'The previous $1 dataset ($2 frames) is preserved; no unrelated target images were substituted.'],
  [/^(.+) için CANLI ARAMA TAMAMLANAMADI\. (.+)$/, 'LIVE SEARCH FAILED for $1. $2'],
  [/^(.+) · (\d+) bilimsel kare kalıcı önbellekten açıldı\. Katalog kontrolü: (.+)\. Güncellemek için NASA’da Ara’ya basın\.$/, '$1 · $2 scientific frames loaded from persistent storage. Last catalog check: $3. Use “Search NASA” to refresh.'],
  [/^(.+) için kayıtlı görüntüler açık; 24 saatlik katalog süresi dolduğu için NASA güncellemesi otomatik başlatılıyor\.$/, '$1: saved frames are open. NASA catalog refresh started because the 24-hour cache expired.'],
];
export function liveStatusEnglish(message:string):string{
  if(!message)return message;
  const searchFailed=message.match(/^(.+) için CANLI ARAMA TAMAMLANAMADI\. (.+)$/);
  if(searchFailed)return 'LIVE SEARCH FAILED for '+
    translateTurkish(searchFailed[1]).replace(/ bölgesi$/,' region')+'. '+
    liveStatusEnglish(searchFailed[2]);
  const nestedError=message.match(/^(NASA\/IPAC SIA2 katalog sorgusu tamamlanamadı: |Bilimsel FITS hazırlığı başarısız: )(.+)$/);
  if(nestedError)return (nestedError[1].startsWith('NASA/IPAC')
    ?'NASA/IPAC SIA2 catalog search could not be completed: '
    :'Scientific FITS processing failed: ')+liveStatusEnglish(nestedError[2]);
  const persistedError=message.match(/^Gerçek NASA FITS görüntüsü işlendi fakat kalıcı veritabanına kaydedilemedi: (.+)\. Aynı gözlem için kaydetme işlemi yeniden denenebilir\.$/);
  if(persistedError)return 'The genuine NASA FITS image was processed but could not be saved to persistent storage: '+
    liveStatusEnglish(persistedError[1])+'. Saving may be retried for this observation.';
  // Completed messages contain optional clauses depending on cache and retry mode.
  if(message.startsWith('🏆 TAMAMLANDI — ')){
    return translateTurkish(message)
      .replace('🏆 COMPLETED — ','🏆 COMPLETED — ')
      .replace(/ (\d+\/\d+) gerçek SPHEREx görüntüsü hazır/,' $1 genuine SPHEREx images ready')
      .replace('NASA katalog önbelleği / gerçek FITS','NASA catalog cache / genuine FITS')
      .replace('NASA katalog indeks yedeği / gerçek FITS','saved NASA catalog snapshot / genuine FITS')
      .replace('canlı NASA kataloğu / gerçek FITS','live NASA catalog / genuine FITS')
      .replace(/(\d+) aday denendi/,'$1 candidates attempted')
      .replace(/(\d+) aday yerine başka tarihli gözlem kullanıldı/,'$1 candidates replaced with observations from other dates');
  }
  for(const [pattern,translation] of [...fullRules,...parts]){
    if(pattern.test(message)){
      const english=message.replace(pattern,translation);
      return translateTurkish(english);
    }
  }
  return translateTurkish(message);
}