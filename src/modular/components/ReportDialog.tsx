'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { IconDownload, IconPalette, IconX } from '@tabler/icons-react'
import { workflowStagesOf, type ProjectDetail } from '../common/model'
import { defaultStageColor, isStageColor, stageColorOf } from '../common/stageColors'
import { buildReportHtml, downloadReportHtml } from '../reports/reportHtml'
import styles from './ReportDialog.module.css'

interface Props {
  project: ProjectDetail
  busy: boolean
  onSaveColors: (colors: Record<string, string>) => Promise<boolean>
  onClose: () => void
}

export function ReportDialog({ project, busy, onSaveColors, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const stages = workflowStagesOf(project)
  const savedColors = Object.fromEntries(stages.map(stage => [stage.id, stageColorOf(project.stageColors, stage.id)]))
  const [colors, setColors] = useState(savedColors)
  const [showColors, setShowColors] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const locked = busy || pending
  const dirty = stages.some(stage => colors[stage.id]?.toUpperCase() !== savedColors[stage.id])
  const valid = stages.every(stage => isStageColor(colors[stage.id]))
  const previewColors = Object.fromEntries(stages.map(stage => [stage.id, isStageColor(colors[stage.id]) ? colors[stage.id] : savedColors[stage.id]]))
  const html = useMemo(() => buildReportHtml(project, previewColors, true), [project, JSON.stringify(previewColors)])

  useEffect(() => { ref.current?.showModal() }, [])
  useEffect(() => {
    if (!dirty) return
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [dirty])

  function close() {
    if (!locked) onClose()
  }
  async function saveColors() {
    if (!valid || locked) return
    setPending(true); setError('')
    try {
      const normalized = Object.fromEntries(Object.entries(colors).map(([id, color]) => [id, color.toUpperCase()]))
      if (await onSaveColors(normalized)) setColors(normalized)
      else setError('색상을 저장하지 못했습니다. 닫은 뒤 최신 현황을 불러와 다시 시도하세요.')
    } catch { setError('색상을 저장하지 못했습니다. 연결 상태를 확인하세요.') }
    finally { setPending(false) }
  }

  return <dialog ref={ref} className={styles.dialog} onCancel={event => { event.preventDefault(); close() }} aria-labelledby="report-title">
    <header className={styles.header}>
      <div><h2 id="report-title">제작현황 HTML 보고서</h2><p>저장된 현황 기준입니다. 층과 공정을 선택해 확인하고, 인터넷 없이 열 수 있는 HTML 파일로 전달하세요.</p></div>
      <div className={styles.actions}>
        <button type="button" aria-pressed={showColors} onClick={() => setShowColors(value => !value)} disabled={locked}><IconPalette size={16} />색상 설정</button>
        <button type="button" className={styles.primary} disabled={locked || dirty} title={dirty ? '변경한 색상을 저장한 뒤 다운로드하세요.' : undefined} onClick={() => downloadReportHtml(project, colors)}><IconDownload size={16} />HTML 다운로드</button>
        <button type="button" aria-label="보고서 닫기" onClick={close} disabled={locked}><IconX size={18} /></button>
      </div>
    </header>
    <div className={styles.body}>
      <iframe title="제작현황 HTML 미리보기" srcDoc={html} sandbox="allow-scripts allow-downloads allow-modals" />
      {showColors && <aside className={styles.colors} aria-label="프로젝트 공정 색상 설정">
        <h3>공정 색상 설정</h3><p>색상 선택기 또는 #RRGGBB 코드를 사용하세요. 저장하면 이 프로젝트의 보고서 기본색으로 적용됩니다.</p>
        <button type="button" disabled={locked} onClick={() => setColors(Object.fromEntries(stages.map(stage => [stage.id, defaultStageColor(stage.id)])))}>기본색 복원</button>
        <div className={styles.colorList}>{stages.map(stage => <div className={styles.colorRow} key={stage.id}>
          <span>{stage.label}{!stage.active && <small>비활성</small>}</span>
          <input type="color" aria-label={`${stage.label} 색상 선택`} disabled={locked} value={isStageColor(colors[stage.id]) ? colors[stage.id] : savedColors[stage.id]} onChange={event => setColors(current => ({ ...current, [stage.id]: event.target.value.toUpperCase() }))} />
          <input type="text" aria-label={`${stage.label} HEX 코드`} aria-invalid={!isStageColor(colors[stage.id])} disabled={locked} maxLength={7} value={colors[stage.id] ?? ''} onChange={event => setColors(current => ({ ...current, [stage.id]: event.target.value }))} />
        </div>)}</div>
        {!valid && <p className={styles.error}>색상 코드는 #123ABC와 같이 입력하세요.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="button" className={styles.primary} disabled={locked || !dirty || !valid} onClick={() => void saveColors()}>{locked ? '저장 중…' : '프로젝트 색상 저장'}</button>
      </aside>}
    </div>
  </dialog>
}
