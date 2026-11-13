import { isExtraKey, layerIncludes, moduleKindLabel, positionKeyOf, type PlanLayer } from '../common/buildingModules'
import { BuildingControls, ExtraPlacementDialog, ExtraPlanLayer, ExtraRecoveryPicker } from '../features/building/BuildingModules'
'use client'

import { StorageRecoveryDialog } from '../components/StorageRecoveryDialog'
import { moduleGeometryOf, planBoundsOf } from '../common/moduleGeometry'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconArrowDownRight, IconArrowUpRight, IconBuilding, IconCalendar, IconCheck, IconChevronDown, IconClock, IconCopy, IconCube, IconDownload, IconGridDots, IconLayersIntersect, IconLayoutGrid, IconMinus, IconPlus, IconRefresh, IconSearch, IconSettings, IconTruckDelivery, IconX, IconAlertTriangle } from '@tabler/icons-react'
import { appApi, ApiError } from '../api/modularApi'
import manifest from '../manifest.json'
import { actualStageDateOf, axisNumber, baselineWorkflowStagesOf, completedCount, currentPlanOf, DEFAULT_CONFIG, layoutStatusOf, managementPhaseOf, moduleKey, moduleNumber, moduleStatus, moduleStatusLabel, openIssues, plannedStageDateOf, progress, today, validActualDate, workflowStagesOf, totalFloorsOf, isRoofFloorOf, floorLabelOf, floorNameOf, type ModuleRecord, type ModuleStatus, type ProjectCommand, type ProjectConfig, type ProjectDetail, type ProjectSummary, type StageId, type WorkflowStage } from '../common/model'
import { BulkPlanEditor } from '../components/BulkPlanEditor'
import { ModuleDetail } from '../components/ModuleDetail'
import { DraftModuleDetail } from '../components/DraftModuleDetail'
import { WorkflowSettingsDialog } from '../components/WorkflowSettingsDialog'
import { ReportDialog } from '../components/ReportDialog'
import { ProductionNotesAndPhotos } from '../components/ProductionNotesAndPhotos'
import { InstallationView } from '../features/installation3d/InstallationView'
import { MiniInstallationView } from '../features/installation3d/MiniInstallationView'
import { installationSceneOf } from '../features/installation3d/projectAdapter'
import { moduleHeightOf } from '../common/installation3d'
import { User } from '../../types'
import styles from './ProductionBoard.module.css'
import theme from '../theme/theme.module.css'

const api = appApi(manifest.id)
function errorMessage(err: unknown) {
  if (err instanceof ApiError) {
    try { const body = JSON.parse(err.body); if (typeof body.message === 'string') return body.message } catch { /* HTTP body may be empty */ }
    if (err.status === 401 || err.status === 403) return '로그인 후 프로젝트를 사용할 수 있습니다. 플레이트에서 로그인한 뒤 다시 불러오세요.'
    if (err.status === 409) return '다른 화면에서 데이터가 변경되었습니다. 최신 데이터를 불러온 뒤 다시 저장하세요.'
    if (err.status === 503) return '프로젝트 저장소에 연결할 수 없습니다. 런처에서 앱을 실행한 뒤 다시 불러오세요.'
  }
  return '요청을 완료하지 못했습니다. 연결을 확인하고 다시 시도하세요.'
}
const number = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
const timeLabel = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

