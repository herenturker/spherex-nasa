import sharp from 'sharp';

type Header = Record<string,string>;
type Plane = {width:number;height:number;bitpix:number;data:Float64Array;header:Header};
type WaveLut={x:number[];y:number[];values:number[]};
export type PSFDiagnostic={
  status:'measured-from-EPSF';
  detector_zone_x:number;detector_zone_y:number;
  sigma_native_pix:number;fwhm_arcsec_approx:number;
  oversampling:number;method:'local-EPSF-second-moment';
};
type EPSFRow={x:number;y:number;binx:number;biny:number;kernel:Float64Array};
export type ScienceFrameData = {
  analysis_version?:string;
  grid_size:number;grid_field_deg:number;
  flux:(number|null)[];variance:(number|null)[];
  wavelength_um:(number|null)[];bandwidth_um:(number|null)[];
  center_wavelength_um:number|null;center_bandwidth_um:number|null;
  valid_fraction:number;flagged_fraction:number;
  native_width:number;native_height:number;preview_width:number;preview_height:number;
  wcs:'TAN-SIP';units:'MJy/sr';wavelength_status:'WCS-WAVE-approximate'|'unavailable';
  p02:number;p98:number;median:number;
  masked_pixels:number;
  psf?:PSFDiagnostic|null;
};
const deg=Math.PI/180;
const finite=(v:number)=>Number.isFinite(v);
function cardVal(header:Header,key:string):string { return header[key] || ''; }
function parseHeaders(bytes:Uint8Array):{planes:Record<string,Plane>;wave:WaveLut|null;epsf:EPSFRow[];epsfOversampling:number}{
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const decoder=new TextDecoder('ascii');
  const planes:Record<string,Plane>={};
  let wave:WaveLut|null=null;
  const epsf:EPSFRow[]=[];
  let epsfOversampling=NaN;
  let offset=0;
  for(let hdu=0;hdu<8 && offset<bytes.length;hdu++){
    const header:Header={};let count=0;let foundEnd=false;
    for(let j=0;j<4000;j++){
      const start=offset+j*80;
      if(start+80>bytes.length)throw new Error('FITS header verisi eksik');
      const s=decoder.decode(bytes.subarray(start,start+80));
      const key=s.slice(0,8).trim();
      count++;
      if(key==='END'){foundEnd=true;break;}
      if(s[8]==='='){
        let value=s.slice(10);
        // FITS uses / as a comment separator, but BUNIT strings may contain '/'.
        if(value.trimStart().startsWith("'")){
          const m=value.match(/^\s*'((?:[^']|'')*)'/);
          value=m?m[1].replace(/''/g,"'"):'';
        }else value=value.split('/')[0].trim();
        header[key]=value.trim();
      }
    }
    if(!foundEnd)throw new Error('FITS END kartı eksik');
    const n=Number(header.NAXIS||0),bitpix=Number(header.BITPIX||8);
    if(n<0 || n>4)throw new Error('Beklenmeyen FITS boyutları');
    const sides=Array.from({length:n},(_,i)=>Number(header['NAXIS'+(i+1)]||0));
    const pixels=n?sides.reduce((a,b)=>a*b,1):0;
    const pcount=Number(header.PCOUNT||0),gcount=Number(header.GCOUNT||1);
    if(!Number.isFinite(pixels) || pixels<0 || pixels>1e9)throw new Error('FITS boyut sınırı aşıldı');
    const dataAt=offset+Math.ceil(count*80/2880)*2880;
    const rawBytes=(pixels*Math.abs(bitpix)/8+pcount)*gcount;
    if(!Number.isFinite(rawBytes)||rawBytes<0||rawBytes>bytes.length)throw new Error('FITS veri boyutu hatalı');
    const width=Number(header.NAXIS1),height=Number(header.NAXIS2);
    const name=(header.EXTNAME||'').trim().toUpperCase();
    // DR1 / QR3 EPSF is a 441-row BINTABLE (33×33 oversampled model for each
    // detector zone). Read center coordinates and the ePSF samples from its
    // strictly documented fixed-width layout; do not synthesize PSF models.
    if(name==='EPSF'&&header.XTENSION==='BINTABLE'&&n===2 &&
       Number(header.NAXIS1)>=8752 && Number(header.NAXIS2)<=600 &&
       header.TTYPE11==='EPSF'&&header.TFORM11==='1089D'){
      const overX=Number(header.OVSMPX),overY=Number(header.OVSMPY);
      if(finite(overX)&&finite(overY)&&overX>0&&overX===overY&&overX<=20)
        epsfOversampling=overX;
      const rows=Number(header.NAXIS2),stride=Number(header.NAXIS1);
      for(let row=0;row<rows;row++){
        const at=dataAt+row*stride;
        if(at+8752>bytes.length)break;
        const binx=view.getInt32(at,false),biny=view.getInt32(at+4,false);
        const x=view.getFloat32(at+8,false),y=view.getFloat32(at+12,false);
        if(![x,y,binx,biny].every(finite))continue;
        const kernel=new Float64Array(1089);
        for(let k=0;k<1089;k++)kernel[k]=view.getFloat64(at+40+k*8,false);
        epsf.push({x,y,binx,biny,kernel});
      }
    }
    if(name==='WCS-WAVE' && header.XTENSION==='BINTABLE'&& n===2){
      const m1=(header.TFORM1||'').match(/^(\d+)J$/),m2=(header.TFORM2||'').match(/^(\d+)J$/),m3=(header.TFORM3||'').match(/^(\d+)E$/);
      if(m1&&m2&&m3&&header.TTYPE1==='X'&&header.TTYPE2==='Y'&&header.TTYPE3==='VALUES'){
        const nx=Number(m1[1]),ny=Number(m2[1]),nv=Number(m3[1]);
        const byteCount=nx*4+ny*4+nv*4;
        if(nx>=2&&ny>=2&&nx<=64&&ny<=64&&nv===nx*ny*2&&
           Number(header.NAXIS1)>=byteCount && dataAt+byteCount<=bytes.length){
          const xs:number[]=[],ys:number[]=[],values:number[]=[];
          for(let i=0;i<nx;i++)xs.push(view.getInt32(dataAt+i*4,false));
          for(let i=0;i<ny;i++)ys.push(view.getInt32(dataAt+nx*4+i*4,false));
          for(let i=0;i<nv;i++)values.push(view.getFloat32(dataAt+nx*4+ny*4+i*4,false));
          if(xs.every(finite)&&ys.every(finite)&&values.every(finite))wave={x:xs,y:ys,values};
        }
      }
    }
    if(['IMAGE','FLAGS','VARIANCE','ZODI'].includes(name) && n===2 && width>0 && height>0 && width<=512&&height<=512){
      if(![-32,-64,16,32].includes(bitpix))throw new Error('FITS '+name+' BITPIX desteklenmiyor');
      const bpp=Math.abs(bitpix)/8;
      if(dataAt+width*height*bpp>bytes.length)throw new Error('FITS '+name+' veri kesilmiş');
      const scale=Number(header.BSCALE||1),zero=Number(header.BZERO||0);
      const data=new Float64Array(width*height);
      for(let i=0;i<data.length;i++){
        const p=dataAt+i*bpp;
        const raw=bitpix===-32?view.getFloat32(p,false):bitpix===-64?view.getFloat64(p,false):bitpix===16?view.getInt16(p,false):view.getInt32(p,false);
        data[i]=raw*scale+zero;
      }
      planes[name]={width,height,bitpix,data,header};
    }
    offset=dataAt+Math.ceil(rawBytes/2880)*2880;
  }
  if(!planes.IMAGE||!planes.FLAGS||!planes.VARIANCE||!planes.ZODI){
    throw new Error('SPHEREx bilimsel kesitinde IMAGE/FLAGS/VARIANCE/ZODI katmanları eksik');
  }
  for(const key of ['FLAGS','VARIANCE','ZODI']){
    if(planes[key].width!==planes.IMAGE.width||planes[key].height!==planes.IMAGE.height){
      throw new Error(key+' katmanı IMAGE ile aynı boyutta değil');
    }
  }
  return {planes,wave,epsf,epsfOversampling};
}

