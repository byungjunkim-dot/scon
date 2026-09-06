import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  Image as ImageIcon, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  Package,
  Truck,
  Layers,
  FileSpreadsheet,
  X,
  Check,
  Lock,
  Camera,
  RotateCcw,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import { Project, AppSettings, User, ProductionPhoto, ProductionBreakdown, ProductionDayData, ProductionConfig } from '../types';
import { compressImage } from '../utils/image';
import { exportProductionStatusToExcel } from '../utils/productionExcelExport';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';

interface ProductionStatusViewProps {
  project: Project | null;
  settings: AppSettings;
  currentUser: User | null;
}

// 초기 레코드 양식 생성
const createEmptyDayData = (projectId: string, dateStr: string): ProductionDayData => ({
  id: dateStr,
  projectId,
  date: dateStr,
  steel: 0,
  single: 0,
  moduleFrame: 0,
  finished: 0,
  shipped: 0,
  photos: [],
  notes: ''
});

export const ProductionStatusView: React.FC<ProductionStatusViewProps> = ({ project, settings, currentUser }) => {
  const projectId = project?.id || 'default_project';

  // 1. 상태 선언
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // 계획 물량 관리 (전체/철골/단품/프레임/완성품/출고)
  const [plannedVolumes, setPlannedVolumes] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(`cp_production_planned_v3_${projectId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            total: Number(parsed.total) || 5000,
            steel: Number(parsed.steel) || 5000,
            single: Number(parsed.single) || 5000,
            moduleFrame: Number(parsed.moduleFrame) || 5000,
            finished: Number(parsed.finished) || 5000,
            shipped: Number(parsed.shipped) || 5000,
          };
        }
      } catch (e) {}
    }
    return {
      total: 5000,
      steel: 5000,
      single: 5000,
      moduleFrame: 5000,
      finished: 5000,
      shipped: 5000,
    };
  });

  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempPlannedInput, setTempPlannedInput] = useState<string>('');

  // 전체 날짜별 데이터 딕셔너리 ({ "YYYY-MM-DD": ProductionDayData })
  const [allDaysData, setAllDaysData] = useState<Record<string, ProductionDayData>>(() => {
    const saved = localStorage.getItem(`cp_production_data_${projectId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse production data:', e);
      }
    }
    
    // 샘플/초기 데이터
    const dateStr = new Date().toISOString().split('T')[0];
    const initialDay: ProductionDayData = {
      id: dateStr,
      projectId,
      date: dateStr,
      steel: 45,
      single: 38,
      moduleFrame: 30,
      finished: 28,
      shipped: 24,
      photos: [],
      notes: JSON.stringify([
        { category: '용접', content: '1차 조립 용접 검사 완료 및 결함부 수정 조치' },
        { category: '출고', content: '완성 프레임 24EA 현장 반출 상차 완료' }
      ]),
      breakdowns: [
        { factory: '진천공장', floor: '1층', steel: 25, single: 20, moduleFrame: 15, finished: 14, shipped: 12 },
        { factory: '진천공장', floor: '2층', steel: 20, single: 18, moduleFrame: 15, finished: 14, shipped: 12 },
      ]
    };
    return { [dateStr]: initialDay };
  });

  // 현재 선택된 날짜의 데이터
  const [currentDayData, setCurrentDayData] = useState<ProductionDayData>(() => {
    const dateStr = new Date().toISOString().split('T')[0];
    return createEmptyDayData(projectId, dateStr);
  });

  // 공장 및 층 설정 상태 선언
  const [activeFactories, setActiveFactories] = useState<string[]>(() => {
    const saved = localStorage.getItem(`cp_factories_${projectId}`);
    return saved ? JSON.parse(saved) : ['진천공장'];
  });
  const [activeFloors, setActiveFloors] = useState<string[]>(() => {
    const saved = localStorage.getItem(`cp_floors_${projectId}`);
    return saved ? JSON.parse(saved) : ['1층', '2층'];
  });

  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [newFactoryInput, setNewFactoryInput] = useState('');
  const [newFloorInput, setNewFloorInput] = useState('');

  // 모바일 전용: 현재 선택된 공장/층 탭 인덱스
  const [selectedMobileLocationIdx, setSelectedMobileLocationIdx] = useState(0);

  // 골드 등급 또는 관리자 접근 권한 확인
  const hasAdminOrGoldAccess = useMemo(() => {
    if (!currentUser) return false;
    const isAdmin = currentUser.role === 'admin';
    const isGold = currentUser.userRole === '골드';
    return isAdmin || isGold;
  }, [currentUser]);

  // 공장/층 변경 자동 저장
  useEffect(() => {
    localStorage.setItem(`cp_factories_${projectId}`, JSON.stringify(activeFactories));
  }, [activeFactories, projectId]);

  useEffect(() => {
    localStorage.setItem(`cp_floors_${projectId}`, JSON.stringify(activeFloors));
  }, [activeFloors, projectId]);

  // Supabase 비동기 데이터 로드 (다른 기기/브라우저 동기화)
  useEffect(() => {
    let isMounted = true;
    const loadSupabaseData = async () => {
      if (!project?.id) return;
      try {
        // 1. 설정 정보 불러오기 (계획수량, 활성 공장, 활성 층수)
        const config = await supabaseService.getProductionConfig(project.id);
        if (config && isMounted) {
          if (config.plannedVolumes) {
            setPlannedVolumes(config.plannedVolumes);
            localStorage.setItem(`cp_production_planned_v3_${project.id}`, JSON.stringify(config.plannedVolumes));
          }
          if (config.activeFactories && config.activeFactories.length > 0) {
            setActiveFactories(config.activeFactories);
            localStorage.setItem(`cp_factories_${project.id}`, JSON.stringify(config.activeFactories));
          }
          if (config.activeFloors && config.activeFloors.length > 0) {
            setActiveFloors(config.activeFloors);
            localStorage.setItem(`cp_floors_${project.id}`, JSON.stringify(config.activeFloors));
          }
        }

        // 2. 날짜별 제작/출고 실적 데이터 불러오기
        const daysMap = await supabaseService.getProductionDays(project.id);
        if (daysMap && Object.keys(daysMap).length > 0 && isMounted) {
          setAllDaysData(daysMap);
          localStorage.setItem(`cp_production_data_${project.id}`, JSON.stringify(daysMap));
        }
      } catch (err) {
        console.warn('Supabase 제작현황 데이터 로드 중 알림:', err);
      }
    };

    loadSupabaseData();
    return () => { isMounted = false; };
  }, [project?.id]);

  // 공장 및 층수, 계획수량 설정을 Supabase에 보존
  const persistConfigToSupabase = async (newFactories?: string[], newFloors?: string[], newPlanned?: Record<string, number>) => {
    if (!project?.id) return;
    try {
      await supabaseService.saveProductionConfig(project.id, {
        plannedVolumes: (newPlanned || plannedVolumes) as any,
        activeFactories: newFactories || activeFactories,
        activeFloors: newFloors || activeFloors,
      });
    } catch (err) {
      console.warn('Supabase 설정 저장 중 오류 (로컬 캐시 유지):', err);
    }
  };

  const handleOpenPlannedEdit = (field: string) => {
    if (!hasAdminOrGoldAccess) {
      showStatus('전체 계획물량 설정은 골드 등급 또는 관리자만 접근 가능합니다.');
      return;
    }
    setEditingField(field);
    setTempPlannedInput(String(plannedVolumes[field] || 0));
  };

  const handleToggleConfigPanel = () => {
    if (!hasAdminOrGoldAccess) {
      showStatus('공장 및 층 설정은 골드 등급 또는 관리자만 접근 가능합니다.');
      return;
    }
    setShowConfigPanel(prev => !prev);
  };

  const handleAddFactory = () => {
    if (!hasAdminOrGoldAccess) {
      showStatus('공장 설정 권한이 없습니다 (골드 등급 및 관리자 전용).');
      return;
    }
    const val = newFactoryInput.trim();
    if (!val) return;
    if (activeFactories.includes(val)) {
      showStatus('이미 존재하는 공장명입니다.');
      return;
    }
    const updated = [...activeFactories, val];
    setActiveFactories(updated);
    persistConfigToSupabase(updated, undefined, undefined);
    setNewFactoryInput('');
  };

  const handleRemoveFactory = (fact: string) => {
    if (!hasAdminOrGoldAccess) {
      showStatus('공장 설정 권한이 없습니다 (골드 등급 및 관리자 전용).');
      return;
    }
    const updated = activeFactories.filter(f => f !== fact);
    setActiveFactories(updated);
    persistConfigToSupabase(updated, undefined, undefined);
  };

  const handleAddFloor = () => {
    if (!hasAdminOrGoldAccess) {
      showStatus('층수 설정 권한이 없습니다 (골드 등급 및 관리자 전용).');
      return;
    }
    const val = newFloorInput.trim();
    if (!val) return;
    if (activeFloors.includes(val)) {
      showStatus('이미 존재하는 층명입니다.');
      return;
    }
    const updated = [...activeFloors, val];
    setActiveFloors(updated);
    persistConfigToSupabase(undefined, updated, undefined);
    setNewFloorInput('');
  };

  const handleRemoveFloor = (fl: string) => {
    if (!hasAdminOrGoldAccess) {
      showStatus('층수 설정 권한이 없습니다 (골드 등급 및 관리자 전용).');
      return;
    }
    const updated = activeFloors.filter(f => f !== fl);
    setActiveFloors(updated);
    persistConfigToSupabase(undefined, updated, undefined);
  };

  // 공장 X 층수 조합 배열 구하기 (useMemo)
  const activeCombinations = useMemo(() => {
    const list: { factory: string; floor: string }[] = [];
    const factories = activeFactories.length > 0 ? activeFactories : ['공장'];
    const floors = activeFloors.length > 0 ? activeFloors : ['1층'];
    
    factories.forEach(fact => {
      floors.forEach(fl => {
        list.push({ factory: fact, floor: fl });
      });
    });
    return list;
  }, [activeFactories, activeFloors]);

  // 현재 날짜의 세부 항목 구하기
  const currentBreakdowns = useMemo<ProductionBreakdown[]>(() => {
    const list: ProductionBreakdown[] = [];
    const existingBreakdowns = currentDayData.breakdowns || [];
    
    activeCombinations.forEach((comb, idx) => {
      const found: any = existingBreakdowns.find(b => b.factory === comb.factory && b.floor === comb.floor);
      if (found) {
        list.push({
          factory: comb.factory,
          floor: comb.floor,
          steel: Number(found.steel) || 0,
          single: Number(found.single) || 0,
          moduleFrame: Number(found.moduleFrame ?? found.module_frame) || 0,
          finished: Number(found.finished) || 0,
          shipped: Number(found.shipped) || 0,
        });
      } else {
        // 하위 호환성: 만약 첫 번째 조합이고, 이전 legacy 데이터가 존재하는 경우 여기에 매핑해줍니다.
        const isFirst = idx === 0;
        list.push({
          factory: comb.factory,
          floor: comb.floor,
          steel: isFirst ? (Number(currentDayData.steel) || 0) : 0,
          single: isFirst ? (Number(currentDayData.single) || 0) : 0,
          moduleFrame: isFirst ? (Number(currentDayData.moduleFrame) || 0) : 0,
          finished: isFirst ? (Number(currentDayData.finished) || 0) : 0,
          shipped: isFirst ? (Number(currentDayData.shipped) || 0) : 0,
        });
      }
    });
    
    return list;
  }, [currentDayData, activeCombinations]);

  // 특정 공장/층의 특정 필드 수치 업데이트 함수
  const updateBreakdownValue = (factory: string, floor: string, field: keyof Omit<ProductionBreakdown, 'factory' | 'floor'>, valStr: string) => {
    const numVal = Math.max(0, Number(valStr) || 0);
    
    const updatedBreakdowns = currentBreakdowns.map(b => {
      if (b.factory === factory && b.floor === floor) {
        return { ...b, [field]: numVal };
      }
      return b;
    });
    
    // 일일 합산 값 계산
    let sumSteel = 0;
    let sumSingle = 0;
    let sumModuleFrame = 0;
    let sumFinished = 0;
    let sumShipped = 0;
    
    updatedBreakdowns.forEach(b => {
      sumSteel += b.steel;
      sumSingle += b.single;
      sumModuleFrame += b.moduleFrame;
      sumFinished += b.finished;
      sumShipped += b.shipped;
    });
    
    setCurrentDayData(prev => ({
      ...prev,
      steel: sumSteel,
      single: sumSingle,
      moduleFrame: sumModuleFrame,
      finished: sumFinished,
      shipped: sumShipped,
      breakdowns: updatedBreakdowns
    }));
  };

  // 모바일 원터치 스텝 증감 핸들러 (+1, +5, +10, -1, -10 등)
  const handleStepBreakdownValue = (factory: string, floor: string, field: keyof Omit<ProductionBreakdown, 'factory' | 'floor'>, delta: number) => {
    const currentVal = currentBreakdowns.find(b => b.factory === factory && b.floor === floor)?.[field] || 0;
    const newVal = Math.max(0, currentVal + delta);
    updateBreakdownValue(factory, floor, field, String(newVal));
  };

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<ProductionPhoto[]>([]);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const handlePendingPhotoTitleChange = (id: string, value: string) => {
    setPendingPhotos(prev => prev.map(p => p.id === id ? { ...p, title: value } : p));
  };

  const handleDeletePendingPhoto = (id: string) => {
    setPendingPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleConfirmAddPhotos = () => {
    setCurrentDayData(prev => ({
      ...prev,
      photos: [...prev.photos, ...pendingPhotos]
    }));
    setIsPhotoModalOpen(false);
    setPendingPhotos([]);
    showStatus(`사진 ${pendingPhotos.length}장이 추가되었습니다. [저장] 버튼을 누르시면 안전하게 반영됩니다.`);
  };

  const handleCancelAddPhotos = () => {
    setIsPhotoModalOpen(false);
    setPendingPhotos([]);
  };

  // 2. 전체 데이터 불러오기 및 현재 날짜 동기화
  useEffect(() => {
    const dataForDate = allDaysData[selectedDate];
    if (dataForDate) {
      setCurrentDayData(dataForDate);
    } else {
      setCurrentDayData(createEmptyDayData(projectId, selectedDate));
    }
  }, [selectedDate, allDaysData, projectId]);

  // 알림 메시지 헬퍼
  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // 카테고리 한국어 라벨 반환 헬퍼
  const getCategoryLabel = (key: string) => {
    switch (key) {
      case 'total': return '전체';
      case 'steel': return '철골';
      case 'single': return '단품';
      case 'moduleFrame': return '프레임';
      case 'finished': return '완성품';
      case 'shipped': return '출고';
      default: return key;
    }
  };

  // 3. 누계 계산 연산 (useMemo)
  const cumulativeStats = useMemo(() => {
    let steelCum = 0;
    let singleCum = 0;
    let moduleFrameCum = 0;
    let finishedCum = 0;
    let shippedCum = 0;

    Object.keys(allDaysData).forEach((key) => {
      const day = allDaysData[key];
      if (day) {
        steelCum += Number(day.steel) || 0;
        singleCum += Number(day.single) || 0;
        moduleFrameCum += Number(day.moduleFrame) || 0;
        finishedCum += Number(day.finished) || 0;
        shippedCum += Number(day.shipped) || 0;
      }
    });

    const totalCum = steelCum + singleCum + moduleFrameCum + finishedCum + shippedCum;

    const rates = {
      total: plannedVolumes.total > 0 ? (totalCum / plannedVolumes.total) * 100 : 0,
      steel: plannedVolumes.steel > 0 ? (steelCum / plannedVolumes.steel) * 100 : 0,
      single: plannedVolumes.single > 0 ? (singleCum / plannedVolumes.single) * 100 : 0,
      moduleFrame: plannedVolumes.moduleFrame > 0 ? (moduleFrameCum / plannedVolumes.moduleFrame) * 100 : 0,
      finished: plannedVolumes.finished > 0 ? (finishedCum / plannedVolumes.finished) * 100 : 0,
      shipped: plannedVolumes.shipped > 0 ? (shippedCum / plannedVolumes.shipped) * 100 : 0,
    };

    return {
      total: totalCum,
      steel: steelCum,
      single: singleCum,
      moduleFrame: moduleFrameCum,
      finished: finishedCum,
      shipped: shippedCum,
      rates: {
        total: Math.min(100, Math.round(rates.total * 10) / 10),
        steel: Math.min(100, Math.round(rates.steel * 10) / 10),
        single: Math.min(100, Math.round(rates.single * 10) / 10),
        moduleFrame: Math.min(100, Math.round(rates.moduleFrame * 10) / 10),
        finished: Math.min(100, Math.round(rates.finished * 10) / 10),
        shipped: Math.min(100, Math.round(rates.shipped * 10) / 10),
      }
    };
  }, [allDaysData, plannedVolumes]);

  // 날짜 가감 이동
  const handleMoveDate = (days: number) => {
    const dateObj = new Date(selectedDate);
    dateObj.setDate(dateObj.getDate() + days);
    setSelectedDate(dateObj.toISOString().split('T')[0]);
  };

  // 오늘 날짜로 즉시 이동
  const handleSetToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // 모바일 날짜 포맷 (예: 2026.09.04 (금))
  const formatMobileDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = days[d.getDay()];
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}.${mm}.${dd} (${dayName})`;
    } catch {
      return dateStr;
    }
  };

  // 특기사항 구조화 파싱 및 업데이트 함수
  const structuredNotes = useMemo<{ category: string; content: string }[]>(() => {
    try {
      if (currentDayData.notes && currentDayData.notes.trim().startsWith('[')) {
        const parsed = JSON.parse(currentDayData.notes);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => ({
            category: String(item.category || '기타'),
            content: String(item.content || ''),
          }));
        }
      }
    } catch (e) {}
    // 이전 텍스트 포맷이나 공백인 경우 안전하게 마이그레이션
    return currentDayData.notes 
      ? [{ category: '기타', content: currentDayData.notes }] 
      : [{ category: '기타', content: '' }];
  }, [currentDayData.notes]);

  const updateStructuredNote = (index: number, field: 'category' | 'content', value: string) => {
    const updated = [...structuredNotes];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setCurrentDayData(prev => ({
      ...prev,
      notes: JSON.stringify(updated)
    }));
  };

  const handleAddStructuredNote = () => {
    const updated = [...structuredNotes, { category: '기타', content: '' }];
    setCurrentDayData(prev => ({
      ...prev,
      notes: JSON.stringify(updated)
    }));
  };

  const handleRemoveStructuredNote = (index: number) => {
    let updated = structuredNotes.filter((_, idx) => idx !== index);
    if (updated.length === 0) {
      updated = [{ category: '기타', content: '' }];
    }
    setCurrentDayData(prev => ({
      ...prev,
      notes: JSON.stringify(updated)
    }));
  };

  // 계획 수량 세팅 저장
  const handleSavePlanned = (key: string) => {
    if (!hasAdminOrGoldAccess) {
      showStatus('전체 계획물량 설정은 골드 등급 또는 관리자만 가능합니다.');
      setEditingField(null);
      return;
    }
    const val = Number(tempPlannedInput) || 0;
    if (val >= 0) {
      const updated = { ...plannedVolumes, [key]: val };
      
      // 전체 계획물량 설정시 하위 항목들도 따라서 자동 셋팅되도록 지원
      if (key === 'total') {
        updated.steel = val;
        updated.single = val;
        updated.moduleFrame = val;
        updated.finished = val;
        updated.shipped = val;
      }
      
      setPlannedVolumes(updated);
      localStorage.setItem(`cp_production_planned_v3_${projectId}`, JSON.stringify(updated));
      persistConfigToSupabase(undefined, undefined, updated);
      setEditingField(null);
      showStatus(`${getCategoryLabel(key)} 계획물량이 정상 반영되었습니다 (클라우드 동기화).`);
    }
  };

  // 5. 오늘의 데이터 저장 기능 (Supabase 클라우드 동기화 + 로컬스토리지 백업)
  const handleSaveCurrentDay = async () => {
    const updatedAll = {
      ...allDaysData,
      [selectedDate]: currentDayData
    };
    setAllDaysData(updatedAll);
    localStorage.setItem(`cp_production_data_${projectId}`, JSON.stringify(updatedAll));

    if (project?.id) {
      try {
        await supabaseService.saveProductionDay(project.id, currentDayData, updatedAll);
        showStatus(`${selectedDate} 제작/출고 현황이 Supabase 클라우드에 안전하게 저장되었습니다.`);
        return;
      } catch (err) {
        console.error('Supabase 저장 중 오류 (로컬 스토리지에 보관됨):', err);
        showStatus(`${selectedDate} 제작/출고 현황이 로컬 컴퓨터에 안전하게 저장되었습니다.`);
      }
    } else {
      showStatus(`${selectedDate} 제작/출고 현황이 안전하게 저장되었습니다.`);
    }
  };

  // 6. 이미지 업로드 (Supabase Storage 우선 업로드 + 압축 base64 폴백)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsCompressing(true);
    
    try {
      const filesArray: File[] = Array.from(e.target.files);
      const newPhotos: ProductionPhoto[] = [];

      for (const file of filesArray) {
        let photoUrl = '';

        // Supabase 환경변수가 설정되어 있으면 Supabase Storage 버킷('photos')에 업로드 시도
        if (isSupabaseConfigured && project?.id) {
          try {
            const fileName = `production_${project.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
            photoUrl = await supabaseService.uploadImage(file, fileName);
          } catch (storageErr) {
            console.warn('Supabase Storage 업로드 실패, 이미지 압축 base64로 대체합니다:', storageErr);
          }
        }

        // Supabase 미설정 또는 업로드 실패 시 안전하게 압축 base64 유지
        if (!photoUrl) {
          photoUrl = await compressImage(file, 500); // 500KB max size limit
        }
        
        newPhotos.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url: photoUrl,
          title: '' // 팝업창에서 사용자가 직접 설명이나 내용을 입력하도록 유도하기 위해 빈 문자열 설정
        });
      }

      setPendingPhotos(newPhotos);
      setIsPhotoModalOpen(true);
    } catch (err) {
      console.error(err);
      showStatus('사진 처리 중 오류가 발생했습니다.');
    } finally {
      setIsCompressing(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // 이미지 삭제
  const handleDeletePhoto = (photoId: string) => {
    setCurrentDayData(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== photoId)
    }));
  };

  // 이미지 설명 변경
  const handlePhotoTitleChange = (photoId: string, text: string) => {
    setCurrentDayData(prev => ({
      ...prev,
      photos: prev.photos.map(p => p.id === photoId ? { ...p, title: text } : p)
    }));
  };

  // 7. 엑셀 다운로드 (A4 출력 최적화, 1시트: 제작현황표, 2시트~: 일별 특기사항 및 사진대지)
  const handleExportToExcel = async () => {
    if (isExportingExcel) return;
    try {
      setIsExportingExcel(true);
      showStatus('엑셀 파일(A4 최적화 양식 및 사진대지)을 생성 중입니다...');
      
      await exportProductionStatusToExcel({
        project,
        plannedVolumes: {
          total: plannedVolumes.total || 0,
          steel: plannedVolumes.steel || 0,
          single: plannedVolumes.single || 0,
          moduleFrame: plannedVolumes.moduleFrame || 0,
          finished: plannedVolumes.finished || 0,
          shipped: plannedVolumes.shipped || 0,
        },
        cumulativeStats,
        allDaysData,
        exportDate: selectedDate,
        currentDayData
      });

      showStatus('엑셀 파일이 성공적으로 다운로드되었습니다.');
    } catch (error) {
      console.error('Excel Export Error:', error);
      showStatus('엑셀 내보내기 중 오류가 발생했습니다.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // 모바일 활성 공장/층 선택
  const activeMobileLocation = useMemo(() => {
    if (currentBreakdowns.length === 0) {
      return { factory: '진천공장', floor: '1층', steel: 0, single: 0, moduleFrame: 0, finished: 0, shipped: 0 };
    }
    const safeIdx = Math.min(Math.max(0, selectedMobileLocationIdx), currentBreakdowns.length - 1);
    return currentBreakdowns[safeIdx];
  }, [currentBreakdowns, selectedMobileLocationIdx]);

  // 카테고리 프리셋 리스트 for 특기사항
  const NOTE_CATEGORIES = ['기타', '절단', '용접', '도장', '누락', '자재', '출고', '포장', '보양', '위치', '고정', '부착', '치수'];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* 상태 알림 알럿 */}
      {statusMessage && (
        <div className="fixed top-4 right-4 sm:top-6 sm:right-6 bg-slate-900/95 backdrop-blur-md text-white text-xs px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2.5 font-medium border border-slate-700/50">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span>{statusMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 1. 모바일 최적화 화면 (md:hidden) : 현장 스마트폰 간편 입력 전용 UI */}
      {/* ========================================================================= */}
      <div className="block md:hidden flex-1 overflow-y-auto pb-24 p-2 space-y-2">
        
        {/* 모바일 상단 네비게이션 & 날짜 탐색기 & 5대 공정 통합 현황 카드 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 leading-tight">금일 제작·출고 현황</h2>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSetToday}
                className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
              >
                오늘
              </button>
              <button
                onClick={handleExportToExcel}
                disabled={isExportingExcel}
                className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                title="엑셀 다운로드"
              >
                <FileSpreadsheet size={15} className={isExportingExcel ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* 날짜 선택 버튼 그룹 (바탕색 제거 및 깔끔한 배치) */}
          <div className="flex items-center justify-between py-1">
            <button 
              onClick={() => handleMoveDate(-1)}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg transition-all active:scale-95 cursor-pointer"
              title="이전 날짜"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="relative flex-1 text-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
              />
              <div className="flex items-center justify-center gap-1.5 py-0.5 font-black text-xs sm:text-sm text-slate-800">
                <Calendar size={14} className="text-blue-600" />
                <span>{formatMobileDate(selectedDate)}</span>
              </div>
            </div>

            <button 
              onClick={() => handleMoveDate(1)}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg transition-all active:scale-95 cursor-pointer"
              title="다음 날짜"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 통합된 5대 공정 합계 (바탕색 없이 심플하고 정돈된 그리드) */}
          <div className="grid grid-cols-5 pt-2.5 mt-1.5 border-t border-slate-100 text-center">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-500">철골</span>
              <span className="text-xs font-black text-slate-900 mt-0.5">
                {(currentDayData.steel || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col items-center border-l border-slate-100">
              <span className="text-[10px] font-bold text-slate-500">단품</span>
              <span className="text-xs font-black text-slate-900 mt-0.5">
                {(currentDayData.single || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col items-center border-l border-slate-100">
              <span className="text-[10px] font-bold text-slate-500">프레임</span>
              <span className="text-xs font-black text-slate-900 mt-0.5">
                {(currentDayData.moduleFrame || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col items-center border-l border-slate-100">
              <span className="text-[10px] font-bold text-slate-500">완성품</span>
              <span className="text-xs font-black text-slate-900 mt-0.5">
                {(currentDayData.finished || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col items-center border-l border-slate-100">
              <span className="text-[10px] font-bold text-slate-500">출고</span>
              <span className="text-xs font-black text-blue-600 mt-0.5">
                {(currentDayData.shipped || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* [모바일 통합 카드] 공장 선택 + 공정별 간편 수량 입력 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs space-y-3">
          {/* 공장 선택 영역 (철골 입력란 상단 배치) */}
          <div className="space-y-2">
            <h3 className="text-sm font-black text-slate-800">수량 입력</h3>

            {/* 공장 탭 바 (가로 스크롤 - 공장명만 표기) */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
              {currentBreakdowns.map((b, idx) => {
                const isSelected = idx === selectedMobileLocationIdx;
                const totalSum = (b.steel || 0) + (b.single || 0) + (b.moduleFrame || 0) + (b.finished || 0) + (b.shipped || 0);
                return (
                  <button
                    key={`${b.factory}-${b.floor}`}
                    onClick={() => setSelectedMobileLocationIdx(idx)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 ring-2 ring-blue-600/30'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60'
                    }`}
                  >
                    <span>{b.factory}</span>
                    {totalSum > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelected ? 'bg-blue-700 text-white' : 'bg-white text-blue-600 border border-slate-200'
                      }`}>
                        {totalSum}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 공정별 수량 입력 영역 (가로 5개 컬럼 한 행 배치) */}
          <div className="pt-2.5 border-t border-slate-100">
            <div className="grid grid-cols-5 gap-1.5">
              {/* 1. 철골 */}
              <div className="flex flex-col items-center">
                <label className="text-[11px] font-bold text-slate-600 mb-1">철골</label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={activeMobileLocation.steel === 0 ? '' : activeMobileLocation.steel}
                  onChange={(e) => updateBreakdownValue(activeMobileLocation.factory, activeMobileLocation.floor, 'steel', e.target.value)}
                  placeholder="0"
                  className="w-full text-center text-sm font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-0.5 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                />
              </div>

              {/* 2. 단품 */}
              <div className="flex flex-col items-center">
                <label className="text-[11px] font-bold text-slate-600 mb-1">단품</label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={activeMobileLocation.single === 0 ? '' : activeMobileLocation.single}
                  onChange={(e) => updateBreakdownValue(activeMobileLocation.factory, activeMobileLocation.floor, 'single', e.target.value)}
                  placeholder="0"
                  className="w-full text-center text-sm font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-0.5 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                />
              </div>

              {/* 3. 프레임 */}
              <div className="flex flex-col items-center">
                <label className="text-[11px] font-bold text-slate-600 mb-1">프레임</label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={activeMobileLocation.moduleFrame === 0 ? '' : activeMobileLocation.moduleFrame}
                  onChange={(e) => updateBreakdownValue(activeMobileLocation.factory, activeMobileLocation.floor, 'moduleFrame', e.target.value)}
                  placeholder="0"
                  className="w-full text-center text-sm font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-0.5 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                />
              </div>

              {/* 4. 완성품 */}
              <div className="flex flex-col items-center">
                <label className="text-[11px] font-bold text-slate-600 mb-1">완성품</label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={activeMobileLocation.finished === 0 ? '' : activeMobileLocation.finished}
                  onChange={(e) => updateBreakdownValue(activeMobileLocation.factory, activeMobileLocation.floor, 'finished', e.target.value)}
                  placeholder="0"
                  className="w-full text-center text-sm font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-0.5 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                />
              </div>

              {/* 5. 출고 */}
              <div className="flex flex-col items-center">
                <label className="text-[11px] font-bold text-slate-600 mb-1">출고</label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={activeMobileLocation.shipped === 0 ? '' : activeMobileLocation.shipped}
                  onChange={(e) => updateBreakdownValue(activeMobileLocation.factory, activeMobileLocation.floor, 'shipped', e.target.value)}
                  placeholder="0"
                  className="w-full text-center text-sm font-black text-blue-600 bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-0.5 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 모바일 특기사항 섹션 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">
              특기사항 ({structuredNotes.length}건)
            </h3>
            <button
              onClick={handleAddStructuredNote}
              className="flex items-center gap-1 px-2.5 py-1 text-blue-600 bg-blue-50 hover:bg-blue-100 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
            >
              <Plus size={12} />
              <span>항목 추가</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {structuredNotes.map((note, index) => (
              <div key={index} className="flex items-center gap-1.5">
                {/* 카테고리 선택 풀다운 메뉴 (입력란 좌측 배치) */}
                <select
                  value={note.category}
                  onChange={(e) => updateStructuredNote(index, 'category', e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none shrink-0 cursor-pointer shadow-2xs"
                >
                  {NOTE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* 텍스트 인풋 */}
                <input
                  type="text"
                  value={note.content}
                  onChange={(e) => updateStructuredNote(index, 'content', e.target.value)}
                  placeholder="특기사항 내용을 입력해 주세요."
                  className="flex-1 min-w-0 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />

                {/* 항목 삭제 버튼 */}
                <button
                  onClick={() => handleRemoveStructuredNote(index)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer shrink-0 transition-colors"
                  title="항목 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 모바일 현황 사진 업로드 섹션 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">
              현황 사진 ({currentDayData.photos.length}장)
            </h3>
            <label className="flex items-center gap-1 px-2.5 py-1 text-blue-600 bg-blue-50 hover:bg-blue-100 text-[11px] font-bold rounded-lg transition-colors cursor-pointer">
              <Plus size={12} />
              <span>사진 추가</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {isCompressing && (
            <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-1">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
              <p className="text-[10px] font-medium text-slate-500">모바일 전송 최적화 이미지 압축 중...</p>
            </div>
          )}

          {/* 사진 썸네일 그리드 */}
          {currentDayData.photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {currentDayData.photos.map((photo) => (
                <div key={photo.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col">
                  <div className="relative aspect-video bg-slate-900 overflow-hidden">
                    <img 
                      src={photo.url} 
                      alt={photo.title}
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-1 right-1 bg-red-600/90 text-white p-1 rounded-md shadow-xs active:scale-95 cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div className="p-1.5 bg-white">
                    <input
                      type="text"
                      value={photo.title}
                      onChange={(e) => handlePhotoTitleChange(photo.id, e.target.value)}
                      placeholder="사진 설명 입력"
                      className="w-full text-[11px] font-bold text-slate-800 border-0 border-b border-slate-100 hover:border-slate-300 focus:border-blue-500 px-1 py-0.5 focus:ring-0 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-slate-400 text-xs font-medium">
              등록된 현장 사진이 없습니다.
            </div>
          )}
        </div>

        {/* 모바일 하단 고정 플로팅 저장 바 (Floating Bottom Bar) */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 p-3 z-40 shadow-xl">
          <button
            onClick={handleSaveCurrentDay}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 active:scale-98 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Save size={16} />
            <span>오늘 현황 저장</span>
          </button>
        </div>
      </div>


      {/* ========================================================================= */}
      {/* 2. 데스크톱 & 태블릿 화면 (hidden md:block) : 종합 대시보드 및 스프레드시트 */}
      {/* ========================================================================= */}
      <div className="hidden md:block flex-1 overflow-y-auto p-6 space-y-6 max-w-[1280px] mx-auto w-full">
        
        {/* [목차 1] 전체 현황 대시보드 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-5 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span>전체 현황</span>
              </h2>
            </div>
            
            {/* 전체 계획물량 설정 및 엑셀 내보내기 그룹 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 text-xs bg-slate-50 px-3 py-1.5 rounded-lg ">
                <span className="text-slate-600 font-semibold">전체 계획물량 설정:</span>
                {editingField === 'total' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={tempPlannedInput}
                      onChange={(e) => setTempPlannedInput(e.target.value)}
                      className="w-20 px-2 py-0.5 border border-gray-300 rounded text-xs text-right font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSavePlanned('total');
                        if (e.key === 'Escape') setEditingField(null);
                      }}
                      autoFocus
                    />
                    <button 
                      onClick={() => handleSavePlanned('total')}
                      className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-blue-700 cursor-pointer"
                    >
                      확인
                    </button>
                    <button 
                      onClick={() => setEditingField(null)}
                      className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold hover:bg-gray-300 cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <strong className="text-slate-900 font-extrabold">{(plannedVolumes.total || 0).toLocaleString()} 개</strong>
                    <button 
                      onClick={() => handleOpenPlannedEdit('total')}
                      className={`font-bold hover:underline cursor-pointer flex items-center gap-1 transition-colors ${
                        hasAdminOrGoldAccess 
                          ? 'text-blue-600 hover:text-blue-800' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title={hasAdminOrGoldAccess ? '전체 계획물량 설정' : '골드 등급 및 관리자만 설정 가능'}
                    >
                      {!hasAdminOrGoldAccess && <Lock size={11} className="text-gray-400 inline" />}
                      <span>[설정]</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 엑셀 내보내기 버튼 */}
              <button
                onClick={handleExportToExcel}
                disabled={isExportingExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 transition-all cursor-pointer"
                title="A4 최적화 엑셀 리포트 및 사진대지 다운로드"
              >
                <FileSpreadsheet size={14} className={isExportingExcel ? 'animate-pulse' : ''} />
                <span>{isExportingExcel ? '엑셀 생성 중...' : '엑셀 내보내기'}</span>
              </button>
            </div>
          </div>

          {/* 5분할 격자 레이아웃 (철골 / 단품 / 프레임 / 완성품 / 출고) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {['steel', 'single', 'moduleFrame', 'finished', 'shipped'].map((key) => {
              const label = getCategoryLabel(key);
              const totalVolume = plannedVolumes[key] || 0;
              const cumulativeVolume = cumulativeStats[key === 'total' ? 'total' : key as keyof typeof cumulativeStats] as number || 0;
              const progressRate = cumulativeStats.rates[key === 'total' ? 'total' : key as keyof typeof cumulativeStats.rates] || 0;
              
              // 각 카테고리별 테마 스타일 설정
              let bgClass = 'bg-blue-50/40 border-blue-100/70';
              let textClass = 'text-blue-600';
              let barColor = 'bg-blue-500';
              let barBg = 'bg-blue-100';
              let IconComponent = Package;
              
              if (key === 'steel') {
                bgClass = 'bg-indigo-50/40 border-indigo-100/70';
                textClass = 'text-indigo-600';
                barColor = 'bg-indigo-500';
                barBg = 'bg-indigo-100';
                IconComponent = Layers;
              } else if (key === 'single') {
                bgClass = 'bg-emerald-50/40 border-emerald-100/70';
                textClass = 'text-emerald-600';
                barColor = 'bg-emerald-500';
                barBg = 'bg-emerald-100';
                IconComponent = FileText;
              } else if (key === 'moduleFrame') {
                bgClass = 'bg-sky-50/40 border-sky-100/70';
                textClass = 'text-sky-600';
                barColor = 'bg-sky-500';
                barBg = 'bg-sky-100';
                IconComponent = Package;
              } else if (key === 'finished') {
                bgClass = 'bg-teal-50/40 border-teal-100/70';
                textClass = 'text-teal-600';
                barColor = 'bg-teal-500';
                barBg = 'bg-teal-100';
                IconComponent = Check;
              } else if (key === 'shipped') {
                bgClass = 'bg-amber-50/40 border-amber-100/70';
                textClass = 'text-amber-600';
                barColor = 'bg-amber-500';
                barBg = 'bg-amber-100';
                IconComponent = Truck;
              }

              return (
                <div 
                  key={key} 
                  className={`p-4 rounded-xl border ${bgClass} flex flex-col justify-between transition-all hover:shadow-md relative group`}
                >
                  {/* 카드 헤더 */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-1.5">
                      <IconComponent size={15} className={textClass} />
                      <span className="text-xs font-bold text-gray-700">{label}</span>
                    </div>
                  </div>

                  {/* 세 개의 지표(총 물량, 누계 제작물량, 진행률)를 모아서 시각화 */}
                  <div className="space-y-2.5">
                    {/* 1 & 2 통합. 누계 수량 */}
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-gray-400 font-medium">누계수량</span>
                      <div className="flex items-baseline gap-0.5">
                        <span className={`text-sm font-black ${textClass}`}>{cumulativeVolume.toLocaleString()}개</span>
                        <span className="text-[10px] text-gray-400 font-medium">/총{totalVolume.toLocaleString()}개</span>
                      </div>
                    </div>

                    {/* 3. 진행률 & 프로그레스 바 */}
                    <div className="pt-2 border-t border-gray-100/40">
                      <div className="flex justify-between text-[10px] mb-1 font-semibold">
                        <span className="text-gray-400">진행률</span>
                        <span className={textClass}>{progressRate}%</span>
                      </div>
                      <div className={`w-full ${barBg} rounded-full h-1.5 overflow-hidden`}>
                        <div 
                          className={`${barColor} h-1.5 rounded-full transition-all duration-500`} 
                          style={{ width: `${progressRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* [목차 2] 금일 제작 및 현황 관리 통합 카드 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span>금일 제작 현황</span>
              </h2>
              
              {/* 날짜 선택 및 검색 컨트롤 */}
              <div className="flex items-center gap-1 bg-slate-150 rounded-lg p-0.5">
                <button 
                  onClick={() => handleMoveDate(-1)}
                  className="p-1 text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                  title="이전 날짜"
                >
                  <ChevronLeft size={13} />
                </button>
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-[12px] font-bold text-gray-800 bg-white border border-gray-100 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <button 
                  onClick={() => handleMoveDate(1)}
                  className="p-1 text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                  title="다음 날짜"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* 오늘 현황 저장 버튼 배치 */}
            <button
              onClick={handleSaveCurrentDay}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-200 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Save size={14} />
              <span>저장</span>
            </button>
          </div>

          {/* 전체 합계 현황 요약 보드 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <div className="bg-indigo-50/30 rounded-lg p-2.5 text-center border border-indigo-100/50">
              <span className="text-[12px] font-bold text-indigo-500 block mb-0.5">철골</span>
              <span className="text-sm font-extrabold text-indigo-700 block">
                {(currentDayData.steel || 0).toLocaleString()}
                <span className="text-[9px] font-normal text-slate-400 ml-0.5">개</span>
              </span>
            </div>
            <div className="bg-emerald-50/30 rounded-lg p-2.5 text-center border border-emerald-100/50">
              <span className="text-[12px] font-bold text-emerald-500 block mb-0.5">단품</span>
              <span className="text-sm font-extrabold text-emerald-700 block">
                {(currentDayData.single || 0).toLocaleString()}
                <span className="text-[9px] font-normal text-slate-400 ml-0.5">개</span>
              </span>
            </div>
            <div className="bg-sky-50/30 rounded-lg p-2.5 text-center border border-sky-100/50">
              <span className="text-[12px] font-bold text-sky-500 block mb-0.5">프레임</span>
              <span className="text-sm font-extrabold text-sky-700 block">
                {(currentDayData.moduleFrame || 0).toLocaleString()}
                <span className="text-[9px] font-normal text-slate-400 ml-0.5">개</span>
              </span>
            </div>
            <div className="bg-teal-50/30 rounded-lg p-2.5 text-center border border-teal-100/50">
              <span className="text-[12px] font-bold text-teal-600 block mb-0.5">완성품</span>
              <span className="text-sm font-extrabold text-teal-700 block">
                {(currentDayData.finished || 0).toLocaleString()}
                <span className="text-[9px] font-normal text-teal-500 ml-0.5">개</span>
              </span>
            </div>
            <div className="bg-amber-50/30 rounded-lg p-2.5 text-center border border-amber-100/50">
              <span className="text-[12px] font-bold text-amber-600 block mb-0.5">출고</span>
              <span className="text-sm font-extrabold text-amber-700 block">
                {(currentDayData.shipped || 0).toLocaleString()}
                <span className="text-[9px] font-normal text-amber-500 ml-0.5">개</span>
              </span>
            </div>
          </div>

          {/* 데스크톱: 금일 제작 및 출고 수량 입력 (공장별/층별 스프레드시트) */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
              <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span>금일 수량 입력 (공장 및 층별 세부 실적)</span>
              </h3>
              <button
                onClick={handleToggleConfigPanel}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold border rounded-lg transition-colors cursor-pointer ${
                  showConfigPanel 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : hasAdminOrGoldAccess
                      ? 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                }`}
                title={hasAdminOrGoldAccess ? `공장 및 층 설정 ${showConfigPanel ? '닫기' : '열기'}` : '골드 등급 및 관리자만 접근 가능'}
              >
                {hasAdminOrGoldAccess ? <Settings size={12} /> : <Lock size={12} className="text-gray-400" />}
                <span>공장 및 층 설정 {showConfigPanel ? '닫기' : '열기'}</span>
                {!hasAdminOrGoldAccess && (
                  <span className="text-[9px] px-1 py-0.2 bg-amber-50 text-amber-700 border border-amber-200/60 rounded font-medium ml-0.5">
                    골드/관리자
                  </span>
                )}
              </button>
            </div>

            {/* 공장 및 층 설정 접이식 패널 */}
            <AnimatePresence>
              {showConfigPanel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 공장 설정 */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">공장 리스트</span>
                        <span className="text-[10px] text-slate-400">설정이 없을 경우 빈 칸으로 표시됩니다</span>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newFactoryInput}
                          onChange={(e) => setNewFactoryInput(e.target.value)}
                          placeholder="새 공장명 (예: 진천공장)"
                          className="flex-1 text-xs border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleAddFactory}
                          className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 cursor-pointer"
                        >
                          추가
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-white rounded-lg border border-slate-100">
                        {activeFactories.map(fact => (
                          <span key={fact} className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded border border-slate-200">
                            <span>{fact}</span>
                            <button
                              onClick={() => handleRemoveFactory(fact)}
                              className="text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 층 설정 */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">층수 리스트</span>
                        <span className="text-[10px] text-slate-400">설정이 없을 경우 빈 칸으로 표시됩니다</span>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newFloorInput}
                          onChange={(e) => setNewFloorInput(e.target.value)}
                          placeholder="새 층명 (예: 1층)"
                          className="flex-1 text-xs border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleAddFloor}
                          className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 cursor-pointer"
                        >
                          추가
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-white rounded-lg border border-slate-100">
                        {activeFloors.map(fl => (
                          <span key={fl} className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded border border-slate-200">
                            <span>{fl}</span>
                            <button
                              onClick={() => handleRemoveFloor(fl)}
                              className="text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 메인 스프레드시트 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-gray-500 border-collapse">
                <thead className="text-[11px] uppercase text-gray-700 bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-bold text-gray-700 w-28 text-center">공장</th>
                    <th scope="col" className="px-3 py-2.5 font-bold text-gray-700 w-24 text-center">위치(층)</th>
                    <th scope="col" className="px-3 py-2.5 font-bold text-indigo-700 text-right">철골</th>
                    <th scope="col" className="px-3 py-2.5 font-bold text-emerald-700 text-right">단품</th>
                    <th scope="col" className="px-3 py-2.5 font-bold text-sky-700 text-right">프레임</th>
                    <th scope="col" className="px-3 py-2.5 font-bold text-teal-700 text-right">완성품</th>
                    <th scope="col" className="px-3 py-2.5 font-bold text-amber-700 text-right">출고</th>
                  </tr>
                </thead>
                <tbody>
                  {currentBreakdowns.map((b) => (
                    <tr key={`${b.factory}-${b.floor}`} className="bg-white border-b border-gray-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2 text-center font-bold text-gray-700 bg-slate-50/30">
                        {b.factory}
                      </td>
                      <td className="px-3 py-2 text-center font-medium text-gray-600 bg-slate-50/30">
                        {b.floor}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          value={b.steel || ''}
                          onChange={(e) => updateBreakdownValue(b.factory, b.floor, 'steel', e.target.value)}
                          placeholder="0"
                          className="w-full text-xs text-right border-0 bg-slate-50/40 hover:bg-slate-100/60 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1.5 focus:outline-none transition-all font-semibold"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          value={b.single || ''}
                          onChange={(e) => updateBreakdownValue(b.factory, b.floor, 'single', e.target.value)}
                          placeholder="0"
                          className="w-full text-xs text-right border-0 bg-slate-50/40 hover:bg-slate-100/60 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded px-2 py-1.5 focus:outline-none transition-all font-semibold"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          value={b.moduleFrame || ''}
                          onChange={(e) => updateBreakdownValue(b.factory, b.floor, 'moduleFrame', e.target.value)}
                          placeholder="0"
                          className="w-full text-xs text-right border-0 bg-slate-50/40 hover:bg-slate-100/60 focus:bg-white focus:ring-1 focus:ring-sky-500 rounded px-2 py-1.5 focus:outline-none transition-all font-semibold"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          value={b.finished || ''}
                          onChange={(e) => updateBreakdownValue(b.factory, b.floor, 'finished', e.target.value)}
                          placeholder="0"
                          className="w-full text-xs text-right border-0 bg-teal-50/20 hover:bg-teal-50/40 focus:bg-white text-teal-700 focus:ring-1 focus:ring-teal-500 rounded px-2 py-1.5 focus:outline-none transition-all font-bold"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          value={b.shipped || ''}
                          onChange={(e) => updateBreakdownValue(b.factory, b.floor, 'shipped', e.target.value)}
                          placeholder="0"
                          className="w-full text-xs text-right border-0 bg-amber-50/20 hover:bg-amber-50/40 focus:bg-white text-amber-700 focus:ring-1 focus:ring-amber-500 rounded px-2 py-1.5 focus:outline-none transition-all font-bold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 font-medium">※ 수량 입력 후 상단의 [저장] 버튼을 누르시면 변경사항이 영구 저장됩니다.</p>
          </div>

          {/* 하단 2분할 레이아웃: [특기사항] & [현황 사진 업로드] */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-5">
            {/* 1) 특기사항*/}
            <div className="flex flex-col space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>특기사항</span>
                </h3>
                <button
                  onClick={handleAddStructuredNote}
                  className="flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-100 text-[10px] font-bold transition-all cursor-pointer"
                >
                  <Plus size={12} />
                  <span>항목 추가</span>
                </button>
              </div>

              <div className="flex-1 space-y-1 max-h-[280px] overflow-y-auto pr-1">
                {structuredNotes.map((note, index) => (
                  <div key={index} className="flex gap-2 items-center py-1 relative group">
                    <select
                      value={note.category}
                      onChange={(e) => updateStructuredNote(index, 'category', e.target.value)}
                      className="text-xs font-bold text-gray-700 border-0 bg-slate-50 hover:bg-slate-100 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none shrink-0 cursor-pointer"
                    >
                      {NOTE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={note.content}
                      onChange={(e) => updateStructuredNote(index, 'content', e.target.value)}
                      placeholder="예: 철판 자재 수급 지연으로 절단 공정 2시간 대기"
                      className="flex-1 text-xs border-0 bg-slate-50/50 hover:bg-slate-100/50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-2.5 py-1 focus:outline-none transition-all"
                    />

                    <button
                      onClick={() => handleRemoveStructuredNote(index)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0 cursor-pointer"
                      title="항목 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 2) 현황 사진 업로드 */}
            <div className="flex flex-col space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>현황 사진 업로드</span>
                </h3>
                <label className="flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-100 text-[10px] font-bold transition-all cursor-pointer">
                  <ImageIcon size={12} />
                  <span>사진 추가</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex-1">
                {isCompressing && (
                  <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center space-y-1 mb-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                    <p className="text-[10px] font-medium text-gray-500">이미지 압축 중...</p>
                  </div>
                )}

                {currentDayData.photos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[280px] overflow-y-auto pr-1">
                    {currentDayData.photos.map((photo) => (
                      <div key={photo.id} className="group relative bg-gray-50 rounded-lg border border-gray-200 overflow-hidden shadow-xs flex flex-col justify-between">
                        <div className="relative aspect-video bg-slate-900 overflow-hidden">
                          <img 
                            src={photo.url} 
                            alt={photo.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            referrerPolicy="no-referrer"
                          />
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="absolute top-1 right-1 bg-red-600/90 text-white p-1 rounded hover:bg-red-700 transition-all shadow-md opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <div className="p-1 bg-white">
                          <input
                            type="text"
                            value={photo.title}
                            onChange={(e) => handlePhotoTitleChange(photo.id, e.target.value)}
                            placeholder="사진 설명 입력"
                            className="w-full text-[10px] font-bold text-gray-800 border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-500 px-1 py-0.5 focus:ring-0 focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-gray-50 rounded-xl flex flex-col items-center justify-center space-y-1 min-h-[140px]">
                    <ImageIcon size={24} className="text-gray-300" />
                    <div className="space-y-0.5">
                      <h4 className="text-[11px] font-bold text-gray-800">업로드된 현황사진이 없습니다</h4>
                      <p className="text-[9px] text-gray-500">촬영 사진을 추가해 주세요.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 사진 내용 입력 모달 팝업 (모바일/데스크톱 공용) */}
      <AnimatePresence>
        {isPhotoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            {/* 배경 레이어 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelAddPhotos}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            {/* 모달 박스 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden z-10"
            >
              {/* 모달 헤더 */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg">
                    <ImageIcon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">현황 사진 설명 입력</h3>
                    <p className="text-[11px] text-gray-500 font-medium">추가한 사진의 설명 또는 세부 내용을 기재해 주세요.</p>
                  </div>
                </div>
                <button
                  onClick={handleCancelAddPhotos}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 모달 본문 (스크롤 영역) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {pendingPhotos.length > 0 ? (
                  pendingPhotos.map((photo, idx) => (
                    <div 
                      key={photo.id} 
                      className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors relative group"
                    >
                      {/* 사진 미리보기 */}
                      <div className="relative w-full sm:w-40 aspect-video sm:aspect-auto sm:h-24 bg-slate-900 rounded-lg overflow-hidden shrink-0 shadow-sm border border-gray-200">
                        <img
                          src={photo.url}
                          alt="미리보기"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute bottom-1.5 left-1.5 bg-slate-900/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                          #{idx + 1}
                        </span>
                      </div>

                      {/* 입력 폼 */}
                      <div className="flex-1 flex flex-col justify-between py-0.5">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-600 block">사진 설명 / 내용</label>
                          <textarea
                            value={photo.title}
                            onChange={(e) => handlePendingPhotoTitleChange(photo.id, e.target.value)}
                            placeholder="예: 철골 제작 2구간 도장 완료 상태 확인, 출고 대기 중"
                            className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all resize-none h-16 leading-relaxed bg-white"
                          />
                        </div>
                      </div>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleDeletePendingPhoto(photo.id)}
                        className="absolute top-2 right-2 p-1 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg border border-gray-200 transition-colors shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                        title="이 사진 제외"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                    <ImageIcon size={32} className="text-gray-300" />
                    <p className="text-xs text-gray-500">추가할 사진이 없습니다.</p>
                  </div>
                )}
              </div>

              {/* 모달 푸터 */}
              <div className="px-5 py-3.5 border-t border-gray-100 bg-slate-50/50 flex items-center justify-between">
                <span className="text-[11px] text-gray-500 font-medium">
                  총 <strong className="text-blue-600 font-bold">{pendingPhotos.length}장</strong>의 사진
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelAddPhotos}
                    className="px-3.5 py-2 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleConfirmAddPhotos}
                    disabled={pendingPhotos.length === 0}
                    className={`flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-sm active:scale-95 cursor-pointer ${
                      pendingPhotos.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Check size={14} />
                    <span>추가 완료</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
