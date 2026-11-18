import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export const MAX_DRAWING_BYTES = 2 * 1024 * 1024; // 2MB

let workerConfigured = false;
function ensurePdfWorker() {
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    workerConfigured = true;
  }
}

export interface PreparedDrawingMedia {
  blob: Blob;
  contentType: string;
  extension: string;
  isPdf: boolean;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
  pageCount?: number;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

export function isPdfUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:application/pdf')) return true;
  return /\.pdf(\?.*)?$/i.test(url);
}

export function extractStorageFileNameFromUrl(url: string): string | null {
  if (!url || !url.includes('/storage/v1/object/public/photos/')) return null;
  const afterBucket = url.split('/storage/v1/object/public/photos/')[1];
  if (!afterBucket) return null;
  const cleanPath = afterBucket.split('?')[0];
  try {
    return decodeURIComponent(cleanPath);
  } catch {
    return cleanPath;
  }
}

export async function getPdfDocument(
  source: string | Uint8Array | ArrayBuffer
): Promise<PDFDocumentProxy> {
  ensurePdfWorker();
  if (typeof source === 'string') {
    const loadingTask = pdfjsLib.getDocument({ url: source });
    return loadingTask.promise;
  }
  const data = source instanceof Uint8Array ? source : new Uint8Array(source);
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

export async function renderPdfPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  targetWidthPx: number = 1800
): Promise<void> {
  const baseViewport = page.getViewport({ scale: 1 });
  const maxCanvasDim = 3200;
  let scale = targetWidthPx / Math.max(baseViewport.width, 1);
  scale = Math.max(0.5, Math.min(scale, 4));

  let viewport = page.getViewport({ scale });
  if (viewport.width > maxCanvasDim || viewport.height > maxCanvasDim) {
    const clampRatio = maxCanvasDim / Math.max(viewport.width, viewport.height);
    viewport = page.getViewport({ scale: scale * clampRatio });
  }

  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context를 생성할 수 없습니다.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvas,
    viewport,
  }).promise;
}

function getImageExtension(file: File): string {
  const nameExt = file.name.split('.').pop()?.toLowerCase();
  if (nameExt && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(nameExt)) {
    return nameExt === 'jpeg' ? 'jpg' : nameExt;
  }
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  return 'jpg';
}

function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function compressCanvasToMaxBytes(
  sourceCanvas: HTMLCanvasElement,
  maxBytes: number
): Promise<{ blob: Blob; contentType: string; extension: string }> {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const maxOrig = Math.max(width, height);
  const dimCandidates = [3200, 2400, 1920, 1500, 1200].filter(
    (d, idx, arr) => d <= maxOrig || idx === arr.length - 1
  );
  if (!dimCandidates.includes(Math.min(maxOrig, 3200))) {
    dimCandidates.unshift(Math.min(maxOrig, 3200));
  }

  const formats: Array<{ mime: string; ext: string; qualities: number[] }> = [
    { mime: 'image/webp', ext: 'webp', qualities: [0.92, 0.85, 0.76, 0.65, 0.52, 0.4] },
    { mime: 'image/jpeg', ext: 'jpg', qualities: [0.9, 0.82, 0.72, 0.6, 0.45, 0.32] },
  ];

  const workCanvas = document.createElement('canvas');
  let smallestBlob: { blob: Blob; contentType: string; extension: string } | null = null;

  for (const maxDim of dimCandidates) {
    const scale = maxOrig > maxDim ? maxDim / maxOrig : 1;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    workCanvas.width = w;
    workCanvas.height = h;
    const ctx = workCanvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context 생성 실패');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(sourceCanvas, 0, 0, w, h);

    for (const fmt of formats) {
      for (const q of fmt.qualities) {
        const blob = await canvasToBlob(workCanvas, fmt.mime, q);
        if (!blob || blob.type !== fmt.mime) continue;
        if (!smallestBlob || blob.size < smallestBlob.blob.size) {
          smallestBlob = { blob, contentType: fmt.mime, extension: fmt.ext };
        }
        if (blob.size <= maxBytes) {
          return { blob, contentType: fmt.mime, extension: fmt.ext };
        }
      }
    }
  }

  if (smallestBlob) return smallestBlob;
  throw new Error('이미지 압축에 실패했습니다.');
}

