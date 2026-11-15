'use strict';
/* Small, optional photos in local archive records. Images are canvas-reencoded as
   JPEG (EXIF stripped), bounded in both dimensions and bytes before persistence. */
const ELMOS_ARCHIVE_PHOTOS=(()=>{
 const MAX_COUNT=2,MAX_SOURCE=12*1024*1024,MAX_BYTES=300*1024,MAX_DIMENSION=1400;
 const MIME=/^image\/(jpeg|png|webp)$/i;
 const DATA=/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/;
 const labels={de:['Fotos zum Prüfprotokoll (optional)','Maximal 2 Bilder · je höchstens 300 KB · automatisch verkleinert','Bilder hinzufügen','Entfernen','Bildbeschreibung (optional)','Kein Bild ausgewählt','Foto wird verarbeitet …','Bilder werden lokal im Archiv und PDF gespeichert.'],
 en:['Report photos (optional)','Up to 2 images · maximum 300 KB each · compressed automatically','Add photos','Remove','Caption (optional)','No photo selected','Processing image …','Photos are stored locally in the archive and PDF.']};
 const tr=i=>labels[document.documentElement?.lang?.startsWith('en')?'en':'de'][i];
 const escape=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 const estimatedBytes=data=>Math.floor((data.length-data.indexOf(',')-1)*0.75)-
  (data.endsWith('==')?2:data.endsWith('=')?1:0);
 function validate(photos){
  if(!Array.isArray(photos)||photos.length>MAX_COUNT)throw Error('Maximal 2 Bilder pro Prüfprotokoll.');
  return photos.map((entry,i)=>{
   const dataUrl=String(entry?.dataUrl||'');
   if(!DATA.test(dataUrl)||estimatedBytes(dataUrl)>MAX_BYTES)
    throw Error('Bild '+(i+1)+' hat ein ungültiges Format oder überschreitet 300 KB.');
   const caption=String(entry?.caption||'').slice(0,100).trim();
   return {dataUrl,caption,width:Number(entry.width)||null,height:Number(entry.height)||null,
    bytes:estimatedBytes(dataUrl)};
  });
 }
 function imageFromFile(file){
  return new Promise((resolve,reject)=>{
   const image=new Image(),url=URL.createObjectURL(file);
   const release=()=>URL.revokeObjectURL(url);
   image.onload=()=>{release();resolve(image)};
   image.onerror=()=>{release();reject(Error('Bild konnte nicht geöffnet werden.'))};
   image.src=url;
  });
 }
 async function compress(file){
  if(!file||!MIME.test(file.type))throw Error('Bitte JPG-, PNG- oder WebP-Bilder auswählen.');
  if(file.size>MAX_SOURCE)throw Error('Bilddatei zu gross: maximal 12 MB vor der Komprimierung.');
  const img=await imageFromFile(file);
  const iw=img.naturalWidth,ih=img.naturalHeight;
  if(!iw||!ih||iw*ih>100000000)throw Error('Bildauflösung wird nicht unterstützt.');
  let scale=Math.min(1,MAX_DIMENSION/Math.max(iw,ih));
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('2d');
  if(!context)throw Error('Bildverarbeitung im Browser nicht verfügbar.');
  for(let pass=0;pass<6;pass++){
   const width=Math.max(1,Math.round(iw*scale)),height=Math.max(1,Math.round(ih*scale));
   canvas.width=width;canvas.height=height;
   context.fillStyle='#fff';context.fillRect(0,0,width,height);
   context.drawImage(img,0,0,width,height);
   for(const quality of [0.82,0.72,0.63,0.54]){
    const dataUrl=canvas.toDataURL('image/jpeg',quality);
    if(DATA.test(dataUrl)&&estimatedBytes(dataUrl)<=MAX_BYTES){
     canvas.width=canvas.height=0;
     return {dataUrl,caption:'',width,height,bytes:estimatedBytes(dataUrl)};
    }
   }
   scale*=0.77;
  }
  canvas.width=canvas.height=0;
  throw Error('Dieses Foto lässt sich nicht auf 300 KB verkleinern.');
 }
 function mount(host,{getPhotos,onChange}={}){
  if(!host||typeof getPhotos!=='function'||typeof onChange!=='function')
   throw Error('Fotobereich konnte nicht erstellt werden.');
  host.classList.add('elmos-photo-panel');
  const heading=document.createElement('h4');
  heading.textContent=tr(0);
  const help=document.createElement('p');help.className='elmos-photo-help';help.textContent=tr(1);
  const list=document.createElement('div');list.className='elmos-photo-list';
  const button=document.createElement('button');button.type='button';button.textContent=tr(2);
  button.className='elmos-photo-add';
  const chooser=document.createElement('input');chooser.type='file';chooser.accept='image/jpeg,image/png,image/webp';
  chooser.multiple=true;chooser.hidden=true;
  const status=document.createElement('p');status.className='elmos-photo-message';
  const footer=document.createElement('p');footer.className='elmos-photo-help';footer.textContent=tr(7);
  host.replaceChildren(heading,help,list,button,chooser,status,footer);
  let busy=false;
  const current=()=>validate(getPhotos()||[]);
  async function save(next){
   busy=true;button.disabled=true;
   try{await onChange(validate(next));status.textContent=''}
   catch(error){status.textContent=error.message||String(error);throw error}
   finally{busy=false;render()}
  }
  function render(){
   let photos;try{photos=current()}catch(error){
    status.textContent=error.message;photos=[];
   }
   list.replaceChildren();
   for(let i=0;i<photos.length;i++){
    const p=photos[i],row=document.createElement('div');row.className='elmos-photo-item';
    const preview=document.createElement('img');preview.src=p.dataUrl;preview.alt=p.caption||'Bild '+(i+1);
    preview.loading='lazy';
    const controls=document.createElement('div');controls.className='elmos-photo-controls';
    const label=document.createElement('label');label.textContent=tr(4);
    const caption=document.createElement('input');caption.type='text';caption.maxLength=100;
    caption.value=p.caption||'';caption.disabled=busy;
    caption.addEventListener('change',()=>{
     if(busy)return;
     const next=current();next[i]={...next[i],caption:caption.value.slice(0,100)};
     void save(next).catch(()=>{});
    });
    label.append(caption);
    const remove=document.createElement('button');remove.type='button';remove.textContent=tr(3);
    remove.disabled=busy;
    remove.addEventListener('click',()=>{
     if(busy)return;
     void save(current().filter((_,j)=>i!==j)).catch(()=>{});
    });
    controls.append(label,remove);row.append(preview,controls);list.append(row);
   }
   if(!photos.length){const empty=document.createElement('p');empty.textContent=tr(5);list.append(empty)}
   button.disabled=busy||photos.length>=MAX_COUNT;
   button.textContent=tr(2)+' ('+photos.length+'/'+MAX_COUNT+')';
  }
  button.addEventListener('click',()=>{if(!busy)chooser.click()});
  chooser.addEventListener('change',async()=>{
   if(busy)return;
   const files=Array.from(chooser.files||[]);chooser.value='';
   if(!files.length)return;
   let existing;try{existing=current()}catch(e){status.textContent=e.message;return}
   if(files.length>MAX_COUNT-existing.length){
    status.textContent='Maximal 2 Bilder pro Prüfprotokoll.';return;
   }
   busy=true;button.disabled=true;status.textContent=tr(6);
   try{
    const next=[...existing];
    for(const file of files)next.push(await compress(file));
    await onChange(validate(next));
    status.textContent='';
   }catch(e){status.textContent=e.message||String(e)}
   finally{busy=false;render()}
  });
  render();
  return {refresh:render};
 }
 const pdfCss='.elmos-report-photos{margin:24px 0;break-before:auto;page-break-inside:avoid}'+
  '.elmos-report-photos h2{margin:0 0 10px}'+
  '.elmos-report-photo-row{display:flex;gap:14px;align-items:flex-start}'+
  '.elmos-report-photo{flex:1;min-width:0;margin:0;break-inside:avoid;page-break-inside:avoid}'+
  '.elmos-report-photo img{display:block;max-width:100%;width:auto;height:auto;max-height:310px;'+
   'object-fit:contain;border:1px solid #d5e2ea;background:#fff;margin:0 auto}'+
  '.elmos-report-photo figcaption{text-align:center;color:#476377;margin-top:5px;font-size:10px;'+
   'white-space:pre-wrap;overflow-wrap:anywhere}'+
  '@media print{.elmos-report-photos{break-inside:avoid;page-break-inside:avoid}'+
   '.elmos-report-photo-row{break-inside:avoid;page-break-inside:avoid}}';
 function reportPhotos(photos){
  let valid;try{valid=validate(photos||[])}catch(_){return ''}
  if(!valid.length)return '';
  return '<section class="elmos-report-photos"><h2>Fotos zum Prüfprotokoll</h2>'+
   '<div class="elmos-report-photo-row">'+valid.map((p,i)=>
    '<figure class="elmos-report-photo"><img src="'+p.dataUrl+'" alt="Prüfprotokoll Foto '+(i+1)+'">'+
    '<figcaption>'+escape(p.caption||'Bild '+(i+1))+'</figcaption></figure>').join('')+
   '</div></section>';
 }
 return {MAX_COUNT,MAX_BYTES,MAX_DIMENSION,validate,compress,mount,reportPhotos,pdfCss};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_ARCHIVE_PHOTOS;
if(typeof window!=='undefined')window.ELMOS_ARCHIVE_PHOTOS=ELMOS_ARCHIVE_PHOTOS;
