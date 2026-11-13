/** Portable, read-only 3D projection. All coordinates and dimensions are metres. */
export interface InstallationModule {
  key: string; number: string; floor: number; x: number; y: number
  kind?: 'normal'|'roof'|'penthouse'|'special'
  width?: number; depth?: number; height?: number; originX?: number; originY?: number; baseZ?: number
  plannedDate: string; actualDate: string
  omitted?: boolean
}
export interface InstallationScene {
  name: string; width: number; depth: number; columns: number; rows: number; floors: number
  floorLabels?: Record<number, string>
  modules: InstallationModule[]
}
export type FloorScope = 'all' | 'single' | 'below'
export interface SceneFilter { scope: FloorScope; floor: number; asOf: string; today: string; installedOnly: boolean }
export interface Camera { yaw: number; elevation: number }
export type Point3 = [number, number, number]
export interface Point2 { x: number; y: number; depth: number }
export interface BoxFace { key: string; module: InstallationModule; installed: boolean; side: 'top' | 'x' | 'y'; points: Point2[]; depth: number; edges?: Array<[Point2, Point2]> }
/** Self-contained factory: also embedded verbatim in offline reports. No module captures. */
export function createSceneMath() {
const INITIAL_CAMERA: Camera = { yaw: -0.65, elevation: 0.52 }
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const installedAt = (module: InstallationModule, asOf: string, today: string) => !module.omitted && validDate(module.actualDate) && validDate(asOf) && validDate(today) && asOf <= today && module.actualDate <= asOf
function floorModules(scene: InstallationScene, filter: SceneFilter) {
  return scene.modules.filter(m => filter.scope === 'all' || (filter.scope === 'single' ? m.floor === filter.floor : m.floor <= filter.floor))
}
function projectPoint([x, y, z]: Point3, camera: Camera): Point2 {
  const c = Math.cos(camera.yaw), s = Math.sin(camera.yaw), ce = Math.cos(camera.elevation), se = Math.sin(camera.elevation)
  // World +Y is plan-up. Screen +Y is down: at yaw=0 a top view is (x,-y).
  // Keep screen axes, near depth and visible face normals in the same handedness.
  const back = s * x - c * y
  return { x: c * x + s * y, y: se * back - ce * z, depth: ce * back + se * z }
}
function boxFaces(scene: InstallationScene, modules: InstallationModule[], height: number, camera: Camera, asOf: string, today: string, wireframe = false): BoxFace[] {
  const faces: BoxFace[] = []
  const sx = Math.sin(camera.yaw), sy = -Math.cos(camera.yaw)
  for (const module of modules) {
    const installed = installedAt(module, asOf, today)
    const x0 = module.originX ?? module.x * scene.width, x1 = x0 + (module.width ?? scene.width)
    const y0 = module.originY ?? module.y * scene.depth, y1 = y0 + (module.depth ?? scene.depth)
    const z0 = module.baseZ ?? (module.floor - 1) * height, z1 = z0 + (module.height ?? height)
    const corners: Point3[] = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]
    const edges: Array<[Point2,Point2]> | undefined = wireframe ? [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].map(([a,b]) => [projectPoint(corners[a],camera),projectPoint(corners[b],camera)]) : undefined
    const x = sx >= 0 ? x1 : x0, y = sy >= 0 ? y1 : y0
    const definitions: Array<[BoxFace['side'], Point3[]]> = [
      ['top', [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]],
    ]
    if (Math.abs(sx) > 0.0001) definitions.push(['x', [[x,y0,z0],[x,y1,z0],[x,y1,z1],[x,y0,z1]]])
    if (Math.abs(sy) > 0.0001) definitions.push(['y', [[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]]])
    for (const [side, vertices] of definitions) {
      const points = vertices.map(p => projectPoint(p, camera))
      faces.push({ key: `${module.key}:${side}`, module, side, points, installed, depth: points.reduce((sum, p) => sum + p.depth, 0) / points.length, ...(side === 'top' && edges ? {edges} : {}) })
    }
  }
  // Far faces first. A deterministic tie-break prevents flicker at cardinal directions.
  return faces.sort((a,b) => a.depth - b.depth || a.key.localeCompare(b.key))
}
function sceneFrame(scene: InstallationScene, modules: InstallationModule[], height: number, camera: Camera) {
  const xs = modules.flatMap(m => [m.originX ?? m.x * scene.width, (m.originX ?? m.x * scene.width) + (m.width ?? scene.width)])
  const ys = modules.flatMap(m => [m.originY ?? m.y * scene.depth, (m.originY ?? m.y * scene.depth) + (m.depth ?? scene.depth)])
  const zs = modules.flatMap(m => [m.baseZ ?? (m.floor - 1) * height, (m.baseZ ?? (m.floor - 1) * height) + (m.height ?? height)])
  const x0 = xs.length ? Math.min(...xs) : 0, x1 = xs.length ? Math.max(...xs) : scene.width
  const y0 = ys.length ? Math.min(...ys) : 0, y1 = ys.length ? Math.max(...ys) : scene.depth
  const z0 = zs.length ? Math.min(...zs) : 0, z1 = zs.length ? Math.max(...zs) : height
  const corners = [x0,x1].flatMap(x => [y0,y1].flatMap(y => [z0,z1].map(z => projectPoint([x,y,z], camera))))
  const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x))
  const minY = Math.min(...corners.map(p => p.y)), maxY = Math.max(...corners.map(p => p.y))
  return { centerX: (minX+maxX)/2, centerY: (minY+maxY)/2, width: Math.max(maxX-minX,1), height: Math.max(maxY-minY,1), x0,x1,y0,y1,z0 }
}

