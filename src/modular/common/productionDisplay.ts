import {actualStageDateOf,applicableStagesOf,today,type ModuleRecord,type WorkflowStage} from './model'

/** Plan display only. Domain progress, statistics and installation geometry remain independent. */
export const PRODUCTION_STATES = {
 waiting:{id:'waiting',label:'제작대기',color:'#94A3B8'},
 working:{id:'working',label:'제작중',color:'#D9911B'},
 shipped:{id:'shipped',label:'출고',color:'#2563EB'},
 installed:{id:'installed',label:'설치',color:'#15915B'},
} as const
export function productionStateOf(module:Pick<ModuleRecord,'completed'|'actualInstallationDate'|'currentPlan'>,stages:readonly WorkflowStage[],asOf=today()):{id:keyof typeof PRODUCTION_STATES;label:string;color:string}{
 const applicable=applicableStagesOf(module,stages)
 const done=(id:string)=>{
  const date=actualStageDateOf(module as ModuleRecord,id)
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date.startsWith('0000-')||date>asOf||date>today())return false
  const parsed=new Date(date+'T00:00:00Z')
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date
 }
 if(!applicable.length)return {...PRODUCTION_STATES.waiting,label:'대상 공정 없음'}
 if(applicable.some(s=>s.id==='installation')&&done('installation'))return PRODUCTION_STATES.installed
 if(applicable.some(s=>s.id==='shipping')&&done('shipping'))return PRODUCTION_STATES.shipped
 return applicable.some(s=>done(s.id))?PRODUCTION_STATES.working:PRODUCTION_STATES.waiting
}
