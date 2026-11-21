'use client'

import {PRODUCTION_STATES,productionStateOf,productionTone} from '../../common/productionDisplay'
import {moduleMarker} from '../../common/moduleAppearance'
import {gridGeometryOf} from '../../common/gridGeometry'

import { useEffect, useRef, useState } from 'react'
import { moduleKindOf, isExtraKey, moduleKindLabel, positionKeyOf } from '../../common/buildingModules'
import { moduleGeometryOf } from '../../common/moduleGeometry'
import { axisNumber, moduleNumber, progress, type LayoutPosition, type ModuleRecord, type ProjectConfig, type WorkflowStage } from '../../common/model'
import type { Installation3DSettings } from '../../common/installation3d'
import styles from './BuildingModules.module.css'

export function ExtraPlanLayer({ positions, config, settings, zoom, selectedKey, selectedKeys, stages, draft, busy, matches, onSelect }: {
  positions: LayoutPosition[]; config:ProjectConfig; settings?:Installation3DSettings; zoom:number; selectedKey:string|null; selectedKeys:ReadonlySet<string>; stages:WorkflowStage[]; draft:boolean; busy:boolean; matches?:(module:ModuleRecord)=>boolean; onSelect:(key:string)=>void
}) {
  return <>{positions.filter(p=>isExtraKey(p.key)).sort((a,b)=>moduleGeometryOf(a,config,settings).baseZ-moduleGeometryOf(b,config,settings).baseZ).map((p,i)=>{
    const key=positionKeyOf(p),g=moduleGeometryOf(p,config,settings),selected=selectedKey===key||selectedKeys.has(key)
    const match=draft||!matches||matches(p as ModuleRecord),state=draft?PRODUCTION_STATES.waiting:productionStateOf(p as ModuleRecord,stages)
    const label=draft?`${moduleKindLabel(p,config)} · X${axisNumber(p.x)} Y${axisNumber(p.y)}`:moduleNumber(p,config)
    return <button key={key} type="button" className={`${styles.box} ${selected?styles.selected:''}`} style={{...productionTone(state),opacity:match?1:0.18,left:g.originX*13*zoom,top:(gridGeometryOf(config).depth-g.originY-g.depth)*13*zoom,width:g.width*13*zoom,height:g.depth*13*zoom,zIndex:selected?6000:20+i}} disabled={busy||!match} onClick={()=>onSelect(key)} aria-label={`${label} · 시작 ${g.baseZ}m · ${moduleKindLabel(p,config)} · ${state.label}`} aria-pressed={selected} title={`${label}\n${moduleKindLabel(p,config)} · 시작 ${g.baseZ}m · 높이 ${g.height}m · ${state.label}`}><b><i className={styles.statusDot} style={{background:moduleMarker(moduleKindOf(p,config)).color}} aria-label={moduleMarker(moduleKindOf(p,config)).label} title={moduleKindLabel(p,config)}/>{label}</b><span>{moduleKindLabel(p,config)} · {g.baseZ}m{!draft&&'completed' in p?` · ${state.label} · ${progress(p as ModuleRecord,stages)}%`:''}</span></button>
  })}</>
}

export function ExtraRecoveryPicker({ modules, config, busy, onRestore }: {modules:ModuleRecord[];config:ProjectConfig;busy:boolean;onRestore:(key:string)=>void}) {
  const [selected,setSelected]=useState('')
  if(!modules.length)return null
  const key=modules.some(m=>m.key===selected)?selected:modules[0].key
  return <details className={styles.recovery}><summary>제외된 지붕·옥탑 기록 {modules.length}개</summary><div><select aria-label="제외된 추가 모듈" value={key} disabled={busy} onChange={e=>setSelected(e.target.value)}>{modules.map(m=><option key={m.key} value={m.key}>{moduleNumber(m,config)} · {moduleKindLabel(m,config)}</option>)}</select><button type="button" disabled={busy} onClick={()=>onRestore(key)}>기록 복원</button></div></details>
}

export function OverlapPicker({modules,config,selectedKeys,busy,onSelect,onClose}:{modules:ModuleRecord[];config:ProjectConfig;selectedKeys:ReadonlySet<string>;busy:boolean;onSelect:(key:string)=>void;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null)
 useEffect(()=>{ref.current?.showModal()},[])
 return <dialog ref={ref} className={styles.dialog} aria-label="겹친 모듈 선택" onCancel={e=>{e.preventDefault();if(!busy)onClose()}}><h2>겹친 모듈 선택</h2><p>아래쪽 모듈도 개별 선택할 수 있습니다. 여러 모듈 선택 모드에서는 계속 눌러 선택·해제하세요.</p>{modules.map(m=><button type="button" className={styles.overlapItem} disabled={busy} key={m.key} aria-pressed={selectedKeys.has(m.key)} onClick={()=>onSelect(m.key)}>{selectedKeys.has(m.key)?'✓ ':''}{moduleNumber(m,config)} · {moduleKindLabel(m,config)}</button>)}<div className={styles.actions}><button disabled={busy} onClick={onClose}>선택 완료</button></div></dialog>
}
