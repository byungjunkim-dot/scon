import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2 } from 'lucide-react';
import { Project } from '../types';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onDelete: (projectIds: string[]) => void;
}

const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({ isOpen, onClose, projects, onDelete }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleProject = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handleDelete = () => {
    onDelete(selectedIds);
    setSelectedIds([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-[500px] p-6 rounded-3xl shadow-2xl space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">프로젝트 삭제</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {projects.map(project => (
                <div 
                  key={project.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedIds.includes(project.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                  onClick={() => toggleProject(project.id)}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(project.id)}
                    onChange={() => toggleProject(project.id)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-900">{project.name}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-all"
              >
                취소
              </button>
              <button 
                onClick={handleDelete}
                disabled={selectedIds.length === 0}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                삭제 ({selectedIds.length})
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DeleteProjectModal;
