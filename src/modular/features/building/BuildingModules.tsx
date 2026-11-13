'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { EXTRA_KINDS, defaultBaseZ, isElevation, isExtraKey, moduleKindLabel, positionKeyOf, type ExtraKind, type PlanLayer } from '../../common/buildingModules'
import { ANCHORS, isDimension, moduleGeometryOf, type ModuleAnchor, type ModuleDimensions } from '../../common/moduleGeometry'
import { axisNumber, floorNameOf, moduleNumber, progress, totalFloorsOf, type LayoutPosition, type ModuleRecord, type ProjectCommand, type ProjectConfig, type WorkflowStage } from '../../common/model'
import type { Installation3DSettings } from '../../common/installation3d'
import styles from './BuildingModules.module.css'

export function BuildingControls({ layer, busy, onLayer, onAdd }: { layer: PlanLayer; busy: boolean; onLayer: (layer:PlanLayer)=>void; onAdd:()=>void }) {
  return <div className={styles.tools}><label>평면 레이어<select aria-label="평면 레이어" value={layer} disabled={busy} onChange={e=>onLayer(e.target.value as PlanLayer)}><option value="all">전체 모듈</option><option value="normal">일반 모듈</option><option value="extra">지붕·옥탑·특수</option></select></label><button type="button" disabled={busy} onClick={onAdd}>＋ 지붕·옥탑 추가</button></div>
}

export function ExtraPlanLayer({ positions, config, settings, zoom, selectedKey, selectedKeys, stages, draft, busy, matches, onSelect }: {
  positions: LayoutPosition[]; config:ProjectConfig; settings?:Installation3DSettings; zoom:number; selectedKey:string|null; selectedKeys:ReadonlySet<string>; stages:WorkflowStage[]; draft:boolean; busy:boolean; matches?:(module:ModuleRecord)=>boolean; onSelect:(key:string)=>void
}) {
  return <>{positions.filter(p=>isExtraKey(p.key)).sort((a,b)=>moduleGeometryOf(a,config,settings).baseZ-moduleGeometryOf(b,config,settings).baseZ).map((p,i)=>{
    const key=positionKeyOf(p),g=moduleGeometryOf(p,config,settings),selected=selectedKey===key||selectedKeys.has(key)
    const match=draft||!matches||matches(p as ModuleRecord)
    const label=draft?`${moduleKindLabel(p,config)} · X${axisNumber(p.x)} Y${axisNumber(p.y)}`:moduleNumber(p,config)
    return <button key={key} type="button" className={`${styles.box} ${selected?styles.selected:''}`} style={{opacity:match?1:0.18,left:g.originX*13*zoom,top:(config.rows*config.depth-g.originY-g.depth)*13*zoom,width:g.width*13*zoom,height:g.depth*13*zoom,zIndex:selected?6000:20+i}} disabled={busy||!match} onClick={()=>onSelect(key)} aria-label={`${label} · 시작 ${g.baseZ}m · ${moduleKindLabel(p,config)}`} aria-pressed={selected} title={`${label}\n${moduleKindLabel(p,config)} · 시작 ${g.baseZ}m · 높이 ${g.height}m`}><b>{label}</b><span>{moduleKindLabel(p,config)} · {g.baseZ}m{!draft&&'completed' in p?` · ${progress(p as ModuleRecord,stages)}%`:''}</span></button>
  })}</>
}

export function ExtraRecoveryPicker({ modules, config, busy, onRestore }: {modules:ModuleRecord[];config:ProjectConfig;busy:boolean;onRestore:(key:string)=>void}) {
  const [selected,setSelected]=useState('')
  if(!modules.length)return null
  const key=modules.some(m=>m.key===selected)?selected:modules[0].key
  return <details className={styles.recovery}><summary>제외된 지붕·옥탑 기록 {modules.length}개</summary><div><select aria-label="제외된 추가 모듈" value={key} disabled={busy} onChange={e=>setSelected(e.target.value)}>{modules.map(m=><option key={m.key} value={m.key}>{moduleNumber(m,config)} · {moduleKindLabel(m,config)}</option>)}</select><button type="button" disabled={busy} onClick={()=>onRestore(key)}>기록 복원</button></div></details>
}

