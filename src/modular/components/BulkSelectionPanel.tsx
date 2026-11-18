import {useCallback,useRef,useState,type ComponentProps} from 'react'
import {BulkPlanEditor} from './BulkPlanEditor'
import {BulkPropertiesEditor} from './BulkPropertiesEditor'
import type {LayoutPosition,ProjectConfig} from '../common/model'
import styles from './BulkPropertiesEditor.module.css'

export function BulkSelectionPanel({positions,draft,config,revision,onDirtyChange,...props}:Omit<ComponentProps<typeof BulkPlanEditor>,'config'> & {config:ProjectConfig;positions:LayoutPosition[];draft:boolean;revision:number}){
 const [tab,setTab]=useState<'properties'|'plan'>(draft?'properties':'plan'),dirty=useRef(false),report=useRef(onDirtyChange);report.current=onDirtyChange
 const onDirty=useCallback((value:boolean)=>{dirty.current=value;report.current?.(value)},[])
 const change=(next:typeof tab)=>{if(next===tab||props.busy)return;if(dirty.current&&!window.confirm('저장하지 않은 일괄 입력을 취소하고 이동할까요?'))return;onDirty(false);setTab(next)}
 return <aside className={styles.panel}>{!draft&&<div className={styles.tabs}><button type="button" disabled={props.busy} aria-pressed={tab==='properties'} onClick={()=>change('properties')}>모듈 속성</button><button type="button" disabled={props.busy} aria-pressed={tab==='plan'} onClick={()=>change('plan')}>관리계획·공정</button></div>}{tab==='properties'?<BulkPropertiesEditor key={revision} positions={positions} config={config} draft={draft} busy={props.busy} onCommand={async c=>{const result=await props.onCommand(c);return typeof result==='boolean'?result:result.success}} onDirtyChange={onDirty}/>:<BulkPlanEditor key={revision} {...props} config={config} onDirtyChange={onDirty}/>}</aside>
}
