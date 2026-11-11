import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { 
  applyCommand, 
  createProject, 
  DomainError, 
  validateEnvelope, 
  type DomainContext 
} from '../common/domain';
import { 
  layoutStatusOf, 
  managementPhaseOf, 
  type ProjectDetail, 
  type ProjectSummary, 
  type ProjectConfig 
} from '../common/model';

export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`Request failed: ${status}`);
    this.name = 'ApiError';
  }
}

const context: DomainContext = {
  now: () => new Date().toISOString(),
  uuid: () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }
};

const LOCAL_STORAGE_LIST_KEY = 'modular_projects_list';
const LOCAL_STORAGE_PROJECT_PREFIX = 'modular_project_';

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// 1. Supabase & LocalStorage 통합 프로젝트 목록 조회
async function getProjectSummaries(): Promise<ProjectSummary[]> {
  let list: ProjectSummary[] = [];
  const localList = safeParse<ProjectSummary[]>(localStorage.getItem(LOCAL_STORAGE_LIST_KEY), []);

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'modular_projects_list')
        .maybeSingle();

      if (!error && data?.settings && Array.isArray(data.settings.projects)) {
        list = data.settings.projects;
        // 로컬 캐시 갱신
        localStorage.setItem(LOCAL_STORAGE_LIST_KEY, JSON.stringify(list));
        return list;
      }
    } catch (err) {
      console.warn('[modularApi] Supabase load project list error, using local cache:', err);
    }
  }

  return localList;
}

// 2. Supabase & LocalStorage 통합 프로젝트 상세 조회
async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  const localKey = `${LOCAL_STORAGE_PROJECT_PREFIX}${id}`;
  let detail = safeParse<ProjectDetail | null>(localStorage.getItem(localKey), null);

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', `modular_project_${id}`)
        .maybeSingle();

      if (!error && data?.settings) {
        const remoteDetail = data.settings as ProjectDetail;
        // 로컬 데이터가 원격보다 최신 버전인 경우 로컬 데이터를 우선하고 원격을 최신화
        if (detail && typeof detail.revision === 'number' && typeof remoteDetail.revision === 'number') {
          if (detail.revision >= remoteDetail.revision) {
            if (detail.revision > remoteDetail.revision) {
              void supabase.from('settings').upsert({
                id: `modular_project_${id}`,
                settings: detail,
                updated_at: new Date().toISOString()
              });
            }
            return detail;
          }
        }

        detail = remoteDetail;
        // 보정 및 로컬 캐시
        detail.layoutStatus = layoutStatusOf(detail);
        const phase = managementPhaseOf(detail);
        if (phase !== 'draft') {
          detail.managementPhase = phase;
        }
        localStorage.setItem(localKey, JSON.stringify(detail));
        return detail;
      }
    } catch (err) {
      console.warn(`[modularApi] Supabase load project detail (${id}) error:`, err);
    }
  }

  return detail;
}

// 3. Supabase & LocalStorage 동시 저장
async function saveProjectDetail(detail: ProjectDetail): Promise<void> {
  const localKey = `${LOCAL_STORAGE_PROJECT_PREFIX}${detail.id}`;
  localStorage.setItem(localKey, JSON.stringify(detail));

  // 프로젝트 목록(Summary) 갱신
  const summary: ProjectSummary = {
    id: detail.id,
    name: detail.config.name,
    moduleCount: detail.modules.filter(m => m.active).length,
    revision: detail.revision,
    updatedAt: detail.updatedAt,
    layoutStatus: layoutStatusOf(detail),
    draftModuleCount: layoutStatusOf(detail) === 'draft' ? (detail.draftLayout ?? []).length : 0,
    managementPhase: managementPhaseOf(detail)
  };

  const list = await getProjectSummaries();
  const existingIdx = list.findIndex(p => p.id === detail.id);
  let updatedList: ProjectSummary[];
  if (existingIdx >= 0) {
    updatedList = [...list];
    updatedList[existingIdx] = summary;
  } else {
    updatedList = [summary, ...list];
  }

  localStorage.setItem(LOCAL_STORAGE_LIST_KEY, JSON.stringify(updatedList));

  if (isSupabaseConfigured) {
    try {
      // 1) 개별 프로젝트 저장
      await supabase
        .from('settings')
        .upsert({
          id: `modular_project_${detail.id}`,
          settings: detail,
          updated_at: new Date().toISOString()
        });

      // 2) 목록 저장
      await supabase
        .from('settings')
        .upsert({
          id: 'modular_projects_list',
          settings: { projects: updatedList },
          updated_at: new Date().toISOString()
        });
    } catch (err) {
      console.error('[modularApi] Supabase save error:', err);
    }
  }
}

export function appApi(_appId: string) {
  return {
    async get<T>(path: string): Promise<T> {
      // 1. GET /projects
      if (path === '/projects') {
        const summaries = await getProjectSummaries();
        return summaries as unknown as T;
      }

      // 2. GET /projects/:id
      const projectMatch = path.match(/^\/projects\/([^/]+)$/);
      if (projectMatch) {
        const id = decodeURIComponent(projectMatch[1]);
        const detail = await getProjectDetail(id);
        if (!detail) {
          throw new ApiError(404, JSON.stringify({ message: '프로젝트를 찾을 수 없습니다.' }));
        }
        return detail as unknown as T;
      }

      throw new ApiError(404, JSON.stringify({ message: '경로를 찾을 수 없습니다.' }));
    },

    async post<T>(path: string, body?: unknown): Promise<T> {
      // 1. POST /projects
      if (path === '/projects') {
        try {
          const project = createProject(body as ProjectConfig, context);
          await saveProjectDetail(project);
          return project as unknown as T;
        } catch (err: any) {
          const message = err?.message || '프로젝트 생성에 실패했습니다.';
          throw new ApiError(400, JSON.stringify({ message }));
        }
      }

      // 2. POST /projects/:id/commands
      const commandMatch = path.match(/^\/projects\/([^/]+)\/commands$/);
      if (commandMatch) {
        const id = decodeURIComponent(commandMatch[1]);
        const detail = await getProjectDetail(id);
        if (!detail) {
          throw new ApiError(404, JSON.stringify({ message: '프로젝트를 찾을 수 없습니다.' }));
        }

        try {
          const envelope = validateEnvelope(body);
          if (detail.revision !== envelope.expectedRevision) {
            console.warn(`[modularApi] Re-synchronizing revision from ${detail.revision} to ${envelope.expectedRevision}`);
            detail.revision = Math.max(detail.revision, envelope.expectedRevision);
          }

          const next = applyCommand(detail, envelope.command, context);
          await saveProjectDetail(next);
          return next as unknown as T;
        } catch (err: any) {
          if (err instanceof ApiError) throw err;
          const status = err instanceof DomainError ? err.status : 400;
          const message = err?.message || '작업을 처리하지 못했습니다.';
          throw new ApiError(status, JSON.stringify({ message }));
        }
      }

      throw new ApiError(404, JSON.stringify({ message: '경로를 찾을 수 없습니다.' }));
    }
  };
}
