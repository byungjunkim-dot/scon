import ExcelJS from 'exceljs';
import { Project, AppSettings } from '../types';

export interface ProductionPhoto {
  id: string;
  url: string;
  title: string;
}

export interface ProductionBreakdown {
  factory: string;
  floor: string;
  steel: number;
  single: number;
  moduleFrame: number;
  finished: number;
  shipped: number;
}

export interface ProductionDayData {
  id: string; // "YYYY-MM-DD"
  projectId: string;
  date: string;
  steel: number;
  single: number;
  moduleFrame: number;
  finished: number;
  shipped: number;
  photos: ProductionPhoto[];
  notes: string;
  breakdowns?: ProductionBreakdown[];
}

export interface CumulativeStats {
  total: number;
  steel: number;
  single: number;
  moduleFrame: number;
  finished: number;
  shipped: number;
  rates: {
    total: number;
    steel: number;
    single: number;
    moduleFrame: number;
    finished: number;
    shipped: number;
  };
}

export interface PlannedVolumes {
  total: number;
  steel: number;
  single: number;
  moduleFrame: number;
  finished: number;
  shipped: number;
}

const BORDER_COLOR = 'CBD5E1'; // Slate 300 for clean subtle borders
const DOUBLE_BORDER_COLOR = '334155'; // Slate 700

interface OpenTableOptions {
  top?: boolean;
  bottom?: boolean;
  doubleBottom?: boolean;
  borderColor?: string;
}

interface ColumnGroup {
  start: string;
  end: string;
}

/**
 * Apply open table borders to a row:
 * - Outermost left edge (startCol) strictly has NO left border
 * - Outermost right edge (endCol) strictly has NO right border
 * - Internal vertical dividers exist strictly between column groups
 * - Merged cells within column groups have no internal vertical borders
 */
function applyOpenTableRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  groups: (string | [string, string])[],
  startCol: string,
  endCol: string,
  options?: OpenTableOptions
) {
  const borderColor = options?.borderColor || BORDER_COLOR;
  const isTop = options?.top !== false;
  const isDoubleBottom = !!options?.doubleBottom;
  const isBottom = options?.bottom !== false;

  const normGroups: ColumnGroup[] = groups.map((g) => {
    if (typeof g === 'string') {
      return { start: g, end: g };
    }
    return { start: g[0], end: g[1] };
  });

  normGroups.forEach((group) => {
    const isFirstGroup = group.start === startCol;
    const isLastGroup = group.end === endCol;

    const startCharCode = group.start.charCodeAt(0);
    const endCharCode = group.end.charCodeAt(0);

    for (let code = startCharCode; code <= endCharCode; code++) {
      const colLetter = String.fromCharCode(code);
      const cell = sheet.getCell(`${colLetter}${rowNumber}`);

      const border: Partial<ExcelJS.Borders> = {};

      if (isTop) {
        border.top = { style: 'thin', color: { argb: borderColor } };
      }

      if (isDoubleBottom) {
        border.bottom = { style: 'double', color: { argb: DOUBLE_BORDER_COLOR } };
      } else if (isBottom) {
        border.bottom = { style: 'thin', color: { argb: borderColor } };
      }

      // Left border: ONLY on the start column of an internal group (never on the first group starting at startCol)
      if (colLetter === group.start && !isFirstGroup) {
        border.left = { style: 'thin', color: { argb: borderColor } };
      }

      // Right border: ONLY on the end column of an internal group (never on the last group ending at endCol)
      if (colLetter === group.end && !isLastGroup) {
        border.right = { style: 'thin', color: { argb: borderColor } };
      }

      cell.border = border;
    }
  });
}

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'F1F5F9' } // Slate 100
};

const SUB_HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'F8FAFC' } // Slate 50 for clean modern table header
};

const DARK_HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: '334155' } // Slate 700
};

const TOTAL_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'F0F7FF' } // Light Blue 50
};

/**
 * Image aspect ratio preserving helper for Excel
 */
async function fetchImageWithPreservedAspect(
  url: string,
  targetWidth = 600,
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
        // use url directly if blob fetch fails
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

    // Clean white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const imgWidth = img.naturalWidth || img.width || 1;
    const imgHeight = img.naturalHeight || img.height || 1;
    const imgAspect = imgWidth / imgHeight;

    const pad = 4;
    const maxDrawWidth = targetWidth - pad * 2;
    const maxDrawHeight = targetHeight - pad * 2;
    const maxAspect = maxDrawWidth / maxDrawHeight;

    let drawWidth: number;
    let drawHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (imgAspect > maxAspect) {
      drawWidth = maxDrawWidth;
      drawHeight = maxDrawWidth / imgAspect;
      offsetX = pad;
      offsetY = (targetHeight - drawHeight) / 2;
    } else {
      drawHeight = maxDrawHeight;
      drawWidth = maxDrawHeight * imgAspect;
      offsetX = (targetWidth - drawWidth) / 2;
      offsetY = pad;
    }

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64Data = dataUrl.split(',')[1];
    return { base64: base64Data, extension: 'jpeg' };
  } catch (err) {
    console.warn('Failed to process image for Excel export:', err);
    return null;
  }
}

/**
 * Parse structured notes helper
 */
function parseNotes(notesStr: string): { category: string; content: string }[] {
  if (!notesStr || !notesStr.trim()) return [];
  try {
    if (notesStr.trim().startsWith('[')) {
      const parsed = JSON.parse(notesStr);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          category: item.category || '일반',
          content: item.content || ''
        }));
      }
    }
  } catch (e) {}
  return [{ category: '일반', content: notesStr }];
}

/**
 * Format notes to a single line string
 */
