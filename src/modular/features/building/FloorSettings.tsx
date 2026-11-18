'use client'
import {useEffect,useRef,useState} from 'react'
import {floorNameOf,totalFloorsOf,type ProjectConfig} from '../../common/model'
import {configWithLevels} from '../../common/floorLevels'
import {floorHeightOf} from '../../common/buildingModules'
import styles from './BuildingModules.module.css'
export function levelDefaults(config:ProjectConfig,height=4){return Array.from({length:totalFloorsOf(config)},(_,i)=>({name:floorNameOf(i+1,config),height:floorHeightOf(i+1,config,height)}))}
export function FloorFields({config,onChange,busy,height=4}:{config:ProjectConfig;onChange:(c:ProjectConfig)=>void;busy:boolean;height?:number}){
 const levels=levelDefaults(config,height)
 return <fieldset className={styles.floorSettings} disabled={busy}><legend>기준면 이름 · 층간 높이</legend><p>아래부터 1층·2층·옥탑층·옥탑지붕 등으로 이름을 정하세요.</p>{!config.levels&&<button type="button" onClick={()=>onChange({...config,levels})}>층별 설정 사용</button>}{config.levels&&levels.map((l,i)=><div className={styles.floorFields} key={i}><label>{i+1} · 이름<input aria-label={'관리층 '+(i+1)+' 이름'} required maxLength={20} value={l.name} onChange={e=>onChange({...config,levels:levels.map((v,j)=>j===i?{...v,name:e.target.value}:v)})}/></label><label>층간 높이 (m)<input aria-label={'관리층 '+(i+1)+' 높이'} required type="number" min="0.5" max="12" step="0.01" value={l.height||''} onChange={e=>onChange({...config,levels:levels.map((v,j)=>j===i?{...v,height:Number(e.target.value)}:v)})}/></label></div>)}<p>층간 높이는 위 기준면까지의 간격입니다. 종류와 개별 치수는 배치 후 모듈 속성에서 정합니다.</p></fieldset>
}
export function FloorSettingsDialog({config,height,busy,error,retainedFloors=[],onSave,onClose}:{config:ProjectConfig;height:number;busy:boolean;error:string;retainedFloors?:number[];onSave:(levels:NonNullable<ProjectConfig['levels']>,resize?:true)=>Promise<boolean>;onClose:()=>void}){
 const initial=levelDefaults(config,height),[value,setValue]=useState({...config,levels:initial}),ref=useRef<HTMLDialogElement>(null)
 useEffect(()=>{ref.current?.showModal()},[])
 const count=value.levels.length,oldCount=totalFloorsOf(config),limit=value.hasRoof?16:15,hasRecords=retainedFloors.some(f=>f>=count)
 const close=()=>{if(!busy&&(JSON.stringify(value.levels)===JSON.stringify(initial)||window.confirm('층 설정 입력을 취소할까요?')))onClose()}
 const add=()=>{let name=(count+1)+'층',suffix=1;const names=new Set(value.levels.map(l=>l.name.trim()));while(names.has(name))name='새 기준면 '+(count+1)+'-'+suffix++;setValue(configWithLevels(value,[...value.levels,{name,height}]) as typeof value)}
 const remove=()=>{if(count>1&&!hasRecords)setValue(configWithLevels(value,value.levels.slice(0,-1)) as typeof value)}
 return <dialog ref={ref} className={styles.dialog} aria-label="기준면 설정" onCancel={e=>{e.preventDefault();close()}}><form onSubmit={async e=>{e.preventDefault();const resize=count!==oldCount;const summary=resize?'기준면 '+oldCount+'개 → '+count+'개로 변경합니다.\n새 층은 빈 상태이며, 모듈 기록이 있는 층은 삭제할 수 없습니다.\n':'';if(window.confirm(summary+'층 이름·높이를 반영할까요? 기본 높이와 층 바닥 위치가 변경될 수 있습니다. 번호·계획·실적·명시 치수·독립 시작 높이는 보존됩니다.')&&await onSave(value.levels,resize?true:undefined))onClose()}}><h2>기준면 추가·삭제 / 이름·높이</h2>{error&&<p role="alert">{error}</p>}
 <div className={styles.levelActions}><b>{count}개 기준면{count!==oldCount?' · 저장 전 변경':''}</b><button type="button" disabled={busy||count>=limit} onClick={add}>＋ 기준면 추가</button><button type="button" disabled={busy||count<=1||hasRecords} onClick={remove}>마지막 기준면 삭제</button></div>
 <p>새 기준면은 맨 위에 추가됩니다. 기존 번호를 유지하기 위해 삭제는 맨 위의 빈 기준면부터 가능합니다. 최대 {limit}개입니다.</p>{hasRecords&&<p role="status">마지막 기준면에 모듈 또는 보존된 기록이 있어 삭제할 수 없습니다.</p>}
 <FloorFields config={value} onChange={v=>setValue({...v,levels:v.levels!})} height={height} busy={busy}/><div className={styles.actions}><button type="button" disabled={busy} onClick={close}>취소</button><button disabled={busy}>층 설정 저장</button></div></form></dialog>
}