function estimateLocalPSF(header:Header,rows:EPSFRow[],centerX:number,centerY:number,oversampling:number):PSFDiagnostic|null{
  if(rows.length===0||!finite(oversampling)||oversampling<=0)return null;
  const baseX=Number(header.CRPIX1W),baseY=Number(header.CRPIX2W);
  const startX=Number(header.CRVAL1W),startY=Number(header.CRVAL2W);
  const stepX=Number(header.CDELT1W||1),stepY=Number(header.CDELT2W||1);
  if(![baseX,baseY,startX,startY,stepX,stepY].every(finite))return null;
  // CRPIX*W locates full-detector spectral coordinates relative to cutout.
  const detectorX=startX+((centerX+1)-baseX)*stepX;
  const detectorY=startY+((centerY+1)-baseY)*stepY;
  let nearest:EPSFRow|null=null,d2=Infinity;
  for(const row of rows){
    const distance=(row.x-detectorX)**2+(row.y-detectorY)**2;
    if(distance<d2){d2=distance;nearest=row;}
  }
  if(!nearest)return null;
  let sum=0,x1=0,y1=0;
  for(let i=0;i<nearest.kernel.length;i++){
    const value=Math.max(0,nearest.kernel[i]);
    if(!finite(value))continue;
    sum+=value;x1+=value*(i%33);y1+=value*Math.floor(i/33);
  }
  if(sum<.1)return null;
  const meanX=x1/sum,meanY=y1/sum;
  let second=0;
  for(let i=0;i<nearest.kernel.length;i++){
    const w=Math.max(0,nearest.kernel[i]);
    if(!finite(w))continue;
    second+=w*((i%33-meanX)**2+(Math.floor(i/33)-meanY)**2);
  }
  const sigma=Math.sqrt(second/(2*sum))/oversampling;
  if(!finite(sigma)||sigma<.05||sigma>4)return null;
  return {status:'measured-from-EPSF',
    detector_zone_x:nearest.binx,detector_zone_y:nearest.biny,
    sigma_native_pix:Number(sigma.toFixed(5)),
    fwhm_arcsec_approx:Number((sigma*2.35482*6.15).toFixed(3)),
    oversampling,method:'local-EPSF-second-moment'};
}

