import React, { useState, useEffect } from 'react';
import { WeekData, Evaluation, UnitData, Competence } from './types';
import { ProgressBar } from './ProgressBar';
import { WeekColumn } from './WeekColumn';
import { WeekDetailsPanel } from './WeekDetailsPanel';
import { EvaluationPlanGrid } from './EvaluationPlanGrid';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, FileText, Target, Map, CheckCircle2, Layers } from 'lucide-react';
import { WizardProvider, useWizard } from '@/context/WizardContext';
import { WizardBasicInfo } from '../wizard/WizardBasicInfo';
import { WizardObjectives } from '../wizard/WizardObjectives';
import { WizardReview } from '../wizard/WizardReview';

// No more INITIAL_WEEKS or MOCK_EVALUATIONS as constants. They will be generated dynamically.

interface Props {
  initialData?: any;
  planId?: number | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export function DidactoTimeline(props: Props) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && props.onClose()}>
      <WizardProvider>
        <WizardInitializer initialData={props.initialData}>
          <DidactoTimelineInner {...props} />
        </WizardInitializer>
      </WizardProvider>
    </Dialog>
  );
}

function WizardInitializer({ initialData, children }: { initialData?: any, children: React.ReactNode }) {
  const { setEditingPlan } = useWizard();
  useEffect(() => {
    if (initialData) setEditingPlan(initialData);
  }, [initialData, setEditingPlan]);
  return <>{children}</>;
}

const TABS = [
  { id: 'general', label: 'Datos Generales', icon: FileText },
  { id: 'objectives', label: 'Objetivos y Estrategias', icon: Target },
  { id: 'units', label: 'Plan de Evaluación (Unidades)', icon: Layers },
  { id: 'timeline', label: 'Línea de Tiempo Visual', icon: Map },
  { id: 'review', label: 'Revisión Final', icon: CheckCircle2 },
];

