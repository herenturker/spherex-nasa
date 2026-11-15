import {z} from 'zod';
export const schema=z.object({id:z.string().regex(/^[a-z0-9_-]{1,32}$/)});
export type OutputType={
  target:{id:string;label_tr:string;ra_deg:number;dec_deg:number;detector:string};
  frames:{file:string;observed_utc:string;source_fits_cutout_url:string;src:string;science:import('../helpers/science-fits').ScienceFrameData}[];
  catalog_last_checked_at:string|null;catalog_fresh:boolean;catalog_source:'saved-NASA-index';
};