// Correct legacy DR1/QR3 cached widths: old code wrongly divided by 10,
// while archived EPSF calibration is oversampled by 5.
export function normalizeLegacyPSFScience(science:ScienceFrameData):ScienceFrameData{
  if(science.psf?.status!=='measured-from-EPSF'||science.psf.oversampling!==10||
     science.analysis_version?.startsWith('epsf-scale-v3'))return science;
  return {...science,analysis_version:'epsf-scale-v3-migrated',
    psf:{...science.psf,oversampling:5,
      sigma_native_pix:Number((science.psf.sigma_native_pix*2).toFixed(5)),
      fwhm_arcsec_approx:Number((science.psf.fwhm_arcsec_approx*2).toFixed(3))}};
}

function spectralLookup(header:Header, wave:WaveLut|null, x:number,y:number):[number|null,number|null]{
  if(!wave)return [null,null];
  const crpix1=Number(header.CRPIX1W),crpix2=Number(header.CRPIX2W);
  const crval1=Number(header.CRVAL1W),crval2=Number(header.CRVAL2W);
  const cdelt1=Number(header.CDELT1W||1),cdelt2=Number(header.CDELT2W||1);
  if(![crpix1,crpix2,crval1,crval2,cdelt1,cdelt2].every(finite))return [null,null];
  const wx=crval1+((x+1)-crpix1)*cdelt1,wy=crval2+((y+1)-crpix2)*cdelt2;
  const bracket=(arr:number[],v:number)=>{
    if(v<arr[0]||v>arr[arr.length-1])return null;
    for(let i=0;i<arr.length-1;i++)if(v>=arr[i]&&v<=arr[i+1])return [i,(v-arr[i])/(arr[i+1]-arr[i])] as const;
    return null;
  };
  const px=bracket(wave.x,wx),py=bracket(wave.y,wy);
  if(!px||!py)return [null,null];
  const [ix,tx]=px,[iy,ty]=py,nx=wave.x.length;
  const value=(component:number,gx:number,gy:number)=>wave.values[(gy*nx+gx)*2+component];
  const interp=(component:number)=>{
    const v00=value(component,ix,iy),v10=value(component,ix+1,iy);
    const v01=value(component,ix,iy+1),v11=value(component,ix+1,iy+1);
    return (1-ty)*((1-tx)*v00+tx*v10)+ty*((1-tx)*v01+tx*v11);
  };
  const lambda=interp(0),band=interp(1);
  if(!finite(lambda)||!finite(band)||lambda<.5||lambda>6||band<=0||band>1)return [null,null];
  return [Number(lambda.toFixed(6)),Number(band.toFixed(6))];
}

