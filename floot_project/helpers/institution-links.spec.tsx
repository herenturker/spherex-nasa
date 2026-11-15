import React from 'react';
import {render,cleanup,screen} from '@testing-library/react';
import InstitutionLinks from '../components/InstitutionLinks';
import {LanguageProvider} from './i18n';

describe('SPHEREx official resource links',()=>{
  afterEach(cleanup);
  it('provides distinct official home-page links in the hero',()=>{
    render(<LanguageProvider><InstitutionLinks placement="hero"/></LanguageProvider>);
    const space=screen.getByRole('link',{name:'NASA Space Apps Challenge homepage'}) as HTMLAnchorElement;
    const nasa=screen.getByRole('link',{name:'NASA official homepage'}) as HTMLAnchorElement;
    expect(space.href).toBe('https://www.spaceappschallenge.org/');
    expect(nasa.href).toBe('https://www.nasa.gov/');
    expect(space.querySelector('img')?.getAttribute('src')).toContain('space-apps-2026-black-motif.png');
    expect(nasa.textContent).toContain('NASA');
  });
  it('provides the same official links above the footer',()=>{
    render(<LanguageProvider><InstitutionLinks placement="footer"/></LanguageProvider>);
    expect(screen.getAllByRole('link')).toHaveSize(2);
    expect(screen.getByRole('link',{name:'NASA official homepage'}).getAttribute('target')).toBe('_blank');
  });
});