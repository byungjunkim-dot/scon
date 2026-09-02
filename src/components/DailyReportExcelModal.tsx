import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileSpreadsheet, Download, Loader2, Calendar, CheckSquare, Square, Info } from 'lucide-react';
import { DailyReport, Project, AppSettings } from '../types';
import { exportDailyReportsToExcel } from '../utils/dailyReportExcelExport';

interface DailyReportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: DailyReport[];
  currentReport?: DailyReport | null;
  project: Project | null;
  settings?: AppSettings;
}

export const DailyReportExcelModal: React.FC<DailyReportExcelModalProps> = ({
  isOpen,
  onClose,
  reports,
  currentReport,
  project,
  settings
}) => {
  // Combine all reports including current report if not in array
  const allReports = useMemo(() => {
    const list = [...reports];
    if (currentReport && !list.some(r => r.id === currentReport.id || r.date === currentReport.date)) {
      list.push(currentReport);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [reports, currentReport]);

  // Extract all distinct year-months
  const availableMonths = useMemo(() => {
    const monthMap = new Map<string, number>();
    allReports.forEach(r => {
      if (r.date && r.date.length >= 7) {
        const ym = r.date.slice(0, 7);
        monthMap.set(ym, (monthMap.get(ym) || 0) + 1);
      }
    });

    const list = Array.from(monthMap.entries()).map(([month, count]) => ({
      month,
      count
    }));

    // Sort descending by month
    list.sort((a, b) => b.month.localeCompare(a.month));
    return list;
  }, [allReports]);

  // Default selected month: currentReport's month or current calendar month or latest month
  const initialMonth = useMemo(() => {
    if (currentReport?.date) return currentReport.date.slice(0, 7);
    if (availableMonths.length > 0) return availableMonths[0].month;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [currentReport, availableMonths]);

  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(initialMonth);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter reports belonging to selected month
  const monthReports = useMemo(() => {
    return allReports
      .filter(r => r.date && r.date.startsWith(selectedYearMonth))
      .sort((a, b) => a.date.localeCompare(b.date)); // Sort ascending for preview & sheet order
  }, [allReports, selectedYearMonth]);

  // When selected month changes, default to selecting all reports in that month
  useEffect(() => {
    setSelectedIds(monthReports.map(r => r.id));
    setErrorMessage(null);
  }, [selectedYearMonth, monthReports]);

  const isAllSelected = monthReports.length > 0 && selectedIds.length === monthReports.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(monthReports.map(r => r.id));
    }
  };

  const toggleReport = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleExport = async () => {
    const targetReports = monthReports.filter(r => selectedIds.includes(r.id));
    if (targetReports.length === 0) {
      setErrorMessage('다운로드할 일보를 1개 이상 선택해주세요.');
      return;
    }

    try {
      setIsExporting(true);
      setErrorMessage(null);
      await exportDailyReportsToExcel(targetReports, project, selectedYearMonth, settings, allReports);
      onClose();
    } catch (err: any) {
      console.error('Excel Export Error:', err);
      setErrorMessage(err.message || '엑셀 파일 생성 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  // Format month for display (e.g., "2026년 09월")
  const formatMonthDisplay = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${y}년 ${parseInt(m, 10)}월`;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[500] p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4.5 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
              </div>
              <div>
                <h3 className="text-lg font-bold">공사일보 엑셀 다운로드</h3>
                <p className="text-xs text-emerald-100 opacity-90">
                  선택한 월의 공사일보를 일자별 시트(Sheet)로 구분하여 다운로드합니다.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Month Selection */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/80 space-y-3">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Calendar size={15} className="text-emerald-600" />
                다운로드 대상 월 선택
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="month"
                    value={selectedYearMonth}
                    onChange={e => setSelectedYearMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                  />
                </div>

                {availableMonths.length > 0 && (
                  <div>
                    <select
                      value={selectedYearMonth}
                      onChange={e => setSelectedYearMonth(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    >
                      {availableMonths.map(item => (
                        <option key={item.month} value={item.month}>
                          {formatMonthDisplay(item.month)} ({item.count}일차 작성됨)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg border border-gray-150">
                <Info size={14} className="text-emerald-600 shrink-0" />
                <span>
                  선택 월: <strong className="text-gray-800">{formatMonthDisplay(selectedYearMonth)}</strong>
                  {' '}(총 <strong>{monthReports.length}</strong>개 일보 데이터)
                </span>
              </div>
            </div>

            {/* Daily Reports List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-gray-700">
                  포함할 일보 선택 ({selectedIds.length}/{monthReports.length})
                </span>
                {monthReports.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                  >
                    {isAllSelected ? (
                      <>
                        <CheckSquare size={14} /> 전체 해제
                      </>
                    ) : (
                      <>
                        <Square size={14} /> 전체 선택
                      </>
                    )}
                  </button>
                )}
              </div>

              {monthReports.length > 0 ? (
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-72 overflow-y-auto bg-white">
                  {monthReports.map(rep => {
                    const isChecked = selectedIds.includes(rep.id);
                    const personnelCount =
                      (Number(rep.personnel?.direct) || 0) +
                      (Number(rep.personnel?.outsourced) || 0) +
                      (Number(rep.personnel?.other) || 0);
                    const taskCount = rep.todayTasks?.length || 0;

                    return (
                      <label
                        key={rep.id}
                        className={`flex items-center gap-3 p-3 hover:bg-emerald-50/40 cursor-pointer transition-colors ${
                          isChecked ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleReport(rep.id)}
                          className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                        />
                        <div className="flex-1 min-w-0 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">
                              {rep.date}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
                              {rep.weather?.status || '맑음'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>작업: <strong>{taskCount}</strong>건</span>
                            <span>인원: <strong>{personnelCount}</strong>명</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              rep.approvalStatus === '승인'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : rep.approvalStatus === '검토완료'
                                ? 'bg-green-50 text-green-700 border border-green-100'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {rep.approvalStatus || '작성중'}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs">
                  {formatMonthDisplay(selectedYearMonth)}에 등록된 공사일보가 없습니다.
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-200 font-medium">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-200/80 flex justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200/60 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || selectedIds.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all text-sm font-bold shadow-sm shadow-emerald-700/20"
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> 엑셀 생성 중...
                </>
              ) : (
                <>
                  <Download size={16} /> 엑셀 다운로드 ({selectedIds.length}개 일자)
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
