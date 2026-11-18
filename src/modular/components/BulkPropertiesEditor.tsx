import {useEffect,useState} from 'react'
import {moduleKindOf,positionKeyOf,type BuildingModuleKind} from '../common/buildingModules'
import {ANCHORS,isDimension,type ModuleAnchor} from '../common/moduleGeometry'
import {isElevation} from '../common/buildingModules'
import type {LayoutPosition,ModulePropertyPatch,ProjectCommand,ProjectConfig} from '../common/model'
import styles from './BulkPropertiesEditor.module.css'

type Field=keyof ModulePropertyPatch
export function BulkPropertiesEditor({positions,config,draft,busy,onCommand,onDirtyChange}:{positions:LayoutPosition[];config:ProjectConfig;draft:boolean;busy:boolean;onCommand:(c:ProjectCommand)=>Promise<boolean>;onDirtyChange:(v:boolean)=>void}){
 const initial=()=>{
  const common=(values:unknown[])=>values.length&&values.every(v=>v===values[0])?String(values[0]??''):''
  return {moduleType:common(positions.map(p=>moduleKindOf(p,config)))||'normal',width:common(positions.map(p=>p.dimensions?.width)),depth:common(positions.map(p=>p.dimensions?.depth)),height:common(positions.map(p=>p.dimensions?.height)),baseZ:common(positions.map(p=>p.baseZ)),anchor:common(positions.map(p=>p.dimensions?.anchor??'bottom-left'))||'bottom-left'}
 }
 const [input,setInput]=useState(initial),[enabled,setEnabled]=useState<Set<Field>>(new Set()),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const dirty=enabled.size>0||JSON.stringify(input)!==JSON.stringify(initial())
 useEffect(()=>{onDirtyChange(dirty)},[dirty,onDirtyChange]);useEffect(()=>()=>onDirtyChange(false),[onDirtyChange])
 useEffect(()=>{if(!dirty)return;const protect=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect)},[dirty])
 async function save(){
  const patch:ModulePropertyPatch={};setError('');setNotice('')
  for(const field of enabled){const raw=input[field];if(field==='moduleType')patch.moduleType=raw as BuildingModuleKind;else if(field==='anchor')patch.anchor=raw as ModuleAnchor;else{const value=raw.trim()?Number(raw):null;if(value!==null&&!(field==='baseZ'?isElevation(value):isDimension(value,field==='height'?12:30))){setError('가로·세로 0.5~30m, 높이 0.5~12m, 시작 높이 0~500m를 소수 둘째 자리까지 입력하세요.');return}patch[field]=value}}
  if(!positions.length||!enabled.size)return
  const labels=[...enabled].map(k=>({moduleType:'종류',width:'가로',depth:'세로',height:'높이',baseZ:'시작 높이',anchor:'고정 모서리'}[k]))
  if(!window.confirm(positions.length+'개 모듈의 '+labels.join(' · ')+' 속성을 함께 변경할까요?\n체크한 항목만 적용합니다. 체크한 빈 치수는 기본값을 따릅니다.\n번호·계획·실적은 유지됩니다.'))return
  if(await onCommand({type:'bulk-properties',moduleKeys:positions.map(positionKeyOf),patch,confirmed:!draft})){setEnabled(new Set());onDirtyChange(false);setNotice('선택한 속성을 저장했습니다.')}else setError('저장하지 못했습니다. 입력은 유지됩니다.')
 }
 const toggle=(field:Field)=>setEnabled(before=>{const next=new Set(before);if(next.has(field))next.delete(field);else next.add(field);return next})
 return <section className={styles.root} aria-label="모듈 속성 일괄 변경"><h2>선택한 모듈 <b>{positions.length}개</b></h2><p>변경할 항목만 체크하세요. 빈 치수는 해당 모듈의 그리드·종류를 따릅니다.</p>
 <div className={styles.chips}>{positions.slice(0,8).map(p=><span key={positionKeyOf(p)}>{p.floor}층 · {p.x+1}/{p.y+1}</span>)}{positions.length>8&&<span>외 {positions.length-8}개</span>}</div>
 <label className={styles.row}><input aria-label="일괄 종류 적용" type="checkbox" checked={enabled.has('moduleType')} disabled={busy||!positions.length} onChange={()=>toggle('moduleType')}/><span>모듈 종류</span><select aria-label="일괄 모듈 종류" value={input.moduleType} disabled={busy||!enabled.has('moduleType')} onChange={e=>setInput(v=>({...v,moduleType:e.target.value}))}><option value="normal">일반 모듈</option><option value="roof">지붕 모듈</option><option value="special">특수 모듈</option>{positions.some(p=>moduleKindOf(p,config)==='penthouse')&&<option value="penthouse">계단옥탑 모듈</option>}</select></label>
 {(['width','depth','height','baseZ'] as const).map((field,i)=><label key={field} className={styles.row}><input type="checkbox" aria-label={'일괄 '+['가로','세로','높이','시작 높이'][i]+' 적용'} checked={enabled.has(field)} disabled={busy||!positions.length} onChange={()=>toggle(field)}/><span>{['가로','세로','높이','시작 높이'][i]} (m)</span><input type="number" aria-label={'일괄 '+['가로','세로','높이','시작 높이'][i]+'(m)'} value={input[field]} placeholder="기본값 / 혼합" min={field==='baseZ'?0:.5} max={field==='baseZ'?500:field==='height'?12:30} step=".01" disabled={busy||!enabled.has(field)} onChange={e=>setInput(v=>({...v,[field]:e.target.value}))}/></label>)}
 <label className={styles.row}><input type="checkbox" aria-label="일괄 모서리 적용" checked={enabled.has('anchor')} disabled={busy||!positions.length} onChange={()=>toggle('anchor')}/><span>고정 모서리</span><select aria-label="일괄 기준 모서리" value={input.anchor} disabled={busy||!enabled.has('anchor')} onChange={e=>setInput(v=>({...v,anchor:e.target.value}))}>{Object.entries(ANCHORS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status">{notice}</p>}<footer><button type="button" disabled={busy||!positions.length||!enabled.size} onClick={()=>void save()}>속성 일괄 저장</button><button type="button" disabled={busy||!dirty} onClick={()=>{setInput(initial());setEnabled(new Set());setError('');setNotice('')}}>일괄 입력 취소</button></footer></section>
}
