import type { createSceneMath, Camera, InstallationModule, InstallationScene, FloorScope } from '../features/installation3d/scene'

interface ReportStage { id: string; label: string; color: string }
interface ReportModule {
  number: string; floor: number; x: number; y: number
  kind?: 'normal'|'roof'|'penthouse'|'special'
  geometry: {width:number;depth:number;height:number;originX:number;originY:number;baseZ:number}
  completed: Record<string, string>; planned: Record<string, string>
  installation: { actualDate: string; plannedDate: string }
}
interface Environment {
  data: {
    name: string; config: Omit<InstallationScene, 'modules' | 'name'>; asOf: string; moduleHeight: number
    floorLabels: Record<number,string>; stages: ReportStage[]; installationStage: ReportStage; modules: ReportModule[]
  }
  selected: () => string
  select: (number: string) => void
  setStage: (id: string) => void
  render: () => void
}

/** Compact, installation-only locator embedded in the offline report plan. */
export function bootReportMini3D(math: ReturnType<typeof createSceneMath>, env: Environment) {
  const data = env.data
  const root = document.getElementById('plan-mini-3d') as HTMLElement
  const canvas = document.getElementById('plan-mini-canvas') as HTMLCanvasElement
  let camera: Camera = { ...math.INITIAL_CAMERA }, pending = 0
  let gesture: { id: number; x: number; y: number; camera: Camera } | null = null
  const entries = data.modules.map(m => ({ key: m.number, number: m.number, ...m.geometry, floor: m.floor, x: m.x, y: m.y, actualDate: m.installation.actualDate, plannedDate: m.installation.plannedDate }))
  const scene: InstallationScene = { ...data.config, name: data.name, modules: entries }
  function render() {
    root.hidden = document.body.dataset.view === '3d'
    if (root.hidden) return
    const selected = env.selected()
    root.dataset.selectedNumber = selected
    const picked = data.modules.find(m => m.number === selected)
    canvas.setAttribute('aria-label', `생성일 ${data.asOf} 기준 전체 층 설치 현황. 공정 필터와 무관합니다.${picked ? ` 선택 ${picked.number} · ${data.floorLabels[picked.floor]}.` : ''} 드래그 또는 오른쪽 아래 버튼으로 회전하세요.`)
    const width = canvas.clientWidth, height = canvas.clientHeight, ctx = canvas.getContext('2d')
    if (!ctx || width < 1 || height < 1) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
    const frame = math.sceneFrame(scene, entries, data.moduleHeight, camera)
    const scale = Math.max(.001, Math.min((width - 30) / frame.width, (height - 28) / frame.height))
    const faces = math.boxFaces(scene, entries, data.moduleHeight, camera, data.asOf, data.asOf, true)
    const buffer = math.rasterFaces(faces, canvas.width, canvas.height, p => ({ x: ((p.x - frame.centerX) * scale + width / 2) * dpr, y: ((p.y - frame.centerY) * scale + height / 2) * dpr, depth: p.depth }), true)
    math.paintFaces(ctx, faces, buffer, selected, face => face.installed ? ({ top: '#60a5fa', x: '#1d4ed8', y: '#155dfc' }[face.side]) : ({ top: '#f1f5f9', x: '#dce3eb', y: '#e5eaf1' }[face.side]), true)
  }
  function schedule() {
    if (pending) cancelAnimationFrame(pending)
    pending = requestAnimationFrame(() => { pending = 0; render() })
  }
  document.getElementById('plan-mini-left')!.onclick = () => { camera.yaw -= .4; render() }
  document.getElementById('plan-mini-right')!.onclick = () => { camera.yaw += .4; render() }
  document.getElementById('plan-mini-reset')!.onclick = () => { camera = { ...math.INITIAL_CAMERA }; render() }
  canvas.onpointerdown = event => { if (event.button !== 0 || gesture) return; canvas.setPointerCapture(event.pointerId); gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, camera: { ...camera } } }
  canvas.onpointermove = event => {
    if (!gesture || gesture.id !== event.pointerId) return
    camera = { yaw: gesture.camera.yaw + (event.clientX - gesture.x) * .012, elevation: Math.max(.12, Math.min(1.4, gesture.camera.elevation + (event.clientY - gesture.y) * .008)) }
    schedule()
  }
  canvas.onpointerup = canvas.onpointercancel = event => { gesture = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId) }
  canvas.onlostpointercapture = () => { gesture = null }
  new ResizeObserver(schedule).observe(root)
  window.addEventListener('afterprint', schedule)
  root.hidden = false
  render()
  return { render }
}

