/** Placement identity and height rules shared by the app and external adapter. */
export const EXTRA_KINDS = { roof: '지붕 모듈', penthouse: '계단옥탑 모듈', special: '특수 모듈' } as const
export type ExtraKind = keyof typeof EXTRA_KINDS
export type BuildingModuleKind = 'normal' | ExtraKind
export type PlanLayer = 'all' | 'normal' | 'extra'
export interface PlacementMetadata { kind?: ExtraKind; sequence?: number; baseZ?: number }
interface Position extends PlacementMetadata { floor: number; x: number; y: number; key?: string }
interface Config { floors: number; hasRoof?: boolean }
export const isExtraKey = (key: unknown): key is string => typeof key === 'string' && /^extra:[a-zA-Z0-9_-]{1,80}$/.test(key)
export const isModuleKey = (key: unknown): key is string => typeof key === 'string' && (/^(?:[1-9]|1[0-6]):(?:[0-9]|[1-3][0-9]):(?:[0-9]|[1-3][0-9])$/.test(key) || isExtraKey(key))
export const positionKeyOf = (p: Pick<Position, 'floor' | 'x' | 'y' | 'key'>) => p.key ?? `${p.floor}:${p.x}:${p.y}`
export function hasValidPlacementIdentity(p: Position) {
  if (isExtraKey(p.key)) return isExtraKind(p.kind) && Number.isSafeInteger(p.sequence) && p.sequence! >= 1 && p.sequence! <= 9999
  return (p.key === undefined || p.key === `${p.floor}:${p.x}:${p.y}`) && p.kind === undefined && p.sequence === undefined
}
export const isElevation = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 500 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7
export const isExtraKind = (value: unknown): value is ExtraKind => typeof value === 'string' && Object.hasOwn(EXTRA_KINDS, value)
export const moduleKindOf = (p: Pick<Position, 'kind' | 'floor'>, config: Config): BuildingModuleKind => p.kind ?? (config.hasRoof && p.floor === config.floors + 1 ? 'roof' : 'normal')
export const moduleKindLabel = (p: Pick<Position, 'kind' | 'floor'>, config: Config) => { const kind = moduleKindOf(p, config); return kind === 'normal' ? '일반 모듈' : EXTRA_KINDS[kind] }
export const layerIncludes = (p: Pick<Position, 'kind' | 'floor'>, config: Config, layer: PlanLayer) => layer === 'all' || (layer === 'normal' ? moduleKindOf(p, config) === 'normal' : moduleKindOf(p, config) !== 'normal')
export function extraNumberSuffix(p: PlacementMetadata) { return p.kind && p.sequence ? `-${{roof:'R',penthouse:'P',special:'S'}[p.kind]}${String(p.sequence).padStart(2,'0')}` : '' }
export function defaultBaseZ(p: Pick<Position, 'kind' | 'floor'>, config: Config, generalHeight: number) {
  const floorBase = (p.floor - 1) * generalHeight
  return p.kind ? floorBase + (config.hasRoof && p.floor === config.floors + 1 ? 1 : generalHeight) : floorBase
}
