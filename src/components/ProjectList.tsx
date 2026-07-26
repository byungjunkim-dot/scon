import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, FolderOpen, Calendar, MapPin, Search, Building2, Upload, X, Loader2, Star, Users, Lock, FileText } from 'lucide-react';
import { Project, User } from '../types';
import { compressImage } from '../utils/image';
import { PersonnelStatusView } from './PersonnelStatusView';
import { BillingAndSubcontractorView } from './BillingAndSubcontractorView';
import { ConsolidatedBillingDashboard } from './ConsolidatedBillingDashboard';

interface ProjectListProps {
  projects: Project[];
  onSelect: (id: string, initialMenu?: any) => void;
  onAdd: (projectData: Omit<Project, 'id' | 'createdAt'>) => void;
  onEdit?: (id: string, projectData: Omit<Project, 'id' | 'createdAt'>) => void;
  onOpenDeleteModal: () => void;
  currentUser: User | null;
}

const SAMPLE_COLORS = [
  '#7da0ca', // Soft blue-grey
  '#85b79e', // Sage green
  '#e3b177', // Muted orange/mustard
  '#a799cc', // Lavender/dusty purple
  '#dca2b1', // Dusty rose
  '#7cbdbf', // Muted teal
  '#a2b588', // Olive green
  '#94a3b8', // Slate blue/grey
  '#df9387', // Terracotta/soft coral
  '#bca58d', // Warm sand/taupe
];

