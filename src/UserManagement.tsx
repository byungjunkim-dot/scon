import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, 
  Trash2, 
  Mail, 
  Phone, 
  Briefcase, 
  Code, 
  Key, 
  Search, 
  Filter, 
  ArrowLeft, 
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  CheckSquare,
  Square,
  X,
  ShieldCheck
} from 'lucide-react';
import { User, Project } from '../types';
import { supabaseService } from '../services/supabaseService';
import { safeJsonParse } from '../utils/safeJson';

interface UserManagementProps {
  onBack: () => void;
  projects?: Project[];
}

export const UserManagement: React.FC<UserManagementProps> = ({ onBack, projects: propProjects }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdownUserId, setOpenDropdownUserId] = useState<string | null>(null);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Projects list: from prop or localStorage
  const allProjects = useMemo<Project[]>(() => {
    if (propProjects && propProjects.length > 0) return propProjects;
    const saved = localStorage.getItem('cp_projects');
    return safeJsonParse(saved, []);
  }, [propProjects]);

  // Available project code options
  const availableProjects = useMemo(() => {
    return allProjects.map((p, idx) => ({
      id: p.id,
      name: p.name,
      code: p.projectCode?.trim() || `PRJ-${String(idx + 1).padStart(3, '0')}`
    }));
  }, [allProjects]);

  // Click outside to close project dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownUserId(null);
        setProjectSearchTerm('');
      }
    };
    if (openDropdownUserId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdownUserId]);

  useEffect(() => {
    const mapRole = (role?: string) => {
      if (role === '관리') return '실버';
      if (role === '일반' || role === '기타' || !role) return '브론즈';
      return role as any;
    };

    const loadUsers = async () => {
      const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
        (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

      if (isSupabaseConfigured) {
        try {
          const data = await supabaseService.getUsers();
          setUsers(data.map(u => ({
            ...u,
            userRole: mapRole(u.userRole),
            allowedProjectCodes: u.allowedProjectCodes || (u.signupCode ? u.signupCode.split(',').map(s => s.trim()).filter(Boolean) : [])
          })));
        } catch (error) {
          console.error('Error loading users from Supabase:', error);
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }
    };

    const loadFromLocalStorage = () => {
      const savedUsersStr = localStorage.getItem('cp_users');
      const parsed: any[] = safeJsonParse(savedUsersStr, []);
      setUsers(parsed.map((u: any) => ({
        ...u,
        userRole: mapRole(u.userRole),
        allowedProjectCodes: u.allowedProjectCodes || (u.signupCode ? u.signupCode.split(',').map(s => s.trim()).filter(Boolean) : [])
      })));
    };

    loadUsers();
  }, []);

  const handleDeleteUser = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '회원 삭제',
      message: '정말로 이 회원을 삭제하시겠습니까?',
      onConfirm: async () => {
        const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
          (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

        if (isSupabaseConfigured) {
          try {
            await supabaseService.deleteUser(id);
            setUsers(prev => prev.filter(u => u.id !== id));
          } catch (error) {
            console.error('Error deleting user from Supabase:', error);
          }
        } else {
          setUsers(prev => {
            const updatedUsers = prev.filter(u => u.id !== id);
            localStorage.setItem('cp_users', JSON.stringify(updatedUsers));
            return updatedUsers;
          });
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleRoleChange = async (id: string, newRole: '골드' | '실버' | '브론즈') => {
    const userToUpdate = users.find(u => u.id === id);
    if (!userToUpdate) return;

    const updatedUser = { ...userToUpdate, userRole: newRole };
    saveUserUpdate(updatedUser);
  };

  // Toggle single project code for a user
  const handleToggleProjectCode = (userId: string, code: string) => {
    const userToUpdate = users.find(u => u.id === userId);
    if (!userToUpdate) return;

    const currentCodes = userToUpdate.allowedProjectCodes || (
      userToUpdate.signupCode ? userToUpdate.signupCode.split(',').map(s => s.trim()).filter(Boolean) : []
    );

    const nextCodes = currentCodes.includes(code)
      ? currentCodes.filter(c => c !== code)
      : [...currentCodes, code];

    const updatedUser: User = {
      ...userToUpdate,
      allowedProjectCodes: nextCodes,
      signupCode: nextCodes.join(', ')
    };

    saveUserUpdate(updatedUser);
  };

  // Select all project codes for a user
  const handleSelectAllProjects = (userId: string) => {
    const userToUpdate = users.find(u => u.id === userId);
    if (!userToUpdate) return;

    const allCodes = availableProjects.map(p => p.code);
    const updatedUser: User = {
      ...userToUpdate,
      allowedProjectCodes: allCodes,
      signupCode: allCodes.join(', ')
    };
    saveUserUpdate(updatedUser);
  };

  // Clear all project codes for a user
  const handleClearAllProjects = (userId: string) => {
    const userToUpdate = users.find(u => u.id === userId);
    if (!userToUpdate) return;

    const updatedUser: User = {
      ...userToUpdate,
      allowedProjectCodes: [],
      signupCode: ''
    };
    saveUserUpdate(updatedUser);
  };

  // Save updated user to state, localStorage, and Supabase
  const saveUserUpdate = async (updatedUser: User) => {
    // 1. Update React state
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));

    // 2. Update localStorage users
    const savedUsersStr = localStorage.getItem('cp_users');
    const localUsers: User[] = safeJsonParse(savedUsersStr, []);
    const updatedLocalUsers = localUsers.map(u => u.id === updatedUser.id ? updatedUser : u);
    localStorage.setItem('cp_users', JSON.stringify(updatedLocalUsers));

    // 3. If currently logged in user is updated, update active session
    const curUserStr = localStorage.getItem('cp_current_user');
    if (curUserStr) {
      try {
        const curUser = JSON.parse(curUserStr);
        if (curUser.id === updatedUser.id) {
          localStorage.setItem('cp_current_user', JSON.stringify(updatedUser));
        }
      } catch (e) {}
    }

    // 4. Update Supabase if configured
    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

    if (isSupabaseConfigured) {
      try {
        await supabaseService.saveUser(updatedUser);
      } catch (error) {
        console.error('Error saving updated user to Supabase:', error);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.affiliation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.discipline.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
            title="프로젝트 목록으로 돌아가기"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">User Management & Project Access Control</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="회원 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-bold">이름</th>
                <th className="px-6 py-4 font-bold">연락처</th>
                <th className="px-6 py-4 font-bold">이메일</th>
                <th className="px-6 py-4 font-bold">회사명 / 공종</th>
                <th className="px-6 py-4 font-bold">등급 권한</th>
                <th className="px-6 py-4 font-bold">접근 허용 프로젝트 (가입코드)</th>
                <th className="px-6 py-4 font-bold">가입일</th>
                <th className="px-6 py-4 font-bold text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map((user) => {
                const userCodes = user.allowedProjectCodes || (
                  user.signupCode ? user.signupCode.split(',').map(s => s.trim()).filter(Boolean) : []
                );
                const isMasterRole = user.role === 'admin' || user.userRole === '골드';
                const isDropdownOpen = openDropdownUserId === user.id;

                const filteredProjectOptions = availableProjects.filter(p =>
                  p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) ||
                  p.code.toLowerCase().includes(projectSearchTerm.toLowerCase())
                );

                return (
                  <motion.tr 
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                          {(user?.name || 'U').charAt(0)}
                        </div>
                        <span className="font-bold text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{user.contact}</td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-900 font-medium">{user.affiliation}</span>
                        <span className="text-gray-400 text-[10px] uppercase font-bold">{user.discipline}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={user.userRole || '브론즈'} 
                        onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                        className={`border rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer ${
                          user.userRole === '골드'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : user.userRole === '실버'
                              ? 'bg-slate-100 text-slate-800 border-slate-300'
                              : 'bg-orange-50 text-orange-800 border-orange-200'
                        }`}
                      >
                        <option value="골드">골드 (전체 권한)</option>
                        <option value="실버">실버 (수정 가능)</option>
                        <option value="브론즈">브론즈 (열람 전용)</option>
                      </select>
                    </td>

                    {/* 프로젝트 접근 권한 (가입코드) 드롭다운 컬럼 */}
                    <td className="px-6 py-4 relative">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isMasterRole && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <ShieldCheck size={11} className="text-amber-600" />
                            전체 접근 (마스터)
                          </span>
                        )}

                        {userCodes.length > 0 ? (
                          userCodes.map(code => (
                            <span 
                              key={code} 
                              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs"
                            >
                              {code}
                            </span>
                          ))
                        ) : !isMasterRole ? (
                          <span className="text-[11px] text-gray-400 font-medium italic">
                            접근 불가 (선택 안됨)
                          </span>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => {
                            if (isDropdownOpen) {
                              setOpenDropdownUserId(null);
                              setProjectSearchTerm('');
                            } else {
                              setOpenDropdownUserId(user.id);
                              setProjectSearchTerm('');
                            }
                          }}
                          className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                            isDropdownOpen
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-blue-600'
                          }`}
                          title="프로젝트 접근 권한 설정"
                        >
                          <Building2 size={12} />
                          <span>프로젝트 선택</span>
                          <ChevronDown size={12} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* 드롭다운 메뉴 (체크박스 목록) */}
                      <AnimatePresence>
                        {isDropdownOpen && (
                          <motion.div
                            ref={dropdownRef}
                            initial={{ opacity: 0, y: 5, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 5, scale: 0.98 }}
                            className="absolute left-6 top-full mt-1 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 z-50 space-y-2.5"
                          >
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                              <div>
                                <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                                  <Building2 size={13} className="text-blue-600" />
                                  <span>{user.name} 님의 허용 프로젝트</span>
                                </h4>
                                <span className="text-[10px] text-gray-400">
                                  체크된 프로젝트만 접근 가능합니다.
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setOpenDropdownUserId(null)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>

                            {/* 빠른 전체 선택 / 전체 해제 */}
                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                선택: {userCodes.length} / {availableProjects.length}개
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSelectAllProjects(user.id)}
                                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                >
                                  전체 선택
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => handleClearAllProjects(user.id)}
                                  className="text-[10px] font-bold text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                                >
                                  전체 해제
                                </button>
                              </div>
                            </div>

                            {/* 검색창 */}
                            {availableProjects.length > 3 && (
                              <div className="relative">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                  type="text"
                                  value={projectSearchTerm}
                                  onChange={(e) => setProjectSearchTerm(e.target.value)}
                                  placeholder="프로젝트명 또는 코드 검색..."
                                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                                />
                              </div>
                            )}

                            {/* 프로젝트 체크박스 리스트 */}
                            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                              {filteredProjectOptions.length === 0 ? (
                                <p className="text-center text-xs text-gray-400 py-3">
                                  등록된 프로젝트가 없습니다.
                                </p>
                              ) : (
                                filteredProjectOptions.map(proj => {
                                  const isChecked = userCodes.includes(proj.code);
                                  return (
                                    <label
                                      key={proj.id}
                                      className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                                        isChecked 
                                          ? 'bg-blue-50/70 border-blue-200 text-blue-900' 
                                          : 'bg-white border-transparent hover:bg-gray-50 text-gray-700'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleProjectCode(user.id, proj.code)}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer shrink-0"
                                      />
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.2 rounded border border-indigo-200/60 shrink-0">
                                            {proj.code}
                                          </span>
                                          <span className="text-xs font-bold truncate">
                                            {proj.name}
                                          </span>
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>

                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all cursor-pointer"
                        title="회원 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">
                    가입된 회원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-gray-600 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors font-bold cursor-pointer"
                >
                  취소
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold cursor-pointer"
                >
                  삭제
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
