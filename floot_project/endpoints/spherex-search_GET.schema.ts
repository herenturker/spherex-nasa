import { z } from 'zod';

export const schema = z.object({
  ra: z.coerce.number().finite().min(0).max(360),
  dec: z.coerce.number().finite().min(-90).max(90),
  detector: z.enum(['SPHEREx-D1','SPHEREx-D2','SPHEREx-D3','SPHEREx-D4','SPHEREx-D5','SPHEREx-D6']).default('SPHEREx-D2'),
});
export type OutputType = {
  ra_deg: number;
  dec_deg: number;
  detector: string;
  available_count: number;
  frames: { observed_utc: string; source_fits_cutout_url: string }[];
  note: string;
  catalog_source?: 'live' | 'snapshot' | 'cache' | 'stale-cache';
  catalog_origin?: 'live' | 'snapshot';
  catalog_cache_hit?: boolean;
  catalog_cached_at?: string;
  snapshot_utc?: string;
};