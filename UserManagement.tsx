import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User as UserIcon, Trash2, Mail, Phone, Briefcase, Code, Key, Search, Filter, ArrowLeft, AlertTriangle } from 'lucide-react';
import { User } from '../types';
import { supabaseService } from '../services/supabaseService';

interface UserManagementProps {
  onBack: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
          setUsers(data.map(u => ({ ...u, userRole: mapRole(u.userRole) })));
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
      if (savedUsersStr) {
        const parsed = JSON.parse(savedUsersStr);
        setUsers(parsed.map((u: any) => ({ ...u, userRole: mapRole(u.userRole) })));
      }
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
    
    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

    if (isSupabaseConfigured) {
      try {
        await supabaseService.saveUser(updatedUser);
        setUsers(users.map(u => u.id === id ? updatedUser : u));
      } catch (error) {
        console.error('Error updating user role in Supabase:', error);
        alert('권한 변경 중 오류가 발생했습니다.');
      }
    } else {
      const updatedUsers = users.map(u => u.id === id ? updatedUser : u);
      setUsers(updatedUsers);
      localStorage.setItem('cp_users', JSON.stringify(updatedUsers));
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.affiliation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.discipline.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">User Management</p>
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-bold">이름</th>
                <th className="px-6 py-4 font-bold">연락처</th>
                <th className="px-6 py-4 font-bold">이메일</th>
                <th className="px-6 py-4 font-bold">소속 / 공종</th>
                <th className="px-6 py-4 font-bold">권한</th>
                <th className="px-6 py-4 font-bold">가입코드</th>
                <th className="px-6 py-4 font-bold">가입일</th>
                <th className="px-6 py-4 font-bold text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map((user) => (
                <motion.tr 
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {user.name.charAt(0)}
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
                      className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    >
                      <option value="골드">골드</option>
                      <option value="실버">실버</option>
                      <option value="브론즈">브론즈</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-500">
                      {user.signupCode}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                      title="회원 삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </motion.tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
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
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors font-bold"
                >
                  취소
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold"
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
