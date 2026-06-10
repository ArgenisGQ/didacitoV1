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
import { useAutosave } from '@/hooks/useAutosave';
import api from '@/lib/api-client';
import { Clock } from 'lucide-react';

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
  { id: 'units', label: 'Unidades', icon: Layers },
  { id: 'timeline', label: 'Semanas', icon: Map },
  { id: 'review', label: 'Revisión Final', icon: CheckCircle2 },
];

function DidactoTimelineInner({ initialData, planId, onSave, onClose }: Props) {
  const { state, updateField } = useWizard();
  const [activeTab, setActiveTab] = useState('general');
  const [activePlanId, setActivePlanId] = useState<number | null>(planId || null);

  const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV'];
  
  const [units, setUnits] = useState<UnitData[]>(() => {
    const evPlans = [...(initialData?.evaluation_plans || state.evaluation_plans)].sort((a: any, b: any) => (a.unit || 0) - (b.unit || 0));
    return evPlans.slice(0, 4).map((ep: any, idx: number) => ({
      id: `unit-${ep.unit || (idx + 1)}`,
      title: ep.title ? `Unidad ${ROMAN_NUMERALS[(ep.unit ? ep.unit - 1 : idx)]}: ${ep.title}` : `Unidad ${ROMAN_NUMERALS[(ep.unit ? ep.unit - 1 : idx)]}`
    }));
  });

  useEffect(() => {
    const evPlans = [...state.evaluation_plans].sort((a: any, b: any) => (a.unit || 0) - (b.unit || 0));
    const mappedUnits = evPlans.slice(0, 4).map((ep: any, idx: number) => ({
      id: `unit-${ep.unit || (idx + 1)}`,
      title: ep.title ? `Unidad ${ROMAN_NUMERALS[(ep.unit ? ep.unit - 1 : idx)]}: ${ep.title}` : `Unidad ${ROMAN_NUMERALS[(ep.unit ? ep.unit - 1 : idx)]}`
    }));
    setUnits(mappedUnits);
  }, [state.evaluation_plans]);

  const [weeks, setWeeks] = useState<WeekData[]>(() => {
    const initialWeeks = initialData?.weekly_contents;
    if (initialWeeks && initialWeeks.length > 0) {
      return initialWeeks.map((w: any, idx: number) => ({
        id: `week-${w.week_number}`,
        weekNumber: w.week_number,
        title: w.unit_content && !w.unit_content.startsWith('unit-') ? w.unit_content : '',
        unitId: w.unit_id || (idx < 4 ? 'unit-1' : idx < 8 ? 'unit-2' : idx < 12 ? 'unit-3' : 'unit-4'),
        contenido: w.content_description || '',
        criteriosDesempeno: w.performance_criteria || '',
        estrategiasDidacticas: w.teaching_strategy || '',
        recursosAprendizaje: w.resources || '',
        bibliografia: w.bibliography || '',
        evaluationFeedback: w.evaluation_feedback || '',
        specificCompetence: w.specific_competence || '',
        evaluations: [],
        competences: [],
        colspan: 1
      }));
    }
    // Default 12 weeks
    return Array.from({ length: 12 }, (_, idx) => ({
      id: `week-${idx + 1}`,
      weekNumber: idx + 1,
      title: '',
      unitId: idx < 4 ? 'unit-1' : idx < 8 ? 'unit-2' : idx < 12 ? 'unit-3' : 'unit-4',
      contenido: '',
      criteriosDesempeno: '',
      estrategiasDidacticas: '',
      recursosAprendizaje: '',
      bibliografia: '',
      evaluationFeedback: '',
      specificCompetence: '',
      evaluations: [],
      competences: [],
      colspan: 1
    }));
  });
  
  const [selectedWeek, setSelectedWeek] = useState<WeekData | null>(null);

  const payload = React.useMemo(() => ({
    title: state.title,
    status: state.status,
    objectives: state.objectives.filter(o => o?.trim()),
    strategies: state.strategies.filter(s => s?.trim()),
    subject_code: state.subject_code,
    section: state.section,
    academic_period_id: state.academic_period_id,
    modality: state.modality,
    component_type: state.component_type,
    hd_t: state.hd_t,
    hd_lt: state.hd_lt,
    hd_iscp: state.hd_iscp,
    hiv_s: state.hiv_s,
    hiv_a: state.hiv_a,
    hde: state.hde,
    evaluation_plans: state.evaluation_plans.slice(0, 4).filter(e => 
      e.title?.trim() || e.competence?.trim() || e.performance_criterion?.trim() || 
      e.strategy?.trim() || e.instrument?.trim() || e.evaluation_type?.trim() || 
      e.evidence?.trim() || e.feedback_method?.trim() || 
      e.weight || e.due_week || e.due_date?.trim()
    ).map((ep: any) => ({
      unit: ep.unit ?? null,
      title: ep.title || '',
      competence: ep.competence || '',
      performance_criterion: ep.performance_criterion || '',
      strategy: ep.strategy || '',
      instrument: ep.instrument || '',
      evaluation_type: ep.evaluation_type || '',
      evidence: ep.evidence || '',
      feedback_method: ep.feedback_method || '',
      weight: ep.weight === '' || ep.weight === null ? 0 : parseFloat(String(ep.weight)) || 0,
      due_week: ep.due_week === '' || ep.due_week === null ? null : parseInt(String(ep.due_week)) || null,
      due_date: ep.due_date || null,
    })),
    weekly_contents: weeks
      .map(w => ({
        week_number: w.weekNumber,
        unit_content: w.title || '',
        content_description: w.contenido || '',
        teaching_strategy: w.estrategiasDidacticas || '',
        resources: w.recursosAprendizaje || '',
        bibliography: w.bibliografia || '',
        performance_criteria: w.criteriosDesempeno || '',
        specific_competence: w.specificCompetence || w.competences?.[0]?.description || '',
        evaluation_feedback: w.evaluationFeedback || '',
      }))
  }), [state, weeks]);

  const { saveState, saving, markDirty } = useAutosave(
    () => payload,
    {
      planId: activePlanId,
      enabled: activePlanId !== null,
      intervalMs: 10000,
    }
  );

  const saveCurrentStateToDB = async () => {
    try {
      if (activePlanId === null) {
        const { data } = await api.post('/plans', payload);
        setActivePlanId(data.id);
      } else {
        await api.put(`/plans/${activePlanId}`, payload);
      }
    } catch (err) {
      console.error('Error auto-saving plan:', err);
    }
  };

  useEffect(() => {
    if (activePlanId !== null) markDirty();
  }, [state, weeks, activePlanId, markDirty]);

  // Dynamically assign weeks to units based on the due weeks of evaluation plans
  useEffect(() => {
    const sortedEv = [...state.evaluation_plans].sort((a: any, b: any) => (a.unit || 0) - (b.unit || 0));
    const w1 = parseInt(String(sortedEv[0]?.due_week)) || 4;
    const w2 = Math.max(w1 + 1, parseInt(String(sortedEv[1]?.due_week)) || 8);
    const w3 = Math.max(w2 + 1, parseInt(String(sortedEv[2]?.due_week)) || 12);
    
    let changed = false;
    const updatedWeeks = weeks.map(w => {
      let targetUnitId = 'unit-4';
      if (w.weekNumber <= w1) {
        targetUnitId = 'unit-1';
      } else if (w.weekNumber <= w2) {
        targetUnitId = 'unit-2';
      } else if (w.weekNumber <= w3) {
        targetUnitId = 'unit-3';
      }
      
      if (w.unitId !== targetUnitId) {
        changed = true;
        return { ...w, unitId: targetUnitId };
      }
      return w;
    });
    
    if (changed) {
      setWeeks(updatedWeeks);
    }
  }, [state.evaluation_plans, weeks]);

  // Auto-calculate evaluations and competences for each week
  const augmentedWeeks = weeks.map(w => {
    const unitIndex = units.findIndex(u => u.id === w.unitId);
    const evaluationPlan = unitIndex >= 0 ? state.evaluation_plans[unitIndex] : null;
    const unitTitle = unitIndex >= 0 ? units[unitIndex]?.title : '';

    const competences: Competence[] = evaluationPlan && evaluationPlan.competence ? [{
      id: `comp-${w.unitId}`,
      description: evaluationPlan.competence
    }] : [];

    const evaluations: Evaluation[] = [];
    state.evaluation_plans.slice(0, 4).forEach((ep, idx) => {
      if (ep && ep.due_week) {
        const dueStr = String(ep.due_week).toLowerCase();
        const dueWeekNum = parseInt(dueStr, 10);
        const isLastWeek = w.weekNumber === weeks[weeks.length - 1]?.weekNumber;
        
        // Match if the week number appears as an isolated word, or if it's beyond the max week and we are in the last week
        const regex = new RegExp(`\\b${w.weekNumber}\\b`);
        if (regex.test(dueStr) || (isLastWeek && dueWeekNum > w.weekNumber)) {
          const epUnitId = units[idx]?.id || `unit-${idx + 1}`;
          evaluations.push({
            id: `eval-${epUnitId}-${w.id}`,
            title: ep.strategy || `Evaluación U${ROMAN_NUMERALS[idx]}`,
            weight: parseFloat(String(ep.weight)) || 0,
            description: ep.instrument || ''
          });
        }
      }
    });

    return { ...w, competences, evaluations, unitTitle };
  });

  const assignedEvaluations = augmentedWeeks.flatMap(w => w.evaluations);

  const handleOpenWeek = (week: WeekData) => {
    setSelectedWeek(week);
  };

  const handleUpdateWeek = async (updatedWeek: WeekData) => {
    const newWeeks = weeks.map((w) => (w.id === updatedWeek.id ? updatedWeek : w));
    setWeeks(newWeeks);
    // Auto-save triggers automatically via useAutosave since weeks changed
  };

  const handleDropCompetenceOnWeek = (weekId: string, comp: string) => {
    const updatedWeeks = weeks.map(w => {
      if (w.id === weekId) {
        const current = w.contenido || '';
        const currentItems = current.split('.').map(s => s.trim()).filter(Boolean);
        if (!currentItems.includes(comp)) {
          const newItems = [...currentItems, comp];
          return {
            ...w,
            contenido: newItems.join('. ') + '.'
          };
        }
      }
      return w;
    });
    setWeeks(updatedWeeks);
  };

  const handleRemoveCompetenceFromWeek = (weekId: string, comp: string) => {
    const updatedWeeks = weeks.map(w => {
      if (w.id === weekId) {
        const current = w.contenido || '';
        const currentItems = current.split('.').map(s => s.trim()).filter(Boolean);
        const newItems = currentItems.filter(item => item !== comp);
        return {
          ...w,
          contenido: newItems.length > 0 ? newItems.join('. ') + '.' : ''
        };
      }
      return w;
    });
    setWeeks(updatedWeeks);
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
      evaluationFeedback: '',
      specificCompetence: '',
      evaluations: [],
      competences: [],
      colspan: 1
    }]);
  };

  const handleSavePlan = async () => {
    await onSave({ ...payload, planId: activePlanId });
  };

  // Sync state so Review step works
  useEffect(() => {
    updateField('weekly_contents', weeks.map(w => ({
      week_number: w.weekNumber,
      unit_content: w.title || '',
      content_description: w.contenido || '',
      teaching_strategy: w.estrategiasDidacticas || '',
      resources: w.recursosAprendizaje || '',
      bibliography: w.bibliografia || '',
      performance_criteria: w.criteriosDesempeno || '',
      specific_competence: w.specificCompetence || w.competences?.[0]?.description || '',
      evaluation_feedback: w.evaluationFeedback || '',
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

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            {saving ? (
              <span className="animate-pulse">Guardando...</span>
            ) : saveState ? (
              <>
                <Clock size={12} />
                <span>Guardado {saveState.toLocaleTimeString()}</span>
              </>
            ) : null}
          </div>
          <Button variant="outline" onClick={async () => {
            await saveCurrentStateToDB();
          }} className="gap-2 font-bold shadow-sm hidden sm:flex border-primary/20 hover:bg-primary/5">
            <Save size={16} /> Guardar Borrador
          </Button>
          <Button onClick={handleSavePlan} className="gap-2 font-bold shadow-sm">
            <CheckCircle2 size={18} /> Guardar y Salir
          </Button>
        </div>
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
                      <WeekColumn 
                        week={w} 
                        onOpen={() => handleOpenWeek(w)} 
                        onDropCompetence={(comp) => handleDropCompetenceOnWeek(w.id, comp)} 
                        onRemoveCompetence={(comp) => handleRemoveCompetenceFromWeek(w.id, comp)}
                      />
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
            {selectedWeek && (() => {
              const currentWeek = augmentedWeeks.find(w => w.id === selectedWeek.id) || selectedWeek;
              return (
                <div className="w-[420px] shrink-0 border-l border-border bg-card shadow-2xl z-20">
                  <WeekDetailsPanel 
                    week={currentWeek} 
                    units={units}
                    onSave={handleUpdateWeek} 
                    onClose={() => setSelectedWeek(null)} 
                    onDelete={() => {
                      if (weeks.length <= 12 || currentWeek.weekNumber <= 12) {
                        // Clear content instead of removing the week
                        const clearedWeek = {
                          ...currentWeek,
                          title: '',
                          contenido: '',
                          criteriosDesempeno: '',
                          estrategiasDidacticas: '',
                          recursosAprendizaje: '',
                          bibliografia: '',
                          evaluationFeedback: '',
                          specificCompetence: '',
                          weekLabel: ''
                        };
                        const newWeeks = weeks.map(w => w.id === currentWeek.id ? clearedWeek : w);
                        setWeeks(newWeeks);
                      } else {
                        // Remove the week and renumber subsequent weeks to avoid gaps
                        const filtered = weeks.filter(w => w.id !== currentWeek.id);
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
              );
            })()}

          </div>

        )}
      </div>
    </DialogContent>
  );
}
