import { ModuleDimensionsEditor } from './ModuleDimensionsEditor'
import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  IconAlertTriangle, IconArrowBackUp, IconCalendar, IconCheck, IconClipboardCheck,
  IconClock, IconCube, IconHistory, IconMessage, IconPlus, IconDeviceFloppy,
} from '@tabler/icons-react'
import {
  actualStageDateOf, axisNumber, completedCount, floorLabelOf, moduleNumber, openIssues, plannedStageDateOf, progress, today,
  currentPlanOf, validActualDate,
  type Inspection, type ManagementPhase, type ModulePlan, type ModuleRecord, type ProjectCommand, type ProjectConfig, type StageId, type WorkflowStage,
} from '../common/model'
import styles from './ModuleDetail.module.css'

interface ModuleDetailProps {
  module: ModuleRecord | null
  onRemove?:()=>void
  generalHeight?: number
  onGeometryDirty?: (dirty:boolean)=>void
  config: ProjectConfig
  phase: 'draft' | ManagementPhase
  baselinePlanAt?: string
  stages: WorkflowStage[]
  workflowStages: WorkflowStage[]
  baselineWorkflowStages: WorkflowStage[]
  busy: boolean
  onCommand: (command: ProjectCommand) => Promise<{ success: boolean; error?: string } | boolean>
  onDirtyChange?: (dirty: boolean) => void
  currentTab?: DetailTab
  onTabChange?: (tab: DetailTab) => void
}

type DetailTab = 'plan' | 'stages' | 'inspections' | 'history'
const KIND_LABELS: Record<Inspection['kind'], string> = { inspection: '검사 기록', issue: '이슈', note: '특이사항' }

function formatTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function ModuleDetail({ module: record, ...props }: ModuleDetailProps) {
  if (!record) return (
    <aside className={styles.panel} aria-label="모듈 상세 정보">
      <div className={styles.empty}>
        <div className={styles.emptyIcon}><IconCube size={28} stroke={1.4} /></div>
        <span className={styles.eyebrow}>MODULE DETAIL</span>
        <h2>모듈을 선택해 주세요</h2>
        <p>{props.phase === 'planning' ? <>평면도에서 모듈을 선택해<br />구역·공장·공정별 계획일을 입력하세요.</> : <>평면도에서 모듈을 선택하면<br />계획·공정과 검사 이력을 확인할 수 있습니다.</>}</p>
        <div className={styles.emptyHint}><span />그리드의 모듈 클릭</div>
      </div>
    </aside>
  )
  return <SelectedModule key={record.key} record={record} {...props} />
}

function dayDelta(actual: string | undefined, planned: string | undefined) {
  if (!actual || !planned || !validActualDate(actual)) return null
  return Math.round((Date.parse(`${actual}T00:00:00Z`) - Date.parse(`${planned}T00:00:00Z`)) / 86400000)
}
function deltaText(delta: number | null, planned?: string, actual?: string) {
  if (!validActualDate(actual)) return '실적 없음'
  if (!planned) return '계획 미입력'
  if (delta === null) return '편차 계산 불가'
  return delta > 0 ? `계획보다 ${delta}일 지연` : delta < 0 ? `계획보다 ${Math.abs(delta)}일 빠름` : '계획일 완료'
}

