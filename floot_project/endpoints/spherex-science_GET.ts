import { schema,type OutputType } from './spherex-science_GET.schema';
import { renderScienceFits } from '../helpers/science-fits';
import {loadCachedScience,saveScience} from '../helpers/spherex-cache';
export async function handle(request:Request){
  const requestUrl=new URL(request.url);
  const parsed=schema.safeParse(Object.fromEntries(requestUrl.searchParams));
  if(!parsed.success)return Response.json({error:'FITS bağlantısı geçersiz.'},{status:400});
  let url:URL;
  try{url=new URL(parsed.data.url)}catch{return Response.json({error:'URL geçersiz.'},{status:400})}
  const center=url.searchParams.get('center')||'';
  const coords=center.match(/^([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?)d?$/);
  const size=url.searchParams.get('size');
  if(url.protocol!=='https:'||url.hostname!=='irsa.ipac.caltech.edu'||
    !/^\/ibe\/data\/spherex\/(qr3|dr1)\/level2\//.test(url.pathname)||
    !url.pathname.endsWith('.fits')||!coords||!['0.1','0.2'].includes(size||'')||
    Number(coords[1])<0||Number(coords[1])>360||Math.abs(Number(coords[2]))>90){
    return Response.json({error:'Yalnızca güvenli NASA/IPAC SPHEREx kesit URL ve koordinatları kabul edilir.'},{status:400});
  }
  try{
    const cached=await loadCachedScience(url.toString());
    const upgrade=requestUrl.searchParams.get('upgrade')==='epsf';
    if(cached&&(!upgrade||cached.science.psf?.status==='measured-from-EPSF')){
      return Response.json(cached,{headers:{'Cache-Control':'public,max-age=3600','X-SPHEREx-Cache':'HIT'}});
    }
    // A 503 is a temporary NASA cutout-service failure, not evidence that a
    // stored observation is invalid. Use a strictly bounded, slow retry, and
    // respect Retry-After instead of sending simultaneous requests.
    let res:Response|null=null;
    for(let attempt=1;attempt<=3;attempt++){
      try{
        res=await fetch(url,{signal:AbortSignal.timeout(45000),redirect:'error',
          headers:{'User-Agent':'SPHERExSkyExplorer/1.3 science; contact via app'}});
        if(res.ok)break;
        if(![429,502,503,504].includes(res.status)||attempt===3)break;
        const retryAfter=Number(res.headers.get('Retry-After')||0);
        const delay=retryAfter>0?Math.min(30000,retryAfter*1000):attempt*7000;
        await new Promise(resolve=>setTimeout(resolve,delay));
      }catch(error){
        if(attempt===3)throw error;
        await new Promise(resolve=>setTimeout(resolve,attempt*7000));
      }
    }
    if(!res)throw new Error('NASA FITS bağlantısı yanıt vermedi');
    if(!res.ok)throw new Error('NASA FITS HTTP '+res.status);
    const length=Number(res.headers.get('content-length')||0);
    if(length>20_000_000)throw new Error('FITS veri boyutu sınır dışı');
    const bytes=new Uint8Array(await res.arrayBuffer());
    if(bytes.byteLength<2880||bytes.byteLength>20_000_000)throw new Error('FITS bozuk veya çok büyük');
    const result:OutputType=await renderScienceFits(bytes,Number(coords[1]),Number(coords[2]),size==='0.1'?0.08:0.16);
    // Never report an unsaved frame as permanently archived. The frontend
    // already retries failed candidate requests and can choose another visit.
    // A silent cache-write failure previously led to false success messages.
    try{
      await saveScience(url.toString(),bytes,result);
    }catch(error){
      const reason=error instanceof Error?error.message:String(error);
      console.error('SPHEREx NASA FITS database persistence failed',reason);
      return Response.json({
        error:'Gerçek NASA FITS görüntüsü işlendi fakat kalıcı veritabanına kaydedilemedi: '+reason+
          '. Aynı gözlem için kaydetme işlemi yeniden denenebilir.'
      },{status:503,headers:{'Cache-Control':'no-store'}});
    }
    return Response.json({...result,from_cache:false},{headers:{'Cache-Control':'public, max-age=900','X-SPHEREx-Cache':'MISS'}});
  }catch(err){
    return Response.json({error:'Bilimsel FITS hazırlığı başarısız: '+(err instanceof Error?err.message:'Bilinmeyen hata')},{status:502});
  }
}