function DidactoTimelineInner({ initialData, planId, onSave, onClose }: Props) {
  const { state, updateField } = useWizard();
  const [activeTab, setActiveTab] = useState('general');

  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV'];
  
  const [units, setUnits] = useState<UnitData[]>(() => {
    return state.evaluation_plans.slice(0, 4).map((ep, idx) => ({
      id: `unit-${idx + 1}`,
      title: ep.title ? `Unidad ${ROMAN_NUMERALS[idx]}: ${ep.title}` : `Unidad ${ROMAN_NUMERALS[idx]}`
    }));
  });
  
  const [selectedWeek, setSelectedWeek] = useState<WeekData | null>(null);

  useEffect(() => {
    if (state.weekly_contents?.length > 0 && weeks.length === 0) {
      setWeeks(state.weekly_contents.map((w, idx) => ({
        id: `week-${w.week_number}`,
        weekNumber: w.week_number,
        title: '',
        unitId: w.unit_id || units[Math.floor(idx / 4)]?.id || units[units.length - 1]?.id || 'unit-1',
        contenido: w.content_description || '',
        criteriosDesempeno: '',
        estrategiasDidacticas: w.teaching_strategy || '',
        recursosAprendizaje: w.resources || '',
        bibliografia: w.bibliography || '',
        evaluations: [],
        competences: [],
        colspan: 1
      })));
    }
  }, [state.weekly_contents]);

  // Auto-calculate evaluations and competences for each week
  const augmentedWeeks = weeks.map(w => {
    const unitIndex = units.findIndex(u => u.id === w.unitId);
    const evaluationPlan = unitIndex >= 0 ? state.evaluation_plans[unitIndex] : null;

    const competences: Competence[] = evaluationPlan && evaluationPlan.competence ? [{
      id: `comp-${w.unitId}`,
      description: evaluationPlan.competence
    }] : [];

    const evaluations: Evaluation[] = [];
    if (evaluationPlan && evaluationPlan.due_week) {
      const dueStr = String(evaluationPlan.due_week).toLowerCase();
      // Match if the week number appears as an isolated word
      const regex = new RegExp(`\\b${w.weekNumber}\\b`);
      if (regex.test(dueStr)) {
        evaluations.push({
          id: `eval-${w.unitId}`,
          title: evaluationPlan.strategy || 'Evaluación',
          weight: parseFloat(String(evaluationPlan.weight)) || 0,
          description: evaluationPlan.instrument || ''
        });
      }
    }

    return { ...w, competences, evaluations };
  });

  const assignedEvaluations = augmentedWeeks.flatMap(w => w.evaluations);

  const handleOpenWeek = (week: WeekData) => {
    setSelectedWeek(week);
  };

  const handleUpdateWeek = async (updatedWeek: WeekData) => {
    const newWeeks = weeks.map((w) => (w.id === updatedWeek.id ? updatedWeek : w));
    setWeeks(newWeeks);
    
    // Auto-save to database
    const currentAssignedEvaluations = newWeeks.flatMap(w => w.evaluations);
    const payload = {
      title: state.title,
      status: state.status,
      objectives: state.objectives.filter(o => o.trim()),
      strategies: state.strategies.filter(s => s.trim()),
      subject_code: state.subject_code,
      section: state.section,
      academic_period_id: state.academic_period_id,
      evaluation_plans: state.evaluation_plans.slice(0, 4),
      weekly_contents: newWeeks.map(w => ({
        week_number: w.weekNumber,
        unit_id: w.unitId || null,
        content_description: w.contenido || '',
        teaching_strategy: w.estrategiasDidacticas || '',
        resources: w.recursosAprendizaje || '',
        bibliography: w.bibliografia || ''
      }))
    };
    try {
      await onSave(payload);
    } catch (err) {
      console.error("Error auto-saving on week update:", err);
    }
  };

  const handleAddWeek = () => {
    const nextNum = weeks.length + 1;
    const unitId = units.length > 0 ? units[0].id : 'unit-1';
    setWeeks([...weeks, {
      id: `week-${nextNum}`,
      weekNumber: nextNum,
      title: `Semana ${nextNum}`,
      unitId,
      contenido: '',
      criteriosDesempeno: '',
      estrategiasDidacticas: '',
      recursosAprendizaje: '',
      bibliografia: '',
      evaluations: [],
      competences: [],
      colspan: 1
    }]);
  };

  const handleSavePlan = async () => {
    const payload = {
      title: state.title,
      status: state.status,
      objectives: state.objectives.filter(o => o.trim()),
      strategies: state.strategies.filter(s => s.trim()),
      subject_code: state.subject_code,
      section: state.section,
      academic_period_id: state.academic_period_id,
      evaluation_plans: state.evaluation_plans.slice(0, 4),
      weekly_contents: weeks.map(w => ({
        week_number: w.weekNumber,
        unit_id: w.unitId || null,
        content_description: w.contenido || '',
        teaching_strategy: w.estrategiasDidacticas || '',
        resources: w.recursosAprendizaje || '',
        bibliography: w.bibliografia || ''
      }))
    };
    await onSave(payload);
  };

  // Sync state so Review step works
  useEffect(() => {
    updateField('weekly_contents', weeks.map(w => ({
      week_number: w.weekNumber,
      content_description: w.contenido || '',
      teaching_strategy: w.estrategiasDidacticas || '',
      resources: w.recursosAprendizaje || '',
      bibliography: w.bibliografia || ''
    })));
  }, [weeks, updateField]);

  return (
    <DialogContent className="max-w-[100vw] w-screen h-screen m-0 p-0 rounded-none border-none flex flex-col bg-background overflow-hidden [&>button]:hidden">
      
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-card shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-muted">
            <ArrowLeft size={20} />
          </Button>
          <DialogTitle className="text-xl font-black flex items-center gap-3">
            <div className="bg-primary/10 text-primary w-8 h-8 rounded-lg flex items-center justify-center">
              <Map size={18} strokeWidth={3} />
            </div>
            <span>Editor Visual Didacto</span>
          </DialogTitle>
        </div>

        {/* Tabs inside Header */}
        <div className="flex bg-accent/50 p-1 rounded-xl">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-background shadow-sm text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <Button onClick={handleSavePlan} className="gap-2 font-bold shadow-sm">
          <Save size={18} />
          Guardar Planificación
        </Button>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'general' && (
          <div className="p-8 w-full max-w-6xl mx-auto h-full overflow-y-auto">
            <WizardBasicInfo />
          </div>
        )}
        
        {activeTab === 'objectives' && (
          <div className="p-8 w-full max-w-6xl mx-auto h-full overflow-y-auto">
            <WizardObjectives />
          </div>
        )}

        {activeTab === 'units' && (
          <div className="p-8 w-full h-full overflow-y-auto custom-scrollbar bg-accent/10">
            <EvaluationPlanGrid />
          </div>
        )}

        {activeTab === 'review' && (
          <div className="p-8 w-full max-w-6xl mx-auto h-full overflow-y-auto">
            <WizardReview />
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="flex flex-1 overflow-hidden h-full">
            <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative">
              <div className="px-8 py-5 shrink-0 bg-card border-b border-border shadow-sm z-10">
                <ProgressBar evaluations={assignedEvaluations} max={100} />
              </div>
              <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-accent/10">
                <div className="flex gap-6 h-full min-w-max p-8 pb-10">
                  {augmentedWeeks.map((w) => (
                    <div 
                      key={w.id} 
                      className="shrink-0 h-full"
                      style={{ width: w.colspan ? (w.colspan * 320) + ((w.colspan - 1) * 24) : 320 }}
                    >
                      <WeekColumn week={w} onOpen={() => handleOpenWeek(w)} />
                    </div>
                  ))}
                  <div className="shrink-0 w-[320px] flex items-center justify-center">
                    <Button variant="outline" size="lg" className="w-full h-full border-dashed border-2 bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground font-bold text-lg" onClick={handleAddWeek}>
                      + Añadir Semana
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Week Details */}
            {selectedWeek && (
              <div className="w-[420px] shrink-0 border-l border-border bg-card shadow-2xl z-20">
                <WeekDetailsPanel 
                  week={selectedWeek} 
                  units={units}
                  onSave={handleUpdateWeek} 
                  onClose={() => setSelectedWeek(null)} 
                  onDelete={() => {
                    if (weeks.length <= 12 || selectedWeek.weekNumber <= 12) {
                      // Clear content instead of removing the week
                      const clearedWeek = {
                        ...selectedWeek,
                        title: '',
                        contenido: '',
                        criteriosDesempeno: '',
                        estrategiasDidacticas: '',
                        recursosAprendizaje: '',
                        bibliografia: '',
                        weekLabel: ''
                      };
                      const newWeeks = weeks.map(w => w.id === selectedWeek.id ? clearedWeek : w);
                      setWeeks(newWeeks);
                    } else {
                      // Remove the week and renumber subsequent weeks to avoid gaps
                      const filtered = weeks.filter(w => w.id !== selectedWeek.id);
                      const renumbered = filtered.map((w, index) => {
                        const correctNumber = index + 1;
                        return {
                          ...w,
                          id: `week-${correctNumber}`,
                          weekNumber: correctNumber,
                          title: w.title === `Semana ${w.weekNumber}` ? `Semana ${correctNumber}` : w.title
                        };
                      });
                      setWeeks(renumbered);
                    }
                    setSelectedWeek(null);
                  }}
                />
              </div>
            )}

          </div>

        )}
      </div>
    </DialogContent>
  );
}
