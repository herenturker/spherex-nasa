export type OutputType={
  test_suite:'SPHEREx prototype photometry and EPSF screening tests';
  synthetic_only:true;
  passed:number;total:number;
  tests:{name:string;passed:boolean;detail:string}[];
  note:string;
};