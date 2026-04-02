import React, { useState } from 'react';
import { X, User as UserIcon, Lock, Save, Shield, Mail, Phone, Building2, Briefcase, Edit2 } from 'lucide-react';
import { User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateUser: (updatedUser: User) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editContact, setEditContact] = useState(user.contact);
  const [editAffiliation, setEditAffiliation] = useState(user.affiliation);
  const [editDiscipline, setEditDiscipline] = useState(user.discipline);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  if (!isOpen) return null;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (user.password !== currentPassword) {
      setError('현재 비밀번호가 올바르지 않습니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    try {
      const updatedUser = { ...user, password: newPassword };
      
      if (isSupabaseConfigured) {
        await supabaseService.saveUser(updatedUser);
      } else {
        const savedUsersStr = localStorage.getItem('cp_users');
        if (savedUsersStr) {
          const users: User[] = JSON.parse(savedUsersStr);
          const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
          localStorage.setItem('cp_users', JSON.stringify(updatedUsers));
        }
      }

      onUpdateUser(updatedUser);
      setSuccess('비밀번호가 성공적으로 변경되었습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setIsChangingPassword(false), 2000);
    } catch (err: any) {
      setError('비밀번호 변경 중 오류가 발생했습니다.');
      console.error(err);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    try {
      const updatedUser = { 
        ...user, 
        contact: editContact,
        affiliation: editAffiliation,
        discipline: editDiscipline
      };
      
      if (isSupabaseConfigured) {
        await supabaseService.saveUser(updatedUser);
      } else {
        const savedUsersStr = localStorage.getItem('cp_users');
        if (savedUsersStr) {
          const users: User[] = JSON.parse(savedUsersStr);
          const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
          localStorage.setItem('cp_users', JSON.stringify(updatedUsers));
        }
      }

      onUpdateUser(updatedUser);
      setProfileSuccess('프로필 정보가 성공적으로 변경되었습니다.');
      setTimeout(() => {
        setIsEditingProfile(false);
        setProfileSuccess('');
      }, 2000);
    } catch (err: any) {
      setProfileError('프로필 변경 중 오류가 발생했습니다.');
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-blue-600" />
            내 프로필 정보
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* User Info Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-inner">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800">{user.name}</h3>
                <p className="text-xs text-blue-600 font-medium">{user.userRole} 등급</p>
              </div>
              {!isEditingProfile && (
                <button 
                  onClick={() => setIsEditingProfile(true)}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                  title="프로필 수정"
                >
                  <Edit2 size={18} />
                </button>
              )}
            </div>

            {!isEditingProfile ? (
              <div className="grid grid-cols-1 gap-3">
                <InfoItem icon={<Mail size={16} />} label="이메일" value={user.email} />
                <InfoItem icon={<Phone size={16} />} label="연락처" value={user.contact} />
                <InfoItem icon={<Building2 size={16} />} label="소속" value={user.affiliation} />
                <InfoItem icon={<Briefcase size={16} />} label="공종" value={user.discipline} />
              </div>
            ) : (
              <form onSubmit={handleProfileUpdate} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Edit2 size={16} className="text-blue-600" />
                    프로필 수정
                  </h3>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setEditContact(user.contact);
                      setEditAffiliation(user.affiliation);
                      setEditDiscipline(user.discipline);
                      setProfileError('');
                      setProfileSuccess('');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    취소
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">연락처</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text"
                        value={editContact}
                        onChange={(e) => setEditContact(e.target.value)}
                        className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">소속</label>
                    <div className="relative">
                      <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text"
                        value={editAffiliation}
                        onChange={(e) => setEditAffiliation(e.target.value)}
                        className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">공종</label>
                    <div className="relative">
                      <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text"
                        value={editDiscipline}
                        onChange={(e) => setEditDiscipline(e.target.value)}
                        className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                {profileError && <p className="text-red-500 text-xs font-bold">{profileError}</p>}
                {profileSuccess && <p className="text-green-500 text-xs font-bold">{profileSuccess}</p>}

                <button 
                  type="submit"
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  프로필 저장
                </button>
              </form>
            )}
          </div>

          {/* Password Change Section */}
          <div className="pt-6 border-t">
            {!isChangingPassword ? (
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="w-full py-3 px-4 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <Lock size={18} />
                비밀번호 변경하기
              </button>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Shield size={16} className="text-blue-600" />
                    비밀번호 변경
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setIsChangingPassword(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    취소
                  </button>
                </div>

                <div className="space-y-3">
                  <input 
                    type="password"
                    placeholder="현재 비밀번호"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                  <input 
                    type="password"
                    placeholder="새 비밀번호"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                  <input 
                    type="password"
                    placeholder="새 비밀번호 확인"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                {success && <p className="text-green-500 text-xs font-bold">{success}</p>}

                <button 
                  type="submit"
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  비밀번호 저장
                </button>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
    <div className="text-slate-400">{icon}</div>
    <div className="flex-1">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
      <p className="text-sm text-slate-700 font-medium">{value}</p>
    </div>
  </div>
);
