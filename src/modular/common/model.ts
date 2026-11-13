import { extraNumberSuffix, type PlacementMetadata, type ExtraKind } from './buildingModules'
import type { ModuleDimensions } from './moduleGeometry'
import type { Installation3DSettings } from './installation3d'

export const STAGES = [
  { id: 'materials', label: '자재 입고', group: '구조 제작' },
  { id: 'processing', label: '부재 가공', group: '구조 제작' },
  { id: 'frame', label: '프레임', group: '구조 제작' },
  { id: 'fireproof', label: '내화도장', group: '구조 제작' },
  { id: 'deck', label: '데크설치', group: '구조 제작' },
  { id: 'slab', label: '슬라브 타설', group: '구조 제작' },
  { id: 'electrical', label: '전기 설비', group: '설비 공사' },
  { id: 'mechanical', label: '기계 설비', group: '설비 공사' },
  { id: 'fire', label: '소방 설비', group: '설비 공사' },
  { id: 'interior', label: '내벽마감', group: '마감·출고' },
  { id: 'exterior', label: '외벽마감', group: '마감·출고' },
  { id: 'windows', label: '창호', group: '마감·출고' },
  { id: 'protection', label: '보양', group: '마감·출고' },
  { id: 'shipping', label: '출고', group: '마감·출고' },
  { id: 'installation', label: '설치', group: '현장 설치' },
] as const
export type StageId = string
export interface WorkflowStage {
  id: StageId
  label: string
  active: boolean
}
export interface WorkflowRevision {
  id: string
  at: string
  reason: string
  before: WorkflowStage[]
  after: WorkflowStage[]
}
export interface ModulePlan {
  zone: string
  factory: string
  installationDate: string
  stages: Partial<Record<StageId, string>>
  omittedStages?: StageId[]
}
export type ModulePlanPatch = Partial<Pick<ModulePlan, 'zone' | 'factory' | 'installationDate'>> & {
  stages?: Partial<Record<StageId, string>>
  omissions?: Partial<Record<StageId, boolean>>
}
export interface PlanRevision {
  at: string
  changes: Array<{ field: string; before: string; after: string }>
}
export type NumberingOrder = 'col-row' | 'row-col'
export type NumberingOrigin = 'bottom-left' | 'top-left'

