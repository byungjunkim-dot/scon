import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { DailyReport, ScheduleItem } from '../types';

type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

type RiskCategory =
  | 'schedule'
  | 'baseline'
  | 'daily_report'
  | 'resource'
  | 'document'
  | 'quality'
  | 'safety';

type AIRiskItem = {
  id: string;
  title: string;
  category: RiskCategory;
  severity: RiskSeverity;
  description: string;
  evidence: string[];
  recommendation: string;
};

type AIRiskCardProps = {
  projectId?: string | null;
  schedules: ScheduleItem[];
  dailyReports: DailyReport[];
  inspectionRequests?: any[];
  materialApprovals?: any[];
  concretePlans?: any[];
};

const severityMeta: Record<
  RiskSeverity,
  {
    label: string;
    badgeClass: string;
    cardClass: string;
    dotClass: string;
  }
> = {
  low: {
    label: '낮음',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cardClass: 'border-emerald-100 bg-emerald-50/30',
    dotClass: 'bg-emerald-500',
  },
  medium: {
    label: '중간',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    cardClass: 'border-amber-100 bg-amber-50/30',
    dotClass: 'bg-amber-500',
  },
  high: {
    label: '높음',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    cardClass: 'border-orange-100 bg-orange-50/30',
    dotClass: 'bg-orange-500',
  },
  critical: {
    label: '긴급',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    cardClass: 'border-red-100 bg-red-50/30',
    dotClass: 'bg-red-500',
  },
};