type AddCommand=Extract<ProjectCommand,{type:'add-extra'}>
export function ExtraPlacementDialog({config,generalHeight,floor,selected,draft,busy,error,onAdd,onClose}: {
  config:ProjectConfig;generalHeight:number;floor:number;selected:LayoutPosition|null;draft:boolean;busy:boolean;error:string;onAdd:(command:AddCommand)=>Promise<boolean>;onClose:()=>void
}) {
  const initial=selected?moduleGeometryOf(selected,config,{moduleHeight:generalHeight}):null
  const [kind,setKind]=useState<ExtraKind>('roof'),[level,setLevel]=useState(selected?.floor??floor),[x,setX]=useState(selected?.x??0),[y,setY]=useState(selected?.y??0)
  const [input,setInput]=useState({width:initial?String(initial.width):'',depth:initial?String(initial.depth):'',height:'',baseZ:String(initial?Math.round((initial.baseZ+initial.height)*100)/100:defaultBaseZ({floor,kind:'roof'},config,generalHeight)),anchor:initial?.anchor??'bottom-left' as ModuleAnchor})
  const [review,setReview]=useState<AddCommand|null>(null),[validation,setValidation]=useState('')
  const ref=useRef<HTMLDialogElement>(null),id=useId()
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>{if(dialog?.open)dialog.close()}},[])
  async function commit(command:AddCommand){if(!busy&&await onAdd(command))onClose()}
  function prepare(){
    const dimensions:ModuleDimensions={}
    for(const field of ['width','depth','height'] as const)if(input[field].trim()){const value=Number(input[field]);if(!isDimension(value,field==='height'?12:30)){setValidation('폭·깊이 0.5~30m, 높이 0.5~12m, 소수 둘째 자리까지 입력하세요.');return};dimensions[field]=value}
    if(!input.baseZ.trim()||!isElevation(Number(input.baseZ))){setValidation('시작 높이는 0~500m, 소수 둘째 자리까지 입력하세요.');return}
    if(input.anchor!=='bottom-left')dimensions.anchor=input.anchor
    const command:AddCommand={type:'add-extra',floor:level,x,y,kind,baseZ:Number(input.baseZ),dimensions,confirmed:!draft}
    setValidation('');if(draft)void commit(command);else setReview(command)
  }
  const label=review?`${floorNameOf(review.floor,config)} · X${axisNumber(review.x)} Y${axisNumber(review.y)}`:''
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={id} onCancel={e=>{e.preventDefault();if(!busy)onClose()}}>
    <form onSubmit={e=>{e.preventDefault();if(review)void commit(review);else prepare()}}><h2 id={id}>{review?'추가 모듈 배치 확인':'지붕·옥탑 모듈 추가'}</h2>
      {error&&<p role="alert" className={styles.error}>{error}</p>}{validation&&<p role="alert" className={styles.error}>{validation}</p>}
      {review?<div className={styles.review}><b>{label}</b><p>{EXTRA_KINDS[review.kind]}을 시작 높이 {review.baseZ}m에 추가할까요?</p><p>기존 모듈과 별도 번호·계획·제작 실적으로 관리합니다. 제작 시작 후 추가하면 착수 기준선에는 포함되지 않습니다.</p></div>:<>
        <p>{selected?'선택 모듈 상단을 시작 높이로 채웠습니다. 치수와 높이를 확인하세요.':'관리층과 좌표를 고르고 시작 높이를 지정하세요.'}</p>
        <label>모듈 종류<select aria-label="추가 모듈 종류" value={kind} disabled={busy} onChange={e=>setKind(e.target.value as ExtraKind)}>{Object.entries(EXTRA_KINDS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <div className={styles.fields}><label>관리층<select aria-label="추가 모듈 관리층" value={level} disabled={busy} onChange={e=>{const next=Number(e.target.value);setLevel(next);setInput(v=>({...v,baseZ:String(defaultBaseZ({floor:next,kind},config,generalHeight))}))}}>{Array.from({length:totalFloorsOf(config)},(_,i)=><option key={i} value={i+1}>{floorNameOf(i+1,config)}</option>)}</select></label>{(['X','Y'] as const).map(axis=><label key={axis}>{axis}축열<select aria-label={`추가 모듈 ${axis}축열`} value={axis==='X'?x:y} disabled={busy} onChange={e=>(axis==='X'?setX:setY)(Number(e.target.value))}>{Array.from({length:axis==='X'?config.columns:config.rows},(_,i)=><option key={i} value={i}>{axis}{i+1}</option>)}</select></label>)}</div>
        <div className={styles.fields}>{(['width','depth','height'] as const).map((field,i)=><label key={field}>{['폭','깊이','높이'][i]} (m)<input aria-label={`추가 모듈 ${['폭','깊이','높이'][i]}(m)`} type="number" min="0.5" max={field==='height'?12:30} step="0.01" value={input[field]} placeholder={String(field==='width'?config.width:field==='depth'?config.depth:kind==='roof'?1:generalHeight)+' (기본)'} disabled={busy} onChange={e=>setInput(v=>({...v,[field]:e.target.value}))}/></label>)}</div>
        <label>시작 높이 (m)<input aria-label="추가 모듈 시작 높이(m)" type="number" required min="0" max="500" step="0.01" value={input.baseZ} disabled={busy} onChange={e=>setInput(v=>({...v,baseZ:e.target.value}))}/></label>
        <label>고정할 기준 모서리<select aria-label="추가 모듈 기준 모서리" value={input.anchor} disabled={busy} onChange={e=>setInput(v=>({...v,anchor:e.target.value as ModuleAnchor}))}>{Object.entries(ANCHORS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <p>시작 높이는 건물 바닥 기준입니다. 저장한 높이는 다른 모듈의 높이를 바꿔도 자동으로 이동하지 않습니다. 빈 치수는 기본값을 따릅니다.</p>
      </>}
      <div className={styles.actions}><button type="button" disabled={busy} onClick={()=>review?setReview(null):onClose()}>{review?'이전':'취소'}</button><button type="submit" disabled={busy}>{busy?'저장 중…':review?'모듈 추가':draft?'초안에 추가':'추가 내용 확인'}</button></div>
    </form>
  </dialog>
}
