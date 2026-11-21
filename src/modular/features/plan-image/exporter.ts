export interface PlanImageOptions {
 element:HTMLElement; title:string; filename:string; legend:{label:string;color:string;shape?:'dot'}[]; pixelRatio?:1|2
}
export interface PlanImageResult {blob:Blob;width:number;height:number}

/** Self-contained browser factory, embedded verbatim in offline reports. No module captures. */
export function createPlanImageExporter(){
 const XHTML='http://www.w3.org/1999/xhtml',SVG='http://www.w3.org/2000/svg'
 const properties=('display position top right bottom left width height min-width min-height max-width max-height box-sizing margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left border-top-width border-right-width border-bottom-width border-left-width border-top-style border-right-style border-bottom-style border-left-style border-top-color border-right-color border-bottom-color border-left-color border-radius background-color background-image background-size background-position background-repeat color font-family font-size font-weight font-style line-height letter-spacing text-align text-decoration text-transform text-indent white-space word-break overflow-wrap text-overflow vertical-align overflow overflow-x overflow-y opacity visibility box-shadow outline-width outline-style outline-color outline-offset transform transform-origin z-index flex-direction flex-wrap flex-grow flex-shrink flex-basis justify-content align-items align-content align-self gap row-gap column-gap grid-template-columns grid-template-rows grid-column grid-row writing-mode text-orientation fill fill-rule stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset vector-effect').split(' ')
 const svgAttributes=new Set('viewBox width height x y x1 x2 y1 y2 cx cy r rx ry d points fill stroke stroke-width stroke-linecap stroke-linejoin fill-rule clip-rule transform opacity vector-effect preserveAspectRatio'.split(' '))
 const unsupported=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','LINK','META','INPUT','SELECT','TEXTAREA','VIDEO','AUDIO','CANVAS','IMG','IMAGE','USE','FOREIGNOBJECT'])
 const message=(error:unknown)=>error instanceof Error?error.message:'평면 이미지를 만들지 못했습니다. 다시 시도해 주세요.'
 function filename(value:string){return (value.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,140)||'평면배치').replace(/\.png$/i,'')+'.png'}
 function safeStyle(style:CSSStyleDeclaration,computed:CSSStyleDeclaration){
  for(const key of properties){const value=computed.getPropertyValue(key);if(value&&!/url\s*\(|expression\s*\(/i.test(value))style.setProperty(key,value)}
 }
 function snapshot(element:HTMLElement){
  const doc=element.ownerDocument,win=doc.defaultView!
  const base=element.getBoundingClientRect(),rootStyle=win.getComputedStyle(element)
  const naturalWidth=parseFloat(element.style.width)||base.width,naturalHeight=parseFloat(element.style.height)||base.height
  if(!naturalWidth||!naturalHeight)throw new Error('평면 배치가 표시된 상태에서 이미지를 저장해 주세요.')
  let x0=0,y0=0,x1=naturalWidth,y1=naturalHeight,count=0
  function visit(node:Node):Node|null{
   if(++count>20000)throw new Error('평면 요소가 너무 많습니다. 표시 범위를 줄인 뒤 다시 시도해 주세요.')
   if(node.nodeType===3)return doc.createTextNode(node.textContent||'')
   if(node.nodeType!==1)return null
   const source=node as Element,tag=source.tagName.toUpperCase()
   if(unsupported.has(tag))return null
   const computed=win.getComputedStyle(source)
   if(computed.display==='none'||computed.visibility==='hidden')return null
   const rect=source.getBoundingClientRect()
   if(source!==element&&rect.width&&rect.height){x0=Math.min(x0,rect.left-base.left);y0=Math.min(y0,rect.top-base.top);x1=Math.max(x1,rect.right-base.left);y1=Math.max(y1,rect.bottom-base.top)}
   // Buttons are visual drawing nodes; remove their interactive/metadata attributes, not their contents.
   const namespace=source.namespaceURI===SVG?SVG:XHTML
   const copy=doc.createElementNS(namespace,tag==='BUTTON'?'div':source.localName) as HTMLElement
   if(namespace===SVG)for(const attribute of Array.from(source.attributes))if(svgAttributes.has(attribute.name)&&!/[<>]|url\s*\(/i.test(attribute.value))copy.setAttribute(attribute.name,attribute.value)
   safeStyle(copy.style,computed)
   function pseudo(which:'::before'|'::after'){
    const css=win.getComputedStyle(source,which),content=css.content
    if(!content||content==='none'||content==='normal')return null
    const span=doc.createElementNS(XHTML,'span');safeStyle(span.style,css)
    if(content!=='""'&&content!=="''"&&!/url\s*\(|attr\s*\(/i.test(content))span.textContent=content.replace(/^['"]|['"]$/g,'')
    return span
   }
   const before=pseudo('::before');if(before)copy.append(before)
   for(const child of Array.from(source.childNodes)){const cloned=visit(child);if(cloned)copy.append(cloned)}
   const after=pseudo('::after');if(after)copy.append(after)
   // The report's scrollable process list is text-only. Preserve its visible segment
   // without changing the real scroll container or shifting its siblings.
   if(namespace===XHTML&&source!==element&&(source.scrollTop||source.scrollLeft)&&Array.from(source.childNodes).every(child=>child.nodeType===3)){
    const text=doc.createElementNS(XHTML,'span');text.textContent=source.textContent
    Object.assign(text.style,{display:'block',position:'relative',left:-source.scrollLeft+'px',top:-source.scrollTop+'px'})
    copy.replaceChildren(text)
   }
   return copy
  }
  const clone=visit(element) as HTMLElement
  if(!clone)throw new Error('평면 배치가 표시된 상태에서 이미지를 저장해 주세요.')
  // Include outer labels, dimensions and outlines extending beyond #board, even at negative coordinates.
  const padding=12,width=Math.ceil(x1-x0+padding*2),height=Math.ceil(y1-y0+padding*2)
  const wrapper=doc.createElementNS(XHTML,'div')
  Object.assign(wrapper.style,{position:'relative',width:width+'px',height:height+'px',overflow:'hidden',backgroundColor:'#ffffff',fontFamily:rootStyle.fontFamily})
  const parent=element.parentElement?win.getComputedStyle(element.parentElement):rootStyle
  if(parent.backgroundColor&&parent.backgroundColor!=='rgba(0, 0, 0, 0)')wrapper.style.backgroundColor=parent.backgroundColor
  if(parent.backgroundImage&&!/url\s*\(/i.test(parent.backgroundImage))wrapper.style.backgroundImage=parent.backgroundImage
  Object.assign(clone.style,{position:'absolute',left:(padding-x0)+'px',top:(padding-y0)+'px',right:'auto',bottom:'auto',width:naturalWidth+'px',height:naturalHeight+'px',minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none',margin:'0',transform:'none'})
  wrapper.append(clone)
  const svg=doc.createElementNS(SVG,'svg');svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));svg.setAttribute('viewBox','0 0 '+width+' '+height)
  const foreign=doc.createElementNS(SVG,'foreignObject');foreign.setAttribute('width','100%');foreign.setAttribute('height','100%');foreign.append(wrapper);svg.append(foreign)
  const xml=new XMLSerializer().serializeToString(svg)
  if(new Blob([xml]).size>20*1024*1024)throw new Error('평면 이미지의 요소가 너무 많습니다. 표시 범위를 줄인 뒤 다시 시도해 주세요.')
  return {xml,width,height}
 }
 async function capture(options:PlanImageOptions):Promise<PlanImageResult>{
  // Everything describing the image is frozen before the first await.
  const title=String(options.title),legend=options.legend.map(item=>({label:String(item.label),color:item.color,shape:item.shape})),ratio=options.pixelRatio??2,shot=snapshot(options.element)
  if(ratio!==1&&ratio!==2)throw new Error('이미지 해상도를 확인해 주세요.')
  const cssWidth=Math.max(320,shot.width),width=Math.ceil(cssWidth*ratio)
  const sizeError=()=>new Error('현재 배율의 전체 이미지가 너무 큽니다. 평면 배율을 낮춘 뒤 다시 시도해 주세요.')
  if(width>16384||(shot.height+90)*ratio>16384||width*(shot.height+90)*ratio>32000000)throw sizeError()
  const doc=options.element.ownerDocument
  await doc.fonts?.ready
  const measuring=doc.createElement('canvas'),measure=measuring.getContext('2d')!
  if(!measure)throw new Error('이 브라우저에서 평면 이미지를 생성할 수 없습니다.')
  measure.font='11px "Segoe UI","Malgun Gothic",sans-serif';let lx=16,ly=shot.height+64
  const entries=legend.map(item=>{let text=item.label;while(text.length&&measure.measureText(text).width>cssWidth-50)text=text.slice(0,-1);if(text!==item.label)text=text.slice(0,-1)+'…';const itemWidth=measure.measureText(text).width+32;if(lx+itemWidth>cssWidth-12){lx=16;ly+=18}const result={...item,text,x:lx,y:ly};lx+=itemWidth;return result})
  measuring.width=0;measuring.height=0
  const cssHeight=Math.max(shot.height+90,ly+18),height=Math.ceil(cssHeight*ratio)
  if(height>16384||width*height>32000000)throw sizeError()
  const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(shot.xml)
  try{
   await img.decode()
   const canvas=doc.createElement('canvas');canvas.width=width;canvas.height=height
   const ctx=canvas.getContext('2d')!;if(!ctx)throw new Error('이 브라우저에서 평면 이미지를 생성할 수 없습니다.')
   ctx.scale(ratio,ratio);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cssWidth,cssHeight)
   function fit(text:string,max:number){let result=text;while(result.length&&ctx.measureText(result).width>max)result=result.slice(0,-1);return result===text?text:result.slice(0,-1)+'…'}
   ctx.fillStyle='#334155';ctx.font='600 16px "Segoe UI","Malgun Gothic",sans-serif';ctx.fillText(fit(title,cssWidth-32),16,28)
   ctx.drawImage(img,0,44,shot.width,shot.height)
   ctx.font='11px "Segoe UI","Malgun Gothic",sans-serif'
   for(const item of entries){ctx.fillStyle=item.color;if(item.shape==='dot'){ctx.beginPath();ctx.arc(item.x+4,item.y-4,4,0,Math.PI*2);ctx.fill()}else ctx.fillRect(item.x,item.y-8,8,8);ctx.fillStyle='#64748b';ctx.fillText(item.text,item.x+13,item.y)}
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG 이미지 생성에 실패했습니다.')),'image/png'))
   canvas.width=0;canvas.height=0
   return {blob,width,height}
  }finally{img.src=''}
 }
 function download(result:PlanImageResult,name:string){
  const url=URL.createObjectURL(result.blob),anchor=document.createElement('a');anchor.href=url;anchor.download=filename(name);anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 function preview(result:PlanImageResult,name:string){
  const doc=document,dialog=doc.createElement('dialog');dialog.dataset.planImagePreview='true'
  Object.assign(dialog.style,{padding:'20px',border:'1px solid #dbe4f0',borderRadius:'10px',maxWidth:'90vw',maxHeight:'90vh',overflow:'auto',font:'13px "Segoe UI","Malgun Gothic",sans-serif',color:'#334155'})
  const heading=doc.createElement('h2');heading.textContent='평면 이미지';heading.style.fontSize='17px'
  const help=doc.createElement('p');help.textContent='자동 복사를 사용할 수 없습니다. 아래 이미지를 우클릭해 이미지 복사를 선택하거나 PNG로 저장하세요.'
  const image=doc.createElement('img');image.alt='전체 평면 이미지';Object.assign(image.style,{display:'block',maxWidth:'100%',height:'auto',margin:'16px 0'})
  const save=doc.createElement('button');save.type='button';save.textContent='PNG 저장';save.onclick=()=>download(result,name)
  const close=doc.createElement('button');close.type='button';close.textContent='닫기';close.style.marginLeft='8px'
  const reader=new FileReader();reader.onload=()=>{if(dialog.isConnected)image.src=String(reader.result)};reader.readAsDataURL(result.blob)
  const remove=()=>{if(reader.readyState===1)reader.abort();image.removeAttribute('src');dialog.close();dialog.remove()};close.onclick=remove;dialog.addEventListener('cancel',event=>{event.preventDefault();remove()})
  dialog.append(heading,help,image,save,close);doc.body.append(dialog);dialog.showModal()
 }
 async function run(options:PlanImageOptions,action:'save'|'copy'):Promise<'saved'|'copied'|'preview'>{
  const name=String(options.filename)
  let resolveCapture!:(result:PlanImageResult)=>void,rejectCapture!:(error:unknown)=>void
  const pending=new Promise<PlanImageResult>((resolve,reject)=>{resolveCapture=resolve;rejectCapture=reject})
  let writing:Promise<boolean>|null=null
  if(action==='copy'&&globalThis.isSecureContext&&navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
   try{const png=pending.then(result=>result.blob);png.catch(()=>{});writing=Promise.resolve(navigator.clipboard.write([new ClipboardItem({'image/png':png})])).then(()=>true,()=>false)}catch{}
  }
  // Reserve clipboard activation before expensive DOM traversal, then freeze this
  // click's drawing synchronously before the first await. No live DOM mutation.
  capture(options).then(resolveCapture,rejectCapture)
  if(writing&&await writing){await pending;return 'copied'}
  const result=await pending;if(action==='copy'){preview(result,name);return 'preview'}download(result,name);return 'saved'
 }
 return {capture,download,preview,run,message}
}
