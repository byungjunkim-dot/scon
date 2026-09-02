import ExcelJS from 'exceljs';
import { DailyReport, Project, AppSettings, DailyPhoto } from '../types';

/**
 * Helper to sanitize and ensure unique sheet names for Excel (max 31 chars, no invalid characters)
 */
function getUniqueSheetName(dateStr: string, index: number, existingNames: Set<string>): string {
  let baseName = dateStr ? dateStr.trim() : `일보_${index + 1}`;

  // Excel sheet names cannot contain: \ / ? * : [ ]
  baseName = baseName.replace(/[\\/?*:[\]]/g, '_').trim().slice(0, 28);
  if (!baseName) baseName = `Sheet_${index + 1}`;

  let finalName = baseName;
  let counter = 1;
  while (existingNames.has(finalName)) {
    counter++;
    const suffix = ` (${counter})`;
    finalName = baseName.slice(0, 31 - suffix.length) + suffix;
  }
  existingNames.add(finalName);
  return finalName;
}

const BORDER_STYLE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'CBD5E1' } },
  left: { style: 'thin', color: { argb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
  right: { style: 'thin', color: { argb: 'CBD5E1' } }
};

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'F1F5F9' } // Slate 100
};

const SECTION_HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'E2E8F0' } // Slate 200
};

const TOTAL_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'EFF6FF' } // Blue 50
};

/**
 * Converts image URL to base64 with original aspect ratio preserved (contained in a white canvas box matching cell bounds)
 */
async function fetchImageWithPreservedAspect(
  url: string,
  targetWidth = 870,
  targetHeight = 400
): Promise<{ base64: string; extension: 'jpeg' | 'png' } | null> {
  if (!url) return null;
  try {
    let finalSrc = url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          finalSrc = URL.createObjectURL(blob);
        }
      } catch {
        // use url directly if blob conversion fails
      }
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = finalSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill clean white background to blend seamlessly with Excel cell area
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const imgWidth = img.naturalWidth || img.width || 1;
    const imgHeight = img.naturalHeight || img.height || 1;
    const imgAspect = imgWidth / imgHeight;

    const pad = 4; // 4px subtle inner padding
    const maxDrawWidth = targetWidth - pad * 2;
    const maxDrawHeight = targetHeight - pad * 2;
    const maxAspect = maxDrawWidth / maxDrawHeight;

    let drawWidth: number;
    let drawHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (imgAspect > maxAspect) {
      // Image is wider than container box -> fit by width
      drawWidth = maxDrawWidth;
      drawHeight = maxDrawWidth / imgAspect;
      offsetX = pad;
      offsetY = (targetHeight - drawHeight) / 2;
    } else {
      // Image is taller than container box -> fit by height
      drawHeight = maxDrawHeight;
      drawWidth = maxDrawHeight * imgAspect;
      offsetX = (targetWidth - drawWidth) / 2;
      offsetY = pad;
    }

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
    const base64Data = dataUrl.split(',')[1];
    return { base64: base64Data, extension: 'jpeg' };
  } catch (err) {
    console.warn('Failed to load & process photo for Excel export:', url, err);
    return null;
  }
}

/**
 * Format photo title: '공종 / 세부공종 / 사진제목'
 */
function formatPhotoCaption(photo: DailyPhoto, index: number): string {
  const parts: string[] = [];
  if (photo.category?.trim()) parts.push(photo.category.trim());
  if (photo.subCategory?.trim()) parts.push(photo.subCategory.trim());
  const title = photo.title?.trim() || photo.description?.trim() || `현장사진 ${index + 1}`;
  parts.push(title);
  return parts.join(' / ');
}

/**
 * Export daily reports of a selected month into a single Excel file with a sheet for each day
 */
