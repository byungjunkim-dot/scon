import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Mic,
  Save,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { Project, User } from '../types';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured as hasSupabase } from '../lib/supabase';
import { ConfirmModal } from './ConfirmModal';

export type QuickMemoCategory =
  | '안전'
  | '품질'
  | '공정'
  | '설계'
  | '자재'
  | '장비'
  | '민원'
  | '기타';

export type QuickMemoSeverity = '낮음' | '중간' | '높음' | '긴급';

export type QuickMemoStatus = 'open' | 'reviewed' | 'resolved' | 'dismissed';

export interface QuickMemoPhoto {
  id: string;
  url: string;
  title?: string;
  description?: string;
  category?: string;
  subCategory?: string;

  // Supabase Storage에 업로드된 파일 경로
  storagePath?: string;

  // true이면 브라우저 미리보기용 base64 이미지입니다.
  // 이 사진은 Supabase quick_memos 테이블에는 저장하지 않습니다.
  isLocalOnly?: boolean;
}

export interface QuickMemo {
  id: string;
  projectId: string;
  date: string;

  rawText: string;
  audioUrl?: string;
  photos: QuickMemoPhoto[];

  aiTitle: string;
  aiSummary: string;
  category: QuickMemoCategory;
  severity: QuickMemoSeverity;

  location?: string;
  dongBlock?: string;
  floor?: string;
  zone?: string;

  recommendedAction?: string;
  designFeedback?: string;
  dailyIssueText?: string;

