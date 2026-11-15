import {chooseDefaultComparison} from './science-default-pair';
import type {ScienceFrameData} from './science-fits';
function sci(wave:number,coverage=1):ScienceFrameData{
  const size=24,n=size*size;
  return {grid_size:size,grid_field_deg:0.1,valid_fraction:coverage,
    flux:Array(n).fill(1),variance:Array(n).fill(.02),
    wavelength_um:Array(n).fill(wave),bandwidth_um:Array(n).fill(.05)
  } as unknown as ScienceFrameData;
}
const row=(date:string,science:ScienceFrameData)=>({observed_utc:date,science});
describe('Default scientific comparison selection',()=>{
  it('prefers two different dates with actual spectral overlap',()=>{
    const obs=[row('2025-01-01',sci(1.1)),row('2025-01-02',sci(1.5)),row('2025-01-03',sci(1.1))];
    expect(chooseDefaultComparison(obs)).toEqual({first:0,second:2,matched:576,scientificallyComparable:true});
  });
  it('shows a single observation as a visual control if bands do not overlap',()=>{
    const obs=[row('2025-01-01',sci(1.1)),row('2025-01-02',sci(1.5))];
    expect(chooseDefaultComparison(obs)).toEqual({first:0,second:0,matched:0,scientificallyComparable:false});
  });
  it('does not treat duplicate timestamps as temporal changes',()=>{
    const obs=[row('2025-01-01',sci(1.1)),row('2025-01-01',sci(1.1))];
    expect(chooseDefaultComparison(obs).scientificallyComparable).toBe(false);
  });
  it('rejects poor-quality grids even if their passbands match',()=>{
    const obs=[row('2025-01-01',sci(1.1,.4)),row('2025-01-02',sci(1.1,.9))];
    expect(chooseDefaultComparison(obs)).toEqual({first:1,second:1,matched:0,scientificallyComparable:false});
  });
  it('does not mistake missing variance values for valid comparisons',()=>{
    const a=sci(1.1),b=sci(1.1);b.variance.fill(null);
    const result=chooseDefaultComparison([row('2025-01-01',a),row('2025-01-02',b)]);
    expect(result.scientificallyComparable).toBe(false);
  });
  it('prefers a separated epoch even when a same-day pair has more matched pixels',()=>{
    const early=sci(1.1),close=sci(1.1),late=sci(1.1);
    // A long-baseline pair has 476 valid spectral pixels; a same-day pair
    // has all 576. Both are above the strict >=300-pixel screening gate.
    for(let i=0;i<100;i++)late.wavelength_um[i]=1.8;
    const selected=chooseDefaultComparison([
      row('2025-05-01T00:00:00Z',early),
      row('2025-05-01T00:04:00Z',close),
      row('2025-11-01T00:00:00Z',late)
    ]);
    expect(selected).toEqual({first:0,second:2,matched:476,scientificallyComparable:true});
  });
  it('falls back to short baseline only if no 14-day science pair exists',()=>{
    const a=sci(1.1),b=sci(1.1);
    const result=chooseDefaultComparison([
      row('2026-01-01T00:00:00Z',a),row('2026-01-01T00:03:00Z',b)]);
    expect(result).toEqual({first:0,second:1,matched:576,scientificallyComparable:true});
  });
});