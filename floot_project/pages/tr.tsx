import React from 'react';

const root: React.CSSProperties = {minHeight:'100vh',background:'#080e21',color:'#f4f3ff',fontFamily:'system-ui,Arial,sans-serif',padding:'40px 22px'};
const content: React.CSSProperties = {maxWidth:1040,margin:'0 auto'};
const tag: React.CSSProperties = {fontSize:13,letterSpacing:2,fontWeight:700,color:'#c3b5ff'};
const h1: React.CSSProperties = {fontSize:'clamp(31px,5vw,60px)',lineHeight:1.12,margin:'24px 0 16px'};
const lead: React.CSSProperties = {fontSize:21,lineHeight:1.65,color:'#c7d1e8'};
const section: React.CSSProperties = {background:'#151d38',border:'1px solid #374361',padding:'22px 26px',borderRadius:18,marginTop:22,lineHeight:1.75};

export default function TurkishProjectPage(){
  return <div style={root} lang="tr">
    <title>Çemberlitaş Anadolu Lisesi - SPHEREx Sky Explorer — NASA Space Apps Challenge 2026</title>
    <meta name="description" content="Çemberlitaş Anadolu Lisesi Men in Hack takımı, NASA Space Apps Challenge 2026 için SPHEREx Sky Explorer projesini geliştirdi. NASA/IPAC gerçek gökyüzü verileri, Barnard Yıldızı, beş test hedefi ve bilimsel karşılaştırmaları keşfedin." />
    <meta name="keywords" content="Çemberlitaş Anadolu Lisesi, Cemberlitas Anatolian High School, Men in Hack, NASA Space Apps Challenge 2026, SPHEREx, SPHEREx Sky Explorer, NASA/IPAC, Barnard Yıldızı, Epsilon Indi B, WISE 0855-0714, RW Aurigae, R Draconis, M101 Fırıldak Gökadası, M104 Sombrero, M42 Orion Bulutsusu, kızılötesi astronomi, gökyüzü keşfi" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta property="og:locale" content="tr_TR" />
    <meta property="og:locale:alternate" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="https://www.cemberlitasmeninhack.com/tr" />
    <link rel="alternate" hrefLang="tr" href="https://www.cemberlitasmeninhack.com/tr" />
    <link rel="alternate" hrefLang="en" href="https://www.cemberlitasmeninhack.com/" />
    <link rel="alternate" hrefLang="x-default" href="https://www.cemberlitasmeninhack.com/" />
    <main style={content}>
      <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <a href="/" style={{color:'#cfc4ff',fontWeight:750,textDecoration:'none'}}>SPHEREx Sky Explorer</a>
        <a href="/" style={{color:'#dce7ff',textDecoration:'underline'}}>English · İngilizce</a>
      </nav>
      <header style={{marginTop:80}}>
        <div style={tag}>MEN IN HACK · NASA SPACE APPS CHALLENGE 2026</div>
        <h1 style={h1}>Çemberlitaş Anadolu Lisesi — SPHEREx Sky Explorer</h1>
        <p style={lead}>Çemberlitaş Anadolu Lisesi Men in Hack takımının NASA Space Apps Challenge 2026 yarışması için geliştirdiği, NASA/IPAC SPHEREx gözlemlerine dayanan iki dilli gökyüzü keşif projesi.</p>
        <a href="/?lang=tr" style={{display:'inline-flex',background:'#a99afa',padding:'15px 24px',marginTop:10,borderRadius:12,color:'#12132e',fontWeight:800,textDecoration:'none'}}>Türkçe etkileşimli gökyüzü keşfini aç</a>
      </header>
      <section style={section}>
        <h2 style={{color:'#ded9ff',marginTop:0}}>Proje hangi özellikleri sunuyor?</h2>
        <p>SPHEREx teleskobunun NASA/IPAC Infrared Science Archive (IRSA) üzerinde yayımlanan gerçek FITS kızılötesi gözlem verilerini araştırır. Gökyüzü koordinatı (RA/Dec) ile arama, farklı gözlem tarihlerinde görüntü oynatma, dalga boyu uyumunun denetlenmesi, bilimsel fark haritaları ve keşif amaçlı ölçüm raporları sunar.</p>
        <p>Görüntüler bilimsel veri önizlemesidir; henüz doğrulanmış ötegezegen keşfi, yıldız hareketi veya hassas fotometri iddiası içermez.</p>
      </section>
      <section style={section}>
        <h2 style={{color:'#ded9ff',marginTop:0}}>Beş önerilen test gök cismi</h2>
        <p>Barnard Yıldızı (Barnard's Star), Epsilon Indi B, WISE 0855−0714, RW Aurigae ve R Draconis için NASA SPHEREx gözlem verileri incelenebilir. Ayrıca M101 Fırıldak Gökadası, M104 Sombrero Gökadası ve M42 Orion Bulutsusu gibi gökyüzü bölgeleri de projede yer alır.</p>
      </section>
      <section style={section}>
        <h2 style={{color:'#ded9ff',marginTop:0}}>Yöntem, kaynaklar ve bilimsel şeffaflık</h2>
        <p>NASA/IPAC IRSA SPHEREx veri ürünleri, FITS katmanları, WCS koordinat hizalaması, gözlem tarihleri ve farklı kızılötesi bantlar birlikte ele alınır. Yöntem, ölçümlerin sınırlılıklarını açıklar ve bağımsız doğrulama ihtiyacını vurgular. Bu, öğrencilerin geliştirdiği bağımsız bir çalışmadır; NASA'nın resmî uygulaması değildir.</p>
        <p><a href="/jury" style={{color:'#c7b9ff'}}>Bilimsel yöntem ve test hedefleri</a> · <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" style={{color:'#c7b9ff'}}>NASA/IPAC SPHEREx veri arşivi</a></p>
      </section>
      <footer style={{marginTop:50,paddingBottom:30,color:'#a0aec8'}}>Men in Hack · Çemberlitaş Anadolu Lisesi · NASA Space Apps Challenge 2026 · <a href="/" style={{color:'#c7b9ff'}}>SPHEREx Sky Explorer</a></footer>
    </main>
  </div>;
}