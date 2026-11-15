import { z } from 'zod';
export const schema = z.object({
  url:z.string().url().max(1200),
});
export type OutputType={
  png:string;width:number;height:number;native_width:number;native_height:number;
  science:import('../helpers/science-fits').ScienceFrameData;note:string;
};