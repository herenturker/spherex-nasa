import type { OgImageProps } from '@floot/prefetch';

export const alt = 'SPHEREx Sky Explorer — Men in Hack, Çemberlitaş Anatolian High School · NASA Space Apps Challenge 2026';

export default function OgImage(_props: OgImageProps) {
  return <div style={{width:'1200px',height:'630px',display:'flex',background:'#090f22',color:'#eef2ff',padding:'60px',flexDirection:'column',justifyContent:'space-between',fontFamily:'Inter'}}>
    <div style={{display:'flex',width:'100%',justifyContent:'space-between',alignItems:'center'}}>
      <div style={{display:'flex',flexDirection:'column'}}>
        <div style={{fontSize:20,fontWeight:700,color:'#fbbf6a',letterSpacing:3}}>NASA SPACE APPS CHALLENGE 2026</div>
        <div style={{fontSize:24,color:'#b9afff',marginTop:12}}>MEN IN HACK · STUDENT SCIENCE PROJECT</div>
      </div>
      <div style={{background:'#232047',borderRadius:28,padding:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <img src="/_cdn/static/c37e87bb-b842-46e8-8dea-b631b8da07f8-spherex-sky-explorer-favicon-2026.png" style={{width:106,height:106,borderRadius:22}} />
      </div>
    </div>
    <div style={{display:'flex',flexDirection:'column'}}>
      <div style={{fontSize:78,fontWeight:800,letterSpacing:-3,lineHeight:1.03}}>SPHEREx</div>
      <div style={{fontSize:78,fontWeight:800,letterSpacing:-3,lineHeight:1.03,color:'#b1a5ff'}}>Sky Explorer</div>
      <div style={{fontSize:27,color:'#c1cce0',marginTop:25}}>Real NASA/IPAC observations · Explore the sky through time</div>
    </div>
    <div style={{display:'flex',flexDirection:'column',borderTop:'2px solid #53517b',paddingTop:22}}>
      <div style={{fontSize:28,fontWeight:700}}>Cemberlitas Anatolian High School</div>
      <div style={{fontSize:20,color:'#abb9d5',marginTop:7}}>www.cemberlitasmeninhack.com</div>
    </div>
  </div>;
}