export interface ProjectConfig {
  name: string
  width: number
  depth: number
  columns: number
  rows: number
  floors: number
  hasRoof?: boolean
  numberingOrder?: NumberingOrder
  numberingOrigin?: NumberingOrigin
}
export interface Inspection {
  id: string
  date: string
  kind: 'inspection' | 'issue' | 'note'
  content: string
  status: 'open' | 'resolved'
  createdAt: string
  resolvedAt?: string
}
export interface HistoryEntry { id: string; at: string; message: string }
export interface ModuleRecord extends PlacementMetadata {
  key: string
  floor: number
  x: number
  y: number
  active: boolean
  dimensions?: ModuleDimensions
  completed: Partial<Record<StageId, string>>
  notes: string
  targetDate: string
  currentPlan?: ModulePlan
  baselinePlan?: ModulePlan
  actualInstallationDate?: string
  planRevisions?: PlanRevision[]
  inspections: Inspection[]
  history: HistoryEntry[]
}
export type LayoutStatus = 'draft' | 'confirmed'
export type ManagementPhase = 'planning' | 'production'
export interface LayoutPosition extends PlacementMetadata { key?:string; floor: number; x: number; y: number; dimensions?: ModuleDimensions }
export interface ProjectDetail {
  id: string
  revision: number
  config: ProjectConfig
  modules: ModuleRecord[]
  layoutStatus?: LayoutStatus
  draftLayout?: LayoutPosition[]
  confirmedAt?: string
  managementPhase?: ManagementPhase
  baselinePlanAt?: string
  workflowStages?: WorkflowStage[]
  baselineWorkflowStages?: WorkflowStage[]
  workflowHistory?: WorkflowRevision[]
  stageColors?: Record<StageId, string>
  installation3d?: Installation3DSettings
  history: HistoryEntry[]
  createdAt: string
  updatedAt: string
}
export interface ProjectSummary {
  id: string
  name: string
  moduleCount: number
  revision: number
  updatedAt: string
  layoutStatus: LayoutStatus
  draftModuleCount: number
  managementPhase?: 'draft' | ManagementPhase
}
export const layoutStatusOf = (project: Pick<ProjectDetail, 'layoutStatus' | 'modules'>): LayoutStatus => project.layoutStatus === 'draft' || project.layoutStatus === 'confirmed' ? project.layoutStatus : project.modules.length ? 'confirmed' : 'draft'
export const managementPhaseOf = (project: Pick<ProjectDetail, 'layoutStatus' | 'modules' | 'managementPhase'>): 'draft' | ManagementPhase => {
  if (layoutStatusOf(project) === 'draft') return 'draft'
  return project.managementPhase === 'planning' ? 'planning' : 'production'
}
export const emptyModulePlan = (): ModulePlan => ({ zone: '', factory: '', installationDate: '', stages: {} })
export const defaultWorkflowStages = (): WorkflowStage[] => STAGES.map(({ id, label }) => ({ id, label, active: true }))
export function workflowStagesOf(project: Pick<ProjectDetail, 'workflowStages'>): WorkflowStage[] {
  const stages = project.workflowStages?.length ? [...project.workflowStages] : defaultWorkflowStages()
  if (stages.some(stage => stage.id === 'installation')) return stages
  const names = new Set(stages.map(stage => stage.label.trim().toLocaleLowerCase('ko-KR')))
  let label = '설치'
  if (names.has(label.toLocaleLowerCase('ko-KR'))) {
    label = '현장 설치'
    let suffix = 2
    while (names.has(label.toLocaleLowerCase('ko-KR'))) label = `현장 설치 ${suffix++}`
  }
  const stage: WorkflowStage = { id: 'installation', label, active: true }
  const shippingIndex = stages.findIndex(item => item.id === 'shipping')
  stages.splice(shippingIndex >= 0 ? shippingIndex + 1 : stages.length, 0, stage)
  return stages
}
export const activeWorkflowStagesOf = (project: Pick<ProjectDetail, 'workflowStages'>): WorkflowStage[] => workflowStagesOf(project).filter(stage => stage.active)
export function baselineWorkflowStagesOf(project: Pick<ProjectDetail, 'workflowStages' | 'baselineWorkflowStages'>): WorkflowStage[] {
  if (project.baselineWorkflowStages?.length) return project.baselineWorkflowStages
  if (project.workflowStages?.length) return project.workflowStages
  return defaultWorkflowStages().filter(stage => stage.id !== 'installation')
}
export const activeBaselineWorkflowStagesOf = (project: Pick<ProjectDetail, 'workflowStages' | 'baselineWorkflowStages'>): WorkflowStage[] => baselineWorkflowStagesOf(project).filter(stage => stage.active)
export const currentPlanOf = (module: ModuleRecord): ModulePlan => {
  const plan = module.currentPlan ? structuredClone(module.currentPlan) : emptyModulePlan()
  plan.stages.shipping ??= module.targetDate || ''
  return plan
}
export const plannedStageDateOf = (plan: ModulePlan | undefined, stageId: StageId) => stageId === 'installation' ? plan?.installationDate ?? '' : plan?.stages[stageId] ?? ''
export const actualStageDateOf = (module: ModuleRecord, stageId: StageId) => stageId === 'installation' ? module.completed[stageId] || module.actualInstallationDate : module.completed[stageId]
export const isStageOmitted = (plan: ModulePlan | undefined, stageId: StageId) => plan?.omittedStages?.includes(stageId) ?? false
/** Partial updates resolve applicability first; excluded dates remain untouched. */
export function patchModulePlan(before: ModulePlan, patch: ModulePlanPatch): ModulePlan {
  const omitted = new Set(before.omittedStages ?? [])
  for (const [id, skip] of Object.entries(patch.omissions ?? {})) { if (skip) omitted.add(id); else omitted.delete(id) }
  const next: ModulePlan = { ...before, stages: { ...before.stages },
    ...(patch.zone !== undefined ? {zone:patch.zone} : {}), ...(patch.factory !== undefined ? {factory:patch.factory} : {}),
    ...(patch.omissions ? {omittedStages:[...omitted].sort()} : {}) }
  if (patch.installationDate !== undefined && !omitted.has('installation')) next.installationDate = patch.installationDate
  for (const [id,date] of Object.entries(patch.stages ?? {})) if (!omitted.has(id)) next.stages[id] = date
  return next
}
export const validActualDate = (value: string | undefined) => Boolean(value && value <= today())
export function stageOverdue(m: ModuleRecord, id: StageId, asOf=today(), plan=currentPlanOf(m)) {
  const planned=plannedStageDateOf(plan,id)
  return !isStageOmitted(plan,id)&&Boolean(planned&&planned<asOf&&!validActualDate(actualStageDateOf(m,id)))
}
export type ProjectCommand =
  | {type:'add-extra';floor:number;x:number;y:number;kind:ExtraKind;baseZ:number;dimensions:ModuleDimensions;confirmed:boolean}
  | {type:'extra-state';key:string;active:boolean;confirmed:boolean}
  | { type: 'layout-module'; floor: number; x: number; y: number; active: boolean; confirmed: true }
  | { type: 'settings'; config: ProjectConfig }
  | { type: 'place'; floor: number; x: number; y: number; active: boolean }
  | { type: 'fill'; floor: number }
  | { type: 'reset-floor'; floor: number }
  | { type: 'copy'; sourceFloor: number; targetFloor: number }
  | { type: 'confirm-layout' }
  | { type: 'plan'; key: string; plan: ModulePlan }
  | { type: 'bulk-plan'; moduleKeys: string[]; patch: ModulePlanPatch }
  | { type: 'bulk-stage'; moduleKeys: string[]; stages: Partial<Record<StageId, string | null>> }
  | { type: 'installation'; key: string; date: string | null }
  | { type: 'establish-baseline' }
  | { type: 'start-production' }
  | { type: 'workflow'; stages: WorkflowStage[]; reason: string }
  | { type: 'stage-colors'; colors: Record<StageId, string> }
  | { type: 'installation-3d'; moduleHeight: number }
  | { type: 'module-dimensions'; key: string; dimensions: ModuleDimensions; baseZ?:number|null }
  | { type: 'stage'; key: string; stage: StageId; date: string | null }
  | { type: 'notes'; key: string; notes: string; targetDate: string }
  | { type: 'inspect'; key: string; date: string; kind: Inspection['kind']; content: string }
  | { type: 'resolve'; key: string; inspectionId: string; resolved: boolean }
