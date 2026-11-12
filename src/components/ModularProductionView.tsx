import React from 'react';
import { ProductionBoard } from '../modular/views/ProductionBoard';
import { Project, AppSettings, User } from '../types';

interface ModularProductionViewProps {
  project: Project | null;
  settings: AppSettings;
  currentUser: User | null;
}

export const ModularProductionView: React.FC<ModularProductionViewProps> = ({
  project,
  settings,
  currentUser
}) => {
  return (
    <div className="h-full w-full bg-[#F9FAFB] overflow-y-auto no-scrollbar p-1 md:p-6">
      <div className="max-w-[1850px] mx-auto">
        <ProductionBoard 
          key={project?.id || 'none'} 
          sconProject={project ? { id: project.id, name: project.name } : null}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
};

export default ModularProductionView;
