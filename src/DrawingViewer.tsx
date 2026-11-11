import React, { useState } from 'react';
import { PenTool, ZoomIn, ZoomOut, Maximize, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SAMPLE_DRAWINGS = [
  {
    id: '1',
    title: '건축 평면도 (1층)',
    url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=1600',
    type: '평면도'
  },
  {
    id: '2',
    title: '건축 입면도 (정면)',
    url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=1600',
    type: '입면도'
  },
  {
    id: '3',
    title: '건축 단면도 (A-A\')',
    url: 'https://images.unsplash.com/photo-1626885930974-4b69aa21bbf9?auto=format&fit=crop&q=80&w=1600',
    type: '단면도'
  }
];

export const DrawingViewer: React.FC = () => {
  const [selectedDrawing, setSelectedDrawing] = useState(SAMPLE_DRAWINGS[0]);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <PenTool size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">도면 보기</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Drawings</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            <Download size={16} />
            도면 다운로드
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Drawing List */}
        <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-100 font-bold text-gray-700">
            도면 목록
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {SAMPLE_DRAWINGS.map(drawing => (
              <button
                key={drawing.id}
                onClick={() => {
                  setSelectedDrawing(drawing);
                  setZoom(1);
                }}
                className={`w-full text-left px-3 py-3 rounded-lg transition-colors flex flex-col gap-1 ${
                  selectedDrawing.id === drawing.id 
                    ? 'bg-indigo-50 border border-indigo-100' 
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <span className={`text-sm font-semibold ${selectedDrawing.id === drawing.id ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {drawing.title}
                </span>
                <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 self-start">
                  {drawing.type}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Viewer */}
        <div className="flex-1 bg-gray-100 relative overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-gray-200 p-1 rounded-lg shadow-sm">
            <button onClick={handleZoomOut} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors" title="축소">
              <ZoomOut size={18} />
            </button>
            <span className="text-xs font-mono font-medium text-gray-600 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={handleZoomIn} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors" title="확대">
              <ZoomIn size={18} />
            </button>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors" title="전체화면">
              <Maximize size={18} />
            </button>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8">
            <motion.div
              animate={{ scale: zoom }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative shadow-2xl bg-white"
              style={{ transformOrigin: 'center center' }}
            >
              <img 
                src={selectedDrawing.url} 
                alt={selectedDrawing.title}
                className="max-w-none"
                style={{ width: '800px', height: 'auto' }}
                referrerPolicy="no-referrer"
                draggable={false}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};
