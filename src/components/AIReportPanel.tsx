import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Download, Info, FileText, CalendarDays, Users } from 'lucide-react';
import { supabaseService, type AiReportType } from '../services/supabaseService';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

type AIReportPanelProps = {
  projectId?: string | null;
};

type ReportPreset = {
  type: AiReportType;
  label: string;
  description: string;
  icon: React.ElementType;
  question: string;
};

const REPORT_PRESETS: ReportPreset[] = [
  {
    type: 'monthly_summary',
    label: '월간 종합',
    description: '이번 달 공사 현황을 요약합니다.',
    icon: CalendarDays,
    question: '이번 달 프로젝트 리포트 작성해줘',
  },
  {
    type: 'schedule_analysis',
    label: '공정 분석',
    description: '작업 내용과 주요 이슈를 분석합니다.',
    icon: FileText,
    question: '이번 달 작업내용과 주요 이슈를 표와 리포트로 알려줘',
  },
  {
    type: 'manpower_analysis',
    label: '출력인원 분석',
    description: '일자별 출력 인원 흐름을 분석합니다.',
    icon: Users,
    question: '이번 달 출력인원 분석 리포트를 작성해줘. 총 투입 인원, 일자별 투입 추이, 최대 투입일, 최소 투입일, 작업 내용과 인원 투입의 관계를 함께 분석해줘.',
  },
];

function getSafeFileName(value?: string) {
  return (value || 'AI_Report')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60);
}

function formatReportTypeLabel(reportType?: string) {
  if (reportType === 'monthly_summary') return '월간 종합 리포트';
  if (reportType === 'schedule_analysis') return '공정 분석 리포트';
  if (reportType === 'manpower_analysis') return '출력인원 분석 리포트';
  return 'AI 분석 리포트';
}

function parseNarrativeSections(text?: string) {
  if (!text) return [];

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;

  lines.forEach((line) => {
    const headingMatch = line.match(/^(\d+)\.\s+(.+)$/);

    if (headingMatch) {
      current = {
        title: `${headingMatch[1]}. ${headingMatch[2]}`,
        body: [],
      };
      sections.push(current);
      return;
    }

    if (!current) {
      current = {
        title: '종합 의견',
        body: [],
      };
      sections.push(current);
    }

    current.body.push(line);
  });

  return sections;
}

const EXAMPLES = [
  '이번주 분석해줘',
  '지난주 출력인원 그래프로 보여줘',
  '3월 출력인원 그래프로 보여줘',
  '3월 작업내용 표로 알려줘',
  '이번 달 프로젝트 리포트 작성해줘',
];

