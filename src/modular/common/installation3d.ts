/** Shared settings contract. No renderer, API or browser dependency. */
export interface Installation3DSettings { moduleHeight: number }
export const DEFAULT_MODULE_HEIGHT = 4
export function isModuleHeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 12 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
}
export const moduleHeightOf = (settings?: Installation3DSettings) => isModuleHeight(settings?.moduleHeight) ? settings.moduleHeight : DEFAULT_MODULE_HEIGHT
