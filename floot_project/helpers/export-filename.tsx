/**
 * Give each astronomy target a stable, filesystem-safe name across iOS,
 * desktop downloads and GitHub evidence files.
 */
export function exportTargetName(name:string):string {
  const clean=name.replace(/ı/g,'i').replace(/İ/g,'I').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0,60);
  return clean||'Sky_Target';
}