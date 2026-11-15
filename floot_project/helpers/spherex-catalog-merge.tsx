// Preserve known NASA observations when a refreshed SIA catalogue returns a
// different subset. These are catalogue *references*; no fake observations
// or flux measurements are created here.
type FrameRef={observed_utc:string;source_fits_cutout_url:string};
type CatalogRecord={frames?:FrameRef[];[key:string]:unknown};
export function preserveCatalogObservations(oldRecord:unknown,newRecord:unknown):unknown{
  if(!newRecord||typeof newRecord!=='object')return newRecord;
  const next=newRecord as CatalogRecord;
  const previous=oldRecord&&typeof oldRecord==='object'?oldRecord as CatalogRecord:{};
  const combined:FrameRef[]=[];
  const seen=new Set<string>();
  for(const row of [...(previous.frames||[]),...(next.frames||[])]){
    if(!row||typeof row.source_fits_cutout_url!=='string'||
       typeof row.observed_utc!=='string'||!row.source_fits_cutout_url.startsWith('https://irsa.ipac.caltech.edu/ibe/data/spherex/'))continue;
    const source=row.source_fits_cutout_url;
    if(seen.has(source))continue;
    seen.add(source);
    combined.push(row);
  }
  combined.sort((a,b)=>a.observed_utc.localeCompare(b.observed_utc));
  return {...next,frames:combined.slice(0,72)};
}