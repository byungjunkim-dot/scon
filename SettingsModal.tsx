import React, { useState } from 'react';
import { X, Plus, Trash2, Save, ChevronRight, ChevronDown } from 'lucide-react';
import { AppSettings, Category } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  projectName?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  projectName
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });
  const [activeTab, setActiveTab] = useState<'categories' | 'tasks' | 'locations' | 'contractors' | 'equipment'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category>(localSettings.categories[0]);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');

  // Sync local settings when props change
  React.useEffect(() => {
    setLocalSettings({ ...settings });
  }, [settings]);

  if (!isOpen) return null;

  const handleAddItem = (listKey: keyof AppSettings, value: string) => {
    if (!value.trim()) return;
    const currentList = (localSettings[listKey] || []) as string[];
    if (currentList.includes(value)) return;
    
    setLocalSettings({
      ...localSettings,
      [listKey]: [...currentList, value]
    });
  };

  const handleRemoveItem = (listKey: keyof AppSettings, index: number) => {
    const currentList = (localSettings[listKey] || []) as string[];
    if (!currentList[index]) return;
    
    const itemToRemove = currentList[index];
    const newList = [...currentList];
    newList.splice(index, 1);
    
    const newSettings = {
      ...localSettings,
      [listKey]: newList
    };

    if (listKey === 'categories') {
      const newColors = { ...localSettings.categoryColors };
      const newTextColors = { ...localSettings.categoryTextColors };
      delete newColors[itemToRemove];
      delete newTextColors[itemToRemove];
      newSettings.categoryColors = newColors;
      newSettings.categoryTextColors = newTextColors;
    }

    setLocalSettings(newSettings);
  };

  const handleColorChange = (category: string, color: string) => {
    // Generate a slightly darker version for text color
    // This is a simple implementation, could be more sophisticated
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Darken by 20%
    const dr = Math.max(0, Math.floor(r * 0.8));
    const dg = Math.max(0, Math.floor(g * 0.8));
    const db = Math.max(0, Math.floor(b * 0.8));
    
    const textColor = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;

    setLocalSettings({
      ...localSettings,
      categoryColors: {
        ...localSettings.categoryColors,
        [category]: color
      },
      categoryTextColors: {
        ...localSettings.categoryTextColors,
        [category]: textColor
      }
    });
  };

  const handleUpdateTaskMaster = (category: Category, subCategory: string, tasks: string[]) => {
    setLocalSettings({
      ...localSettings,
      taskMaster: {
        ...localSettings.taskMaster,
        [category]: {
          ...localSettings.taskMaster[category],
          [subCategory]: tasks
        }
      }
    });
  };

  const handleAddSubCategory = (category: Category, name: string) => {
    if (!name.trim()) return;
    setLocalSettings({
      ...localSettings,
      taskMaster: {
        ...localSettings.taskMaster,
        [category]: {
          ...localSettings.taskMaster[category],
          [name]: []
        }
      }
    });
  };

  const handleRemoveSubCategory = (category: Category, subCategory: string) => {
    const newTaskMaster = { ...localSettings.taskMaster };
    const newCategoryTasks = { ...newTaskMaster[category] };
    delete newCategoryTasks[subCategory];
    newTaskMaster[category] = newCategoryTasks;
    
    setLocalSettings({
      ...localSettings,
      taskMaster: newTaskMaster
    });
    if (selectedSubCategory === subCategory) setSelectedSubCategory('');
  };

  const handleAddTask = (category: Category, subCategory: string, taskName: string) => {
    if (!taskName.trim()) return;
    const currentTasks = localSettings.taskMaster[category][subCategory] || [];
    if (currentTasks.includes(taskName)) return;
    
    handleUpdateTaskMaster(category, subCategory, [...currentTasks, taskName]);
  };

  const handleRemoveTask = (category: Category, subCategory: string, index: number) => {
    const currentTasks = [...(localSettings.taskMaster[category][subCategory] || [])];
    currentTasks.splice(index, 1);
    handleUpdateTaskMaster(category, subCategory, currentTasks);
  };

  const handleAddContractor = (category: Category, name: string) => {
    if (!name.trim()) return;
    const currentContractors = localSettings.contractors[category] || [];
    if (currentContractors.includes(name)) return;
    
    setLocalSettings({
      ...localSettings,
      contractors: {
        ...localSettings.contractors,
        [category]: [...currentContractors, name]
      }
    });
  };

  const handleRemoveContractor = (category: Category, index: number) => {
    const currentContractors = [...(localSettings.contractors[category] || [])];
    currentContractors.splice(index, 1);
    
    setLocalSettings({
      ...localSettings,
      contractors: {
        ...localSettings.contractors,
        [category]: currentContractors
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-6 border-bottom flex justify-between items-center bg-slate-50">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Save className="w-6 h-6 text-blue-600" />
            {projectName ? `${projectName} 설정` : '시스템 설정 관리'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-slate-100 border-right p-4 flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('categories')}
              className={`p-3 text-left rounded-xl transition-all ${activeTab === 'categories' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-200 text-slate-600'}`}
            >
              공종 대분류
            </button>
            <button 
              onClick={() => setActiveTab('tasks')}
              className={`p-3 text-left rounded-xl transition-all ${activeTab === 'tasks' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-200 text-slate-600'}`}
            >
              세부공종/작업내용
            </button>
            <button 
              onClick={() => setActiveTab('locations')}
              className={`p-3 text-left rounded-xl transition-all ${activeTab === 'locations' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-200 text-slate-600'}`}
            >
              위치 정보
            </button>
            <button 
              onClick={() => setActiveTab('contractors')}
              className={`p-3 text-left rounded-xl transition-all ${activeTab === 'contractors' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-200 text-slate-600'}`}
            >
              담당업체
            </button>
            <button 
              onClick={() => setActiveTab('equipment')}
              className={`p-3 text-left rounded-xl transition-all ${activeTab === 'equipment' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-200 text-slate-600'}`}
            >
              장비 관리
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-white">
            {activeTab === 'categories' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-700">공종 대분류 관리</h3>
                <div className="flex gap-2">
                  <input 
                    id="new-category"
                    type="text" 
                    placeholder="새 대분류 입력"
                    className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddItem('categories', e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      const input = document.getElementById('new-category') as HTMLInputElement;
                      handleAddItem('categories', input.value);
                      input.value = '';
                    }}
                    className="bg-blue-600 text-white px-6 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> 추가
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {localSettings.categories.map((cat, idx) => (
                    <div key={cat} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border group">
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-slate-700 w-24">{cat}</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={localSettings.categoryColors[cat] || '#3b82f6'}
                            onChange={(e) => handleColorChange(cat, e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                          />
                          <span className="text-xs text-slate-400 font-mono uppercase">{localSettings.categoryColors[cat]}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveItem('categories', idx)}
                        className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-1/3 space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">대분류 선택</h3>
                    <div className="flex flex-col gap-1">
                      {localSettings.categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => {
                            setSelectedCategory(cat);
                            setSelectedSubCategory('');
                          }}
                          className={`p-3 text-left rounded-xl transition-all flex justify-between items-center ${selectedCategory === cat ? 'bg-blue-50 text-blue-700 font-bold border-blue-200 border' : 'hover:bg-slate-50 text-slate-600 border border-transparent'}`}
                        >
                          {cat}
                          {selectedCategory === cat && <ChevronRight className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 space-y-6 border-left pl-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">세부공종 관리 ({selectedCategory})</h3>
                      <div className="flex gap-2">
                        <input 
                          id="new-subcategory"
                          type="text" 
                          placeholder="새 세부공종 입력"
                          className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddSubCategory(selectedCategory, e.currentTarget.value);
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                        <button 
                          onClick={() => {
                            const input = document.getElementById('new-subcategory') as HTMLInputElement;
                            handleAddSubCategory(selectedCategory, input.value);
                            input.value = '';
                          }}
                          className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          추가
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(localSettings.taskMaster[selectedCategory] || {}).map(sub => (
                          <button
                            key={sub}
                            onClick={() => setSelectedSubCategory(sub)}
                            className={`px-4 py-2 rounded-full border transition-all flex items-center gap-2 ${selectedSubCategory === sub ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 hover:border-blue-400'}`}
                          >
                            {sub}
                            <Trash2 
                              className="w-3 h-3 hover:text-red-300" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSubCategory(selectedCategory, sub);
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedSubCategory && (
                      <div className="space-y-4 pt-6 border-top">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">작업내용 관리 ({selectedSubCategory})</h3>
                        <div className="flex gap-2">
                          <input 
                            id="new-task"
                            type="text" 
                            placeholder="새 작업내용 입력"
                            className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddTask(selectedCategory, selectedSubCategory, e.currentTarget.value);
                                e.currentTarget.value = '';
                              }
                            }}
                          />
                          <button 
                            onClick={() => {
                              const input = document.getElementById('new-task') as HTMLInputElement;
                              handleAddTask(selectedCategory, selectedSubCategory, input.value);
                              input.value = '';
                            }}
                            className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 transition-colors"
                          >
                            추가
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(localSettings.taskMaster[selectedCategory][selectedSubCategory] || []).map((task, idx) => (
                            <div key={task} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border group">
                              <span className="text-sm text-slate-700">{task}</span>
                              <button 
                                onClick={() => handleRemoveTask(selectedCategory, selectedSubCategory, idx)}
                                className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'locations' && (
              <div className="space-y-8">
                <LocationSection 
                  title="동/블록 관리" 
                  items={localSettings.dongBlocks} 
                  onAdd={(val) => handleAddItem('dongBlocks', val)}
                  onRemove={(idx) => handleRemoveItem('dongBlocks', idx)}
                />
                <LocationSection 
                  title="층 관리" 
                  items={localSettings.floors} 
                  onAdd={(val) => handleAddItem('floors', val)}
                  onRemove={(idx) => handleRemoveItem('floors', idx)}
                />
                <LocationSection 
                  title="구역 관리" 
                  items={localSettings.zones} 
                  onAdd={(val) => handleAddItem('zones', val)}
                  onRemove={(idx) => handleRemoveItem('zones', idx)}
                />
              </div>
            )}

            {activeTab === 'contractors' && (
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-1/3 space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">대분류 선택</h3>
                    <div className="flex flex-col gap-1">
                      {localSettings.categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`p-3 text-left rounded-xl transition-all flex justify-between items-center ${selectedCategory === cat ? 'bg-blue-50 text-blue-700 font-bold border-blue-200 border' : 'hover:bg-slate-50 text-slate-600 border border-transparent'}`}
                        >
                          {cat}
                          {selectedCategory === cat && <ChevronRight className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 space-y-6 border-left pl-6">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">담당업체 관리 ({selectedCategory})</h3>
                    <div className="flex gap-2">
                      <input 
                        id="new-contractor"
                        type="text" 
                        placeholder="새 업체명 입력"
                        className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddContractor(selectedCategory, e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <button 
                        onClick={() => {
                          const input = document.getElementById('new-contractor') as HTMLInputElement;
                          handleAddContractor(selectedCategory, input.value);
                          input.value = '';
                        }}
                        className="bg-blue-600 text-white px-6 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Plus className="w-5 h-5" /> 추가
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(localSettings.contractors[selectedCategory] || []).map((con, idx) => (
                        <div key={con} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border group">
                          <span className="font-medium text-slate-700">{con}</span>
                          <button 
                            onClick={() => handleRemoveContractor(selectedCategory, idx)}
                            className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'equipment' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-700">장비 마스터 관리</h3>
                <p className="text-sm text-slate-500">공사일보 작성 시 선택할 수 있는 장비 목록을 미리 설정합니다.</p>
                <div className="flex gap-2">
                  <input 
                    id="new-equipment"
                    type="text" 
                    placeholder="새 장비명 입력 (예: 굴착기, 지게차)"
                    className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddItem('equipmentMaster', e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      const input = document.getElementById('new-equipment') as HTMLInputElement;
                      handleAddItem('equipmentMaster', input.value);
                      input.value = '';
                    }}
                    className="bg-blue-600 text-white px-6 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> 추가
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(localSettings.equipmentMaster || []).map((eq, idx) => (
                    <div key={eq} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border group">
                      <span className="font-medium text-slate-700">{eq}</span>
                      <button 
                        onClick={() => handleRemoveItem('equipmentMaster', idx)}
                        className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-top bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-xl border bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button 
            onClick={() => {
              onSave(localSettings);
              onClose();
            }}
            className="px-8 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 font-bold"
          >
            설정 저장하기
          </button>
        </div>
      </motion.div>
    </div>
  );
};

interface LocationSectionProps {
  title: string;
  items: string[];
  onAdd: (val: string) => void;
  onRemove: (idx: number) => void;
}

const LocationSection: React.FC<LocationSectionProps> = ({ title, items, onAdd, onRemove }) => {
  const [val, setVal] = useState('');
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
      <div className="flex gap-2">
        <input 
          type="text" 
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="새 항목 입력"
          className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onAdd(val);
              setVal('');
            }
          }}
        />
        <button 
          onClick={() => {
            onAdd(val);
            setVal('');
          }}
          className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 transition-colors"
        >
          추가
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <div key={item} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border group">
            <span className="text-sm font-medium text-slate-700">{item}</span>
            <button 
              onClick={() => onRemove(idx)}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