function wcsInverter(header:Header){
  if(!cardVal(header,'CTYPE1').includes('TAN') || !cardVal(header,'CTYPE2').includes('TAN')){
    throw new Error('TAN gökyüzü izdüşümü bulunamadı');
  }
  const n=(key:string,otherwise=NaN)=>Number(header[key]??otherwise);
  const crpix1=n('CRPIX1'),crpix2=n('CRPIX2'),ra0=n('CRVAL1')*deg,dec0=n('CRVAL2')*deg;
  const cd11=n('CD1_1',n('PC1_1',1)*n('CDELT1',1));
  const cd12=n('CD1_2',n('PC1_2',0)*n('CDELT1',1));
  const cd21=n('CD2_1',n('PC2_1',0)*n('CDELT2',1));
  const cd22=n('CD2_2',n('PC2_2',1)*n('CDELT2',1));
  const determinant=cd11*cd22-cd12*cd21;
  if(![crpix1,crpix2,ra0,dec0,determinant].every(finite)||Math.abs(determinant)<1e-12){
    throw new Error('WCS koordinat matrisi geçersiz');
  }
  const sipA:[number,number,number][]=[];
  const sipB:[number,number,number][]=[];
  for(const [key,val] of Object.entries(header)){
    const match=key.match(/^(A|B)_(\d+)_(\d+)$/);
    if(!match)continue;
    const coefficient=Number(val);
    if(!finite(coefficient))continue;
    (match[1]==='A'?sipA:sipB).push([Number(match[2]),Number(match[3]),coefficient]);
  }
  if(header.CTYPE1?.includes('SIP') && !sipA.length && !sipB.length){
    throw new Error('WCS TAN-SIP katsayıları bulunamadı');
  }
  const polynomial=(u:number,v:number,terms:[number,number,number][])=>{
    let result=0;
    for(const [i,j,c] of terms)result+=c*Math.pow(u,i)*Math.pow(v,j);
    return result;
  };
  return (raDeg:number,decDeg:number):[number,number]=>{
    const ra=raDeg*deg,dec=decDeg*deg;
    const dra=Math.atan2(Math.sin(ra-ra0),Math.cos(ra-ra0));
    const cosc=Math.sin(dec0)*Math.sin(dec)+Math.cos(dec0)*Math.cos(dec)*Math.cos(dra);
    if(cosc<=0) return [NaN,NaN];
    const xi=(Math.cos(dec)*Math.sin(dra)/cosc)/deg;
    const eta=((Math.cos(dec0)*Math.sin(dec)-Math.sin(dec0)*Math.cos(dec)*Math.cos(dra))/cosc)/deg;
    const uTarget=(xi*cd22-eta*cd12)/determinant;
    const vTarget=(eta*cd11-xi*cd21)/determinant;
    let u=uTarget,v=vTarget;
    for(let iteration=0;iteration<12;iteration++){
      const un=uTarget-polynomial(u,v,sipA);
      const vn=vTarget-polynomial(u,v,sipB);
      if(!finite(un)||!finite(vn))return [NaN,NaN];
      if(Math.abs(un-u)+Math.abs(vn-v)<1e-6){u=un;v=vn;break;}
      u=un;v=vn;
    }
    return [u+crpix1-1,v+crpix2-1];
  };
}

function quantile(sorted:number[],fraction:number){
  if(!sorted.length)return 0;
  return sorted[Math.max(0,Math.min(sorted.length-1,Math.floor((sorted.length-1)*fraction)))];
}
// SPHEREx bit assignments: NASA/IPAC spectrophotometry help and Explanatory
// Supplement. These are EXPLORATORY display exclusions, not an L3 fit.
// SOURCE (21), indicating a detected source, must NOT be blindly excluded.
const badFlags=[0,1,2,6,7,9,10,11,14,15,17,19,20,22,25,26,27,28,29]
  .reduce((mask,bit)=>mask|(1<<bit),0);

