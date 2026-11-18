'use client'
import {useEffect,useRef,useState} from 'react'
import {axisLabelsOf,gridGeometryOf} from '../../common/gridGeometry'
import {isDimension} from '../../common/moduleGeometry'
import type {ProjectConfig} from '../../common/model'
import styles from './GridSpacing.module.css'

export function GridAxes({config,zoom,busy,onEdit,onEditLabel}:{config:ProjectConfig;zoom:number;busy:boolean;onEdit:(axis:'x'|'y',index:number)=>void;onEditLabel:(axis:'x'|'y',index:number)=>void}){
 const g=gridGeometryOf(config),scale=13*zoom,xLabels=axisLabelsOf(config,'x'),yLabels=axisLabelsOf(config,'y')
 return <>{g.xs.map((x,i)=><span key={'x'+i} className={styles.xLine} style={{left:x*scale}}><span>{i+1}</span></span>)}{g.ys.map((y,i)=><span key={'y'+i} className={styles.yLine} style={{bottom:y*scale}}><span>{i+1}</span></span>)}
 {g.xs.map((x,i)=><button key={'lx'+i} type="button" className={styles.xLabel} style={{left:x*scale,maxWidth:Math.max(28,Math.min(100,Math.min(g.widths[Math.max(0,i-1)],g.widths[Math.min(i,g.widths.length-1)])*scale/2-8))}} title={xLabels[i]+' · 축열명 수정'} aria-label={'X 축선 '+(i+1)+' 이름 수정'} disabled={busy} onClick={()=>onEditLabel('x',i)}>{xLabels[i]}</button>)}
 {g.ys.map((y,i)=><button key={'ly'+i} type="button" className={styles.yLabel} style={{bottom:y*scale}} title={yLabels[i]+' · 축열명 수정'} aria-label={'Y 축선 '+(i+1)+' 이름 수정'} disabled={busy} onClick={()=>onEditLabel('y',i)}>{yLabels[i]}</button>)}
 {g.widths.map((v,i)=><button type="button" key={'dx'+i} className={styles.xSize} style={{left:(g.xs[i]+v/2)*scale,width:Math.max(12,Math.min(56,v*scale-36))}} disabled={busy} title={'X'+(i+1)+'–X'+(i+2)+' 간격'} aria-label={'X'+(i+1)+'–X'+(i+2)+' 간격 수정'} onClick={()=>onEdit('x',i)}>{v}m</button>)}
 {g.depths.map((v,i)=><button type="button" key={'dy'+i} className={styles.ySize} style={{bottom:(g.ys[i]+v/2)*scale}} disabled={busy} aria-label={'Y'+(i+1)+'–Y'+(i+2)+' 간격 수정'} onClick={()=>onEdit('y',i)}>{v}m</button>)}</>
}
export function GridLabelDialog({axis,index,value,busy,error,onSave,onClose}:{axis:'x'|'y';index:number;value:string;busy:boolean;error:string;onSave:(value:string)=>Promise<boolean>;onClose:()=>void}){
 const [input,setInput]=useState(value),ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal()},[])
 const close=()=>{if(!busy&&(input===value||window.confirm('축열명 입력을 취소할까요?')))onClose()}
 return <dialog ref={ref} className={styles.dialog} aria-label="외측 축열명 편집" onCancel={e=>{e.preventDefault();close()}}><form onSubmit={async e=>{e.preventDefault();if(await onSave(input.trim()))onClose()}}><h2>{axis.toUpperCase()} 축선 {index+1} 이름</h2><p>전체 층의 외측 축열명입니다. 모듈 위치 번호와 기록은 유지됩니다.</p><label>축열 이름<input aria-label="외측 축열 이름" required autoFocus maxLength={20} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} placeholder="예: X1a"/></label>{error&&<p role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={close}>취소</button><button disabled={busy||!input.trim()||input.trim()===value}>이름 저장</button></footer></form></dialog>
}
export function GridSpacingDialog({axis,index,value,confirmed,busy,error,onSave,onClose}:{axis:'x'|'y';index:number;value:number;confirmed:boolean;busy:boolean;error:string;onSave:(value:number)=>Promise<boolean>;onClose:()=>void}){
 const [input,setInput]=useState(String(value)),[validation,setValidation]=useState(''),ref=useRef<HTMLDialogElement>(null)
 useEffect(()=>{ref.current?.showModal()},[])
 const close=()=>{if(!busy&&(input===String(value)||window.confirm('간격 입력을 취소할까요?')))onClose()}
 const title=axis.toUpperCase()+(index+1)+'–'+axis.toUpperCase()+(index+2)
 return <dialog ref={ref} className={styles.dialog} aria-label="그리드 간격 편집" onCancel={e=>{e.preventDefault();close()}}><form onSubmit={async e=>{e.preventDefault();const next=Number(input);if(!input.trim()||!isDimension(next)){setValidation('0.5~30m, 소수 둘째 자리까지 입력하세요.');return}if(confirmed&&!window.confirm(title+' 간격을 '+next+'m로 변경할까요?\n모든 층에 적용되며, 기본 연동 모듈의 크기·위치가 바뀝니다. 개별 치수와 계획·실적은 보존됩니다.'))return;if(await onSave(next))onClose()}}><h2>{title} 간격</h2><p>전체 층에 적용됩니다. 개별 가로·세로 치수를 입력한 모듈은 해당 치수를 유지합니다.</p><label>간격 (m)<input aria-label="그리드 간격(m)" autoFocus required type="number" min="0.5" max="30" step="0.01" value={input} disabled={busy} onChange={e=>setInput(e.target.value)}/></label>{(error||validation)&&<p role="alert">{error||validation}</p>}<footer><button type="button" disabled={busy} onClick={close}>취소</button><button disabled={busy||input===String(value)}>간격 저장</button></footer></form></dialog>
}
