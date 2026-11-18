'use client'
import {useRef,useState} from 'react'
import {createPlanImageExporter,type PlanImageOptions} from './exporter'
import styles from './PlanImageActions.module.css'

export function PlanImageActions({busy,getOptions}:{busy:boolean;getOptions:()=>PlanImageOptions|null}){
 const exporter=useRef<ReturnType<typeof createPlanImageExporter>|null>(null)
 const [pending,setPending]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('')
 async function run(action:'save'|'copy'){
  const options=getOptions();if(!options||busy||pending)return
  setPending(true);setStatus('');setError('')
  try{
   exporter.current??=createPlanImageExporter()
   const result=await exporter.current.run(options,action)
   setStatus(result==='saved'?'PNG 다운로드를 시작했습니다.':result==='copied'?'평면 이미지를 복사했습니다.':'미리보기에서 이미지 복사를 선택하세요.')
  }catch(e){setError(exporter.current?.message(e)||'평면 이미지를 생성하지 못했습니다.')}
  finally{setPending(false)}
 }
 return <div className={styles.root} aria-label="평면 이미지 내보내기"><div><button type="button" disabled={busy||pending} title="현재 배율 · 스크롤 밖 전체 평면 · 2배 해상도" aria-label="평면 PNG 저장" onClick={()=>void run('save')}>{pending?'이미지 생성 중…':'PNG 저장'}</button><button type="button" disabled={busy||pending} title="현재 배율의 전체 평면 이미지 복사" aria-label="평면 이미지 복사" onClick={()=>void run('copy')}>이미지 복사</button></div>{status&&<span role="status">{status}</span>}{error&&<span role="alert">{error}</span>}</div>
}