async function prepareDrawingImageBlob(
  file: File,
  maxBytes: number
): Promise<PreparedDrawingMedia> {
  if (file.size <= maxBytes) {
    return {
      blob: file,
      contentType: file.type || 'image/png',
      extension: getImageExtension(file),
      isPdf: false,
      compressed: false,
      originalSize: file.size,
      finalSize: file.size,
    };
  }

  const img = await loadImageElement(file);
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.naturalWidth || img.width;
  srcCanvas.height = img.naturalHeight || img.height;
  const ctx = srcCanvas.getContext('2d');
  if (!ctx) throw new Error('이미지 캔버스를 생성할 수 없습니다.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, srcCanvas.width, srcCanvas.height);
  ctx.drawImage(img, 0, 0);

  const result = await compressCanvasToMaxBytes(srcCanvas, maxBytes);
  return {
    blob: result.blob,
    contentType: result.contentType,
    extension: result.extension,
    isPdf: false,
    compressed: true,
    originalSize: file.size,
    finalSize: result.blob.size,
  };
}

async function prepareDrawingPdfBlob(
  file: File,
  maxBytes: number
): Promise<PreparedDrawingMedia> {
  const buffer = await file.arrayBuffer();
  const pdfDoc = await getPdfDocument(new Uint8Array(buffer));
  const pageCount = pdfDoc.numPages;

  if (file.size <= maxBytes) {
    await pdfDoc.loadingTask?.destroy();
    return {
      blob: file,
      contentType: 'application/pdf',
      extension: 'pdf',
      isPdf: true,
      compressed: false,
      originalSize: file.size,
      finalSize: file.size,
      pageCount,
    };
  }

  const { jsPDF } = await import('jspdf');
  const attempts: Array<{ targetWidth: number; quality: number }> = [
    { targetWidth: 2200, quality: 0.82 },
    { targetWidth: 1800, quality: 0.72 },
    { targetWidth: 1450, quality: 0.6 },
    { targetWidth: 1150, quality: 0.48 },
    { targetWidth: 900, quality: 0.36 },
  ];

  const maxPages = Math.min(pageCount, 25);
  let smallestPdfBlob: Blob | null = null;

  try {
    for (const attempt of attempts) {
      let doc: InstanceType<typeof jsPDF> | null = null;

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const vp1 = page.getViewport({ scale: 1 });
        const canvas = document.createElement('canvas');
        await renderPdfPageToCanvas(page, canvas, attempt.targetWidth);
        const imgData = canvas.toDataURL('image/jpeg', attempt.quality);
        const orientation = vp1.width >= vp1.height ? 'landscape' : 'portrait';

        if (!doc) {
          doc = new jsPDF({
            orientation,
            unit: 'pt',
            format: [vp1.width, vp1.height],
            compress: true,
          });
        } else {
          doc.addPage([vp1.width, vp1.height], orientation);
        }

        doc.addImage(imgData, 'JPEG', 0, 0, vp1.width, vp1.height, undefined, 'FAST');
      }

      if (!doc) continue;
      const outBlob = doc.output('blob');
      if (!smallestPdfBlob || outBlob.size < smallestPdfBlob.size) {
        smallestPdfBlob = outBlob;
      }

      if (outBlob.size <= maxBytes) {
        return {
          blob: outBlob,
          contentType: 'application/pdf',
          extension: 'pdf',
          isPdf: true,
          compressed: true,
          originalSize: file.size,
          finalSize: outBlob.size,
          pageCount: maxPages,
        };
      }
    }
  } finally {
    await pdfDoc.loadingTask?.destroy();
  }

  if (smallestPdfBlob && smallestPdfBlob.size <= maxBytes) {
    return {
      blob: smallestPdfBlob,
      contentType: 'application/pdf',
      extension: 'pdf',
      isPdf: true,
      compressed: true,
      originalSize: file.size,
      finalSize: smallestPdfBlob.size,
      pageCount: maxPages,
    };
  }

  throw new Error(
    'PDF 용량을 2MB 이하로 줄이는 데 실패했습니다. 페이지 수를 줄이거나 이미지로 변환해 올려주세요.'
  );
}

export async function prepareDrawingMedia(
  file: File,
  maxBytes: number = MAX_DRAWING_BYTES
): Promise<PreparedDrawingMedia> {
  if (isPdfFile(file)) {
    return prepareDrawingPdfBlob(file, maxBytes);
  }
  return prepareDrawingImageBlob(file, maxBytes);
}

export async function convertPdfBlobToImageBlob(
  pdfBlob: Blob,
  maxBytes: number = MAX_DRAWING_BYTES
): Promise<{ blob: Blob; contentType: string; extension: string }> {
  const buffer = await pdfBlob.arrayBuffer();
  const pdfDoc = await getPdfDocument(new Uint8Array(buffer));
  try {
    const pagesToRender = Math.min(pdfDoc.numPages, 4);
    const pageCanvases: HTMLCanvasElement[] = [];

    for (let i = 1; i <= pagesToRender; i++) {
      const page = await pdfDoc.getPage(i);
      const c = document.createElement('canvas');
      await renderPdfPageToCanvas(page, c, pagesToRender === 1 ? 2600 : 1800);
      pageCanvases.push(c);
    }

    if (pageCanvases.length === 1) {
      return compressCanvasToMaxBytes(pageCanvases[0], maxBytes);
    }

    const gap = 16;
    const width = Math.max(...pageCanvases.map((c) => c.width));
    const totalHeight =
      pageCanvases.reduce((sum, c) => sum + c.height, 0) +
      gap * (pageCanvases.length - 1);

    const stitched = document.createElement('canvas');
    stitched.width = width;
    stitched.height = Math.min(totalHeight, 10000);
    const ctx = stitched.getContext('2d');
    if (!ctx) throw new Error('Canvas context 생성 실패');

    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, stitched.width, stitched.height);

    let y = 0;
    for (const c of pageCanvases) {
      if (y >= stitched.height) break;
      const x = Math.round((width - c.width) / 2);
      ctx.drawImage(c, x, y);
      y += c.height + gap;
    }

    return compressCanvasToMaxBytes(stitched, maxBytes);
  } finally {
    await pdfDoc.loadingTask?.destroy();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}