const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelect, onAdd, onEdit, onOpenDeleteModal, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'personnel' | 'billing'>('projects');
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
  const [newStatus, setNewStatus] = useState<'진행' | '완료' | '홀딩'>('진행');
  const [newColor, setNewColor] = useState('#7da0ca');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddProject = currentUser?.userRole === '골드' || currentUser?.userRole === '실버' || currentUser?.role === 'admin';
  const canEditProject = currentUser?.userRole === '골드' || currentUser?.role === 'admin';
  const canDeleteProject = currentUser?.userRole === '골드' || currentUser?.role === 'admin';

  const [favorites, setFavorites] = useState<string[]>(() => {
    if (!currentUser) return [];
    try {
      const saved = localStorage.getItem(`cp_favorites_${currentUser.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    if (!currentUser) {
      setFavorites([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`cp_favorites_${currentUser.id}`);
      setFavorites(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setFavorites([]);
    }
  }, [currentUser]);

  const toggleFavorite = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!currentUser) return;
    setFavorites(prev => {
      const updated = prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId];
      localStorage.setItem(`cp_favorites_${currentUser.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const isAHq = a.name === '본사 사업 관리';
    const isBHq = b.name === '본사 사업 관리';
    if (isAHq !== isBHq) {
      return isAHq ? 1 : -1;
    }
    const aFav = favorites.includes(a.id);
    const bFav = favorites.includes(b.id);
    if (aFav !== bFav) {
      return aFav ? -1 : 1;
    }
    return projects.indexOf(a) - projects.indexOf(b);
  });

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
        status: newStatus,
        color: newColor,
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
      setNewStatus('진행');
      setNewColor('#7da0ca');
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
    setNewStatus(project.status || '진행');
    setNewColor(project.color || '#7da0ca');
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
    setNewStatus('진행');
    setNewColor('#7da0ca');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 xl:p-8">
      <div className="max-w-7xl mx-auto space-y-4 xl:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 w-fit">
            <button
              onClick={() => setActiveTab('projects')}
              className={`text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'projects'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <FolderOpen size={16} />
              <span>프로젝트 현황</span>
            </button>
            
            <div className="w-px h-3 bg-gray-300"></div>

            <button
              onClick={() => {
                const isSilverOrAbove = currentUser?.userRole === '실버' || currentUser?.userRole === '골드' || currentUser?.role === 'admin';
                if (!isSilverOrAbove) {
                  alert('인력 현황 페이지는 실버 등급 이상만 접근 가능합니다.');
                  return;
                }
                setActiveTab('personnel');
              }}
              className={`text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'personnel'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Users size={16} />
              <span>인력 현황</span>
              {!(currentUser?.userRole === '실버' || currentUser?.userRole === '골드' || currentUser?.role === 'admin') && (
                <Lock size={12} className="text-gray-400 ml-0.5" />
              )}
            </button>

            <div className="w-px h-3 bg-gray-300"></div>

            <button
              onClick={() => {
                const isSilverOrAbove = currentUser?.userRole === '실버' || currentUser?.userRole === '골드' || currentUser?.role === 'admin';
                if (!isSilverOrAbove) {
                  alert('기성 및 외주 현황 페이지는 실버 등급 이상만 접근 가능합니다.');
                  return;
                }
                setActiveTab('billing');
              }}
              className={`text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'billing'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <FileText size={16} />
              <span>기성 및 외주 현황</span>
              {!(currentUser?.userRole === '실버' || currentUser?.userRole === '골드' || currentUser?.role === 'admin') && (
                <Lock size={12} className="text-gray-400 ml-0.5" />
              )}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {activeTab === 'projects' && (
              <>
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
                        className="hidden sm:block bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-all text-sm"
                      >
                        삭제
                      </button>
                    )}
                    <button
                      onClick={() => setIsAdding(true)}
                      className="fixed bottom-8 right-6 z-50 sm:static sm:z-auto bg-blue-600 text-white w-14 h-14 sm:w-auto sm:h-auto rounded-full sm:rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-2xl shadow-blue-500/40 sm:shadow-lg sm:shadow-blue-500/20 whitespace-nowrap sm:px-6 sm:py-2"
                    >
                      <Plus size={24} className="sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">신규</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {activeTab === 'projects' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6">
            {sortedProjects.map((project, idx) => {
              const canAccess = currentUser?.userRole !== '브론즈' || currentUser?.signupCode === project.projectCode;
              const isFav = favorites.includes(project.id);

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={(e) => {
                    if (
                      (e.target as HTMLElement).closest('button[title="프로젝트 삭제"]') ||
                      (e.target as HTMLElement).closest('button[title="즐겨찾기"]')
                    ) {
                      return;
                    }
                    if (canAccess) {
                      onSelect(project.id);
                    } else {
                      alert('접근 권한이 없습니다. 가입코드와 프로젝트 코드가 일치하지 않습니다.');
                    }
                  }}
                  className={`bg-white p-3 xl:p-6 rounded-lg border border-gray-100 shadow-sm transition-all group relative overflow-hidden flex flex-row xl:flex-col gap-3 xl:gap-0 items-center xl:items-stretch ${canAccess ? 'hover:shadow-xl hover:-translate-y-1 cursor-pointer' : 'opacity-75 cursor-not-allowed'}`}
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
                    {(() => {
                      const status = project.status || '진행';
                      let statusColors = 'bg-blue-50/90 text-blue-600 border border-blue-100/50';
                      if (status === '완료') {
                        statusColors = 'bg-emerald-50/90 text-emerald-600 border border-emerald-100/50';
                      } else if (status === '홀딩') {
                        statusColors = 'bg-amber-50/90 text-amber-600 border border-amber-100/50';
                      }
                      return (
                        <div className={`absolute top-1 xl:top-4 right-1 xl:right-4 backdrop-blur-sm px-1.5 py-0.5 xl:px-2 xl:py-1 rounded-md xl:rounded-lg text-[8px] xl:text-[10px] font-bold uppercase tracking-widest shadow-sm ${statusColors}`}>
                          {status}
                        </div>
                      );
                    })()}
                    {canEditProject && (
                      <button
                        onClick={(e) => handleEditClick(e, project)}
                        className="absolute top-1 xl:top-4 left-1 xl:left-4 bg-white/90 backdrop-blur-sm p-1.5 xl:p-2 rounded-md xl:rounded-lg text-gray-600 hover:text-blue-600 hover:bg-white transition-colors shadow-sm z-10"
                        title="프로젝트 수정"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="xl:w-4 xl:h-4"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                      </button>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center xl:justify-start space-y-1 xl:space-y-4 pr-8 xl:pr-0">
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

                    <div className="hidden xl:flex pt-0.5 xl:pt-1 items-center justify-between text-[9px] xl:text-[10px] text-gray-400 font-bold uppercase tracking-wider pr-8">
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

                  {/* 즐겨찾기 버튼 */}
                  <button
                    onClick={(e) => toggleFavorite(e, project.id)}
                    className="absolute bottom-2.5 right-2.5 xl:bottom-4 xl:right-4 p-2 rounded-full bg-white/95 hover:bg-white text-gray-400 hover:text-amber-500 transition-all border border-gray-100 shadow-sm z-10 hover:scale-110 active:scale-95 flex items-center justify-center"
                    title="즐겨찾기"
                  >
                    <Star
                      size={16}
                      className={isFav ? "fill-amber-400 text-amber-500" : "text-gray-400"}
                    />
                  </button>
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
        ) : activeTab === 'personnel' ? (
          (() => {
            const isSilverOrAbove = currentUser?.userRole === '실버' || currentUser?.userRole === '골드' || currentUser?.role === 'admin';
            if (!isSilverOrAbove) {
              return (
                <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center shadow-sm space-y-4">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
                    <Lock size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">접근 권한 제한</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    인력 현황 페이지는 <strong className="text-blue-600">실버 등급 이상</strong> 회원만 접근할 수 있습니다.
                  </p>
                </div>
              );
            }
            return <PersonnelStatusView projects={projects} currentUser={currentUser} />;
          })()
        ) : (
          (() => {
            const isSilverOrAbove = currentUser?.userRole === '실버' || currentUser?.userRole === '골드' || currentUser?.role === 'admin';
            if (!isSilverOrAbove) {
              return (
                <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center shadow-sm space-y-4">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
                    <Lock size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">접근 권한 제한</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    기성 및 외주 현황 페이지는 <strong className="text-blue-600">실버 등급 이상</strong> 회원만 접근할 수 있습니다.
                  </p>
                </div>
              );
            }
            return <ConsolidatedBillingDashboard projects={projects} currentUser={currentUser} onSelectProject={onSelect} />;
          })()
        )}
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

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
                  <span>프로젝트 테마 색상</span>
                  <span className="text-gray-400 font-bold text-[10px] normal-case">인력 투입 현황 Gantt 차트에 반영됩니다</span>
                </label>
                
                {/* 10 Sample colors */}
                <div className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
                  {SAMPLE_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className="h-8 rounded-xl transition-all hover:scale-105 active:scale-95 relative flex items-center justify-center border border-gray-100 shadow-sm flex-1 sm:flex-none sm:w-8"
                      style={{ backgroundColor: color }}
                      title={color}
                    >
                      {newColor.toLowerCase() === color.toLowerCase() && (
                        <div className="w-2.5 h-2.5 bg-white rounded-full shadow-inner" />
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Custom color input & Native picker */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      placeholder="#7da0ca"
                      className="w-full border border-gray-200 rounded-xl pl-4 pr-12 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all uppercase"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">HEX</span>
                  </div>
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-200 shadow-sm flex-shrink-0 cursor-pointer">
                    <input
                      type="color"
                      value={newColor.startsWith('#') && newColor.length === 7 ? newColor : '#7da0ca'}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer scale-150"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">진행 현황</label>
                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                  {(['진행', '완료', '홀딩'] as const).map((statusVal) => {
                    const isSelected = newStatus === statusVal;
                    let activeStyles = 'bg-blue-600 text-white shadow-sm';
                    if (statusVal === '완료') activeStyles = 'bg-emerald-600 text-white shadow-sm';
                    if (statusVal === '홀딩') activeStyles = 'bg-amber-600 text-white shadow-sm';

                    return (
                      <button
                        key={statusVal}
                        type="button"
                        onClick={() => setNewStatus(statusVal)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${
                          isSelected
                            ? activeStyles
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        {statusVal}
                      </button>
                    );
                  })}
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
