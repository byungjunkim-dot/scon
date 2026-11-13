import { ANCHORS, isDimension, type ModuleDimensions } from './moduleGeometry'
import { hasValidPlacementIdentity, isElevation, isExtraKey, isExtraKind, isModuleKey, positionKeyOf, type ExtraKind } from './buildingModules'
import { totalFloorsOf, axisNumber, currentPlanOf, defaultWorkflowStages, layoutStatusOf, managementPhaseOf, moduleKey, moduleNumber, today, workflowStagesOf, type HistoryEntry, type LayoutPosition, type ModulePlan, type ModulePlanPatch, type ModuleRecord, type ProjectCommand, type ProjectConfig, type ProjectDetail, type StageId, type WorkflowStage } from './model'

import { isStageColor } from './stageColors'
import { isModuleHeight, moduleHeightOf } from './installation3d'
import { actualStageDateOf, isStageOmitted, patchModulePlan } from './model'

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
  for (const id of plan.omittedStages ?? []) if (!stageIds.has(id)) fail('프로젝트에 없는 공정은 생략할 수 없습니다.')
}
function validatePlan(value: unknown): ModulePlan {
  const obj = record(value); keys(obj, ['zone', 'factory', 'installationDate', 'stages', ...('omittedStages' in obj?['omittedStages']:[])])
  if ('omittedStages' in obj && (!Array.isArray(obj.omittedStages) || obj.omittedStages.length>MAX_WORKFLOW_STAGES || obj.omittedStages.some(id=>!validStageId(id)) || new Set(obj.omittedStages).size!==obj.omittedStages.length)) fail('생략 공정 목록을 확인해 주세요. 중복 없이 현재 공정을 선택해 주세요.')
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
    ...('omittedStages' in obj?{omittedStages:[...(obj.omittedStages as string[])].sort()}:{}),
  }
}
function validatePlanPatch(value: unknown): ModulePlanPatch {
  const obj = record(value)
  const allowed = ['zone', 'factory', 'installationDate', 'stages', 'omissions']
  if (!Object.keys(obj).length || Object.keys(obj).some(key => !allowed.includes(key))) fail('일괄 적용할 관리계획 항목을 확인해 주세요.')
  const patch: ModulePlanPatch = {}
  if ('omissions' in obj) {
    const values=record(obj.omissions), entries=Object.entries(values)
    if (!entries.length || entries.length>MAX_WORKFLOW_STAGES || entries.some(([id,skip])=>!validStageId(id)||typeof skip!=='boolean')) fail('일괄 생략할 공정과 적용 여부를 확인해 주세요.')
    patch.omissions=Object.fromEntries(entries) as Record<string,boolean>
  }
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
function validateDimensions(value: unknown): ModuleDimensions {
  const dims = record(value)
  if (Object.keys(dims).some(key => !['width', 'depth', 'height', 'anchor'].includes(key))) fail('모듈 치수 항목을 확인해 주세요.')
  for (const [key, val] of Object.entries(dims)) {
    if (key === 'anchor' ? typeof val !== 'string' || !Object.hasOwn(ANCHORS, val) : !isDimension(val, key === 'height' ? 12 : 30)) fail('모듈 치수 또는 기준 모서리를 확인해 주세요. 폭·깊이 0.5~30m, 높이 0.5~12m, 소수 둘째 자리까지 입력할 수 있습니다.')
  }
  return { ...dims } as ModuleDimensions
}
export function validateCommand(value: unknown): ProjectCommand {
  const obj = record(value)
  const layouts: Record<string, readonly string[]> = {
    'add-extra': ['type', 'floor', 'x', 'y', 'kind', 'baseZ', 'dimensions', 'confirmed'],
    'extra-state': ['type', 'key', 'active', 'confirmed'],
    'layout-module': ['type', 'floor', 'x', 'y', 'active', 'confirmed'],
    'module-dimensions': ['type', 'key', 'dimensions', ...('baseZ' in obj ? ['baseZ'] : [])],
    'installation-3d': ['type', 'moduleHeight'],
    settings: ['type', 'config'], place: ['type', 'floor', 'x', 'y', 'active'], fill: ['type', 'floor'], 'reset-floor': ['type', 'floor'], copy: ['type', 'sourceFloor', 'targetFloor'], 'confirm-layout': ['type'], plan: ['type', 'key', 'plan'], 'bulk-plan': ['type', 'moduleKeys', 'patch'], 'bulk-stage': ['type', 'moduleKeys', 'stages'], installation: ['type', 'key', 'date'], 'establish-baseline': ['type'], 'start-production': ['type'],
    workflow: ['type', 'stages', 'reason'], 'stage-colors': ['type', 'colors'], stage: ['type', 'key', 'stage', 'date'], notes: ['type', 'key', 'notes', 'targetDate'], inspect: ['type', 'key', 'date', 'kind', 'content'], resolve: ['type', 'key', 'inspectionId', 'resolved'],
  }
  if (typeof obj.type !== 'string' || !Object.prototype.hasOwnProperty.call(layouts, obj.type)) fail('지원하지 않는 작업입니다.')
  keys(obj, layouts[obj.type])
  if (obj.type === 'add-extra') {
    integer(obj.floor, 1, 16, '관리층'); integer(obj.x, 0, 39, 'X축열', 1); integer(obj.y, 0, 39, 'Y축열', 1)
    if (!isExtraKind(obj.kind) || !isElevation(obj.baseZ) || typeof obj.confirmed !== 'boolean') fail('모듈 종류·추가 확인·시작 높이(0~500m, 소수 둘째 자리)를 확인해 주세요.')
    return { type: 'add-extra', floor: obj.floor as number, x: obj.x as number, y: obj.y as number, kind: obj.kind, baseZ: obj.baseZ, dimensions: validateDimensions(obj.dimensions), confirmed: obj.confirmed }
  }
  if (obj.type === 'extra-state') {
    if (!isExtraKey(obj.key) || typeof obj.active !== 'boolean' || typeof obj.confirmed !== 'boolean') fail('추가 모듈 식별자와 배치 확인을 확인해 주세요.')
    return { type: 'extra-state', key: obj.key, active: obj.active, confirmed: obj.confirmed }
  }
  if (obj.type === 'installation-3d') {
    if (!isModuleHeight(obj.moduleHeight)) fail('모듈 높이는 0.5~12m, 소수 둘째 자리까지 입력해 주세요.')
    return { type: 'installation-3d', moduleHeight: obj.moduleHeight }
  }
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
  if (obj.type === 'place' || obj.type === 'layout-module' || obj.type === 'fill' || obj.type === 'reset-floor') {
    integer(obj.floor, 1, 16, '층수')
    if (obj.type === 'place' || obj.type === 'layout-module') {
      integer(obj.x, 0, 39, 'X축열', 1); integer(obj.y, 0, 39, 'Y축열', 1)
      if (typeof obj.active !== 'boolean') fail('모듈 배치 상태를 확인해 주세요.')
      if (obj.type === 'layout-module' && obj.confirmed !== true) fail('모듈 추가·삭제 확인이 필요합니다.')
    }
  } else if (obj.type === 'copy') {
    integer(obj.sourceFloor, 1, 16, '원본 층'); integer(obj.targetFloor, 1, 16, '대상 층')
    if (obj.sourceFloor === obj.targetFloor) fail('원본 층과 대상 층이 같습니다.')
  } else if (obj.type === 'bulk-plan') {
    if (!Array.isArray(obj.moduleKeys) || obj.moduleKeys.length < 1 || obj.moduleKeys.length > MAX_PLACED_MODULES) fail(`일괄 적용할 모듈은 1~${MAX_PLACED_MODULES}개로 선택해 주세요.`)
    const seen = new Set<string>()
    const moduleKeys = obj.moduleKeys.map(key => {
      if (!isModuleKey(key)) fail('모듈 식별자를 확인해 주세요.')
      if (seen.has(key)) fail('같은 모듈이 두 번 선택되어 있습니다. 최신 배치에서 다시 선택해 주세요.')
      seen.add(key)
      return key
    })
    return { type: 'bulk-plan', moduleKeys, patch: validatePlanPatch(obj.patch) }
  } else if (obj.type === 'bulk-stage') {
    if (!Array.isArray(obj.moduleKeys) || obj.moduleKeys.length < 1 || obj.moduleKeys.length > MAX_PLACED_MODULES) fail(`일괄 적용할 모듈은 1~${MAX_PLACED_MODULES}개로 선택해 주세요.`)
    const seen = new Set<string>()
    const moduleKeys = obj.moduleKeys.map(key => {
      if (!isModuleKey(key)) fail('모듈 식별자를 확인해 주세요.')
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
    if (!isModuleKey(obj.key)) fail('모듈 식별자를 확인해 주세요.')
    if (obj.type === 'module-dimensions') {
      if ('baseZ' in obj && obj.baseZ !== null && !isElevation(obj.baseZ)) fail('시작 높이는 0~500m, 소수 둘째 자리까지 입력해 주세요.')
      return { type: 'module-dimensions', key: obj.key, dimensions: validateDimensions(obj.dimensions), ...('baseZ' in obj ? { baseZ: obj.baseZ as number | null } : {}) }
    } else if (obj.type === 'plan') {
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
function moduleFromPosition(p: LayoutPosition): ModuleRecord {
  return { ...freshModule(p.floor, p.x, p.y), key: positionKeyOf(p), ...(p.kind ? { kind: p.kind, sequence: p.sequence } : {}), ...(p.baseZ !== undefined ? { baseZ: p.baseZ } : {}), ...(p.dimensions && Object.keys(p.dimensions).length ? { dimensions: structuredClone(p.dimensions) } : {}) }
}
function planChanges(before: ModulePlan, after: ModulePlan, stages: readonly WorkflowStage[]) {
  const changes: Array<{ field: string; before: string; after: string }> = []
  for (const field of ['zone', 'factory', 'installationDate'] as const) if (before[field] !== after[field]) changes.push({ field: field === 'zone' ? '구역' : field === 'factory' ? '생산 공장' : '설치예정일', before: before[field], after: after[field] })
  for (const stage of stages) {
    if (isStageOmitted(before,stage.id)!==isStageOmitted(after,stage.id)) changes.push({field:`${stage.label} 적용 여부`,before:isStageOmitted(before,stage.id)?'생략':'적용',after:isStageOmitted(after,stage.id)?'생략':'적용'})
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
  const requireDraft = () => { if (result.layoutStatus !== 'draft') fail('확정 후에는 그리드 설정·층 복사·일괄 초기화를 할 수 없습니다. 모듈 추가·삭제를 이용해 주세요.', 409) }
  const activeModule = (key: string) => {
    const m = result.modules.find(item => item.key === key && item.active)
    if (!m) fail('배치된 모듈을 찾을 수 없습니다.')
    if (!hasValidPlacementIdentity(m)) fail('모듈 식별자와 종류·순번이 일치하지 않습니다.', 409)
    return m
  }
  const validatePositions = (positions: LayoutPosition[]) => {
    const seen = new Set<string>(), numbers = new Set<string>()
    for (const p of positions) {
      if (!Number.isSafeInteger(p.floor) || p.floor < 1 || p.floor > totalFloorsOf(result.config) || !Number.isSafeInteger(p.x) || p.x < 0 || p.x >= result.config.columns || !Number.isSafeInteger(p.y) || p.y < 0 || p.y >= result.config.rows) fail('모듈 좌표가 현재 그리드 범위를 벗어났습니다.', 409)
      if (!hasValidPlacementIdentity(p) || (p.baseZ !== undefined && !isElevation(p.baseZ))) fail('모듈 식별자·종류·순번·시작 높이가 올바르지 않습니다.', 409)
      if ('dimensions' in p) validateDimensions(p.dimensions)
      const key = positionKeyOf(p), number = moduleNumber(p, result.config)
      if (seen.has(key) || numbers.has(number)) fail('모듈 식별자 또는 번호가 중복되었습니다.', 409)
      seen.add(key); numbers.add(number)
    }
  }
  const positions = () => result.layoutStatus === 'draft' ? draftPositions() : result.modules
  const nextExtra = (p: {floor:number;x:number;y:number;kind:ExtraKind}, existing: LayoutPosition[]): LayoutPosition => {
    const sequence = Math.max(0, ...existing.filter(m => m.floor === p.floor && m.x === p.x && m.y === p.y && m.kind === p.kind).map(m => m.sequence ?? 0)) + 1
    if (sequence > 9999) fail('이 위치의 추가 모듈 순번 한도에 도달했습니다.', 409)
    const key = `extra:${context.uuid()}`
    if (!isExtraKey(key) || existing.some(m => positionKeyOf(m) === key)) fail('추가 모듈 식별자가 중복되거나 올바르지 않습니다.', 409)
    return { floor:p.floor, x:p.x, y:p.y, kind:p.kind, key, sequence }
  }
  if (['add-extra','extra-state','layout-module','place','fill','copy','reset-floor','confirm-layout'].includes(command.type)) validatePositions(positions())
  let message = ''
  const layoutCommand = ['settings', 'place', 'fill', 'reset-floor', 'copy'].includes(command.type)
  const moduleCommand = ['stage', 'notes', 'inspect', 'resolve', 'plan', 'bulk-plan', 'bulk-stage', 'installation', 'module-dimensions'].includes(command.type)
  const productionCommand = ['stage', 'installation', 'bulk-stage'].includes(command.type)
  const phase = managementPhaseOf(result)
  const stageDefinitions = workflowStagesOf(result)
  const stageIds = new Set(stageDefinitions.map(stage => stage.id))
  const activeStageIds = new Set(stageDefinitions.filter(stage => stage.active).map(stage => stage.id))
  if (command.type === 'plan') ensurePlanStages(command.plan, stageIds)
  if (command.type === 'bulk-plan' && Object.keys(command.patch.stages ?? {}).some(id => !activeStageIds.has(id))) fail('사용 중인 공정만 일괄 계획할 수 있습니다.')
  if (command.type === 'bulk-plan' && Object.keys(command.patch.omissions ?? {}).some(id=>!activeStageIds.has(id))) fail('사용 중인 공정만 생략 또는 생략 해제할 수 있습니다.')
  if (command.type === 'bulk-plan' && Object.prototype.hasOwnProperty.call(command.patch, 'installationDate') && !activeStageIds.has('installation')) fail('비활성 설치 공정의 계획일은 변경할 수 없습니다. 공정을 다시 활성화한 뒤 수정해 주세요.')
  if (command.type === 'bulk-stage' && Object.keys(command.stages).some(id=>!activeStageIds.has(id))) fail('사용 중인 공정만 완료 상태를 변경할 수 있습니다.')
  if (command.type === 'stage' && !activeStageIds.has(command.stage)) fail('비활성 공정에는 실제 완료일을 입력할 수 없습니다.')
  if (command.type === 'installation' && !activeStageIds.has('installation')) fail('비활성 설치 공정에는 실제 완료일을 입력할 수 없습니다.')
  if (layoutCommand) requireDraft()
  if (moduleCommand && command.type !== 'module-dimensions' && phase === 'draft') fail('최종 배치를 확정한 뒤 모듈별 관리계획을 입력할 수 있습니다.', 409)
  if (productionCommand && phase === 'draft') fail('제작 관리 시작 후 실제 공정·설치 실적을 입력할 수 있습니다.', 409)
  if (command.type === 'confirm-layout' && result.layoutStatus !== 'draft') fail('이미 최종 배치가 확정된 프로젝트입니다.', 409)
  if (command.type === 'add-extra') {
    if (result.layoutStatus !== 'draft' && !command.confirmed) fail('모듈 추가 확인이 필요합니다.', 409)
    floor(command.floor)
    if (command.x >= result.config.columns || command.y >= result.config.rows) fail('설정한 축열 범위를 벗어났습니다.')
    if (positions().length >= MAX_PLACED_MODULES) fail(`삭제 기록을 포함하여 최대 ${MAX_PLACED_MODULES}개 모듈을 보관할 수 있습니다.`, 409)
    const p = { ...nextExtra(command, positions()), baseZ: command.baseZ, ...(Object.keys(command.dimensions).length ? {dimensions:command.dimensions} : {}) }
    // Only placement metadata enters the stored draft; never persist command fields.
    const placed: LayoutPosition = { key:p.key, floor:p.floor, x:p.x, y:p.y, kind:p.kind, sequence:p.sequence, baseZ:p.baseZ, ...(p.dimensions ? {dimensions:p.dimensions} : {}) }
    if (result.layoutStatus === 'draft') { draftPositions().push(placed); message = `${p.floor}층 X${axisNumber(p.x)} Y${axisNumber(p.y)} · ${p.kind} 초안 추가 · 시작 ${p.baseZ}m` }
    else { const m = moduleFromPosition(placed); message = `${moduleNumber(m,result.config)} · 추가 모듈 배치 · 시작 ${p.baseZ}m${result.baselinePlanAt ? ' · 착수 기준선 미포함' : ''}`; audit(m,message); result.modules.push(m) }
  } else if (command.type === 'extra-state') {
    const list = positions(), index = list.findIndex(p => positionKeyOf(p) === command.key)
    if (index < 0) fail('추가 모듈을 찾을 수 없습니다.', 409)
    const p = list[index]
    if (result.layoutStatus === 'draft') {
      if (command.active) fail('제외된 초안은 새로 추가해 주세요.', 409)
      list.splice(index,1); message = `${p.floor}층 추가 모듈 초안 제외`
    } else {
      if (!command.confirmed) fail('추가 모듈 제외·복원 확인이 필요합니다.', 409)
      const m = p as ModuleRecord
      if (m.active === command.active) fail('배치 상태가 이미 변경되었습니다. 최신 데이터를 불러오세요.', 409)
      m.active = command.active; message = `${moduleNumber(m,result.config)} · 추가 모듈 ${command.active ? '기록 복원' : '배치 제외'} · 기존 치수·계획·실적·검사·기준선 보존`; audit(m,message)
    }
  } else if (command.type === 'settings') {
    const next = command.config
    if (draftPositions().some(p => p.floor > totalFloorsOf(next) || p.x >= next.columns || p.y >= next.rows)) fail('배치 초안이 새 그리드 범위를 벗어납니다. 해당 위치를 먼저 제외한 뒤 설정을 저장해 주세요.', 409)
    result.config = next
    message = `프로젝트 설정 변경 · ${next.name} · ${next.width}×${next.depth}m · X${next.columns}/Y${next.rows} · ${next.floors}층`
  } else if (command.type === 'module-dimensions' && result.layoutStatus === 'draft') {
    const p = draftPositions().find(p => positionKeyOf(p) === command.key)
    if (!p) fail('배치 초안 모듈을 찾을 수 없습니다.')
    if (!hasValidPlacementIdentity(p)) fail('배치 초안 식별자를 확인해 주세요.', 409)
    if (JSON.stringify(p.dimensions ?? {}) === JSON.stringify(command.dimensions) && (!('baseZ' in command) || p.baseZ === (command.baseZ ?? undefined))) return current
    if (Object.keys(command.dimensions).length) p.dimensions = command.dimensions
    else delete p.dimensions
    if ('baseZ' in command) { if (command.baseZ === null) delete p.baseZ; else p.baseZ = command.baseZ }
    message = `${p.floor}층 X${axisNumber(p.x)} Y${axisNumber(p.y)} 배치 초안 치수·기준 모서리 변경 · ${JSON.stringify(command.dimensions)} · 시작 ${p.baseZ ?? '기본'}m`
  } else if (command.type === 'layout-module') {
    if (result.layoutStatus === 'draft') fail('초안에서는 배치·제외 도구를 이용해 주세요.', 409)
    floor(command.floor)
    if (command.x >= result.config.columns || command.y >= result.config.rows) fail('설정한 축열 범위를 벗어났습니다.')
    const key = moduleKey(command.floor, command.x, command.y)
    const records = result.modules.filter(m => !isExtraKey(m.key) && (m.key === key || (m.floor === command.floor && m.x === command.x && m.y === command.y)))
    if (records.length > 1 || records.some(m => m.key !== key || m.floor !== command.floor || m.x !== command.x || m.y !== command.y)) fail('같은 좌표의 모듈 기록이 중복되거나 일치하지 않습니다. 데이터를 확인해 주세요.', 409)
    let m = records[0]
    if (m?.active === command.active || (!m && !command.active)) fail('모듈 배치 상태가 이미 변경되었거나 대상이 없습니다. 최신 데이터를 불러오세요.', 409)
    const restored = Boolean(m)
    if (m && command.active && 'dimensions' in m) validateDimensions(m.dimensions)
    if (!m) {
      if (result.modules.length >= MAX_PLACED_MODULES) fail(`삭제 기록을 포함하여 최대 ${MAX_PLACED_MODULES}개 좌표를 보관할 수 있습니다. 기존 삭제 위치는 복원할 수 있습니다.`, 409)
      m = freshModule(command.floor, command.x, command.y)
      result.modules.push(m)
    } else m.active = command.active
    message = `${moduleNumber(m, result.config)} · ${command.active ? restored ? '배치 복원 · 기존 치수·계획·실적·검사 기록 유지' : '모듈 추가 · 빈 관리계획으로 시작' : '배치 삭제 · 기존 기록 보존'}${command.active && !restored && result.baselinePlanAt ? ' · 착수 기준선 미포함' : ''}`
    audit(m, message)
  } else if (command.type === 'place') {
    floor(command.floor)
    if (command.x >= result.config.columns || command.y >= result.config.rows) fail('설정한 축열 범위를 벗어났습니다.')
    if (result.layoutStatus === 'draft') {
      const positions = draftPositions()
      const key = moduleKey(command.floor, command.x, command.y)
      const index = positions.findIndex(p => positionKeyOf(p) === key)
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
      const present = new Set(positions.filter(p => p.floor === command.floor && !isExtraKey(p.key)).map(p => positionKeyOf(p)))
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
      const copied = positions.filter(p => p.floor !== command.targetFloor)
      for (const p of source) {
        const next: LayoutPosition = { floor:command.targetFloor, x:p.x, y:p.y, ...(p.dimensions ? {dimensions:validateDimensions(p.dimensions)} : {}), ...(p.baseZ !== undefined ? {baseZ:Math.round((p.baseZ+(command.targetFloor-command.sourceFloor)*moduleHeightOf(result.installation3d))*100)/100} : {}) }
        if (p.kind) Object.assign(next,nextExtra({floor:command.targetFloor,x:p.x,y:p.y,kind:p.kind},copied))
        copied.push(next)
      }
      validatePositions(copied); result.draftLayout = copied
      message = `${command.sourceFloor}층 → ${command.targetFloor}층 배치 초안 동기화 (${source.length}개)`
    }
  } else if (command.type === 'confirm-layout') {
    const positions = draftPositions()
    if (result.modules.length) fail('확정 전 배치 초안에 기존 모듈 기록이 섞여 있습니다. 최신 데이터를 불러오세요.', 409)
    if (!positions.length) fail('최종 확정할 배치가 없습니다. 한 개 이상의 모듈을 먼저 배치해 주세요.', 409)
    if (positions.length > MAX_PLACED_MODULES) fail(`프로젝트에는 최대 ${MAX_PLACED_MODULES}개 모듈만 확정할 수 있습니다.`, 409)
    const seen = new Set<string>()
    for (const p of positions) {
      integer(p.floor, 1, totalFloorsOf(result.config), '층수')
      floor(p.floor)
      if (!Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.y) || p.x < 0 || p.x >= result.config.columns || p.y < 0 || p.y >= result.config.rows) fail('배치 초안의 좌표가 현재 그리드 범위를 벗어났습니다. 설정을 확인해 주세요.', 409)
      const key = positionKeyOf(p)
      if (seen.has(key)) fail('배치 초안에 같은 좌표가 중복되어 있습니다. 최신 데이터를 불러오세요.', 409)
      seen.add(key)
    }
    for (const p of positions) {
      const m = moduleFromPosition(p)
      if ('dimensions' in p) { const dims = validateDimensions(p.dimensions); if (Object.keys(dims).length) m.dimensions = dims }
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
  } else if (command.type === 'installation-3d') {
    result.installation3d = { moduleHeight: command.moduleHeight }
    message = `3D 설치현황 높이 변경 · ${command.moduleHeight}m`
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
      const next = patchModulePlan(before,command.patch)
      const changes = planChanges(before, next, stageDefinitions)
      if (!changes.length) continue
      recordPlanRevision(m, changes, result.baselinePlanAt, context)
      m.currentPlan = next
      if (Object.prototype.hasOwnProperty.call(command.patch.stages ?? {}, 'shipping')) m.targetDate = next.stages.shipping ?? ''
      const moduleFields = [...new Set(changes.map(change => change.field))]
      moduleFields.forEach(field => changedFields.add(field))
      audit(m, `${moduleNumber(m,result.config)} · 관리계획 일괄 변경 · ${moduleFields.join(' / ')}`)
      changedModules++
    }
    if (!changedModules) return current
    message = `${changedModules}개 모듈 · 관리계획 일괄 변경 · ${[...changedFields].join(' / ')}`
  } else if (command.type === 'bulk-stage') {
    const targets=command.moduleKeys.map(key=>activeModule(key))
    const entries=Object.entries(command.stages) as Array<[StageId,string|null]>
    let applicablePairs=0,changedModules=0,changedPairs=0,skippedPairs=0
    for (const m of targets) {
      let changed=0
      for (const [id,date] of entries) {
        if (isStageOmitted(m.currentPlan,id)) {skippedPairs++;continue}
        applicablePairs++
        if ((actualStageDateOf(m,id)||null)===date) continue
        if (date===null) {delete m.completed[id];if(id==='installation')delete m.actualInstallationDate}
        else {m.completed[id]=date;if(id==='installation')m.actualInstallationDate=date}
        changed++;changedPairs++
      }
      if(changed){audit(m,`${moduleNumber(m,result.config)} · 공정 완료 상태 일괄 변경 · ${changed}건 · 생략 공정 보존`);changedModules++}
    }
    if(!applicablePairs)fail('선택한 모듈에서 모두 생략한 공정입니다. 관리계획에서 생략을 해제한 뒤 입력해 주세요.',409)
    if(!changedPairs)return current
    message=`${changedModules}개 모듈 · 공정 완료 상태 일괄 변경 · ${changedPairs}건 적용 · 생략 ${skippedPairs}건 보존`
  } else {
    const m = activeModule(command.key)
    if (command.type === 'module-dimensions') {
      if (JSON.stringify(m.dimensions ?? {}) === JSON.stringify(command.dimensions) && (!('baseZ' in command) || m.baseZ === (command.baseZ ?? undefined))) return current
      const before = JSON.stringify(m.dimensions ?? {})
      if (Object.keys(command.dimensions).length) m.dimensions = command.dimensions
      else delete m.dimensions
      if ('baseZ' in command) { if (command.baseZ === null) delete m.baseZ; else m.baseZ = command.baseZ }
      message = `${moduleNumber(m, result.config)} 모듈 치수·기준 모서리 변경 · ${before} → ${JSON.stringify(command.dimensions)} · 시작 ${m.baseZ ?? '기본'}m${Object.keys(command.dimensions).length ? '' : ' (기본값 상속)'}`
    } else if (command.type === 'stage') {
      if (isStageOmitted(m.currentPlan,command.stage)) fail('이 모듈에서 생략한 공정입니다. 관리계획에서 생략을 해제한 뒤 실적을 입력해 주세요.',409)
      if (command.date === null) {
        delete m.completed[command.stage]
        if (command.stage === 'installation') delete m.actualInstallationDate
      } else {
        m.completed[command.stage] = command.date
        if (command.stage === 'installation') m.actualInstallationDate = command.date
      }
      message = `${moduleNumber(m,result.config)} · ${stageDefinitions.find(s => s.id === command.stage)?.label ?? command.stage} ${command.date ? `완료 ${command.date}` : '완료 해제'}`
    } else if (command.type === 'plan') {
      const before = currentPlanOf(m)
      const next = { ...command.plan, ...(!('omittedStages' in command.plan)&&before.omittedStages?{omittedStages:[...before.omittedStages]}:{}) }
      const inactivePlanChanged = stageDefinitions.some(stage => !stage.active && ((before.stages[stage.id] ?? '') !== (next.stages[stage.id] ?? '') || isStageOmitted(before,stage.id)!==isStageOmitted(next,stage.id)))
      if (inactivePlanChanged) fail('비활성 공정의 기존 계획은 변경할 수 없습니다. 공정을 다시 활성화한 뒤 수정해 주세요.')
      if (!activeStageIds.has('installation') && before.installationDate !== next.installationDate) fail('비활성 설치 공정의 계획일은 변경할 수 없습니다. 공정을 다시 활성화한 뒤 수정해 주세요.')
      if (stageDefinitions.some(stage=>isStageOmitted(next,stage.id)&& (stage.id==='installation'?before.installationDate!==next.installationDate:(before.stages[stage.id]??'')!==(next.stages[stage.id]??'')))) fail('생략 공정의 기존 계획일은 보존됩니다. 생략을 해제한 뒤 날짜를 변경해 주세요.',409)
      const changes = planChanges(before, next, stageDefinitions)
      recordPlanRevision(m, changes, result.baselinePlanAt, context)
      m.currentPlan = structuredClone(next)
      m.targetDate = next.stages.shipping ?? ''
      message = `${moduleNumber(m,result.config)} · 관리계획 저장${changes.length ? ` · ${changes.map(change => `${change.field} ${change.before || '미입력'} → ${change.after || '미입력'}`).join(' / ')}` : ''}`
    } else if (command.type === 'installation') {
      if (isStageOmitted(m.currentPlan,'installation')) fail('이 모듈은 설치 공정을 생략했습니다. 관리계획에서 생략을 해제한 뒤 입력해 주세요.',409)
      if (command.date === null) { delete m.actualInstallationDate; delete m.completed.installation }
      else { m.actualInstallationDate = command.date; m.completed.installation = command.date }
      message = `${moduleNumber(m,result.config)} · 실제 설치일 ${command.date ?? '해제'}`
    } else if (command.type === 'notes') {
      const before = currentPlanOf(m)
      if (isStageOmitted(before,'shipping')&&command.targetDate!==m.targetDate) fail('생략한 출고 공정의 기존 계획일은 보존됩니다. 관리계획에서 생략을 해제해 주세요.',409)
      const next = isStageOmitted(before,'shipping')?before:{ ...before, stages: { ...before.stages, shipping: command.targetDate } }
      const changes = planChanges(before, next, stageDefinitions)
      recordPlanRevision(m, changes, result.baselinePlanAt, context)
      m.notes = command.notes; m.targetDate = command.targetDate; m.currentPlan = next
      message = `${moduleNumber(m,result.config)} · 특이사항/출고예정일 변경${command.targetDate ? ` (${command.targetDate})` : ''}${changes.length ? ` · 출고 계획 ${changes[0].before || '미입력'} → ${changes[0].after || '미입력'}` : ''}`
    } else if (command.type === 'inspect') {
      if (m.inspections.length >= MAX_INSPECTIONS) fail('모듈 검사/이슈 기록 한도에 도달했습니다. 기존 기록을 보존하기 위해 저장을 중단했습니다.', 409)
      m.inspections.push({ id: context.uuid(), date: command.date, kind: command.kind, content: command.content, status: command.kind === 'issue' ? 'open' : 'resolved', createdAt: context.now() })
      message = `${moduleNumber(m,result.config)} · ${command.kind === 'issue' ? '이슈' : command.kind === 'inspection' ? '검사' : '메모'} 기록 (${command.date})`
    } else {
      const inspection = m.inspections.find(i => i.id === command.inspectionId)
      if (!inspection || inspection.kind !== 'issue') fail('변경할 이슈를 찾을 수 없습니다.')
      inspection.status = command.resolved ? 'resolved' : 'open'
      if (command.resolved) inspection.resolvedAt = context.now()
      else delete inspection.resolvedAt
      message = `${moduleNumber(m,result.config)} · 이슈 ${command.resolved ? '해결' : '재개'} (${inspection.date})`
    }
    audit(m, message)
  }
  if (!moduleCommand || result.layoutStatus === 'draft' || result.history.length < MAX_PROJECT_MODULE_MIRROR) append(result.history, message, context, MAX_PROJECT_HISTORY)
  result.revision += 1; result.updatedAt = context.now()
  return result
}
