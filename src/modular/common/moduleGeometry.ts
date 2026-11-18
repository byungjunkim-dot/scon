import {gridGeometryOf} from './gridGeometry'
import type { ModuleRecord, ProjectConfig } from './model'
import { moduleHeightOf, type Installation3DSettings } from './installation3d'
import { defaultBaseZ, isElevation, moduleKindOf, floorHeightOf } from './buildingModules'

export const ANCHORS = { 'bottom-left': '좌하단', 'bottom-right': '우하단', 'top-left': '좌상단', 'top-right': '우상단' } as const
export type ModuleAnchor = keyof typeof ANCHORS
export interface ModuleDimensions { width?: number; depth?: number; height?: number; anchor?: ModuleAnchor }
export const isDimension = (value: unknown, max = 30): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= max && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7
export function moduleGeometryOf(module: Pick<ModuleRecord, 'floor' | 'x' | 'y' | 'dimensions' | 'kind' | 'baseZ' | 'moduleType'>, config: ProjectConfig, settings?: Installation3DSettings) {
  const grid=gridGeometryOf(config),cellWidth=grid.widths[module.x]??config.width,cellDepth=grid.depths[module.y]??config.depth
  const dims = module.dimensions, generalHeight = moduleHeightOf(settings)
  const width = isDimension(dims?.width) ? dims.width : cellWidth
  const depth = isDimension(dims?.depth) ? dims.depth : cellDepth
  const defaultHeight = moduleKindOf(module,config) === 'roof' ? 1 : config.levels ? floorHeightOf(module.floor,config,generalHeight) : generalHeight
  const height = isDimension(dims?.height, 12) ? dims.height : defaultHeight
  const anchor: ModuleAnchor = dims?.anchor && Object.hasOwn(ANCHORS, dims.anchor) ? dims.anchor : 'bottom-left'
  return { width, depth, height, anchor, originX: (grid.xs[module.x]??0) + (anchor.endsWith('right') ? cellWidth - width : 0), originY: (grid.ys[module.y]??0) + (anchor.startsWith('top') ? cellDepth - depth : 0), baseZ: isElevation(module.baseZ) ? module.baseZ : defaultBaseZ(module, config, generalHeight) }
}
/** Grid plus all actual footprints: supports growth beyond any of the four edges. */
export function planBoundsOf(modules: Array<Pick<ModuleRecord, 'floor' | 'x' | 'y' | 'dimensions' | 'kind' | 'baseZ' | 'moduleType'>>, config: ProjectConfig) {
  const grid=gridGeometryOf(config)
  let x0 = 0, y0 = 0, x1 = grid.width, y1 = grid.depth
  for (const m of modules) { const g = moduleGeometryOf(m, config); x0 = Math.min(x0, g.originX); y0 = Math.min(y0, g.originY); x1 = Math.max(x1, g.originX + g.width); y1 = Math.max(y1, g.originY + g.depth) }
  return { x0, y0, x1, y1, width: x1 - x0, depth: y1 - y0 }
}