export function AIReportPanel({ projectId }: AIReportPanelProps) {
  const storageKey = projectId ?? 'global';

  const [question, setQuestion] = useState<string>(() => {
    const saved = sessionStorage.getItem(`ai_report_${storageKey}_question`);
    return saved ? JSON.parse(saved) : '';
  });

  const [reportType, setReportType] = useState<AiReportType>(() => {
    const saved = sessionStorage.getItem(`ai_report_${storageKey}_reportType`);
    return saved ? JSON.parse(saved) : 'custom';
  });

  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState<any>(() => {
    const saved = sessionStorage.getItem(`ai_report_${storageKey}_result`);
    return saved ? JSON.parse(saved) : null;
  });

  const [error, setError] = useState('');

  const [debugInfo, setDebugInfo] = useState<any>(() => {
    const saved = sessionStorage.getItem(`ai_report_${storageKey}_debug`);
    return saved ? JSON.parse(saved) : null;
  });

  const [isExporting, setIsExporting] = useState(false);

  const reportContentRef = useRef<HTMLDivElement>(null);

const narrativeSections = parseNarrativeSections(result?.narrative);

const totalPersonnelFromSummary = Number(result?.summaryFacts?.totalPersonnelSum || 0);

const totalPersonnelFromChart = Array.isArray(result?.chartData)
  ? result.chartData.reduce((sum: number, item: any) => sum + Number(item.personnel || 0), 0)
  : 0;

const totalPersonnel = totalPersonnelFromSummary || totalPersonnelFromChart;

const chartDataCount = Array.isArray(result?.chartData)
  ? result.chartData.length
  : 0;

const tableRowCount = Array.isArray(result?.rows)
  ? result.rows.filter((row: any[]) => row?.[0] !== '합계').length
  : 0;

const analysisDataCount =
  Number(result?.summaryFacts?.rowCount || 0) ||
  chartDataCount ||
  tableRowCount;

const scheduleSummary = debugInfo?.scheduleSummary;

  useEffect(() => {
    sessionStorage.setItem(`ai_report_${storageKey}_question`, JSON.stringify(question));
  }, [question, storageKey]);

  useEffect(() => {
    sessionStorage.setItem(`ai_report_${storageKey}_reportType`, JSON.stringify(reportType));
  }, [reportType, storageKey]);

  useEffect(() => {
    sessionStorage.setItem(`ai_report_${storageKey}_result`, JSON.stringify(result));
  }, [result, storageKey]);

  useEffect(() => {
    sessionStorage.setItem(`ai_report_${storageKey}_debug`, JSON.stringify(debugInfo));
  }, [debugInfo, storageKey]);

  const handleSelectPreset = (preset: ReportPreset) => {
    setReportType(preset.type);
    setQuestion(preset.question);
    setError('');
  };

  const handleRun = async () => {
    if (!question.trim()) {
      alert('질문을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResult(null);
      setDebugInfo(null);

      const data = await supabaseService.getAiReport({
        question: question.trim(),
        projectId: projectId ?? null,
        reportType,
      });

      if (!data.ok) {
        setError(data.error || 'AI 리포트 생성 실패');
        return;
      }

      setResult(data.result);
      setDebugInfo({
        ...(data.plan || {}),
        reportType,
      });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'AI 리포트 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
  if (!reportContentRef.current) return;

  setIsExporting(true);

  try {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const marginX = 10;
    const marginY = 10;
    const contentWidth = pageWidth - marginX * 2;
    const contentHeight = pageHeight - marginY * 2;
    const sectionGap = 5;

    let currentY = marginY;
    let pageIndex = 0;

    const addNewPage = () => {
      pdf.addPage();
      pageIndex += 1;
      currentY = marginY;
    };

    const addCanvasSliceToPdf = (
      canvas: HTMLCanvasElement,
      sourceY: number,
      sliceHeightPx: number,
      targetHeightMm: number
    ) => {
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;

      const ctx = sliceCanvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );

      const imageData = sliceCanvas.toDataURL('image/jpeg', 0.95);

      pdf.addImage(
        imageData,
        'JPEG',
        marginX,
        currentY,
        contentWidth,
        targetHeightMm
      );

      currentY += targetHeightMm + sectionGap;
    };

    const addElementToPdf = async (element: HTMLElement) => {
      const canvas = await htmlToImage.toCanvas(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
      });

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      const imageHeightMm = (canvasHeight * contentWidth) / canvasWidth;
      const remainingHeight = pageHeight - marginY - currentY;

      if (imageHeightMm <= remainingHeight) {
        const imageData = canvas.toDataURL('image/jpeg', 0.95);

        pdf.addImage(
          imageData,
          'JPEG',
          marginX,
          currentY,
          contentWidth,
          imageHeightMm
        );

        currentY += imageHeightMm + sectionGap;
        return;
      }

      if (imageHeightMm <= contentHeight) {
        if (currentY > marginY) {
          addNewPage();
        }

        const imageData = canvas.toDataURL('image/jpeg', 0.95);

        pdf.addImage(
          imageData,
          'JPEG',
          marginX,
          currentY,
          contentWidth,
          imageHeightMm
        );

        currentY += imageHeightMm + sectionGap;
        return;
      }

      if (currentY > marginY) {
        addNewPage();
      }

      const pxPerMm = canvasWidth / contentWidth;
      let sourceY = 0;

      while (sourceY < canvasHeight) {
        const availableHeightMm = pageHeight - marginY - currentY;
        const availableHeightPx = Math.floor(availableHeightMm * pxPerMm);

        const sliceHeightPx = Math.min(
          availableHeightPx,
          canvasHeight - sourceY
        );

        const sliceHeightMm = sliceHeightPx / pxPerMm;

        addCanvasSliceToPdf(canvas, sourceY, sliceHeightPx, sliceHeightMm);

        sourceY += sliceHeightPx;

        if (sourceY < canvasHeight) {
          addNewPage();
        }
      }
    };

    const addTableSectionToPdf = async (sectionElement: HTMLElement) => {
      const table = sectionElement.querySelector('table');
      const tbody = table?.querySelector('tbody');

      if (!table || !tbody) {
        await addElementToPdf(sectionElement);
        return;
      }

      const originalRows = Array.from(tbody.querySelectorAll('tr'));

      if (originalRows.length === 0) {
        await addElementToPdf(sectionElement);
        return;
      }

      // 표는 새 페이지에서 시작하도록 처리합니다.
      // 이렇게 해야 페이지별 행 계산이 안정적입니다.
      if (currentY > marginY) {
        addNewPage();
      }

      const tempRoot = document.createElement('div');
      tempRoot.className = 'ai-report-export-mode';
      tempRoot.style.position = 'fixed';
      tempRoot.style.left = '-10000px';
      tempRoot.style.top = '0';
      tempRoot.style.width = `${sectionElement.offsetWidth}px`;
      tempRoot.style.background = '#ffffff';
      tempRoot.style.zIndex = '-1';

      document.body.appendChild(tempRoot);

      const maxChunkHeightPx =
        contentHeight * (sectionElement.offsetWidth / contentWidth);

      let rowIndex = 0;
      let tablePageIndex = 0;

      try {
        while (rowIndex < originalRows.length) {
          const clone = sectionElement.cloneNode(true) as HTMLElement;
          clone.removeAttribute('data-pdf-section');
          clone.removeAttribute('data-pdf-table-section');
          clone.style.width = '100%';
          clone.style.boxShadow = 'none';

          const cloneTitle = clone.querySelector('h3');
          const cloneDescription = clone.querySelector('p');
          const cloneTableWrap = clone.querySelector('.ai-table-wrap') as HTMLElement | null;
          const cloneTbody = clone.querySelector('tbody');

          if (cloneTableWrap) {
            cloneTableWrap.style.overflow = 'visible';
          }

          if (cloneTitle && tablePageIndex > 0) {
  cloneTitle.textContent = `분석 데이터 표 계속 ${tablePageIndex + 1}`;
}

if (cloneDescription && tablePageIndex > 0) {
  cloneDescription.textContent = '이전 페이지에서 이어지는 데이터입니다.';
}

          if (!cloneTbody) {
            await addElementToPdf(sectionElement);
            break;
          }

          cloneTbody.innerHTML = '';
          tempRoot.innerHTML = '';
          tempRoot.appendChild(clone);

          let addedRowCount = 0;

          while (rowIndex + addedRowCount < originalRows.length) {
            const rowClone = originalRows[rowIndex + addedRowCount].cloneNode(true);
            cloneTbody.appendChild(rowClone);

            const isTooTall = clone.offsetHeight > maxChunkHeightPx;

            if (isTooTall && addedRowCount > 0) {
              cloneTbody.removeChild(cloneTbody.lastElementChild as ChildNode);
              break;
            }

            // 한 행 자체가 너무 긴 경우에는 그 행 하나만 한 페이지에 넣습니다.
            // 이 경우만 예외적으로 한 행 내부가 잘릴 수 있지만, 일반적인 날짜 행은 잘리지 않습니다.
            if (isTooTall && addedRowCount === 0) {
              addedRowCount += 1;
              break;
            }

            addedRowCount += 1;
          }

          if (tablePageIndex > 0) {
            addNewPage();
          }

          await addElementToPdf(clone);

          rowIndex += Math.max(addedRowCount, 1);
          tablePageIndex += 1;
        }
      } finally {
        document.body.removeChild(tempRoot);
      }
    };

    const sectionElements = Array.from(
      reportContentRef.current.querySelectorAll('[data-pdf-section="true"]')
    ) as HTMLElement[];

    if (sectionElements.length === 0) {
      throw new Error('PDF로 출력할 리포트 섹션을 찾지 못했습니다.');
    }

    for (const sectionElement of sectionElements) {
  const isTableSection =
    sectionElement.dataset.pdfTableSection === 'true' ||
    Boolean(sectionElement.querySelector('table'));

  if (isTableSection) {
    await addTableSectionToPdf(sectionElement);
  } else {
    await addElementToPdf(sectionElement);
  }
}

    const fileTitle = getSafeFileName(debugInfo?.reportTitle || 'AI_Report');
    pdf.save(`${fileTitle}_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
    alert('PDF 생성 중 오류가 발생했습니다.');
  } finally {
    setIsExporting(false);
  }
};

  const selectedPreset = REPORT_PRESETS.find((preset) => preset.type === reportType);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-blue-600" size={20} />
          </div>
          <div>
            <h2 className="text-md font-bold text-gray-900">AI 리포트</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              리포트 종류를 선택한 뒤 필요한 내용을 질문하세요.
            </p>
          </div>
        </div>        
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-xs font-bold text-gray-700 mb-2">리포트 종류 선택</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {REPORT_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isSelected = reportType === preset.type;

              return (
                <button
                  key={preset.type}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                    <span className={`text-sm font-bold ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                      {preset.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {selectedPreset && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
            현재 선택: <span className="font-bold">{selectedPreset.label}</span>
          </div>
        )}

        <textarea
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            if (reportType !== 'custom') {
              setReportType('custom');
            }
          }}
          placeholder="예: 이번 달 프로젝트 리포트 작성해줘"
          className="w-full min-h-[110px] border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuestion(example);
                setReportType('custom');
              }}
              className="px-3 py-1.5 text-xs font-medium bg-gray-50 border border-gray-200 rounded-full hover:bg-gray-100 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-start gap-2">
  <button
    type="button"
    onClick={handleRun}
    disabled={loading}
    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-all font-bold text-sm shadow-sm"
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
    {loading ? '리포트 생성 중...' : '리포트 생성'}
  </button>

  {result && (
    <button
      type="button"
      onClick={handleDownloadPDF}
      disabled={isExporting}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-60 transition-all shadow-sm"
    >
      {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {isExporting ? 'PDF 생성 중...' : 'PDF 다운로드'}
    </button>
  )}
</div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
            <Info size={16} />
            {error}
          </div>
        )}

        <div
  ref={reportContentRef}
  className={`bg-white ${isExporting ? 'ai-report-export-mode' : ''}`}
