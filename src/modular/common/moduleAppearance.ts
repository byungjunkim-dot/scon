import type { BuildingModuleKind } from './buildingModules'

/** Quiet plan colours; selection outlines and process indicators stay independent. */
export const MODULE_TONES = {
  normal: { background: '#EFF6FF', borderColor: '#93C5FD', color: '#155DFC' },
  roof: { background: '#ECFDF3', borderColor: '#86CDA5', color: '#23764C' },
  special: { background: '#F3EFFF', borderColor: '#B7A0E3', color: '#7044A5' },
}
export const moduleTone = (kind: BuildingModuleKind) => MODULE_TONES[kind === 'normal' || kind === 'roof' ? kind : 'special']
