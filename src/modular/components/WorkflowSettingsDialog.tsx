'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconCheck, IconClock, IconHistory, IconPlus, IconX } from '@tabler/icons-react'
import { MAX_WORKFLOW_STAGES } from '../common/domain'
import type { ManagementPhase, WorkflowRevision, WorkflowStage } from '../common/model'
import styles from './WorkflowSettingsDialog.module.css'

interface WorkflowSettingsDialogProps {
  initialStages: WorkflowStage[]
  baselineStages: WorkflowStage[]
  revisions: WorkflowRevision[]
  phase: 'draft' | ManagementPhase
  baselinePlanAt?: string
  busy: boolean
  onSave: (stages: WorkflowStage[], reason: string) => Promise<boolean>
  onClose: () => void
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

function revisionSummary(revision: WorkflowRevision) {
  const before = new Map<string, { stage: WorkflowStage; index: number }>()
  revision.before.forEach((stage, index) => before.set(stage.id, { stage, index }))
  const changes: string[] = []
  revision.after.forEach((stage, index) => {
    const previous = before.get(stage.id)
    if (!previous) changes.push(`추가 · ${stage.label}`)
    else {
      if (previous.stage.label !== stage.label) changes.push(`이름 · ${previous.stage.label} → ${stage.label}`)
      if (previous.stage.active !== stage.active) changes.push(`${stage.active ? '활성화' : '비활성화'} · ${stage.label}`)
      if (previous.index !== index) changes.push(`순서 변경 · ${stage.label}`)
    }
  })
  return changes.length ? [...new Set(changes)] : ['공정 구성 변경']
}

function makeStageId() {
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

export function WorkflowSettingsDialog({ initialStages, baselineStages, revisions, phase, baselinePlanAt, busy, onSave, onClose }: WorkflowSettingsDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [stages, setStages] = useState(() => initialStages.map(stage => ({ ...stage })))
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const locked = busy || pending
  const production = phase === 'production'
  const dirty = JSON.stringify(stages) !== JSON.stringify(initialStages)
  const activeCount = stages.filter(stage => stage.active).length
  const baselineById = new Map(baselineStages.map(stage => [stage.id, stage]))
  const nameCounts = new Map<string, number>()
  for (const stage of stages) nameCounts.set(stage.label.trim().toLocaleLowerCase('ko-KR'), (nameCounts.get(stage.label.trim().toLocaleLowerCase('ko-KR')) ?? 0) + 1)
  const duplicateNames = [...nameCounts.values()].some(count => count > 1)

  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    if (!dirty) return
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [dirty])

  function close() {
    if (locked) return
    onClose()
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= stages.length) return
    setStages(current => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function update(index: number, patch: Partial<WorkflowStage>) {
    setStages(current => current.map((stage, i) => i === index ? { ...stage, ...patch } : stage))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked || !dirty) return
    if (stages.some(stage => !stage.label.trim())) { setError('공정명을 입력해 주세요.'); return }
    if (duplicateNames) { setError('같은 이름의 공정이 있습니다. 공정명을 다르게 입력해 주세요.'); return }
    if (!activeCount) { setError('최소 한 개의 공정을 사용하도록 설정해 주세요.'); return }
    if (production && !reason.trim()) { setError('제작 시작 후 공정 구성 변경 사유를 입력해 주세요.'); return }
    setPending(true); setError('')
    try {
      if (await onSave(stages, reason.trim())) onClose()
      else setError('공정 구성을 저장하지 못했습니다. 최신 데이터를 불러온 뒤 다시 시도해 주세요.')
    } catch {
      setError('공정 구성을 저장하지 못했습니다. 연결 상태를 확인해 주세요.')
    } finally { setPending(false) }
  }

  return <dialog ref={dialog} className={styles.dialog} onCancel={event => { event.preventDefault(); close() }} aria-labelledby="workflow-title">
    <form onSubmit={submit}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>PROJECT WORKFLOW</span><h2 id="workflow-title">프로젝트 공정 설정</h2></div>
        <button type="button" className={styles.close} aria-label="공정 설정 닫기" onClick={close} disabled={locked}><IconX size={20} /></button>
      </header>
      <p className={styles.intro}>{production
        ? '제작 시작 당시 구성을 기준으로 보존합니다. 이후 변경은 사유와 변경 이력을 남기며, 기존 모듈 계획·실적은 유지됩니다.'
        : '제작 시작 전에 이 프로젝트에서 관리할 공정과 순서를 설정하세요. 제작 시작 시 현재 구성이 착수 기준으로 저장됩니다.'}</p>
      {production && <section className={styles.baseline} aria-label="착수 기준 공정 구성">
        <div className={styles.sectionHead}><span><IconCheck size={15} />착수 기준 구성</span><small>{baselinePlanAt ? `${baselinePlanAt.slice(0, 10)} 확정` : '기존 프로젝트의 기본 구성'}</small></div>
        <div className={styles.baselineList}>{baselineStages.filter(stage => stage.active).map(stage => <span key={stage.id}>{stage.label}</span>)}</div>
      </section>}
      {error && <div className={styles.error} role="alert"><IconAlertTriangle size={16} />{error}</div>}
      <div className={styles.listHeading}><div><h3>공정 목록</h3><span>{activeCount}개 사용 · {stages.length}개 전체</span></div><span>순서대로 표시</span></div>
      <ol className={styles.list}>
        {stages.map((stage, index) => {
          const baseline = baselineById.get(stage.id)
          const changedSinceStart = production && (!baseline || baseline.label !== stage.label || baseline.active !== stage.active || baselineStages.findIndex(item => item.id === stage.id) !== index)
          return <li key={stage.id} className={`${styles.row} ${!stage.active ? styles.inactive : ''}`}>
            <span className={styles.order}>{String(index + 1).padStart(2, '0')}</span>
            <input aria-label={`${index + 1}번 공정명`} className={styles.name} type="text" maxLength={80} value={stage.label} disabled={locked} onChange={event => update(index, { label: event.target.value })} />
            {changedSinceStart && <span className={styles.changed}>착수 후 변경</span>}
            <label className={styles.toggle}><input type="checkbox" checked={stage.active} disabled={locked} onChange={event => update(index, { active: event.target.checked })} /><span>{stage.active ? '사용' : '비활성'}</span></label>
            <div className={styles.orderActions}>
              <button type="button" aria-label={`${stage.label} 위로`} title="순서 위로" disabled={locked || index === 0} onClick={() => move(index, -1)}><IconArrowUp size={15} /></button>
              <button type="button" aria-label={`${stage.label} 아래로`} title="순서 아래로" disabled={locked || index === stages.length - 1} onClick={() => move(index, 1)}><IconArrowDown size={15} /></button>
            </div>
          </li>
        })}
      </ol>
      <div className={styles.help}><IconAlertTriangle size={15} /><span>비활성화는 공정을 목록과 집계에서 제외하지만, 기존 계획일·완료일은 삭제하지 않고 보존합니다. 공정은 완전히 삭제되지 않습니다.</span></div>
      <button type="button" className={styles.add} disabled={locked || stages.length >= MAX_WORKFLOW_STAGES} onClick={() => { setStages(current => [...current, { id: makeStageId(), label: '새 공정', active: true }]); setError('') }}><IconPlus size={16} />공정 추가 <small>{stages.length}/{MAX_WORKFLOW_STAGES}</small></button>
      {production && <label className={styles.reason}>변경 사유 <span>필수</span><textarea value={reason} maxLength={500} rows={2} disabled={locked} placeholder="예: 현장 협의에 따라 내화도장 공정을 외주 검사 후로 이동" onChange={event => setReason(event.target.value)} /><small>{reason.length} / 500자</small></label>}
      <section className={styles.history} aria-label="공정 구성 변경 이력">
        <div className={styles.sectionHead}><span><IconHistory size={15} />공정 구성 변경 이력</span><small>{revisions.length}건</small></div>
        {!revisions.length ? <p className={styles.emptyHistory}>아직 저장된 공정 구성 변경이 없습니다.</p> : <ol>{[...revisions].reverse().slice(0, 12).map(revision => <li key={revision.id}>
          <div><time dateTime={revision.at}><IconClock size={13} />{formatTimestamp(revision.at)}</time><p>{revision.reason}</p></div>
          <ul>{revisionSummary(revision).map((item, index) => <li key={`${revision.id}-${index}`}>{item}</li>)}</ul>
        </li>)}</ol>}
      </section>
      <footer className={styles.footer}>
        <span>{production ? '변경 사유와 전후 구성이 이력에 남습니다' : '공정 ID는 유지되어 기존 기록과 연결됩니다'}</span>
        <button type="button" className={styles.cancel} onClick={close} disabled={locked}>닫기</button>
        <button type="submit" className={styles.save} disabled={locked || !dirty || duplicateNames || !activeCount || (production && !reason.trim())}>{locked ? '저장 중…' : production ? '변경 이력과 함께 저장' : '공정 구성 저장'}</button>
      </footer>
    </form>
  </dialog>
}
