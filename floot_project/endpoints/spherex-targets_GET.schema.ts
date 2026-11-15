export type OutputType={
  targets:{id:string;label_tr:string;label_en:string;object_type:string;
    ra_deg:number;dec_deg:number;detector:string;description_tr:string;
    bundled_zip:boolean;available_count:number|null;cached_frame_count:number;
    last_checked_at:string|null;source:string|null}[];
  cache_policy:'24h-index-on-demand;immutable-FITS';
};