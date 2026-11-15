import {preserveCatalogObservations} from './spherex-catalog-merge';
const prefix='https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/';
const frame=(stamp:string)=>({observed_utc:stamp,source_fits_cutout_url:prefix+stamp+'.fits?center=1,2d&size=0.1'});
describe('Permanent NASA catalogue references',()=>{
  it('keeps previously prepared observations after a short refreshed result',()=>{
    const previous={frames:[frame('2025-01-01'),frame('2025-01-02'),frame('2025-01-03')]};
    const fresh={frames:[frame('2025-01-02')],available_count:1};
    const merged=preserveCatalogObservations(previous,fresh) as typeof fresh;
    expect(merged.frames.length).toBe(3);
    expect(merged.frames.map(x=>x.observed_utc)).toEqual(['2025-01-01','2025-01-02','2025-01-03']);
    expect(merged.available_count).toBe(1);
  });
  it('adds new observations without duplicate images',()=>{
    const old={frames:[frame('2025-01-01')]};
    const fresh={frames:[frame('2025-01-01'),frame('2025-01-04')]};
    const merged=preserveCatalogObservations(old,fresh) as typeof fresh;
    expect(merged.frames.length).toBe(2);
  });
  it('does not invent an observation from unrelated URLs',()=>{
    const result=preserveCatalogObservations({frames:[{observed_utc:'2025-01-05',source_fits_cutout_url:'https://example.org/false.fits'}]},{frames:[]}) as {frames:unknown[]};
    expect(result.frames).toEqual([]);
  });
});