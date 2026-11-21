import type { BuildingModuleKind } from './buildingModules'

/** Quiet plan colours; selection outlines and process indicators stay independent. */
export const MODULE_TONES = {
  normal: { background: '#EFF6FF', borderColor: '#93C5FD', color: '#155DFC' },
  roof: { background: '#ECFDF3', borderColor: '#86CDA5', color: '#23764C' },
  special: { background: '#F3EFFF', borderColor: '#B7A0E3', color: '#7044A5' },
}
export const moduleTone = (kind: BuildingModuleKind) => MODULE_TONES[kind === 'normal' || kind === 'roof' ? kind : 'special']

export const MODULE_MARKERS={
 normal:{label:'일반 모듈',color:'#155DFC'},
 roof:{label:'지붕 모듈',color:'#23764C'},
 special:{label:'특수 모듈',color:'#7044A5'},
} as const
export const moduleMarker=(kind:BuildingModuleKind)=>MODULE_MARKERS[kind==='normal'||kind==='roof'?kind:'special']
