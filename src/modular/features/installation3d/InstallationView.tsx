'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { rasterFaces, paintFaces, pickFace, boxFaces, floorModules, INITIAL_CAMERA, installedAt, projectPoint, sceneFrame, validDate, type BoxFace, type Camera, type FloorScope, type InstallationScene } from './scene'
import styles from './InstallationView.module.css'

interface Props {
  scene: InstallationScene; moduleHeight: number; today: string; floor: number
  selectedKey: string | null; busy: boolean; heightReset: number
  onSelect: (key: string) => void
  onSaveHeight: (height: number) => Promise<boolean>
  onHeightDirty: (dirty: boolean) => void
}
interface ScreenFace { face: BoxFace; points: Array<{ x: number; y: number }> }
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
function contains(points: ScreenFace['points'], x: number, y: number) {
  let inside = false
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j]
    if ((a.y>y)!==(b.y>y) && x < (b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside
  }
  return inside
}

/** Host-neutral viewer: only DTO, stable selection key and explicit callbacks. */
export function InstallationView(props: Props) {
  const { scene, moduleHeight, today, floor, selectedKey, busy, onSelect, onSaveHeight, onHeightDirty, heightReset } = props
  const [scope, setScope] = useState<FloorScope>('all')
  const [layer,setLayer]=useState('all')
  const [asOf, setAsOf] = useState(today)
  const [installedOnly, setInstalledOnly] = useState(false)
  const [camera, setCamera] = useState<Camera>(INITIAL_CAMERA)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [moveMode, setMoveMode] = useState(false)
  const [heightInput, setHeightInput] = useState(String(moduleHeight))
  const [heightError, setHeightError] = useState('')
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const hitBuffer = useRef<{ faces: BoxFace[]; buffer: ReturnType<typeof rasterFaces>; dpr: number } | null>(null)
  const gesture = useRef<{ id: number; x: number; y: number; moved: boolean; camera: Camera; pan: typeof pan } | null>(null)
  const pending = useRef<number | null>(null)
  const [size, setSize] = useState({ width: 700, height: 530 })
  useEffect(() => { setHeightInput(String(moduleHeight)); setHeightError(''); onHeightDirty(false) }, [moduleHeight, heightReset])
  useEffect(() => () => { if (pending.current !== null) cancelAnimationFrame(pending.current) }, [])
  useEffect(() => {
    const element = canvas.current?.parentElement
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { setPan({x:0,y:0}); setZoom(1) }, [scope, floor])
  const date = validDate(asOf) && asOf <= today ? asOf : today
  const scoped = useMemo(() => floorModules(scene, { scope, floor, asOf: date, today, installedOnly }).filter(m=>layer==='all'||(layer==='normal'?(m.kind??'normal')==='normal':(m.kind??'normal')!=='normal')), [scene,scope,floor,layer])
  const displayed = useMemo(() => scoped.filter(m => !installedOnly || installedAt(m,date,today)), [scoped,installedOnly,date,today])
  const installed = scoped.filter(m => installedAt(m,date,today)).length
  const frame = useMemo(() => sceneFrame(scene, scoped, moduleHeight, camera), [scene,scoped,moduleHeight,camera])
  const faces = useMemo(() => boxFaces(scene,displayed,moduleHeight,camera,date,today,true), [scene,displayed,moduleHeight,camera,date,today])
  const hovered = displayed.find(m => m.key === hoverKey)
  const floorName = scene.floorLabels?.[floor] || `${floor}층`
  const picked = scene.modules.find(m => m.key === selectedKey)
  const heightChanged = Number(heightInput) !== moduleHeight || heightInput.trim() === ''
  useEffect(() => {
    if (!heightChanged) return
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [heightChanged])
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d')
    if (!element || !ctx || size.width < 1 || size.height < 1) return
    const dpr = Math.min(window.devicePixelRatio || 1,2)
    element.width=Math.round(size.width*dpr); element.height=Math.round(size.height*dpr)
    ctx.scale(dpr,dpr)
    const scale=Math.max(0.01,Math.min((size.width-64)/frame.width,(size.height-100)/frame.height))*zoom
    const screen = (p: {x:number;y:number}) => ({x:(p.x-frame.centerX)*scale+size.width/2+pan.x,y:(p.y-frame.centerY)*scale+size.height/2+pan.y})
    const path = (points: ScreenFace['points']) => { ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath() }
    const ground = [[frame.x0,frame.y0,frame.z0],[frame.x1,frame.y0,frame.z0],[frame.x1,frame.y1,frame.z0],[frame.x0,frame.y1,frame.z0]] as [number,number,number][]
    path(ground.map(p => screen(projectPoint(p,camera)))); ctx.fillStyle='#eef2f7'; ctx.fill(); ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=1; ctx.stroke()
    const buffer = rasterFaces(faces, element.width, element.height, p => ({ ...screen(p), x: screen(p).x*dpr, y: screen(p).y*dpr, depth: p.depth }),true)
    paintFaces(ctx, faces, buffer, selectedKey, face => face.installed ? ({top:'#60a5fa',x:'#1d4ed8',y:'#155dfc'}[face.side]) : ({top:'#f1f5f9',x:'#dce3eb',y:'#e5eaf1'}[face.side]))
    hitBuffer.current={faces,buffer,dpr}
    // A fixed-size orientation triad remains legible at every zoom.
    ctx.font='11px sans-serif'; ctx.lineWidth=1.7
    for (const [label,vector,color] of [['X',[1,0,0],'#155dfc'],['Y',[0,1,0],'#64748b'],['Z',[0,0,1],'#8b5cf6']] as const) {
      const p=projectPoint([...vector],camera), x=38+p.x*23,y=size.height-35+p.y*23
      ctx.beginPath();ctx.moveTo(38,size.height-35);ctx.lineTo(x,y);ctx.strokeStyle=color;ctx.stroke();ctx.fillStyle=color;ctx.fillText(label,x+4,y)
    }
  }, [faces,frame,camera,size,zoom,pan,selectedKey])
  const pointAt = (event: ReactPointerEvent<HTMLCanvasElement>) => { const rect=event.currentTarget.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top} }
  const hitAt = (x:number,y:number) => { const hit=hitBuffer.current; return hit ? pickFace(hit.faces,hit.buffer,x*hit.dpr,y*hit.dpr)?.module.key ?? null : null }
  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active=gesture.current
    if (!active) { const p=pointAt(event);setHoverKey(hitAt(p.x,p.y));return }
    if (active.id!==event.pointerId) return
    const dx=event.clientX-active.x,dy=event.clientY-active.y
    if (Math.hypot(dx,dy)>4) active.moved=true
    if (!active.moved) return
    setHoverKey(null)
    if(pending.current!==null) cancelAnimationFrame(pending.current)
    pending.current=requestAnimationFrame(() => {
      pending.current=null
      if(moveMode) setPan({x:active.pan.x+dx,y:active.pan.y+dy})
      else setCamera({yaw:active.camera.yaw+dx*0.008,elevation:clamp(active.camera.elevation+dy*0.006,0.12,1.4)})
    })
  }
  function release(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active=gesture.current
    if(!active || active.id!==event.pointerId) return
    gesture.current=null
    if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if(!active.moved && !busy) { const p=pointAt(event),key=hitAt(p.x,p.y);if(key) onSelect(key) }
  }
  const reset = () => { setCamera(INITIAL_CAMERA);setZoom(1);setPan({x:0,y:0}) }
  return <section className={styles.root} aria-label="3D 설치현황">
    <div className={styles.heading}><div><span>INSTALLATION VIEW</span><h2>3D 설치현황</h2></div><b>{installed}<small> / {scoped.length}개 설치</small></b></div>
    <div className={styles.controls}>
      <label>층 표시<select aria-label="3D 층 표시" value={scope} onChange={e=>setScope(e.target.value as FloorScope)}><option value="all">전체 층</option><option value="single">선택한 {floorName}만</option><option value="below">{floorName} 이하 · 상부 숨김</option></select></label>
      <label>모듈 종류<select aria-label="3D 모듈 종류" value={layer} onChange={e=>setLayer(e.target.value)}><option value="all">전체 모듈</option><option value="normal">일반 모듈</option><option value="extra">지붕·옥탑·특수</option></select></label>
      <label>설치 기준일<input aria-label="설치 기준일" type="date" max={today} value={asOf} onChange={e=>setAsOf(e.target.value)} onBlur={()=> {if(!validDate(asOf)||asOf>today)setAsOf(today)}} /></label>
      <button type="button" onClick={()=>setAsOf(today)}>오늘</button>
      <label className={styles.check}><input type="checkbox" checked={installedOnly} onChange={e=>setInstalledOnly(e.target.checked)} />설치 완료만</label>
    </div>
    <form className={styles.heightForm} onSubmit={async e=>{
      e.preventDefault();const height=Number(heightInput)
      if(!heightInput.trim() || !Number.isFinite(height) || height<0.5 || height>12 || Math.abs(height*100-Math.round(height*100))>1e-8) {setHeightError('높이는 0.5~12m, 소수 둘째 자리까지 입력해 주세요.');return}
      setHeightError('');if(await onSaveHeight(height))onHeightDirty(false)
    }}><label>모듈 높이<input aria-label="모듈 높이(m)" type="number" min="0.5" max="12" step="0.01" required value={heightInput} disabled={busy} onChange={e=>{setHeightInput(e.target.value);onHeightDirty(Number(e.target.value)!==moduleHeight || !e.target.value.trim())}} /><span>m</span></label><button disabled={busy||!heightChanged}>높이 저장</button><button type="button" disabled={busy||!heightChanged} onClick={()=>{setHeightInput(String(moduleHeight));setHeightError('');onHeightDirty(false)}}>입력 취소</button><small>저장된 높이 {moduleHeight}m · 일반층 기본 · RF 기본 1m · 개별 치수 우선</small>{heightError&&<span role="alert">{heightError}</span>}</form>
    <div className={styles.tools}>
      <button type="button" aria-pressed={moveMode} onClick={()=>setMoveMode(v=>!v)}>{moveMode?'이동 모드':'회전 모드'}</button>
      <button type="button" aria-label="3D 왼쪽 회전" onClick={()=>setCamera(c=>({...c,yaw:c.yaw-0.35}))}>↶</button><button type="button" aria-label="3D 오른쪽 회전" onClick={()=>setCamera(c=>({...c,yaw:c.yaw+0.35}))}>↷</button>
      <button type="button" aria-label="3D 축소" disabled={zoom<=0.4} onClick={()=>setZoom(z=>clamp(z/1.2,0.4,4))}>−</button><span>{Math.round(zoom*100)}%</span><button type="button" aria-label="3D 확대" disabled={zoom>=4} onClick={()=>setZoom(z=>clamp(z*1.2,0.4,4))}>＋</button>
      <button type="button" onClick={reset}>화면 맞춤</button>
    </div>
    <div className={styles.viewport}>
      <canvas ref={canvas} aria-label="모듈 설치 입체 배치도. 드래그로 회전하고 모듈을 클릭하세요. 키보드로는 아래 모듈 선택을 사용하세요." role="img" style={{cursor:moveMode?'move':'grab'}}
        onPointerDown={event=>{if(event.button!==0||gesture.current)return;event.currentTarget.setPointerCapture(event.pointerId);gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,camera,pan}}}
        onPointerMove={pointerMove} onPointerUp={release} onPointerCancel={()=>{gesture.current=null;if(pending.current!==null)cancelAnimationFrame(pending.current)}} onLostPointerCapture={()=>{gesture.current=null}}
        onPointerLeave={()=>setHoverKey(null)} />
      <div className={styles.caption}>{scope==='all'?'전체 층':scope==='single'?`${floorName}`:`1–${floorName}`} · {date} 기준</div>
      {!displayed.length&&<div className={styles.empty}>{scoped.length?'기준일까지 설치 완료된 모듈이 없습니다.':'이 층에는 배치된 모듈이 없습니다.'}</div>}
      {hovered&&<div className={styles.tooltip}>{hovered.number} · {installedAt(hovered,date,today)?`설치 ${hovered.actualDate}`:'기준일 미설치'}</div>}
    </div>
    <div className={styles.legend}><span><i className={styles.installed} />설치 완료</span><span><i />미설치 · 반투명</span><span><i className={styles.selected} />선택 모듈</span><small>드래그: {moveMode?'화면 이동':'회전'} · 완료 박스 우선 선택</small></div>
    <label className={styles.moduleSelect}>모듈 선택<select aria-label="3D 모듈 선택" disabled={busy||!displayed.length} value={displayed.some(m=>m.key===selectedKey)?selectedKey!:''} onChange={e=>onSelect(e.target.value)}><option value="">입체 박스 클릭 또는 목록에서 선택</option>{displayed.map(m=><option key={m.key} value={m.key}>{m.number} · {installedAt(m,date,today)?'설치 완료':'기준일 미설치'}</option>)}</select></label>
    {picked&&<p className={styles.selection}>선택 {picked.number} · 바닥 높이 {Number((picked.baseZ ?? (picked.floor-1)*moduleHeight).toFixed(2))}m · 규격 {picked.width ?? scene.width}×{picked.depth ?? scene.depth}×{picked.height ?? moduleHeight}m · 설치 예정 {picked.plannedDate||'미입력'} · 실제 설치 {picked.actualDate||'미입력'}{!displayed.some(m=>m.key===picked.key)&&' · 현재 필터에서 숨김'}</p>}
    <p className={styles.note}>현재 저장된 실제 설치일로 날짜별 모습을 표시합니다. 우측 상세는 최신 기록입니다. 과거 수정·취소 전 상태는 재현하지 않습니다.</p>
  </section>
}
