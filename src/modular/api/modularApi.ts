import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { applyCommand, createProject, DomainError, validateEnvelope, type DomainContext } from '../common/domain'
import { layoutStatusOf, managementPhaseOf, type ProjectDetail, type ProjectSummary } from '../common/model'

export class ApiError extends Error {
  constructor(public status: number, public body: string) { super(`Request failed: ${status}`); this.name = 'ApiError' }
}
function fail(status: number, message: string, code?: string): never { throw new ApiError(status, JSON.stringify({ message, code })) }
const PREFIX = 'modular_project_'
const CLOUD_CACHE = 'modular_cloud_project_v1_'
const RECOVERED = 'modular_recovered_v1_'
const PAGE_SIZE = 200
const context: DomainContext = { now: () => new Date().toISOString(), uuid: () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,12)}` }
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
function requireCloud() { if (!isSupabaseConfigured) fail(503, 'Supabase 연결 설정이 없습니다. 서버 연결을 확인하세요. 기존 이 PC 기록은 기록 복구에서 백업할 수 있습니다.', 'NOT_CONFIGURED') }
function remoteError(error: any, status?: number): never {
  const code = typeof error?.code === 'string' ? error.code : 'CONNECTION_ERROR'
  const message = typeof error?.message === 'string' ? error.message : '서버에 연결하지 못했습니다.'
  return fail(code === '23505' ? 409 : status && status >= 400 ? status : 503, `서버 요청 실패 [${code}]: ${message}`, code)
}
function warnCache() {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('modular-storage-warning', { detail: '서버 기록은 유지되지만 이 기기의 임시 보관 공간을 사용할 수 없습니다.' }))
}
function cache(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)) } catch { warnCache() } }
function revisionOf(value: ProjectDetail) {
  if (!own(value, 'revision')) return 0
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision >= Number.MAX_SAFE_INTEGER) fail(503, '저장된 프로젝트 버전이 올바르지 않습니다. 원본 데이터를 확인하세요.', 'INVALID_REVISION')
  return value.revision
}
function projectValue(value: unknown, id: string): ProjectDetail {
  const p = value as ProjectDetail
  if (!p || typeof p !== 'object' || p.id !== id || !/^[A-Za-z0-9_-]{1,160}$/.test(id) || !p.config || typeof p.config.name !== 'string' || !Array.isArray(p.modules) || !Array.isArray(p.history) || p.modules.length > 5000) fail(503, '저장된 프로젝트 형식을 확인해 주세요. 기록은 변경하지 않았습니다.', 'INVALID_PROJECT')
  revisionOf(p)
  if (!p.modules.every(m => m && typeof m.key === 'string' && typeof m.floor === 'number' && typeof m.x === 'number' && typeof m.y === 'number' && m.completed && typeof m.completed === 'object' && Array.isArray(m.history) && Array.isArray(m.inspections))) fail(503, '저장된 모듈 형식을 확인해 주세요. 기록은 변경하지 않았습니다.', 'INVALID_MODULES')
  return p
}
function normalized(p: ProjectDetail): ProjectDetail { return { ...structuredClone(p), revision: revisionOf(p) } }
function summary(p: ProjectDetail): ProjectSummary {
  return { id: p.id, name: p.config.name, moduleCount: p.modules.filter(m => m.active).length, revision: revisionOf(p), updatedAt: p.updatedAt, layoutStatus: layoutStatusOf(p), draftModuleCount: layoutStatusOf(p) === 'draft' ? (p.draftLayout ?? []).length : 0, managementPhase: managementPhaseOf(p) }
}
interface Remote { project: ProjectDetail; databaseUpdatedAt: string | null }
async function loadRemote(id: string): Promise<Remote | null> {
  requireCloud()
  let response: any
  try { response = await supabase.from('settings').select('id,settings,updated_at').eq('id', PREFIX + id).maybeSingle() } catch (error) { return remoteError(error) }
  if (response.error) remoteError(response.error, response.status)
  if (!response.data) return null
  if (response.data.id !== PREFIX + id) fail(503, '서버 프로젝트 식별자가 일치하지 않습니다.', 'INVALID_ID')
  return { project: projectValue(response.data.settings, id), databaseUpdatedAt: response.data.updated_at ?? null }
}
async function getProjectSummaries(): Promise<ProjectSummary[]> {
  requireCloud()
  const list: ProjectSummary[] = []; let cursor: string | null = null
  // Read actual project rows: the legacy shared index can be stale or omit a project.
  for (;;) {
    let response: any
    try {
      let query = supabase.from('settings').select('id,settings').like('id', 'modular_project_%').order('id', { ascending: true }).limit(PAGE_SIZE)
      if (cursor) query = query.gt('id', cursor)
      response = await query
    } catch (error) { return remoteError(error) }
    if (response.error) remoteError(response.error, response.status)
    if (!Array.isArray(response.data)) fail(503, '서버 프로젝트 목록 형식을 확인해 주세요.', 'INVALID_LIST')
    if (!response.data.length) break
    for (const row of response.data) {
      if (typeof row.id !== 'string') fail(503, '서버 프로젝트 식별자를 확인해 주세요.', 'INVALID_ID')
      if (!row.id.startsWith(PREFIX)) continue // SQL LIKE '_' is a wildcard; exact check is required.
      list.push(summary(projectValue(row.settings, row.id.slice(PREFIX.length))))
    }
    const next = response.data[response.data.length - 1].id
    if (next === cursor) fail(503, '서버 목록을 끝까지 확인하지 못했습니다.', 'PAGINATION_STALLED')
    cursor = next
  }
  list.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
  cache('modular_cloud_projects_list_v1', list)
  return list
}
async function persist(next: ProjectDetail, expected: Remote | null): Promise<ProjectDetail> {
  requireCloud(); projectValue(next, next.id)
  let response: any
  try {
    const row = { id: PREFIX + next.id, settings: next, updated_at: context.now() }
    if (!expected) response = await supabase.from('settings').insert(row).select('settings').single()
    else {
      let query = supabase.from('settings').update(row).eq('id', row.id)
      query = own(expected.project, 'revision') ? query.eq('settings->>revision', String(expected.project.revision)) : query.is('settings->>revision', null)
      query = expected.databaseUpdatedAt === null ? query.is('updated_at', null) : query.eq('updated_at', expected.databaseUpdatedAt)
      response = await query.select('settings').maybeSingle()
    }
  } catch (error) { return remoteError(error) }
  if (response.error) remoteError(response.error, response.status)
  if (!response.data?.settings) fail(409, '다른 화면에서 기록이 변경됐습니다. 최신 데이터를 불러온 뒤 다시 저장하세요.', 'REVISION_CONFLICT')
  const saved = projectValue(response.data.settings, next.id)
  if (revisionOf(saved) !== next.revision) fail(503, '서버 저장 결과를 확인하지 못했습니다. 최신 데이터를 다시 불러오세요.', 'INVALID_ACK')
  cache(CLOUD_CACHE + saved.id, saved)
  return normalized(saved)
}

// Existing browser-only records are never uploaded or overwritten while reading the cloud.
const canonical = (v: any): string => JSON.stringify(v && typeof v === 'object' ? Array.isArray(v) ? v.map(x => JSON.parse(canonical(x))) : Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, JSON.parse(canonical(v[k]))])) : v)
const fingerprint = (text: string) => { let a=2166136261,b=2246822519; for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),3266489917)}return `${text.length}:${a>>>0}:${b>>>0}` }
export interface RecoveryStats { name: string; modules: number; completed: number; updatedAt: string; revision: number }
export interface RecoveryReview { token: string; projectId: string; local: RecoveryStats; server: RecoveryStats | null; error: string; same: boolean; alreadyRestored: boolean }
interface ReviewState { projectId: string; key: string; raw: string; local: ProjectDetail | null; remote: Remote | null; error: string; backedUp: boolean; restored: boolean }
const reviews = new Map<string, ReviewState>()
function stats(p: ProjectDetail): RecoveryStats { return { name:p.config.name, modules:p.modules.filter(m=>m.active).length, completed:p.modules.reduce((sum,m)=>sum+Object.values(m.completed).filter(Boolean).length,0), updatedAt:p.updatedAt, revision:revisionOf(p) } }
function message(error: unknown) { if(error instanceof ApiError){try{return JSON.parse(error.body).message}catch{}}return '서버 기록을 확인하지 못했습니다.' }
export async function getLocalRecoveryReviews(): Promise<RecoveryReview[]> {
  reviews.clear(); const result: RecoveryReview[] = [], keys: string[] = []
  try { for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(PREFIX))keys.push(key)} } catch { fail(503,'이 브라우저의 기존 기록을 읽지 못했습니다.') }
  for (const key of keys.sort()) {
    const raw = localStorage.getItem(key); if(raw === null)continue
    const id=key.slice(PREFIX.length),token=context.uuid(); let local: ProjectDetail | null=null,remote:Remote|null=null,error=''
    try { local=projectValue(JSON.parse(raw),id); remote=await loadRemote(id) } catch(err){error=message(err)}
    const state:ReviewState={projectId:id,key,raw,local:local?structuredClone(local):null,remote:remote?structuredClone(remote):null,error,backedUp:false,restored:false}
    reviews.set(token,state)
    let marker='';try{marker=JSON.parse(localStorage.getItem(RECOVERED+id)||'\"\"')}catch{}
    result.push({token,projectId:id,local:local?stats(local):{name:id,modules:0,completed:0,updatedAt:'',revision:0},server:remote?stats(remote.project):null,error,same:Boolean(local&&remote&&canonical(local)===canonical(remote.project)),alreadyRestored:marker===fingerprint(raw)})
  }
  return result
}
export function createRecoveryBackup(token: string): { filename: string; content: string } {
  const review=reviews.get(token); if(!review)fail(409,'기록을 다시 검토한 후 백업하세요.')
  const content=JSON.stringify({format:'scon-storage-recovery/v1',exportedAt:context.now(),localKey:review.key,localRaw:review.raw,server:review.remote,serverReviewError:review.error},null,2)
  review.backedUp=true
  return {filename:`제작기록_양쪽백업_${review.key.replace(/[^a-zA-Z0-9_-]/g,'_')}_${Date.now()}.json`,content}
}
export async function restoreLocalProject(token: string): Promise<ProjectDetail> {
  const review=reviews.get(token)
  if(!review||!review.backedUp||review.restored||!review.local||review.error)fail(409,'서버와 이 PC 기록을 다시 검토하고 양쪽 백업을 먼저 내려받으세요.')
  try {
    if(localStorage.getItem(review.key)!==review.raw)fail(409,'검토 후 이 PC 기록이 바뀌었습니다. 다시 검토·백업하세요.')
    const current=await loadRemote(review.local.id)
    if(canonical(current)!==canonical(review.remote))fail(409,'검토 후 서버 기록이 바뀌었습니다. 다시 검토·백업하세요.')
    const revision=Math.max(revisionOf(review.local),current?revisionOf(current.project):0)+1
    if(!Number.isSafeInteger(revision)||revision>=Number.MAX_SAFE_INTEGER)fail(409,'저장 버전 한도에 도달했습니다.')
    const next=structuredClone(review.local);next.revision=revision;next.updatedAt=context.now()
    if(next.history.length>=20000)fail(409,'기존 이력을 보존하기 위해 복구를 중단했습니다. 이력 한도를 확인하세요.')
    next.history.push({id:context.uuid(),at:next.updatedAt,message:'이 PC 기록으로 서버 내용 교체 · 양쪽 원본 백업 후 사용자 확인'})
    const saved=await persist(next,current)
    review.restored=true;cache(RECOVERED+saved.id,fingerprint(review.raw))
    return saved
  } catch(error) { reviews.delete(token);throw error }
}

export async function deleteRecoveryRecord(token: string, deleteFromServer: boolean = false): Promise<void> {
  const review = reviews.get(token)
  if (!review) fail(404, '삭제할 기록 정보를 찾을 수 없습니다.')
  try {
    localStorage.removeItem(review.key)
    localStorage.removeItem(RECOVERED + review.projectId)
    localStorage.removeItem(CLOUD_CACHE + review.projectId)
    const legacyListRaw = localStorage.getItem('modular_projects_list')
    if (legacyListRaw) {
      try {
        const list = JSON.parse(legacyListRaw)
        if (Array.isArray(list)) {
          const filtered = list.filter((item: any) => item.id !== review.projectId)
          localStorage.setItem('modular_projects_list', JSON.stringify(filtered))
        }
      } catch {}
    }
  } catch (err) {
    console.error('Failed to remove from localStorage', err)
  }

  if (deleteFromServer && review.projectId) {
    requireCloud()
    const { error } = await supabase.from('settings').delete().eq('id', PREFIX + review.projectId)
    if (error) {
      remoteError(error)
    }
  }

  reviews.delete(token)
}

export function appApi(_appId: string) {
  return {
    async get<T>(path: string): Promise<T> {
      if(path==='/projects')return await getProjectSummaries() as unknown as T
      const match=path.match(/^\/projects\/([^/]+)$/)
      if(!match)fail(404,'경로를 찾을 수 없습니다.')
      const remote=await loadRemote(decodeURIComponent(match[1]));if(!remote)fail(404,'서버에서 프로젝트를 찾을 수 없습니다. 이 PC 기록은 기록 복구에서 확인하세요.')
      cache(CLOUD_CACHE+remote.project.id,remote.project)
      return normalized(remote.project) as unknown as T
    },
    async post<T>(path: string, body?: unknown): Promise<T> {
      try {
        if(path==='/projects') { requireCloud();return await persist(createProject(body,context),null) as unknown as T }
        const match=path.match(/^\/projects\/([^/]+)\/commands$/);if(!match)fail(404,'경로를 찾을 수 없습니다.')
        const envelope=validateEnvelope(body),remote=await loadRemote(decodeURIComponent(match[1]));if(!remote)fail(404,'서버에서 프로젝트를 찾을 수 없습니다.')
        if(revisionOf(remote.project)!==envelope.expectedRevision)fail(409,'다른 화면에서 기록이 변경됐습니다. 최신 데이터를 불러온 뒤 다시 저장하세요.','REVISION_CONFLICT')
        const next=applyCommand(normalized(remote.project),envelope.command,context)
        return await persist(next,remote) as unknown as T
      } catch(error) {
        if(error instanceof ApiError)throw error
        if(error instanceof DomainError)fail(error.status,error.message)
        remoteError(error)
      }
    },
  }
}
