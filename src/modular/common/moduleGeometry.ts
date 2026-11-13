import type { ModuleRecord, ProjectConfig } from './model'
import { moduleHeightOf, type Installation3DSettings } from './installation3d'
import { defaultBaseZ, isElevation } from './buildingModules'

export const ANCHORS = { 'bottom-left': '좌하단', 'bottom-right': '우하단', 'top-left': '좌상단', 'top-right': '우상단' } as const
export type ModuleAnchor = keyof typeof ANCHORS
export interface ModuleDimensions { width?: number; depth?: number; height?: number; anchor?: ModuleAnchor }
export const isDimension = (value: unknown, max = 30): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= max && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7
export function moduleGeometryOf(module: Pick<ModuleRecord, 'floor' | 'x' | 'y' | 'dimensions' | 'kind' | 'baseZ'>, config: ProjectConfig, settings?: Installation3DSettings) {
  const dims = module.dimensions, generalHeight = moduleHeightOf(settings)
  const width = isDimension(dims?.width) ? dims.width : config.width
  const depth = isDimension(dims?.depth) ? dims.depth : config.depth
  const defaultHeight = module.kind === 'roof' || (!module.kind && config.hasRoof && module.floor === config.floors + 1) ? 1 : generalHeight
  const height = isDimension(dims?.height, 12) ? dims.height : defaultHeight
  const anchor: ModuleAnchor = dims?.anchor && Object.hasOwn(ANCHORS, dims.anchor) ? dims.anchor : 'bottom-left'
  return { width, depth, height, anchor, originX: module.x * config.width + (anchor.endsWith('right') ? config.width - width : 0), originY: module.y * config.depth + (anchor.startsWith('top') ? config.depth - depth : 0), baseZ: isElevation(module.baseZ) ? module.baseZ : defaultBaseZ(module, config, generalHeight) }
}
/** Grid plus all actual footprints: supports growth beyond any of the four edges. */
export function planBoundsOf(modules: Array<Pick<ModuleRecord, 'floor' | 'x' | 'y' | 'dimensions' | 'kind' | 'baseZ'>>, config: ProjectConfig) {
  let x0 = 0, y0 = 0, x1 = config.columns * config.width, y1 = config.rows * config.depth
  for (const m of modules) { const g = moduleGeometryOf(m, config); x0 = Math.min(x0, g.originX); y0 = Math.min(y0, g.originY); x1 = Math.max(x1, g.originX + g.width); y1 = Math.max(y1, g.originY + g.depth) }
  return { x0, y0, x1, y1, width: x1 - x0, depth: y1 - y0 }
}
