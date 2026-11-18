/** Metre-based grid contract. Stored axis arrays are optional for legacy uniform grids. */
export interface GridConfig {width:number;depth:number;columns:number;rows:number;columnWidths?:number[];rowDepths?:number[]}
const rounded=(value:number)=>Math.round(value*100)/100
export function gridGeometryOf(config:GridConfig){
  const widths=Array.from({length:config.columns},(_,i)=>config.columnWidths?.[i]??config.width)
  const depths=Array.from({length:config.rows},(_,i)=>config.rowDepths?.[i]??config.depth)
  const positions=(values:number[])=>values.reduce((out,v)=>{out.push(rounded(out[out.length-1]+v));return out},[0])
  const xs=positions(widths),ys=positions(depths)
  return {widths,depths,xs,ys,width:xs[xs.length-1],depth:ys[ys.length-1]}
}

/** Display labels never participate in module identity or geometry. */
export function axisLabelsOf(config:{columns:number;rows:number;xAxisLabels?:string[];yAxisLabels?:string[]},axis:'x'|'y'){
 const count=axis==='x'?config.columns:config.rows,stored=axis==='x'?config.xAxisLabels:config.yAxisLabels
 return Array.from({length:count+1},(_,i)=>stored?.[i]??axis.toUpperCase()+(i+1))
}
export function resizeAxisLabels(stored:string[],count:number,axis:'x'|'y'){
 const out=stored.slice(0,count+1),seen=new Set(out)
 for(let i=out.length;i<=count;i++){const base=axis.toUpperCase()+(i+1);let label=base,suffix=1;while(seen.has(label))label=base+'-'+suffix++;out.push(label);seen.add(label)}return out
}
