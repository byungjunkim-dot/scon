'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { boxFaces, INITIAL_CAMERA, paintFaces, rasterFaces, sceneFrame, type Camera, type InstallationScene } from './scene'
import styles from './MiniInstallationView.module.css'

interface Props {
  scene: InstallationScene; moduleHeight: number; today: string; selectedKey: string | null
}

/** Read-only locator: selection and actual installation data belong to the existing board. */
export function MiniInstallationView({ scene, moduleHeight, today, selectedKey }: Props) {
  const [camera,setCamera]=useState<Camera>(INITIAL_CAMERA)
  const [size,setSize]=useState({width:260,height:170})
  const canvas=useRef<HTMLCanvasElement>(null),pending=useRef<number|null>(null)
  const gesture=useRef<{id:number;x:number;y:number;camera:Camera}|null>(null)
  const picked=scene.modules.find(module=>module.key===selectedKey)
  useEffect(()=>{
    const element=canvas.current?.parentElement;if(!element)return
    const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}))
    observer.observe(element)
    return()=>{observer.disconnect();gesture.current=null;if(pending.current!==null)cancelAnimationFrame(pending.current);pending.current=null}
  },[])
  useEffect(()=>{
    const element=canvas.current,ctx=element?.getContext('2d')
    if(!element||!ctx||size.width<1||size.height<1)return
    const dpr=Math.min(window.devicePixelRatio||1,2)
    element.width=Math.round(size.width*dpr);element.height=Math.round(size.height*dpr)
    const frame=sceneFrame(scene,scene.modules,moduleHeight,camera)
    const scale=Math.max(.001,Math.min((size.width-30)/frame.width,(size.height-28)/frame.height))
    const screen=(p:{x:number;y:number;depth:number})=>({x:((p.x-frame.centerX)*scale+size.width/2)*dpr,y:((p.y-frame.centerY)*scale+size.height/2)*dpr,depth:p.depth})
    const faces=boxFaces(scene,scene.modules,moduleHeight,camera,today,today,true)
    const buffer=rasterFaces(faces,element.width,element.height,screen,true)
    paintFaces(ctx,faces,buffer,selectedKey,face=>face.installed?({top:'#60a5fa',x:'#1d4ed8',y:'#155dfc'}[face.side]):({top:'#f1f5f9',x:'#dce3eb',y:'#e5eaf1'}[face.side]),true)
  },[scene,moduleHeight,today,selectedKey,camera,size])
  function move(event:PointerEvent<HTMLCanvasElement>){
    const active=gesture.current;if(!active||active.id!==event.pointerId)return
    const dx=event.clientX-active.x,dy=event.clientY-active.y
    if(pending.current!==null)cancelAnimationFrame(pending.current)
    pending.current=requestAnimationFrame(()=>{pending.current=null;setCamera({yaw:active.camera.yaw+dx*.012,elevation:Math.max(.12,Math.min(1.4,active.camera.elevation+dy*.008))})})
  }
  const release=(event:PointerEvent<HTMLCanvasElement>)=>{
    gesture.current=null
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return <section className={styles.root} aria-label="선택 위치 작은 3D" data-selected-key={picked?.key||''}>
      <div className={styles.viewport}><canvas ref={canvas} role="img" aria-label={`전체 건물 속 선택 모듈 위치.${picked?` 선택 ${picked.number}${picked.omitted?' · 설치 생략':''} · ${scene.floorLabels?.[picked.floor]||`${picked.floor}층`}.`:''} 주황색은 가려진 부분을 포함한 선택 위치입니다. 드래그 또는 오른쪽 아래 버튼으로 회전하세요.`}
        onPointerDown={event=>{if(event.button!==0||gesture.current)return;event.currentTarget.setPointerCapture(event.pointerId);gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,camera}}}
        onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={()=>{gesture.current=null}} />
        <div className={styles.controls} role="group" aria-label="작은 3D 회전 설정"><button type="button" aria-label="작은 3D 왼쪽 회전" title="왼쪽 회전" onClick={()=>setCamera(c=>({...c,yaw:c.yaw-.4}))}>↶</button><button type="button" aria-label="작은 3D 오른쪽 회전" title="오른쪽 회전" onClick={()=>setCamera(c=>({...c,yaw:c.yaw+.4}))}>↷</button><button type="button" aria-label="작은 3D 방향 초기화" title="방향 초기화" onClick={()=>setCamera(INITIAL_CAMERA)}>⌂</button></div>
      </div>
  </section>
}