/** Exact orthographic visibility for unequal and overlapping boxes. Larger depth is nearer. */
function rasterFaces(faces: BoxFace[], width: number, height: number, screen: (p: Point2) => Point2, transparent = false) {
  width = Math.max(1, Math.round(width)); height = Math.max(1, Math.round(height))
  const ids = new Int32Array(width * height); ids.fill(-1)
  const depths = new Float64Array(width * height); depths.fill(-Infinity)
  const solidIds = transparent ? new Int32Array(width * height) : null; solidIds?.fill(-1)
  const solidDepths = transparent ? new Float64Array(width * height) : null; solidDepths?.fill(-Infinity)
  const wires: Array<Array<[Point2,Point2]> | undefined> = []
  faces.forEach((face, id) => {
    const p = face.points.map(screen)
    if (transparent && face.edges) wires[id] = face.edges.map(([a,b]) => [screen(a),screen(b)])
    for (const indices of [[0,1,2],[0,2,3]]) {
      const [a,b,c] = indices.map(i => p[i])
      const den = (b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y)
      if (Math.abs(den) < 1e-10) continue
      const minX = Math.max(0, Math.floor(Math.min(a.x,b.x,c.x))), maxX = Math.min(width-1, Math.ceil(Math.max(a.x,b.x,c.x)))
      const minY = Math.max(0, Math.floor(Math.min(a.y,b.y,c.y))), maxY = Math.min(height-1, Math.ceil(Math.max(a.y,b.y,c.y)))
      for (let y=minY; y<=maxY; y++) for (let x=minX; x<=maxX; x++) {
        const u = ((b.y-c.y)*(x+.5-c.x)+(c.x-b.x)*(y+.5-c.y))/den
        const v = ((c.y-a.y)*(x+.5-c.x)+(a.x-c.x)*(y+.5-c.y))/den, w=1-u-v
        if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue
        const z=u*a.depth+v*b.depth+w*c.depth, i=y*width+x
        if (z >= depths[i]-1e-9) { depths[i]=z; ids[i]=id }
        if (face.installed && solidDepths && solidIds && z >= solidDepths[i]-1e-9) { solidDepths[i]=z;solidIds[i]=id }
      }
    }
  })
  return { ids, depths, width, height, solidIds, solidDepths, wires }
}
/** Bounded line rasterization; a mask stores coverage once, never per-layer alpha. */
function wireMask(edges: Array<[Point2,Point2]>, mask: Uint8Array, width: number, height: number, solidDepths: Float64Array | null, radius = 0) {
  for (const [a,b] of edges) {
    const dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1,visible=true
    for (const [p,q] of [[-dx,a.x],[dx,width-1-a.x],[-dy,a.y],[dy,height-1-a.y]]) {
      if (Math.abs(p)<1e-10) { if(q<0){visible=false;break} }
      else { const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi){visible=false;break} }
    }
    if(!visible)continue
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))*(hi-lo)))
    for(let n=0;n<=steps;n++){
      const t=lo+(hi-lo)*n/steps,x=Math.round(a.x+dx*t),y=Math.round(a.y+dy*t),depth=a.depth+(b.depth-a.depth)*t
      for(let oy=-radius;oy<=radius;oy++)for(let ox=-radius;ox<=radius;ox++){
        const px=x+ox,py=y+oy;if(px<0||py<0||px>=width||py>=height)continue
        const i=py*width+px;if(!solidDepths||depth>=solidDepths[i]-1e-5)mask[i]=1
      }
    }
  }
}
function paintFaces(ctx: CanvasRenderingContext2D, faces: BoxFace[], buffer: ReturnType<typeof rasterFaces>, selected: string | null, color: (face: BoxFace) => string, xraySelection = false) {
  const { width, height, ids } = buffer, image = ctx.getImageData(0,0,width,height)
  const colors = faces.map(face => { const hex=color(face); return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)) })
  if(buffer.solidIds && buffer.solidDepths){
    const solid=buffer.solidIds,ghostEdges=new Uint8Array(width*height),selectedEdges=xraySelection&&selected?new Uint8Array(width*height):null
    faces.forEach((face,id)=>{
      const edges=buffer.wires[id];if(!edges)return
      if(!face.installed)wireMask(edges,ghostEdges,width,height,buffer.solidDepths)
      if(selectedEdges&&face.module.key===selected)wireMask(edges,selectedEdges,width,height,null,1)
    })
    const blend=(j:number,c:number[],alpha:number)=>{
      const a=image.data[j+3]/255,out=alpha+a*(1-alpha)
      for(let k=0;k<3;k++)image.data[j+k]=(c[k]*alpha+image.data[j+k]*a*(1-alpha))/out
      image.data[j+3]=out*255
    }
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x,j=i*4,id=ids[i],solidId=solid[i]
      if(solidId>=0){
        const edge=(x>0?solid[i-1]:-1)!==solidId||(x<width-1?solid[i+1]:-1)!==solidId||(y>0?solid[i-width]:-1)!==solidId||(y<height-1?solid[i+width]:-1)!==solidId
        const c=edge?(faces[solidId].module.key===selected?[245,158,11]:[203,213,225]):colors[solidId]
        for(let k=0;k<3;k++)image.data[j+k]=c[k];image.data[j+3]=255
      }
      if(id>=0&&!faces[id].installed)blend(j,colors[id],0.12)
      if(ghostEdges[i])blend(j,[100,116,139],0.24)
      // A selected planned face keeps its normal visible outline in the main view.
      if(id>=0&&!faces[id].installed&&faces[id].module.key===selected){
        const edge=(x>0?ids[i-1]:-1)!==id||(x<width-1?ids[i+1]:-1)!==id||(y>0?ids[i-width]:-1)!==id||(y<height-1?ids[i+width]:-1)!==id
        if(edge)blend(j,[245,158,11],0.95)
      }
      if(selectedEdges?.[i])blend(j,[245,158,11],1)
    }
    ctx.putImageData(image,0,0);return
  }
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
    const i=y*width+x, id=ids[i]; if(id<0) continue
    const face=faces[id], neighbors=[x>0?ids[i-1]:-1,x<width-1?ids[i+1]:-1,y>0?ids[i-width]:-1,y<height-1?ids[i+width]:-1]
    const edge=neighbors.some(n=>n!==id), picked=face.module.key===selected
    const c=edge ? (picked ? [245,158,11] : face.installed ? [203,213,225] : [148,163,184]) : colors[id]
    const j=i*4; image.data[j]=c[0];image.data[j+1]=c[1];image.data[j+2]=c[2];image.data[j+3]=255
  }
  ctx.putImageData(image,0,0)
}
function pickFace(faces: BoxFace[], buffer: ReturnType<typeof rasterFaces>, x: number, y: number) {
  x=Math.floor(x);y=Math.floor(y)
  if(x<0||y<0||x>=buffer.width||y>=buffer.height)return null
  const i=y*buffer.width+x,solid=buffer.solidIds?.[i] ?? -1
  return faces[solid>=0?solid:buffer.ids[i]] ?? null
}

return { INITIAL_CAMERA, validDate, installedAt, floorModules, projectPoint, boxFaces, sceneFrame, rasterFaces, paintFaces, pickFace }
}

export const { INITIAL_CAMERA, validDate, installedAt, floorModules, projectPoint, boxFaces, sceneFrame, rasterFaces, paintFaces, pickFace } = createSceneMath()
