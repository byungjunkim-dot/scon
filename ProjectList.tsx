import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Plus, FolderOpen, Calendar, MapPin, Search, Building2, Upload, X, Loader2 } from 'lucide-react';
import { Project, User } from '../types';
import { compressImage } from '../utils/image';

interface ProjectListProps {
  projects: Project[];
  onSelect: (id: string) => void;
  onAdd: (projectData: Omit<Project, 'id' | 'createdAt'>) => void;
  onEdit?: (id: string, projectData: Omit<Project, 'id' | 'createdAt'>) => void;
  onOpenDeleteModal: () => void;
  currentUser: User | null;
}

const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelect, onAdd, onEdit, onOpenDeleteModal, currentUser }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newLatitude, setNewLatitude] = useState<number | ''>('');
  const [newLongitude, setNewLongitude] = useState<number | ''>('');
  const [newDesc, setNewDesc] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newTotalArea, setNewTotalArea] = useState<number | ''>('');
  const [newFloorsUG, setNewFloorsUG] = useState<number | ''>('');
  const [newFloorsAG, setNewFloorsAG] = useState<number | ''>('');
  const [newTotalBudget, setNewTotalBudget] = useState<number | ''>('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddProject = currentUser?.userRole === '골드' || currentUser?.userRole === '실버' || currentUser?.role === 'admin';
  const canDeleteProject = currentUser?.userRole === '골드' || currentUser?.role === 'admin';

  // ProjectList.tsx 내의 필터링 부분 예시
const filteredProjects = projects.filter(project => 
  // project.user_id가 존재할 때만 비교하도록 수정
  project.user_id === currentUser?.id
);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      try {
        const compressedBase64 = await compressImage(file, 200);
        setNewImageUrl(compressedBase64);
      } catch (error) {
        console.error('Image compression failed:', error);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const removeImage = () => {
    setNewImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      const projectData = {
        name: newName,
        projectCode: newProjectCode || undefined,
        location: newLocation,
        resolvedAddress: newLocation || undefined,
        latitude: newLatitude === '' ? undefined : Number(newLatitude),
        longitude: newLongitude === '' ? undefined : Number(newLongitude),
        description: newDesc,
        imageUrl: newImageUrl || undefined,
        totalArea: newTotalArea === '' ? undefined : Number(newTotalArea),
        floorsUnderground: newFloorsUG === '' ? undefined : Number(newFloorsUG),
        floorsAboveground: newFloorsAG === '' ? undefined : Number(newFloorsAG),
        totalBudget: newTotalBudget === '' ? undefined : Number(newTotalBudget),
        startDate: newStartDate || undefined,
        endDate: newEndDate || undefined,
      };

      if (editingProjectId && onEdit) {
        onEdit(editingProjectId, projectData);
      } else {
        onAdd(projectData);
      }

      setNewName('');
      setNewProjectCode('');
      setNewLocation('');
      setNewLatitude('');
      setNewLongitude('');
      setNewDesc('');
      setNewImageUrl('');
      setNewTotalArea('');
      setNewFloorsUG('');
      setNewFloorsAG('');
      setNewTotalBudget('');
      setNewStartDate('');
      setNewEndDate('');
      setIsAdding(false);
      setEditingProjectId(null);
    }
  };

  const handleEditClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProjectId(project.id);
    setNewName(project.name);
    setNewProjectCode(project.projectCode || '');
    setNewLocation(project.location || '');
    setNewLatitude(project.latitude || '');
    setNewLongitude(project.longitude || '');
    setNewDesc(project.description || '');
    setNewImageUrl(project.imageUrl || '');
    setNewTotalArea(project.totalArea || '');
    setNewFloorsUG(project.floorsUnderground || '');
    setNewFloorsAG(project.floorsAboveground || '');
    setNewTotalBudget(project.totalBudget || '');
    setNewStartDate(project.startDate || '');
    setNewEndDate(project.endDate || '');
    setIsAdding(true);
  };

  const closeModal = () => {
    setIsAdding(false);
    setEditingProjectId(null);
    setNewName('');
    setNewProjectCode('');
    setNewLocation('');
    setNewLatitude('');
    setNewLongitude('');
    setNewDesc('');
    setNewImageUrl('');
    setNewTotalArea('');
    setNewFloorsUG('');
    setNewFloorsAG('');
    setNewTotalBudget('');
    setNewStartDate('');
    setNewEndDate('');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 xl:p-8">
      <div className="max-w-7xl mx-auto space-y-4 xl:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl xl:text-3xl font-black text-gray-900 tracking-tight flex items-baseline">
              프로젝트 목록
              <span className="text-gray-400 font-medium ml-2 text-lg xl:text-xl">Project List</span>
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="hidden sm:relative sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="현장명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm w-full sm:w-64 shadow-sm"
              />
            </div>
            {canAddProject && (
              <div className="flex gap-2">
                {canDeleteProject && (
                  <button
                    onClick={onOpenDeleteModal}
                    className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-all text-sm"
                  >
                    삭제
                  </button>
                )}
                <button
                  onClick={() => setIsAdding(true)}
                  className="fixed bottom-8 right-6 z-50 sm:static sm:z-auto bg-blue-600 text-white w-14 h-14 sm:w-auto sm:h-auto rounded-full sm:rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-2xl shadow-blue-500/40 sm:shadow-lg sm:shadow-blue-500/20 whitespace-nowrap sm:px-6 sm:py-2"
                >
                  <Plus size={24} className="sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">신규 현장 등록</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6">
          {filteredProjects.map((project, idx) => {
            const canAccess = currentUser?.userRole !== '브론즈' || currentUser?.signupCode === project.projectCode;

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button[title="프로젝트 삭제"]')) {
                    return;
                  }
                  if (canAccess) {
                    onSelect(project.id);
                  } else {
                    alert('접근 권한이 없습니다. 가입코드와 프로젝트 코드가 일치하지 않습니다.');
                  }
                }}
                className={`bg-white p-3 xl:p-6 rounded-2xl xl:rounded-3xl border border-gray-100 shadow-sm transition-all group relative overflow-hidden flex flex-row xl:flex-col gap-3 xl:gap-0 items-center xl:items-stretch ${canAccess ? 'hover:shadow-xl hover:-translate-y-1 cursor-pointer' : 'opacity-75 cursor-not-allowed'}`}
              >
                <div className="w-24 h-24 xl:w-auto xl:h-40 xl:-mx-6 xl:-mt-6 xl:mb-6 relative overflow-hidden flex-shrink-0 rounded-xl xl:rounded-none">
                  {project.imageUrl ? (
                    <img
                      src={project.imageUrl}
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Building2 className="text-white/20 w-8 h-8 xl:w-16 xl:h-16" />
                    </div>
                  )}
                  <div className="absolute top-1 xl:top-4 right-1 xl:right-4 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 xl:px-2 xl:py-1 rounded-md xl:rounded-lg text-[8px] xl:text-[10px] font-bold text-blue-600 uppercase tracking-widest shadow-sm">
                    Active
                  </div>
                  {canAddProject && (
                    <button
                      onClick={(e) => handleEditClick(e, project)}
                      className="absolute top-1 xl:top-4 left-1 xl:left-4 bg-white/90 backdrop-blur-sm p-1.5 xl:p-2 rounded-md xl:rounded-lg text-gray-600 hover:text-blue-600 hover:bg-white transition-colors shadow-sm z-10"
                      title="프로젝트 수정"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="xl:w-4 xl:h-4"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                    </button>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center xl:justify-start space-y-1 xl:space-y-4">
                  <div className="hidden xl:flex justify-between items-start">
                    <div className="bg-blue-50 p-1.5 xl:p-2 rounded-lg xl:rounded-xl group-hover:bg-blue-600 transition-colors">
                      <FolderOpen className="text-blue-600 group-hover:text-white transition-colors w-4 h-4 xl:w-5 xl:h-5" />
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] xl:text-[10px] font-bold text-gray-400 uppercase tracking-widest">연면적</div>
                      <div className="text-xs xl:text-sm font-bold text-gray-700">{project.totalArea?.toLocaleString() || '-'} ㎡</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm xl:text-xl font-bold text-gray-900 mb-0.5 xl:mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">{project.name}</h3>
                    <p className="hidden xl:block text-gray-500 text-xs xl:text-sm line-clamp-1 leading-relaxed">{project.description}</p>
                  </div>

                  <div className="flex flex-col gap-0.5 xl:hidden">
                    <div className="text-[10px] text-gray-600 truncate"><span className="text-gray-400 font-bold mr-1">연면적:</span>{project.totalArea?.toLocaleString() || '-'} ㎡</div>
                    <div className="text-[10px] text-gray-600 truncate"><span className="text-gray-400 font-bold mr-1">층수:</span>지하 {project.floorsUnderground || 0} / 지상 {project.floorsAboveground || 0}</div>
                    <div className="text-[10px] text-gray-600 truncate"><span className="text-gray-400 font-bold mr-1">기간:</span>{project.startDate || '-'} ~ {project.endDate || '-'}</div>
                  </div>

                  <div className="hidden xl:grid grid-cols-2 gap-2 xl:gap-4 py-1.5 xl:py-3 border-y border-gray-50">
                    <div>
                      <div className="text-[9px] xl:text-[10px] font-bold text-gray-400 uppercase tracking-widest">층수</div>
                      <div className="text-[10px] xl:text-xs font-medium text-gray-600">지하 {project.floorsUnderground || 0} / 지상 {project.floorsAboveground || 0}</div>
                    </div>
                    <div>
                      <div className="text-[9px] xl:text-[10px] font-bold text-gray-400 uppercase tracking-widest">공사기간</div>
                      <div className="text-[10px] xl:text-xs font-medium text-gray-600 truncate">{project.startDate || '-'} ~ {project.endDate || '-'}</div>
                    </div>
                  </div>

                  <div className="hidden xl:flex pt-0.5 xl:pt-1 items-center justify-between text-[9px] xl:text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 xl:w-3 xl:h-3" />
                      <span>등록일: {project.createdAt}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 xl:w-3 xl:h-3" />
                      <span>{project.location || '미지정'}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                <Search className="text-gray-400" size={32} />
              </div>
              <p className="text-gray-500 font-medium">검색 결과가 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-[540px] p-8 rounded-3xl shadow-2xl space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-900">{editingProjectId ? '현장 정보 수정' : '신규 현장 등록'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 no-scrollbar">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">현장명</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="예: 서울숲 아파트 신축공사"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">프로젝트 코드</label>
                <input
                  type="text"
                  value={newProjectCode}
                  onChange={(e) => setNewProjectCode(e.target.value)}
                  placeholder="예: PJT-2024-001"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">현장위치</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="예: 시군구 / 읍면동"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">위도</label>
                  <input
                    type="number"
                    step="any"
                    value={newLatitude}
                    onChange={(e) => setNewLatitude(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="예: 37.5385"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">경도</label>
                  <input
                    type="number"
                    step="any"
                    value={newLongitude}
                    onChange={(e) => setNewLongitude(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="예: 127.1259"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">대표이미지</label>
                <div className="relative">
                  {isCompressing ? (
                    <div className="h-40 border-2 border-dashed border-blue-200 rounded-xl flex flex-col items-center justify-center gap-2 bg-blue-50/30">
                      <Loader2 className="text-blue-600 animate-spin" size={32} />
                      <p className="text-xs font-bold text-blue-600">이미지 최적화 중...</p>
                    </div>
                  ) : newImageUrl ? (
                    <div className="relative h-40 rounded-xl overflow-hidden border border-gray-200">
                      <img src={newImageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="h-40 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                    >
                      <div className="bg-gray-50 p-3 rounded-full group-hover:bg-blue-100 transition-colors">
                        <Upload className="text-gray-400 group-hover:text-blue-600" size={24} />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-gray-600">이미지 업로드</p>
                        <p className="text-[10px] text-gray-400">클릭하여 파일을 선택하세요 (최대 200KB로 자동 최적화)</p>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">설명</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="현장에 대한 간략한 설명을 입력하세요."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">연면적 (㎡)</label>
                  <input
                    type="number"
                    value={newTotalArea}
                    onChange={(e) => setNewTotalArea(e.target.value ? Number(e.target.value) : '')}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">총 공사비 (억원)</label>
                  <input
                    type="number"
                    value={newTotalBudget}
                    onChange={(e) => setNewTotalBudget(e.target.value ? Number(e.target.value) : '')}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <div className="space-y-1 flex-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">지하층</label>
                  <input
                    type="number"
                    value={newFloorsUG}
                    onChange={(e) => setNewFloorsUG(e.target.value ? Number(e.target.value) : '')}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">지상층</label>
                  <input
                    type="number"
                    value={newFloorsAG}
                    onChange={(e) => setNewFloorsAG(e.target.value ? Number(e.target.value) : '')}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">공사 시작일</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">공사 종료일</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 mt-4"
              >
                {editingProjectId ? '수정 완료' : '등록 완료'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