export async function exportDailyReportsToExcel(
  reports: DailyReport[],
  project: Project | null,
  selectedYearMonth: string,
  settings?: AppSettings,
  allReports?: DailyReport[]
): Promise<void> {
  // Sort reports ascending by date for a natural calendar order in sheets
  const sortedReports = [...reports].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (sortedReports.length === 0) {
    throw new Error('내보낼 공사일보 데이터가 없습니다.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Construction Management System';
  workbook.lastModifiedBy = 'User';
  workbook.created = new Date();
  workbook.modified = new Date();

  const usedSheetNames = new Set<string>();
  const referenceReports = allReports && allReports.length > 0 ? allReports : sortedReports;

  // Process each daily report sheet sequentially to handle image async loading
  for (let reportIndex = 0; reportIndex < sortedReports.length; reportIndex++) {
    const report = sortedReports[reportIndex];
    const sheetName = getUniqueSheetName(report.date, reportIndex, usedSheetNames);
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: false }], // Hide excel gridlines for clean white background
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0, // Auto vertical pages based on explicit section page breaks
        margins: {
          left: 0.3,
          right: 0.3,
          top: 0.35,
          bottom: 0.35,
          header: 0.2,
          footer: 0.2
        },
        showGridLines: false, // Do not print cell gridlines outside defined tables
      }
    });

    // 1. Set column widths (10 columns: A to J)
    worksheet.columns = [
      { key: 'colA', width: 5.5 }, // 1: No
      { key: 'colB', width: 13 },   // 2: 공종
      { key: 'colC', width: 13.5 }, // 3: 세부공종 / 업체명 / 장비명
      { key: 'colD', width: 11 },   // 4: 작업내용(작업명) / 전일누계 / 규격
      { key: 'colE', width: 10 },   // 5: 업체 / 관리자(직영)
      { key: 'colF', width: 11 },   // 6: 위치 / 작업자(외주)
      { key: 'colG', width: 10 },   // 7: 작업량 / 기타 / 금일 수량
      { key: 'colH', width: 10 },   // 8: 계 (출력인원) / 비고 (작업사항)
      { key: 'colI', width: 10 },   // 9: 합계 (출력인원) / 비고 (작업사항)
      { key: 'colJ', width: 12 },   // 10: 비고 (작업시간/비고)
    ];

    let currentRow = 1;
    let pageEstimatedRows = 0;

    // Helper to add page break if the next section would cause mid-table cut on A4
    // 1~5번 항목의 기본 행 수 합계(약 44행)는 A4 1페이지에 모두 온전히 들어가야 하므로 MAX_PAGE_ROWS를 48로 설정
    const MAX_PAGE_ROWS = 48;
    const checkAndAddPageBreak = (neededRows: number) => {
      if (pageEstimatedRows + neededRows > MAX_PAGE_ROWS && pageEstimatedRows > 6) {
        worksheet.getRow(currentRow).addPageBreak();
        pageEstimatedRows = 0;
      }
    };

    // 2. Title & Approval Box
    // Title: merge A1:G2 (Col 1~7)
    worksheet.mergeCells(`A${currentRow}:G${currentRow + 1}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = '공  사  일  보';
    titleCell.font = { name: 'Malgun Gothic', size: 16, bold: true, color: { argb: '0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Approval headers (H1, I1, J1)
    worksheet.getCell(`H${currentRow}`).value = '작성자';
    worksheet.getCell(`I${currentRow}`).value = '검토자';
    worksheet.getCell(`J${currentRow}`).value = '승인자';

    ['H', 'I', 'J'].forEach(col => {
      const cell = worksheet.getCell(`${col}${currentRow}`);
      cell.fill = HEADER_FILL;
      cell.font = { name: 'Malgun Gothic', size: 9, bold: true, color: { argb: '334155' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDER_STYLE;
    });

    // Approval values (H2, I2, J2)
    const authorCell = worksheet.getCell(`H${currentRow + 1}`);
    const reviewerCell = worksheet.getCell(`I${currentRow + 1}`);
    const approverCell = worksheet.getCell(`J${currentRow + 1}`);

    authorCell.value = report.author || '-';
    reviewerCell.value = report.reviewer || '-';
    approverCell.value = report.approver || '-';

    [authorCell, reviewerCell, approverCell].forEach(c => {
      c.font = { name: 'Malgun Gothic', size: 9 };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.border = BORDER_STYLE;
    });

    worksheet.getRow(currentRow).height = 20;
    worksheet.getRow(currentRow + 1).height = 26;

    currentRow += 2;
    worksheet.getRow(currentRow).height = 6;
    currentRow++; // Now at row 4

    // 3. Project & Date & Weather Summary Table
    // Row 4: Project Info & Date
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = '프로젝트명';
    worksheet.getCell(`A${currentRow}`).fill = HEADER_FILL;
    worksheet.getCell(`A${currentRow}`).font = { name: 'Malgun Gothic', size: 9, bold: true };
    worksheet.getCell(`A${currentRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getCell(`A${currentRow}`).border = BORDER_STYLE;
    worksheet.getCell(`B${currentRow}`).border = BORDER_STYLE;

    worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
    worksheet.getCell(`C${currentRow}`).value = project?.name || '프로젝트 미지정';
    worksheet.getCell(`C${currentRow}`).font = { name: 'Malgun Gothic', size: 9, bold: true, color: { argb: '1E293B' } };
    worksheet.getCell(`C${currentRow}`).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ['C', 'D', 'E', 'F'].forEach(col => { worksheet.getCell(`${col}${currentRow}`).border = BORDER_STYLE; });

    worksheet.getCell(`G${currentRow}`).value = '일 자';
    worksheet.getCell(`G${currentRow}`).fill = HEADER_FILL;
    worksheet.getCell(`G${currentRow}`).font = { name: 'Malgun Gothic', size: 9, bold: true };
    worksheet.getCell(`G${currentRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getCell(`G${currentRow}`).border = BORDER_STYLE;

    worksheet.mergeCells(`H${currentRow}:J${currentRow}`);
    worksheet.getCell(`H${currentRow}`).value = report.date || '';
    worksheet.getCell(`H${currentRow}`).font = { name: 'Malgun Gothic', size: 9, bold: true };
    worksheet.getCell(`H${currentRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
    ['H', 'I', 'J'].forEach(col => { worksheet.getCell(`${col}${currentRow}`).border = BORDER_STYLE; });

    worksheet.getRow(currentRow).height = 20;
    currentRow++;

    // Row 5: Weather & Progress Rate
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = '기상 상태';
    worksheet.getCell(`A${currentRow}`).fill = HEADER_FILL;
    worksheet.getCell(`A${currentRow}`).font = { name: 'Malgun Gothic', size: 9, bold: true };
    worksheet.getCell(`A${currentRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getCell(`A${currentRow}`).border = BORDER_STYLE;
    worksheet.getCell(`B${currentRow}`).border = BORDER_STYLE;

    const weather = report.weather;
    const weatherText = weather
      ? `${weather.status || '맑음'} (최고: ${weather.maxTemp || '-'}, 최저: ${weather.minTemp || '-'}, 강수: ${weather.precipitation || '0mm'}, 풍속: ${weather.windSpeed || '-'})`
      : '맑음';
    worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
    worksheet.getCell(`C${currentRow}`).value = weatherText;
    worksheet.getCell(`C${currentRow}`).font = { name: 'Malgun Gothic', size: 9 };
    worksheet.getCell(`C${currentRow}`).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ['C', 'D', 'E', 'F'].forEach(col => { worksheet.getCell(`${col}${currentRow}`).border = BORDER_STYLE; });

    worksheet.getCell(`G${currentRow}`).value = '공 정 률';
    worksheet.getCell(`G${currentRow}`).fill = HEADER_FILL;
    worksheet.getCell(`G${currentRow}`).font = { name: 'Malgun Gothic', size: 9, bold: true };
    worksheet.getCell(`G${currentRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getCell(`G${currentRow}`).border = BORDER_STYLE;

    const plannedRate = report.progressRate?.planned ?? 0;
    const actualRate = report.progressRate?.actual ?? 0;
    worksheet.mergeCells(`H${currentRow}:J${currentRow}`);
    worksheet.getCell(`H${currentRow}`).value = `계획: ${plannedRate}% / 실행: ${actualRate}%`;
    worksheet.getCell(`H${currentRow}`).font = { name: 'Malgun Gothic', size: 9, bold: true, color: { argb: '1D4ED8' } };
    worksheet.getCell(`H${currentRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
    ['H', 'I', 'J'].forEach(col => { worksheet.getCell(`${col}${currentRow}`).border = BORDER_STYLE; });

    worksheet.getRow(currentRow).height = 20;
    currentRow++;
    worksheet.getRow(currentRow).height = 19;
    currentRow++; // Blank row separator
    pageEstimatedRows = 5;

    // Helper function for adding section titles
    const addSectionTitle = (title: string) => {
      worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
      const secCell = worksheet.getCell(`A${currentRow}`);
      secCell.value = title;
      secCell.fill = SECTION_HEADER_FILL;
      secCell.font = { name: 'Malgun Gothic', size: 9.5, bold: true, color: { argb: '1E293B' } };
      secCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      for (let c = 1; c <= 10; c++) {
        worksheet.getRow(currentRow).getCell(c).border = BORDER_STYLE;
      }
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
    };

    // 4. Section 1: 금일 작업 사항 (작업내용 D~F, 위치 G~H, 작업량 I, 업체 J)
    // 기본 5행 표시 (데이터가 더 많으면 데이터 개수만큼 표시)
    const sec1DataRowsCount = Math.max(report.todayTasks?.length || 0, 5);
    const sec1Needed = 2 + sec1DataRowsCount + 1;
    checkAndAddPageBreak(sec1Needed);
    addSectionTitle('1. 금일 작업 사항');

    // Table Header for Today's Tasks
    worksheet.getCell(`A${currentRow}`).value = 'No';
    worksheet.getCell(`B${currentRow}`).value = '공종';
    worksheet.getCell(`C${currentRow}`).value = '세부공종';
    worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
    worksheet.getCell(`D${currentRow}`).value = '작업내용(작업명)';
    worksheet.mergeCells(`G${currentRow}:H${currentRow}`);
    worksheet.getCell(`G${currentRow}`).value = '위치 (동/층/구역)';
    worksheet.getCell(`I${currentRow}`).value = '작업량';
    worksheet.getCell(`J${currentRow}`).value = '업체';

    for (let c = 1; c <= 10; c++) {
      const cell = worksheet.getRow(currentRow).getCell(c);
      cell.fill = HEADER_FILL;
      cell.font = { name: 'Malgun Gothic', size: 9, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDER_STYLE;
    }
    worksheet.getRow(currentRow).height = 19;
    currentRow++;

    const todayTasksList = report.todayTasks || [];
    for (let idx = 0; idx < sec1DataRowsCount; idx++) {
      worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
      worksheet.mergeCells(`G${currentRow}:H${currentRow}`);
      const row = worksheet.getRow(currentRow);
      const task = todayTasksList[idx];

      if (task) {
        const locationStr = [
          Array.isArray(task.dongBlock) ? task.dongBlock.join(',') : task.dongBlock,
          Array.isArray(task.floor) ? task.floor.join(',') : task.floor,
          Array.isArray(task.zone) ? task.zone.join(',') : task.zone
        ].filter(Boolean).join(' / ') || task.location || '-';

        row.getCell(1).value = idx + 1;
        row.getCell(2).value = task.category || '-';
        row.getCell(3).value = task.subCategory || '-';
        row.getCell(4).value = task.taskName || '-';
        row.getCell(7).value = locationStr;
        row.getCell(9).value = task.amount || '-';
        row.getCell(10).value = task.contractor || '-';
      } else {
        // 빈 행 (기본 5칸 유지)
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = '';
        row.getCell(3).value = '';
        row.getCell(4).value = '';
        row.getCell(7).value = '';
        row.getCell(9).value = '';
        row.getCell(10).value = '';
      }

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };

      for (let c = 1; c <= 10; c++) {
        row.getCell(c).font = { name: 'Malgun Gothic', size: 9 };
        row.getCell(c).border = BORDER_STYLE;
      }
      row.height = 18.5;
      currentRow++;
    }

    worksheet.getRow(currentRow).height = 19;
    currentRow++;
    pageEstimatedRows += sec1Needed;

    // 5. Section 2: 출력 인원 현황 (전일누계, 계, 누계합계, 비고[작업시간])
    const personnelList = report.personnel?.details && report.personnel.details.length > 0
      ? report.personnel.details
      : ((Number(report.personnel?.direct) || 0) > 0 || (Number(report.personnel?.outsourced) || 0) > 0 || (Number(report.personnel?.other) || 0) > 0)
        ? [{
            id: 'legacy',
            discipline: '현장 전체',
            contractor: '',
            workTime: '주간',
            direct: Number(report.personnel?.direct) || 0,
            outsourced: Number(report.personnel?.outsourced) || 0,
            other: Number(report.personnel?.other) || 0
          }]
        : [];

    // Calculate previous cumulative personnel map
    const prevCumMap: Record<string, number> = {};
    const pastReports = referenceReports.filter(r => r.date < report.date && r.id !== report.id);
    pastReports.forEach(r => {
      if (r.personnel?.details && Array.isArray(r.personnel.details) && r.personnel.details.length > 0) {
        r.personnel.details.forEach(d => {
          const key = `${(d.discipline || '').trim()}||${(d.contractor || '').trim()}`;
          const discKey = (d.discipline || '').trim();
          const count = (Number(d.direct) || 0) + (Number(d.outsourced) || 0) + (Number(d.other) || 0);
          prevCumMap[key] = (prevCumMap[key] || 0) + count;
          if (discKey) {
            prevCumMap[`DISC::${discKey}`] = (prevCumMap[`DISC::${discKey}`] || 0) + count;
          }
        });
      } else {
        const direct = Number(r.personnel?.direct) || 0;
        const outsourced = Number(r.personnel?.outsourced) || 0;
        const other = Number(r.personnel?.other) || 0;
        prevCumMap['legacy'] = (prevCumMap['legacy'] || 0) + (direct + outsourced + other);
      }
    });

    // Calculate total previous cumulative personnel across ALL past reports (date < report.date)
    let totalPrevCumPersonnel = 0;
    pastReports.forEach(r => {
      if (r.personnel?.details && Array.isArray(r.personnel.details) && r.personnel.details.length > 0) {
        r.personnel.details.forEach(d => {
          totalPrevCumPersonnel += (Number(d.direct) || 0) + (Number(d.outsourced) || 0) + (Number(d.other) || 0);
        });
      } else {
        totalPrevCumPersonnel += (Number(r.personnel?.direct) || 0) + (Number(r.personnel?.outsourced) || 0) + (Number(r.personnel?.other) || 0);
      }
    });

    // Calculate cumulative totals up to current report (date <= report.date)
    let cumDirect = 0;
    let cumOutsourced = 0;
    let cumOther = 0;
    const upToTodayReports = referenceReports.filter(r => r.date <= report.date);
    upToTodayReports.forEach(r => {
      if (r.personnel?.details && Array.isArray(r.personnel.details) && r.personnel.details.length > 0) {
        r.personnel.details.forEach(d => {
          cumDirect += Number(d.direct) || 0;
          cumOutsourced += Number(d.outsourced) || 0;
          cumOther += Number(d.other) || 0;
        });
      } else {
        cumDirect += Number(r.personnel?.direct) || 0;
        cumOutsourced += Number(r.personnel?.outsourced) || 0;
        cumOther += Number(r.personnel?.other) || 0;
      }
    });
    const totalCumulativePersonnel = cumDirect + cumOutsourced + cumOther;

    // 기본 5행 표시 + 1개 합계행
    const sec2DataRowsCount = Math.max(personnelList.length, 5);
    const sec2Needed = 2 + sec2DataRowsCount + 1 + 1; // 제목+헤더+데이터(최소5)+합계행+여백
    checkAndAddPageBreak(sec2Needed);
    addSectionTitle('2. 출력 인원 현황');

    const personnelHeaders = [
      'No', '공종', '업체명', '전일누계', '관리자', '작업자', '기타', '계', '누계합계', '비고'
    ];
    personnelHeaders.forEach((th, idx) => {
      const cell = worksheet.getRow(currentRow).getCell(idx + 1);
      cell.value = th;
      cell.fill = HEADER_FILL;
      cell.font = { name: 'Malgun Gothic', size: 9, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDER_STYLE;
    });
    worksheet.getRow(currentRow).height = 19;
    currentRow++;

    let sumPrevCum = 0;
    let sumDirect = 0;
    let sumOutsourced = 0;
    let sumOther = 0;
    let sumRowTotal = 0;
    let sumGrandTotal = 0;

    for (let idx = 0; idx < sec2DataRowsCount; idx++) {
      const row = worksheet.getRow(currentRow);
      const p = personnelList[idx];

      if (p) {
        const direct = Number(p.direct) || 0;
        const outsourced = Number(p.outsourced) || 0;
        const other = Number(p.other) || 0;
        const rowTotal = direct + outsourced + other; // 금일 인원 '계'

        const key = `${(p.discipline || '').trim()}||${(p.contractor || '').trim()}`;
        const discKey = `DISC::${(p.discipline || '').trim()}`;
        const prevCum = prevCumMap[key] !== undefined
          ? prevCumMap[key]
          : (prevCumMap[discKey] !== undefined ? prevCumMap[discKey] : (p.id === 'legacy' ? (prevCumMap['legacy'] || 0) : 0));
        
        const rowGrandTotal = prevCum + rowTotal; // 전일누계 + 금일 계 = 금일 누계 인원

        sumPrevCum += prevCum;
        sumDirect += direct;
        sumOutsourced += outsourced;
        sumOther += other;
        sumRowTotal += rowTotal;
        sumGrandTotal += rowGrandTotal;

        row.getCell(1).value = idx + 1;
        row.getCell(2).value = p.discipline || '-';
        row.getCell(3).value = p.contractor || '-';
        row.getCell(4).value = prevCum;
        row.getCell(5).value = direct;
        row.getCell(6).value = outsourced;
        row.getCell(7).value = other;
        row.getCell(8).value = rowTotal;
        row.getCell(9).value = rowGrandTotal;
        row.getCell(10).value = p.workTime || '주간'; // '비고'란에 '작업시간'의 내용 표현

        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        // 빈 행 (기본 5칸 유지)
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = '';
        row.getCell(3).value = '';
        row.getCell(4).value = '';
        row.getCell(5).value = '';
        row.getCell(6).value = '';
        row.getCell(7).value = '';
        row.getCell(8).value = '';
        row.getCell(9).value = '';
        row.getCell(10).value = '';

        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      }

      for (let c = 1; c <= 10; c++) {
        row.getCell(c).font = { name: 'Malgun Gothic', size: 9 };
        row.getCell(c).border = BORDER_STYLE;
      }
      row.height = 18.5;
      currentRow++;
    }

    // Total Row for Personnel (merge A:C and H:J)
    const totalRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    worksheet.mergeCells(`H${currentRow}:J${currentRow}`);

    totalRow.getCell(1).value = '합  계';
    totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    totalRow.getCell(4).value = totalPrevCumPersonnel;
    totalRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    totalRow.getCell(5).value = cumDirect;
    totalRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
    totalRow.getCell(6).value = cumOutsourced;
    totalRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
    totalRow.getCell(7).value = cumOther;
    totalRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
    totalRow.getCell(8).value = `총 ${totalCumulativePersonnel.toLocaleString()}명 누적 출력`;
    totalRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

    for (let c = 1; c <= 10; c++) {
      totalRow.getCell(c).fill = TOTAL_FILL;
      totalRow.getCell(c).font = { name: 'Malgun Gothic', size: 9, bold: true, color: { argb: '1E3A8A' } };
      totalRow.getCell(c).border = BORDER_STYLE;
    }
    totalRow.height = 19.5;
    currentRow++;

    worksheet.getRow(currentRow).height = 19;
    currentRow++;
    pageEstimatedRows += sec2Needed;

    // 6. Section 3: 장비 투입 현황 (기본 3행 표시)
    const sec3DataRowsCount = Math.max(report.equipment?.length || 0, 3);
    const sec3Needed = 2 + sec3DataRowsCount + 1;
    checkAndAddPageBreak(sec3Needed);
    addSectionTitle('3. 장비 투입 현황');

    // Headers: A(No), B(공종), C(장비명), D-F(규격 / 용량), G(금일 수량), H-J(비고)
    worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
    worksheet.mergeCells(`H${currentRow}:J${currentRow}`);
    
    worksheet.getCell(`A${currentRow}`).value = 'No';
    worksheet.getCell(`B${currentRow}`).value = '공종';
    worksheet.getCell(`C${currentRow}`).value = '장비명';
    worksheet.getCell(`D${currentRow}`).value = '규격 / 용량';
    worksheet.getCell(`G${currentRow}`).value = '금일 수량';
    worksheet.getCell(`H${currentRow}`).value = '비고';

    for (let c = 1; c <= 10; c++) {
      const cell = worksheet.getRow(currentRow).getCell(c);
      cell.fill = HEADER_FILL;
      cell.font = { name: 'Malgun Gothic', size: 9, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDER_STYLE;
    }
    worksheet.getRow(currentRow).height = 19;
    currentRow++;

    const equipmentList = report.equipment || [];
    for (let idx = 0; idx < sec3DataRowsCount; idx++) {
      worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
      worksheet.mergeCells(`H${currentRow}:J${currentRow}`);

      const row = worksheet.getRow(currentRow);
      const eq = equipmentList[idx];

      if (eq) {
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = eq.discipline || '-';
        row.getCell(3).value = eq.type || '-';
        row.getCell(4).value = eq.capacity || '-';
        row.getCell(7).value = `${eq.quantity || 0} 대`;
        row.getCell(8).value = eq.note || '';
      } else {
        // 빈 행 (기본 3칸 유지)
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = '';
        row.getCell(3).value = '';
        row.getCell(4).value = '';
        row.getCell(7).value = '';
        row.getCell(8).value = '';
      }

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'left' };

      for (let c = 1; c <= 10; c++) {
        row.getCell(c).font = { name: 'Malgun Gothic', size: 9 };
        row.getCell(c).border = BORDER_STYLE;
      }
      row.height = 18.5;
      currentRow++;
    }

    worksheet.getRow(currentRow).height = 19;
    currentRow++;
    pageEstimatedRows += sec3Needed;

    // 7. Section 4: 특기사항 (No, 구분, 내용 - 기본 5행 표시)
    const sec4DataRowsCount = Math.max(report.issues?.length || 0, 5);
    const sec4Needed = 2 + sec4DataRowsCount + 1;
    checkAndAddPageBreak(sec4Needed);
    addSectionTitle('4. 특기사항');

    worksheet.mergeCells(`C${currentRow}:J${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = 'No';
    worksheet.getCell(`B${currentRow}`).value = '구분';
    worksheet.getCell(`C${currentRow}`).value = '내용';

    for (let c = 1; c <= 10; c++) {
      const cell = worksheet.getRow(currentRow).getCell(c);
      cell.fill = HEADER_FILL;
      cell.font = { name: 'Malgun Gothic', size: 9, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDER_STYLE;
    }
    worksheet.getRow(currentRow).height = 19;
    currentRow++;

    const issuesList = report.issues || [];
    for (let idx = 0; idx < sec4DataRowsCount; idx++) {
      worksheet.mergeCells(`C${currentRow}:J${currentRow}`);

      const row = worksheet.getRow(currentRow);
      const issue = issuesList[idx];

      row.getCell(1).value = idx + 1;
      if (issue) {
        row.getCell(2).value = issue.type || '기타';
        row.getCell(3).value = issue.description || '-';
      } else {
        // 빈 행 (기본 5칸 유지)
        row.getCell(2).value = '';
        row.getCell(3).value = '';
      }

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      for (let c = 1; c <= 10; c++) {
        row.getCell(c).font = { name: 'Malgun Gothic', size: 9 };
        row.getCell(c).border = BORDER_STYLE;
      }
      row.height = 18.5;
      currentRow++;
    }

    worksheet.getRow(currentRow).height = 19;
    currentRow++;
    pageEstimatedRows += sec4Needed;

    // 8. Section 5: 명일 작업 계획 (작업내용 D~F, 위치 G~H, 작업량 I, 업체 J - 기본 5행 표시)
    const sec5DataRowsCount = Math.max(report.tomorrowTasks?.length || 0, 5);
    const sec5Needed = 2 + sec5DataRowsCount + 1;
    checkAndAddPageBreak(sec5Needed);
    addSectionTitle('5. 명일 작업 계획');

    worksheet.getCell(`A${currentRow}`).value = 'No';
    worksheet.getCell(`B${currentRow}`).value = '공종';
    worksheet.getCell(`C${currentRow}`).value = '세부공종';
    worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
    worksheet.getCell(`D${currentRow}`).value = '작업내용(작업명)';
    worksheet.mergeCells(`G${currentRow}:H${currentRow}`);
    worksheet.getCell(`G${currentRow}`).value = '위치 (동/층/구역)';
    worksheet.getCell(`I${currentRow}`).value = '작업량';
    worksheet.getCell(`J${currentRow}`).value = '업체';

    for (let c = 1; c <= 10; c++) {
      const cell = worksheet.getRow(currentRow).getCell(c);
      cell.fill = HEADER_FILL;
      cell.font = { name: 'Malgun Gothic', size: 9, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDER_STYLE;
    }
    worksheet.getRow(currentRow).height = 19;
    currentRow++;

    const tomorrowTasksList = report.tomorrowTasks || [];
    for (let idx = 0; idx < sec5DataRowsCount; idx++) {
      worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
      worksheet.mergeCells(`G${currentRow}:H${currentRow}`);
      const row = worksheet.getRow(currentRow);
      const task = tomorrowTasksList[idx];

      if (task) {
        const locationStr = [
          Array.isArray(task.dongBlock) ? task.dongBlock.join(',') : task.dongBlock,
          Array.isArray(task.floor) ? task.floor.join(',') : task.floor,
          Array.isArray(task.zone) ? task.zone.join(',') : task.zone
        ].filter(Boolean).join(' / ') || task.location || '-';

        row.getCell(1).value = idx + 1;
        row.getCell(2).value = task.category || '-';
        row.getCell(3).value = task.subCategory || '-';
        row.getCell(4).value = task.taskName || '-';
        row.getCell(7).value = locationStr;
        row.getCell(9).value = task.amount || '-';
        row.getCell(10).value = task.contractor || '-';
      } else {
        // 빈 행 (기본 5칸 유지)
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = '';
        row.getCell(3).value = '';
        row.getCell(4).value = '';
        row.getCell(7).value = '';
        row.getCell(9).value = '';
        row.getCell(10).value = '';
      }

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };

      for (let c = 1; c <= 10; c++) {
        row.getCell(c).font = { name: 'Malgun Gothic', size: 9 };
        row.getCell(c).border = BORDER_STYLE;
      }
      row.height = 18.5;
      currentRow++;
    }

    // 9. Section 6: 현장사진 (항상 별도 페이지로 출력, A4 1페이지 2*4 = 8장 배치)
    const photos = report.photos || [];

    // ALWAYS insert a page break before Section 6
    worksheet.getRow(currentRow).addPageBreak();
    currentRow++;

    if (photos.length === 0) {
      addSectionTitle('6. 현장사진 대지');
      worksheet.mergeCells(`A${currentRow}:J${currentRow + 3}`);
      const emptyCell = worksheet.getCell(`A${currentRow}`);
      emptyCell.value = '등록된 현장 사진이 없습니다.';
      emptyCell.font = { name: 'Malgun Gothic', size: 10, italic: true, color: { argb: '94A3B8' } };
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
      for (let r = 0; r < 4; r++) {
        worksheet.getRow(currentRow + r).height = 22;
        for (let c = 1; c <= 10; c++) {
          worksheet.getRow(currentRow + r).getCell(c).border = BORDER_STYLE;
        }
      }
      currentRow += 4;
    } else {
      // Chunk photos into pages of 8 photos (2 cols * 4 rows = 8 photos)
      const PHOTOS_PER_PAGE = 8;
      const totalPhotoPages = Math.ceil(photos.length / PHOTOS_PER_PAGE);

      for (let pageIdx = 0; pageIdx < totalPhotoPages; pageIdx++) {
        if (pageIdx > 0) {
          worksheet.getRow(currentRow).addPageBreak();
          currentRow++;
        }

        const pagePhotos = photos.slice(pageIdx * PHOTOS_PER_PAGE, (pageIdx + 1) * PHOTOS_PER_PAGE);
        const sectionHeaderTitle = totalPhotoPages > 1
          ? `6. 현장사진 대지 (${pageIdx + 1}/${totalPhotoPages})`
          : '6. 현장사진 대지';

        addSectionTitle(sectionHeaderTitle);

        // Always render 4 rows (2*4 grid = 8 photos)
        for (let rowIdx = 0; rowIdx < 4; rowIdx++) {
          const leftPhotoIdx = rowIdx * 2;
          const rightPhotoIdx = leftPhotoIdx + 1;

          const leftPhoto = leftPhotoIdx < pagePhotos.length ? pagePhotos[leftPhotoIdx] : null;
          const rightPhoto = rightPhotoIdx < pagePhotos.length ? pagePhotos[rightPhotoIdx] : null;

          const titleRowNumber = currentRow;
          const imageStartRowNumber = currentRow + 1;
          const imageEndRowNumber = currentRow + 6; // 6 rows * 31pt = 186pt height per photo box

          // 1) Title/Caption Row (height: 19pt)
          worksheet.getRow(titleRowNumber).height = 19;

          // Left Photo Caption (Col A~E: 1~5)
          worksheet.mergeCells(`A${titleRowNumber}:E${titleRowNumber}`);
          const leftTitleCell = worksheet.getCell(`A${titleRowNumber}`);
          leftTitleCell.value = leftPhoto
            ? formatPhotoCaption(leftPhoto, pageIdx * PHOTOS_PER_PAGE + leftPhotoIdx)
            : '';
          leftTitleCell.font = { name: 'Malgun Gothic', size: 9, bold: true, color: { argb: '1E293B' } };
          leftTitleCell.fill = HEADER_FILL;
          leftTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
          ['A', 'B', 'C', 'D', 'E'].forEach(col => { worksheet.getCell(`${col}${titleRowNumber}`).border = BORDER_STYLE; });

          // Right Photo Caption (Col F~J: 6~10)
          worksheet.mergeCells(`F${titleRowNumber}:J${titleRowNumber}`);
          const rightTitleCell = worksheet.getCell(`F${titleRowNumber}`);
          rightTitleCell.value = rightPhoto
            ? formatPhotoCaption(rightPhoto, pageIdx * PHOTOS_PER_PAGE + rightPhotoIdx)
            : '';
          rightTitleCell.font = { name: 'Malgun Gothic', size: 9, bold: true, color: { argb: '1E293B' } };
          rightTitleCell.fill = HEADER_FILL;
          rightTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
          ['F', 'G', 'H', 'I', 'J'].forEach(col => { worksheet.getCell(`${col}${titleRowNumber}`).border = BORDER_STYLE; });

          // 2) Image Row Setup (6 rows of 31pt = 186pt total height per box)
          for (let r = imageStartRowNumber; r <= imageEndRowNumber; r++) {
            worksheet.getRow(r).height = 31;
            for (let c = 1; c <= 10; c++) {
              worksheet.getRow(r).getCell(c).border = BORDER_STYLE;
            }
          }

          // Merge Left Image Box (A~E)
          worksheet.mergeCells(`A${imageStartRowNumber}:E${imageEndRowNumber}`);
          // Merge Right Image Box (F~J)
          worksheet.mergeCells(`F${imageStartRowNumber}:J${imageEndRowNumber}`);

          // 3) Fetch & Embed Left Image (Preserve Aspect Ratio: 800x480 matches cell bounds)
          if (leftPhoto) {
            const leftImgData = await fetchImageWithPreservedAspect(leftPhoto.url, 800, 480);
            if (leftImgData) {
              const leftImgId = workbook.addImage({
                base64: leftImgData.base64,
                extension: leftImgData.extension,
              });
              worksheet.addImage(leftImgId, `A${imageStartRowNumber}:E${imageEndRowNumber}`);
            } else {
              const placeholder = worksheet.getCell(`A${imageStartRowNumber}`);
              placeholder.value = '[사진 미리보기 불가]';
              placeholder.font = { name: 'Malgun Gothic', size: 9, italic: true, color: { argb: '94A3B8' } };
              placeholder.alignment = { vertical: 'middle', horizontal: 'center' };
            }
          }

          // 4) Fetch & Embed Right Image (Preserve Aspect Ratio: 800x480 matches cell bounds)
          if (rightPhoto) {
            const rightImgData = await fetchImageWithPreservedAspect(rightPhoto.url, 800, 480);
            if (rightImgData) {
              const rightImgId = workbook.addImage({
                base64: rightImgData.base64,
                extension: rightImgData.extension,
              });
              worksheet.addImage(rightImgId, `F${imageStartRowNumber}:J${imageEndRowNumber}`);
            } else {
              const placeholder = worksheet.getCell(`F${imageStartRowNumber}`);
              placeholder.value = '[사진 미리보기 불가]';
              placeholder.font = { name: 'Malgun Gothic', size: 9, italic: true, color: { argb: '94A3B8' } };
              placeholder.alignment = { vertical: 'middle', horizontal: 'center' };
            }
          }

          // Gap row between photo cards (height: 6pt between cards)
          currentRow = imageEndRowNumber + 1;
          if (rowIdx < 3) {
            worksheet.getRow(currentRow).height = 6;
            currentRow++;
          }
        }
      }
    }

    // Explicitly lock print area to columns A through J to prevent any phantom empty columns on the right
    const finalRowNumber = Math.max(currentRow - 1, 1);
    worksheet.pageSetup.printArea = `A1:J${finalRowNumber}`;
  }

  // Write file and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const sanitizedProjName = (project?.name || '프로젝트').replace(/[/\\?%*:|"<>]/g, '_');
  // 시트 기준 최종(가장 최신) 날짜로 파일명 설정 (예: 2026-09-02)
  const lastReportDate = sortedReports[sortedReports.length - 1]?.date || selectedYearMonth;
  a.download = `공사일보_${sanitizedProjName}_${lastReportDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
