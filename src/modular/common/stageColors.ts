import { STAGES, type StageId } from './model'

export const STAGE_PALETTE = ['#2563EB', '#7C3AED', '#0891B2', '#EA580C', '#059669', '#DB2777', '#4F46E5', '#B45309', '#0D9488', '#9333EA', '#E11D48', '#0284C7', '#65A30D', '#475569', '#C026D3'] as const
export const isStageColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)

/** Stable by stage ID so reordering a workflow never changes its default colors. */
export function defaultStageColor(id: StageId): string {
  const index = STAGES.findIndex(stage => stage.id === id)
  if (index >= 0) return STAGE_PALETTE[index]
  let hash = 0
  for (const char of id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0
  const hue = hash % 360, saturation = .62, lightness = .43
  const a = saturation * Math.min(lightness, 1 - lightness)
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase()
}
export function stageColorOf(colors: Record<StageId, string> | undefined, id: StageId): string {
  return isStageColor(colors?.[id]) ? colors![id].toUpperCase() : defaultStageColor(id)
}
