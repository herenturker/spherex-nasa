import {z} from 'zod';
export const schema=z.object({id:z.string().regex(/^[a-z0-9_-]{1,32}$/)});
export type OutputType={
  report_key:string;target_id:string;stored:boolean;ready_frames:number;comparisons:number;
  saved_at:string;warning?:string;
};