function ActionConfirmDialog({
  title,
  message,
  confirmLabel = '확인',
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
  onClose: () => void
}) {
  return (
    <div
      role="dialog" aria-modal="true" aria-label={title}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 xl:pl-64 bg-slate-900/40 backdrop-blur-[2px] transition-all"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        style={{ maxWidth: '440px', borderRadius: '16px', background: '#FFFFFF', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '24px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: danger ? '#FEE2E2' : '#EFF6FF',
                  color: danger ? '#DC2626' : '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconAlertTriangle size={20} />
              </span>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>{title}</h3>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={onClose}
              aria-label="닫기"
              style={{ cursor: 'pointer' }}
            >
              <IconX size={18} />
            </button>
          </div>
          <p
            style={{
              margin: '0 0 22px',
              fontSize: '13px',
              color: '#475569',
              lineHeight: '1.65',
              whiteSpace: 'pre-line',
            }}
          >
            {message}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className={styles.button}
              onClick={onClose}
              style={{ cursor: 'pointer', padding: '9px 16px', borderRadius: '8px' }}
            >
              취소
            </button>
            <button
              type="button"
              className={danger ? styles.button : styles.primaryButton}
              style={{
                cursor: 'pointer',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: 600,
                ...(danger
                  ? { background: '#DC2626', color: '#fff', borderColor: '#DC2626' }
                  : { background: '#155DFC', color: '#fff', borderColor: '#155DFC' }),
              }}
              onClick={async () => {
                onClose()
                await onConfirm()
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsDialog({ initial, editing, busy, error, onSave, onClose, defaultProjectName }: { initial: ProjectConfig; editing: boolean; busy: boolean; error: string; onSave: (config: ProjectConfig) => Promise<boolean>; onClose: () => void; defaultProjectName?: string }) {
  const [config, setConfig] = useState<ProjectConfig>({
    ...initial,
    name: initial.name || defaultProjectName || '',
    numberingOrder: initial.numberingOrder ?? 'col-row',
    numberingOrigin: initial.numberingOrigin ?? 'bottom-left',
  })
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  const field = (key: keyof ProjectConfig, value: string) => setConfig(c => ({ ...c, [key]: key === 'name' ? value : value === '' ? NaN : Number(value) }))
  function close() {
    if (!busy) {
      try { dialog.current?.close() } catch {}
      onClose()
    }
  }
  return <dialog ref={dialog} className={styles.dialog} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === dialog.current) close() }} aria-labelledby="project-dialog-title">
    <form onSubmit={async e => { e.preventDefault(); if (await onSave(config)) { try { dialog.current?.close() } catch {}; onClose() } }}>
      <div className={styles.dialogHead}><span className={styles.iconSquare}><IconBuilding size={23} /></span><button type="button" className={styles.iconButton} aria-label="설정 닫기" onClick={close} disabled={busy}><IconX size={20} /></button></div>
      <h2 id="project-dialog-title">{editing ? '모듈제작 관리 설정 변경' : '모듈제작 관리 설정'}</h2>
      <p className={styles.muted}>모듈의 실제 규격과 번호 부여 기준을 설정하여 건물의 기준 그리드를 만듭니다.</p>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <label className={styles.field}>프로젝트 이름<input autoFocus={!defaultProjectName} required maxLength={80} placeholder="프로젝트 이름" value={config.name} onChange={e => field('name', e.target.value)} disabled={busy} /></label>
      <div className={styles.formSection}>01 <b>기준 모듈 규격</b><span>단위 m</span></div>
      <div className={styles.formGrid}><label className={styles.field}>가로 / 폭 (m)<input type="number" required min="0.5" max="30" step="0.01" value={Number.isFinite(config.width) ? config.width : ''} onChange={e => field('width', e.target.value)} disabled={busy} /></label><label className={styles.field}>세로 / 깊이 (m)<input type="number" required min="0.5" max="30" step="0.01" value={Number.isFinite(config.depth) ? config.depth : ''} onChange={e => field('depth', e.target.value)} disabled={busy} /></label></div>
      <div className={styles.formSection}>02 <b>건물 축열과 층수</b></div>
      <div className={styles.formGrid3}>{([{ key: 'columns', label: '가로 칸 수', max: 40 }, { key: 'rows', label: '세로 칸 수', max: 40 }, { key: 'floors', label: '층수', max: 15 }] as const).map(f => <label key={f.key} className={styles.field}>{f.label}<input type="number" required min={1} max={f.max} step={1} value={Number.isFinite(config[f.key]) ? config[f.key] : ''} onChange={e => field(f.key, e.target.value)} disabled={busy} /></label>)}</div>
      <div style={{ marginTop: '12px', padding: '10px 14px', background: '#F1F5F9', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>
          <input
            type="checkbox"
            checked={Boolean(config.hasRoof)}
            onChange={e => setConfig(c => ({ ...c, hasRoof: e.target.checked }))}
            disabled={busy}
            style={{ width: '16px', height: '16px', accentColor: '#155DFC', cursor: 'pointer' }}
          />
          <span>최상층 지붕 모듈(지붕층 · RF) 별도 관리 추가</span>
          <span style={{ marginLeft: 'auto', fontSize: '10px', background: '#DBEAFE', color: '#1D4ED8', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>RF 추가</span>
        </label>
        <p style={{ margin: '5px 0 0 24px', fontSize: '11px', color: '#64748B', lineHeight: '1.5' }}>
          체크 시 기준 {config.floors || 0}개 층 상단에 <b>'RF (지붕층)'</b> 레이어가 추가되어 지붕 모듈을 독립적으로 배치하고 제작·출고를 분리 관리할 수 있습니다.
        </p>
      </div>

      <div className={styles.formSection}>03 <b>모듈 번호 부여 기준</b><span>층 - 0000 체계</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
            1. 번호 열 순서 (0000 앞/뒤)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfig(c => ({ ...c, numberingOrder: 'col-row' }))}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: (config.numberingOrder ?? 'col-row') === 'col-row' ? '2px solid #155DFC' : '1px solid #CBD5E1',
                background: (config.numberingOrder ?? 'col-row') === 'col-row' ? '#EFF6FF' : '#FFFFFF',
                color: (config.numberingOrder ?? 'col-row') === 'col-row' ? '#1D4ED8' : '#475569',
                fontWeight: (config.numberingOrder ?? 'col-row') === 'col-row' ? 700 : 500,
                fontSize: '12px',
                textAlign: 'left',
                cursor: busy ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span>가로00 세로00</span>
                {(config.numberingOrder ?? 'col-row') === 'col-row' && (
                  <span style={{ fontSize: '10px', background: '#DBEAFE', color: '#1D4ED8', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    선택됨
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>층 - [가로열00][세로열00]</div>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => setConfig(c => ({ ...c, numberingOrder: 'row-col' }))}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: config.numberingOrder === 'row-col' ? '2px solid #155DFC' : '1px solid #CBD5E1',
                background: config.numberingOrder === 'row-col' ? '#EFF6FF' : '#FFFFFF',
                color: config.numberingOrder === 'row-col' ? '#1D4ED8' : '#475569',
                fontWeight: config.numberingOrder === 'row-col' ? 700 : 500,
                fontSize: '12px',
                textAlign: 'left',
                cursor: busy ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span>세로00 가로00</span>
                {config.numberingOrder === 'row-col' && (
                  <span style={{ fontSize: '10px', background: '#DBEAFE', color: '#1D4ED8', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    선택됨
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>층 - [세로열00][가로열00]</div>
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
            2. 번호 시작점 (원점 위치)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfig(c => ({ ...c, numberingOrigin: 'bottom-left' }))}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: (config.numberingOrigin ?? 'bottom-left') === 'bottom-left' ? '2px solid #155DFC' : '1px solid #CBD5E1',
                background: (config.numberingOrigin ?? 'bottom-left') === 'bottom-left' ? '#EFF6FF' : '#FFFFFF',
                color: (config.numberingOrigin ?? 'bottom-left') === 'bottom-left' ? '#1D4ED8' : '#475569',
                fontWeight: (config.numberingOrigin ?? 'bottom-left') === 'bottom-left' ? 700 : 500,
                fontSize: '12px',
                textAlign: 'left',
                cursor: busy ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span>좌하단 시작</span>
                {(config.numberingOrigin ?? 'bottom-left') === 'bottom-left' && (
                  <span style={{ fontSize: '10px', background: '#DBEAFE', color: '#1D4ED8', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    선택됨
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>평면 좌측하단을 1열·1행 시작</div>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => setConfig(c => ({ ...c, numberingOrigin: 'top-left' }))}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: config.numberingOrigin === 'top-left' ? '2px solid #155DFC' : '1px solid #CBD5E1',
                background: config.numberingOrigin === 'top-left' ? '#EFF6FF' : '#FFFFFF',
                color: config.numberingOrigin === 'top-left' ? '#1D4ED8' : '#475569',
                fontWeight: config.numberingOrigin === 'top-left' ? 700 : 500,
                fontSize: '12px',
                textAlign: 'left',
                cursor: busy ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span>좌상단 시작</span>
                {config.numberingOrigin === 'top-left' && (
                  <span style={{ fontSize: '10px', background: '#DBEAFE', color: '#1D4ED8', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    선택됨
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>평면 좌측상단을 1열·1행 시작</div>
            </button>
          </div>
        </div>

        {(() => {
          const isTopLeft = config.numberingOrigin === 'top-left'
          const isRowCol = config.numberingOrder === 'row-col'
          const sampleFloor = 1
          const topRow = Math.max(0, (config.rows || 1) - 1)
          const tlNum = moduleNumber({ floor: sampleFloor, x: 0, y: topRow }, config)
          const blNum = moduleNumber({ floor: sampleFloor, x: 0, y: 0 }, config)
          const nextColNum = moduleNumber({ floor: sampleFloor, x: 1, y: isTopLeft ? topRow : 0 }, config)
          return (
            <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }}>
              <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>
                실시간 번호 부여 미리보기: <b>{sampleFloor}층 - {isRowCol ? '세로00가로00' : '가로00세로00'}</b> ({isTopLeft ? '좌측 상단부터 01 시작' : '좌측 하단부터 01 시작'})
              </div>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', color: '#64748B' }}>
                <span>{isTopLeft ? '시작 위치(좌상단): ' : '시작 위치(좌하단): '}<strong style={{ color: '#155DFC', fontWeight: 700 }}>{isTopLeft ? tlNum : blNum}</strong></span>
                <span>가로 다음 모듈: <strong style={{ color: '#155DFC', fontWeight: 700 }}>{nextColNum}</strong></span>
                <span>{isTopLeft ? '좌하단 모듈: ' : '좌상단 모듈: '}<strong style={{ color: '#475569' }}>{isTopLeft ? blNum : tlNum}</strong></span>
                {config.hasRoof && <span>지붕층 시작: <strong style={{ color: '#155DFC', fontWeight: 700 }}>RF-{isRowCol ? '0101' : '0101'}</strong></span>}
              </div>
            </div>
          )
        })()}
      </div>

      <div className={styles.dimSummary}><IconGridDots size={20} /><span>기준 외곽 <b>{number(config.width * config.columns)} × {number(config.depth * config.rows)} m</b><small>가로 {config.columns}칸(열) · 세로 {config.rows}칸(행) / {config.floors}개 층{config.hasRoof ? ' + 지붕층(RF)' : ''} · 번호: {config.numberingOrder === 'row-col' ? '세로00가로00' : '가로00세로00'}({config.numberingOrigin === 'top-left' ? '좌상단' : '좌하단'})</small></span></div>
      <p className={styles.formHint}>{editing ? '배치 초안 단계에서만 설정을 바꿀 수 있습니다. 배치가 새 범위 밖에 있으면 먼저 해당 모듈을 제외해야 저장됩니다.' : '생성 후 층별 배치를 편집하고 변경할 때마다 저장할 수 있습니다. 최종 배치 확정 전에는 모듈번호와 제작 관리가 시작되지 않습니다.'}</p>
      <div className={styles.dialogFoot}><button type="button" className={styles.button} onClick={close} disabled={busy}>취소</button><button className={styles.primaryButton} disabled={busy || !config.name.trim()}>{busy ? '저장 중…' : '설정 저장'}<IconArrowUpRight size={16} /></button></div>
    </form>
  </dialog>
}

function csvCell(value: unknown) { let text = String(value ?? ''); if (/^\s*[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"` }
function dayDelta(actual: string | undefined, planned: string | undefined) {
  if (!actual || !planned || !validActualDate(actual)) return ''
  return String(Math.round((Date.parse(`${actual}T00:00:00Z`) - Date.parse(`${planned}T00:00:00Z`)) / 86400000))
}
function stageOverdue(module: ModuleRecord, stage: StageId, asOf = today()) {
  const planned = plannedStageDateOf(currentPlanOf(module), stage)
  return Boolean(planned && planned < asOf && !validActualDate(actualStageDateOf(module, stage)))
}
function downloadCsv(project: ProjectDetail) {
  const currentStages = workflowStagesOf(project)
  const activeStages = currentStages.filter(stage => stage.active)
  const baselineStages = baselineWorkflowStagesOf(project)
  const reportStages = [...currentStages, ...baselineStages.filter(stage => !currentStages.some(current => current.id === stage.id))]
  const stageHeader = (stage: WorkflowStage) => `${stage.label}${stage.active ? '' : ' (비활성)'}`
  const headers = ['프로젝트', '관리단계', '모듈번호', '층', 'X축', 'Y축', '폭(m)', '깊이(m)', '높이(m)', '기준 모서리', '제작현황', '진척률(%)', '구역', '생산공장', '설치예정일(기준)', '설치예정일(현재)', '출고예정일', '미해결이슈', '모듈 종류', '시작 높이(m)', '착수 기준선 포함 여부', ...reportStages.flatMap(s => { const label = stageHeader(s); return [`${label} 계획일(기준)`, `${label} 계획일(현재)`, `${label} 완료일(실제)`, `${label} 편차(현재-계획)`, `${label} 편차(기준-계획)`] }), '특이사항', '검사·이슈 이력']
  const rows = project.modules.filter(m => m.active).sort((a, b) => a.floor - b.floor || a.y - b.y || a.x - b.x).map(m => {
    const current = currentPlanOf(m)
    const floorLabel = isRoofFloorOf(m.floor, project.config) ? 'RF' : m.floor
    return [project.config.name, managementPhaseOf(project), moduleNumber(m, project.config), floorLabel, axisNumber(m.x), axisNumber(m.y), moduleGeometryOf(m,project.config).width, moduleGeometryOf(m,project.config).depth, moduleGeometryOf(m,project.config,project.installation3d).height, moduleGeometryOf(m,project.config).anchor, moduleStatusLabel(moduleStatus(m, activeStages), activeStages), progress(m, activeStages), current.zone, current.factory, m.baselinePlan?.installationDate ?? '', current.installationDate, m.targetDate, openIssues(m), moduleKindLabel(m,project.config), moduleGeometryOf(m,project.config,project.installation3d).baseZ, project.baselinePlanAt ? m.baselinePlan ? '포함' : '미포함' : '미설정', ...reportStages.flatMap(s => { const planned = plannedStageDateOf(current, s.id); const baseline = plannedStageDateOf(m.baselinePlan, s.id); const actual = actualStageDateOf(m, s.id) ?? ''; return [baseline, planned, actual, dayDelta(actual, planned), dayDelta(actual, baseline)] }), m.notes, m.inspections.map(i => `${i.date} [${i.kind === 'issue' ? '이슈' : i.kind === 'inspection' ? '검사' : '특이사항'} / ${i.kind === 'issue' ? i.status === 'resolved' ? '해결' : '미해결' : '기록'}] ${i.content}`).join('\n')]
  })
  const blob = new Blob(['\uFEFF', [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${project.config.name.replace(/[<>:"/\\|?*]/g, '_')}_제작현황_${today()}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface ProductionBoardProps {
  sconProject?: { id: string; name: string } | null;
  currentUser?: User | null;
}

export function ProductionBoard({ sconProject, currentUser }: ProductionBoardProps = {}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cacheWarning, setCacheWarning] = useState('')
  useEffect(()=>{const warn=(event:Event)=>setCacheWarning(String((event as CustomEvent).detail));window.addEventListener('modular-storage-warning',warn);return()=>window.removeEventListener('modular-storage-warning',warn)},[])
  const [dialog, setDialog] = useState<'create' | 'settings' | 'workflow' | 'report' | 'recovery' | null>(null)
  const [floor, setFloor] = useState(1)
  const [view, setView] = useState<'plan' | '3d'>('plan')
  const heightDirty = useRef(false)
  useEffect(() => {
    const checkView = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 1280) {
        if (!heightDirty.current && !geometryDirty.current) {
          setView(prev => (prev === '3d' ? 'plan' : prev))
        }
      }
    }
    checkView()
    window.addEventListener('resize', checkView)
    return () => window.removeEventListener('resize', checkView)
  }, [])
  const geometryDirty = useRef(false)
  const [heightReset] = useState(0)
  const [planLayer,setPlanLayer]=useState<PlanLayer>('all')
  const [showExtra,setShowExtra]=useState(false)
  const pendingExtraKeys=useRef<Set<string>|null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedModuleKeys, setSelectedModuleKeys] = useState<Set<string>>(() => new Set())
  const [mode, setMode] = useState<'inspect' | 'place' | 'remove' | 'select'>('inspect')
  const [zoom, setZoom] = useState(1)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | ModuleStatus | 'issues'>('all')
  const [stage, setStage] = useState<StageId | 'all'>('all')
  const [delayStage, setDelayStage] = useState<StageId | 'all'>('all')
  const [delayOnly, setDelayOnly] = useState(false)
  const [scope, setScope] = useState<'all' | 'floor'>('all')
  const [copyFloor, setCopyFloor] = useState(2)
  const [showCopy, setShowCopy] = useState(false)
  const [detailTab, setDetailTab] = useState<'plan' | 'stages' | 'inspections' | 'history'>('stages')
  const [confirmState, setConfirmState] = useState<{
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
    onConfirm: () => void | Promise<void>
  } | null>(null)
  const askConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = '확인',
    danger = false
  ) => {
    setConfirmState({ title, message, confirmLabel, danger, onConfirm })
  }
  const dirty = useRef(false)
  const locked = useRef(false)
  const requestSequence = useRef(0)
  const canLeave = () => {
    if (heightDirty.current || geometryDirty.current) { setError('3D 높이 또는 모듈 치수를 저장하거나 입력 취소한 뒤 이동해 주세요.'); return false }
    dirty.current = false
    return true
  }
  const resetView = () => { dirty.current = false; setSelectedKey(null); setSelectedModuleKeys(new Set()); setQuery(''); setFilter('all'); setStage('all'); setDelayStage('all'); setDelayOnly(false); setShowCopy(false); setMode('inspect') }
  const loadProject = useCallback(async (id: string) => {
    const sequence = ++requestSequence.current
    setLoading(true); setError('')
    try {
      const detail = await api.get<ProjectDetail>(`/projects/${encodeURIComponent(id)}`)
      if (sequence === requestSequence.current) {
        dirty.current = false
        setSelectedKey(null)
        setSelectedModuleKeys(new Set())
        setProject(detail)
        if (sconProject?.name) {
          try { localStorage.setItem(`modular_selected_project_id_${sconProject.name}`, id) } catch {}
        }
        setFloor(f => Math.min(f, totalFloorsOf(detail.config)))
        setMode(layoutStatusOf(detail) === 'draft' ? 'place' : 'inspect')
      }
    }
    catch (err) { if (sequence === requestSequence.current) setError(errorMessage(err)) }
    finally { if (sequence === requestSequence.current) setLoading(false) }
  }, [sconProject?.name])
  const loadList = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const list = await api.get<ProjectSummary[]>('/projects')
      setProjects(list)
      if (list.length) {
        const savedKey = sconProject?.name ? `modular_selected_project_id_${sconProject.name}` : null
        let savedId: string | null = null
        if (savedKey) {
          try { savedId = localStorage.getItem(savedKey) } catch {}
        }
        const byId = sconProject ? list.find(p => p.id === sconProject.id) : null
        const bySaved = savedId ? list.find(p => p.id === savedId) : null
        const byName = sconProject ? list.filter(p => p.name === sconProject.name) : []

        let matched = byId || bySaved
        if (!matched) {
          if (byName.length === 1) {
            matched = byName[0]
          } else if (byName.length > 1) {
            const withModules = byName.filter(p => p.moduleCount > 0)
            if (withModules.length === 1) {
              matched = withModules[0]
            } else {
              throw new ApiError(409, JSON.stringify({ message: '같은 이름의 제작 프로젝트가 여러 개입니다. 이 PC 기록 복구에서 서버 기록을 확인해 선택하거나 불필요한 빈 프로젝트를 삭제하세요.' }))
            }
          }
        }

        if (matched) {
          if (savedKey) {
            try { localStorage.setItem(savedKey, matched.id) } catch {}
          }
          await loadProject(matched.id)
        } else if (!sconProject) {
          await loadProject(list[0].id)
        } else {
          setProject(null)
        }
      } else {
        setProject(null)
      }
    }
    catch (err) { setError(errorMessage(err)) }
    finally { setLoading(false) }
  }, [loadProject, sconProject])
  useEffect(() => { void loadList(); return () => { requestSequence.current++ } }, [loadList])
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer) }, [notice])
  useEffect(() => {
    if (stage !== 'all' && !activeStages.some(item => item.id === stage)) setStage('all')
    if (delayStage !== 'all' && !activeStages.some(item => item.id === delayStage)) setDelayStage('all')
  }, [project?.revision])

  useEffect(()=>{
    if(!project||!pendingExtraKeys.current)return
    const list=layoutStatusOf(project)==='draft'?project.draftLayout??[]:project.modules
    const added=list.find(p=>isExtraKey(p.key)&&!pendingExtraKeys.current!.has(positionKeyOf(p)))
    if(added){pendingExtraKeys.current=null;setFloor(added.floor);setSelectedKey(positionKeyOf(added));setSelectedModuleKeys(new Set());setPlanLayer('extra');setMode('inspect')}
  },[project])

  const commandWithResult = async (value: ProjectCommand): Promise<{ success: boolean; error?: string }> => {
    if (!project || locked.current || loading) return { success: false, error: '현재 다른 작업이 진행 중입니다.' }
    locked.current = true; setBusy(true); setError('')
    try {
      const detail = await api.post<ProjectDetail>(`/projects/${encodeURIComponent(project.id)}/commands`, { expectedRevision: project.revision, command: value })
      setProject(detail); setFloor(f => Math.min(f, totalFloorsOf(detail.config))); setProjects(list => list.map(p => p.id === detail.id ? { id: detail.id, name: detail.config.name, moduleCount: detail.modules.filter(m => m.active).length, revision: detail.revision, updatedAt: detail.updatedAt, layoutStatus: layoutStatusOf(detail), draftModuleCount: layoutStatusOf(detail) === 'draft' ? (detail.draftLayout ?? []).length : 0, managementPhase: managementPhaseOf(detail) } : p)); setNotice('변경사항을 서버에 저장했습니다.');
      return { success: true }
    } catch (err) {
      const msg = errorMessage(err)
      setError(msg)
      return { success: false, error: msg }
    }
    finally { locked.current = false; setBusy(false) }
  }

  const command = async (value: ProjectCommand): Promise<boolean> => {
    const res = await commandWithResult(value)
    return res.success
  }
  const saveConfig = async (config: ProjectConfig) => {
    if (dialog === 'settings' || project) return command({ type: 'settings', config })
    if (locked.current) return false
    locked.current = true; setBusy(true); setError('')
    try { const detail = await api.post<ProjectDetail>('/projects', config); resetView(); setMode('place'); setProject(detail); setFloor(1); setProjects(list => [{ id: detail.id, name: detail.config.name, moduleCount: 0, revision: detail.revision, updatedAt: detail.updatedAt, layoutStatus: 'draft', draftModuleCount: 0, managementPhase: 'draft' }, ...list]); setNotice('프로젝트가 생성되었습니다. 배치 초안이 자동 저장됩니다.'); return true }
    catch (err) { setError(errorMessage(err)); return false }
    finally { locked.current = false; setBusy(false) }
  }
  const totalFloors = project ? totalFloorsOf(project.config) : 0
  const modules = useMemo(() => project?.modules.filter(m => m.active) ?? [], [project])
  const installationScene = useMemo(() => project ? installationSceneOf(project) : null, [project])
  const isDraft = project ? layoutStatusOf(project) === 'draft' : false
  const draftLayout = project?.draftLayout ?? []
  const floorModules = useMemo(() => modules.filter(m => m.floor === floor), [modules, floor])
  const indexed = useMemo(() => new Map(floorModules.filter(m=>!isExtraKey(m.key)).map(m => [moduleKey(m.floor, m.x, m.y), m])), [floorModules])
  const draftFloor = useMemo(() => draftLayout.filter(p => p.floor === floor), [draftLayout, floor])
  const draftIndexed = useMemo(() => new Map(draftFloor.filter(p=>!isExtraKey(p.key)).map(p => [moduleKey(p.floor, p.x, p.y), p])), [draftFloor])
  const bounds = project ? planBoundsOf(isDraft ? draftFloor : floorModules, project.config) : null
  const selectedDraft = selectedKey ? draftLayout.find(p=>positionKeyOf(p)===selectedKey) ?? null : null
  const selected = modules.find(m => m.key === selectedKey) ?? null
  const selectedModules = useMemo(() => modules.filter(m => selectedModuleKeys.has(m.key)), [modules, selectedModuleKeys])
  const phase = project ? managementPhaseOf(project) : 'draft'
  const workflowStages = project ? workflowStagesOf(project) : []
  const activeStages = workflowStages.filter(item => item.active)
  const planningStages = activeStages.filter(item => item.id !== 'installation')
  const baselineWorkflowStages = project ? baselineWorkflowStagesOf(project) : []
  const baselineStages = baselineWorkflowStages.filter(item => item.active)
  const asOf = today()
  const stageLate = (m: ModuleRecord, stageId: StageId) => stageOverdue(m, stageId, asOf)
  const statistics = scope === 'floor' ? floorModules : modules
  const plansByKey = useMemo(() => new Map(statistics.map(m => [m.key, currentPlanOf(m)])), [statistics])
  const planFor = (m: ModuleRecord) => plansByKey.get(m.key) ?? currentPlanOf(m)
  const completed = statistics.reduce((sum, m) => sum + completedCount(m, activeStages), 0)
  const completion = statistics.length ? Math.round(completed / (statistics.length * activeStages.length) * 100) : 0
  const shipped = statistics.filter(m => moduleStatus(m, activeStages) === 'shipped').length
  const issueCount = statistics.reduce((sum, m) => sum + openIssues(m), 0)
  const plannedModules = statistics.filter(m => { const p = planFor(m); return Boolean(p.zone || p.factory || p.installationDate || planningStages.some(s => p.stages[s.id])) }).length
  const plannedStageSlots = statistics.reduce((sum, m) => sum + planningStages.filter(s => Boolean(plannedStageDateOf(planFor(m), s.id))).length, 0)
  const unplannedStageSlots = statistics.length * planningStages.length - plannedStageSlots
  const missingInstallation = statistics.filter(m => !planFor(m).installationDate).length
  const delayedModules = new Set(statistics.filter(m => activeStages.some(s => stageLate(m, s.id))).map(m => m.key)).size
  const delayedOccurrences = statistics.reduce((sum, m) => sum + activeStages.filter(s => stageLate(m, s.id)).length, 0)
  const baselineDelayedModules = project?.baselinePlanAt ? new Set(statistics.filter(m => baselineStages.some(s => { const planned = plannedStageDateOf(m.baselinePlan, s.id); return Boolean(planned && planned < asOf && !validActualDate(actualStageDateOf(m, s.id))) }) || (!baselineWorkflowStages.some(s => s.id === 'installation') && Boolean(m.baselinePlan?.installationDate && m.baselinePlan.installationDate < asOf && !validActualDate(actualStageDateOf(m, 'installation'))))).map(m => m.key)).size : null
  const delayedByStage = activeStages.map(s => ({ ...s, count: statistics.filter(m => stageLate(m, s.id)).length }))
  const matches = (m: ModuleRecord) => (!query || moduleNumber(m, project?.config).includes(query.trim())) && (filter === 'all' || (filter === 'issues' ? openIssues(m) > 0 : moduleStatus(m, activeStages) === filter)) && (stage === 'all' || (activeStages.some(item => item.id === stage) && Boolean(actualStageDateOf(m, stage)))) && (!delayOnly || activeStages.some(s => stageLate(m, s.id))) && (delayStage === 'all' || (activeStages.some(item => item.id === delayStage) && stageLate(m, delayStage)))
  const filteredCount = floorModules.filter(matches).length
  const filtering = Boolean(query || filter !== 'all' || stage !== 'all' || delayStage !== 'all' || delayOnly)
  const switchFloor = (next: number) => {
    if (busy || loading || next === floor) return
    if (mode === 'select') { setFloor(next); setShowCopy(false); return }
    if (canLeave()) { dirty.current = false; setFloor(next); setSelectedKey(null); setShowCopy(false) }
  }
  const enterBulkSelection = () => {
    if (!project || isDraft || busy || loading || mode === 'select' || !canLeave()) return
    dirty.current = false
    setSelectedModuleKeys(selectedKey ? new Set([selectedKey]) : new Set())
    setSelectedKey(null)
    setQuery(''); setFilter('all'); setStage('all'); setDelayStage('all'); setDelayOnly(false)
    setMode('select')
  }
  const leaveBulkSelection = () => {
    if (mode !== 'select') return true
    if (!canLeave()) return false
    dirty.current = false
    setSelectedModuleKeys(new Set())
    setSelectedKey(null)
    setMode('inspect')
    return true
  }
  const replaceBulkSelection = (next: Set<string>) => {
    if (next.size === selectedModuleKeys.size && [...next].every(key => selectedModuleKeys.has(key))) return
    if (!canLeave()) return
    dirty.current = false
    setSelectedModuleKeys(next)
    setSelectedKey(null)
  }
  const selectFloorModules = () => {
    const next = new Set(selectedModuleKeys)
    for (const module of floorModules.filter(m=>project&&layerIncludes(m,project.config,planLayer))) next.add(module.key)
    replaceBulkSelection(next)
  }
  const clearBulkSelection = () => replaceBulkSelection(new Set())

  // Mobile Module Picker State & Handlers
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false)
  const [mobileSearchQuery, setMobileSearchQuery] = useState('')

  const isModuleSelected = useCallback(
    (key: string) => selectedModuleKeys.has(key) || (selectedKey === key && selectedModuleKeys.size <= 1),
    [selectedModuleKeys, selectedKey]
  )

  const mobileFilteredModules = useMemo(() => {
    if (!project) return []
    const q = mobileSearchQuery.trim().toLowerCase()
    return floorModules.filter(m => !q || moduleNumber(m, project.config).toLowerCase().includes(q))
  }, [floorModules, mobileSearchQuery, project])

  const toggleMobileModule = (key: string) => {
    if (!canLeave()) return
    dirty.current = false
    const next = new Set(selectedModuleKeys)
    if (selectedKey && !next.has(selectedKey)) {
      next.add(selectedKey)
    }
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setSelectedModuleKeys(next)
    if (next.size === 1) {
      setSelectedKey([...next][0])
      setMode('inspect')
    } else if (next.size > 1) {
      setSelectedKey(null)
      setMode('select')
    } else {
      setSelectedKey(null)
      setMode('inspect')
    }
  }

  const selectAllFloorModulesMobile = () => {
    if (!canLeave()) return
    dirty.current = false
    const next = new Set(selectedModuleKeys)
    for (const m of floorModules) next.add(m.key)
    setSelectedModuleKeys(next)
    if (next.size === 1) {
      setSelectedKey([...next][0])
      setMode('inspect')
    } else if (next.size > 1) {
      setSelectedKey(null)
      setMode('select')
    }
  }

  const clearMobileSelection = () => {
    if (!canLeave()) return
    dirty.current = false
    setSelectedModuleKeys(new Set())
    setSelectedKey(null)
    setMode('inspect')
  }

  const changeMode = (next: typeof mode) => {
    if (next === mode || busy || loading) return
    if (dirty.current || heightDirty.current || geometryDirty.current) { setError('입력을 먼저 저장하거나 취소한 뒤 배치 모드를 변경해 주세요.'); return }
    if (!canLeave()) return
    dirty.current = false; setSelectedModuleKeys(new Set()); setSelectedKey(null); setMode(next);if(next==='place'||next==='remove')setPlanLayer('all')
  }
  const selectByKey=(key:string)=>{
    if(busy||loading)return
    const p=(isDraft?draftLayout:modules).find(p=>positionKeyOf(p)===key)
    if(!p)return
    if(mode==='select'&&!isDraft){const next=new Set(selectedModuleKeys);if(next.has(key))next.delete(key);else next.add(key);replaceBulkSelection(next);return}
    if(key!==selectedKey&&canLeave()){dirty.current=false;setSelectedKey(key);if(project&&!layerIncludes(p,project.config,planLayer))setPlanLayer('all')}
  }
  const openExtra=()=>{
    if(busy||loading)return
    if(dirty.current||heightDirty.current||geometryDirty.current){setError('입력을 먼저 저장하거나 취소한 뒤 모듈을 추가해 주세요.');return}
    setError('');setShowExtra(true)
  }
  const changeExtraState=async(key:string,active:boolean)=>{
    if(!project||busy||loading||locked.current)return
    if(dirty.current||heightDirty.current||geometryDirty.current){setError('입력을 먼저 저장하거나 취소한 뒤 배치를 변경해 주세요.');return}
    const p=(isDraft?draftLayout:project.modules).find(p=>positionKeyOf(p)===key)
    if(!p||!isExtraKey(p.key))return
    const execute=async()=>{if(dirty.current||heightDirty.current||geometryDirty.current){setError('입력을 먼저 저장하거나 취소한 뒤 배치를 변경해 주세요.');return};if(await command({type:'extra-state',key,active,confirmed:!isDraft})){dirty.current=false;setSelectedKey(active?key:null);setSelectedModuleKeys(new Set());if(active)setPlanLayer('extra')}}
    if(isDraft){await execute();return}
    askConfirm(active?'추가 모듈 기록 복원':'추가 모듈 제외',`${moduleNumber(p,project.config)} · ${active?'기존 기록을 복원':'배치에서 제외'}할까요? 치수·계획·실적·검사·기준선은 보존됩니다.`,execute,active?'기록 복원':'제외',!active)
  }
  const chooseCell = async (x: number, y: number) => {
    if (!project || busy || loading || locked.current) return
    const key = moduleKey(floor, x, y)
    if (isDraft) {
      const planned = draftIndexed.has(key)
      if (planned && key === selectedKey && mode !== 'remove') return
      if ((key !== selectedKey || mode === 'remove') && !canLeave()) return
      if (mode === 'place' && !planned) { if (await command({ type: 'place', floor, x, y, active: true })) { dirty.current = false; setSelectedKey(key) }; return }
      if (mode === 'remove' && planned) { if (await command({ type: 'place', floor, x, y, active: false })) { dirty.current = false; setSelectedKey(null) }; return }
      if (planned && mode !== 'remove') { dirty.current = false; setSelectedKey(key) }
      return
    }
    const m = indexed.get(key)
    if (mode === 'place' || mode === 'remove') {
      const adding = mode === 'place'
      if ((adding && m) || (!adding && !m)) return
      if (dirty.current || heightDirty.current || geometryDirty.current) { setError('모듈 입력을 먼저 저장하거나 취소한 뒤 배치를 변경해 주세요.'); return }
      const stored = project.modules.find(m => m.key === key)
      const title = `${moduleNumber({ floor, x, y }, project.config)} · ${floorNameOf(floor, project.config)} X${axisNumber(x)} Y${axisNumber(y)}`
      const records = stored ? `완료 공정 ${Object.keys(stored.completed).length}건 · 검사·이슈 ${stored.inspections.length}건 · 변경 이력 ${stored.history.length}건` : ''
      const prompt = adding ? stored ? `${title}\n\n삭제했던 모듈을 다시 추가할까요?\n기존 치수·계획·실적·검사 기록을 그대로 복원합니다.\n${records}` : `${title}\n\n이 위치에 새 모듈을 추가할까요?\n빈 관리계획과 미완료 상태로 시작합니다.${project.baselinePlanAt ? '\n착수 기준선에는 포함되지 않습니다.' : ''}` : `${title}\n\n이 모듈을 배치에서 삭제할까요?\n${records}\n기존 기록은 보존되며, 같은 위치에 다시 추가하면 복원됩니다.`
      askConfirm(adding ? stored ? '삭제 모듈 복원' : '모듈 추가' : '모듈 삭제', prompt, async () => {
        if (dirty.current || heightDirty.current || geometryDirty.current) { setError('확인창을 연 뒤 변경한 입력이 있습니다. 먼저 저장하거나 취소한 뒤 다시 배치를 변경해 주세요.'); return }
        if (await command({ type: 'layout-module', floor, x, y, active: adding, confirmed: true })) { dirty.current = false; setSelectedKey(adding ? key : null); setSelectedModuleKeys(new Set()) }
      }, adding ? stored ? '기록 복원' : '추가' : '삭제', !adding)
      return
    }
    if (mode === 'select' && m) {
      const next = new Set(selectedModuleKeys)
      if (next.has(m.key)) next.delete(m.key)
      else next.add(m.key)
      replaceBulkSelection(next)
      return
    }
    if (mode === 'inspect' && m && m.key !== selectedKey && canLeave()) { dirty.current = false; setSelectedKey(m.key) }
  }

  const confirmLayout = () => {
    if (!project || !isDraft || !draftLayout.length || busy || loading) return
    if (dirty.current || geometryDirty.current) { setError('모듈 치수를 먼저 저장하거나 입력 취소한 뒤 배치를 확정해 주세요.'); return }
    const floorsUsed = new Set(draftLayout.map(p => p.floor)).size
    askConfirm(
      '최종 배치 확정',
      `배치 모듈 ${draftLayout.length}개 · 배치 층 ${floorsUsed}개 · 전체 ${project.config.floors}개 층${project.config.hasRoof ? ' + 지붕층(RF)' : ''}\n\n확정하면 모듈번호가 생성되고 그리드 기준은 고정됩니다. 이후에도 확인창을 거쳐 단일 모듈 추가·삭제를 할 수 있습니다. 모듈별 관리계획 단계로 이동할까요?`,
      async () => {
        if (await command({ type: 'confirm-layout' })) { setMode('inspect'); setSelectedKey(null); setNotice('최종 배치를 확정했습니다. 모듈번호가 부여되어 모듈 관리계획을 입력할 수 있습니다.') }
      },
      '최종 확정'
    )
  }

  const startProduction = () => {
    if (!project || phase !== 'planning' || busy || loading) return
    if (dirty.current) { setError('저장하지 않은 모듈 입력이 있습니다. 계획을 저장하거나 입력을 취소한 뒤 제작을 시작해 주세요.'); return }
    const missing = modules.length * planningStages.length - modules.reduce((sum, m) => sum + planningStages.filter(s => Boolean(plannedStageDateOf(currentPlanOf(m), s.id))).length, 0)
    askConfirm(
      '제작 관리 시작',
      `현재 프로젝트의 공정 ${activeStages.length}개 구성을 착수 기준으로 고정하고 제작 관리를 시작할까요?\n\n미입력 공정 계획일 ${missing.toLocaleString('ko-KR')}건 · 설치예정일 누락 모듈 ${modules.filter(m => !currentPlanOf(m).installationDate).length}개\n\n미입력 일정은 지연 집계에서 제외됩니다. 제작 시작 후 구성 변경은 사유와 이력이 필요합니다.`,
      async () => {
        if (await command({ type: 'start-production' })) { setSelectedKey(null); setSelectedModuleKeys(new Set()); setMode('inspect'); setNotice('착수 기준일정을 저장하고 제작 관리를 시작했습니다.') }
      },
      '제작 시작'
    )
  }

  const establishBaseline = () => {
    if (!project || phase !== 'production' || project.baselinePlanAt || busy || loading) return
    if (dirty.current) { setError('저장하지 않은 모듈 입력이 있습니다. 먼저 저장한 뒤 기준일정을 설정해 주세요.'); return }
    askConfirm(
      '기준일정 고정',
      '현재 저장된 모든 모듈 관리계획을 기준일정으로 고정할까요? 이후 일정 변경은 최신 계획으로 관리되고, 기준일정은 바뀌지 않습니다.',
      async () => {
        if (await command({ type: 'establish-baseline' })) setNotice('현재 관리계획을 기준일정으로 고정했습니다.')
      },
      '기준일정 고정'
    )
  }

  return <div className={`${theme.blue} ${styles.root}`} data-modular-manager="workspace">
    <div className={styles.projectToolbar}>
      <div className={styles.projectPicker}>
        <h1 className="text-xl font-bold text-gray-900">제작 현황</h1>
      </div>
      <div className={styles.actions}>
        {(currentUser?.role === 'admin' || currentUser?.userRole === '골드') && (
          <button className={styles.button} disabled={busy || loading} onClick={()=>{if(dirty.current||heightDirty.current||geometryDirty.current){setError('입력 중인 내용을 먼저 저장하거나 취소한 뒤 기록 복구를 여세요.');return}setDialog('recovery')}}>이 PC 기록 복구</button>
        )}
        <span className={styles.saveState}>{busy ? <><span className={styles.savingDot} />저장 중</> : project ? <><IconCheck size={14} />{timeLabel(project.updatedAt)} 저장</> : null}</span>
        <button className={styles.iconButton} title="최신 데이터 불러오기" aria-label="최신 데이터 불러오기" disabled={busy || loading} onClick={() => { if (canLeave()) { resetView(); if (project) void loadProject(project.id); else void loadList() } }}><IconRefresh size={18} /></button>
        <button className={styles.button} disabled={!project || busy || loading} onClick={() => { if (canLeave()) { dirty.current = false; setDialog('workflow') } }}><IconSettings size={16} />공정 설정</button>
        <button className={styles.button} disabled={!project || isDraft || busy || loading} title={isDraft ? '최종 배치 확정 후 사용할 수 있습니다.' : undefined} onClick={() => { if (canLeave()) { dirty.current = false; setDialog('report') } }}><IconDownload size={16} />HTML 보고서</button>
        <button className={styles.button} disabled={!project || isDraft || busy || loading} title={isDraft ? '최종 배치 확정 후 내보낼 수 있습니다.' : undefined} onClick={() => project && downloadCsv(project)}><IconDownload size={16} />CSV 내보내기</button>
        <button className={styles.button} disabled={busy || loading} onClick={() => { if (canLeave()) { resetView(); setDialog(project ? 'settings' : 'create') } }}><IconSettings size={16} />모듈제작 관리 설정</button>
      </div>
    </div>
    {cacheWarning && <div className={styles.notice} role="status">{cacheWarning}<button className={styles.inlineButton} onClick={()=>setCacheWarning('')}>닫기</button></div>}
    {error && <div className={styles.error} role="alert"><IconAlertTriangle size={19} /><span>{error}</span><button className={styles.inlineButton} disabled={busy || loading} onClick={() => { if (canLeave()) { resetView(); if (project) void loadProject(project.id); else void loadList() } }}>다시 불러오기</button><button aria-label="오류 닫기" className={styles.iconButton} onClick={() => setError('')}><IconX size={16} /></button></div>}
    {notice && <div className={styles.notice} role="status"><IconCheck size={17} />{notice}</div>}
    {loading && !project && <div className={styles.loading} role="status">프로젝트를 불러오고 있습니다…</div>}
    {!loading && !project && <div className={styles.welcome}>
      <div className={styles.welcomeArt} aria-hidden="true"><span className={styles.artAxis}>Y</span><div>{Array.from({ length: 12 }, (_, i) => <i key={i} className={[0, 1, 2, 4, 5, 6, 7, 9, 10].includes(i) ? styles.artModule : ''}><IconCube size={23} stroke={1.3} /></i>)}</div><span className={styles.artAxisX}>X →</span><span className={styles.artDimension}>4.0 m × 11.5 m</span></div>
      <span className={styles.eyebrow}>FROM GRID TO DELIVERY</span><h2>모듈 하나부터,<br />건물 전체의 제작 흐름까지.</h2><p>실제 모듈 비율로 층별 평면을 구성하고<br />공정 완료와 검사 이력을 도면 위에서 관리하세요.</p><button className={styles.primaryButton} onClick={() => setDialog('create')}><IconPlus size={18} />모듈제작 관리 설정 시작</button><div className={styles.welcomeSteps}><span><b>01</b>규격·축열 설정</span><span><b>02</b>층별 클릭 배치</span><span><b>03</b>공정·이슈 기록</span></div>
    </div>}
    {project && <>
      {isDraft ? <>
      <div className={styles.summaryHeading}><div><span className={styles.sectionLabel}>배치 초안</span><span className={styles.muted}>변경할 때마다 자동 저장 · 아직 제작 관리는 시작되지 않았습니다</span></div><span className={styles.privateBadge}>초안</span></div>
      <div className={styles.cards}>
        <div className={styles.card}><div className={styles.cardLabel}>배치 예정 모듈<span className={styles.cardIcon}><IconCube size={19} /></span></div><strong>{draftLayout.length}<small>개</small></strong><span className={styles.cardFoot}>모듈번호는 최종 확정 시 부여됩니다</span></div>
        <div className={styles.card}><div className={styles.cardLabel}>배치 층<span className={styles.cardIcon}><IconLayoutGrid size={19} /></span></div><strong>{new Set(draftLayout.map(p => p.floor)).size}<small>개 층</small></strong><span className={styles.cardFoot}>전체 {project.config.floors}개 층{project.config.hasRoof ? '+RF' : ''} 중 사용</span></div>
        <div className={styles.card}><div className={styles.cardLabel}>기준 그리드<span className={styles.cardIcon}><IconGridDots size={19} /></span></div><strong>{project.config.columns}<small>× {project.config.rows} 칸</small></strong><span className={styles.cardFoot}>{number(project.config.width)} × {number(project.config.depth)} m · {project.config.floors}개 층{project.config.hasRoof ? '+RF' : ''}</span></div>
        <div className={`${styles.card} ${styles.progressCard}`}><div className={styles.cardLabel}>다음 단계<span className={styles.cardIcon}><IconCheck size={19} /></span></div><strong className={styles.draftCardText}>최종 배치 확정</strong><button className={styles.primaryButton} disabled={!draftLayout.length || busy || loading} onClick={() => void confirmLayout()}>확정하고 관리계획 입력<IconArrowUpRight size={15} /></button></div>
      </div>
      </> : phase === 'planning' ? <>
      <div className={styles.summaryHeading}><div><span className={styles.sectionLabel}>모듈 관리계획</span><span className={styles.muted}>모듈별 또는 일괄 [계획 저장] 시 실시간 영구 저장 · 언제든 중단 후 이어서 작성 가능</span></div><button className={styles.primaryButton} disabled={busy || loading} onClick={() => void startProduction()}>계획을 기준일정으로 확정하고 제작 시작<IconArrowUpRight size={15} /></button></div>
      <div className={styles.cards}>
        <div className={styles.card}><div className={styles.cardLabel}>배치 모듈<span className={styles.cardIcon}><IconCube size={19} /></span></div><strong>{number(statistics.length)}<small>개</small></strong><span className={styles.cardFoot}>모듈별 계획 입력 대상</span></div>
        <div className={styles.card}><div className={styles.cardLabel}>계획 입력 모듈<span className={styles.cardIcon}><IconCheck size={19} /></span></div><strong>{number(plannedModules)}<small>개</small></strong><span className={styles.cardFoot}>{number(statistics.length - plannedModules)}개 <span>계획 항목 미입력</span></span></div>
        <div className={styles.card}><div className={styles.cardLabel}>공정 계획일 누락<span className={styles.cardIcon}><IconLayersIntersect size={19} /></span></div><strong>{number(unplannedStageSlots)}<small>건</small></strong><span className={styles.cardFoot}>{plannedStageSlots} / {statistics.length * planningStages.length}건 입력 · 설치예정일 별도</span></div>
        <div className={styles.card}><div className={styles.cardLabel}>설치예정일 누락<span className={styles.cardIcon}><IconCalendar size={19} /></span></div><strong>{number(missingInstallation)}<small>개</small></strong><span className={styles.cardFoot}>제작 시작 전 입력할 수 있습니다</span></div>
      </div>
      </> : <>
      <div className={styles.cards}>
        <div className={styles.card}><div className={styles.cardLabel}>배치 모듈<span className={styles.cardIcon}><IconCube size={19} /></span></div><strong>{number(statistics.length)}<small>개</small></strong><span className={styles.cardFoot}>{number(statistics.reduce((sum,m)=>{const g=moduleGeometryOf(m,project.config);return sum+g.width*g.depth},0))} m² <span>모듈 면적 합계</span></span></div>
        <div className={`${styles.card} ${styles.progressCard}`}><div className={styles.cardLabel}>전체 공정 완료율<span className={styles.cardIcon}><IconLayersIntersect size={19} /></span></div><strong>{completion}<small>%</small></strong><div className={styles.cardProgress}><i style={{ width: `${completion}%` }} /></div><span className={styles.cardFoot}>{completed} / {statistics.length * activeStages.length} <span>완료 공정 · 활성 {activeStages.length}개 기준</span></span></div>
        <button className={`${styles.card} ${styles.delayCard}`} onClick={() => { if (!leaveBulkSelection()) return; setDelayOnly(!delayOnly); setDelayStage('all'); setFilter('all'); setStage('all'); setMode('inspect') }}><div className={styles.cardLabel}>현재 지연 모듈<span className={styles.cardIcon}><IconAlertTriangle size={19} /></span></div><strong>{number(delayedModules)}<small>개</small></strong><span className={styles.cardFoot}>{delayOnly ? '전체 보기' : `공정 지연 ${number(delayedOccurrences)}건 · 클릭해 확인`}</span></button>
        <button className={`${styles.card} ${styles.issueCard}`} onClick={() => { if (!leaveBulkSelection()) return; setFilter(filter === 'issues' ? 'all' : 'issues'); setMode('inspect') }}><div className={styles.cardLabel}>미해결 이슈<span className={styles.cardIcon}><IconAlertTriangle size={19} /></span></div><strong>{issueCount}<small>건</small></strong><span className={styles.cardFoot}>선택 층에서 이슈 모듈 보기<IconArrowUpRight size={15} /></span></button>
      </div>
      <ProductionNotesAndPhotos 
        projectId={sconProject?.id || project?.id || 'default_project'} 
        projectName={sconProject?.name || project?.config?.name}
        className={styles.notesCard}
      />
      <div className={styles.delayBreakdown}><span>공정별 현재 지연</span>{delayedByStage.map(item => <button type="button" key={item.id} aria-pressed={delayStage === item.id} className={delayStage === item.id ? styles.delayChipActive : ''} onClick={() => { if (!leaveBulkSelection()) return; setDelayStage(delayStage === item.id ? 'all' : item.id); setDelayOnly(false); setFilter('all'); setStage('all'); setMode('inspect') }}>{item.label}<b>{item.count}</b></button>)}</div>
      </>}
      <div className={`hidden xl:flex ${styles.viewTabs}`} role="group" aria-label="배치 보기 방식"><button aria-pressed={view === 'plan' || isDraft} disabled={busy || loading} onClick={() => { if (view !== 'plan' && canLeave()) { dirty.current = false; setView('plan') } }}><IconLayoutGrid size={16} />평면 배치</button><button aria-pressed={view === '3d' && !isDraft} disabled={isDraft || busy || loading} title={isDraft ? '최종 배치 확정 후 사용할 수 있습니다.' : undefined} onClick={() => { if (view !== '3d' && canLeave()) { dirty.current = false; setSelectedModuleKeys(new Set()); setMode('inspect'); setView('3d') } }}><IconCube size={16} />3D 설치현황</button></div>
      <div className={styles.workspace} aria-busy={busy || loading}>
        <aside className={styles.floors}><div className={styles.floorHead}><IconLayoutGrid size={19} /><b>층별 레이어</b><span>{project.config.hasRoof ? `${project.config.floors}F+RF` : `${project.config.floors}F`}</span></div><div className={styles.floorList}>{Array.from({ length: totalFloors }, (_, i) => totalFloors - i).map(f => { const isRoof = isRoofFloorOf(f, project.config); const ms = modules.filter(m => m.floor === f); const planned = draftLayout.filter(p => p.floor === f).length; const percent = ms.length ? Math.round(ms.reduce((s, m) => s + progress(m, activeStages), 0) / ms.length) : 0; return <button key={f} disabled={busy || loading} className={`${styles.floorButton} ${floor === f ? styles.activeFloor : ''}`} aria-pressed={floor === f} onClick={() => switchFloor(f)}><div><b>{isRoof ? 'RF' : String(f).padStart(2, '0')}<small>{isRoof ? ' (지붕)' : 'F'}</small></b><span>{isDraft ? `${planned}개` : `${ms.length}개`}</span></div><i><em style={{ width: `${isDraft ? (planned ? 100 : 0) : percent}%` }} /></i></button> })}</div></aside>

        {/* Mobile Unified Card: Combines Floor Selector, Module Pull-down, and Selected Module Info */}
        {!isDraft && (
          <div className={styles.mobileUnifiedCard}>
            {/* 1. Floor Selector Row (Reordered 1F -> RF) */}
            <div className={styles.mobileFloorRow}>
              {Array.from({ length: totalFloors }, (_, i) => i + 1).map(f => {
                const isRoof = isRoofFloorOf(f, project.config)
                const ms = modules.filter(m => m.floor === f)
                const isCurrent = floor === f
                return (
                  <button
                    key={f}
                    type="button"
                    disabled={busy || loading}
                    className={`${styles.mobileFloorTab} ${isCurrent ? styles.mobileFloorTabActive : ''}`}
                    onClick={() => switchFloor(f)}
                  >
                    <span className={styles.mobileFloorTabName}>
                      {isRoof ? 'RF' : String(f).padStart(2, '0')}<small>{isRoof ? ' (지붕)' : 'F'}</small>
                    </span>
                    <span className={styles.mobileFloorTabCount}>
                      {ms.length}개
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 2. Module Pull-down Dropdown */}
            <div className={styles.mobilePickerSection}>
              <button
                type="button"
                className={styles.mobilePickerTrigger}
                onClick={() => setMobilePickerOpen(prev => !prev)}
                aria-expanded={mobilePickerOpen}
              >
                <div className={styles.mobilePickerTriggerLeft}>
                  <div className={styles.mobilePickerIcon}>
                    <IconCube size={18} stroke={1.5} />
                  </div>
                  <div className={styles.mobilePickerTitleGroup}>
                    <span className={styles.mobilePickerEyebrow}>
                      {floorNameOf(floor, project.config)} 모듈 선택
                    </span>
                    <strong className={styles.mobilePickerMainText}>
                      {selectedModuleKeys.size > 1
                        ? `선택 모듈 ${selectedModuleKeys.size}개`
                        : (selected || (selectedModules.length === 1 ? selectedModules[0] : null))
                        ? `모듈 ${moduleNumber(selected || selectedModules[0], project.config)} 선택됨`
                        : `모듈을 선택하세요 (전체 ${floorModules.length}개)`}
                    </strong>
                  </div>
                </div>
                <div className={styles.mobilePickerTriggerRight}>
                  {(selectedModuleKeys.size > 0 || selectedKey) && (
                    <span className={styles.mobileSelectedBadge}>
                      {selectedModuleKeys.size || 1}개 선택
                    </span>
                  )}
                  <IconChevronDown
                    size={18}
                    className={`${styles.chevronIcon} ${mobilePickerOpen ? styles.chevronOpen : ''}`}
                  />
                </div>
              </button>

              {mobilePickerOpen && (
                <div className={styles.mobilePickerDropdown}>
                  <div className={styles.mobilePickerControls}>
                    <div className={styles.mobileSearchWrap}>
                      <input
                        type="text"
                        className={styles.mobileSearchInput}
                        placeholder="모듈 번호 검색 (예: 0615)"
                        value={mobileSearchQuery}
                        onChange={e => setMobileSearchQuery(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.mobileQuickBtn}
                      onClick={selectAllFloorModulesMobile}
                    >
                      층 전체 선택
                    </button>
                    <button
                      type="button"
                      className={styles.mobileQuickBtn}
                      onClick={clearMobileSelection}
                    >
                      선택 해제
                    </button>
                  </div>

                  <div className={styles.mobileListContainer}>
                    {mobileFilteredModules.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '11px' }}>
                        검색된 모듈이 없습니다.
                      </div>
                    ) : (
                      mobileFilteredModules.map(m => {
                        const isChecked = isModuleSelected(m.key)
                        const status = moduleStatus(m, activeStages)
                        return (
                          <label
                            key={m.key}
                            className={`${styles.mobileListItem} ${isChecked ? styles.mobileListItemActive : ''}`}
                          >
                            <input
                              type="checkbox"
                              className={styles.mobileListCheckbox}
                              checked={isChecked}
                              onChange={() => toggleMobileModule(m.key)}
                            />
                            <div className={styles.mobileListItemInfo}>
                              <span className={styles.mobileModuleName}>
                                {moduleNumber(m, project.config)}
                              </span>
                              <span className={styles.mobileModuleStatusText}>
                                {moduleStatusLabel(status, activeStages)} · {progress(m, activeStages)}%
                              </span>
                            </div>
                            {openIssues(m) > 0 && <IconAlertTriangle size={14} color="#D97706" />}
                          </label>
                        )
                      })
                    )}
                  </div>

                  <button
                    type="button"
                    className={styles.mobileConfirmBtn}
                    onClick={() => setMobilePickerOpen(false)}
                  >
                    선택 완료 ({selectedModuleKeys.size || (selectedKey ? 1 : 0)}개 모듈 확인)
                  </button>
                </div>
              )}
            </div>

            {/* 3. Selected Module Info Summary (Cleaned up) */}
            <div className={styles.mobileSelectedSummary}>
              {selectedModuleKeys.size > 1 || (selectedModules.length > 1 && !selected) ? (
                <div className={styles.mobileSelectedBulk}>
                  <div className={styles.mobileModuleChips}>
                    {selectedModules.slice(0, 15).map(m => (
                      <span key={m.key} className={styles.mobileChip}>
                        {moduleNumber(m, project.config)}
                      </span>
                    ))}
                    {selectedModules.length > 15 && (
                      <b className={styles.mobileChipMore}>+ {selectedModules.length - 15}개</b>
                    )}
                  </div>
                </div>
              ) : (selected || (selectedModules.length === 1 ? selectedModules[0] : null)) ? (
                (() => {
                  const curr = selected || selectedModules[0]
                  const currProgress = progress(curr, activeStages)
                  const currDoneCount = completedCount(curr, activeStages)
                  const currIssues = openIssues(curr)
                  return (
                    <div className={styles.mobileSelectedSingle}>
                      <div className={styles.mobileModuleNumberRow}>
                        <h3 className={styles.mobileModuleNumber}>
                          {moduleNumber(curr, project.config)}
                        </h3>
                      </div>
                      <div className={styles.mobileProgressRow}>
                        <div className={styles.mobileProgressLabel}>
                          <span>제작 진행률 <b>{currProgress}%</b></span>
                          <small>{currDoneCount} / {activeStages.length} 공정</small>
                        </div>
                        <div className={styles.mobileProgressTrack}>
                          <span style={{ width: `${currProgress}%` }} />
                        </div>
                      </div>
                      {currIssues > 0 && (
                        <div className={styles.mobileIssueNotice}>
                          <IconAlertTriangle size={14} color="#D97706" />
                          <span>미해결 이슈 {currIssues}건</span>
                        </div>
                      )}
                    </div>
                  )
                })()
              ) : null}
            </div>
          </div>
        )}

        {view === '3d' && !isDraft && installationScene ? <InstallationView key={project.id} scene={installationScene} moduleHeight={moduleHeightOf(project.installation3d)} today={asOf} floor={floor} selectedKey={selectedKey} busy={busy || loading} heightReset={heightReset} onHeightDirty={value=>{heightDirty.current=value}} onSelect={key=>{if(key!==selectedKey && canLeave()){dirty.current=false;setSelectedModuleKeys(new Set());setSelectedKey(key);setMode('inspect');setMobilePickerOpen(false);setPlanLayer('all');const picked=modules.find(m=>m.key===key);if(picked)setFloor(picked.floor)}}} onSaveHeight={async moduleHeight=>{if(dirty.current){setError('모듈 상세의 입력을 먼저 저장하거나 취소한 뒤 높이를 저장해 주세요.');return false}return command({type:'installation-3d',moduleHeight})}} /> : <section className={styles.planPanel} aria-label={`${floorNameOf(floor, project.config)} 모듈 배치도`}>
          <div className={styles.planHead}><div><span className={styles.eyebrow}>{isDraft ? 'LAYOUT DRAFT' : phase === 'planning' ? 'MODULE PLAN SETUP' : 'PRODUCTION TRACKING'}</span><h2>{floorNameOf(floor, project.config)} 모듈 배치도 <span>{isDraft ? `${draftFloor.length}개 배치 예정` : `${floorModules.length}개 모듈`}</span></h2></div>{!isDraft && installationScene && <MiniInstallationView key={project.id} scene={installationScene} moduleHeight={moduleHeightOf(project.installation3d)} today={asOf} selectedKey={selectedKey || (selectedModules.length === 1 ? selectedModules[0].key : null)} />}</div>
          <div className={styles.planTools}><div className={styles.modeSwitch}>{isDraft ? <><button className={mode === 'place' ? styles.modeActive : ''} disabled={busy || loading} onClick={() => changeMode('place')}><IconPlus size={15} />배치</button><button className={mode === 'remove' ? styles.modeActive : ''} disabled={busy || loading} onClick={() => changeMode('remove')}><IconMinus size={15} />제외</button><button className={mode === 'inspect' ? styles.modeActive : ''} disabled={busy || loading} onClick={() => changeMode('inspect')}>치수 선택</button></> : <><button className={mode === 'inspect' ? styles.modeActive : ''} disabled={busy || loading} onClick={() => changeMode('inspect')}><IconSearch size={15} />현황 조회</button><button className={mode === 'select' ? styles.modeActive : ''} disabled={busy || loading} onClick={() => { if (mode === 'select') leaveBulkSelection(); else enterBulkSelection() }}><IconCheck size={15} />{mode === 'select' ? '선택 종료' : '여러 모듈 선택'}</button><button className={mode === 'place' ? styles.modeActive : ''} disabled={busy || loading} onClick={() => changeMode('place')}><IconPlus size={15} />모듈 추가</button><button className={mode === 'remove' ? styles.modeActive : ''} disabled={busy || loading} onClick={() => changeMode('remove')}><IconMinus size={15} />모듈 삭제</button></>}</div><div className={styles.zoom}><button className={styles.iconButton} aria-label="배치도 축소" disabled={zoom <= 0.4} onClick={() => setZoom(z => Math.max(0.4, Math.round((z - 0.2) * 10) / 10))}><IconMinus size={15} /></button><button onClick={() => setZoom(1)} title="배율 초기화">{Math.round(zoom * 100)}%</button><button className={styles.iconButton} aria-label="배치도 확대" disabled={zoom >= 2.4} onClick={() => setZoom(z => Math.min(2.4, Math.round((z + 0.2) * 10) / 10))}><IconPlus size={15} /></button></div></div>
          <BuildingControls layer={planLayer} busy={busy||loading} onLayer={layer=>{if(canLeave()){dirty.current=false;setPlanLayer(layer);if(mode!=='select')setMode('inspect');setSelectedKey(null)}}} onAdd={openExtra}/>
          {isDraft ? (
            <div className={styles.editBar}>
              <button
                className={styles.inlineButton}
                disabled={busy || loading}
                onClick={() => {
                  if (dirty.current || geometryDirty.current) { setError('모듈 치수를 먼저 저장하거나 입력 취소해 주세요.'); return }
                  askConfirm(
                    '층 전체 채우기',
                    `${floorNameOf(floor, project.config)}의 모든 그리드 칸에 배치 예정 모듈을 채우시겠습니까?`,
                    async () => {
                      await command({ type: 'fill', floor })
                    },
                    '전체 채우기'
                  )
                }}
              >
                층 전체 채우기
              </button>
              <button
                className={styles.inlineButton}
                disabled={busy || loading || !draftFloor.length}
                onClick={() => {
                  if (dirty.current || geometryDirty.current) { setError('모듈 치수를 먼저 저장하거나 입력 취소해 주세요.'); return }
                  askConfirm(
                    '층 배치 초기화',
                    `${floorNameOf(floor, project.config)} 배치 초안 ${draftFloor.length}개를 모두 초기화할까요?\n이 작업은 초안에만 적용되며 다시 배치할 수 있습니다.`,
                    async () => {
                      await command({ type: 'reset-floor', floor })
                    },
                    '초기화',
                    true
                  )
                }}
              >
                <IconRefresh size={14} />층 배치 초기화
              </button>
              <button className={styles.inlineButton} disabled={busy || loading || totalFloors < 2} onClick={() => setShowCopy(v => !v)}>
                <IconCopy size={14} />층 복사
              </button>
              <span className={styles.autosaveHint}>변경 시 자동 저장</span>
            </div>
          ) : mode === 'select' ? (
            <div className={styles.selectionTools}>
              <span>층을 이동해도 선택은 유지됩니다 · {selectedModuleKeys.size}개 선택</span>
              <button
                className={styles.inlineButton}
                disabled={busy || loading || floorModules.filter(m=>layerIncludes(m,project.config,planLayer)).every(module => selectedModuleKeys.has(module.key))}
                onClick={selectFloorModules}
              >
                현재 층 전체 선택
              </button>
              <button className={styles.inlineButton} disabled={busy || loading || selectedModuleKeys.size === 0} onClick={clearBulkSelection}>
                선택 해제
              </button>
            </div>
          ) : <div className={styles.lockedBanner}>그리드 기준 고정 · 모듈 추가·삭제는 확인 후 적용 · 삭제 기록 포함 최대 5,000개 좌표 보관</div>}
          {showCopy && isDraft && (
            <div className={styles.copyRow}>
              <span>{floorNameOf(floor, project.config)} 배치를</span>
              <select
                aria-label="복사 대상 층"
                value={copyFloor === floor || copyFloor > totalFloors ? (floor === 1 ? 2 : 1) : copyFloor}
                onChange={e => setCopyFloor(Number(e.target.value))}
              >
                {Array.from({ length: totalFloors }, (_, i) => i + 1)
                  .filter(f => f !== floor)
                  .map(f => (
                    <option key={f} value={f}>
                      {floorNameOf(f, project.config)}
                    </option>
                  ))}
              </select>
              <span>으로</span>
              <button
                className={styles.inlineButton}
                disabled={busy || loading || !draftFloor.length}
                onClick={() => {
                  const target = copyFloor === floor || copyFloor > totalFloors ? (floor === 1 ? 2 : 1) : copyFloor
                  if (dirty.current || geometryDirty.current) { setError('모듈 치수를 먼저 저장하거나 입력 취소해 주세요.'); return }
                  askConfirm(
                    '층 배치 복사',
                    `${floorNameOf(floor, project.config)}의 배치 모양을 ${floorNameOf(target, project.config)}에 복사할까요?\n대상 층 배치는 이 모양으로 바뀝니다.`,
                    async () => {
                      if (await command({ type: 'copy', sourceFloor: floor, targetFloor: target })) {
                        setShowCopy(false)
                        setNotice(`${floorNameOf(floor, project.config)} 초안을 ${floorNameOf(target, project.config)}에 저장했습니다.`)
                      }
                    },
                    '배치 복사'
                  )
                }}
              >
                배치 복사
              </button>
            </div>
          )}
          <div className={styles.canvas}>
            <div className={styles.blueprint} style={{ width: (bounds?.width ?? project.config.columns * project.config.width) * 13 * zoom + 96, height: (bounds?.depth ?? project.config.rows * project.config.depth) * 13 * zoom + 94 }}>
              <span className={styles.dimensionX} style={{ left: 54 - (bounds?.x0 ?? 0) * 13 * zoom, width: project.config.columns * project.config.width * 13 * zoom }}>{number(project.config.columns * project.config.width)} m</span>
              <div className={styles.grid} style={{ display: 'block', backgroundSize: `${project.config.width * 13 * zoom}px ${project.config.depth * 13 * zoom}px`, left: 54 - (bounds?.x0 ?? 0) * 13 * zoom, top: 42 + ((bounds?.y1 ?? project.config.rows * project.config.depth) - project.config.rows * project.config.depth) * 13 * zoom, width: project.config.columns * project.config.width * 13 * zoom, height: project.config.rows * project.config.depth * 13 * zoom, gridTemplateColumns: `repeat(${project.config.columns}, 1fr)`, gridTemplateRows: `repeat(${project.config.rows}, 1fr)` }}>
                {Array.from({ length: project.config.rows }, (_, row) => project.config.rows - row - 1).flatMap(y => Array.from({ length: project.config.columns }, (_, x) => { const key = moduleKey(floor, x, y); const m = indexed.get(key); const planned = isDraft ? draftIndexed.get(key) : undefined; const geometry = (m || planned) ? moduleGeometryOf((m || planned)!, project.config, project.installation3d) : { originX: x * project.config.width, originY: y * project.config.depth, width: project.config.width, depth: project.config.depth }; const match = m && matches(m); const occupied = isDraft ? Boolean(planned) : Boolean(m); return <button style={{ display: layerIncludes(m||planned||{floor},project.config,planLayer)?undefined:'none', position: 'absolute', left: geometry.originX * 13 * zoom, top: (project.config.rows * project.config.depth - geometry.originY - geometry.depth) * 13 * zoom, width: geometry.width * 13 * zoom, height: geometry.depth * 13 * zoom, zIndex: occupied ? (key === selectedKey ? 6000 : 2) : 0 }} key={`${x}:${y}`} type="button" disabled={busy || loading || (!isDraft && ((mode === 'inspect' && (!m || !match)) || (mode === 'select' && !m) || (mode === 'place' && Boolean(m)) || (mode === 'remove' && !m)))} onClick={() => void chooseCell(x, y)} aria-label={`${floorNameOf(floor, project.config)} X${axisNumber(x)} Y${axisNumber(y)}${isDraft ? planned ? ' 배치 예정' : ' 빈 칸' : m ? ` 모듈 ${moduleNumber(m, project?.config)}, ${moduleStatusLabel(moduleStatus(m, activeStages), activeStages)}, ${progress(m, activeStages)}%` : ' 빈 칸'}${mode === 'place' && !occupied ? ', 클릭하여 배치' : mode === 'remove' && occupied ? ', 클릭하여 제외' : ''}`} aria-pressed={occupied && (mode === 'select' ? selectedModuleKeys.has(key) : key === selectedKey)} className={[styles.cell, isDraft ? planned ? styles.planned : styles.vacant : m ? styles[moduleStatus(m, activeStages)] : styles.vacant, occupied && (mode === 'select' ? selectedModuleKeys.has(key) : key === selectedKey) ? styles.selectedCell : '', m && !match && mode === 'inspect' ? styles.dimCell : '', mode === 'place' && !occupied ? styles.placeCell : '', mode === 'remove' && occupied ? styles.removeCell : ''].join(' ')}>
                  <div className={styles.cellContent} title={m ? `${geometry.width}×${geometry.depth}m · ${moduleNumber(m, project?.config)} · ${progress(m, activeStages)}% · ${moduleStatusLabel(moduleStatus(m, activeStages), activeStages)}${openIssues(m) ? ` · 미해결 이슈 ${openIssues(m)}건` : ''}` : undefined}>{isDraft ? planned ? <><IconCube className={styles.cellCube} size={19} stroke={1.2} /><span className={styles.plannedLabel}>배치 예정 · {number(geometry.width)}×{number(geometry.depth)}m</span></> : mode === 'place' ? <IconPlus size={17} /> : <span className={styles.emptyCross}>+</span> : m ? <><div className={styles.cellHeader}><span>{moduleNumber(m, project?.config)}</span>{openIssues(m) > 0 && <IconAlertTriangle size={14} />}</div>{project.config.width * 13 * zoom >= 44 && <><IconCube className={styles.cellCube} size={19} stroke={1.2} /><b className={styles.cellPercent}>{progress(m, activeStages)}<small>%</small></b><span className={styles.cellStatus}>{moduleStatusLabel(moduleStatus(m, activeStages), activeStages)}</span><div className={styles.cellProgress}><i style={{ width: `${progress(m, activeStages)}%` }} /></div></>}</> : <span className={styles.emptyCross}>+</span>}</div>
                </button> }))}
                <ExtraPlanLayer positions={(isDraft?draftFloor:floorModules).filter(p=>layerIncludes(p,project.config,planLayer))} config={project.config} settings={project.installation3d} zoom={zoom} selectedKey={selectedKey} selectedKeys={selectedModuleKeys} stages={activeStages} draft={isDraft} matches={mode==='inspect'?matches:undefined} busy={busy||loading||mode==='place'||mode==='remove'} onSelect={selectByKey}/>
                {Array.from({ length: project.config.columns + 1 }, (_, x) => <span key={`x${x}`} className={styles.xAxis} style={{ left: `${x / project.config.columns * 100}%` }}>X{axisNumber(x)}</span>)}
                {Array.from({ length: project.config.rows + 1 }, (_, y) => (
                  <span
                    key={`y${y}`}
                    className={styles.yAxis}
                    style={{ bottom: `${y / project.config.rows * 100}%` }}
                  >
                    Y{project.config.numberingOrigin === 'top-left' ? (project.config.rows - y + 1) : axisNumber(y)}
                  </span>
                ))}
              </div>
              <span className={styles.origin} style={{ left: 41 - (bounds?.x0 ?? 0) * 13 * zoom, top: 42 + (bounds?.y1 ?? project.config.rows * project.config.depth) * 13 * zoom + 27 }}>
                {project.config.numberingOrigin === 'top-left' ? <IconArrowDownRight size={14} /> : <IconArrowUpRight size={14} />}
                {' '}번호 기준: {project.config.numberingOrigin === 'top-left' ? '좌상단 시작' : '좌하단 시작'} ({project.config.numberingOrder === 'row-col' ? '세로00가로00' : '가로00세로00'})
              </span>
            </div>
            {isDraft && !draftFloor.length && <div className={styles.gridEmpty}><IconCube size={26} stroke={1.3} /><b>이 층에는 배치 초안이 없습니다</b><span>그리드 칸을 클릭하면 즉시 저장됩니다.</span><button className={styles.primaryButton} onClick={() => setMode('place')}><IconPlus size={15} />배치 시작</button></div>}
          </div>
          {isDraft ? <div className={styles.legend}><span><i className={styles.plannedLegend} />배치 초안</span><span><IconCheck size={13} />저장됨 · 확정 전에는 번호와 제작 이력이 없습니다</span></div> : <div className={styles.legend}>{(['empty', 'working', 'ready', 'shipped'] as const).filter(s => s !== 'shipped' || activeStages.some(stage => stage.id === 'shipping')).map(s => <span key={s}><i className={styles[s]} />{moduleStatusLabel(s, activeStages)}</span>)}<span><IconAlertTriangle size={13} color="#b67a1c" />이슈</span></div>}
          {(isDraft || mode === 'place' || mode === 'remove') && <label className={styles.planModulePicker}>배치 위치<select aria-label="배치 위치 선택" value="" disabled={busy || loading} onChange={e => { if (e.target.value) { const [x,y] = e.target.value.split(':').map(Number); void chooseCell(x,y) } }}><option value="">가려진 좌표도 목록에서 선택</option>{Array.from({ length: project.config.rows }, (_, y) => Array.from({ length: project.config.columns }, (_, x) => { const key = moduleKey(floor,x,y); const occupied = isDraft ? draftIndexed.has(key) : indexed.has(key); return <option key={key} value={`${x}:${y}`} disabled={mode === 'remove' ? !occupied : !isDraft && mode === 'place' ? occupied : false}>X{axisNumber(x)} Y{axisNumber(y)} · {occupied ? isDraft ? '배치 예정' : '배치됨' : '빈 칸'}</option> }))}</select></label>}
          {!isDraft && mode !== 'place' && mode !== 'remove' && <label className={styles.planModulePicker}>모듈 선택<select aria-label="평면 모듈 선택" value={selected?.floor === floor ? selected.key : ''} disabled={busy || loading} onChange={e => { selectByKey(e.target.value) }}><option value="">가려진 모듈도 목록에서 선택</option>{floorModules.map(m=><option key={m.key} value={m.key}>{moduleNumber(m,project.config)}</option>)}</select></label>}
          {isDraft && <label className={styles.planModulePicker}>초안 모듈 선택<select aria-label="초안 모듈 선택" value={selectedDraft?.floor===floor?positionKeyOf(selectedDraft):''} disabled={busy||loading} onChange={e=>selectByKey(e.target.value)}><option value="">모듈을 선택하세요</option>{draftFloor.filter(p=>layerIncludes(p,project.config,planLayer)).map(p=><option key={positionKeyOf(p)} value={positionKeyOf(p)}>{moduleKindLabel(p,project.config)} · X{axisNumber(p.x)} Y{axisNumber(p.y)}</option>)}</select></label>}
          {!isDraft&&<ExtraRecoveryPicker modules={project.modules.filter(m=>m.floor===floor&&isExtraKey(m.key)&&!m.active)} config={project.config} busy={busy||loading} onRestore={key=>void changeExtraState(key,true)}/>}
          <div className={styles.planFoot}><span>{isDraft ? mode === 'remove' ? '배치된 칸을 클릭해 초안에서 제외하세요.' : '빈 칸을 클릭해 배치하고, 배치된 칸을 선택해 치수를 설정하세요.' : filtering ? `${floorModules.length}개 중 ${filteredCount}개 표시` : mode === 'select' ? '모듈을 클릭해 선택하거나 해제하세요.' : '모듈을 클릭하면 우측에 제작 정보가 표시됩니다.'}</span></div>
        </section>}
        {isDraft ? (
          <DraftModuleDetail key={project.id} position={selectedDraft} config={project.config} generalHeight={moduleHeightOf(project.installation3d)} count={draftLayout.length} busy={busy || loading} onRemove={()=>selectedKey&&void changeExtraState(selectedKey,false)} onSave={(dimensions,baseZ) => selectedKey ? command({ type: 'module-dimensions', key: selectedKey, dimensions, baseZ }) : Promise.resolve(false)} onDirtyChange={value => { dirty.current = value; geometryDirty.current = value }} />
        ) : selectedModules.length > 1 || (mode === 'select' && !selected && selectedModules.length === 0) ? (
          <BulkPlanEditor
            key={`${project.id}-${project.revision}-${[...selectedModuleKeys].sort().join(',')}`}
            config={project.config}
            modules={selectedModules}
            stages={activeStages}
            installationActive={activeStages.some(stage => stage.id === 'installation')}
            phase={phase === 'draft' ? 'planning' : phase}
            busy={busy || loading}
            initialTab={detailTab === 'plan' ? 'plan' : 'stages'}
            onTabChange={tab => setDetailTab(tab)}
            onCommand={commandWithResult}
            onDirtyChange={v => { dirty.current = v }}
          />
        ) : (
          <ModuleDetail
            key={`${project.id}-${phase}-${(selected || selectedModules[0])?.key ?? 'none'}`}
            module={selected || (selectedModules.length === 1 ? selectedModules[0] : null)}
            onRemove={()=>{const key=selectedKey??(selectedModules.length===1?selectedModules[0].key:null);if(key)void changeExtraState(key,false)}}
            generalHeight={moduleHeightOf(project.installation3d)}
            onGeometryDirty={value=>{geometryDirty.current=value}}
            config={project.config}
            phase={phase}
            baselinePlanAt={project.baselinePlanAt}
            stages={activeStages}
            workflowStages={workflowStages}
            baselineWorkflowStages={baselineWorkflowStages}
            busy={busy || loading}
            currentTab={detailTab}
            onTabChange={tab => setDetailTab(tab)}
            onCommand={commandWithResult}
            onDirtyChange={v => { dirty.current = v }}
          />
        )}
      </div>
    </>}
    {showExtra&&project&&<ExtraPlacementDialog config={project.config} generalHeight={moduleHeightOf(project.installation3d)} floor={floor} selected={isDraft?selectedDraft:selected} draft={isDraft} busy={busy||loading} error={error} onAdd={async value=>{pendingExtraKeys.current=new Set((isDraft?draftLayout:project.modules).map(positionKeyOf));const ok=await command(value);if(!ok)pendingExtraKeys.current=null;return ok}} onClose={()=>setShowExtra(false)}/>}
    {(dialog === 'create' || dialog === 'settings') && <SettingsDialog key={`${project?.id || 'new'}-${project?.revision || 0}-${dialog}`} initial={project ? project.config : { ...DEFAULT_CONFIG, name: sconProject?.name || '' }} defaultProjectName={sconProject?.name} editing={Boolean(project)} busy={busy} error={error} onSave={saveConfig} onClose={() => setDialog(null)} />}
    {dialog === 'recovery' && (
      <StorageRecoveryDialog
        onClose={() => setDialog(null)}
        onOpenServer={async id => {
          setDialog(null)
          resetView()
          if (sconProject?.name) {
            try { localStorage.setItem(`modular_selected_project_id_${sconProject.name}`, id) } catch {}
          }
          await loadProject(id)
          await loadList()
        }}
        onProjectDeleted={async deletedId => {
          if (project?.id === deletedId) {
            setProject(null)
            if (sconProject?.name) {
              try { localStorage.removeItem(`modular_selected_project_id_${sconProject.name}`) } catch {}
            }
          }
          await loadList()
        }}
      />
    )}
    {dialog === 'workflow' && project && <WorkflowSettingsDialog key={project.id} initialStages={workflowStages} baselineStages={baselineWorkflowStages} revisions={project.workflowHistory ?? []} phase={phase} baselinePlanAt={project.baselinePlanAt} busy={busy} onSave={(stages, reason) => command({ type: 'workflow', stages, reason })} onClose={() => setDialog(null)} />}
    {dialog === 'report' && project && <ReportDialog key={project.id} project={project} busy={busy} onSaveColors={colors => command({ type: 'stage-colors', colors })} onClose={() => setDialog(null)} />}
    {confirmState && <ActionConfirmDialog {...confirmState} onClose={() => setConfirmState(null)} />}
  </div>
}
