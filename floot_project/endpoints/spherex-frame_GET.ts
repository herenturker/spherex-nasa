import sharp from 'sharp';
import { schema, type OutputType } from './spherex-frame_GET.schema';

type ImageHDU = { width:number; height:number; pixelValues: number[] };

function getFirstImageHDU(bytes:Uint8Array):ImageHDU {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const decoder=new TextDecoder('ascii');
  let offset=0;
  for(let hdu=0;hdu<8 && offset<bytes.length;hdu++){
    const cards:string[]=[];
    let endFound=false;
    for(let i=0;i<4000;i++){
      if(offset+(i+1)*80>bytes.length)throw new Error('FITS header yarım kaldı.');
      const line=decoder.decode(bytes.subarray(offset+i*80,offset+(i+1)*80));
      cards.push(line);
      if(line.slice(0,8).trim()==='END'){endFound=true;break;}
    }
    if(!endFound)throw new Error('FITS END kartı bulunamadı.');
    function getVal(key:string):string {
      const found=cards.find(x=>x.slice(0,8).trim()===key);
      return found ? found.slice(10).split('/')[0].trim().replace(/^'|'$/g,'').trim() : '';
    }
    const bitpix=Number(getVal('BITPIX')), axes=Number(getVal('NAXIS')), numPixels=axes?Array.from({length:axes},(_,i)=>Number(getVal('NAXIS'+(i+1)))).reduce((a,b)=>a*b,1):0;
    const headerBytes=Math.ceil(cards.length*80/2880)*2880;
    const rawSize=(numPixels*Math.abs(bitpix)/8+Number(getVal('PCOUNT')||0))*(Number(getVal('GCOUNT')||1));
    const dataAt=offset+headerBytes;
    const dataBytes=Math.ceil(rawSize/2880)*2880;
    const width=Number(getVal('NAXIS1')),height=Number(getVal('NAXIS2'));
    const ext=getVal('EXTNAME').toUpperCase();
    if(hdu>0 && axes===2 && ext==='IMAGE' && width>0 && height>0 && width<=512 && height<=512 && [-32,-64,16,32].includes(bitpix)){
      const bpp=Math.abs(bitpix)/8;
      if(dataAt+width*height*bpp>bytes.length)throw new Error('FITS IMAGE verisi kesilmiş.');
      const scale=Number(getVal('BSCALE')||1),zero=Number(getVal('BZERO')||0);
      const arr:number[]=[];
      for(let i=0;i<width*height;i++){
        const off=dataAt+i*bpp;
        const raw=bitpix===-32?view.getFloat32(off,false):bitpix===-64?view.getFloat64(off,false):bitpix===16?view.getInt16(off,false):view.getInt32(off,false);
        arr.push(raw*scale+zero);
      }
      return {width,height,pixelValues:arr};
    }
    offset=dataAt+dataBytes;
  }
  throw new Error('Geçerli 2B FITS IMAGE katmanı bulunamadı.');
}

function imagePreview({width,height,pixelValues}:ImageHDU):Uint8Array {
  const valid=pixelValues.filter(Number.isFinite).sort((a,b)=>a-b);
  if(valid.length<30)throw new Error('Görüntüde yeterli geçerli piksel yok.');
  const lo=valid[Math.floor((valid.length-1)*0.02)];
  let hi=valid[Math.floor((valid.length-1)*0.995)];
  if(hi<=lo) hi=lo+1e-8;
  const pixels=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const value=pixelValues[y*width+x];
    let q=Number.isFinite(value)?Math.max(0,Math.min(1,(value-lo)/(hi-lo))):0;
    q=Math.asinh(5*q)/Math.asinh(5);
    pixels[(height-1-y)*width+x]=Math.round(q*255);
  }
  return pixels;
}

export async function handle(request:Request){
  const parsed=schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!parsed.success)return Response.json({error:'Geçersiz görüntü bağlantısı.'},{status:400});
  let imageUrl:URL;
  try {imageUrl=new URL(parsed.data.url);} catch {return Response.json({error:'Geçersiz adres.'},{status:400});}
  if(imageUrl.protocol!=='https:' || imageUrl.hostname!=='irsa.ipac.caltech.edu'
    || !/^\/ibe\/data\/spherex\/(qr3|dr1)\/level2\//.test(imageUrl.pathname)
    || !imageUrl.pathname.endsWith('.fits')
    || !/^[-+]?\d+(\.\d+)?,[-+]?\d+(\.\d+)?d?$/.test(imageUrl.searchParams.get('center')||'')
    || imageUrl.searchParams.get('size')!=='0.1')
    return Response.json({error:'Yalnızca NASA/IPAC SPHEREx FITS cutout bağlantıları kullanılabilir.'},{status:400});
  try {
    // Tek istek = bir NASA denemesi; üç tekrar arayüzde görünür biçimde yönetilir.
    const response=await fetch(imageUrl,{signal:AbortSignal.timeout(65000),redirect:'error',headers:{'User-Agent':'SPHERExSkyExplorer/1.0'}});
    if(!response.ok)throw new Error('NASA FITS HTTP '+response.status);
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.byteLength>20_000_000)throw new Error('FITS dosyası beklenen sınırdan büyük.');
    if(bytes.byteLength<2880)throw new Error('FITS dosyası boş veya eksik.');
    const img=getFirstImageHDU(bytes);
    const grayscale=imagePreview(img);
    const png=await sharp(Buffer.from(grayscale),{raw:{width:img.width,height:img.height,channels:1}}).png().toBuffer();
    const output:OutputType={png:'data:image/png;base64,'+png.toString('base64'),width:img.width,height:img.height,
      note:'Kare bazında kontrast ölçeklenmiş bilimsel olmayan önizleme. Hassas hareket ölçümü için WCS yeniden örnekleme ve spektral eşleştirme gerekir.'};
    return Response.json(output,{headers:{'Cache-Control':'public, max-age=3600'}});
  }catch(error){
    return Response.json({error:'FITS görüntüsü işlenemedi: '+(error instanceof Error?error.message:'Bilinmeyen hata')},{status:502});
  }
}