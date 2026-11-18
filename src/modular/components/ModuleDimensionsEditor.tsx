import { useEffect, useState } from 'react'
import type { ModuleRecord, ProjectConfig } from '../common/model'
import { isElevation, moduleKindLabel, moduleKindOf, type BuildingModuleKind } from '../common/buildingModules'
import { ANCHORS, isDimension, moduleGeometryOf, type ModuleAnchor, type ModuleDimensions } from '../common/moduleGeometry'
import styles from './ModuleDimensionsEditor.module.css'

interface Props { module: Pick<ModuleRecord,'key'|'floor'|'x'|'y'|'dimensions'|'kind'|'baseZ'|'moduleType'>; config:ProjectConfig; generalHeight:number; busy:boolean; otherDirty:boolean; defaultOpen?:boolean; requireTypeConfirmation?:boolean; onRemove?:()=>void; onSave:(dimensions:ModuleDimensions,baseZ?:number|null,moduleType?:BuildingModuleKind)=>Promise<boolean>; onDirtyChange:(dirty:boolean)=>void }
export function ModuleDimensionsEditor({module,config,generalHeight,busy,otherDirty,defaultOpen,requireTypeConfirmation,onRemove,onSave,onDirtyChange}:Props){
  const initial=()=>({type:moduleKindOf(module,config),width:String(module.dimensions?.width??''),depth:String(module.dimensions?.depth??''),height:String(module.dimensions?.height??''),baseZ:String(module.baseZ??''),anchor:module.dimensions?.anchor??'bottom-left' as ModuleAnchor})
  const [input,setInput]=useState(initial),[error,setError]=useState('')
  const saved=JSON.stringify([module.dimensions??{},module.baseZ,moduleKindOf(module,config)])
  useEffect(()=>{setInput(initial());setError('')},[module.key,saved])
  const original=initial(),dirty=JSON.stringify(input)!==JSON.stringify(original)
  useEffect(()=>{onDirtyChange(dirty)},[dirty])
  useEffect(()=>()=>onDirtyChange(false),[])
  const defaults=moduleGeometryOf({...module,moduleType:input.type,dimensions:undefined,baseZ:undefined},config,{moduleHeight:generalHeight})
  const effective=moduleGeometryOf(module,config,{moduleHeight:generalHeight})
  async function save(reset=false){
    if(busy||otherDirty)return
    const dimensions:ModuleDimensions={}
    if(!reset){
      for(const key of ['width','depth','height'] as const)if(input[key].trim()){const value=Number(input[key]);if(!isDimension(value,key==='height'?12:30)){setError('가로·세로 0.5~30m, 높이 0.5~12m, 소수 둘째 자리까지 입력하세요.');return}dimensions[key]=value}
      if(input.anchor!=='bottom-left')dimensions.anchor=input.anchor
    }
    const baseZ=reset||!input.baseZ.trim()?null:Number(input.baseZ)
    if(baseZ!==null&&!isElevation(baseZ)){setError('시작 높이는 0~500m, 소수 둘째 자리까지 입력하세요.');return}
    const type=!reset&&input.type!==original.type?input.type:undefined
    if(type&&requireTypeConfirmation){const next=moduleGeometryOf({...module,moduleType:type,dimensions},config,{moduleHeight:generalHeight});if(!window.confirm('모듈 종류와 속성을 변경할까요?\n높이 '+effective.height+'m → '+next.height+'m\n번호·계획·실적은 보존하며, 빈 치수는 새 종류와 그리드를 따릅니다.'))return}
    setError('')
    if(await onSave(dimensions,baseZ,type)){if(reset)setInput({...initial(),width:'',depth:'',height:'',baseZ:'',anchor:'bottom-left'});onDirtyChange(false)}else setError('저장하지 못했습니다. 입력은 유지됩니다.')
  }
  return <details className={styles.root} open={defaultOpen||undefined}><summary>모듈 속성 <small>{moduleKindLabel(module,config)} · {effective.width} × {effective.depth} × {effective.height}m</small></summary>
    <div className={styles.fields}>
      <label className={styles.typeField}>모듈 종류<select aria-label="모듈 종류" value={input.type} disabled={busy} onChange={e=>setInput(v=>({...v,type:e.target.value as BuildingModuleKind}))}><option value="normal">일반 모듈</option><option value="roof">지붕 모듈</option><option value="special">특수 모듈</option>{original.type==='penthouse'&&<option value="penthouse">계단옥탑 모듈</option>}</select></label>
      {(['width','depth','height'] as const).map((key,i)=><label key={key}>{['가로','세로','높이'][i]} (m)<input aria-label={`개별 ${['폭','깊이','높이'][i]}(m)`} type="number" min="0.5" max={key==='height'?12:30} step="0.01" placeholder={`${defaults[key]} (기본)`} value={input[key]} disabled={busy} onChange={e=>setInput(v=>({...v,[key]:e.target.value}))}/></label>)}
      <label>시작 높이 (m)<input aria-label="모듈 시작 높이(m)" type="number" min="0" max="500" step="0.01" placeholder={`${defaults.baseZ} (기준면)`} value={input.baseZ} disabled={busy} onChange={e=>setInput(v=>({...v,baseZ:e.target.value}))}/></label>
      <label>고정 모서리<select aria-label="모듈 기준 모서리" value={input.anchor} disabled={busy} onChange={e=>setInput(v=>({...v,anchor:e.target.value as ModuleAnchor}))}>{Object.entries(ANCHORS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <p>가로·세로를 비우면 해당 그리드에 연동됩니다. 지붕 기본 높이는 1m이며 개별 입력값이 우선합니다.</p>
    {otherDirty&&<p role="status">다른 입력을 먼저 저장하거나 취소해 주세요.</p>}{error&&<p role="alert">{error}</p>}
    <div className={styles.actions}><button type="button" disabled={busy||otherDirty||!dirty} onClick={()=>void save()}>속성 저장</button><button type="button" disabled={busy||!dirty} onClick={()=>{setInput(initial());setError('')}}>입력 취소</button><button type="button" disabled={busy||otherDirty||(!Object.keys(module.dimensions??{}).length&&module.baseZ===undefined)} onClick={()=>void save(true)}>기본값 복원</button>{onRemove&&<button type="button" disabled={busy||otherDirty||dirty} onClick={onRemove}>추가 모듈 제외</button>}</div>
  </details>
}