export const DEFAULT_CONFIG: ProjectConfig = {
  name: '',
  width: 4,
  depth: 11.5,
  columns: 8,
  rows: 2,
  floors: 5,
  hasRoof: false,
  numberingOrder: 'col-row',
  numberingOrigin: 'bottom-left',
}
export const moduleKey = (floor: number, x: number, y: number) => `${floor}:${x}:${y}`
/** Stored coordinates and stable keys remain zero-based; users see axes starting at 1. */
export const axisNumber = (coordinate: number) => coordinate + 1
export const axisNumberFor = (
  coordinate: number,
  axis: 'x' | 'y',
  config?: Pick<ProjectConfig, 'rows' | 'numberingOrigin'>
) => {
  if (axis === 'y' && config?.numberingOrigin === 'top-left' && typeof config.rows === 'number' && config.rows > 0) {
    return config.rows - coordinate
  }
  return coordinate + 1
}
export const totalFloorsOf = (config: Pick<ProjectConfig, 'floors' | 'hasRoof'>) => config.floors + (config.hasRoof ? 1 : 0)
export const isRoofFloorOf = (floor: number, config: Pick<ProjectConfig, 'floors' | 'hasRoof'>) => Boolean(config.hasRoof && floor === config.floors + 1)
export const floorLabelOf = (floor: number, config: Pick<ProjectConfig, 'floors' | 'hasRoof'>) => isRoofFloorOf(floor, config) ? 'RF' : `${String(floor).padStart(2, '0')}F`
export const floorNameOf = (floor: number, config: Pick<ProjectConfig, 'floors' | 'hasRoof'>) => isRoofFloorOf(floor, config) ? '지붕층 (RF)' : `${floor}층`

