import React, { useState, useEffect } from 'react';
import { Project, ScheduleItem } from '../types';
import { supabaseService } from '../services/supabaseService';
import { AIRiskCard } from './AIRiskCard';
import { AIReportPanel } from './AIReportPanel';

interface AiDiagnosisViewProps {
  project: Project | null;
  schedules: ScheduleItem[];
  tab: 'ai-risk' | 'ai-report';
}

export function AiDiagnosisView({ project, schedules, tab }: AiDiagnosisViewProps) {
  const [dailyReports, setDailyReports] = useState<any[]>([]);
  const [inspectionRequests, setInspectionRequests] = useState<any[]>([]);
  const [materialApprovals, setMaterialApprovals] = useState<any[]>([]);
  const [concretePlans, setConcretePlans] = useState<any[]>([]);

  useEffect(() => {
    if (!project) return;

    const loadData = async () => {
      let reports: any[] = [];
      let inspections: any[] = [];
      let materials: any[] = [];
      let concrete: any[] = [];

      try {
        reports = await supabaseService.getDailyReports(project.id);
      } catch (e) {
        console.warn('Daily Reports fetch failed:', e);
      }

      try {
        inspections = await supabaseService.getInspectionRequests(project.id);
      } catch (e) {
        console.warn('Inspection Requests fetch failed:', e);
      }

      try {
        materials = await supabaseService.getMaterialApprovals(project.id);
      } catch (e) {
        console.warn('Material Approvals fetch failed:', e);
      }

      try {
        concrete = await supabaseService.getConcretePlans(project.id);
      } catch (e) {
        console.warn('Concrete Plans fetch failed:', e);
      }

      setDailyReports(reports);
      setInspectionRequests(inspections);
      setMaterialApprovals(materials);
      setConcretePlans(concrete);
    };

    loadData();
  }, [project]);

  if (!project) {
    return <div className="p-4 text-center text-gray-500">프로젝트를 선택해주세요.</div>;
  }

  return (
    <div className="h-full p-2 md:p-4 lg:p-8 bg-gray-50/50 overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full space-y-4">
      {tab === 'ai-risk' ? (
        <AIRiskCard
          projectId={project.id}
          schedules={schedules}
          dailyReports={dailyReports}
          inspectionRequests={inspectionRequests}
          materialApprovals={materialApprovals}
          concretePlans={concretePlans}
        />
      ) : (
        <AIReportPanel projectId={project.id} />
      )}
      </div>
    </div>
  );
}