export async function renderScienceFits(bytes:Uint8Array,centerRa:number,centerDec:number,fieldDeg=0.16):Promise<{
  png:string;width:number;height:number;native_width:number;native_height:number;
  science:ScienceFrameData;note:string;
}> {
  const parsed=parseHeaders(bytes),p=parsed.planes,image=p.IMAGE,mask=p.FLAGS,variance=p.VARIANCE,zodi=p.ZODI;
  const worldToPixel=wcsInverter(image.header);
  const size=96;
  if(Math.abs(centerDec)>89.5)throw new Error('Kutup yakınında standart TAN grid ölçeklemesi desteklenmiyor');
  const flux:(number|null)[]=new Array(size*size).fill(null);
  const varianceResult:(number|null)[]=new Array(size*size).fill(null);
  const wavelength:(number|null)[]=new Array(size*size).fill(null);
  const bandwidth:(number|null)[]=new Array(size*size).fill(null);
  const values:number[]=[];
  let masked=0,badCount=0,inBounds=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const gridIndex=y*size+x;
    // Standard sky presentation: north up, east left.
    const ra=centerRa-(x-(size-1)/2)*fieldDeg/size/Math.cos(centerDec*deg);
    const dec=centerDec+((size-1)/2-y)*fieldDeg/size;
    const [px,py]=worldToPixel(ra,dec);
    const ix=Math.round(px),iy=Math.round(py);
    if(!finite(px)||!finite(py)||ix<0||iy<0||ix>=image.width||iy>=image.height)continue;
    inBounds++;
    const sample=iy*image.width+ix;
    const raw=image.data[sample],v=variance.data[sample],background=zodi.data[sample];
    const bitFlags=(mask.data[sample]|0);
    if((bitFlags&badFlags)!==0){badCount++;masked++;continue;}
    if(!finite(raw)||!finite(v)||v<=0||!finite(background)){masked++;continue;}
    // ZODI is explicitly NOT subtracted by NASA in IMAGE.
    // Subtracting the model assists inspection; uncertainties remain approximate.
    const intensity=raw-background;
    flux[gridIndex]=Number(intensity.toFixed(6));
    varianceResult[gridIndex]=Number(v.toFixed(8));
    const wave=spectralLookup(image.header,parsed.wave,ix,iy);
    wavelength[gridIndex]=wave[0];bandwidth[gridIndex]=wave[1];
    values.push(intensity);
  }
  if(values.length<100)throw new Error('WCS yeniden örneklemede yeterli geçerli piksel yok');
  values.sort((a,b)=>a-b);
  const validWavelengths=wavelength.filter((item):item is number=>item!==null&&finite(item)).sort((a,b)=>a-b);
  const validBandwidths=bandwidth.filter((item):item is number=>item!==null&&finite(item)).sort((a,b)=>a-b);
  const lo=quantile(values,0.02),hi=Math.max(lo+1e-8,quantile(values,0.995));
  const pixels=Buffer.alloc(size*size*3);
  for(let i=0;i<flux.length;i++){
    const dest=i*3,value=flux[i];
    if(value===null){
      pixels[dest]=9;pixels[dest+1]=17;pixels[dest+2]=35;
    }else{
      const normalized=Math.max(0,Math.min(1,(value-lo)/(hi-lo)));
      const a=Math.asinh(7*normalized)/Math.asinh(7);
      // Explicitly labelled false-colour palette (not a measured RGB image).
      const stops=[[8,15,35],[41,54,102],[91,87,160],[183,118,166],[247,173,128],[255,235,194]];
      const point=a*(stops.length-1),k=Math.min(stops.length-2,Math.floor(point)),t=point-k;
      for(let c=0;c<3;c++)pixels[dest+c]=Math.round(stops[k][c]*(1-t)+stops[k+1][c]*t);
    }
  }
  // Upscaling improves display interpolation only; never add invented source detail.
  const rendered=await sharp(pixels,{raw:{width:size,height:size,channels:3}})
    .resize(576,576,{kernel:'lanczos3'}).png({compressionLevel:7}).toBuffer();
  const science:ScienceFrameData={
    analysis_version:'epsf-scale-v3-fits-header',
    grid_size:size,grid_field_deg:fieldDeg,flux,variance:varianceResult,
    wavelength_um:wavelength,bandwidth_um:bandwidth,
    center_wavelength_um:validWavelengths.length?quantile(validWavelengths,.5):null,
    center_bandwidth_um:validBandwidths.length?quantile(validBandwidths,.5):null,
    valid_fraction:Number((values.length/(size*size)).toFixed(3)),
    flagged_fraction:Number((badCount/Math.max(1,inBounds)).toFixed(3)),
    native_width:image.width,native_height:image.height,
    preview_width:576,preview_height:576,wcs:'TAN-SIP',units:'MJy/sr',
    wavelength_status:parsed.wave?'WCS-WAVE-approximate':'unavailable',p02:lo,p98:hi,median:quantile(values,.5),
    masked_pixels:masked,
    psf:estimateLocalPSF(image.header,parsed.epsf,(image.width-1)/2,(image.height-1)/2,parsed.epsfOversampling)
  };
  return {png:'data:image/png;base64,'+rendered.toString('base64'),width:576,height:576,
    native_width:image.width,native_height:image.height,science,
    note:'WCS TAN-SIP gökyüzü gridi; IMAGE−ZODI; FLAGS/VARIANCE, yaklaşık WCS-WAVE. EPSF tablosundan yerel PSF genişliği ölçülür (varsa); bu ölçüm tek başına tam PSF uyumlulaştırması veya hassas fotometri değildir. Bilimsel doğrulama için CWAVE/CBAND ve fotometrik kalibrasyon gereklidir.'};
}