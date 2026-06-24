import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api-client';
import { useWizard } from '@/context/WizardContext';
import { Layers, Target, ClipboardList, Settings, Clock, BookOpen, Wand2, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV'];

interface EvaluationPlanGridProps {
  onSuggestFullPlan?: () => Promise<void>;
  isSuggesting?: boolean;
  limitReached?: boolean;
  hasAssignedAgent?: boolean;
}

export function EvaluationPlanGrid({
  onSuggestFullPlan,
  isSuggesting = false,
  limitReached = false,
  hasAssignedAgent = false,
}: EvaluationPlanGridProps) {
  const { state, updateEvaluationItem, updateEvaluationPredictive, removeEvaluationItem, updateField } = useWizard();
  
  const { data: taxonomy } = useQuery({
    queryKey: ['taxonomySettings'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/settings/taxonomies');
      return data;
    }
  });
  
  const { data: academicLoad } = useQuery({
    queryKey: ['academicLoad'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/academic-load');
      return data;
    },
  });

  const subject = academicLoad?.subjects?.find((s: any) => s.code === state.subject_code);

  const { data: syllabusDetail, isLoading: isSyllabusLoading } = useQuery({
    queryKey: ['syllabus', subject?.id],
    queryFn: async () => {
      if (!subject?.id) return null;
      const { data } = await api.get(`/syllabus/subjects/${subject.id}`);
      return data;
    },
    enabled: !!subject?.id,
  });

  const activePeriod = academicLoad?.active_period;

  const handleAutoFill = () => {
    if (!syllabusDetail || !syllabusDetail.units) {
      console.warn("No syllabus detail found", syllabusDetail);
      return;
    }
    
    syllabusDetail.units.slice(0, 4).forEach((unit: any, idx: number) => {
      // Usar título de la unidad si está disponible
      if (unit.unit_title) {
         updateEvaluationItem(idx, 'title', unit.unit_title);
      }

      const criteria = unit.performance_criteria || '';
      const competenciaMatch = criteria.match(/^Competencia:\n([\s\S]*?)(?=\n\nCriterios de Desempeño:|$)/);
      const criteriosMatch = criteria.match(/Criterios de Desempeño:\n([\s\S]*)$/);
      const competenciaText = competenciaMatch ? competenciaMatch[1].trim() : '';
      const criteriosText = criteriosMatch ? criteriosMatch[1].trim() : criteria;

      // Llenar Competencia Específica
      if (!state.evaluation_plans[idx].competence) {
         updateEvaluationItem(idx, 'competence', competenciaText || unit.contents || unit.unit_title || "Contenidos no disponibles.");
      }

      // Llenar Criterios de Desempeño
      if (!state.evaluation_plans[idx].performance_criterion || state.evaluation_plans[idx].performance_criterion === 'No se encontraron criterios de desempeño específicos en el PDF.') {
         updateEvaluationItem(idx, 'performance_criterion', criteriosText || "No se encontraron criterios de desempeño específicos en el PDF.");
      }
    });
  };

  const handleDateChange = (idx: number, dateStr: string) => {
    updateEvaluationItem(idx, 'due_date', dateStr);
    
    if (!dateStr || !activePeriod?.start_date) {
      updateEvaluationItem(idx, 'due_week', null);
      return;
    }

    const start = new Date(activePeriod.start_date);
    const selected = new Date(dateStr);
    
    if (selected >= start) {
      const diffTime = selected.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // Calculate actual week number
      let weekNumber = Math.floor(diffDays / 7) + 1;
      
      updateEvaluationItem(idx, 'due_week', weekNumber);
    } else {
      updateEvaluationItem(idx, 'due_week', 1);
    }
  };

  const handlePercentageChange = (idx: number, pctStr: string) => {
    updateEvaluationItem(idx, 'weight', pctStr);
  };

  const calculatePoints = (weight: string | number | undefined) => {
    const val = parseFloat(String(weight || 0));
    if (isNaN(val)) return 0;
    return ((val / 100) * (state.base_score || 20)).toFixed(1);
  };

  // Use all evaluation plans in state (dynamically supports 3 or 4)
  const units = state.evaluation_plans;

  return (
    <div className="w-full flex flex-col h-full bg-background">
      <div className="p-6 border-b border-border/40 bg-card/50 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2 text-foreground">
            <Layers className="h-6 w-6 text-primary" />
            Unidades Temáticas y Plan de Evaluación
          </h2>
          <p className="text-muted-foreground mt-1">
            Define el bloque de evaluación y competencias para las unidades. Las tarjetas se adaptarán al contenido.
          </p>
        </div>
        
        <div className="flex gap-2">
          {hasAssignedAgent && onSuggestFullPlan && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSuggesting || limitReached}
              onClick={onSuggestFullPlan}
              className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 gap-1.5 font-bold shadow-sm"
            >
              {isSuggesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generando plan completo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sugerir con IA</span>
                </>
              )}
            </Button>
          )}
          {syllabusDetail && syllabusDetail.units && syllabusDetail.units.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleAutoFill}
              className="flex items-center gap-2 text-primary border-primary/30 hover:bg-primary/10 font-bold"
            >
              <Wand2 size={16} />
              Extraer del Sinóptico Oficial
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto custom-scrollbar p-6 bg-muted/30">
        <div className="flex gap-6 min-w-max pb-4">
          {units.map((unit, idx) => (
            <Card key={idx} className="w-[450px] shrink-0 border-border/50 shadow-md bg-card flex flex-col">
              <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
                <CardTitle className="flex flex-col gap-2">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      UNIDAD {ROMAN_NUMERALS[idx]}
                    </span>
                    {idx === 3 && state.evaluation_plans.length === 4 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeEvaluationItem(3)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Input
                    value={unit.title || ''}
                    onChange={(e) => updateEvaluationItem(idx, 'title', e.target.value)}
                    placeholder="Nombre del Tema de la Unidad..."
                    className="text-lg font-bold border-transparent bg-transparent hover:bg-background focus:bg-background focus:border-border h-auto py-1 px-2 -ml-2 shadow-none transition-colors"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex flex-col gap-6 overflow-y-auto custom-scrollbar flex-1">
                
                {/* Sección 1: El Qué (Competencias) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm border-b border-border/50 pb-1">
                    <Target size={16} />
                    <h3>Objetivos de la Unidad</h3>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Competencia Específica</Label>
                    <Textarea
                      value={unit.competence}
                      onChange={(e) => updateEvaluationItem(idx, 'competence', e.target.value)}
                      placeholder="Ej. Analiza los fundamentos..."
                      className="min-h-[80px] bg-background resize-none text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Criterios de Desempeño</Label>
                    <Textarea
                      value={unit.performance_criterion || ''}
                      onChange={(e) => updateEvaluationItem(idx, 'performance_criterion', e.target.value)}
                      placeholder="Ej. Aplica metodologías..."
                      className="min-h-[80px] bg-background resize-none text-sm"
                    />
                  </div>
                </div>

                {/* Sección 2: El Cómo (Estrategia e Instrumento) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm border-b border-border/50 pb-1">
                    <BookOpen size={16} />
                    <h3>Metodología</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Estrategia de Ev.</Label>
                      <Input
                        list="strategies-list"
                        value={unit.strategy}
                        onChange={(e) => updateEvaluationPredictive(idx, e.target.value, taxonomy?.predictive_rules || {})}
                        placeholder="Seleccionar o escribir..."
                        className="bg-background text-sm"
                      />
                      <datalist id="strategies-list">
                        {taxonomy?.strategies?.map((opt: string) => <option key={opt} value={opt} />)}
                      </datalist>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Instrumento</Label>
                      <Input
                        list="instruments-list"
                        value={unit.instrument}
                        onChange={(e) => updateEvaluationItem(idx, 'instrument', e.target.value)}
                        placeholder="Seleccionar o escribir..."
                        className="bg-background text-sm"
                      />
                      <datalist id="instruments-list">
                        {taxonomy?.instruments?.map((opt: string) => <option key={opt} value={opt} />)}
                      </datalist>
                    </div>
                  </div>
                </div>

                {/* Sección 3: Detalles de Evaluación */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm border-b border-border/50 pb-1">
                    <ClipboardList size={16} />
                    <h3>Detalles de Evaluación</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Tipo de Evaluación</Label>
                      <div className="flex gap-2 h-10">
                        {['Diagnóstica', 'Formativa', 'Sumativa'].map((type) => {
                          const isActive = (unit.evaluation_type || '').includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                let types = (unit.evaluation_type || '').split(' y ').filter(t => t.trim() !== '');
                                if (types.includes(type)) {
                                  types = types.filter(t => t !== type);
                                } else {
                                  types.push(type);
                                }
                                updateEvaluationItem(idx, 'evaluation_type', types.join(' y '));
                              }}
                              className={`flex-1 flex items-center justify-center text-[10px] sm:text-xs font-semibold rounded-md border transition-colors ${
                                isActive 
                                  ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                                  : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
                              }`}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Evidencia</Label>
                      <Input
                        list="evidences-list"
                        value={unit.evidence}
                        onChange={(e) => updateEvaluationItem(idx, 'evidence', e.target.value)}
                        placeholder="Seleccionar o escribir..."
                        className="h-10 bg-background text-sm"
                      />
                      <datalist id="evidences-list">
                        {taxonomy?.evidences?.map((opt: string) => <option key={opt} value={opt} />)}
                      </datalist>
                    </div>
                    
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground">Retroalimentación</Label>
                        <Input
                          list="feedbacks-list"
                          value={unit.feedback_method}
                          onChange={(e) => updateEvaluationItem(idx, 'feedback_method', e.target.value)}
                          placeholder="Seleccionar o escribir..."
                          className="h-10 bg-background text-sm"
                        />
                        <datalist id="feedbacks-list">
                          {taxonomy?.feedback_methods?.map((opt: string) => <option key={opt} value={opt} />)}
                        </datalist>
                    </div>
                  </div>
                </div>

                {/* Sección 4: Tiempo y Peso */}
                <div className="mt-auto pt-4 space-y-4">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm border-b border-border/50 pb-1">
                    <Clock size={16} />
                    <h3>Cierre y Ponderación</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-border/50">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground flex justify-between">
                        <span>Lapso / Fecha Entrega</span>
                        {unit.due_week && <span className="text-primary">Semana {unit.due_week}</span>}
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-medium text-sm bg-background border-input h-10 px-3",
                              !unit.due_date && "text-muted-foreground"
                            )}
                          >
                            <Clock className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            {unit.due_date ? (
                              (() => {
                                const [y, m, d] = unit.due_date.split('-');
                                return format(new Date(parseInt(y), parseInt(m) - 1, parseInt(d)), "PPP", { locale: es });
                              })()
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            showWeekNumber
                            academicStartDate={activePeriod?.start_date ? new Date(activePeriod.start_date + 'T00:00:00') : undefined}
                            selected={unit.due_date ? (() => {
                               const [y, m, d] = unit.due_date.split('-');
                               return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                            })() : undefined}
                            onSelect={(date) => {
                               if (date) {
                                  const year = date.getFullYear();
                                  const month = String(date.getMonth() + 1).padStart(2, '0');
                                  const day = String(date.getDate()).padStart(2, '0');
                                  handleDateChange(idx, `${year}-${month}-${day}`);
                               } else {
                                  handleDateChange(idx, '');
                               }
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground flex justify-between">
                        <span>Ponderación (%)</span>
                        <span className="text-primary font-black bg-primary/10 px-2 py-0.5 rounded-md">
                          {calculatePoints(unit.weight)} / {state.base_score || 20} ptos
                        </span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={unit.weight ?? ''}
                        onChange={(e) => handlePercentageChange(idx, e.target.value)}
                        placeholder="Ej. 25"
                        className="bg-background font-black text-primary text-sm"
                      />
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
