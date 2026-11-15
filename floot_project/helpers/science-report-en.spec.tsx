import React from 'react';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import ScienceReport from '../components/ScienceReport';
import type {ScienceFrameData} from './science-fits';

const science=(w:number):ScienceFrameData=>({
  grid_size:24,grid_field_deg:.1,valid_fraction:.98,flagged_fraction:.02,
  flux:Array(24*24).fill(1),variance:Array(24*24).fill(.01),
  wavelength_um:Array(24*24).fill(w),bandwidth_um:Array(24*24).fill(.08),
  center_wavelength_um:w,center_bandwidth_um:.08,
  native_width:117,native_height:117,preview_width:576,preview_height:576,
  psf:null,wcs:'TAN-SIP',units:'MJy/sr'
} as unknown as ScienceFrameData);
const frames=[
  {observed_utc:'2025-08-25T17:08:00Z',science:science(1.517)},
  {observed_utc:'2025-08-30T04:10:00Z',science:science(1.496)}
];

describe('Scientific report English dynamic labels',()=>{
  afterEach(()=>cleanup());
  it('shows frame-pair caption in English rather than Kare ... ve ...',async()=>{
    spyOn(globalThis,'fetch').and.resolveTo({json:async()=>({passed:15,total:15,synthetic_only:true})} as Response);
    const {container}=render(<ScienceReport target="Barnard's Star" frames={frames} processing={false}/>);
    await waitFor(()=>expect(screen.getByText('Frames 1 and 2')).toBeTruthy());
    const text=container.textContent||'';
    expect(text).not.toContain('Kare 1 ve 2');
    expect(text).toContain('Frames 1 and 2');
    expect(text).toContain('Spectral overlap across all date pairs (1 pair)');
    expect(text).not.toContain('1 çift');
  });
  it('warns when all central stellar pixels are missing despite ready FITS layers',()=>{
    spyOn(globalThis,'fetch').and.resolveTo({json:async()=>({passed:15,total:15,synthetic_only:true})} as Response);
    const masked=frames.map(frame=>{
      const base=frame.science;
      return {...frame,science:{...base,flux:base.flux.map((value,index)=>{
        const x=index%24-11.5,y=Math.floor(index/24)-11.5;
        return Math.hypot(x,y)<2?null:value;
      })}};
    });
    render(<ScienceReport target="R Draconis" targetId="r-dra" frames={masked} processing={false}/>);
    const warning=screen.getByRole('note');
    expect(warning.textContent).toContain('Central-star photometry is unavailable in 2 of 2 science frames');
    expect(warning.textContent).toContain('NOT measurements of the star');
  });
  it('provides stable save/open links for Markdown and JSON research exports',async()=>{
    spyOn(globalThis,'fetch').and.resolveTo({json:async()=>({passed:15,total:15,synthetic_only:true})} as Response);
    const click=spyOn(HTMLAnchorElement.prototype,'click').and.stub();
    render(<ScienceReport target="Barnard's Star" frames={frames} processing={false}/>);
    fireEvent.click(screen.getByText('Raporu indir · Markdown'));
    let link=screen.getByRole('link',{name:'Direct download'}) as HTMLAnchorElement;
    expect(link.download).toBe('SPHEREx_Barnard_s_Star_Scientific_Report_EN.md');
    expect(link.href.startsWith('blob:')).toBe(true);
    fireEvent.click(screen.getByText('Ölçüm özetini indir · JSON'));
    link=screen.getByRole('link',{name:'Direct download'}) as HTMLAnchorElement;
    expect(link.download).toBe('SPHEREx_Barnard_s_Star_Scientific_Data_EN.json');
    fireEvent.click(screen.getByRole('button',{name:'Preview here'}));
    expect(screen.getByRole('dialog',{name:link.download})).not.toBeNull();
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Return to sky explorer'}));
  });
  it('never offers a Barnard export after switching to Epsilon Indi B',()=>{
    spyOn(globalThis,'fetch').and.resolveTo({json:async()=>({passed:15,total:15,synthetic_only:true})} as Response);
    spyOn(HTMLAnchorElement.prototype,'click').and.stub();
    const {rerender}=render(<ScienceReport target="Barnard's Star" frames={frames} processing={false}/>);
    fireEvent.click(screen.getByText('Ölçüm özetini indir · JSON'));
    expect((screen.getByRole('link',{name:'Direct download'}) as HTMLAnchorElement).download)
      .toBe('SPHEREx_Barnard_s_Star_Scientific_Data_EN.json');
    rerender(<ScienceReport target="Epsilon Indi B" targetId="eps-indi-b" frames={frames} processing={false}/>);
    expect(screen.queryByRole('link',{name:'Direct download'})).toBeNull();
    fireEvent.click(screen.getByText('Ölçüm özetini indir · JSON'));
    expect((screen.getByRole('link',{name:'Direct download'}) as HTMLAnchorElement).download)
      .toBe('SPHEREx_Epsilon_Indi_B_Scientific_Data_EN.json');
  });
});