const severityRank: Record<RiskSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function getTodayYmd() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysYmd(baseYmd: string, days: number) {
  const date = new Date(`${baseYmd}T00:00:00`);
  date.setDate(date.getDate() + days);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

function isBetweenYmd(value?: string, start?: string, end?: string) {
  if (!value || !start || !end) return false;
  return value >= start && value <= end;
}

function isScheduleOverlapping(
  schedule: ScheduleItem,
  startDate: string,
  endDate: string
) {
  if (!schedule.startDate || !schedule.endDate) return false;
  return schedule.startDate <= endDate && schedule.endDate >= startDate;
}

function formatScheduleName(schedule: ScheduleItem) {
  return [
    schedule.category,
    schedule.subCategory,
    schedule.taskName,
    [schedule.dongBlock, schedule.floor, schedule.zone].filter(Boolean).join(' / '),
  ]
    .filter(Boolean)
    .join(' · ');
}

function getPersonnelTotal(report: DailyReport) {
  return (
    Number(report.personnel?.direct || 0) +
    Number(report.personnel?.outsourced || 0) +
    Number(report.personnel?.other || 0)
  );
}

function getHighestSeverity(risks: AIRiskItem[]): RiskSeverity {
  if (risks.length === 0) return 'low';

  return risks.reduce<RiskSeverity>((highest, risk) => {
    return severityRank[risk.severity] > severityRank[highest]
      ? risk.severity
      : highest;
  }, 'low');
}

const AI_RISK_CACHE_TTL_MS = 30 * 60 * 1000;

function getRiskSignature(risks: AIRiskItem[]) {
  return risks
    .map((risk) => `${risk.id}:${risk.severity}:${risk.evidence.join('|')}`)
    .join('||');
}

function getFallbackRiskSummary(risks: AIRiskItem[]) {
  if (risks.length === 0) {
    return '현재 공정표, 공사일보, 문서 현황 기준으로 즉시 조치가 필요한 주요 리스크는 확인되지 않았습니다.';
  }

  const highRiskCount = risks.filter(
    (risk) => risk.severity === 'high' || risk.severity === 'critical'
  ).length;

  return `현재 ${risks.length}개의 관리 포인트가 확인되었습니다. 이 중 높음 이상 리스크는 ${highRiskCount}건이며, 우선순위가 높은 항목부터 확인하는 것이 좋습니다.`;
}

function buildRisks(params: AIRiskCardProps): AIRiskItem[] {
  const {
    schedules,
    dailyReports,
    inspectionRequests = [],
    materialApprovals = [],
    concretePlans = [],
  } = params;

  const today = getTodayYmd();
  const sevenDaysAgo = addDaysYmd(today, -6);
  const nextSevenDays = addDaysYmd(today, 7);

  const actualSchedules = schedules.filter((schedule) => !schedule.isBaseline);
  const baselineSchedules = schedules.filter((schedule) => schedule.isBaseline);

  const risks: AIRiskItem[] = [];

  // 1. 공정 지연 / 종료일 지난 미완료 공정
  const delayedByStatus = actualSchedules.filter(
    (schedule) => schedule.status === '지연'
  );

  const overdueUnfinished = actualSchedules.filter((schedule) => {
    if (!schedule.endDate) return false;
    if (Number(schedule.progress || 0) >= 100) return false;
    return schedule.endDate < today;
  });

  if (delayedByStatus.length > 0 || overdueUnfinished.length > 0) {
    const totalCount = delayedByStatus.length + overdueUnfinished.length;

    risks.push({
      id: 'schedule-delay',
      title: '공정 지연 가능성',
      category: 'schedule',
      severity: totalCount >= 3 ? 'critical' : 'high',
      description:
        '지연 상태이거나 종료 예정일이 지났지만 완료율이 100% 미만인 공정이 있습니다.',
      evidence: [
        `지연 상태 공정 ${delayedByStatus.length}건`,
        `종료일 지난 미완료 공정 ${overdueUnfinished.length}건`,
        ...[...delayedByStatus, ...overdueUnfinished]
          .slice(0, 3)
          .map((schedule) => `${formatScheduleName(schedule)} / 종료 ${schedule.endDate || '-'}`),
      ],
      recommendation:
        '해당 공정의 실제 완료 여부, 잔여 작업량, 후속 공정 영향 여부를 먼저 확인하세요.',
    });
  }

  // 2. Baseline 대비 일정 변경
  const baselineChanges = actualSchedules
    .map((actual) => {
      const baseline = baselineSchedules.find(
        (base) => base.sourceScheduleId === actual.id
      );

      if (!baseline) return null;

      const isChanged =
        actual.startDate !== baseline.startDate ||
        actual.endDate !== baseline.endDate;

      if (!isChanged) return null;

      return {
        actual,
        baseline,
      };
    })
    .filter(Boolean) as { actual: ScheduleItem; baseline: ScheduleItem }[];

  if (baselineChanges.length > 0) {
    risks.push({
      id: 'baseline-change',
      title: 'Baseline 대비 일정 변경',
      category: 'baseline',
      severity: baselineChanges.length >= 5 ? 'high' : 'medium',
      description:
        'Baseline 계획과 실제 공정표의 시작일 또는 종료일이 달라진 공정이 있습니다.',
      evidence: [
        `Baseline 대비 변경 공정 ${baselineChanges.length}건`,
        ...baselineChanges.slice(0, 3).map(({ actual, baseline }) => {
          return `${formatScheduleName(actual)} / 계획 ${baseline.startDate}~${baseline.endDate} → 현재 ${actual.startDate}~${actual.endDate}`;
        }),
      ],
      recommendation:
        '일정 변경 공정이 후속 작업, 검측, 자재 반입 일정에 영향을 주는지 확인하세요.',
    });
  }

  // 3. 최근 7일 공사일보 이슈
  const recentReports = dailyReports.filter((report) =>
    isBetweenYmd(report.date, sevenDaysAgo, today)
  );

  const recentIssues = recentReports.flatMap((report) =>
    (report.issues || []).map((issue) => ({
      date: report.date,
      type: issue.type,
      description: issue.description,
    }))
  );

  if (recentIssues.length > 0) {
    const qualityCount = recentIssues.filter((issue) => issue.type === '품질').length;
    const safetyCount = recentIssues.filter((issue) => issue.type === '안전').length;

    risks.push({
      id: 'recent-daily-issues',
      title: '최근 일보 이슈 확인 필요',
      category:
        safetyCount > 0 ? 'safety' : qualityCount > 0 ? 'quality' : 'daily_report',
      severity: recentIssues.length >= 3 ? 'high' : 'medium',
      description:
        '최근 7일 공사일보에 안전, 품질 또는 민원 이슈가 기록되어 있습니다.',
      evidence: [
        `최근 7일 이슈 ${recentIssues.length}건`,
        `안전 ${safetyCount}건 / 품질 ${qualityCount}건`,
        ...recentIssues
          .slice(0, 3)
          .map((issue) => `${issue.date} · ${issue.type} · ${issue.description}`),
      ],
      recommendation:
        '반복되는 이슈인지 확인하고, 조치 결과가 공사일보에 남아 있는지 점검하세요.',
    });
  }

  // 4. 출력 인원 감소 또는 작업 있는데 인원 0명
  const reportsWithPersonnel = [...dailyReports]
    .filter((report) => report.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const lastSixReports = reportsWithPersonnel.slice(-6);
  const previousThree = lastSixReports.slice(0, 3);
  const recentThree = lastSixReports.slice(3);

  const previousAvg =
    previousThree.length > 0
      ? previousThree.reduce((sum, report) => sum + getPersonnelTotal(report), 0) /
        previousThree.length
      : 0;

  const recentAvg =
    recentThree.length > 0
      ? recentThree.reduce((sum, report) => sum + getPersonnelTotal(report), 0) /
        recentThree.length
      : 0;

  const workButNoPersonnel = recentReports.filter((report) => {
    const hasWork = (report.todayTasks || []).length > 0;
    return hasWork && getPersonnelTotal(report) === 0;
  });

  if (
    (previousAvg > 0 && recentAvg > 0 && recentAvg < previousAvg * 0.6) ||
    workButNoPersonnel.length > 0
  ) {
    risks.push({
      id: 'manpower-drop',
      title: '출력 인원 확인 필요',
      category: 'resource',
      severity: workButNoPersonnel.length > 0 ? 'high' : 'medium',
      description:
        '최근 출력 인원 감소 또는 작업 등록 대비 출력 인원 누락 가능성이 있습니다.',
      evidence: [
        previousAvg > 0
          ? `이전 평균 ${Math.round(previousAvg * 10) / 10}명 → 최근 평균 ${Math.round(recentAvg * 10) / 10}명`
          : '최근 출력 인원 비교 데이터가 제한적입니다.',
        workButNoPersonnel.length > 0
          ? `작업은 있으나 출력 인원이 0명인 일보 ${workButNoPersonnel.length}건`
          : '작업 대비 출력 인원 누락은 확인되지 않았습니다.',
      ],
      recommendation:
        '예정 작업량 대비 인원 투입이 충분한지 확인하고, 일보의 인원 입력 누락 여부를 점검하세요.',
    });
  }

  // 5. 이번 주 예정 공정 대비 선행 문서 확인
  const upcomingSchedules = actualSchedules.filter((schedule) =>
    isScheduleOverlapping(schedule, today, nextSevenDays)
  );

  const upcomingDocumentsCount =
    inspectionRequests.filter((item) => isBetweenYmd(item.date, today, nextSevenDays))
      .length +
    materialApprovals.filter((item) => isBetweenYmd(item.date, today, nextSevenDays))
      .length +
    concretePlans.filter((item) => isBetweenYmd(item.date, today, nextSevenDays))
      .length;

  if (upcomingSchedules.length >= 3 && upcomingDocumentsCount === 0) {
    risks.push({
      id: 'document-check',
      title: '선행 문서 확인 필요',
      category: 'document',
      severity: 'medium',
      description:
        '향후 7일 예정 공정이 있으나 같은 기간의 검측요청서, 자재승인서, 타설계획서가 확인되지 않습니다.',
      evidence: [
        `향후 7일 예정 공정 ${upcomingSchedules.length}건`,
        '향후 7일 관련 문서 0건',
        ...upcomingSchedules
          .slice(0, 3)
          .map((schedule) => `${formatScheduleName(schedule)} / ${schedule.startDate}~${schedule.endDate}`),
      ],
      recommendation:
        '검측, 자재 승인, 타설 계획 등 선행 문서가 필요한 공정인지 확인하세요.',
    });
  }

  return risks.sort(
    (a, b) => severityRank[b.severity] - severityRank[a.severity]
  );
}

function getCategoryLabel(category: RiskCategory) {
  if (category === 'schedule') return '공정';
  if (category === 'baseline') return 'Baseline';
  if (category === 'daily_report') return '일보';
  if (category === 'resource') return '인원';
  if (category === 'document') return '문서';
  if (category === 'quality') return '품질';
  if (category === 'safety') return '안전';
  return '관리';
}

function getRiskIcon(category: RiskCategory) {
  if (category === 'schedule') return Clock;
  if (category === 'baseline') return AlertTriangle;
  if (category === 'resource') return TrendingDown;
  if (category === 'document') return FileWarning;
  if (category === 'safety') return ShieldAlert;
  return AlertTriangle;
}

export function AIRiskCard({
  projectId,
  schedules,
  dailyReports,
  inspectionRequests = [],
  materialApprovals = [],
  concretePlans = [],
}: AIRiskCardProps) {
  const [refreshCount, setRefreshCount] = useState(0);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<{
   overallRiskLevel: RiskSeverity;
   summary: string;
   risks: AIRiskItem[];
  } | null>(null);

  const risks = useMemo(() => {
    return buildRisks({
      projectId,
      schedules,
      dailyReports,
      inspectionRequests,
      materialApprovals,
      concretePlans,
    });
  }, [
    projectId,
    schedules,
    dailyReports,
    inspectionRequests,
    materialApprovals,
    concretePlans,
    refreshCount,
  ]);

  const topRisks = risks.slice(0, 4);
  const overallRiskLevel = getHighestSeverity(risks);
  const overallMeta = severityMeta[overallRiskLevel];

  const highRiskCount = risks.filter(
    (risk) => risk.severity === 'high' || risk.severity === 'critical'
  ).length;

  const riskSignature = getRiskSignature(risks);
const cacheKey = `ai_risk_scan_${projectId ?? 'global'}_${riskSignature}`;

const displayRisks = topRisks.map((risk) => {
  const aiRisk = aiResult?.risks?.find((item) => item.id === risk.id);

  if (!aiRisk) return risk;

  return {
    ...risk,
    title: aiRisk.title || risk.title,
    description: aiRisk.description || risk.description,
    recommendation: aiRisk.recommendation || risk.recommendation,

    // 근거, 위험도, 카테고리는 원본 유지
    evidence: risk.evidence,
    severity: risk.severity,
    category: risk.category,
  };
});

const aiSummary = aiResult?.summary || getFallbackRiskSummary(risks);

const runAiRiskScan = async (force = false) => {
  try {
    setAiError('');

    if (risks.length === 0) {
      setAiResult({
        overallRiskLevel,
        summary: getFallbackRiskSummary([]),
        risks: [],
      });
      return;
    }

    if (!force) {
      const cached = sessionStorage.getItem(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);

        if (Date.now() - parsed.savedAt < AI_RISK_CACHE_TTL_MS) {
          setAiResult(parsed.result);
          return;
        }
      }
    }

    setAiLoading(true);

    const response = await supabaseService.getAiRiskScan({
      projectId,
      overallRiskLevel,
      risks,
      stats: {
        totalRiskCount: risks.length,
        highRiskCount,
        scheduleCount: schedules.filter((schedule) => !schedule.isBaseline).length,
        dailyReportCount: dailyReports.length,
      },
    });

    if (!response.ok || !response.result) {
      throw new Error(response.error || 'AI 리스크 분석에 실패했습니다.');
    }

    setAiResult(response.result);

    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        savedAt: Date.now(),
        result: response.result,
      })
    );
  } catch (error: any) {
    console.error(error);
    setAiError(error?.message || 'AI 리스크 분석 중 오류가 발생했습니다.');

    setAiResult({
      overallRiskLevel,
      summary: getFallbackRiskSummary(risks),
      risks,
    });
  } finally {
    setAiLoading(false);
  }
};

