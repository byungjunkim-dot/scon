import { useEffect, useRef, useState } from 'react'
import { ApiError, createRecoveryBackup, getLocalRecoveryReviews, restoreLocalProject, deleteRecoveryRecord, type RecoveryReview, type RecoveryStats } from '../api/modularApi'
import styles from '../views/ProductionBoard.module.css'

const errorText = (error: unknown) => { if(error instanceof ApiError){try{return JSON.parse(error.body).message}catch{}}return '기록을 처리하지 못했습니다. 다시 확인하세요.' }
const dateText = (date: string) => date && Number.isFinite(Date.parse(date)) ? new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}).format(new Date(date)) : '시각 없음'
function Stats({ label, value }: { label: string; value: RecoveryStats | null }) { return <div><b>{label}</b><p>{value ? <>모듈 {value.modules}개 · 완료 기록 {value.completed}건<br />{dateText(value.updatedAt)}</> : '서버에 이 프로젝트가 없습니다.'}</p></div> }
export function StorageRecoveryDialog({ onClose, onOpenServer, onProjectDeleted }: { onClose: () => void; onOpenServer: (id: string) => void | Promise<void>; onProjectDeleted?: (id: string) => void | Promise<void> }) {
  const dialog=useRef<HTMLDialogElement>(null),[rows,setRows]=useState<RecoveryReview[]>([]),[pending,setPending]=useState(false),[error,setError]=useState('')
  const [backedUp,setBackedUp]=useState<Set<string>>(()=>new Set()),[ack,setAck]=useState<Set<string>>(()=>new Set()),[confirm,setConfirm]=useState<RecoveryReview|null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ row: RecoveryReview; deleteFromServer: boolean } | null>(null)

  async function load(){setPending(true);setConfirm(null);setDeleteTarget(null);setBackedUp(new Set());setAck(new Set());try{setRows(await getLocalRecoveryReviews())}catch(e){setError(errorText(e))}finally{setPending(false)}}
  useEffect(()=>{dialog.current?.showModal();void load()},[])
  function backup(row:RecoveryReview){
    try {
      const file=createRecoveryBackup(row.token),url=URL.createObjectURL(new Blob([file.content],{type:'application/json;charset=utf-8'})),anchor=document.createElement('a')
      anchor.href=url;anchor.download=file.filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
      setBackedUp(previous=>new Set(previous).add(row.token));setError('')
    } catch(e){setError(errorText(e))}
  }
  return <dialog ref={dialog} className={styles.dialog} style={{width:720,maxWidth:'95vw'}} onCancel={e=>{e.preventDefault();if(!pending)onClose()}} aria-label="이 PC 기록 복구">
    <div className={styles.dialogHead}><h2>이 PC 기록 복구</h2><button className={styles.button} disabled={pending} onClick={onClose}>닫기</button></div>
    <p className={styles.formHint}>기존 PC에만 남아 있던 기록을 서버 기록과 비교합니다. 양쪽 원본을 백업한 뒤 선택한 이 PC 기록을 서버에 반영할 수 있습니다. 불필요하거나 중복된 빈 기록은 개별 삭제할 수 있습니다.</p>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {pending&&<p role="status">서버와 이 PC 기록 확인 중…</p>}
    {!pending&&!rows.length&&<p>이 브라우저에 복구할 구버전 제작 기록이 없습니다.</p>}
    {!confirm&&!deleteTarget&&rows.map(row=><section key={row.token} style={{border:'1px solid #dbe4f0',borderRadius:8,padding:14,margin:'12px 0'}} aria-label={`복구 검토 ${row.local.name}`}>
      <b>{row.local.name}</b><small style={{display:'block',color:'#64748b',overflowWrap:'anywhere'}}>{row.projectId}</small>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,fontSize:12,marginTop:14}}><Stats label="이 PC 기록" value={row.local}/><Stats label="서버 기록" value={row.server}/></div>
      {row.error?<p className={styles.error}>{row.error} · 서버를 확인한 후에만 반영할 수 있습니다.</p>:<p className={styles.formHint}>{row.alreadyRestored?'이 PC 저장본을 이미 서버에 반영했습니다.':row.same?'양쪽 기록이 같습니다.':row.server?'양쪽 내용이 다릅니다. 건수가 같아도 날짜·내용은 다를 수 있습니다.':'서버에 없는 이 PC 기록입니다.'}</p>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <button className={styles.button} disabled={pending} onClick={()=>backup(row)}>양쪽 원본 백업</button>
        {row.server&&<button className={styles.button} disabled={pending} onClick={()=>void onOpenServer(row.projectId)}>서버 기록 열기</button>}
        <button
          className={styles.button}
          style={{color:'#dc2626',borderColor:'#fca5a5',marginLeft:'auto'}}
          disabled={pending}
          onClick={()=>setDeleteTarget({row, deleteFromServer: false})}
        >
          기록 삭제
        </button>
      </div>
      {backedUp.has(row.token)&&<label className={styles.formHint} style={{display:'block',marginTop:8}}><input type="checkbox" aria-label={`${row.projectId} 백업 파일 저장 확인`} checked={ack.has(row.token)} onChange={e=>setAck(previous=>{const next=new Set(previous);e.target.checked?next.add(row.token):next.delete(row.token);return next})}/> 양쪽 원본이 담긴 JSON 백업 파일을 저장했습니다.</label>}
      <button style={{marginTop:8}} className={styles.primaryButton} disabled={pending||Boolean(row.error)||row.same||row.alreadyRestored||!ack.has(row.token)} onClick={()=>setConfirm(row)}>이 PC 기록으로 서버 내용 교체</button>
    </section>)}
    {confirm&&<section style={{border:'1px solid #e7b4a3',borderRadius:8,padding:16}} aria-label="서버 내용 교체 확인"><h3>{confirm.local.name}</h3><p>자동 병합이 아닙니다. 서버의 이 프로젝트 전체 내용이 선택한 이 PC 기록으로 교체됩니다. 서버에만 있던 내용은 내려받은 양쪽 원본 백업에 보존됩니다.</p><div className={styles.dialogFoot}><button className={styles.button} disabled={pending} onClick={()=>setConfirm(null)}>취소</button><button className={styles.primaryButton} disabled={pending} onClick={async()=>{setPending(true);setError('');try{const saved=await restoreLocalProject(confirm.token);await onOpenServer(saved.id)}catch(e){setError(errorText(e));await load()}finally{setPending(false)}}}>확인하고 서버 내용 교체</button></div></section>}
    {deleteTarget&&<section style={{border:'1px solid #f87171',borderRadius:8,padding:16,margin:'12px 0',background:'#fff5f5'}} aria-label="기록 삭제 확인">
      <h3 style={{margin:'0 0 8px',color:'#b91c1c',fontSize:16,fontWeight:700}}>기록 삭제 확인</h3>
      <p style={{margin:'0 0 10px',fontSize:13,color:'#334155'}}>
        <b>{deleteTarget.row.local.name}</b> <span style={{fontSize:11,color:'#64748b'}}>({deleteTarget.row.projectId})</span>
      </p>
      <div style={{background:'#ffffff',border:'1px solid #fecaca',borderRadius:8,padding:12,fontSize:13,marginBottom:14,display:'flex',flexDirection:'column',gap:10}}>
        {deleteTarget.row.server&&(
          <label style={{display:'flex',alignItems:'flex-start',gap:8,cursor:'pointer'}}>
            <input
              type="radio"
              name="deleteScope"
              checked={deleteTarget.deleteFromServer}
              onChange={()=>setDeleteTarget(prev=>prev?{...prev,deleteFromServer:true}:null)}
            />
            <div>
              <b style={{color:'#dc2626'}}>서버 및 이 PC에서 완전 삭제</b>
              <div style={{fontSize:11,color:'#64748b',marginTop:2}}>서버 데이터베이스와 현재 PC의 로컬 캐시에서 모두 완전히 삭제합니다. 복구 불가능하므로 사전에 [양쪽 원본 백업]을 권장합니다.</div>
            </div>
          </label>
        )}
        <label style={{display:'flex',alignItems:'flex-start',gap:8,cursor:'pointer'}}>
          <input
            type="radio"
            name="deleteScope"
            checked={!deleteTarget.deleteFromServer}
            onChange={()=>setDeleteTarget(prev=>prev?{...prev,deleteFromServer:false}:null)}
          />
          <div>
            <b>이 PC(로컬 캐시)에서만 삭제</b>
            <div style={{fontSize:11,color:'#64748b',marginTop:2}}>현재 브라우저의 로컬 저장소에서만 삭제하여 복구 목록에서 제외합니다. 서버 기록은 그대로 남겨둡니다.</div>
          </div>
        </label>
      </div>
      <div className={styles.dialogFoot}>
        <button className={styles.button} disabled={pending} onClick={()=>setDeleteTarget(null)}>취소</button>
        <button
          className={styles.primaryButton}
          style={{background:'#dc2626',borderColor:'#dc2626'}}
          disabled={pending}
          onClick={async()=>{
            setPending(true)
            setError('')
            try {
              const targetId = deleteTarget.row.projectId
              await deleteRecoveryRecord(deleteTarget.row.token, deleteTarget.deleteFromServer)
              setDeleteTarget(null)
              await load()
              if(onProjectDeleted){
                await onProjectDeleted(targetId)
              }
            } catch(e){
              setError(errorText(e))
            } finally {
              setPending(false)
            }
          }}
        >
          삭제 실행
        </button>
      </div>
    </section>}
    {!confirm&&!deleteTarget&&<div className={styles.dialogFoot}><button className={styles.button} disabled={pending} onClick={()=>{setError('');void load()}}>다시 검토</button><button className={styles.button} disabled={pending} onClick={onClose}>닫기</button></div>}
  </dialog>
}
