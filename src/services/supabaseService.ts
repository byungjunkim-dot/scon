import { supabase } from '../lib/supabase';
import { Project, ScheduleItem, AppSettings, User, DailyReport, Drawing, Category, Status } from '../types';

type ScheduleRow = {
  id: string;
  projectId: string;
  category: string | null;
  subCategory: string | null;
  taskName: string | null;
  contractor: string | null;
  startDate: string | null;
  endDate: string | null;
  progress: number | null;
  status: string | null;
  isBaseline: boolean | null;
  dongBlock: string | null;
  floor: string | null;
  zone: string | null;
  amount: string | null;
  memo: string | null;
  siteName: string | null;
  detailLocation: string | null;
  duration: number | null;
  predecessor: string | null;
  sortOrder: number | null;
  sourceScheduleId: string | null;
};

type ScheduleItemWithExtra = ScheduleItem & {
  amount?: string;
  sortOrder?: number;
  sourceScheduleId?: string | null;
};

const toScheduleRow = (item: ScheduleItemWithExtra): ScheduleRow => {
  return {
    id: item.id,
    projectId: item.projectId,
    category: item.category ?? null,
    subCategory: item.subCategory ?? null,
    taskName: item.taskName ?? null,
    contractor: item.contractor ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    progress: item.progress ?? 0,
    status: item.status ?? null,
    isBaseline: item.isBaseline ?? false,
    dongBlock: item.dongBlock ?? null,
    floor: item.floor ?? null,
    zone: item.zone ?? null,
    amount: item.amount ?? null,
    memo: item.memo ?? null,
    siteName: item.siteName ?? null,
    detailLocation: item.detailLocation ?? null,
    duration: item.duration ?? null,
    predecessor: item.predecessor ?? null,
    sortOrder: item.sortOrder ?? 0,
    sourceScheduleId: item.sourceScheduleId ?? null,
  };
};

const fromScheduleRow = (row: ScheduleRow): ScheduleItemWithExtra => {
  return {
    id: row.id,
    projectId: row.projectId,
    category: (row.category ?? '공통관리') as Category,
    subCategory: row.subCategory ?? '',
    taskName: row.taskName ?? '',
    contractor: row.contractor ?? '',
    startDate: row.startDate ?? '',
    endDate: row.endDate ?? '',
    progress: row.progress ?? 0,
    status: (row.status ?? '예정') as Status,
    isBaseline: row.isBaseline ?? false,
    dongBlock: row.dongBlock ?? '',
    floor: row.floor ?? '',
    zone: row.zone ?? '',
    memo: row.memo ?? '',
    siteName: row.siteName ?? '',
    detailLocation: row.detailLocation ?? '',
    duration: row.duration ?? 0,
    predecessor: row.predecessor ?? '',
    amount: row.amount ?? '',
    sortOrder: row.sortOrder ?? 0,
    sourceScheduleId: row.sourceScheduleId ?? null,
  };
};

export const supabaseService = {
  // Projects
  async getProjects() {
    const { data, error } = await supabase.from('projects').select('*');
    if (error) throw error;
    return data as Project[];
  },

  async saveProject(project: Project) {
    const { data, error } = await supabase
      .from('projects')
      .upsert(project)
      .select()
      .single();

    if (error) throw error;
    return data as Project;
  },

  async updateProjectSettings(projectId: string, settings: AppSettings) {
    const { data, error } = await supabase
      .from('projects')
      .update({ settings: settings }) // 설정 컬럼만 업데이트
      .eq('id', projectId)
      .select()   // 👈 핵심 1: 업데이트한 데이터를 나에게 다시 보여달라고 강제 요청
      .single();  // 👈 핵심 2: 만약 업데이트된 데이터가 '0개'면 즉각 에러(PGRST116)를 던지도록 강제

    if (error) {
      console.error("Supabase Update Error Details:", error);
      throw error;
    }
    
    return data;
  },

  async deleteProject(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },

  // Schedules
  async getSchedules(projectId: string) {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('projectId', projectId)
      .order('sortOrder', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => fromScheduleRow(row as ScheduleRow)) as ScheduleItem[];
  },

  async saveSchedule(item: ScheduleItemWithExtra) {
    const row = toScheduleRow(item);

    const { data, error } = await supabase
      .from('schedules')
      .upsert(row)
      .select()
      .single();

    if (error) throw error;

    return fromScheduleRow(data as ScheduleRow) as ScheduleItem;
  },

  async deleteSchedule(id: string) {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) throw error;
  },

  // Users
  async getUsers() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data as User[];
  },

  async saveUser(user: User) {
    const { data, error } = await supabase
      .from('users')
      .upsert(user)
      .select()
      .single();

    if (error) throw error;