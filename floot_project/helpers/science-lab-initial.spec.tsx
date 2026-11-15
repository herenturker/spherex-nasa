import React from 'react';
import {render,fireEvent,cleanup} from '@testing-library/react';
import ScienceLab from '../components/ScienceLab';
import type {ScienceFrameData} from './science-fits';
import {exportTargetName} from './export-filename';

function science(wave:number):ScienceFrameData{
  const n=24*24;
  return {
    grid_size:24,grid_field_deg:.1,valid_fraction:1,flagged_fraction:0,
    flux:Array(n).fill(1),variance:Array(n).fill(.01),
    wavelength_um:Array(n).fill(wave),bandwidth_um:Array(n).fill(.05),
    center_wavelength_um:wave,center_bandwidth_um:.05,
    native_width:117,native_height:117,preview_width:576,preview_height:576,
    psf:null,wcs:'TAN-SIP',units:'MJy/sr'
  } as unknown as ScienceFrameData;
}
const frames=[
  {observed_utc:'2025-04-24T22:09:00Z',science:science(1.11)},
  {observed_utc:'2025-04-25T02:00:00Z',science:science(1.5)},
  {observed_utc:'2025-10-01T17:54:00Z',science:science(1.11)}
];
function ui(data=frames,target='Epsilon Indi B'){
  return <ScienceLab frames={data} target={target} loading={false}
    processing={false} cutoutSize="0.2" onCutoutChange={()=>{}} onProcess={()=>{}}/>;
}