>
  {isExporting && (
    <style>{`
      .ai-report-export-mode {
        width: 794px !important;
        max-width: 794px !important;
        padding: 32px !important;
        background: #ffffff !important;
        color: #111827 !important;
      }

      .ai-report-export-mode .ai-report-shell {
        box-shadow: none !important;
        border: 1px solid #e5e7eb !important;
      }

      .ai-report-export-mode .ai-table-wrap {
        overflow: visible !important;
      }

      .ai-report-export-mode table {
        table-layout: fixed !important;
        width: 100% !important;
        font-size: 10px !important;
      }

      .ai-report-export-mode th,
      .ai-report-export-mode td {
        word-break: break-word !important;
      }

      .ai-report-export-mode .pdf-avoid-break {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      .ai-report-export-mode [data-pdf-section="true"] {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

.ai-report-export-mode .recharts-wrapper,
.ai-report-export-mode .recharts-surface {
  overflow: visible !important;
}

.ai-report-export-mode .ai-report-shell {
  overflow: visible !important;
}

.ai-report-export-mode section {
  box-shadow: none !important;
}

.ai-report-export-mode .ai-table-wrap {
  overflow: visible !important;
}

.ai-report-export-mode table {
  width: 100% !important;
  table-layout: fixed !important;
  border-collapse: collapse !important;
}

.ai-report-export-mode thead {
  display: table-header-group !important;
}

.ai-report-export-mode tbody {
  display: table-row-group !important;
}

.ai-report-export-mode tr {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

.ai-report-export-mode th,
.ai-report-export-mode td {
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
  vertical-align: top !important;
}

.ai-report-export-mode th {
  background: #111827 !important;
  color: #ffffff !important;
}

    `}</style>
  )}

  {result && (
    <article className="ai-report-shell mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div
  data-pdf-section="true"
  className="rounded-t-2xl border-b border-blue-100 bg-gradient-to-br from-slate-50 via-blue-50 to-white px-6 md:px-8 py-7 text-gray-900"
>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-[11px] font-black tracking-widest uppercase mb-4">
  AI Construction Report
</div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
              {debugInfo?.reportTitle || '프로젝트 종합 분석'}
            </h1>

            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              AI가 공사일보, 공정 데이터, 주요 이슈를 기반으로 생성한 현장관리 리포트입니다.
            </p>
          </div>

          <div className="shrink-0 bg-white border border-blue-100 rounded-xl px-4 py-3 text-sm min-w-[210px] shadow-sm">
  <div className="text-[11px] text-slate-400 font-bold mb-1">분석 대상 기간</div>
  <div className="font-black text-slate-900">
    {debugInfo?.startDate || '-'} ~ {debugInfo?.endDate || '-'}
  </div>

  <div className="mt-3 text-[11px] text-slate-400 font-bold mb-1">리포트 유형</div>
  <div className="font-bold text-blue-700">
    {formatReportTypeLabel(debugInfo?.reportType)}
  </div>
</div>
        </div>
      </div>

      <div
  data-pdf-section="true"
  className="px-6 md:px-8 py-6 border-b border-gray-100 bg-gray-50"
>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="pdf-avoid-break rounded-xl bg-white border border-gray-200 p-4">
            <div className="text-[11px] font-bold text-gray-400 mb-1">총 투입 인원</div>
            <div className="text-2xl font-black text-gray-900">
              {totalPersonnel > 0 ? `${totalPersonnel}명` : '-'}
            </div>
          </div>

          <div className="pdf-avoid-break rounded-xl bg-white border border-gray-200 p-4">
            <div className="text-[11px] font-bold text-gray-400 mb-1">분석 데이터</div>
            <div className="text-2xl font-black text-gray-900">
              {analysisDataCount || '-'}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">일/월 단위</div>
          </div>

          <div className="pdf-avoid-break rounded-xl bg-white border border-gray-200 p-4">
            <div className="text-[11px] font-bold text-gray-400 mb-1">관련 공정</div>
            <div className="text-2xl font-black text-gray-900">
              {scheduleSummary?.targetScheduleCount ?? '-'}
            </div>
          </div>

          <div className="pdf-avoid-break rounded-xl bg-white border border-gray-200 p-4">
            <div className="text-[11px] font-bold text-gray-400 mb-1">지연/관리 대상</div>
            <div className="text-2xl font-black text-gray-900">
              {scheduleSummary
                ? Number(scheduleSummary.delayedStatusCount || 0) +
                  Number(scheduleSummary.overdueUnfinishedCount || 0)
                : '-'}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-8 py-7 space-y-7">
        {result.showChart && result.chartData && result.chartData.length > 0 && (
          <section
  data-pdf-section="true"
  className="pdf-avoid-break rounded-2xl border border-gray-200 bg-white p-5"
>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-gray-900">출력 인원 추이</h3>
                <p className="text-xs text-gray-500 mt-1">
                  조회 기간 내 일자별 또는 월별 투입 인원 흐름입니다.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">
                Chart
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar dataKey="personnel" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    <LabelList
                      dataKey="personnel"
                      position="top"
                      style={{ fontSize: 11, fill: '#374151', fontWeight: 'bold' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {result.showTable && result.columns && result.columns.length > 0 && (
          <section
  data-pdf-section="true"
  data-pdf-table-section="true"
  className="rounded-2xl border border-gray-200 bg-white p-5"
>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-gray-900">분석 데이터 표</h3>
                <p className="text-xs text-gray-500 mt-1">
                  AI 리포트 생성에 사용된 주요 집계 데이터입니다.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-[11px] font-bold">
                Table
              </span>
            </div>

            <div className="ai-table-wrap overflow-x-auto">
              <table className="w-full border border-gray-200 text-sm whitespace-pre-wrap border-collapse">
                <thead>
                  <tr className="bg-gray-900">
                    {result.columns.map((col: string, i: number) => (
                      <th
                        key={i}
                        className="border border-gray-800 px-3 py-2 font-bold text-white text-left"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row: any[], i: number) => (
                    <tr
                      key={i}
                      className={row?.[0] === '합계' ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      {row.map((cell: any, cellIndex: number) => (
                        <td
                          key={cellIndex}
                          className={`border border-gray-200 px-3 py-2 text-gray-700 align-top ${
                            row?.[0] === '합계' ? 'font-black text-gray-900' : ''
                          }`}
                        >
                          {cell || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {result.narrative && (
          <section className="space-y-4">
  <div
    data-pdf-section="true"
    className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5"
  >
              <div>
                <h3 className="text-base font-black text-blue-900">종합 의견 및 분석</h3>
                <p className="text-xs text-blue-700/70 mt-1">
                  AI가 데이터 기반으로 요약한 관리 의견입니다.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold">
                AI Insight
              </span>
            </div>            

            <div className="space-y-5">
              {narrativeSections.length > 0 ? (
                narrativeSections.map((section, sectionIndex) => (
                  <div
  key={sectionIndex}
  data-pdf-section="true"
  className="pdf-avoid-break rounded-xl bg-white border border-blue-100 p-4"
>
                    <h4 className="text-sm font-black text-gray-900 mb-3">
                      {section.title}
                    </h4>

                    <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
                      {section.body.map((line, lineIndex) => {
                        const isBullet = line.startsWith('- ');

                        return isBullet ? (
                          <div key={lineIndex} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                            <p>{line.replace(/^- /, '')}</p>
                          </div>
                        ) : (
                          <p key={lineIndex}>{line}</p>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">
                  표시할 AI 분석 내용이 없습니다.
                </div>
              )}
            </div>
          </section>
        )}

        <div
  data-pdf-section="true"
  className="pt-4 border-t border-gray-100 text-[11px] text-gray-400 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
>
          <span>Generated by S-CON AI Report</span>
          <span>{new Date().toISOString().slice(0, 10)}</span>
        </div>
      </div>
    </article>
  )}
</div>
      </div>
    </div>
  );
}