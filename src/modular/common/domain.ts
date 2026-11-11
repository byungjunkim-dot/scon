import { axisNumber, currentPlanOf, defaultWorkflowStages, layoutStatusOf, managementPhaseOf, moduleKey, moduleNumber, today, totalFloorsOf, workflowStagesOf, type HistoryEntry, type LayoutPosition, type ModulePlan, type ModulePlanPatch, type ModuleRecord, type ProjectCommand, type ProjectConfig, type ProjectDetail, type StageId, type WorkflowStage } from './model'

import { isStageColor } from './stageColors'

export const MAX_PLACED_MODULES = 5000
export const MAX_MODULE_HISTORY = 1000
export const MAX_PROJECT_HISTORY = 20000
export const MAX_PROJECT_MODULE_MIRROR = 19000
export const MAX_INSPECTIONS = 500
export const MAX_PLAN_REVISIONS = 100
export const MAX_WORKFLOW_STAGES = 41
export const MAX_WORKFLOW_REVISIONS = 100

export interface DomainContext { now: () => string; uuid: () => string }
export class DomainError extends Error {
  constructor(message: string, readonly status: 400 | 409 = 400) { super(message); this.name = 'DomainError' }
}
function fail(message: string, status: 400 | 409 = 400): never { throw new DomainError(message, status) }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('입력 형식을 확인해 주세요.')
  return value as Record<string, unknown>
}
function keys(value: Record<string, unknown>, expected: readonly string[]) {
  if (Object.keys(value).length !== expected.length || Object.keys(value).some(k => !expected.includes(k))) fail('입력 항목을 확인해 주세요.')
}
function integer(value: unknown, min: number, max: number, label: string, displayOffset = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail(`${label}: ${min + displayOffset}~${max + displayOffset}의 정수를 입력해 주세요.`)
  return value
}
function text(value: unknown, min: number, max: number, label: string, trim = false): string {
  if (typeof value !== 'string') fail(`${label}을 확인해 주세요.`)
  const result = trim ? value.trim() : value
  if (result.length < min || result.length > max || result.includes('\u0000')) fail(`${label}: ${min}~${max}자 범위로 입력해 주세요.`)
  return result
}
export function validateDate(value: unknown, optional = false): string {
  if (optional && value === '') return ''
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) fail('날짜는 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.')
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail('존재하지 않는 날짜입니다.')
  return value
}
export function validateConfig(value: unknown): ProjectConfig {
  const obj = record(value)
  const allowed = ['name', 'width', 'depth', 'columns', 'rows', 'floors', 'hasRoof', 'numberingOrder', 'numberingOrigin']
  if (Object.keys(obj).some(k => !allowed.includes(k))) fail('입력 항목을 확인해 주세요.')
  for (const k of ['name', 'width', 'depth', 'columns', 'rows', 'floors']) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) fail('입력 항목을 확인해 주세요.')
  }
  const dimension = (v: unknown, label: string) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0.5 || v > 30 || Math.abs(v * 100 - Math.round(v * 100)) > 1e-7) fail(`${label}: 0.5~30m, 소수 둘째 자리까지 입력해 주세요.`)
    return v
  }
  const numberingOrder = obj.numberingOrder === 'row-col' ? 'row-col' : 'col-row'
  const numberingOrigin = obj.numberingOrigin === 'top-left' ? 'top-left' : 'bottom-left'
  return {
    name: text(obj.name, 1, 80, '프로젝트 이름', true),
    width: dimension(obj.width, '모듈 너비'),
    depth: dimension(obj.depth, '모듈 깊이'),
    columns: integer(obj.columns, 1, 40, '가로 칸수'),
    rows: integer(obj.rows, 1, 40, '세로 칸수'),
    floors: integer(obj.floors, 1, 15, '층수'),
    hasRoof: typeof obj.hasRoof === 'boolean' ? obj.hasRoof : false,
    numberingOrder,
    numberingOrigin,
  }
}
function validStageId(value: unknown): value is StageId {
  return typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value)
}
function validateWorkflowStages(value: unknown): WorkflowStage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_WORKFLOW_STAGES) fail(`공정은 1~${MAX_WORKFLOW_STAGES}개로 설정해 주세요.`)
  const ids = new Set<string>(), labels = new Set<string>()
  const stages = value.map(item => {
    const stage = record(item); keys(stage, ['id', 'label', 'active'])
    if (!validStageId(stage.id)) fail('공정 식별자를 확인해 주세요.')
    const label = text(stage.label, 1, 80, '공정명', true)
    if (!label.trim()) fail('공정명을 입력해 주세요.')
    if (typeof stage.active !== 'boolean') fail('공정 사용 여부를 확인해 주세요.')
    const normalizedLabel = label.toLocaleLowerCase('ko-KR')
    if (ids.has(stage.id)) fail('공정 식별자가 중복되었습니다.')
    if (labels.has(normalizedLabel)) fail(`공정명이 중복되었습니다: ${label}`)
    ids.add(stage.id); labels.add(normalizedLabel)
    return { id: stage.id, label, active: stage.active }
  })
  if (!stages.some(stage => stage.active)) fail('최소 한 개의 공정을 사용하도록 설정해 주세요.')
  return stages
}
function ensurePlanStages(plan: ModulePlan, stageIds: ReadonlySet<string>) {
  for (const id of Object.keys(plan.stages)) if (!stageIds.has(id)) fail('현재 프로젝트에서 사용하지 않는 공정 계획 항목이 포함되어 있습니다.')
}
function validatePlan(value: unknown): ModulePlan {
  const obj = record(value); keys(obj, ['zone', 'factory', 'installationDate', 'stages'])
  const stages = record(obj.stages)
  const normalized: Partial<Record<StageId, string>> = {}
  for (const [key, date] of Object.entries(stages)) {
    if (!validStageId(key)) fail('공정 계획 항목을 확인해 주세요.')
    if (key === 'installation') fail('설치 공정 계획은 설치 예정일 항목에 입력해 주세요.')
    normalized[key as StageId] = validateDate(date, true)
  }
  return {
    zone: text(obj.zone, 0, 80, '구역', true),
    factory: text(obj.factory, 0, 80, '생산 공장', true),
    installationDate: validateDate(obj.installationDate, true),
    stages: normalized,
  }
}
function validatePlanPatch(value: unknown): ModulePlanPatch {
  const obj = record(value)
  const allowed = ['zone', 'factory', 'installationDate', 'stages']
  if (!Object.keys(obj).length || Object.keys(obj).some(key => !allowed.includes(key))) fail('일괄 적용할 관리계획 항목을 확인해 주세요.')
  const patch: ModulePlanPatch = {}
  if (Object.prototype.hasOwnProperty.call(obj, 'zone')) patch.zone = text(obj.zone, 0, 80, '구역', true)
  if (Object.prototype.hasOwnProperty.call(obj, 'factory')) patch.factory = text(obj.factory, 0, 80, '생산 공장', true)
  if (Object.prototype.hasOwnProperty.call(obj, 'installationDate')) patch.installationDate = validateDate(obj.installationDate, true)
  if (Object.prototype.hasOwnProperty.call(obj, 'stages')) {
    const stages = record(obj.stages)
    if (!Object.keys(stages).length) fail('일괄 적용할 공정 계획 항목을 선택해 주세요.')
    const normalized: Partial<Record<StageId, string>> = {}
    for (const [key, date] of Object.entries(stages)) {
      if (!validStageId(key)) fail('공정 계획 항목을 확인해 주세요.')
      if (key === 'installation') fail('설치 공정 계획은 설치 예정일 항목에 입력해 주세요.')
      normalized[key as StageId] = validateDate(date, true)
    }
    patch.stages = normalized
  }
  return patch
}
export function validateCommand(value: unknown): ProjectCommand {
  const obj = record(value)
  const layouts: Record<string, readonly string[]> = {
    settings: ['type', 'config'], place: ['type', 'floor', 'x', 'y', 'active'], fill: ['type', 'floor'], 'reset-floor': ['type', 'floor'], copy: ['type', 'sourceFloor', 'targetFloor'], 'confirm-layout': ['type'], plan: ['type', 'key', 'plan'], 'bulk-plan': ['type', 'moduleKeys', 'patch'], 'bulk-stage': ['type', 'moduleKeys', 'stages'], installation: ['type', 'key', 'date'], 'establish-baseline': ['type'], 'start-production': ['type'],
    workflow: ['type', 'stages', 'reason'], 'stage-colors': ['type', 'colors'], stage: ['type', 'key', 'stage', 'date'], notes: ['type', 'key', 'notes', 'targetDate'], inspect: ['type', 'key', 'date', 'kind', 'content'], resolve: ['type', 'key', 'inspectionId', 'resolved'],
  }
  if (typeof obj.type !== 'string' || !Object.prototype.hasOwnProperty.call(layouts, obj.type)) fail('지원하지 않는 작업입니다.')
  keys(obj, layouts[obj.type])
  if (obj.type === 'confirm-layout') return { type: 'confirm-layout' }
  if (obj.type === 'establish-baseline' || obj.type === 'start-production') return { type: obj.type }
  if (obj.type === 'workflow') return { type: 'workflow', stages: validateWorkflowStages(obj.stages), reason: text(obj.reason, 0, 500, '변경 사유', true) }
  if (obj.type === 'stage-colors') {
    const colors = record(obj.colors)
    if (Object.keys(colors).length > MAX_WORKFLOW_STAGES) fail('공정 색상 개수가 한도를 초과했습니다.')
    const entries = Object.entries(colors).map(([id, color]) => {
      if (!validStageId(id) || !isStageColor(color)) fail('공정 색상은 #RRGGBB 형식의 HEX 코드로 입력해 주세요.')
      return [id, color.toUpperCase()]
    })
    return { type: 'stage-colors', colors: Object.fromEntries(entries) }
  }
  if (obj.type === 'settings') return { type: 'settings', config: validateConfig(obj.config) }
  if (obj.type === 'place' || obj.type === 'fill' || obj.type === 'reset-floor') {
    integer(obj.floor, 1, 16, '층수')
    if (obj.type === 'place') {
      integer(obj.x, 0, 39, 'X축열', 1); integer(obj.y, 0, 39, 'Y축열', 1)
      if (typeof obj.active !== 'boolean') fail('모듈 배치 상태를 확인해 주세요.')
    }
  } else if (obj.type === 'copy') {
    integer(obj.sourceFloor, 1, 16, '원본 층'); integer(obj.targetFloor, 1, 16, '대상 층')
    if (obj.sourceFloor === obj.targetFloor) fail('원본 층과 대상 층이 같습니다.')
  } else if (obj.type === 'bulk-plan') {
    if (!Array.isArray(obj.moduleKeys) || obj.moduleKeys.length < 1 || obj.moduleKeys.length > MAX_PLACED_MODULES) fail(`일괄 적용할 모듈은 1~${MAX_PLACED_MODULES}개로 선택해 주세요.`)
    const seen = new Set<string>()
    const moduleKeys = obj.moduleKeys.map(key => {
      if (typeof key !== 'string' || !/^[1-9]\d*:\d+:\d+$/.test(key)) fail('모듈 식별자를 확인해 주세요.')
      if (seen.has(key)) fail('같은 모듈이 두 번 선택되어 있습니다. 최신 배치에서 다시 선택해 주세요.')
      seen.add(key)
      return key
    })
    return { type: 'bulk-plan', moduleKeys, patch: validatePlanPatch(obj.patch) }
  } else if (obj.type === 'bulk-stage') {
    if (!Array.isArray(obj.moduleKeys) || obj.moduleKeys.length < 1 || obj.moduleKeys.length > MAX_PLACED_MODULES) fail(`일괄 적용할 모듈은 1~${MAX_PLACED_MODULES}개로 선택해 주세요.`)
    const seen = new Set<string>()
    const moduleKeys = obj.moduleKeys.map(key => {
      if (typeof key !== 'string' || !/^[1-9]\d*:\d+:\d+$/.test(key)) fail('모듈 식별자를 확인해 주세요.')
      if (seen.has(key)) fail('같은 모듈이 두 번 선택되어 있습니다. 최신 배치에서 다시 선택해 주세요.')
      seen.add(key)
      return key
    })
    const stagesObj = record(obj.stages)
    if (!Object.keys(stagesObj).length) fail('일괄 변경할 공정을 하나 이상 선택해 주세요.')
    const normalized: Partial<Record<StageId, string | null>> = {}
    for (const [stageId, dateVal] of Object.entries(stagesObj)) {
      if (!validStageId(stageId)) fail('공정 항목을 확인해 주세요.')
      if (dateVal === null) {
        normalized[stageId as StageId] = null
      } else {
        const date = validateDate(dateVal)
        if (date > today()) fail('실제 공정 완료일은 한국 기준 오늘 이후로 입력할 수 없습니다.')
        normalized[stageId as StageId] = date
      }
    }
    return { type: 'bulk-stage', moduleKeys, stages: normalized }
  } else {
    if (typeof obj.key !== 'string' || !/^[1-9]\d*:\d+:\d+$/.test(obj.key)) fail('모듈 식별자를 확인해 주세요.')
    if (obj.type === 'plan') {
      return { type: 'plan', key: obj.key, plan: validatePlan(obj.plan) }
    } else if (obj.type === 'installation') {
      const date = obj.date === null ? null : validateDate(obj.date)
      if (date && date > today()) fail('실제 설치일은 한국 기준 오늘 이후로 입력할 수 없습니다.')
      return { type: 'installation', key: obj.key, date }
    } else if (obj.type === 'stage') {
      if (!validStageId(obj.stage)) fail('공정 항목을 확인해 주세요.')
      if (obj.date !== null) {
        const date = validateDate(obj.date)
        if (date > today()) fail('실제 공정 완료일은 한국 기준 오늘 이후로 입력할 수 없습니다.')
      }
    } else if (obj.type === 'notes') {
      text(obj.notes, 0, 4000, '특이사항'); validateDate(obj.targetDate, true)
    } else if (obj.type === 'inspect') {
      validateDate(obj.date)
      if (!['inspection', 'issue', 'note'].includes(obj.kind as string)) fail('기록 종류를 확인해 주세요.')
      obj.content = text(obj.content, 1, 4000, '기록 내용', true)
    } else if (obj.type === 'resolve') {
      text(obj.inspectionId, 1, 80, '기록 식별자')
      if (typeof obj.resolved !== 'boolean') fail('이슈 해결 상태를 확인해 주세요.')
    }
  }
  return obj as unknown as ProjectCommand
}
export function validateEnvelope(value: unknown): { expectedRevision: number; command: ProjectCommand } {
  const obj = record(value); keys(obj, ['expectedRevision', 'command'])
  return { expectedRevision: integer(obj.expectedRevision, 0, Number.MAX_SAFE_INTEGER - 1, '저장 버전'), command: validateCommand(obj.command) }
}
function entry(context: DomainContext, message: string): HistoryEntry { return { id: context.uuid(), at: context.now(), message } }
function append(history: HistoryEntry[], message: string, context: DomainContext, max: number) {
  if (history.length >= max) fail('이력 보관 한도에 도달했습니다. 기존 이력을 보존하기 위해 저장을 중단했습니다.', 409)
  history.push(entry(context, message))
}
function freshModule(floor: number, x: number, y: number): ModuleRecord {
  return { key: moduleKey(floor, x, y), floor, x, y, active: true, completed: {}, notes: '', targetDate: '', inspections: [], history: [] }
}
function planChanges(before: ModulePlan, after: ModulePlan, stages: readonly WorkflowStage[]) {
  const changes: Array<{ field: string; before: string; after: string }> = []
  for (const field of ['zone', 'factory', 'installationDate'] as const) if (before[field] !== after[field]) changes.push({ field: field === 'zone' ? '구역' : field === 'factory' ? '생산 공장' : '설치예정일', before: before[field], after: after[field] })
  for (const stage of stages) {
    if (stage.id === 'installation') continue // installationDate is the single plan field for the installation process
    const previous = before.stages[stage.id] ?? ''
    const planned = after.stages[stage.id] ?? ''
    if (previous !== planned) changes.push({ field: `${stage.label} 계획일`, before: previous, after: planned })
  }
  return changes
}
function recordPlanRevision(module: ModuleRecord, changes: ReturnType<typeof planChanges>, baselinePlanAt: string | undefined, context: DomainContext) {
  if (!baselinePlanAt || !changes.length) return
  const revisions = module.planRevisions ?? (module.planRevisions = [])
  if (revisions.length >= MAX_PLAN_REVISIONS) fail('모듈별 일정 개정 이력 한도에 도달했습니다. 기존 이력을 보존하기 위해 저장을 중단했습니다.', 409)
  revisions.push({ at: context.now(), changes })
}
export function createProject(value: unknown, context: DomainContext): ProjectDetail {
  const config = validateConfig(value), now = context.now()
  return { id: context.uuid(), revision: 0, config, modules: [], layoutStatus: 'draft', draftLayout: [], workflowStages: defaultWorkflowStages(), workflowHistory: [], history: [entry(context, '프로젝트 생성 · 배치 초안')], createdAt: now, updatedAt: now }
}

