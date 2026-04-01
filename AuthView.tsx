import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Mail, Lock, User as UserIcon, Phone, Briefcase, Code, Key, ArrowRight, LogIn } from 'lucide-react';
import { User } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';

const LogoIcon = ({ size = 32, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M6 2l5 9H1l5-9z" />
    <circle cx="18" cy="6.5" r="4.5" />
    <rect x="1.5" y="13.5" width="9" height="9" rx="1.5" />
    <path d="M18 22l-5-9h10l-5 9z" />
  </svg>
);

interface AuthViewProps {
  onLogin: (user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    password: '',
    confirmPassword: '',
    affiliation: '',
    discipline: '',
    signupCode: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const mapRole = (role?: string) => {
      if (role === '관리') return '실버';
      if (role === '일반' || role === '기타' || !role) return '브론즈';
      return role as any;
    };

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    // Check if Supabase is configured
    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

    // Admin check
    if (isLogin && (
      (formData.email === 'admin@samoo.com' && formData.password === '1234qwer!') ||
      (formData.email === 'byungjun.kim@samoo.com' && formData.password === '16*7Ee0364')
    )) {
      const adminUser: User = {
        id: formData.email === 'admin@samoo.com' ? 'admin' : 'byungjun',
        name: formData.email === 'admin@samoo.com' ? '관리자' : '김병준',
        contact: '010-0000-0000',
        email: formData.email,
        affiliation: 'SAMOO',
        discipline: '관리',
        signupCode: 'ADMIN',
        role: 'admin',
        userRole: '실버',
        createdAt: new Date().toISOString()
      };
      onLogin(adminUser);
      return;
    }

    if (isSupabaseConfigured) {
      try {
        if (isLogin) {
          const user = await supabaseService.getUserByEmail(formData.email);
          if (user && user.password === formData.password) {
            onLogin({ ...user, userRole: mapRole(user.userRole) });
          } else {
            setError('이메일 또는 비밀번호가 올바르지 않습니다.');
          }
        } else {
          // Sign up
          const existingUser = await supabaseService.getUserByEmail(formData.email);
          if (existingUser) {
            setError('이미 가입된 이메일입니다.');
            return;
          }

          const newUser: User = {
            id: Date.now().toString(),
            name: formData.name,
            contact: formData.contact,
            email: formData.email,
            password: formData.password,
            affiliation: formData.affiliation,
            discipline: formData.discipline,
            signupCode: formData.signupCode,
            role: 'user',
            userRole: '브론즈',
            createdAt: new Date().toISOString()
          };

          await supabaseService.saveUser(newUser);
          alert('회원가입이 완료되었습니다. 로그인해주세요.');
          setIsLogin(true);
        }
        return;
      } catch (err: any) {
        console.error('Supabase auth error:', err);
        
        let errorMessage = '서버 오류가 발생했습니다.';
        if (err.code === '42P01') {
          errorMessage = 'Supabase에 users 테이블이 생성되지 않았습니다. SQL Editor에서 테이블을 생성해주세요.';
        } else if (err.message?.includes('row-level security')) {
          errorMessage = 'Supabase RLS(Row Level Security) 정책으로 인해 접근이 차단되었습니다. 정책을 추가하거나 RLS를 비활성화해주세요.';
        } else if (err.message?.includes('Failed to fetch')) {
          errorMessage = 'Supabase 서버에 연결할 수 없습니다. 네트워크 상태나 환경변수 설정을 확인해주세요.';
        } else {
          errorMessage = `서버 오류: ${err.message || '알 수 없는 오류'}`;
        }
        
        setError(errorMessage);
        return; // Prevent falling back to localStorage if Supabase is configured but failing
      }
    }

    // Fallback to localStorage if Supabase is not configured
    const savedUsersStr = localStorage.getItem('cp_users');
    const users: User[] = savedUsersStr ? JSON.parse(savedUsersStr) : [];

    if (isLogin) {
      const user = users.find(u => u.email === formData.email && u.password === formData.password);
      if (user) {
        onLogin({ ...user, userRole: mapRole(user.userRole) });
      } else {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    } else {
      // Sign up
      if (users.some(u => u.email === formData.email)) {
        setError('이미 가입된 이메일입니다.');
        return;
      }

      const newUser: User = {
        id: Date.now().toString(),
        name: formData.name,
        contact: formData.contact,
        email: formData.email,
        password: formData.password,
        affiliation: formData.affiliation,
        discipline: formData.discipline,
        signupCode: formData.signupCode,
        role: 'user',
        userRole: '브론즈',
        createdAt: new Date().toISOString()
      };

      const updatedUsers = [...users, newUser];
      localStorage.setItem('cp_users', JSON.stringify(updatedUsers));
      alert('회원가입이 완료되었습니다. 로그인해주세요.');
      setIsLogin(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-gray-100"
      >
        <div className="p-8 bg-blue-600 text-white text-center">
          <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-inner">
            <LogoIcon size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">S-CON</h1>
          <p className="text-blue-100 text-sm mt-1">Smart Construction Management System</p>
        </div>

        <div className="p-8">
          <div className="flex bg-gray-100 p-1 rounded-xl mb-8">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              로그인
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div 
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      name="name"
                      placeholder="이름" 
                      required={!isLogin}
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      name="contact"
                      placeholder="연락처" 
                      required={!isLogin}
                      value={formData.contact}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="email" 
                name="email"
                placeholder="이메일 주소" 
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="password" 
                name="password"
                placeholder="비밀번호" 
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
            </div>

            {!isLogin && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  name="confirmPassword"
                  placeholder="비밀번호 확인" 
                  required={!isLogin}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                />
              </div>
            )}

            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div 
                  key="signup-fields-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      name="affiliation"
                      placeholder="소속" 
                      required={!isLogin}
                      value={formData.affiliation}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Code className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      name="discipline"
                      placeholder="공종" 
                      required={!isLogin}
                      value={formData.discipline}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      name="signupCode"
                      placeholder="가입코드" 
                      required={!isLogin}
                      value={formData.signupCode}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p className="text-red-500 text-xs font-bold text-center">{error}</p>
            )}

            <button 
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {isLogin ? (
                <>
                  <LogIn size={18} />
                  <span>로그인</span>
                </>
              ) : (
                <>
                  <UserIcon size={18} />
                  <span>회원가입</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-100 text-center">
            <p className="text-gray-400 text-xs">
              © 2026 SAMOO Architects & Engineers. All rights reserved.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
