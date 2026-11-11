import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheck,
  IconClipboardCheck,
  IconDeviceFloppy,
  IconLayersIntersect,
  IconUsers,
} from '@tabler/icons-react'
import {
  actualStageDateOf,
  currentPlanOf,
  moduleNumber,
  today,
  type ManagementPhase,
  type ModulePlan,
  type ModulePlanPatch,
  type ModuleRecord,
  type ProjectCommand,
  type ProjectConfig,
  type StageId,
  type WorkflowStage,
} from '../common/model'
import styles from './BulkPlanEditor.module.css'

type FieldId = 'zone' | 'factory' | 'installationDate' | `stage:${StageId}`
type FieldValues = Record<FieldId, string>

interface BulkPlanEditorProps {
  modules: ModuleRecord[]
  config?: ProjectConfig
  stages: WorkflowStage[]
  installationActive: boolean
  phase: ManagementPhase
  busy: boolean
  onCommand: (command: ProjectCommand) => Promise<{ success: boolean; error?: string } | boolean>
  onDirtyChange?: (dirty: boolean) => void
  initialTab?: 'plan' | 'stages'
  onTabChange?: (tab: 'plan' | 'stages') => void
}

function valuesFor(plans: ModulePlan[], stages: WorkflowStage[]): FieldValues {
  const common = (values: string[]) => (values.every(value => value === values[0]) ? values[0] ?? '' : '')
  return {
    zone: common(plans.map(plan => plan.zone)),
    factory: common(plans.map(plan => plan.factory)),
    installationDate: common(plans.map(plan => plan.installationDate)),
    ...Object.fromEntries(
      stages.map(stage => [`stage:${stage.id}`, common(plans.map(plan => plan.stages[stage.id] ?? ''))])
    ) as Pick<FieldValues, `stage:${StageId}`>,
  }
}

function valueFor(plan: ReturnType<typeof currentPlanOf>, field: FieldId) {
  if (field === 'zone') return plan.zone
  if (field === 'factory') return plan.factory
  if (field === 'installationDate') return plan.installationDate
  return plan.stages[field.slice(6) as StageId] ?? ''
}

