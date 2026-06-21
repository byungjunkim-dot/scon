import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, FileText, Download } from 'lucide-react';
import { DailyReport, Project } from '../types';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';

interface BulkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: DailyReport[];
  project: Project | null;
}

export const BulkExportModal: React.FC<BulkExportModalProps> = ({ isOpen, onClose, reports, project }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    });
  }, [reports, startDate, endDate]);

  const isAllSelected = useMemo(() => {
    return filteredReports.length > 0 && filteredReports.every(r => selectedIds.includes(r.id));
  }, [filteredReports, selectedIds]);

  const toggleReport = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredReports.find(r => r.id === id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredReports.map(r => r.id)])));
    }
  };

  const generatePdfBlob = async (reportId: string): Promise<Blob> => {
    const reportDom = document.getElementById(`print-report-${reportId}`);
    if (!reportDom) throw new Error('Report DOM not found');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pdfWidth - (margin * 2);
    
    const sections = reportDom.querySelectorAll('[data-pdf-section]');
    let currentY = margin;

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i] as HTMLElement;
      const canvas = await htmlToImage.toCanvas(sec, {
        quality: 1.0,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      const sectionRatio = canvas.height / canvas.width;
      const sectionPdfHeight = contentWidth * sectionRatio;

      if (currentY + sectionPdfHeight > pdfHeight - margin && currentY > margin) {
        pdf.addPage();
        currentY = margin;
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', margin, currentY, contentWidth, sectionPdfHeight);
      currentY += sectionPdfHeight + 5;
    }

    return pdf.output('blob');
  };

  const handleBulkExport = async (type: 'zip' | 'merge') => {
    if (selectedIds.length === 0) {
      alert('출력할 일보를 선택해주세요.');
      return;
    }
    setIsProcessing(true);
    try {
      if (type === 'zip') {
        const zip = new JSZip();
        for (const id of selectedIds) {
          const report = reports.find(r => r.id === id);
          if (!report) continue;
          const blob = await generatePdfBlob(id);
          zip.file(`공사일보_${project?.name || '프로젝트'}_${report.date}.pdf`, blob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `공사일보_일괄_${project?.name || '프로젝트'}.zip`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const mergedPdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = mergedPdf.internal.pageSize.getWidth();
        const pdfHeight = mergedPdf.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pdfWidth - (margin * 2);
        let isFirstPage = true;
        
        for (const id of selectedIds) {
          const reportDom = document.getElementById(`print-report-${id}`);
          if (!reportDom) continue;

          if (!isFirstPage) {
             mergedPdf.addPage();
          } else {
             isFirstPage = false;
          }

          let currentY = margin;
          const sections = reportDom.querySelectorAll('[data-pdf-section]');

          for (let i = 0; i < sections.length; i++) {
            const sec = sections[i] as HTMLElement;
            const canvas = await htmlToImage.toCanvas(sec, { quality: 1.0, backgroundColor: '#ffffff', pixelRatio: 2 });
            const sectionRatio = canvas.height / canvas.width;
            const sectionPdfHeight = contentWidth * sectionRatio;

            if (currentY + sectionPdfHeight > pdfHeight - margin && currentY > margin) {
              mergedPdf.addPage();
              currentY = margin;
            }

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            mergedPdf.addImage(imgData, 'JPEG', margin, currentY, contentWidth, sectionPdfHeight);
            currentY += sectionPdfHeight + 5;
          }
        }
        mergedPdf.save(`공사일보_통합_${project?.name || '프로젝트'}.pdf`);
      }
    } catch (err) {
      console.error(err);
      alert('일괄 내보내기 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">일괄 다운로드</h3>
                <button onClick={onClose}><X /></button>
            </div>
            <div className="flex gap-2 mb-4 items-center">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded p-1 text-sm" />
              <span className="self-center">~</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded p-1 text-sm" />
              <label className="flex items-center gap-1 text-sm cursor-pointer ml-auto">
                <input type="checkbox" checked={isAllSelected} onChange={toggleAll} />
                전체 선택
              </label>
            </div>
            <div className="max-h-60 overflow-y-auto mb-4 space-y-2">
                {filteredReports.map(r => (
                    <div key={r.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                        <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleReport(r.id)} />
                        <span>{r.date} 공사일보</span>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <button onClick={() => handleBulkExport('zip')} disabled={isProcessing} className="flex-1 bg-blue-600 text-white p-2 rounded flex items-center justify-center gap-2">
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} ZIP 다운로드
                </button>
                <button onClick={() => handleBulkExport('merge')} disabled={isProcessing} className="flex-1 bg-green-600 text-white p-2 rounded flex items-center justify-center gap-2">
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Merged PDF 다운로드
                </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Hidden print containers */}
      <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
        {reports.filter(r => selectedIds.includes(r.id)).map(report => (
          <div 
            key={`print-${report.id}`} 
            id={`print-report-${report.id}`} 
            className="bg-white p-8 w-[800px] text-black"
          >
            <div data-pdf-section className="text-center border-b-2 border-black pb-4 mb-6">
              <h1 className="text-4xl font-bold mb-2">공 사 일 보</h1>
              <h2 className="text-2xl text-gray-700">{project?.name || ''}</h2>
            </div>
            
            <div data-pdf-section className="flex justify-between mb-6 text-sm">
              <div><span className="font-bold">일자:</span> {report.date}</div>
              <div><span className="font-bold">작성자:</span> {report.author}</div>
              <div><span className="font-bold">날씨:</span> {report.weather?.status} ({report.weather?.temperature})</div>
            </div>

            <div data-pdf-section className="mb-6 border border-gray-300">
              <h3 className="text-lg font-bold bg-gray-100 p-2 border-b border-gray-300">금일 작업 명세</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300">
                    <th className="border-r border-gray-300 p-2 text-left">공종</th>
                    <th className="border-r border-gray-300 p-2 text-left">세부공종</th>
                    <th className="border-r border-gray-300 p-2 text-left">작업명</th>
                    <th className="p-2 text-left">위치</th>
                  </tr>
                </thead>
                <tbody>
                  {report.todayTasks?.map(t => (
                    <tr key={t.id} className="border-b border-gray-200 last:border-0 relative">
                      <td className="border-r border-gray-300 p-2">{t.category}</td>
                      <td className="border-r border-gray-300 p-2">{t.subCategory}</td>
                      <td className="border-r border-gray-300 p-2">{t.taskName}</td>
                      <td className="p-2">{t.location}</td>
                    </tr>
                  ))}
                  {(!report.todayTasks || report.todayTasks.length === 0) && (
                    <tr><td colSpan={4} className="p-4 text-center text-gray-500">작업 내용이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div data-pdf-section className="mb-6 border border-gray-300">
              <h3 className="text-lg font-bold bg-gray-100 p-2 border-b border-gray-300">명일 작업 계획</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300">
                    <th className="border-r border-gray-300 p-2 text-left">공종</th>
                    <th className="border-r border-gray-300 p-2 text-left">세부공종</th>
                    <th className="border-r border-gray-300 p-2 text-left">작업명</th>
                    <th className="p-2 text-left">위치</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tomorrowTasks?.map(t => (
                    <tr key={t.id} className="border-b border-gray-200 last:border-0 relative">
                      <td className="border-r border-gray-300 p-2">{t.category}</td>
                      <td className="border-r border-gray-300 p-2">{t.subCategory}</td>
                      <td className="border-r border-gray-300 p-2">{t.taskName}</td>
                      <td className="p-2">{t.location}</td>
                    </tr>
                  ))}
                  {(!report.tomorrowTasks || report.tomorrowTasks.length === 0) && (
                    <tr><td colSpan={4} className="p-4 text-center text-gray-500">계획이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div data-pdf-section className="mb-6 border border-gray-300">
              <h3 className="text-lg font-bold bg-gray-100 p-2 border-b border-gray-300">출역 인원 및 장비</h3>
              <div className="grid grid-cols-2">
                <div className="p-4 border-r border-gray-300">
                  <div className="font-bold mb-2">인원 현황</div>
                  <ul>
                    <li>직영: {report.personnel?.direct || 0}명</li>
                    <li>외주: {report.personnel?.outsourced || 0}명</li>
                    <li>기타: {report.personnel?.other || 0}명</li>
                    <li className="font-bold border-t border-gray-200 mt-2 pt-2">
                      총 인원: {(report.personnel?.direct || 0) + (report.personnel?.outsourced || 0) + (report.personnel?.other || 0)}명
                    </li>
                  </ul>
                </div>
                <div className="p-4">
                  <div className="font-bold mb-2">장비 현황</div>
                  <ul className="list-disc pl-4">
                    {report.equipment?.map(eq => (
                      <li key={eq.id}>{eq.type} ({eq.capacity}): {eq.quantity}대</li>
                    ))}
                    {(!report.equipment || report.equipment.length === 0) && (
                      <li className="text-gray-500 list-none">장비 내역 없음</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div data-pdf-section className="mb-6 border border-gray-300">
              <h3 className="text-lg font-bold bg-gray-100 p-2 border-b border-gray-300">특기사항 / 이슈</h3>
              {report.issues?.length > 0 ? (
                <ul className="list-disc p-4">
                  {report.issues.map(iss => (
                    <li key={iss.id} className="text-sm mb-1"><span className="font-bold">[{iss.type}]</span> {iss.description}</li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">입력된 내용이 없습니다.</div>
              )}
            </div>
            
            <div data-pdf-section className="mb-6 border border-gray-300">
              <h3 className="text-lg font-bold bg-gray-100 p-2 border-b border-gray-300">현장 사진</h3>
              {report.photos?.length > 0 ? (
                <>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    {report.photos.slice(0, 4).map(photo => (
                      <div key={photo.id} className="border border-gray-200 p-2 text-center">
                        <img src={photo.url} crossOrigin="anonymous" alt={photo.title || '현장 사진'} className="h-[200px] w-full object-cover mb-2" />
                        <div className="text-xs">{photo.title || photo.category || '사진'}</div>
                      </div>
                    ))}
                  </div>
                  {report.photos.length > 4 && (
                    <div className="p-2 text-right text-xs text-gray-500 border-t border-gray-200">
                      외 {report.photos.length - 4}장의 사진이 있습니다.
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">등록된 사진이 없습니다.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </AnimatePresence>
  );
};