describe('ScienceLab jury-safe initial state',()=>{
  beforeEach(()=>{
    const ctx={
      createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),
      putImageData:()=>{},
      drawImage:()=>{},
      imageSmoothingEnabled:true,
      imageSmoothingQuality:'high'
    };
    spyOn(HTMLCanvasElement.prototype,'getContext').and.returnValue(ctx as unknown as CanvasRenderingContext2D);
  });
  afterEach(()=>cleanup());

  it('opens on a valid distant-epoch difference without clicking the best-pair button',()=>{
    const {container}=render(ui());
    const selects=container.querySelectorAll('select');
    expect(selects[1].value).toBe('0');
    expect(selects[2].value).toBe('2');
    expect(container.textContent).toContain('Automatically selected');
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('permits manual choice, then automatically resets for a new dataset',()=>{
    const {container,rerender}=render(ui());
    const selects=container.querySelectorAll('select');
    fireEvent.change(selects[2],{target:{value:'1'}});
    expect(selects[2].value).toBe('1');
    rerender(ui([...frames]));
    expect(container.querySelectorAll('select')[2].value).toBe('2');
    expect(container.querySelector('canvas')).not.toBeNull();
  });
  it('downloads the displayed difference map as a 576px PNG with dates in the filename',()=>{
    const encode=spyOn(HTMLCanvasElement.prototype,'toDataURL').and.returnValue('data:image/png;base64,AAAA');
    const click=spyOn(HTMLAnchorElement.prototype,'click').and.stub();
    const {getByRole}=render(ui());
    fireEvent.click(getByRole('button',{name:'Download displayed sky image as PNG'}));
    expect(encode).toHaveBeenCalledWith('image/png');
    expect((encode.calls.mostRecent().object as HTMLCanvasElement).width).toBe(576);
    expect((encode.calls.mostRecent().object as HTMLCanvasElement).height).toBe(576);
    expect(click).not.toHaveBeenCalled();
    const anchor=getByRole('link',{name:'Direct download'}) as HTMLAnchorElement;
    expect(anchor.href.startsWith('blob:')).toBe(true);
    expect(anchor.target).toBe('_blank');
    expect(anchor.download).toContain('Difference');
    expect(anchor.download).toContain('20250424T220900Z');
    expect(anchor.download).toContain('20251001T175400Z');
    expect(anchor.download.endsWith('.png')).toBe(true);
    fireEvent.click(getByRole('button',{name:'Preview here'}));
    expect(getByRole('dialog',{name:anchor.download})).not.toBeNull();
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(getByRole('button',{name:'Return to sky explorer'}));
    expect(click).not.toHaveBeenCalled();
  });
  it('uses the native share sheet for iPad and leaves direct links available',()=>{
    spyOn(HTMLCanvasElement.prototype,'toDataURL').and.returnValue('data:image/png;base64,AAAA');
    const click=spyOn(HTMLAnchorElement.prototype,'click').and.stub();
    const originals=['userAgent','share','canShare'].map(key=>
      ({key,descriptor:Object.getOwnPropertyDescriptor(navigator,key)}));
    const share=jasmine.createSpy('share').and.returnValue(Promise.resolve());
    try{
      Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'});
      Object.defineProperty(navigator,'share',{configurable:true,value:share});
      Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
      const {getByRole}=render(ui());
      fireEvent.click(getByRole('button',{name:'Download displayed sky image as PNG'}));
      expect(share).not.toHaveBeenCalled();
      fireEvent.click(getByRole('button',{name:'Preview here'}));
      expect(share).not.toHaveBeenCalled();
      fireEvent.click(getByRole('button',{name:'Return to sky explorer'}));
      fireEvent.click(getByRole('button',{name:'Save / Share file'}));
      expect(share).toHaveBeenCalledTimes(1);
      expect(share.calls.mostRecent().args[0].files[0].type).toBe('image/png');
      expect(click).not.toHaveBeenCalled();
      expect(getByRole('link',{name:'Direct download'})).not.toBeNull();
    }finally{
      for(const {key,descriptor} of originals){
        if(descriptor)Object.defineProperty(navigator,key,descriptor);
        else Reflect.deleteProperty(navigator,key);
      }
    }
  });
  it('exports the currently selected blend rather than a previously shown difference map',()=>{
    spyOn(HTMLCanvasElement.prototype,'toDataURL').and.returnValue('data:image/png;base64,AAAA');
    const click=spyOn(HTMLAnchorElement.prototype,'click').and.stub();
    const {getByText,getByRole}=render(ui());
    fireEvent.click(getByText('Önce / sonra karışımı'));
    fireEvent.click(getByRole('button',{name:'Download displayed sky image as PNG'}));
    const anchor=getByRole('link',{name:'Direct download'}) as HTMLAnchorElement;
    expect(click).not.toHaveBeenCalled();
    expect(anchor.download).toContain('_Blend_');
  });
  it('keeps scientific CSV and provenance JSON accessible as persistent files',()=>{
    const click=spyOn(HTMLAnchorElement.prototype,'click').and.stub();
    const {getByRole}=render(ui());
    fireEvent.click(getByRole('button',{name:'Bilimsel CSV'}));
    let saved=getByRole('link',{name:'Direct download'}) as HTMLAnchorElement;
    expect(saved.download).toBe('SPHEREx_Epsilon_Indi_B_aligned_science_comparison.csv');
    expect(saved.href.startsWith('blob:')).toBe(true);
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(getByRole('button',{name:'Preview here'}));
    expect(getByRole('dialog',{name:saved.download})).not.toBeNull();
    fireEvent.click(getByRole('button',{name:'Return to sky explorer'}));
    fireEvent.click(getByRole('button',{name:'Kaynak/Metot JSON'}));
    saved=getByRole('link',{name:'Direct download'}) as HTMLAnchorElement;
    expect(saved.download).toBe('SPHEREx_Epsilon_Indi_B_science_provenance.json');
    expect(saved.href.startsWith('blob:')).toBe(true);
    expect(getByRole('button',{name:'Preview here'})).not.toBeNull();
    expect(click).not.toHaveBeenCalled();
  });
  it('updates the visualization metric when switching from difference to weighted blend',()=>{
    const {getByText,queryByText}=render(ui());
    expect(getByText('Difference visualization')).not.toBeNull();
    expect(getByText('Median-centered')).not.toBeNull();
    fireEvent.click(getByText('Önce / sonra karışımı'));
    expect(getByText('Visualization')).not.toBeNull();
    expect(getByText('Weighted infrared blend')).not.toBeNull();
    expect(queryByText('Median-centered')).toBeNull();
    fireEvent.click(getByText('Göreli fark haritası'));
    expect(getByText('Median-centered')).not.toBeNull();
  });
  it('clears stale export links when the selected sky target changes',()=>{
    spyOn(HTMLAnchorElement.prototype,'click').and.stub();
    const {rerender,getByRole,queryByRole}=render(ui());
    fireEvent.click(getByRole('button',{name:'Bilimsel CSV'}));
    expect(getByRole('link',{name:'Direct download'})).not.toBeNull();
    rerender(ui(frames,"Barnard's Star"));
    expect(queryByRole('link',{name:'Direct download'})).toBeNull();
  });
  it('normalizes target names consistently for all five NASA test targets',()=>{
    expect(exportTargetName('Epsilon Indi B')).toBe('Epsilon_Indi_B');
    expect(exportTargetName("Barnard's Star")).toBe('Barnard_s_Star');
    expect(exportTargetName('WISE 0855−0714')).toBe('WISE_0855_0714');
    expect(exportTargetName('RW Aurigae')).toBe('RW_Aurigae');
    expect(exportTargetName('R Draconis')).toBe('R_Draconis');
    expect(exportTargetName('Çemberlitaş Yıldızı')).toBe('Cemberlitas_Yildizi');
  });
  it('marks WISE 0855 frames as sky-field data, not a confirmed dwarf detection',()=>{
    const {getByText,queryByText,rerender}=render(ui(frames,'WISE 0855−0714'));
    expect(getByText(/NOT a verified detection or positional measurement/)).not.toBeNull();
    expect(getByText('WISE 0855−0714')).not.toBeNull();
    rerender(ui(frames,"Barnard's Star"));
    expect(queryByText(/NOT a verified detection or positional measurement/)).toBeNull();
  });
  it('states explicitly that the difference image is not measured proper motion',()=>{
    const {getByRole}=render(ui());
    expect(getByRole('note').textContent).toContain('not a measured stellar position or confirmed proper motion');
  });
  it('does not leak Turkish in the short-baseline warning and scientific metrics in English',()=>{
    const short=[
      {observed_utc:'2025-08-25T17:08:00Z',science:science(1.517)},
      {observed_utc:'2025-08-30T04:10:00Z',science:science(1.496)}
    ];
    const {container}=render(ui(short));
    const text=container.textContent||'';
    expect(text).toContain('The selected observations are only');
    expect(text).toContain('days apart');
    expect(text).toContain('short baseline');
    expect(text).toContain('A source dimensions');
    expect(text).toContain('B source dimensions');
    expect(text).toContain('Observation A–B time baseline');
    expect(text).toContain('pixels');
    expect(text).not.toMatch(/Seçilen gözlemler|gün aralıklı|A kaynak boyutu|B kaynak boyutu|kısa dönem/);
  });
});