export function BulkPlanEditor({
  modules,
  config,
  stages,
  installationActive,
  phase,
  busy,
  onCommand,
  onDirtyChange,
  initialTab,
  onTabChange,
}: BulkPlanEditorProps) {
  const id = useId()
  const todayStr = today()

  // 1. Tab state
  const [tab, setTab] = useState<'plan' | 'stages'>(() => initialTab ?? (phase === 'production' ? 'stages' : 'plan'))

  useEffect(() => {
    if (initialTab && initialTab !== tab) {
      setTab(initialTab)
    }
  }, [initialTab])

  const handleTabSwitch = (next: 'plan' | 'stages') => {
    setTab(next)
    onTabChange?.(next)
    setError('')
    setNotice('')
  }

  // 2. Stage Changes State (matches simple single-module pattern)
  const [stageChanges, setStageChanges] = useState<Record<StageId, string | null>>({})

  // Reset stageChanges when modules selection changes
  useEffect(() => {
    setStageChanges({})
  }, [modules])

  // 3. Plan Form State
  const planStages = useMemo(() => stages.filter(stage => stage.id !== 'installation'), [stages])
  const plans = useMemo(() => modules.map(currentPlanOf), [modules])
  const initialValues = useMemo(() => valuesFor(plans, planStages), [plans, planStages])
  const [values, setValues] = useState<FieldValues>(() => initialValues)
  const [enabled, setEnabled] = useState<Set<FieldId>>(() => new Set())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const locked = busy || pending

  const patch = useMemo<ModulePlanPatch>(() => {
    const next: ModulePlanPatch = {}
    if (enabled.has('zone')) next.zone = values.zone.trim()
    if (enabled.has('factory')) next.factory = values.factory.trim()
    if (enabled.has('installationDate')) next.installationDate = values.installationDate
    const stagePatch: Partial<Record<StageId, string>> = {}
    for (const stage of planStages) {
      const field = `stage:${stage.id}` as const
      if (enabled.has(field)) stagePatch[stage.id] = values[field]
    }
    if (Object.keys(stagePatch).length) next.stages = stagePatch
    return next
  }, [enabled, planStages, values])

  const changedModules = useMemo(() => modules.filter((_, index) => {
    const plan = plans[index]
    if (patch.zone !== undefined && plan.zone !== patch.zone) return true
    if (patch.factory !== undefined && plan.factory !== patch.factory) return true
    if (patch.installationDate !== undefined && plan.installationDate !== patch.installationDate) return true
    return Object.entries(patch.stages ?? {}).some(([stage, date]) => (plan.stages[stage as StageId] ?? '') !== date)
  }), [modules, plans, patch])

  const stagesDirty = Object.keys(stageChanges).length > 0
  const planDirty = useMemo(() => {
    const hasValueEdit = (Object.keys(values) as FieldId[]).some(field => values[field] !== initialValues[field])
    return hasValueEdit || changedModules.length > 0
  }, [values, initialValues, changedModules])

  const dirty = tab === 'stages' ? stagesDirty : planDirty

  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [dirty])

  // Stage toggle handler
  function handleToggleStage(
    stageId: StageId,
    currentlyChecked: boolean,
    currentDate: string,
    isAllDone: boolean,
    originalDate: string,
    completedCount: number
  ) {
    if (locked) return
    setError('')
    setNotice('')
    if (currentlyChecked) {
      // Uncheck stage
      if (completedCount === 0) {
        setStageChanges(prev => {
          const next = { ...prev }
          delete next[stageId]
          return next
        })
      } else {
        setStageChanges(prev => ({ ...prev, [stageId]: null }))
      }
    } else {
      // Check stage
      const nextDate = currentDate || todayStr
      if (isAllDone && nextDate === originalDate) {
        setStageChanges(prev => {
          const next = { ...prev }
          delete next[stageId]
          return next
        })
      } else {
        setStageChanges(prev => ({ ...prev, [stageId]: nextDate }))
      }
    }
  }

  // Stage date change handler
  function handleStageDateChange(
    stageId: StageId,
    newDate: string,
    isAllDone: boolean,
    originalDate: string,
    completedCount: number
  ) {
    if (locked) return
    if (!newDate) {
      if (completedCount === 0) {
        setStageChanges(prev => {
          const next = { ...prev }
          delete next[stageId]
          return next
        })
      } else {
        setStageChanges(prev => ({ ...prev, [stageId]: null }))
      }
      return
    }
    if (newDate > todayStr) {
      setError('실제 공정 완료일은 오늘 이후로 입력할 수 없습니다.')
      return
    }
    setError('')
    if (isAllDone && newDate === originalDate) {
      setStageChanges(prev => {
        const next = { ...prev }
        delete next[stageId]
        return next
      })
    } else {
      setStageChanges(prev => ({ ...prev, [stageId]: newDate }))
    }
  }

  // Save stage changes
  async function saveStages() {
    if (locked || !modules.length || !stagesDirty) return
    setPending(true)
    setError('')
    setNotice('')
    try {
      const res = await onCommand({
        type: 'bulk-stage',
        moduleKeys: modules.map(m => m.key),
        stages: stageChanges,
      })
      const isSuccess = typeof res === 'boolean' ? res : res.success
      if (isSuccess) {
        setNotice(`${modules.length}개 모듈의 공정상태를 저장했습니다.`)
        setStageChanges({})
      } else {
        const errorMsg = (typeof res === 'object' && res.error) || '공정 상태 일괄 저장에 실패했습니다.'
        setError(errorMsg)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '공정 상태 일괄 저장에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  // Plan field helpers
  function setField(field: FieldId, value: string) {
    setValues(current => ({ ...current, [field]: value }))
  }

  function toggleField(field: FieldId) {
    setEnabled(current => {
      const next = new Set(current)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  function fieldMeta(field: FieldId) {
    const fieldValues = plans.map(plan => valueFor(plan, field))
    const unique = new Set(fieldValues)
    return unique.size > 1 ? `${unique.size}가지 기존 값` : fieldValues[0] ? `현재 ${fieldValues[0]}` : '현재 미입력'
  }

  // Submit Plan Form
  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked || !modules.length || !changedModules.length) return
    setPending(true)
    setError('')
    setNotice('')
    try {
      const res = await onCommand({ type: 'bulk-plan', moduleKeys: modules.map(module => module.key), patch })
      const isSuccess = typeof res === 'boolean' ? res : res.success
      const errorMsg = (typeof res === 'object' && res.error) || '일괄 저장에 실패했습니다. 최신 데이터를 확인한 뒤 다시 시도해 주세요.'
      if (isSuccess) {
        setNotice(`${changedModules.length}개 모듈의 계획 항목을 일괄 저장했습니다.`)
      } else {
        setError(errorMsg)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '일괄 저장에 실패했습니다. 연결 상태를 확인해 주세요.'
      setError(msg)
    } finally {
      setPending(false)
    }
  }

  const selectedPreview = [...modules].sort((a, b) => a.floor - b.floor || a.y - b.y || a.x - b.x)
  const floorCount = new Set(modules.map(module => module.floor)).size

  const textField = (field: 'zone' | 'factory', label: string, placeholder: string) => (
    <div className={styles.fieldBlock} key={field}>
      <div className={styles.fieldHeading}>
        <label htmlFor={`${id}-apply-${field}`}>
          <input
            id={`${id}-apply-${field}`}
            type="checkbox"
            checked={enabled.has(field)}
            disabled={locked}
            onChange={() => toggleField(field)}
          />
          {label}
        </label>
        <small>{fieldMeta(field)}</small>
      </div>
      <input
        id={`${id}-${field}`}
        type="text"
        maxLength={80}
        value={values[field]}
        disabled={locked || !enabled.has(field)}
        placeholder={placeholder}
        onChange={event => setField(field, event.target.value)}
      />
    </div>
  )

  const dateField = (field: 'installationDate', label: string) => (
    <div className={styles.fieldBlock} key={field}>
      <div className={styles.fieldHeading}>
        <label htmlFor={`${id}-apply-${field}`}>
          <input
            id={`${id}-apply-${field}`}
            type="checkbox"
            checked={enabled.has(field)}
            disabled={locked || !installationActive}
            onChange={() => toggleField(field)}
          />
          {label}
        </label>
        <small>{installationActive ? fieldMeta(field) : '설치 공정 비활성'}</small>
      </div>
      <input
        id={`${id}-${field}`}
        type="date"
        value={values[field]}
        disabled={locked || !installationActive || !enabled.has(field)}
        onChange={event => setField(field, event.target.value)}
      />
    </div>
  )

  if (!modules.length) {
    return (
      <aside className={styles.panel} aria-label="복수 모듈 일괄 관리">
        <header className={styles.header}>
          <div className={styles.headingRow}>
            <div>
              <span className={styles.eyebrow}>SELECTED MODULES</span>
              <h2>선택한 모듈 <span className={styles.countBadge}>0개</span></h2>
            </div>
          </div>
        </header>
        <div className={styles.empty}>
          <IconUsers size={25} stroke={1.4} />
          <strong>선택된 모듈이 없습니다</strong>
          <span>그리드에서 모듈을 클릭하거나 현재 층 전체를 선택하세요.</span>
        </div>
      </aside>
    )
  }

  return (
    <aside className={styles.panel} aria-label="복수 모듈 일괄 관리">
      {/* Red box content replaced with Selected Modules info from yellow box */}
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <div>
            <span className={styles.eyebrow}>SELECTED MODULES</span>
            <h2>
              선택한 모듈 <span className={styles.countBadge}>{modules.length}개</span>
            </h2>
          </div>
          <span className={styles.floorBadge}>{floorCount}개 층</span>
        </div>
        <div className={styles.moduleNumbers}>
          {selectedPreview.slice(0, 15).map(module => (
            <span key={module.key}>{moduleNumber(module, config)}</span>
          ))}
          {modules.length > 15 && <b>+ {modules.length - 15}개</b>}
        </div>
      </header>

      {/* Tab bar to switch between stage and plan */}
      <div className={styles.tabs} role="tablist" aria-label="일괄 입력 구분">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'stages'}
          className={tab === 'stages' ? styles.activeTab : ''}
          onClick={() => handleTabSwitch('stages')}
        >
          <IconClipboardCheck size={15} stroke={1.7} />
          공정
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'plan'}
          className={tab === 'plan' ? styles.activeTab : ''}
          onClick={() => handleTabSwitch('plan')}
        >
          <IconCalendar size={15} stroke={1.7} />
          관리계획
        </button>
      </div>

      <div className={styles.body}>
        {error && (
          <div className={styles.error} role="alert">
            <IconAlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className={styles.notice} role="status">
            <IconCheck size={15} />
            <span>{notice}</span>
          </div>
        )}

        {/* TAB 1: STAGES (Green box simplified to 공정이름 / 완료일정 with no 계획 column) */}
        {tab === 'stages' && (
          <div className={styles.stagesList}>
            <div className={styles.sectionIntro}>
              <p>완료한 공정을 입력하세요</p>
            </div>

            {stages.map(stage => {
              const completedModules = modules.filter(m => Boolean(actualStageDateOf(m, stage.id)))
              const completedCount = completedModules.length
              const isAllDone = completedCount === modules.length && modules.length > 0
              const firstDate = completedModules[0] ? actualStageDateOf(completedModules[0], stage.id) : ''
              const isCommonDate = isAllDone && modules.every(m => actualStageDateOf(m, stage.id) === firstDate)
              const originalDate = isCommonDate ? firstDate : ''

              const pendingChange = stageChanges[stage.id]
              const isChecked = pendingChange !== undefined ? pendingChange !== null : isAllDone
              const dateValue = pendingChange !== undefined ? (pendingChange ?? '') : originalDate

              return (
                <div
                  key={stage.id}
                  className={`${styles.stageRow} ${isChecked ? styles.stageDone : ''}`}
                >
                  <label className={styles.stageCheck}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={locked}
                      onChange={() =>
                        handleToggleStage(
                          stage.id,
                          isChecked,
                          dateValue,
                          isAllDone,
                          originalDate,
                          completedCount
                        )
                      }
                    />
                    <span>{stage.label}</span>
                  </label>
                  <div className={styles.stageInfo}>
                    <div className={styles.stageDataRow}>
                      <span className={styles.stageLabel}>완료</span>
                    </div>
                    <div className={styles.stageDataRow}>
                      <label className={styles.stageActual}>
                        <input
                          className={styles.stageDate}
                          type="date"
                          max={todayStr}
                          value={dateValue || ''}
                          aria-label={`${stage.label} 완료일`}
                          disabled={locked}
                          onChange={e =>
                            handleStageDateChange(
                              stage.id,
                              e.target.value,
                              isAllDone,
                              originalDate,
                              completedCount
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TAB 2: PLAN BULK INPUT */}
        {tab === 'plan' && (
          <form id={`${id}-plan-form`} onSubmit={submitPlan}>
            <div className={styles.sectionHeading}>
              <h3>공통 적용 항목</h3>
              <span>값이 다르면 새 입력값을 일괄 적용</span>
            </div>
            <div className={styles.fields}>
              {textField('zone', 'Zone / 구역', '예: A zone, B-1 zone')}
              {textField('factory', '생산 공장', '예: 진천, 보은-1')}
              {dateField('installationDate', '설치 예정일')}
            </div>
            <div className={styles.stageHeading}>
              <h3>
                <IconLayersIntersect size={15} />
                공정별 계획 완료일
              </h3>
              <span>{planStages.length}개 공정</span>
            </div>
            <div className={styles.stages}>
              {planStages.map(stage => {
                const field = `stage:${stage.id}` as const
                return (
                  <div className={styles.stageField} key={stage.id}>
                    <div className={styles.fieldHeading}>
                      <label htmlFor={`${id}-apply-${field}`}>
                        <input
                          id={`${id}-apply-${field}`}
                          type="checkbox"
                          checked={enabled.has(field)}
                          disabled={locked}
                          onChange={() => toggleField(field)}
                        />
                        {stage.label}
                      </label>
                      <small>{fieldMeta(field)}</small>
                    </div>
                    <input
                      id={`${id}-${field}`}
                      type="date"
                      value={values[field]}
                      disabled={locked || !enabled.has(field)}
                      onChange={event => setField(field, event.target.value)}
                    />
                  </div>
                )
              })}
            </div>
          </form>
        )}
      </div>

      {/* Footer matching ModuleDetail footer */}
      <footer className={styles.panelFooter}>
        {tab === 'stages' && stagesDirty ? (
          <div className={styles.footerSaveArea}>
            <span className={styles.footerWarning}>저장하지 않은 입력이 있습니다.</span>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={locked}
              onClick={saveStages}
            >
              <IconDeviceFloppy size={15} />
              {pending ? '저장 중…' : '공정상태 저장'}
            </button>
          </div>
        ) : tab === 'plan' && planDirty ? (
          <div className={styles.footerSaveArea}>
            <span className={styles.footerWarning}>저장하지 않은 입력이 있습니다.</span>
            <button
              type="submit"
              form={`${id}-plan-form`}
              className={styles.primaryButton}
              disabled={locked || !changedModules.length}
            >
              <IconDeviceFloppy size={15} />
              {pending ? '저장 중…' : '선택 모듈에 일괄 저장'}
            </button>
          </div>
        ) : (
          <>
            <span className={styles.footerDot} />
            {locked
              ? '변경사항 저장 중…'
              : dirty
              ? '저장하지 않은 입력이 있습니다'
              : '완료 공정과 기록은 서버에 저장됩니다'}
          </>
        )}
      </footer>
    </aside>
  )
}
