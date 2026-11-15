import type { OgImageProps } from '@floot/prefetch';

export const alt = 'Çemberlitaş Anadolu Lisesi · Men in Hack — SPHEREx Sky Explorer · NASA Space Apps Challenge 2026';

export default function TurkishShareImage(_props: OgImageProps) {
  return <div style={{width:'1200px',height:'630px',display:'flex',background:'#090f22',color:'#f0f3ff',padding:'60px',flexDirection:'column',justifyContent:'space-between',fontFamily:'Inter'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div style={{display:'flex',flexDirection:'column'}}>
        <div style={{fontSize:21,color:'#fbbf6a',fontWeight:750,letterSpacing:2}}>NASA SPACE APPS CHALLENGE 2026</div>
        <div style={{fontSize:25,color:'#b9afff',marginTop:12}}>MEN IN HACK · ÖĞRENCİ BİLİM PROJESİ</div>
      </div>
      <img src="/_cdn/static/c37e87bb-b842-46e8-8dea-b631b8da07f8-spherex-sky-explorer-favicon-2026.png" style={{width:110,height:110,borderRadius:22}} />
    </div>
    <div style={{display:'flex',flexDirection:'column'}}>
      <div style={{fontSize:82,fontWeight:800,letterSpacing:-2}}>SPHEREx</div>
      <div style={{fontSize:82,fontWeight:800,letterSpacing:-2,color:'#b1a5ff'}}>Sky Explorer</div>
      <div style={{fontSize:29,color:'#c5d0e7',marginTop:20}}>Gerçek NASA verileriyle gökyüzünü keşfet</div>
    </div>
    <div style={{display:'flex',flexDirection:'column',borderTop:'2px solid #53517b',paddingTop:23}}>
      <div style={{fontSize:29,fontWeight:700}}>Çemberlitaş Anadolu Lisesi</div>
      <div style={{fontSize:20,color:'#abb9d5',marginTop:6}}>www.cemberlitasmeninhack.com/tr</div>
    </div>
  </div>;
}