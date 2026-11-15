/** Prepare a real File without browser navigation or an automatic share sheet.
 * Its object URL remains valid until the caller revokes it.
 */
export type PreparedExport={url:string;name:string;file:File;contents?:string};
export function startFileExport(
  name:string, contents:string, mime:string
):PreparedExport{
  const file=new File([contents],name,{type:mime});
  const url=URL.createObjectURL(file);
  return {url,name,file,contents};
}