/** Pure transaction: validation and limits are checked on a clone; a rejected operation never changes the input. */
export function applyCommand(current: ProjectDetail, value: unknown, context: DomainContext): ProjectDetail {
  const command = validateCommand(value)
  const result = structuredClone(current)
  result.layoutStatus = layoutStatusOf(result)
  if (result.layoutStatus === 'draft') result.draftLayout ??= []
  else result.draftLayout = []
  const audit = (m: ModuleRecord, message: string) => append(m.history, message, context, MAX_MODULE_HISTORY)
  const floor = (number: number) => { if (number > totalFloorsOf(result.config)) fail('프로젝트 층수 범위를 벗어났습니다.') }
  const draftPositions = () => result.draftLayout ?? (result.draftLayout = [])
  const requireDraft = () => { if (result.layoutStatus !== 'draft') fail('최종 배치가 확정되어 그리드와 배치를 변경할 수 없습니다.', 409) }
  const activeModule = (key: string) => {
    const m = result.modules.find(item => item.key === key && item.active)
    if (!m) fail('배치된 모듈을 찾을 수 없습니다.')
    return m
  }
  let message = ''
  const layoutCommand = ['settings', 'place', 'fill', 'reset-floor', 'copy'].includes(command.type)
  const moduleCommand = ['stage', 'notes', 'inspect', 'resolve', 'plan', 'bulk-plan', 'bulk-stage', 'installation'].includes(command.type)
  const productionCommand = ['stage', 'installation', 'bulk-stage'].includes(command.type)
  const phase = managementPhaseOf(result)
  const stageDefinitions = workflowStagesOf(result)
  const stageIds = new Set(stageDefinitions.map(stage => stage.id))
  const activeStageIds = new Set(stageDefinitions.filter(stage => stage.active).map(stage => stage.id))
  if (command.type === 'plan') ensurePlanStages(command.plan, stageIds)
  if (command.type === 'bulk-plan' && Object.keys(command.patch.stages ?? {}).some(id => !activeStageIds.has(id))) fail('사용 중인 공정만 일괄 계획할 수 있습니다.')
  if (command.type === 'bulk-plan' && Object.prototype.hasOwnProperty.call(command.patch, 'installationDate') && !activeStageIds.has('installation')) fail('비활성 설치 공정의 계획일은 변경할 수 없습니다. 공정을 다시 활성화한 뒤 수정해 주세요.')
  if (command.type === 'bulk-stage' && Object.keys(command.stages).some(id => !activeStageIds.has(id))) fail('사용 중인 공정만 완료 상태를 변경할 수 있습니다.')
  if (command.type === 'stage' && !activeStageIds.has(command.stage)) fail('비활성 공정에는 실제 완료일을 입력할 수 없습니다.')
  if (command.type === 'installation' && !activeStageIds.has('installation')) fail('비활성 설치 공정에는 실제 완료일을 입력할 수 없습니다.')
  if (layoutCommand) requireDraft()
  if (moduleCommand && phase === 'draft') fail('최종 배치를 확정한 뒤 모듈별 관리계획을 입력할 수 있습니다.', 409)
  if (productionCommand && phase === 'draft') fail('최종 배치를 확정한 뒤 실제 공정 실적을 입력할 수 있습니다.', 409)
  if (command.type === 'confirm-layout' && result.layoutStatus !== 'draft') fail('이미 최종 배치가 확정된 프로젝트입니다.', 409)
  if (command.type === 'settings') {
    const next = command.config
    if (draftPositions().some(p => p.floor > totalFloorsOf(next) || p.x >= next.columns || p.y >= next.rows)) fail('배치 초안이 새 그리드 범위를 벗어납니다. 해당 위치를 먼저 제외한 뒤 설정을 저장해 주세요.', 409)
    result.config = next
    message = `프로젝트 설정 변경 · ${next.name} · ${next.width}×${next.depth}m · X${next.columns}/Y${next.rows} · ${next.floors}층${next.hasRoof ? '+지붕층(RF)' : ''}`
  } else if (command.type === 'place') {
    floor(command.floor)
    if (command.x >= result.config.columns || command.y >= result.config.rows) fail('설정한 축열 범위를 벗어났습니다.')
    if (result.layoutStatus === 'draft') {
      const positions = draftPositions()
      const key = moduleKey(command.floor, command.x, command.y)
      const index = positions.findIndex(p => moduleKey(p.floor, p.x, p.y) === key)
      if (command.active && index < 0) {
        if (positions.length >= MAX_PLACED_MODULES) fail(`프로젝트에는 최대 ${MAX_PLACED_MODULES}개 배치 초안을 저장할 수 있습니다.`, 409)
        positions.push({ floor: command.floor, x: command.x, y: command.y })
      } else if (!command.active) {
        if (index < 0) fail('제외할 배치 초안을 찾을 수 없습니다.')
        positions.splice(index, 1)
      }
      message = `${command.floor}층 X${axisNumber(command.x)} Y${axisNumber(command.y)} 배치 초안 ${command.active ? '저장' : '제외'}`
    }
  } else if (command.type === 'fill') {
    floor(command.floor)
    if (result.layoutStatus === 'draft') {
      const positions = draftPositions()
      const present = new Set(positions.filter(p => p.floor === command.floor).map(p => moduleKey(p.floor, p.x, p.y)))
      const extra = result.config.columns * result.config.rows - present.size
      if (positions.length + extra > MAX_PLACED_MODULES) fail(`프로젝트에는 최대 ${MAX_PLACED_MODULES}개 배치 초안을 저장할 수 있습니다.`, 409)
      for (let y = 0; y < result.config.rows; y++) for (let x = 0; x < result.config.columns; x++) {
        const key = moduleKey(command.floor, x, y)
        if (!present.has(key)) positions.push({ floor: command.floor, x, y })
      }
      message = `${command.floor}층 배치 초안 전체 저장`
    }
  } else if (command.type === 'reset-floor') {
    floor(command.floor)
    if (result.layoutStatus === 'draft') {
      const positions = draftPositions()
      const before = positions.length
      result.draftLayout = positions.filter(p => p.floor !== command.floor)
      const removed = before - result.draftLayout.length
      if (!removed) fail(`${command.floor}층에 초기화할 배치 초안이 없습니다.`, 409)
      message = `${command.floor}층 배치 초안 초기화 · ${removed}개`
    }
  } else if (command.type === 'copy') {
    floor(command.sourceFloor); floor(command.targetFloor)
    if (result.layoutStatus === 'draft') {
      const positions = draftPositions()
      const source = positions.filter(p => p.floor === command.sourceFloor)
      if (!source.length) fail('원본 층에 배치 초안이 없습니다.')
      const nextCount = positions.filter(p => p.floor !== command.targetFloor).length + source.length
      if (nextCount > MAX_PLACED_MODULES) fail(`프로젝트에는 최대 ${MAX_PLACED_MODULES}개 배치 초안을 저장할 수 있습니다.`, 409)
      result.draftLayout = [...positions.filter(p => p.floor !== command.targetFloor), ...source.map(p => ({ floor: command.targetFloor, x: p.x, y: p.y }))]
      message = `${command.sourceFloor}층 → ${command.targetFloor}층 배치 초안 동기화 (${source.length}개)`
    }
  } else if (command.type === 'confirm-layout') {
    const positions = draftPositions()
    if (result.modules.length) fail('확정 전 배치 초안에 기존 모듈 기록이 섞여 있습니다. 최신 데이터를 불러오세요.', 409)
    if (!positions.length) fail('최종 확정할 배치가 없습니다. 한 개 이상의 모듈을 먼저 배치해 주세요.', 409)
    if (positions.length > MAX_PLACED_MODULES) fail(`프로젝트에는 최대 ${MAX_PLACED_MODULES}개 모듈만 확정할 수 있습니다.`, 409)
    const seen = new Set<string>()
    for (const p of positions) {
      floor(p.floor)
      if (!Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.y) || p.x < 0 || p.x >= result.config.columns || p.y < 0 || p.y >= result.config.rows) fail('배치 초안의 좌표가 현재 그리드 범위를 벗어났습니다. 설정을 확인해 주세요.', 409)
      const key = moduleKey(p.floor, p.x, p.y)
      if (seen.has(key)) fail('배치 초안에 같은 좌표가 중복되어 있습니다. 최신 데이터를 불러오세요.', 409)
      seen.add(key)
    }
    for (const p of positions) {
      const m = freshModule(p.floor, p.x, p.y)
      audit(m, `${moduleNumber(m, result.config)} · 최종 배치 확정`)
      result.modules.push(m)
    }
    result.draftLayout = []
    result.layoutStatus = 'confirmed'
    result.managementPhase = 'planning'
    result.confirmedAt = context.now()
    message = `최종 배치 확정 · ${positions.length}개 모듈번호 생성 · 모듈 관리계획 입력 시작`
  } else if (command.type === 'establish-baseline') {
    if (phase !== 'production') fail('제작 관리가 시작된 프로젝트에서만 기준일정을 설정할 수 있습니다.', 409)
    if (result.baselinePlanAt) fail('기준일정이 이미 설정되어 있습니다.', 409)
    for (const m of result.modules.filter(item => item.active)) m.baselinePlan = currentPlanOf(m)
    result.baselinePlanAt = context.now()
    result.baselineWorkflowStages ??= structuredClone(stageDefinitions)
    message = `기준일정 최초 설정 · ${result.modules.filter(item => item.active).length}개 모듈`
  } else if (command.type === 'start-production') {
    if (phase !== 'planning') fail('모듈 관리계획 단계에서만 제작을 시작할 수 있습니다.', 409)
    for (const m of result.modules.filter(item => item.active)) m.baselinePlan = currentPlanOf(m)
    result.baselinePlanAt = context.now()
    result.baselineWorkflowStages = structuredClone(stageDefinitions)
    result.managementPhase = 'production'
    message = `제작 관리 시작 · 착수 기준일정 고정 · ${result.modules.filter(item => item.active).length}개 모듈`
  } else if (command.type === 'stage-colors') {
    if (Object.keys(command.colors).some(id => !stageIds.has(id))) fail('프로젝트에 없는 공정의 색상은 저장할 수 없습니다.')
    result.stageColors = { ...command.colors }
    message = '제작현황 보고서 공정 색상 설정 변경'
  } else if (command.type === 'workflow') {
    const before = structuredClone(stageDefinitions)
    const beforeIds = new Set(before.map(stage => stage.id))
    const afterIds = new Set(command.stages.map(stage => stage.id))
    if (before.some(stage => !afterIds.has(stage.id))) fail('공정은 완전히 삭제할 수 없습니다. 사용 여부를 해제해 비활성화해 주세요.')
    const previousIds = new Set((result.workflowHistory ?? []).flatMap(revision => [...revision.before, ...revision.after].map(stage => stage.id)))
    if (command.stages.some(stage => !beforeIds.has(stage.id) && previousIds.has(stage.id))) fail('이전에 사용한 공정 식별자는 다시 사용할 수 없습니다. 새 공정을 추가해 주세요.')
    if (JSON.stringify(before) === JSON.stringify(command.stages)) fail('저장할 공정 구성 변경이 없습니다.', 409)
    if (phase === 'production' && !command.reason.trim()) fail('제작 시작 후 공정 구성 변경 사유를 입력해 주세요.')
    const workflowHistory = result.workflowHistory ?? (result.workflowHistory = [])
    if (workflowHistory.length >= MAX_WORKFLOW_REVISIONS) fail('공정 구성 변경 이력 한도에 도달했습니다. 기존 이력을 보존하기 위해 저장을 중단했습니다.', 409)
    if (phase === 'production' && !result.baselineWorkflowStages) result.baselineWorkflowStages = structuredClone(before)
    result.workflowStages = structuredClone(command.stages)
    workflowHistory.push({ id: context.uuid(), at: context.now(), reason: command.reason.trim() || '제작 시작 전 공정 구성 조정', before, after: structuredClone(command.stages) })
    const activeCount = command.stages.filter(stage => stage.active).length
    message = `공정 구성 변경 · 활성 ${activeCount}/${command.stages.length}개${phase === 'production' ? ' · 제작 시작 후' : ' · 제작 시작 전'}`
  } else if (command.type === 'bulk-plan') {
    const targets = command.moduleKeys.map(key => activeModule(key))
    let changedModules = 0
    const changedFields = new Set<string>()
    for (const m of targets) {
      const before = currentPlanOf(m)
      const next: ModulePlan = {
        ...before,
        ...(Object.prototype.hasOwnProperty.call(command.patch, 'zone') ? { zone: command.patch.zone! } : {}),
        ...(Object.prototype.hasOwnProperty.call(command.patch, 'factory') ? { factory: command.patch.factory! } : {}),
        ...(Object.prototype.hasOwnProperty.call(command.patch, 'installationDate') ? { installationDate: command.patch.installationDate! } : {}),
        stages: { ...before.stages, ...command.patch.stages },
      }
      const changes = planChanges(before, next, stageDefinitions)
      if (!changes.length) continue
      recordPlanRevision(m, changes, result.baselinePlanAt, context)
      m.currentPlan = next
      if (Object.prototype.hasOwnProperty.call(command.patch.stages ?? {}, 'shipping')) m.targetDate = next.stages.shipping ?? ''
      const moduleFields = [...new Set(changes.map(change => change.field))]
      moduleFields.forEach(field => changedFields.add(field))
      audit(m, `${moduleNumber(m, result.config)} · 관리계획 일괄 변경 · ${moduleFields.join(' / ')}`)
      changedModules++
    }
    if (!changedModules) {
      message = '선택한 모듈의 계획이 이미 최신 상태입니다.'
    } else {
      message = `${changedModules}개 모듈 · 관리계획 일괄 변경 · ${[...changedFields].join(' / ')}`
    }
  } else if (command.type === 'bulk-stage') {
    if (Object.keys(command.stages).some(id => !activeStageIds.has(id))) fail('사용 중인 공정만 완료 상태를 변경할 수 있습니다.')
    const targets = command.moduleKeys.map(key => activeModule(key))
    const stageEntries = Object.entries(command.stages) as Array<[StageId, string | null]>
    for (const m of targets) {
      for (const [stageId, date] of stageEntries) {
        if (date === null) {
          delete m.completed[stageId]
          if (stageId === 'installation') delete m.actualInstallationDate
        } else {
          m.completed[stageId] = date
          if (stageId === 'installation') m.actualInstallationDate = date
        }
      }
      audit(m, `${moduleNumber(m, result.config)} · 공정 완료 상태 일괄 변경`)
    }
    const stageLabels = stageEntries.map(([id, date]) => `${stageDefinitions.find(s => s.id === id)?.label ?? id} ${date ? '완료' : '해제'}`).join(', ')
    message = `${targets.length}개 모듈 · 공정 완료 상태 일괄 변경 (${stageLabels})`
  } else {
    const m = activeModule(command.key)
    if (command.type === 'stage') {
      if (command.date === null) {
        delete m.completed[command.stage]
        if (command.stage === 'installation') delete m.actualInstallationDate
      } else {
        m.completed[command.stage] = command.date
        if (command.stage === 'installation') m.actualInstallationDate = command.date
      }
      message = `${moduleNumber(m, result.config)} · ${stageDefinitions.find(s => s.id === command.stage)?.label ?? command.stage} ${command.date ? `완료 ${command.date}` : '완료 해제'}`
    } else if (command.type === 'plan') {
      const before = currentPlanOf(m)
      const next = command.plan
      const inactivePlanChanged = stageDefinitions.some(stage => !stage.active && (before.stages[stage.id] ?? '') !== (next.stages[stage.id] ?? ''))
      if (inactivePlanChanged) fail('비활성 공정의 기존 계획은 변경할 수 없습니다. 공정을 다시 활성화한 뒤 수정해 주세요.')
      if (!activeStageIds.has('installation') && before.installationDate !== next.installationDate) fail('비활성 설치 공정의 계획일은 변경할 수 없습니다. 공정을 다시 활성화한 뒤 수정해 주세요.')
      const changes = planChanges(before, next, stageDefinitions)
      recordPlanRevision(m, changes, result.baselinePlanAt, context)
      m.currentPlan = structuredClone(next)
      m.targetDate = next.stages.shipping ?? ''
      message = `${moduleNumber(m, result.config)} · 관리계획 저장${result.baselinePlanAt && changes.length ? ` · ${changes.map(change => `${change.field} ${change.before || '미입력'} → ${change.after || '미입력'}`).join(' / ')}` : ''}`
    } else if (command.type === 'installation') {
      if (command.date === null) { delete m.actualInstallationDate; delete m.completed.installation }
      else { m.actualInstallationDate = command.date; m.completed.installation = command.date }
      message = `${moduleNumber(m, result.config)} · 실제 설치일 ${command.date ?? '해제'}`
    } else if (command.type === 'notes') {
      const before = currentPlanOf(m)
      const next = { ...before, stages: { ...before.stages, shipping: command.targetDate } }
      const changes = planChanges(before, next, stageDefinitions)
      recordPlanRevision(m, changes, result.baselinePlanAt, context)
      m.notes = command.notes; m.targetDate = command.targetDate; m.currentPlan = next
      message = `${moduleNumber(m, result.config)} · 특이사항/출고예정일 변경${command.targetDate ? ` (${command.targetDate})` : ''}${changes.length ? ` · 출고 계획 ${changes[0].before || '미입력'} → ${changes[0].after || '미입력'}` : ''}`
    } else if (command.type === 'inspect') {
      if (m.inspections.length >= MAX_INSPECTIONS) fail('모듈 검사/이슈 기록 한도에 도달했습니다. 기존 기록을 보존하기 위해 저장을 중단했습니다.', 409)
      m.inspections.push({ id: context.uuid(), date: command.date, kind: command.kind, content: command.content, status: command.kind === 'issue' ? 'open' : 'resolved', createdAt: context.now() })
      message = `${moduleNumber(m, result.config)} · ${command.kind === 'issue' ? '이슈' : command.kind === 'inspection' ? '검사' : '메모'} 기록 (${command.date})`
    } else {
      const inspection = m.inspections.find(i => i.id === command.inspectionId)
      if (!inspection || inspection.kind !== 'issue') fail('변경할 이슈를 찾을 수 없습니다.')
      inspection.status = command.resolved ? 'resolved' : 'open'
      if (command.resolved) inspection.resolvedAt = context.now()
      else delete inspection.resolvedAt
      message = `${moduleNumber(m, result.config)} · 이슈 ${command.resolved ? '해결' : '재개'} (${inspection.date})`
    }
    audit(m, message)
  }
  if (!moduleCommand || result.history.length < MAX_PROJECT_MODULE_MIRROR) append(result.history, message, context, MAX_PROJECT_HISTORY)
  result.revision += 1; result.updatedAt = context.now()
  return result
}