useEffect(() => {
  runAiRiskScan(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [riskSignature, projectId]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-md md:text-base font-black text-gray-900">
                AI 리스크 요약
              </h2>

              <span
                className={`px-2.5 py-1 rounded-full border text-[11px] font-black ${overallMeta.badgeClass}`}
              >
                전체 위험도 {overallMeta.label}
              </span>
            </div>

            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
             {aiSummary}
            </p>

            {aiError && (
             <p className="text-[11px] text-amber-600 mt-1">
             AI 문장 보강에 실패하여 규칙 기반 리스크 설명을 표시합니다.
             </p>
            )}
          </div>
        </div>

        <button
         type="button"
         onClick={() => {
         setRefreshCount((value) => value + 1);
         runAiRiskScan(true);
         }}
         disabled={aiLoading}
         className="inline-flex items-center justify-center gap-2 px-3 py-2 w-[150px] rounded-lg border border-blue-100 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 disabled:opacity-60 transition-colors"
         >
         {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
         {aiLoading ? 'AI 확인 중...' : '새로고침'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="text-[11px] text-gray-400 font-bold mb-1">전체 리스크</div>
          <div className="text-xl font-black text-gray-900">{risks.length}</div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="text-[11px] text-gray-400 font-bold mb-1">높음 이상</div>
          <div className="text-xl font-black text-gray-900">{highRiskCount}</div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="text-[11px] text-gray-400 font-bold mb-1">공정 수</div>
          <div className="text-xl font-black text-gray-900">
            {schedules.filter((schedule) => !schedule.isBaseline).length}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="text-[11px] text-gray-400 font-bold mb-1">최근 일보</div>
          <div className="text-xl font-black text-gray-900">{dailyReports.length}</div>
        </div>
      </div>

      {displayRisks.length > 0 ? (
       <div className="space-y-3">
         {displayRisks.map((risk) => {
            const meta = severityMeta[risk.severity];
            const RiskIcon = getRiskIcon(risk.category);

            return (
              <div
                key={risk.id}
                className={`rounded-xl border p-4 ${meta.cardClass}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
                    <RiskIcon className="w-4 h-4 text-gray-700" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />

                      <h3 className="text-sm font-black text-gray-900">
                        {risk.title}
                      </h3>

                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>

                      <span className="px-2 py-0.5 rounded-full bg-white/70 border border-gray-100 text-[10px] font-bold text-gray-500">
                        {getCategoryLabel(risk.category)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 leading-relaxed">
                      {risk.description}
                    </p>

                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="rounded-lg bg-white/70 border border-white p-3">
                        <div className="text-[11px] font-black text-gray-500 mb-1">
                          근거
                        </div>
                        <ul className="space-y-1">
                          {risk.evidence.slice(0, 4).map((item, index) => (
                            <li
                              key={index}
                              className="text-xs text-gray-600 leading-relaxed flex gap-2"
                            >
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-lg bg-white/70 border border-white p-3">
                        <div className="text-[11px] font-black text-gray-500 mb-1">
                          권장 조치
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          {risk.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-black text-emerald-900">
              현재 주요 리스크 신호가 크지 않습니다.
            </h3>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              공정표, 최근 공사일보, 문서 등록 현황 기준으로 즉시 조치가 필요한 항목은 확인되지 않았습니다.
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 text-[11px] text-gray-400">
        규칙 기반으로 위험 신호를 먼저 계산한 뒤, Gemini가 요약 문장과 권장 조치를 다듬습니다. 위험도와 근거는 코드가 계산한 값을 우선 사용합니다.
      </div>
    </div>
  );
}