function SelectedModule({ onRemove, onGeometryDirty, generalHeight, record, config, phase, baselinePlanAt, stages, workflowStages, baselineWorkflowStages, busy, onCommand, onDirtyChange, currentTab, onTabChange }: Omit<ModuleDetailProps, 'module'> & { record: ModuleRecord }) {
  const id = useId()
  const [tab, setTab] = useState<DetailTab>(() => currentTab ?? (phase === 'planning' ? 'plan' : 'stages'))

  useEffect(() => {
    if (currentTab && currentTab !== tab) {
      setTab(currentTab)
    }
  }, [currentTab])

  const handleTabChange = (next: DetailTab) => {
    setTab(next)
    onTabChange?.(next)
  }
  const [notes, setNotes] = useState(record.notes)
  const [plan, setPlan] = useState<ModulePlan>(() => currentPlanOf(record))
  const [stageChanges, setStageChanges] = useState<Record<StageId, string | null>>({})
  const [inspectionDate, setInspectionDate] = useState(today)
  const [kind, setKind] = useState<Inspection['kind']>('inspection')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const detailsDirty = notes !== record.notes
  const planDirty = JSON.stringify(plan) !== JSON.stringify(currentPlanOf(record))
  const inspectionDirty = content.length > 0
  const stagesDirty = Object.keys(stageChanges).length > 0
  const [geometryDirty, setGeometryDirty] = useState(false)
  const dirty = detailsDirty || planDirty || inspectionDirty || stagesDirty || geometryDirty
  const locked = busy || pending !== null
  const percentage = progress(record, stages)
  const issues = openIssues(record)
  const planStages = stages.filter(stage => stage.id !== 'installation')
  const installationActive = workflowStages.some(stage => stage.id === 'installation' && stage.active)
  const inactiveWithHistory = workflowStages.filter(stage => !stage.active && Boolean(plannedStageDateOf(record.currentPlan, stage.id) || plannedStageDateOf(record.baselinePlan, stage.id) || actualStageDateOf(record, stage.id)))

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  useEffect(() => {
    if (!dirty) return
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [dirty])

  async function execute(command: ProjectCommand, action: string) {
    if (locked) return false
    setPending(action)
    setError('')
    setNotice('')
    try {
      const res = await onCommand(command)
      const success = typeof res === 'boolean' ? res : res.success
      if (!success) {
        const msg = (typeof res === 'object' && res.error) || '저장하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해 주세요.'
        setError(msg)
      }
      return success
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '저장하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'
      setError(msg)
      return false
    } finally {
      setPending(null)
    }
  }

  async function saveStages() {
    if (await execute({ type: 'bulk-stage', moduleKeys: [record.key], stages: stageChanges }, 'bulk-stage')) {
      setStageChanges({})
      setNotice('공정 상태를 저장했습니다.')
    }
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await execute({ type: 'notes', key: record.key, notes: notes.trim(), targetDate: record.targetDate }, 'details')) {
      setNotes(notes.trim())
      setNotice('모듈 메모를 저장했습니다.')
    }
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = { ...plan, zone: plan.zone.trim(), factory: plan.factory.trim() }
    if (await execute({ type: 'plan', key: record.key, plan: normalized }, 'plan')) {
      setPlan(normalized)
      setNotice('모듈 관리계획을 저장했습니다.')
    }
  }

  async function addInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValidDate(inspectionDate)) {
      setError('검사일을 올바른 날짜로 입력해 주세요.')
      return
    }
    if (!content.trim()) {
      setError('기록할 내용을 입력해 주세요.')
      return
    }
    if (await execute({ type: 'inspect', key: record.key, date: inspectionDate, kind, content: content.trim() }, 'inspection')) {
      setContent('')
      setNotice('새 기록을 등록했습니다.')
    }
  }

  return (
    <aside className={styles.panel} aria-label={`모듈 ${moduleNumber(record, config)} 상세 정보`}>
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <div><span className={styles.eyebrow}>SELECTED MODULE</span><h2>{moduleNumber(record, config)}</h2></div>
          <span className={styles.floorBadge}>{floorLabelOf(record.floor, config)}</span>
        </div>
        {phase === 'production' && <><div className={styles.progressHeading}><span>제작 진행률 <strong>{percentage}%</strong></span><span>{completedCount(record, stages)} / {stages.length} 공정</span></div>
        <div className={styles.progressTrack} role="progressbar" aria-label="제작 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><span style={{ width: `${percentage}%` }} /></div></>}
        {issues > 0 && <div className={styles.issueSummary}><IconAlertTriangle size={14} /><span>미해결 이슈 {issues}건</span><button type="button" onClick={() => setTab('inspections')}>확인하기</button></div>}
      </header>

      {phase === 'production' && baselinePlanAt && !record.baselinePlan && <div className={styles.baselineNotice}>착수 기준선 미포함 · 제작 시작 후 추가된 모듈입니다. 현재 계획과 실적은 관리하며, 착수 기준 대비 지연 집계에서는 제외합니다.</div>}

      <ModuleDimensionsEditor module={record} config={config} generalHeight={generalHeight ?? 4} busy={locked} otherDirty={detailsDirty || planDirty || inspectionDirty || stagesDirty} onDirtyChange={value=>{setGeometryDirty(value);onGeometryDirty?.(value)}} onRemove={record.kind?onRemove:undefined} onSave={(dimensions,baseZ) => execute({ type: 'module-dimensions', key: record.key, dimensions, baseZ }, 'dimensions')} />
      <div className={styles.tabs} role="tablist" aria-label="모듈 정보 구분">
        {([
          ['plan', '관리계획', IconCalendar],
          ['stages', '공정', IconClipboardCheck],
          ['inspections', '검사·이슈', IconMessage],
          ['history', '변경 이력', IconHistory],
        ] as const).filter(([value]) => phase === 'production' || value === 'plan' || value === 'stages').map(([value, label, Icon], index, items) => (
          <button key={value} type="button" role="tab" id={`${id}-tab-${value}`} aria-selected={tab === value} aria-controls={`${id}-panel-${value}`} tabIndex={tab === value ? 0 : -1} className={tab === value ? styles.activeTab : ''} onClick={() => handleTabChange(value)} onKeyDown={event => {
            let next = index
            if (event.key === 'ArrowRight') next = (index + 1) % items.length
            else if (event.key === 'ArrowLeft') next = (index + items.length - 1) % items.length
            else if (event.key === 'Home') next = 0
            else if (event.key === 'End') next = items.length - 1
            else return
            event.preventDefault()
            handleTabChange(items[next][0])
            document.getElementById(`${id}-tab-${items[next][0]}`)?.focus()
          }}><Icon size={15} stroke={1.7} />{label}</button>
        ))}
      </div>

      <div className={styles.body}>
        {error && <div className={styles.error} role="alert"><IconAlertTriangle size={16} />{error}</div>}
        {notice && <div className={styles.notice} role="status"><IconCheck size={16} />{notice}</div>}

        <section role="tabpanel" id={`${id}-panel-plan`} aria-labelledby={`${id}-tab-plan`} hidden={tab !== 'plan'}>
          <div className={styles.sectionIntro}>
            <h3>모듈 관리계획</h3>
            <p>
              구역·생산 공장·설치 예정일과 활성 공정의 계획 완료일을 입력합니다.
              <br />
              <strong>[계획 저장] 버튼을 누르면 해당 모듈의 입력 내용이 즉시 서버(Supabase)에 실시간 영구 저장</strong>되므로, 중간에 창을 닫거나 나중에 다시 들어와도 안전하게 유지됩니다.
            </p>
          </div>
          <form className={styles.planForm} onSubmit={savePlan}>
            <div className={styles.formColumns}>
              <label className={styles.field}><span>Zone / 구역</span><input maxLength={80} placeholder="예: A zone, B-1 zone" value={plan.zone} disabled={locked} onChange={event => setPlan(value => ({ ...value, zone: event.target.value }))} /></label>
              <label className={styles.field}><span>생산 공장</span><input maxLength={80} placeholder="예: 진천, 보은-1" value={plan.factory} disabled={locked} onChange={event => setPlan(value => ({ ...value, factory: event.target.value }))} /></label>
            </div>
            <label className={styles.field}><span><IconCalendar size={14} />설치 예정일{!installationActive && ' · 설치 공정 비활성'}</span><input type="date" value={plan.installationDate} disabled={locked || !installationActive} onChange={event => setPlan(value => ({ ...value, installationDate: event.target.value }))} /></label>
            {phase === 'production' && baselinePlanAt && record.baselinePlan && <div className={styles.baselineNotice}>착수 기준 {baselinePlanAt.slice(0, 10)} · {record.baselinePlan.zone || '구역 미계획'} · {record.baselinePlan.factory || '공장 미계획'} · 설치 {record.baselinePlan.installationDate || '미계획'}</div>}
            <div className={styles.planSectionHeading}><h4>공정별 계획 완료일</h4><span>{planStages.filter(stage => Boolean(plannedStageDateOf(plan, stage.id))).length} / {planStages.length}건 입력</span></div>
            {planStages.map(stage => {
              const baseline = record.baselinePlan?.stages[stage.id] ?? ''
              const current = plannedStageDateOf(plan, stage.id)
              const actual = actualStageDateOf(record, stage.id)
              const currentDelta = dayDelta(actual, current)
              const baselineDelta = dayDelta(actual, baseline)
              return <div className={styles.planStageRow} key={stage.id}>
                <label className={styles.planStageField}><span>{stage.label}</span><input type="date" value={current} disabled={locked} onChange={event => setPlan(value => ({ ...value, stages: { ...value.stages, [stage.id]: event.target.value } }))} /></label>
                <div className={styles.planStageMeta}><span>기준 {baseline || (baselinePlanAt ? '미계획' : '미설정')}</span><span>실제 {actual || '미완료'} · {deltaText(currentDelta, current, actual)}{baseline ? ` · 기준 ${deltaText(baselineDelta, baseline, actual)}` : ''}</span>{actual && actual > today() && <b className={styles.invalidActual}>미래 실제일 · 지연 판정상 미완료</b>}</div>
              </div>
            })}
            {inactiveWithHistory.length > 0 && <details className={styles.inactiveStageHistory}>
              <summary>비활성 공정의 기존 계획·실적 {inactiveWithHistory.length}개 보기</summary>
              {inactiveWithHistory.map(stage => <div className={styles.inactiveStageRow} key={stage.id}><b>{stage.label}</b>{baselineWorkflowStages.find(item => item.id === stage.id)?.label && baselineWorkflowStages.find(item => item.id === stage.id)?.label !== stage.label && <small>착수 기준 공정명: {baselineWorkflowStages.find(item => item.id === stage.id)?.label}</small>}<span>기준 계획 {plannedStageDateOf(record.baselinePlan, stage.id) || '미입력'} · 현재 계획 {plannedStageDateOf(plan, stage.id) || '미입력'} · 실제 {actualStageDateOf(record, stage.id) || '미완료'}</span></div>)}
              <small>비활성화된 공정은 계획·실적 입력과 집계에서 제외되며, 기존 기록은 보존됩니다.</small>
            </details>}
            {phase === 'production' && !baselinePlanAt && <div className={styles.baselineNotice}>기준일정이 설정되지 않았습니다. 현재 계획 저장은 가능하지만 기준 대비 편차는 기준일정을 설정한 뒤부터 계산합니다.</div>}
            <div className={styles.saveRow}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 600, color: planDirty ? '#D97706' : '#15803D' }}>
                  {planDirty ? '● 저장되지 않은 관리계획이 있습니다' : '✓ 관리계획 저장 완료 (서버 동기화됨)'}
                </span>
                <small style={{ fontSize: '10px', color: '#64748B' }}>
                  {planDirty ? '아래 [계획 저장] 버튼을 누르면 즉시 데이터베이스에 보관됩니다.' : '모듈별로 즉시 저장되므로 언제든 창을 닫거나 나중에 이어서 작업할 수 있습니다.'}
                </small>
              </div>
              <button type="submit" className={styles.primaryButton} disabled={locked || !planDirty}>
                <IconDeviceFloppy size={15} />{pending === 'plan' ? '저장 중…' : '계획 저장'}
              </button>
            </div>
          </form>
          {phase === 'production' && <form className={styles.notesForm} onSubmit={saveDetails}>
            <h3>모듈 관리 메모</h3>
            <label className={styles.field}><span>메모</span><textarea rows={3} maxLength={4000} placeholder="이 모듈의 관리 사항을 입력하세요" value={notes} disabled={locked} onChange={event => setNotes(event.target.value)} /></label>
            <div className={styles.saveRow}><span>{detailsDirty ? '저장하지 않은 변경사항' : '변경사항이 저장되어 있습니다'}</span><button type="submit" className={styles.primaryButton} disabled={locked || !detailsDirty}><IconDeviceFloppy size={15} />{pending === 'details' ? '저장 중' : '메모 저장'}</button></div>
          </form>}
        </section>

        <section role="tabpanel" id={`${id}-panel-stages`} aria-labelledby={`${id}-tab-stages`} hidden={tab !== 'stages'} className={styles.stagesPanel}>
          <div className={styles.sectionIntro}>
            <p>완료한 공정을 입력하세요</p>
          </div>
          <div className={styles.stageGroup}>
              {stages.map(stage => {
                const stageDate = stageChanges[stage.id] !== undefined ? stageChanges[stage.id] : actualStageDateOf(record, stage.id)
                const actualIsValid = validActualDate(stageDate || undefined)
                const planDate = plannedStageDateOf(currentPlanOf(record), stage.id)
                const variance = dayDelta(stageDate || undefined, planDate)
                const delayDays = variance !== null && variance > 0 ? variance : !stageDate && planDate && planDate < today() ? dayDelta(today(), planDate) : null
                return <div className={`${styles.stageRow} ${actualIsValid ? styles.stageDone : ''}`} key={stage.id}>
                  <label className={styles.stageCheck}>
                    <input type="checkbox" checked={Boolean(stageDate)} disabled={locked} onChange={() => {
                      const original = actualStageDateOf(record, stage.id)
                      const nextValue = !Boolean(stageDate) ? (original || today()) : null
                      if (nextValue === (original || null)) {
                        setStageChanges(prev => { const next = { ...prev }; delete next[stage.id]; return next })
                      } else {
                        setStageChanges(prev => ({ ...prev, [stage.id]: nextValue }))
                      }
                    }} />
                    <span>{stage.label}</span>
                  </label>
                  <div className={styles.stageInfo}>
                    <div className={styles.stageDataRow}>
                      <span className={styles.stageLabel}>계획</span>
                      <span className={styles.stageLabel}>완료</span>
                    </div>
                    <div className={styles.stageDataRow}>
                      <span className={styles.stagePlanDate}>{planDate || '미입력'}</span>
                      <label className={styles.stageActual}>
                        <input className={styles.stageDate} type="date" max={today()} value={stageDate || ''} aria-label={`${stage.label} 완료일`} disabled={locked} onChange={event => {
                          const value = event.target.value
                          if (value && !isValidDate(value)) { setError('완료일을 입력해 주세요.'); return }
                          if (value > today()) { setError('실제 공정 완료일은 오늘 이후로 입력할 수 없습니다.'); return }
                          const original = actualStageDateOf(record, stage.id)
                          if (value === original || (!value && !original)) {
                            setStageChanges(prev => { const next = { ...prev }; delete next[stage.id]; return next })
                          } else {
                            setStageChanges(prev => ({ ...prev, [stage.id]: value || null }))
                          }
                        }} />
                      </label>
                    </div>
                  </div>
                  {delayDays !== null && delayDays > 0 && <b className={styles.stageDelay}>{String(delayDays).padStart(2, '0')}일 지연</b>}
                </div>
              })}
          </div>
          {inactiveWithHistory.length > 0 && <div className={styles.inactiveStageHistory}><h4>비활성 공정 · 기록 보존</h4>{inactiveWithHistory.map(stage => <div className={styles.inactiveStageRow} key={stage.id}><b>{stage.label}</b><span>계획 {plannedStageDateOf(currentPlanOf(record), stage.id) || '미입력'} · 실제 {actualStageDateOf(record, stage.id) || '미완료'}</span></div>)}</div>}
        </section>

        <section role="tabpanel" id={`${id}-panel-inspections`} aria-labelledby={`${id}-tab-inspections`} hidden={tab !== 'inspections'}>
          <div className={styles.sectionIntro}><h3>검사·이슈 기록</h3><p>검사 결과와 특이사항을 날짜별로 남깁니다. 등록된 기록은 이력으로 보존됩니다.</p></div>
          <form className={styles.inspectionForm} onSubmit={addInspection}>
            <div className={styles.formColumns}>
              <label className={styles.field}><span>검사일</span><input type="date" required value={inspectionDate} disabled={locked} onChange={event => setInspectionDate(event.target.value)} /></label>
              <label className={styles.field}><span>기록 구분</span><select value={kind} disabled={locked} onChange={event => setKind(event.target.value as Inspection['kind'])}><option value="inspection">검사 기록</option><option value="issue">이슈</option><option value="note">특이사항</option></select></label>
            </div>
            <label className={styles.field}><span>내용</span><textarea rows={4} required maxLength={4000} placeholder="검사 결과, 이슈 또는 특이사항을 입력하세요" value={content} disabled={locked} onChange={event => setContent(event.target.value)} /></label>
            <div className={styles.inspectionActions}><span>{content.length.toLocaleString()} / 4,000</span><button type="submit" className={styles.primaryButton} disabled={locked || !content.trim()}><IconPlus size={15} />{pending === 'inspection' ? '등록 중' : '기록 등록'}</button></div>
          </form>
          <div className={styles.listHeading}><h3>누적 기록</h3><span>{record.inspections.length}건</span></div>
          {record.inspections.length === 0 ? <div className={styles.listEmpty}><IconClipboardCheck size={24} stroke={1.3} /><p>아직 등록된 기록이 없습니다.</p></div> : <div className={styles.inspectionList}>
            {[...record.inspections].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).map(item => <article className={`${styles.inspectionCard} ${item.kind === 'issue' && item.status === 'open' ? styles.openIssue : ''}`} key={item.id}>
              <div className={styles.recordHeading}><span className={`${styles.kindBadge} ${item.kind === 'issue' ? styles.issueKind : ''}`}>{KIND_LABELS[item.kind]}</span><time dateTime={item.date}>{item.date}</time></div>
              <p>{item.content}</p>
              <div className={styles.recordFooter}>
                {item.kind === 'issue' ? <><span className={item.status === 'resolved' ? styles.resolved : styles.unresolved}>{item.status === 'resolved' ? <IconCheck size={13} /> : <span className={styles.amberDot} />}{item.status === 'resolved' ? '해결됨' : '미해결'}</span><button type="button" className={styles.textButton} disabled={locked} onClick={() => void execute({ type: 'resolve', key: record.key, inspectionId: item.id, resolved: item.status !== 'resolved' }, item.id)}>{item.status === 'resolved' ? <IconArrowBackUp size={13} /> : <IconCheck size={13} />}{item.status === 'resolved' ? '재오픈' : '해결 처리'}</button></> : <span>등록 {formatTimestamp(item.createdAt)}</span>}
              </div>
              {item.kind === 'issue' && item.status === 'resolved' && item.resolvedAt && <span className={styles.resolvedAt}>해결 {formatTimestamp(item.resolvedAt)}</span>}
            </article>)}
          </div>}
        </section>

        <section role="tabpanel" id={`${id}-panel-history`} aria-labelledby={`${id}-tab-history`} hidden={tab !== 'history'}>
          <div className={styles.sectionIntro}><h3>변경 이력</h3><p>공정 완료, 메모, 검사 및 이슈의 변경 기록입니다. 축열 시작값 변경 전 이력은 당시 번호로 보존됩니다.</p></div>
          {record.history.length === 0 ? <div className={styles.listEmpty}><IconClock size={24} stroke={1.3} /><p>아직 변경 이력이 없습니다.</p></div> : <ol className={styles.timeline}>{[...record.history].sort((a, b) => b.at.localeCompare(a.at)).map(item => <li key={item.id}><span className={styles.timelineDot} /><time dateTime={item.at}>{formatTimestamp(item.at)}</time><p>{item.message}</p></li>)}</ol>}
        </section>
      </div>
      <footer className={styles.panelFooter}>
        {tab === 'stages' && stagesDirty ? (
          <div className={styles.footerSaveArea}>
            <span className={styles.footerWarning}>저장하지 않은 입력이 있습니다.</span>
            <button type="button" className={styles.primaryButton} disabled={locked} onClick={saveStages}>
              <IconDeviceFloppy size={15} />{pending === 'bulk-stage' ? '저장 중…' : '공정상태 저장'}
            </button>
          </div>
        ) : (
          <><span className={styles.footerDot} />{locked ? '변경사항 저장 중…' : dirty ? '저장하지 않은 입력이 있습니다' : '완료 공정과 기록은 서버에 저장됩니다'}</>
        )}
      </footer>
    </aside>
  )
}