/** Serialized into the single HTML. Use only arguments, local functions and browser builtins. */
export function bootReport3D(math: ReturnType<typeof createSceneMath>, env: Environment) {
  const data = env.data
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
  const canvas = element<HTMLCanvasElement>('three-canvas')
  const scope = element<HTMLSelectElement>('three-scope')
  const dateInput = element<HTMLInputElement>('three-date')
  const onlyCompleted = element<HTMLInputElement>('three-only-completed')
  const selector = element<HTMLSelectElement>('three-selection')
  let active = false, zoom = 1, camera: Camera = { ...math.INITIAL_CAMERA }, pan = { x: 0, y: 0 }, moving = false
  let hitBuffer: {faces: ReturnType<typeof math.boxFaces>; buffer: ReturnType<typeof math.rasterFaces>; dpr:number} | null = null
  let gesture: { id: number; x: number; y: number; moved: boolean; camera: Camera; pan: typeof pan } | null = null
  let pending = 0, listSignature = ''
  scope.value = 'all'; dateInput.value = data.asOf; dateInput.max = data.asOf; onlyCompleted.checked = false
  const create = (tag: string, text: string) => { const item = document.createElement(tag); item.textContent = text; return item }
  const stageOf = () => data.stages.find(s => s.id === element<HTMLSelectElement>('stage').value) || (element<HTMLSelectElement>('stage').value === 'installation' ? data.installationStage : undefined)
  const asOf = () => math.validDate(dateInput.value) && dateInput.value <= data.asOf ? dateInput.value : data.asOf
  const floorLabel = () => { const name=data.floorLabels[Number(element<HTMLSelectElement>('floor').value)]; return scope.value === 'all' ? '전체 층' : scope.value === 'single' ? name : `1층–${name}` }
  const doneAt = (module: ReportModule, date: string) => data.stages.filter(s => module.completed[s.id] && module.completed[s.id] <= date)
  const shade = (hex: string, amount: number) => '#' + [1, 3, 5].map(i => {
    const n = parseInt(hex.slice(i, i + 2), 16)
    return Math.round(amount >= 0 ? n + (255 - n) * amount : n * (1 + amount)).toString(16).padStart(2, '0')
  }).join('')
  function schedule() {
    if (pending) cancelAnimationFrame(pending)
    pending = requestAnimationFrame(() => { pending = 0; render() })
  }
  function render() {
    if (!active) return
    element('three-hint').textContent = '드래그: 회전 · ＋/−: 확대·축소'
    const stage = stageOf(), date = asOf(), floor = Number(element<HTMLSelectElement>('floor').value)
    const layer=element<HTMLSelectElement>('layer').value
    const modules = data.modules.filter(m => (scope.value === 'all' || (scope.value === 'single' ? m.floor === floor : m.floor <= floor)) && (layer==='all'||(layer==='normal'?m.kind==='normal':m.kind!=='normal')))
    const colors = new Map<string, string>()
    const entries = modules.map(module => {
      const latest = doneAt(module, date).at(-1)
      colors.set(module.number, stage?.color || latest?.color || '#155DFC')
      return {
        key: module.number, number: module.number, ...module.geometry, floor: module.floor, x: module.x, y: module.y,
        plannedDate: stage?.id === 'installation' ? module.installation.plannedDate : stage ? module.planned[stage.id] || '' : '',
        actualDate: stage?.id === 'installation' ? module.installation.actualDate : stage ? module.completed[stage.id] || '' : latest ? module.completed[latest.id] : '',
      }
    })
    const completed = entries.filter(m => math.installedAt(m, date, data.asOf)).length
    const visible = entries.filter(m => !onlyCompleted.checked || math.installedAt(m, date, data.asOf))
    const scene: InstallationScene = { ...data.config, name: data.name, modules: entries }
    const frame = math.sceneFrame(scene, entries, data.moduleHeight, camera)
    const faces = math.boxFaces(scene, visible, data.moduleHeight, camera, date, data.asOf,true)
    const width = canvas.clientWidth, height = canvas.clientHeight, ctx = canvas.getContext('2d')
    element('floor-title').textContent = `3D 현황 · ${floorLabel()}`
    element('floor-summary').textContent = `${stage?.label || '전체 공정 / 진행 현황'} · ${date} 기준 · 일반층 기본 ${data.moduleHeight}m · RF 기본 1m · 개별 치수 우선`
    element('three-caption').textContent = `${floorLabel()} · ${stage?.label || '전체 공정 / 진행 현황'} · ${date} 기준 · 일반층 기본 ${data.moduleHeight}m · RF 기본 1m · 개별 치수 우선`
    element('selection-summary').textContent = `${completed} / ${entries.length}개 ${stage ? '완료' : '공정 진행'}`
    element('three-count').textContent = `표시 ${visible.length}개 · 기준일 완료 ${completed}개`
    const legend = element('legend'), swatch = create('span', '')
    swatch.className = 'swatch'; swatch.style.background = stage?.color || '#155DFC'
    legend.replaceChildren(swatch, create('span', `${stage?.label || '완료 공정'} 색상 · 미완료는 반투명 박스`))
    element('zoom-label').textContent = `${Math.round(zoom * 100)}%`
    element<HTMLButtonElement>('zoom-out').disabled = zoom <= 0.4
    element<HTMLButtonElement>('zoom-in').disabled = zoom >= 4
    element('three-empty').hidden = visible.length > 0
    element('three-empty').textContent = entries.length ? '이 기준일까지 완료된 모듈이 없습니다.' : '선택한 층에는 배치된 모듈이 없습니다.'
    const signature = visible.map(m => m.number).join('|') + ':' + date + ':' + (stage?.id || '')
    if (signature !== listSignature) {
      listSignature = signature
      const placeholder = create('option', '박스 클릭 또는 모듈 선택') as HTMLOptionElement; placeholder.value = ''
      selector.replaceChildren(placeholder)
      const fragment = document.createDocumentFragment()
      visible.forEach(m => { const option = create('option', `${m.number} · ${math.installedAt(m, date, data.asOf) ? '완료' : '기준일 미완료'}`) as HTMLOptionElement; option.value = m.number; fragment.append(option) })
      selector.append(fragment)
    }
    selector.value = visible.some(m => m.number === env.selected()) ? env.selected() : ''
    if (!ctx || width < 1 || height < 1) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.scale(dpr, dpr)
    const scale = Math.max(0.01, Math.min((width - 64) / frame.width, (height - 110) / frame.height)) * zoom
    const screen = (p: { x: number; y: number }) => ({ x: (p.x - frame.centerX) * scale + width / 2 + pan.x, y: (p.y - frame.centerY) * scale + height / 2 + pan.y })
    const path = (points: Array<{ x: number; y: number }>) => { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath() }
    const ground: Array<[number, number, number]> = [[frame.x0, frame.y0, frame.z0], [frame.x1, frame.y0, frame.z0], [frame.x1, frame.y1, frame.z0], [frame.x0, frame.y1, frame.z0]]
    path(ground.map(p => screen(math.projectPoint(p, camera)))); ctx.fillStyle = '#eef2f7'; ctx.fill(); ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.stroke()
    const buffer=math.rasterFaces(faces,canvas.width,canvas.height,p=>({...screen(p),x:screen(p).x*dpr,y:screen(p).y*dpr,depth:p.depth}),true)
    math.paintFaces(ctx,faces,buffer,env.selected(),face=>face.installed ? shade(colors.get(face.module.number)||'#155DFC',face.side==='top'?.25:face.side==='x'?-.16:0) : ({top:'#f1f5f9',x:'#dce3eb',y:'#e5eaf1'}[face.side]))
    hitBuffer={faces,buffer,dpr}
    ctx.font = '11px sans-serif'; ctx.lineWidth = 1.7
    for (const [label, vector, color] of [['X', [1, 0, 0], '#155dfc'], ['Y', [0, 1, 0], '#64748b'], ['Z', [0, 0, 1], '#8b5cf6']] as const) {
      const p = math.projectPoint([...vector], camera), x = 38 + p.x * 23, y = height - 35 + p.y * 23
      ctx.beginPath(); ctx.moveTo(38, height - 35); ctx.lineTo(x, y); ctx.strokeStyle = color; ctx.stroke(); ctx.fillStyle = color; ctx.fillText(label, x + 4, y)
    }
  }
  function setView(next: boolean) {
    active = next; document.body.dataset.view = active ? '3d' : 'plan'
    element('plan-mini-3d').hidden = active
    element('plane-selection').hidden=active;element('plane-selection-label').hidden=active; element('viewport').hidden = active; element('report-3d-panel').hidden = !active; element('three-controls').hidden = !active
    element('view-plan').setAttribute('aria-pressed', String(!active)); element('view-3d').setAttribute('aria-pressed', String(active))
    const stageSelect = element<HTMLSelectElement>('stage')
    if (active && !data.stages.some(s => s.id === 'installation')) {
      const option = create('option', `${data.installationStage.label} · 보존 기록`) as HTMLOptionElement; option.value = 'installation'; option.id = 'three-installation-stage'; stageSelect.append(option)
    }
    if (active && !stageSelect.value) env.setStage('installation')
    if (!active) { const previousStage = stageSelect.value; element('three-installation-stage')?.remove(); if (previousStage && !data.stages.some(s => s.id === previousStage)) env.setStage('') }
    element('drawing-foot').textContent = active ? '박스 또는 목록에서 모듈 선택 · 상단 진행률과 상세 표는 보고서 생성 시점의 기록입니다.' : '좌하단 X1 / Y1 기준 · 빈 칸은 미배치 · 모듈을 선택하면 일정을 확인할 수 있습니다.'
    element('print').textContent = active ? '현재 3D 화면 인쇄 / PDF' : '현재 층 인쇄 / PDF'
  }
  function pick(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top
    return hitBuffer ? math.pickFace(hitBuffer.faces,hitBuffer.buffer,x*hitBuffer.dpr,y*hitBuffer.dpr)?.module ?? null : null
  }
  element('view-plan').onclick = () => { setView(false); env.render() }
  element('view-3d').onclick = () => { if (!active) setView(true); env.render() }
  scope.onchange = () => { pan = { x: 0, y: 0 }; zoom = 1; render() }
  dateInput.onchange = () => { dateInput.value = asOf(); render() }
  element('three-latest').onclick = () => { dateInput.value = data.asOf; render() }
  onlyCompleted.onchange = render
  selector.onchange = () => { env.select(selector.value); render() }
  element('three-left').onclick = () => { camera.yaw -= 0.35; render() }
  element('three-right').onclick = () => { camera.yaw += 0.35; render() }
  element('three-move').onclick = () => { moving = !moving; element('three-move').setAttribute('aria-pressed', String(moving)); element('three-move').textContent = moving ? '이동 모드' : '회전 모드'; canvas.style.cursor = moving ? 'move' : 'grab' }
  canvas.onpointerdown = event => { if (event.button !== 0 || gesture) return; canvas.setPointerCapture(event.pointerId); gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, camera: { ...camera }, pan: { ...pan } } }
  canvas.onpointermove = event => {
    if (!gesture) { const hit = pick(event); element('three-hint').textContent = hit ? `${hit.number} · ${math.installedAt(hit, asOf(), data.asOf) ? `완료 ${hit.actualDate}` : '기준일 미완료'}` : '드래그: 회전 · ＋/−: 확대·축소'; return }
    if (gesture.id !== event.pointerId) return
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y
    if (Math.hypot(dx, dy) > 4) gesture.moved = true
    if (!gesture.moved) return
    if (moving) pan = { x: gesture.pan.x + dx, y: gesture.pan.y + dy }
    else camera = { yaw: gesture.camera.yaw + dx * 0.008, elevation: Math.max(0.12, Math.min(1.4, gesture.camera.elevation + dy * 0.006)) }
    schedule()
  }
  canvas.onpointerup = event => {
    if (!gesture || gesture.id !== event.pointerId) return
    const moved = gesture.moved; gesture = null
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (!moved) { const hit = pick(event); if (hit) { env.select(hit.number); render() } }
  }
  canvas.onpointercancel = canvas.onlostpointercapture = () => { gesture = null }
  new ResizeObserver(() => { if (active) schedule() }).observe(element('three-viewport'))
  setView(false)
  return {
    isActive: () => active, render,
    zoom: (delta: number) => { zoom = Math.max(0.4, Math.min(4, zoom * (delta > 0 ? 1.2 : 1 / 1.2))); render() },
    fit: () => { zoom = 1; camera = { ...math.INITIAL_CAMERA }; pan = { x: 0, y: 0 }; render() },
  }
}
