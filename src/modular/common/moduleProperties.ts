import type {LayoutPosition,ModulePropertyPatch} from './model'

/** Sparse bulk patch: absent means keep, null means inherit, a value means override. */
export function patchModuleProperties<T extends LayoutPosition>(position:T,patch:ModulePropertyPatch):T{
 const next={...position},dimensions={...position.dimensions}
 for(const key of ['width','depth','height','anchor'] as const){
  if(!(key in patch))continue
  if(patch[key]===null)delete dimensions[key]
  else (dimensions as Record<string,unknown>)[key]=patch[key]
 }
 if(Object.keys(dimensions).length)next.dimensions=dimensions;else delete next.dimensions
 if('baseZ' in patch){if(patch.baseZ===null)delete next.baseZ;else next.baseZ=patch.baseZ}
 if(patch.moduleType!==undefined)next.moduleType=patch.moduleType
 return next
}
export const propertySignature=(p:LayoutPosition)=>JSON.stringify([p.moduleType,p.baseZ,p.dimensions?.width,p.dimensions?.depth,p.dimensions?.height,p.dimensions?.anchor??'bottom-left'])
