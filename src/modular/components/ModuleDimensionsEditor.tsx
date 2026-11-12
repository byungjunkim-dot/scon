import { useEffect, useState } from 'react'
import type { ModuleRecord, ProjectConfig } from '../common/model'
import { ANCHORS, isDimension, moduleGeometryOf, type ModuleAnchor, type ModuleDimensions } from '../common/moduleGeometry'
import styles from './ModuleDimensionsEditor.module.css'

interface Props { module: ModuleRecord; config: ProjectConfig; generalHeight: number; busy: boolean; otherDirty: boolean; onSave: (dimensions: ModuleDimensions) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void }
export function ModuleDimensionsEditor({ module, config, generalHeight, busy, otherDirty, onSave, onDirtyChange }: Props) {
  const initial = () => ({ width: String(module.dimensions?.width ?? ''), depth: String(module.dimensions?.depth ?? ''), height: String(module.dimensions?.height ?? ''), anchor: module.dimensions?.anchor ?? 'bottom-left' as ModuleAnchor })
  const [input, setInput] = useState(initial), [error, setError] = useState('')
  const saved = JSON.stringify(module.dimensions ?? {})
  useEffect(() => { setInput(initial()); setError('') }, [module.key, saved])
  const original = initial(), dirty = JSON.stringify(input) !== JSON.stringify(original)
  useEffect(() => { onDirtyChange(dirty) }, [dirty])
  useEffect(() => () => onDirtyChange(false), [])
  const defaults = moduleGeometryOf({ ...module, dimensions: undefined }, config, { moduleHeight: generalHeight })
  const effective = moduleGeometryOf(module, config, { moduleHeight: generalHeight })
  async function save(reset = false) {
    if (busy || otherDirty) return
    const dimensions: ModuleDimensions = {}
    if (!reset) {
      for (const key of ['width', 'depth', 'height'] as const) if (input[key].trim()) {
        const value = Number(input[key]); if (!isDimension(value, key === 'height' ? 12 : 30)) { setError('폭·깊이 0.5~30m, 높이 0.5~12m, 소수 둘째 자리까지 입력하세요.'); return }; dimensions[key] = value
      }
      if (input.anchor !== 'bottom-left') dimensions.anchor = input.anchor
    }
    setError('')
    if (await onSave(dimensions)) { if (reset) setInput({ width: '', depth: '', height: '', anchor: 'bottom-left' }); onDirtyChange(false) }
    else setError('저장하지 못했습니다. 입력은 유지됩니다.')
  }
  return <details className={styles.root}><summary>모듈 치수 · 기준 모서리 <small>{effective.width} × {effective.depth} × {effective.height}m</small></summary><div className={styles.fields}>
    {(['width', 'depth', 'height'] as const).map((key, i) => <label key={key}>{['가로 / 폭', '세로 / 깊이', '높이'][i]} (m)<input aria-label={`개별 ${['폭', '깊이', '높이'][i]}(m)`} type="number" min="0.5" max={key === 'height' ? 12 : 30} step="0.01" placeholder={`${defaults[key]} (기본)`} value={input[key]} disabled={busy} onChange={e => setInput(v => ({ ...v, [key]: e.target.value }))} /></label>)}
    <label>고정할 기준 모서리<select aria-label="모듈 기준 모서리" value={input.anchor} disabled={busy} onChange={e => setInput(v => ({ ...v, anchor: e.target.value as ModuleAnchor }))}>{Object.entries(ANCHORS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div><p>빈 치수는 기본값을 따릅니다. 선택한 모서리를 원래 그리드 칸에 고정합니다. 높이를 바꿔도 상층 바닥은 이동하지 않습니다.</p>
    {otherDirty && <p role="status">다른 입력을 먼저 저장하거나 취소한 후 치수를 저장하세요.</p>}{error && <p role="alert">{error}</p>}
    <div className={styles.actions}><button type="button" disabled={busy || otherDirty || !dirty} onClick={() => void save()}>치수 저장</button><button type="button" disabled={busy || !dirty} onClick={() => { setInput(initial()); setError('') }}>입력 취소</button><button type="button" disabled={busy || otherDirty || !Object.keys(module.dimensions ?? {}).length} onClick={() => void save(true)}>기본값 복원</button></div>
  </details>
}