  status: QuickMemoStatus;

  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

interface AiDraft {
  aiTitle: string;
  aiSummary: string;
  category: QuickMemoCategory;
  severity: QuickMemoSeverity;
  location?: string;
  dongBlock?: string;
  floor?: string;
  zone?: string;
  recommendedAction?: string;
  designFeedback?: string;
  dailyIssueText?: string;
  tags?: string[];
}

interface QuickMemoModalProps {
  isOpen: boolean;
  project: Project | null;
  currentUser?: User | null;
  initialDate?: string;
  onClose: () => void;
  onSaved: (memo: QuickMemo) => void;
}

const CATEGORIES: QuickMemoCategory[] = [
  '안전',
  '품질',
  '공정',
  '설계',
  '자재',
  '장비',
  '민원',
  '기타',
];

const SEVERITIES: QuickMemoSeverity[] = ['낮음', '중간', '높음', '긴급'];

const getToday = () => new Date().toISOString().split('T')[0];

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const isSupabaseReady = () => {
  return hasSupabase;
};

const compressImageToBase64 = (
  file: File,
  maxWidth = 1200,
  quality = 0.78
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');

        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('이미지 처리에 실패했습니다.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
      img.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
};

const dataUrlToBlob = async (dataUrl: string) => {
  const [header, base64Data] = dataUrl.split(',');

  if (!header || !base64Data) {
    throw new Error('올바르지 않은 이미지 데이터입니다.');
  }

  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';

  const binaryString = window.atob(base64Data);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
};

const uploadQuickMemoImage = async (
  dataUrl: string,
  projectId: string
): Promise<{ url: string; storagePath: string }> => {

  const res = await fetch(dataUrl);

  const blob = await res.blob();

  const safeProjectId = String(projectId).replace(/[^\w-]/g, '_');

  const randomId = makeId().replace(/[^\w-]/g, '_');

  const storagePath =
    `quick-memo/${safeProjectId}/qm_${Date.now()}_${randomId}.jpg`;

  const url = await supabaseService.uploadImage(
    blob,
    storagePath
  );

  return {
    url,
    storagePath,
  };
};

const extractLocation = (text: string) => {
  if (!text) return '';

  const patterns = [
    // 1. OO동 OO층 OO구역/부위/실/기계실 등 상세
    /((?:[A-Za-z0-9가-힣]+)\s?동\s?(?:지하|지상)?\s?\d+\s?층\s?[A-Za-z0-9가-힣\s-]{1,15}?(?:구역|구간|부위|실|룸|기계실|전기실|피트))/i,
    
    // 2. 지하/지상 OO층 OO구역/부위/실
    /((?:지하|지상)\s?\d+\s?층\s?[A-Za-z0-9가-힣\s-]{1,15}?(?:구역|구간|부위|실|룸|기계실|전기실|피트))/i,
    /(\d+\s?층\s?[A-Za-z0-9가-힣\s-]{1,15}?(?:구역|구간|부위|실|룸|기계실|전기실|피트))/i,
    
    // 3. OO동 OOO층
    /((?:[A-Za-z0-9가-힣]+)\s?동\s?(?:지하|지상)?\s?\d+\s?층)/i,
    
    // 4. 지하/지상 OO층
    /((?:지하|지상)\s?\d+\s?층)/,
    /(\d+\s?층\s?(?:구역|구간|부위)?)/,
    
    // 5. OO 기계실, OOO 피트실, 발전기실, 전기실 등 특정 설비/기능실명
    /((?:지하|지상)?\s?[A-Za-z0-9가-힣\s-]{2,10}?(?:기계실|전기실|방재실|통신실|주차장|옥상|휀스|경계부|피트실|피트구역|피트))/i,
    
    // 6. 동서남북측 + 상세 (예: 서측 후면, 남측 빌라, 동측 도로 등)
    /([동서남북]측\s?(?:후면|전면|외부|내부|도로|빌라|상가|공터|인접)?\s?[A-Za-z0-9가-힣\s-]{0,10}?(?:구역|구간|주변|부근|인근|대지|경계)?)/,
    
    // 7. 복도나 모듈러 구간
    /(복도\s?[가-힣A-Z0-9\s]*?(?:구간|구역)?)/i,
    /(모듈러\s?[가-힣A-Z0-9\s/]*?(?:구간|구역)?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const found = match[1].trim();
      if (found.length > 1) return found;
    }
  }

  // 폴백 단어 매칭
  if (text.includes('지하 기계실')) return '지하 기계실';
  if (text.includes('기계실')) return '기계실';
  if (text.includes('옥상')) return '옥상';
  if (text.includes('주차장')) return '주차장';
  if (text.includes('남측 빌라')) return '남측 빌라';
  if (text.includes('서측 후면')) return '서측 후면';
  
  const dMatch = text.match(/[동서남북]측/);
  if (dMatch) return dMatch[0];

  return '';
};

const guessCategory = (text: string): QuickMemoCategory => {
  const t = text.toLowerCase();

  if (/낙하|추락|사다리|고소|안전|위험|감전|협착|화재|붕괴|난간|안전대/.test(t)) {
    return '안전';
  }

  if (/설계|디테일|도면|레벨|간섭|사전체크|제작전|제작 전|변경/.test(t)) {
    return '설계';
  }

  if (/불량|품질|크랙|균열|누수|오차|배근|철근|고정|보강|하자|손상/.test(t)) {
    return '품질';
  }

  if (/지연|공정|일정|작업순서|후속|선행|공기/.test(t)) {
    return '공정';
  }

  if (/자재|반입|입고|납품|운반|트레일러|상차|하차/.test(t)) {
    return '자재';
  }

  if (/장비|크레인|양중|굴삭기|고소작업대|리프트/.test(t)) {
    return '장비';
  }

  if (/민원|소음|분진|진동|냄새|주민/.test(t)) {
    return '민원';
  }

  return '기타';
};

const guessSeverity = (
  text: string,
  category: QuickMemoCategory
): QuickMemoSeverity => {
  const t = text.toLowerCase();

  if (/긴급|즉시|중지|추락|낙하|붕괴|화재|감전|사망|중대/.test(t)) {
    return '긴급';
  }

  if (/위험 높|높음|반복|지속|다수|크랙|균열|오차가 크|불량 많/.test(t)) {
    return '높음';
  }

  if (category === '안전' || category === '설계') {
    return '높음';
  }

  if (/불량|오차|보강|재점검|확인 필요|검토 필요/.test(t)) {
    return '중간';
  }

  return '낮음';
};

const buildFallbackAiDraft = (rawText: string): AiDraft => {
  const text = rawText.trim();
  const category = guessCategory(text);
  const severity = guessSeverity(text, category);
  const location = extractLocation(text);

  const aiTitle =
    text.length > 34 ? `${text.slice(0, 34).trim()}...` : text || '현장 퀵 메모';

  let recommendedAction = '현장 확인 후 담당자 검토 및 조치가 필요합니다.';
  let designFeedback = '';

  if (category === '안전') {
    recommendedAction =
      '위험 작업 여부를 즉시 확인하고, 필요 시 작업 중지 후 안전조치 및 재교육을 실시하세요.';
  }

  if (category === '품질') {
    recommendedAction =
      '해당 구간을 재점검하고 보완 조치 후 후속 공정 진행 여부를 확인하세요.';
  }

  if (category === '설계') {
    recommendedAction =
      '현장 조건과 도면/제작 기준을 비교 검토하고, 설계 또는 제작 단계 반영 필요 여부를 확인하세요.';
    designFeedback =
      '반복 발생 시 설계 단계 체크리스트 또는 공장 제작 전 검토 항목에 반영하는 것이 좋습니다.';
  }

  if (category === '공정') {
    recommendedAction =
      '관련 선행/후속 공정 영향을 확인하고 일정 조정 필요 여부를 검토하세요.';
  }

  if (category === '자재') {
    recommendedAction =
      '자재 반입, 보관, 운반 과정의 손상 여부를 확인하고 필요 시 보강 또는 교체 기준을 검토하세요.';
  }

  if (category === '장비') {
    recommendedAction =
      '장비 작업 조건과 안전 상태를 확인하고, 필요 시 장비 계획 또는 작업 방법을 조정하세요.';
  }

  return {
    aiTitle,
    aiSummary: text || '사진 중심으로 기록된 현장 메모입니다. 상세 내용 확인이 필요합니다.',
    category,
    severity,
    location,
    recommendedAction,
    designFeedback,
    dailyIssueText: `[${category}] ${text || '현장 사진 메모 등록. 상세 내용 확인 필요.'}`,
    tags: [category, severity, location].filter(Boolean),
  };
};

const normalizeAiResult = (raw: any, rawText: string): AiDraft => {
  const result = raw?.result || raw?.data || raw;
  const fallback = buildFallbackAiDraft(rawText);

  if (!result || typeof result !== 'object') {
    return fallback;
  }

  const category = CATEGORIES.includes(result.category)
    ? result.category
    : fallback.category;

  const severity = SEVERITIES.includes(result.severity)
    ? result.severity
    : fallback.severity;

  // 1. 한국어 텍스트 문장에서 직접 정밀 정규식으로 위치 파싱
  const localLocation = extractLocation(rawText);

  // 2. 만약 텍스트 내부에서 확실한 장소명(예: 지하 기계실, 서측 후면, 남측 빌라)을 찾았다면,
  // AI가 통일되게 지정하여 흘러내려 보낸 위치 대신, 직접 매칭된 실세 장소명을 최우선으로 신뢰합니다.
  const finalLocation = localLocation || result.location || fallback.location;

  // 3. finalLocation을 분석하여 동, 층, 구역/상황실을 똑똑하게 세분화합니다.
  let finalDong = result.dongBlock || '';
  let finalFloor = result.floor || '';
  let finalZone = result.zone || '';

  if (finalLocation) {
    // 동 분류
    const dongMatch = finalLocation.match(/([A-Z0-9가-힣]+동)/i);
    if (dongMatch) finalDong = dongMatch[1];

    // 층 분류
    const floorMatch = finalLocation.match(/((?:지하|지상)?\s?\d+\s?층)/);
    if (floorMatch) {
      finalFloor = floorMatch[1].replace(/\s+/g, '');
    } else if (finalLocation.includes('지하')) {
      finalFloor = '지하';
    } else if (finalLocation.includes('옥상')) {
      finalFloor = '옥상';
    }

    // 구역/실 분류
    const zoneMatch = finalLocation.match(/([A-Z0-9가-힣]+(?:구역|구간|부위|실|룸|기계실|전기실|피트))/i);
    if (zoneMatch) {
      finalZone = zoneMatch[1];
    } else {
      const words = finalLocation.split(/\s+/);
      if (words.length > 1) {
        finalZone = words[words.length - 1];
      }
    }
  }

  return {
    aiTitle: result.aiTitle || result.title || fallback.aiTitle,
    aiSummary: result.aiSummary || result.summary || fallback.aiSummary,
    category,
    severity,
    location: finalLocation,
    dongBlock: finalDong,
    floor: finalFloor,
    zone: finalZone,
    recommendedAction: result.recommendedAction || fallback.recommendedAction,
    designFeedback: result.designFeedback || fallback.designFeedback,
    dailyIssueText: result.dailyIssueText || fallback.dailyIssueText,
    tags: Array.isArray(result.tags) ? result.tags : fallback.tags,
  };
};

export function QuickMemoModal({
  isOpen,
  project,
  currentUser,
  initialDate,
  onClose,
  onSaved,
}: QuickMemoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formDate, setFormDate] = useState(initialDate || getToday());
  const [rawText, setRawText] = useState('');
  const [photos, setPhotos] = useState<QuickMemoPhoto[]>([]);
  const [aiDrafts, setAiDrafts] = useState<AiDraft[]>([]);
  const [expandedDrafts, setExpandedDrafts] = useState<Record<number, boolean>>({});

  const [isListening, setIsListening] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveMessageType, setSaveMessageType] = useState<'success' | 'warning' | 'error'>('success');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
  if (isOpen) {
    setFormDate(initialDate || getToday());
    setRawText('');
    setPhotos([]);
    setAiDrafts([]);
    setExpandedDrafts({});
    setIsListening(false);
    setIsUploadingPhoto(false);
    setIsAnalyzing(false);
    setIsSaving(false);
    setSaveMessage(null);
    setSaveMessageType('success');
    setShowCloseConfirm(false);
  }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isSaving || isAnalyzing || isUploadingPhoto) return;

    const hasInput =
      rawText.trim().length > 0 ||
      photos.length > 0 ||
      aiDrafts.length > 0;

    if (hasInput) {
      setShowCloseConfirm(true);
      return;
    }

    onClose();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];

    if (!files.length) return;

    if (!project) {
      alert('프로젝트 정보가 없습니다.');
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const uploadedPhotos: QuickMemoPhoto[] = [];

      for (const file of files) {
        try {
          const compressedBase64 = await compressImageToBase64(file, 1200, 0.72);
          uploadedPhotos.push({
            id: makeId(),
            url: compressedBase64,
            title: '',
            description: '',
            category: '',
            subCategory: '',
            storagePath: '',
            isLocalOnly: true,
          });
        } catch (err) {
          console.error('이미지 로컬 처리 실패:', err);
        }
      }

      setPhotos((prev) => [...prev, ...uploadedPhotos]);
      setAiDrafts([]);
      setExpandedDrafts({});
    } catch (error) {
      console.error(error);
      alert('사진 처리에 실패했습니다.');
    } finally {
      setIsUploadingPhoto(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
    setAiDrafts([]);
    setExpandedDrafts({});
  };

  const handleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        '이 브라우저에서는 음성 인식이 지원되지 않습니다.\n우선 텍스트로 입력해 주세요.\n\n권장 브라우저: Chrome'
      );
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';

      if (transcript) {
        setRawText((prev) => {
          const prefix = prev.trim() ? `${prev.trim()}\n` : '';
          return `${prefix}${transcript}`;
        });

        setAiDrafts([]);
        setExpandedDrafts({});
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event);
      alert('음성 인식 중 오류가 발생했습니다. 텍스트로 입력해 주세요.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const splitIssues = (text: string): string[] => {
    if (!text) return [];
    
    // 1. 줄바꿈을 기준으로 먼저 쪼갬
    const lines = text.split('\n').map(p => p.trim()).filter(Boolean);
    if (lines.length > 1) {
      return lines;
    }

    // 2. 콤마나 마침표 및 쉼표 기준 스마트 분기
    const candidates = text.split(/[,.]\s+/).map(p => p.trim()).filter(Boolean);
    if (candidates.length > 1) {
      return candidates;
    }

    // 혹시 공백 없이 콤마만 쓴 경우도 나누어 주자 (단, 의미 있는 문장 길이가 되도록 8글자 이상)
    const fallbackCandidates = text.split(/[,.]/).map(p => p.trim()).filter(Boolean);
    if (fallbackCandidates.length > 1) {
      const merged: string[] = [];
      let current = '';
      for (const part of fallbackCandidates) {
        if (current) {
          current += ', ' + part;
        } else {
          current = part;
        }
        if (current.length >= 8) {
          merged.push(current);
          current = '';
        }
      }
      if (current) {
        if (merged.length > 0) {
          merged[merged.length - 1] += ', ' + current;
        } else {
          merged.push(current);
        }
      }
      if (merged.length > 1) {
        return merged;
      }
    }

    return [text];
  };

  const updateAiDraft = (index: number, fields: Partial<AiDraft>) => {
    setAiDrafts((prev) =>
      prev.map((draft, i) => (i === index ? { ...draft, ...fields } : draft))
    );
  };

  const runAnalyze = async (): Promise<AiDraft[] | null> => {
    const text = rawText.trim();

    if (!text && photos.length === 0) {
      alert('메모 내용 또는 사진을 먼저 입력해 주세요.');
      return null;
    }

    setIsAnalyzing(true);
    let currentPhotos = [...photos];

    try {
      if (isSupabaseReady() && project) {
        const reuploadedPhotos: QuickMemoPhoto[] = [];
        let didUpload = false;
        
        for (const photo of currentPhotos) {
          const needsUpload = photo.url && (photo.url.startsWith('data:') || photo.isLocalOnly);
          if (needsUpload) {
            try {
              const uploaded = await uploadQuickMemoImage(photo.url, project.id);
              reuploadedPhotos.push({
                ...photo,
                url: uploaded.url,
                storagePath: uploaded.storagePath,
                isLocalOnly: false,
              });
              didUpload = true;
            } catch (error) {
              console.error('퀵메모 사진 프리아날라이즈 업로드 실패', error);
              reuploadedPhotos.push(photo);
            }
          } else {
            reuploadedPhotos.push(photo);
          }
        }
        
        if (didUpload) {
          setPhotos(reuploadedPhotos);
          currentPhotos = reuploadedPhotos;
        }
      }

      const textChunks = splitIssues(text);
      const drafts: AiDraft[] = [];
      const service = supabaseService as any;

      if (isSupabaseReady() && typeof service.analyzeQuickMemo === 'function') {
        const promises = textChunks.map(async (chunk) => {
          try {
            const response = await service.analyzeQuickMemo({
              projectId: project?.id,
              rawText: chunk,
              imageUrls: currentPhotos
                .filter((photo) => photo.url && !photo.url.startsWith('data:'))
                .map((photo) => photo.url),
              date: formDate,
            });
            return normalizeAiResult(response, chunk);
          } catch (e) {
            console.warn(`Chunk "${chunk}" AI 분석 실패, Fallback 적용:`, e);
            return buildFallbackAiDraft(chunk);
          }
        });

        const results = await Promise.all(promises);
        drafts.push(...results);
      } else {
        for (const chunk of textChunks) {
          drafts.push(buildFallbackAiDraft(chunk));
        }
      }

      setAiDrafts(drafts);
      
      const expandedState: Record<number, boolean> = {};
      drafts.forEach((_, i) => {
        expandedState[i] = true;
      });
      setExpandedDrafts(expandedState);

      return drafts;
    } catch (error) {
      console.warn('AI 퀵 메모 분석 실패. 임시 정리 결과를 사용합니다.', error);

      const textChunks = splitIssues(text);
      const drafts = textChunks.map(chunk => buildFallbackAiDraft(chunk));
      setAiDrafts(drafts);
      
      const expandedState: Record<number, boolean> = {};
      drafts.forEach((_, i) => {
        expandedState[i] = true;
      });
      setExpandedDrafts(expandedState);

      return drafts;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!project) {
      alert('프로젝트 정보가 없습니다.');
      return;
    }

    const text = rawText.trim();

    if (!text && photos.length === 0) {
      alert('메모 내용 또는 사진을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      let activeDrafts = [...aiDrafts];
      if (activeDrafts.length === 0) {
        const analyzed = await runAnalyze();
        if (!analyzed || analyzed.length === 0) {
          setIsSaving(false);
          return;
        }
        activeDrafts = analyzed;
      }

      let preparedPhotos: QuickMemoPhoto[] = [...photos];

      if (isSupabaseReady()) {
        const reuploadedPhotos: QuickMemoPhoto[] = [];

        for (const photo of preparedPhotos) {
          const needsUpload =
            photo.url &&
            (photo.url.startsWith('data:') || photo.isLocalOnly === true);

          if (!needsUpload) {
            reuploadedPhotos.push(photo);
            continue;
          }

          try {
            const uploaded = await uploadQuickMemoImage(photo.url, project.id);

            reuploadedPhotos.push({
              ...photo,
              url: uploaded.url,
              storagePath: uploaded.storagePath,
              isLocalOnly: false,
            });

            console.log('퀵메모 사진 저장 직전 재업로드 성공:', uploaded);
          } catch (error) {
            console.error('퀵메모 사진 업로드 실패', error);
            alert('사진 업로드 실패로 저장이 중단되었습니다.');
            throw error;
          }
        }

        preparedPhotos = reuploadedPhotos;
      }

      const now = new Date().toISOString();
      const createdByVal = currentUser?.id || currentUser?.name || '';
      const savedMemos: QuickMemo[] = [];

      for (let i = 0; i < activeDrafts.length; i++) {
        const draft = activeDrafts[i];
        
        const memoPhotos: QuickMemoPhoto[] = preparedPhotos.map((photo) => ({
          ...photo,
          title: photo.title || draft.aiTitle,
          description: photo.description || draft.aiSummary,
          category: photo.category || draft.category,
        }));

        const memoRawText = draft.aiSummary;

        const memo: QuickMemo = {
          id: makeId(),
          projectId: project.id,
          date: formDate,

          rawText: memoRawText,
          photos: memoPhotos,

          aiTitle: draft.aiTitle,
          aiSummary: draft.aiSummary,
          category: draft.category,
          severity: draft.severity,

          location: draft.location || '',
          dongBlock: draft.dongBlock || '',
          floor: draft.floor || '',
          zone: draft.zone || '',

          recommendedAction: draft.recommendedAction || '',
          designFeedback: draft.designFeedback || '',
          dailyIssueText: draft.dailyIssueText || `[${draft.category}] ${draft.aiSummary}`,

          status: 'open',

          createdBy: createdByVal,
          createdAt: now,
          updatedAt: now,
        };

        savedMemos.push(memo);
      }

      const key = `cp_quick_memos_${project.id}`;
      const saved = localStorage.getItem(key);
      const list: QuickMemo[] = saved ? JSON.parse(saved) : [];

      const nextList = [...savedMemos, ...list];
      localStorage.setItem(key, JSON.stringify(nextList));

      for (const savedMemo of savedMemos) {
        onSaved(savedMemo);
      }

      const service = supabaseService as any;
      let savedToSupabaseCount = 0;
      const isSupabase = isSupabaseReady() && typeof service.saveQuickMemo === 'function';

      if (isSupabase) {
        for (const serverMemo of savedMemos) {
          try {
            await service.saveQuickMemo(serverMemo);
            savedToSupabaseCount++;
          } catch (supabaseError: any) {
            console.error('Supabase 개별 저장 실패:', supabaseError);
          }
        }
      }

      const totalCount = savedMemos.length;
      if (isSupabase) {
        if (savedToSupabaseCount === totalCount) {
          setSaveMessage(`총 ${totalCount}건의 퀵 메모가 완벽히 분류되어 Supabase에 저장되었습니다.`);
          setSaveMessageType('success');
        } else {
          setSaveMessage(`총 ${totalCount}건 중 ${savedToSupabaseCount}건이 Supabase에 안전하게 저장되었으며, 나머지는 로컬에 저장되었습니다.`);
          setSaveMessageType('warning');
        }
      } else {
        setSaveMessage(`총 ${totalCount}건의 퀵 메모가 분류되어 브라우저에 임시 저장되었습니다.`);
        setSaveMessageType('warning');
      }

      window.setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error(error);
      setSaveMessage(`저장 실패: ${error?.message || '알 수 없는 오류'}`);
      setSaveMessageType('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-2xl shadow-xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              AI 퀵 메모 작성
            </h2>
            <p className="text-xs text-gray-500">
              음성, 텍스트, 사진으로 현장 이슈를 빠르게 기록합니다.
            </p>
          </div>

          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              기록 날짜
            </label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-gray-500">
                현장 메모
              </label>

              <button
                onClick={handleVoiceInput}
                disabled={isListening}
                className={`h-9 px-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
                  isListening
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100'
                }`}
              >
                <Mic size={16} />
                {isListening ? '듣는 중...' : '음성 입력'}
              </button>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setAiDrafts([]);
                setExpandedDrafts({});
              }}
              placeholder={`예시)
1층 A구역 배근작업 중 철근 고정 상태 불량 많음
서측 외장 공사 중 작업자 사다리 사용으로 낙하 위험 높음
모듈러 운반 과정에서 모서리 크랙 지속 발생
모듈러 스프링클러 가지관과 복도 메인 배관 레벨 오차 큼`}
              rows={6}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-gray-500">
                사진
              </label>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="h-9 px-3 rounded-xl bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {isUploadingPhoto ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Camera size={16} />
                )}
                사진 추가
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            {photos.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400">
                <ImageIcon size={28} className="mx-auto mb-2" />
                <p className="text-sm">첨부된 사진이 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
                  >
                    <img
                      src={photo.url}
                      alt="퀵 메모 사진"
                      className="w-full h-full object-cover"
                    />

                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={runAnalyze}
            disabled={isAnalyzing || isSaving}
            className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} />
            )}
            AI 정리하기
          </button>

          {aiDrafts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-600" />
                  <h3 className="font-bold text-purple-900">
                    AI 정리 결과 ({aiDrafts.length}건 분류됨)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const allOpen = Object.values(expandedDrafts).every(v => v);
                    const nextState: Record<number, boolean> = {};
                    aiDrafts.forEach((_, i) => {
                      nextState[i] = !allOpen;
                    });
                    setExpandedDrafts(nextState);
                  }}
                  className="text-xs text-purple-700 font-bold hover:underline"
                >
                  {Object.values(expandedDrafts).every(v => v) ? '모두 접기' : '모두 펼치기'}
                </button>
              </div>

              {aiDrafts.map((draft, index) => {
                const isOpen = !!expandedDrafts[index];
                return (
                  <div key={index} className="rounded-2xl border border-purple-100 bg-purple-50/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedDrafts(prev => ({ ...prev, [index]: !prev[index] }))}
                      className="w-full px-4 py-3 flex items-center justify-between bg-purple-50/80 hover:bg-purple-100/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-extrabold text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full shrink-0">
                          이슈 {index + 1}
                        </span>
                        <span className="font-bold text-sm text-purple-900 truncate flex-1">
                          {draft.aiTitle || '새로운 현장 이슈'}
                        </span>
                        <div className="flex gap-1.5 shrink-0 ml-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md text-white ${
                            draft.category === '안전' ? 'bg-red-500' :
                            draft.category === '품질' ? 'bg-orange-500' :
                            draft.category === '설계' ? 'bg-blue-500' : 'bg-gray-500'
                          }`}>
                            {draft.category}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                            위험도: {draft.severity}
                          </span>
                        </div>
                      </div>
                      <span className="text-purple-400 font-bold text-sm ml-2 shrink-0">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="p-4 space-y-3 bg-purple-50/30 border-t border-purple-100">
                        <div className="bg-white rounded-xl border border-purple-100 p-3">
                          <label className="block text-xs font-bold text-gray-500 mb-1">
                            제목
                          </label>
                          <input
                            value={draft.aiTitle}
                            onChange={(e) => updateAiDraft(index, { aiTitle: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-white rounded-xl border border-purple-100 p-3">
                            <label className="block text-xs font-bold text-gray-500 mb-1">
                              구분
                            </label>
                            <select
                              value={draft.category}
                              onChange={(e) => updateAiDraft(index, { category: e.target.value as QuickMemoCategory })}
                              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                            >
                              {CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="bg-white rounded-xl border border-purple-100 p-3">
                            <label className="block text-xs font-bold text-gray-500 mb-1">
                              위험도
                            </label>
                            <select
                              value={draft.severity}
                              onChange={(e) => updateAiDraft(index, { severity: e.target.value as QuickMemoSeverity })}
                              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                            >
                              {SEVERITIES.map((severity) => (
                                <option key={severity} value={severity}>
                                  {severity}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="bg-white rounded-xl border border-purple-100 p-3">
                            <label className="block text-xs font-bold text-gray-500 mb-1">
                              위치
                            </label>
                            <input
                              value={draft.location || ''}
                              onChange={(e) => updateAiDraft(index, { location: e.target.value })}
                              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm"
                              placeholder="예: 1층 A구역"
                            />
                          </div>
                        </div>

                        <div className="bg-white rounded-xl border border-purple-100 p-3">
                          <label className="block text-xs font-bold text-gray-500 mb-1">
                            요약
                          </label>
                          <textarea
                            value={draft.aiSummary}
                            onChange={(e) => updateAiDraft(index, { aiSummary: e.target.value })}
                            rows={3}
                            className="w-full p-3 rounded-lg border border-gray-200 text-sm resize-none"
                          />
                        </div>

                        <div className="bg-white rounded-xl border border-purple-100 p-3">
                          <label className="block text-xs font-bold text-gray-500 mb-1">
                            권장 조치
                          </label>
                          <textarea
                            value={draft.recommendedAction || ''}
                            onChange={(e) => updateAiDraft(index, { recommendedAction: e.target.value })}
                            rows={2}
                            className="w-full p-3 rounded-lg border border-gray-200 text-sm resize-none"
                          />
                        </div>

                        <div className="bg-white rounded-xl border border-purple-100 p-3">
                          <label className="block text-xs font-bold text-gray-500 mb-1">
                            공사일보 특기사항 문구
                          </label>
                          <textarea
                            value={draft.dailyIssueText || ''}
                            onChange={(e) => updateAiDraft(index, { dailyIssueText: e.target.value })}
                            rows={2}
                            className="w-full p-3 rounded-lg border border-gray-200 text-sm resize-none"
                          />
                        </div>

                        <div className="bg-white rounded-xl border border-purple-100 p-3">
                          <label className="block text-xs font-bold text-gray-500 mb-1">
                            설계/제작 피드백
                          </label>
                          <textarea
                            value={draft.designFeedback || ''}
                            onChange={(e) => updateAiDraft(index, { designFeedback: e.target.value })}
                            rows={2}
                            className="w-full p-3 rounded-lg border border-gray-200 text-sm resize-none"
                            placeholder="설계 또는 공장 제작 단계에 반영할 내용이 있으면 입력"
                          />
                        </div>

                        {draft.tags && draft.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {draft.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-purple-100 text-[10px] text-purple-700 font-bold"
                              >
                                <Tag size={10} />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        {saveMessage && (
          <div
            className={`rounded-xl border p-3 flex gap-2 ${
            saveMessageType === 'success'
            ? 'bg-green-50 border-green-100 text-green-800'
            : saveMessageType === 'warning'
            ? 'bg-yellow-50 border-yellow-100 text-yellow-800'
            : 'bg-red-50 border-red-100 text-red-800'
            }`}
            >
            {saveMessageType === 'success' ? (
            <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-green-600" />
            ) : (
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            )}
            
            <p className="text-xs leading-relaxed font-semibold">
            {saveMessage}
            </p>
          </div>
        )}

          <div className="flex flex-col md:flex-row gap-2 pt-2">
            <button
              onClick={handleClose}
              disabled={isSaving || isAnalyzing}
              className="h-11 px-4 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
            >
              취소
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || isAnalyzing || isUploadingPhoto}
              className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {isSaving ? '저장 중...' : '저장하기'}
            </button>
          </div>

          <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 flex gap-2">
            <AlertTriangle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800 leading-relaxed">
              안전 관련 내용은 AI 정리 결과와 별개로 현장 기준에 따라 즉시 확인해야 합니다.
              AI 결과는 기록 보조용이며 최종 판단은 담당자가 확인해야 합니다.
            </p>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={() => {
          setShowCloseConfirm(false);
          onClose();
        }}
        title="창 닫기 확인"
        message="저장하지 않고 닫으시겠습니까? 입력한 내용은 저장되지 않습니다."
        confirmText="네, 닫기"
        cancelText="계속 작성"
        type="warning"
      />
    </>
  );
}

export default QuickMemoModal;