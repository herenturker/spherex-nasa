# SPHEREx Sky Explorer — Türkçe Proje Açıklaması

**Çemberlitaş Anadolu Lisesi / Men in Hack — NASA Space Apps Challenge 2026**

Canlı uygulama: https://www.cemberlitasmeninhack.com/

## Amaç

NASA/IPAC SPHEREx DR1 arşivinden elde edilen gerçek astronomik FITS gözlemlerinin aynı gökyüzü bölgesinde farklı tarihlerde nasıl değiştiğini incelemek. Uygulama hedef seçimi, RA/Dec koordinat araması, zaman çizelgesi, oynatıcı, yaklaşık bant uyumu kontrolü, fark haritası, ePSF ve bilimsel ön rapor üretimi sağlar.

## Önerilen beş hedef

1. Barnard's Star — dokuz kayıtlı bilimsel kare.
2. Epsilon Indi B — sekiz kare.
3. WISE 0855−0714 — D2 üzerinde sekiz kare; D5 ve D6 kayıtları ayrıca incelenmiştir.
4. RW Aurigae — on bir kare.
5. R Draconis — sekiz kare.

## Önemli bilimsel sınırlamalar

- Bir hedefe ait gökyüzü kesitinin görüntülenmesi, hedefin kendisinin doğrulanmış tespiti değildir.
- Fark haritası yıldızın öz hareketini veya parlaklık değişimini tek başına kanıtlamaz.
- WCS-WAVE, dalga boyu uyumu için yaklaşık bilgi verir; tam fotometri için daha güçlü kalibrasyon gerekir.
- ePSF değerleri NASA modelinden alınan **yerel yaklaşık genişlik** tahminleridir.
- Merkezi pikselleri geçersiz R Draconis karelerinde yıldızın toplam akısı, periyodu ve değişim genliği ölçülmüş değildir.
- Kaynaklar ve veri işleme kısıtları `docs/SCIENCE_METHOD.md` dosyasında ayrıntılıdır.

## GitHub'a yüklemeden önce

Bu ZIP içindeki `floot_project` kaynaklarını, `database` yedeğini ve kullanım kılavuzunu birlikte saklayın. SQL ve NDJSON yedekleri gizli anahtar içermez. Floot yönetilen çalışma ortamı gerektirdiği için sadece kaynak kodu bilgisayara çıkarıp `npm install` yaparak aynı sistemi başlatma garantisi yoktur. Tam uygulamaya erişim için ayrıca https://www.cemberlitasmeninhack.com/ adresini paylaşın.

Resmî başvuru tarihçesi, takım emeği ve kullanılan yapay zekâ araçları doğru şekilde belirtilmelidir.