export const moduleCoordinateNumbers = (
  m: Pick<ModuleRecord, 'x' | 'y'>,
  config?: Pick<ProjectConfig, 'rows' | 'numberingOrigin'>
) => {
  const colNum = axisNumberFor(m.x, 'x', config)
  const rowNum = axisNumberFor(m.y, 'y', config)
  return { colNum, rowNum }
}

export const moduleNumber = (
  m: Pick<ModuleRecord, 'floor' | 'x' | 'y' | 'kind' | 'sequence'>,
  config?: Pick<ProjectConfig, 'floors' | 'hasRoof' | 'rows' | 'numberingOrder' | 'numberingOrigin'>
) => {
  const { colNum, rowNum } = moduleCoordinateNumbers(m, config)
  const colStr = String(colNum).padStart(2, '0')
  const rowStr = String(rowNum).padStart(2, '0')
  const order = config?.numberingOrder ?? 'col-row'
  const coordCode = order === 'row-col' ? `${rowStr}${colStr}` : `${colStr}${rowStr}`
  if (config && isRoofFloorOf(m.floor, config)) {
    return `RF-${coordCode}${extraNumberSuffix(m)}`
  }
  return `${m.floor}-${coordCode}${extraNumberSuffix(m)}`
}
type StageLike = Pick<WorkflowStage, 'id'> & Partial<Pick<WorkflowStage, 'active' | 'label'>>
export const applicableStagesOf = <T extends StageLike>(m: Pick<ModuleRecord,'currentPlan'>, stages: readonly T[]): T[] => stages.filter(s=>s.active!==false&&!isStageOmitted(m.currentPlan,s.id))
export const completedCount = (m: ModuleRecord, stages: readonly StageLike[] = STAGES) => applicableStagesOf(m,stages).filter(s => validActualDate(actualStageDateOf(m, s.id))).length
export const progress = (m: ModuleRecord, stages: readonly StageLike[] = STAGES) => { const total=applicableStagesOf(m,stages).length; return total?Math.round(completedCount(m,stages)/total*100):0 }
export const openIssues = (m: ModuleRecord) => m.inspections.filter(i => i.kind === 'issue' && i.status === 'open').length
export type ModuleStatus = 'empty' | 'working' | 'ready' | 'shipped' | 'notApplicable'
export const moduleStatus = (m: ModuleRecord, stages: readonly StageLike[] = STAGES): ModuleStatus => {
  const active = applicableStagesOf(m,stages)
  if (!active.length) return 'notApplicable'
  const completed = completedCount(m, active)
  const hasShipping = active.some(stage => stage.id === 'shipping')
  if (hasShipping && validActualDate(actualStageDateOf(m, 'shipping'))) return 'shipped'
  const readyCount = active.filter(stage => stage.id !== 'shipping').length
  if (completed > 0 && completed === readyCount) return 'ready'
  return completed ? 'working' : 'empty'
}
export const STATUS_LABELS: Record<ModuleStatus, string> = { empty: '제작 대기', working: '제작 중', ready: '출고 대기', shipped: '출고 완료', notApplicable:'대상 공정 없음' }
export const moduleStatusLabel = (status: ModuleStatus, stages: readonly StageLike[] = STAGES) => {
  const shipping = stages.find(stage => stage.id === 'shipping' && stage.active !== false)
  if (status === 'ready' && !shipping) return '공정 완료'
  if (status === 'ready' && shipping) return `${shipping.label ?? '출고'} 대기`
  if (status === 'shipped' && shipping) return `${shipping.label ?? '출고'} 완료`
  return STATUS_LABELS[status]
}
const kstDateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
let cachedKstHour = -1
let cachedKstDate = ''
export function today() {
  const utcHour = Math.floor(Date.now() / 3600000)
  if (utcHour !== cachedKstHour) {
    cachedKstHour = utcHour
    cachedKstDate = kstDateFormatter.format(new Date())
  }
  return cachedKstDate
}
