import React, { useEffect, useRef, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getPdfDocument, renderPdfPageToCanvas } from '../utils/drawingMedia';

interface PdfDrawingCanvasProps {
  source: string | Blob;
  pageNumber?: number;
  targetWidth?: number;
  onLoadSuccess?: (numPages: number) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const PdfDrawingCanvas: React.FC<PdfDrawingCanvasProps> = ({
  source,
  pageNumber = 1,
  targetWidth = 1800,
  onLoadSuccess,
  onError,
  className = '',
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadedDoc: PDFDocumentProxy | null = null;

    const loadDoc = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        let doc: PDFDocumentProxy;
        if (typeof source === 'string') {
          doc = await getPdfDocument(source);
        } else {
          const buf = await source.arrayBuffer();
          doc = await getPdfDocument(new Uint8Array(buf));
        }
        if (cancelled) {
          await doc.loadingTask?.destroy();
          return;
        }
        loadedDoc = doc;
        docRef.current = doc;
        setNumPages(doc.numPages);
        onLoadSuccess?.(doc.numPages);
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error('PDF 로드 실패');
          setErrorMsg(error.message);
          onError?.(error);
          setIsLoading(false);
        }
      }
    };

    loadDoc();

    return () => {
      cancelled = true;
      docRef.current = null;
      if (loadedDoc) {
        loadedDoc.loadingTask?.destroy().catch(() => {});
      }
    };
  }, [source]);

  useEffect(() => {
    let cancelled = false;
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || numPages === 0) return;

    const render = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const safePage = Math.max(1, Math.min(pageNumber, numPages));
        const page = await doc.getPage(safePage);
        if (cancelled) return;
        await renderPdfPageToCanvas(page, canvas, targetWidth);
        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error('PDF 렌더링 실패');
          setErrorMsg(error.message);
          setIsLoading(false);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [numPages, pageNumber, targetWidth]);

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-gray-500 gap-2 bg-gray-50 rounded-xl border border-gray-200">
        <FileText size={32} className="text-red-400" />
        <p className="text-xs font-bold text-gray-700">PDF 도면을 불러올 수 없습니다</p>
        <p className="text-[11px] text-gray-400 text-center max-w-xs">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 rounded-lg min-w-[200px] min-h-[140px]">
          <Loader2 className="animate-spin text-blue-600 mb-1.5" size={26} />
          <span className="text-[11px] font-bold text-gray-500">PDF 도면 렌더링 중...</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={className}
        style={style}
        draggable={false}
      />
    </div>
  );
};