function formatNotesToString(notesStr: string): string {
  const parsed = parseNotes(notesStr);
  if (parsed.length === 0) return '';
  return parsed.map(item => `[${item.category}] ${item.content}`).join('  /  ');
}

/**
 * Sanitize Sheet Name (max 31 chars, no special characters)
 */
function getSanitizedSheetName(dateStr: string, index: number, usedNames: Set<string>): string {
  let name = (dateStr || `Day_${index + 1}`).replace(/[\\/?*:[\]]/g, '-').trim().slice(0, 28);
  if (!name) name = `Day_${index + 1}`;
  let finalName = name;
  let count = 1;
  while (usedNames.has(finalName)) {
    count++;
    finalName = `${name} (${count})`.slice(0, 31);
  }
  usedNames.add(finalName);
  return finalName;
}

/**
 * Main Excel Export Function
 */
export async function exportProductionStatusToExcel({
  project,
  plannedVolumes,
  cumulativeStats,
  allDaysData,
  exportDate,
  currentDayData
}: {
  project: Project | null;
  plannedVolumes: PlannedVolumes;
  cumulativeStats: CumulativeStats;
  allDaysData: Record<string, ProductionDayData>;
  exportDate: string;
  currentDayData?: ProductionDayData;
}): Promise<void> {
  const projectName = project?.name || '프로젝트';
  const cleanExportDate = exportDate || new Date().toISOString().split('T')[0];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '스마트 제작 현황 관리 시스템';
  workbook.lastModifiedBy = 'User';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Combine all days data including currentDayData if not in allDaysData
  const combinedDaysData: Record<string, ProductionDayData> = { ...allDaysData };
  if (currentDayData && currentDayData.date) {
    combinedDaysData[currentDayData.date] = currentDayData;
  }

  const sortedDates = Object.keys(combinedDaysData).sort();
  if (sortedDates.length === 0) {
    sortedDates.push(cleanExportDate);
    combinedDaysData[cleanExportDate] = currentDayData || {
      id: cleanExportDate,
      projectId: project?.id || 'default',
      date: cleanExportDate,
      steel: 0,
      single: 0,
      moduleFrame: 0,
      finished: 0,
      shipped: 0,
      photos: [],
      notes: ''
    };
  }

  // =========================================================================
  // 1. 첫 번째 시트: [제작현황표] (A4 세로 인쇄 최적화)
  // =========================================================================
  const summarySheet = workbook.addWorksheet('제작현황표', {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait', // A4 세로 모드 기본 설정
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2
      }
    }
  });

  // 열 너비 정의 (Cols A to I - A4 세로 출력 비율에 최적화)
  summarySheet.columns = [
    { key: 'colA', width: 12 }, // 제작일
    { key: 'colB', width: 11 }, // 공장
    { key: 'colC', width: 10 }, // 위치(층)
    { key: 'colD', width: 8.5 }, // 철골
    { key: 'colE', width: 8.5 }, // 단품
    { key: 'colF', width: 8.5 }, // 프레임
    { key: 'colG', width: 8.5 }, // 완성품
    { key: 'colH', width: 8.5 }, // 출고
    { key: 'colI', width: 22 }   // 비고 (특기사항)
  ];

  let currentRow = 1;

  // [영역 1] 상단 메인 타이틀: "제작 현황 일지"
  summarySheet.addRow([]);
  currentRow++;

  summarySheet.mergeCells(`A${currentRow}:I${currentRow}`);
  const titleCell = summarySheet.getCell(`A${currentRow}`);
  titleCell.value = '제 작  현 황  일 지';
  titleCell.font = { name: '맑은 고딕', size: 18, bold: true, color: { argb: '0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(currentRow).height = 36;
  currentRow++;

  summarySheet.addRow([]);
  currentRow++;

  // [영역 2] 프로젝트명과 날짜
  summarySheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const projectCell = summarySheet.getCell(`A${currentRow}`);
  projectCell.value = `■  프로젝트명 : ${projectName}`;
  projectCell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: '1E293B' } };
  projectCell.alignment = { vertical: 'middle', horizontal: 'left' };

  summarySheet.mergeCells(`F${currentRow}:I${currentRow}`);
  const dateCell = summarySheet.getCell(`F${currentRow}`);
  dateCell.value = `■  출력일자 : ${cleanExportDate}`;
  dateCell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '475569' } };
  dateCell.alignment = { vertical: 'middle', horizontal: 'right' };
  summarySheet.getRow(currentRow).height = 24;
  currentRow++;

  summarySheet.addRow([]);
  currentRow++;

  // [영역 3] '전체 제작 현황' (총 / 누계 / 진행률 구분)
  summarySheet.mergeCells(`A${currentRow}:I${currentRow}`);
  const section3Cell = summarySheet.getCell(`A${currentRow}`);
  section3Cell.value = '▶  1. 전체 제작 현황';
  section3Cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: '1E3A8A' } };
  section3Cell.alignment = { vertical: 'middle', horizontal: 'left' };
  section3Cell.fill = HEADER_FILL;
  summarySheet.getRow(currentRow).height = 22;
  applyOpenTableRow(summarySheet, currentRow, [['A', 'I']], 'A', 'I', { top: false, bottom: true, borderColor: '94A3B8' });
  currentRow++;

  // 전체 제작 현황 헤더 테이블 (A~B: 구분, C: 철골, D: 단품, E: 프레임, F: 완성품, G: 출고, H~I: 전체(합계))
  summarySheet.mergeCells(`A${currentRow}:B${currentRow}`);
  summarySheet.getCell(`A${currentRow}`).value = '구분';
  summarySheet.getCell(`C${currentRow}`).value = '철골 (개)';
  summarySheet.getCell(`D${currentRow}`).value = '단품 (개)';
  summarySheet.getCell(`E${currentRow}`).value = '프레임 (개)';
  summarySheet.getCell(`F${currentRow}`).value = '완성품 (개)';
  summarySheet.getCell(`G${currentRow}`).value = '출고 (개)';
  summarySheet.mergeCells(`H${currentRow}:I${currentRow}`);
  summarySheet.getCell(`H${currentRow}`).value = '전체 합계 (개)';

  const headerRowObj = summarySheet.getRow(currentRow);
  headerRowObj.height = 22;
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
    const c = summarySheet.getCell(`${col}${currentRow}`);
    c.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '334155' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.fill = SUB_HEADER_FILL;
  });
  applyOpenTableRow(summarySheet, currentRow, [['A', 'B'], 'C', 'D', 'E', 'F', 'G', ['H', 'I']], 'A', 'I');
  currentRow++;

  // 1) 총 계획 행
  summarySheet.mergeCells(`A${currentRow}:B${currentRow}`);
  summarySheet.getCell(`A${currentRow}`).value = '총 계획 (개)';
  summarySheet.getCell(`C${currentRow}`).value = plannedVolumes.steel || 0;
  summarySheet.getCell(`D${currentRow}`).value = plannedVolumes.single || 0;
  summarySheet.getCell(`E${currentRow}`).value = plannedVolumes.moduleFrame || 0;
  summarySheet.getCell(`F${currentRow}`).value = plannedVolumes.finished || 0;
  summarySheet.getCell(`G${currentRow}`).value = plannedVolumes.shipped || 0;
  summarySheet.mergeCells(`H${currentRow}:I${currentRow}`);
  summarySheet.getCell(`H${currentRow}`).value = plannedVolumes.total || 0;

  let rowObj = summarySheet.getRow(currentRow);
  rowObj.height = 20;
  ['A', 'B'].forEach(col => {
    const c = summarySheet.getCell(`${col}${currentRow}`);
    c.font = { name: '맑은 고딕', size: 10, bold: true };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ['C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
    const c = summarySheet.getCell(`${col}${currentRow}`);
    c.font = { name: '맑은 고딕', size: 10, bold: false };
    c.alignment = { vertical: 'middle', horizontal: 'right' };
    c.numFmt = '#,##0';
  });
  applyOpenTableRow(summarySheet, currentRow, [['A', 'B'], 'C', 'D', 'E', 'F', 'G', ['H', 'I']], 'A', 'I');
  currentRow++;

  // 2) 누계 실적 행
  summarySheet.mergeCells(`A${currentRow}:B${currentRow}`);
  summarySheet.getCell(`A${currentRow}`).value = '누계 실적 (개)';
  summarySheet.getCell(`C${currentRow}`).value = cumulativeStats.steel || 0;
  summarySheet.getCell(`D${currentRow}`).value = cumulativeStats.single || 0;
  summarySheet.getCell(`E${currentRow}`).value = cumulativeStats.moduleFrame || 0;
  summarySheet.getCell(`F${currentRow}`).value = cumulativeStats.finished || 0;
  summarySheet.getCell(`G${currentRow}`).value = cumulativeStats.shipped || 0;
  summarySheet.mergeCells(`H${currentRow}:I${currentRow}`);
  summarySheet.getCell(`H${currentRow}`).value = cumulativeStats.total || 0;

  rowObj = summarySheet.getRow(currentRow);
  rowObj.height = 20;
  ['A', 'B'].forEach(col => {
    const c = summarySheet.getCell(`${col}${currentRow}`);
    c.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '0F172A' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ['C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
    const c = summarySheet.getCell(`${col}${currentRow}`);
    c.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '1E3A8A' } };
    c.alignment = { vertical: 'middle', horizontal: 'right' };
    c.numFmt = '#,##0';
  });
  applyOpenTableRow(summarySheet, currentRow, [['A', 'B'], 'C', 'D', 'E', 'F', 'G', ['H', 'I']], 'A', 'I');
  currentRow++;

  // 3) 진행률 (%) 행
  summarySheet.mergeCells(`A${currentRow}:B${currentRow}`);
  summarySheet.getCell(`A${currentRow}`).value = '진행률 (%)';
  summarySheet.getCell(`C${currentRow}`).value = (cumulativeStats.rates.steel || 0) / 100;
  summarySheet.getCell(`D${currentRow}`).value = (cumulativeStats.rates.single || 0) / 100;
  summarySheet.getCell(`E${currentRow}`).value = (cumulativeStats.rates.moduleFrame || 0) / 100;
  summarySheet.getCell(`F${currentRow}`).value = (cumulativeStats.rates.finished || 0) / 100;
  summarySheet.getCell(`G${currentRow}`).value = (cumulativeStats.rates.shipped || 0) / 100;
  summarySheet.mergeCells(`H${currentRow}:I${currentRow}`);
  summarySheet.getCell(`H${currentRow}`).value = (cumulativeStats.rates.total || 0) / 100;

  rowObj = summarySheet.getRow(currentRow);
  rowObj.height = 21;
  ['A', 'B'].forEach(col => {
    const c = summarySheet.getCell(`${col}${currentRow}`);
    c.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '1E3A8A' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.fill = TOTAL_FILL;
  });
  ['C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
    const c = summarySheet.getCell(`${col}${currentRow}`);
    c.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '1E3A8A' } };
    c.alignment = { vertical: 'middle', horizontal: 'right' };
    c.fill = TOTAL_FILL;
    c.numFmt = '0.0%';
  });
  applyOpenTableRow(summarySheet, currentRow, [['A', 'B'], 'C', 'D', 'E', 'F', 'G', ['H', 'I']], 'A', 'I', { doubleBottom: true });
  currentRow++;

  summarySheet.addRow([]);
  currentRow++;

  // [영역 4] '상세 제작 및 출고 내역' (제작일/공장/위치(층)/철골/단품/프레임/완성품/출고/비고)
  summarySheet.mergeCells(`A${currentRow}:I${currentRow}`);
  const section4Cell = summarySheet.getCell(`A${currentRow}`);
  section4Cell.value = '▶  2. 상세 제작 및 출고 내역';
  section4Cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: '1E3A8A' } };
  section4Cell.alignment = { vertical: 'middle', horizontal: 'left' };
  section4Cell.fill = HEADER_FILL;
  summarySheet.getRow(currentRow).height = 22;
  applyOpenTableRow(summarySheet, currentRow, [['A', 'I']], 'A', 'I', { top: false, bottom: true, borderColor: '94A3B8' });
  currentRow++;

  // 테이블 헤더
  const tableHeaders = ['제작일', '공장', '위치(층)', '철골', '단품', '프레임', '완성품', '출고', '비고'];
  tableHeaders.forEach((text, i) => {
    const colLetter = String.fromCharCode(65 + i);
    const c = summarySheet.getCell(`${colLetter}${currentRow}`);
    c.value = text;
    c.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.fill = DARK_HEADER_FILL;
  });
  summarySheet.getRow(currentRow).height = 24;
  applyOpenTableRow(summarySheet, currentRow, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], 'A', 'I');
  currentRow++;

  let sumDetailSteel = 0;
  let sumDetailSingle = 0;
  let sumDetailFrame = 0;
  let sumDetailFinished = 0;
  let sumDetailShipped = 0;

  // 데이터 행 출력
  sortedDates.forEach((dateKey) => {
    const dayData = combinedDaysData[dateKey];
    if (!dayData) return;

    const notesSummary = formatNotesToString(dayData.notes);
    const breakdowns = dayData.breakdowns && dayData.breakdowns.length > 0
      ? dayData.breakdowns
      : [
          {
            factory: '-',
            floor: '-',
            steel: dayData.steel || 0,
            single: dayData.single || 0,
            moduleFrame: dayData.moduleFrame || 0,
            finished: dayData.finished || 0,
            shipped: dayData.shipped || 0
          }
        ];

    breakdowns.forEach((bd, bdIdx) => {
      const isFirstOfDate = bdIdx === 0;
      const r = summarySheet.getRow(currentRow);
      r.height = 20;

      const dateC = summarySheet.getCell(`A${currentRow}`);
      dateC.value = dateKey;
      dateC.alignment = { vertical: 'middle', horizontal: 'center' };
      dateC.font = { name: '맑은 고딕', size: 9.5 };

      const factC = summarySheet.getCell(`B${currentRow}`);
      factC.value = bd.factory || '-';
      factC.alignment = { vertical: 'middle', horizontal: 'center' };
      factC.font = { name: '맑은 고딕', size: 9.5 };

      const floorC = summarySheet.getCell(`C${currentRow}`);
      floorC.value = bd.floor || '-';
      floorC.alignment = { vertical: 'middle', horizontal: 'center' };
      floorC.font = { name: '맑은 고딕', size: 9.5 };

      const steelC = summarySheet.getCell(`D${currentRow}`);
      steelC.value = bd.steel || 0;
      steelC.alignment = { vertical: 'middle', horizontal: 'right' };
      steelC.numFmt = '#,##0';
      steelC.font = { name: '맑은 고딕', size: 9.5 };

      const singleC = summarySheet.getCell(`E${currentRow}`);
      singleC.value = bd.single || 0;
      singleC.alignment = { vertical: 'middle', horizontal: 'right' };
      singleC.numFmt = '#,##0';
      singleC.font = { name: '맑은 고딕', size: 9.5 };

      const frameC = summarySheet.getCell(`F${currentRow}`);
      frameC.value = bd.moduleFrame || 0;
      frameC.alignment = { vertical: 'middle', horizontal: 'right' };
      frameC.numFmt = '#,##0';
      frameC.font = { name: '맑은 고딕', size: 9.5 };

      const finC = summarySheet.getCell(`G${currentRow}`);
      finC.value = bd.finished || 0;
      finC.alignment = { vertical: 'middle', horizontal: 'right' };
      finC.numFmt = '#,##0';
      finC.font = { name: '맑은 고딕', size: 9.5 };

      const shipC = summarySheet.getCell(`H${currentRow}`);
      shipC.value = bd.shipped || 0;
      shipC.alignment = { vertical: 'middle', horizontal: 'right' };
      shipC.numFmt = '#,##0';
      shipC.font = { name: '맑은 고딕', size: 9.5 };

      const noteC = summarySheet.getCell(`I${currentRow}`);
      noteC.value = isFirstOfDate ? notesSummary : '';
      noteC.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      noteC.font = { name: '맑은 고딕', size: 9 };

      applyOpenTableRow(summarySheet, currentRow, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], 'A', 'I');

      sumDetailSteel += bd.steel || 0;
      sumDetailSingle += bd.single || 0;
      sumDetailFrame += bd.moduleFrame || 0;
      sumDetailFinished += bd.finished || 0;
      sumDetailShipped += bd.shipped || 0;

      currentRow++;
    });
  });

  // 합계 행
  summarySheet.mergeCells(`A${currentRow}:C${currentRow}`);
  const totalLabelC = summarySheet.getCell(`A${currentRow}`);
  totalLabelC.value = '합  계';
  totalLabelC.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '0F172A' } };
  totalLabelC.alignment = { vertical: 'middle', horizontal: 'center' };

  ['A', 'B', 'C'].forEach(col => {
    const c = summarySheet.getCell(`${col}${currentRow}`);
    c.fill = SUB_HEADER_FILL;
  });

  const colsValues = [
    { col: 'D', val: sumDetailSteel },
    { col: 'E', val: sumDetailSingle },
    { col: 'F', val: sumDetailFrame },
    { col: 'G', val: sumDetailFinished },
    { col: 'H', val: sumDetailShipped }
  ];

  colsValues.forEach(({ col, val }) => {
    const c = summarySheet.getCell(`${col}${currentRow}`);
    c.value = val;
    c.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '1E3A8A' } };
    c.alignment = { vertical: 'middle', horizontal: 'right' };
    c.numFmt = '#,##0';
    c.fill = SUB_HEADER_FILL;
  });

  const lastNoteC = summarySheet.getCell(`I${currentRow}`);
  lastNoteC.value = '';
  lastNoteC.fill = SUB_HEADER_FILL;
  summarySheet.getRow(currentRow).height = 24;
  applyOpenTableRow(summarySheet, currentRow, [['A', 'C'], 'D', 'E', 'F', 'G', 'H', 'I'], 'A', 'I', { doubleBottom: true });

  // =========================================================================
  // 2. 두 번째 시트부터: 일별 시트 생성 (특기사항 및 사진대지)
  // =========================================================================
  const usedSheetNames = new Set<string>(['제작현황표']);

  for (let idx = 0; idx < sortedDates.length; idx++) {
    const dateKey = sortedDates[idx];
    const dayData = combinedDaysData[dateKey];
    if (!dayData) continue;

    const sheetName = getSanitizedSheetName(dateKey, idx, usedSheetNames);
    const daySheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'portrait', // 세로 모드 A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.45,
          right: 0.45,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2
        }
      }
    });

    // 8개 열 구성 (A~H)
    daySheet.columns = [
      { key: 'colA', width: 6 },  // No.
      { key: 'colB', width: 13 }, // 공장 / 구분
      { key: 'colC', width: 13 }, // 위치(층) / 내용 1
      { key: 'colD', width: 10 }, // 철골 / 내용 2
      { key: 'colE', width: 10 }, // 단품 / 내용 3
      { key: 'colF', width: 10 }, // 프레임 / 내용 4
      { key: 'colG', width: 10 }, // 완성품 / 내용 5
      { key: 'colH', width: 11 }  // 출고 / 내용 6
    ];

    let dayRow = 1;

    // 상단 타이틀
    daySheet.addRow([]);
    dayRow++;

    daySheet.mergeCells(`A${dayRow}:H${dayRow}`);
    const dayTitleC = daySheet.getCell(`A${dayRow}`);
    dayTitleC.value = '일 일  제 작  현 황  및  사 진 대 지';
    dayTitleC.font = { name: '맑은 고딕', size: 16, bold: true, color: { argb: '0F172A' } };
    dayTitleC.alignment = { vertical: 'middle', horizontal: 'center' };
    daySheet.getRow(dayRow).height = 32;
    dayRow++;

    // 서브 정보
    daySheet.mergeCells(`A${dayRow}:D${dayRow}`);
    const dayProjC = daySheet.getCell(`A${dayRow}`);
    dayProjC.value = `■ 프로젝트 : ${projectName}`;
    dayProjC.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '334155' } };
    dayProjC.alignment = { vertical: 'middle', horizontal: 'left' };

    daySheet.mergeCells(`E${dayRow}:H${dayRow}`);
    const dayDateInfoC = daySheet.getCell(`E${dayRow}`);
    dayDateInfoC.value = `■ 일자 : ${dateKey}`;
    dayDateInfoC.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '1E3A8A' } };
    dayDateInfoC.alignment = { vertical: 'middle', horizontal: 'right' };
    daySheet.getRow(dayRow).height = 22;
    dayRow++;

    daySheet.addRow([]);
    dayRow++;

    // 1) 당일 제작/출고 수량 표
    daySheet.mergeCells(`A${dayRow}:H${dayRow}`);
    const prodSectionC = daySheet.getCell(`A${dayRow}`);
    prodSectionC.value = '▶  1. 당일 제작 및 출고 실적';
    prodSectionC.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: '1E3A8A' } };
    prodSectionC.alignment = { vertical: 'middle', horizontal: 'left' };
    prodSectionC.fill = HEADER_FILL;
    daySheet.getRow(dayRow).height = 22;
    applyOpenTableRow(daySheet, dayRow, [['A', 'H']], 'A', 'H', { top: false, bottom: true, borderColor: '94A3B8' });
    dayRow++;

    // 테이블 헤더
    const dayTableHeaders = ['공장', '위치(층)', '철골', '단품', '프레임', '완성품', '출고', '합계'];
    daySheet.mergeCells(`A${dayRow}:B${dayRow}`);
    daySheet.getCell(`A${dayRow}`).value = '공장';
    daySheet.getCell(`C${dayRow}`).value = '위치(층)';
    daySheet.getCell(`D${dayRow}`).value = '철골';
    daySheet.getCell(`E${dayRow}`).value = '단품';
    daySheet.getCell(`F${dayRow}`).value = '프레임';
    daySheet.getCell(`G${dayRow}`).value = '완성품';
    daySheet.getCell(`H${dayRow}`).value = '출고';

    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
      const c = daySheet.getCell(`${col}${dayRow}`);
      c.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: '334155' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.fill = SUB_HEADER_FILL;
    });
    applyOpenTableRow(daySheet, dayRow, [['A', 'B'], 'C', 'D', 'E', 'F', 'G', 'H'], 'A', 'H');
    daySheet.getRow(dayRow).height = 22;
    dayRow++;

    const dayBreakdowns = dayData.breakdowns && dayData.breakdowns.length > 0
      ? dayData.breakdowns
      : [
          {
            factory: '-',
            floor: '-',
            steel: dayData.steel || 0,
            single: dayData.single || 0,
            moduleFrame: dayData.moduleFrame || 0,
            finished: dayData.finished || 0,
            shipped: dayData.shipped || 0
          }
        ];

    let daySumSteel = 0;
    let daySumSingle = 0;
    let daySumFrame = 0;
    let daySumFin = 0;
    let daySumShip = 0;

    dayBreakdowns.forEach(bd => {
      daySheet.mergeCells(`A${dayRow}:B${dayRow}`);
      daySheet.getCell(`A${dayRow}`).value = bd.factory || '-';
      daySheet.getCell(`C${dayRow}`).value = bd.floor || '-';
      daySheet.getCell(`D${dayRow}`).value = bd.steel || 0;
      daySheet.getCell(`E${dayRow}`).value = bd.single || 0;
      daySheet.getCell(`F${dayRow}`).value = bd.moduleFrame || 0;
      daySheet.getCell(`G${dayRow}`).value = bd.finished || 0;
      daySheet.getCell(`H${dayRow}`).value = bd.shipped || 0;

      ['A', 'B', 'C'].forEach(col => {
        const c = daySheet.getCell(`${col}${dayRow}`);
        c.font = { name: '맑은 고딕', size: 9.5 };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      ['D', 'E', 'F', 'G', 'H'].forEach(col => {
        const c = daySheet.getCell(`${col}${dayRow}`);
        c.font = { name: '맑은 고딕', size: 9.5 };
        c.alignment = { vertical: 'middle', horizontal: 'right' };
        c.numFmt = '#,##0';
      });

      applyOpenTableRow(daySheet, dayRow, [['A', 'B'], 'C', 'D', 'E', 'F', 'G', 'H'], 'A', 'H');

      daySumSteel += bd.steel || 0;
      daySumSingle += bd.single || 0;
      daySumFrame += bd.moduleFrame || 0;
      daySumFin += bd.finished || 0;
      daySumShip += bd.shipped || 0;

      daySheet.getRow(dayRow).height = 20;
      dayRow++;
    });

    // 당일 합계
    daySheet.mergeCells(`A${dayRow}:C${dayRow}`);
    daySheet.getCell(`A${dayRow}`).value = '당일 합계';
    daySheet.getCell(`D${dayRow}`).value = daySumSteel;
    daySheet.getCell(`E${dayRow}`).value = daySumSingle;
    daySheet.getCell(`F${dayRow}`).value = daySumFrame;
    daySheet.getCell(`G${dayRow}`).value = daySumFin;
    daySheet.getCell(`H${dayRow}`).value = daySumShip;

    ['A', 'B', 'C'].forEach(col => {
      const c = daySheet.getCell(`${col}${dayRow}`);
      c.font = { name: '맑은 고딕', size: 9.5, bold: true };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.fill = TOTAL_FILL;
    });

    ['D', 'E', 'F', 'G', 'H'].forEach(col => {
      const c = daySheet.getCell(`${col}${dayRow}`);
      c.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: '1E3A8A' } };
      c.alignment = { vertical: 'middle', horizontal: 'right' };
      c.numFmt = '#,##0';
      c.fill = TOTAL_FILL;
    });
    applyOpenTableRow(daySheet, dayRow, [['A', 'C'], 'D', 'E', 'F', 'G', 'H'], 'A', 'H', { doubleBottom: true });
    daySheet.getRow(dayRow).height = 22;
    dayRow++;

    daySheet.addRow([]);
    dayRow++;

    // 2) 특기사항
    daySheet.mergeCells(`A${dayRow}:H${dayRow}`);
    const notesSectionC = daySheet.getCell(`A${dayRow}`);
    notesSectionC.value = '▶  2. 특기사항';
    notesSectionC.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: '1E3A8A' } };
    notesSectionC.alignment = { vertical: 'middle', horizontal: 'left' };
    notesSectionC.fill = HEADER_FILL;
    daySheet.getRow(dayRow).height = 22;
    applyOpenTableRow(daySheet, dayRow, [['A', 'H']], 'A', 'H', { top: false, bottom: true, borderColor: '94A3B8' });
    dayRow++;

    // 특기사항 테이블 헤더
    daySheet.getCell(`A${dayRow}`).value = 'No.';
    daySheet.getCell(`B${dayRow}`).value = '구분';
    daySheet.mergeCells(`C${dayRow}:H${dayRow}`);
    daySheet.getCell(`C${dayRow}`).value = '내용';

    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
      const c = daySheet.getCell(`${col}${dayRow}`);
      c.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: '334155' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.fill = SUB_HEADER_FILL;
    });
    applyOpenTableRow(daySheet, dayRow, ['A', 'B', ['C', 'H']], 'A', 'H');
    daySheet.getRow(dayRow).height = 20;
    dayRow++;

    const parsedNotes = parseNotes(dayData.notes);
    if (parsedNotes.length === 0) {
      daySheet.getCell(`A${dayRow}`).value = '-';
      daySheet.getCell(`B${dayRow}`).value = '-';
      daySheet.mergeCells(`C${dayRow}:H${dayRow}`);
      daySheet.getCell(`C${dayRow}`).value = '등록된 특기사항이 없습니다.';

      ['A', 'B'].forEach(col => {
        const c = daySheet.getCell(`${col}${dayRow}`);
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.font = { name: '맑은 고딕', size: 9, color: { argb: '64748B' } };
      });
      ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
        const c = daySheet.getCell(`${col}${dayRow}`);
        c.alignment = { vertical: 'middle', horizontal: 'left' };
        c.font = { name: '맑은 고딕', size: 9, color: { argb: '64748B' } };
      });
      applyOpenTableRow(daySheet, dayRow, ['A', 'B', ['C', 'H']], 'A', 'H', { doubleBottom: true });
      daySheet.getRow(dayRow).height = 20;
      dayRow++;
    } else {
      parsedNotes.forEach((item, nIdx) => {
        daySheet.getCell(`A${dayRow}`).value = nIdx + 1;
        daySheet.getCell(`B${dayRow}`).value = item.category || '일반';
        daySheet.mergeCells(`C${dayRow}:H${dayRow}`);
        daySheet.getCell(`C${dayRow}`).value = item.content || '';

        daySheet.getCell(`A${dayRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
        daySheet.getCell(`A${dayRow}`).font = { name: '맑은 고딕', size: 9.5 };

        daySheet.getCell(`B${dayRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
        daySheet.getCell(`B${dayRow}`).font = { name: '맑은 고딕', size: 9.5, bold: true };

        ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
          const c = daySheet.getCell(`${col}${dayRow}`);
          c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          c.font = { name: '맑은 고딕', size: 9.5 };
        });

        applyOpenTableRow(daySheet, dayRow, ['A', 'B', ['C', 'H']], 'A', 'H', {
          doubleBottom: nIdx === parsedNotes.length - 1
        });

        daySheet.getRow(dayRow).height = 22;
        dayRow++;
      });
    }

    daySheet.addRow([]);
    dayRow++;

    const photos = dayData.photos || [];
    if (photos.length === 0) {
      // 3) 현황 사진대지
      daySheet.mergeCells(`A${dayRow}:H${dayRow}`);
      const photoSectionC = daySheet.getCell(`A${dayRow}`);
      photoSectionC.value = '▶  3. 현황 사진대지';
      photoSectionC.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: '1E3A8A' } };
      photoSectionC.alignment = { vertical: 'middle', horizontal: 'left' };
      photoSectionC.fill = HEADER_FILL;
      daySheet.getRow(dayRow).height = 22;
      applyOpenTableRow(daySheet, dayRow, [['A', 'H']], 'A', 'H', { top: false, bottom: true, borderColor: '94A3B8' });
      dayRow++;

      daySheet.mergeCells(`A${dayRow}:H${dayRow}`);
      const emptyPhotoC = daySheet.getCell(`A${dayRow}`);
      emptyPhotoC.value = '등록된 현황 사진이 없습니다.';
      emptyPhotoC.alignment = { vertical: 'middle', horizontal: 'center' };
      emptyPhotoC.font = { name: '맑은 고딕', size: 9.5, color: { argb: '64748B' } };
      applyOpenTableRow(daySheet, dayRow, [['A', 'H']], 'A', 'H', { doubleBottom: true });
      daySheet.getRow(dayRow).height = 36;
      dayRow++;
    } else {
      // 사진대지 페이징 및 다중 페이지 출력 최적화:
      // Page 1: 1.당일실적 + 2.특기사항 + 3.현황사진대지 (최대 2장: 1행)
      // Page 2 이후: A4 페이지 나누기(Page Break) 후 상단에 프로젝트명/일자 + 3.현황사진대지(계속) 반복 헤더 배치 및 최대 4장(2행)씩 배치
      let photoPageIndex = 1;
      let photosInCurrentPage = 0;
      const MAX_PHOTOS_PAGE_1 = 2; // 첫 페이지 A4 높이 맞춤 (1행: 2장)
      const MAX_PHOTOS_SUBSEQUENT_PAGE = 4; // 다음 페이지 A4 전용 사진대지 (2행: 4장)

      for (let pIdx = 0; pIdx < photos.length; pIdx += 2) {
        const isFirstBatch = pIdx === 0;
        const currentLimit = photoPageIndex === 1 ? MAX_PHOTOS_PAGE_1 : MAX_PHOTOS_SUBSEQUENT_PAGE;

        // 페이지 넘김 조건 체크: 허용 수량을 초과하면 새 페이지로 넘김
        if (!isFirstBatch && photosInCurrentPage >= currentLimit) {
          // 엑셀 페이지 나눔선 추가
          daySheet.getRow(dayRow).addPageBreak();
          photoPageIndex++;
          photosInCurrentPage = 0;

          // 다음 페이지 상단 여백
          daySheet.addRow([]);
          daySheet.getRow(dayRow).height = 10;
          dayRow++;

          // 상단 반복 정보 (프로젝트명 & 일자)
          daySheet.mergeCells(`A${dayRow}:D${dayRow}`);
          const pNameC = daySheet.getCell(`A${dayRow}`);
          pNameC.value = `■ 프로젝트 : ${projectName}`;
          pNameC.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '334155' } };
          pNameC.alignment = { vertical: 'middle', horizontal: 'left' };

          daySheet.mergeCells(`E${dayRow}:H${dayRow}`);
          const pDateC = daySheet.getCell(`E${dayRow}`);
          pDateC.value = `■ 일자 : ${dateKey}`;
          pDateC.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '1E3A8A' } };
          pDateC.alignment = { vertical: 'middle', horizontal: 'right' };
          daySheet.getRow(dayRow).height = 22;
          dayRow++;

          // 3. 현황 사진대지 반복 타이틀 바
          daySheet.mergeCells(`A${dayRow}:H${dayRow}`);
          const contPhotoSectionC = daySheet.getCell(`A${dayRow}`);
          contPhotoSectionC.value = '▶  3. 현황 사진대지 (계속)';
          contPhotoSectionC.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: '1E3A8A' } };
          contPhotoSectionC.alignment = { vertical: 'middle', horizontal: 'left' };
          contPhotoSectionC.fill = HEADER_FILL;
          daySheet.getRow(dayRow).height = 22;
          applyOpenTableRow(daySheet, dayRow, [['A', 'H']], 'A', 'H', { top: false, bottom: true, borderColor: '94A3B8' });
          dayRow++;
        } else if (isFirstBatch) {
          // 첫 페이지 사진대지 섹션 타이틀
          daySheet.mergeCells(`A${dayRow}:H${dayRow}`);
          const photoSectionC = daySheet.getCell(`A${dayRow}`);
          photoSectionC.value = '▶  3. 현황 사진대지';
          photoSectionC.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: '1E3A8A' } };
          photoSectionC.alignment = { vertical: 'middle', horizontal: 'left' };
          photoSectionC.fill = HEADER_FILL;
          daySheet.getRow(dayRow).height = 22;
          applyOpenTableRow(daySheet, dayRow, [['A', 'H']], 'A', 'H', { top: false, bottom: true, borderColor: '94A3B8' });
          dayRow++;
        }

        const photo1 = photos[pIdx];
        const photo2 = photos[pIdx + 1];

        const startPhotoRow = dayRow;
        const photoRowSpan = 6; // 6개 행 * 30pt = 사진 높이 정확히 180pt 확보

        // 6개 행 각각의 높이를 30pt로 설정 (총 높이 180pt)
        for (let r = 0; r < photoRowSpan; r++) {
          const targetR = startPhotoRow + r;
          daySheet.getRow(targetR).height = 30;
          applyOpenTableRow(daySheet, targetR, [['A', 'D'], ['E', 'H']], 'A', 'H', {
            top: r === 0,
            bottom: r === photoRowSpan - 1,
            borderColor: 'CBD5E1'
          });
        }

        const endPhotoRow = startPhotoRow + photoRowSpan - 1;

        // 사진 1 (왼쪽: A~D)
        daySheet.mergeCells(`A${startPhotoRow}:D${endPhotoRow}`);
        if (photo1 && photo1.url) {
          try {
            // 원본 비율 왜곡 없이 4:3 캔버스 중앙 정렬 및 임베드
            const processed = await fetchImageWithPreservedAspect(photo1.url, 640, 480);
            if (processed) {
              const imageId = workbook.addImage({
                base64: processed.base64,
                extension: processed.extension
              });
              daySheet.addImage(imageId, `A${startPhotoRow}:D${endPhotoRow}`);
            }
          } catch (e) {
            console.warn('Photo 1 load failed:', e);
          }
        }

        // 사진 2 (오른쪽: E~H)
        daySheet.mergeCells(`E${startPhotoRow}:H${endPhotoRow}`);
        if (photo2 && photo2.url) {
          try {
            // 원본 비율 왜곡 없이 4:3 캔버스 중앙 정렬 및 임베드
            const processed = await fetchImageWithPreservedAspect(photo2.url, 640, 480);
            if (processed) {
              const imageId = workbook.addImage({
                base64: processed.base64,
                extension: processed.extension
              });
              daySheet.addImage(imageId, `E${startPhotoRow}:H${endPhotoRow}`);
            }
          } catch (e) {
            console.warn('Photo 2 load failed:', e);
          }
        }

        dayRow += photoRowSpan;

        // 사진 설명/제목 캡션 행 (A~D / E~H)
        daySheet.mergeCells(`A${dayRow}:D${dayRow}`);
        const cap1 = daySheet.getCell(`A${dayRow}`);
        cap1.value = `[사진 ${pIdx + 1}]  ${photo1?.title || '현황 사진'}`;
        cap1.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: '1E293B' } };
        cap1.alignment = { vertical: 'middle', horizontal: 'center' };
        ['A', 'B', 'C', 'D'].forEach(col => {
          const c = daySheet.getCell(`${col}${dayRow}`);
          c.fill = SUB_HEADER_FILL;
        });

        daySheet.mergeCells(`E${dayRow}:H${dayRow}`);
        const cap2 = daySheet.getCell(`E${dayRow}`);
        cap2.value = photo2 ? `[사진 ${pIdx + 2}]  ${photo2.title || '현황 사진'}` : '';
        cap2.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: '1E293B' } };
        cap2.alignment = { vertical: 'middle', horizontal: 'center' };
        ['E', 'F', 'G', 'H'].forEach(col => {
          const c = daySheet.getCell(`${col}${dayRow}`);
          c.fill = photo2 ? SUB_HEADER_FILL : { type: 'pattern', pattern: 'none' };
        });

        applyOpenTableRow(daySheet, dayRow, [['A', 'D'], ['E', 'H']], 'A', 'H', { doubleBottom: true });

        daySheet.getRow(dayRow).height = 22;
        dayRow++;

        // 간격 행 (8pt)
        daySheet.addRow([]);
        daySheet.getRow(dayRow).height = 8;
        dayRow++;

        photosInCurrentPage += 2;
      }
    }
  }

  // =========================================================================
  // 3. 파일 저장 (제작현황_프로젝트명_내보내는 날(년-월-일).xlsx)
  // =========================================================================
  const sanitizedProjName = projectName.replace(/[\\/:*?"<>|]/g, '_').trim();
  const fileName = `제작현황_${sanitizedProjName}_${cleanExportDate}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
