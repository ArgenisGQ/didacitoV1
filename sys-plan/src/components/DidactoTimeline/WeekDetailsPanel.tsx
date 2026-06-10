import React, { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api-client';
import { WeekData, UnitData } from './types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { X, Save, Info, Wand2 } from 'lucide-react';
import { useWizard } from '@/context/WizardContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface Props {
  week: WeekData | null;
  units: UnitData[];
  onSave: (week: WeekData) => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function WeekDetailsPanel({ week, units, onSave, onClose, onDelete }: Props) {
  const { register, handleSubmit, reset, control, setValue, getValues, formState: { isDirty } } = useForm<WeekData>();
  const { state, updateEvaluationItem } = useWizard();
  
  const { data: academicLoad } = useQuery({
    queryKey: ['academicLoad'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/academic-load');
      return data;
    },
  });

  const activePeriod = academicLoad?.active_period;

  const subject = academicLoad?.subjects?.find((s: any) => s.code === state.subject_code);

  const { data: syllabusDetail } = useQuery({
    queryKey: ['syllabus', subject?.id],
    queryFn: async () => {
      if (!subject?.id) return null;
      const { data } = await api.get(`/syllabus/subjects/${subject.id}`);
      return data;
    },
    enabled: !!subject?.id,
  });

  const selectedUnitId = useWatch({ control, name: 'unitId' });
  const selectedUnitIndex = units.findIndex(u => u.id === selectedUnitId);
  const selectedEvaluationPlan = selectedUnitIndex >= 0 ? state.evaluation_plans[selectedUnitIndex] : null;

  const weekEvaluations = React.useMemo(() => {
    if (!week) return [];
    const evals: { title: string; weight: number }[] = [];
    state.evaluation_plans.slice(0, 4).forEach((ep, idx) => {
      if (ep && ep.due_week) {
        const dueStr = String(ep.due_week).toLowerCase();
        const dueWeekNum = parseInt(dueStr, 10);
        const isLastWeek = week.weekNumber === 12;
        const regex = new RegExp(`\\b${week.weekNumber}\\b`);
        if (regex.test(dueStr) || (isLastWeek && dueWeekNum > week.weekNumber)) {
          evals.push({
            title: ep.strategy || `Evaluación U${idx + 1}`,
            weight: parseFloat(String(ep.weight)) || 0
          });
        }
      }
    });
    return evals;
  }, [state.evaluation_plans, week]);

  const contenidoValue = useWatch({ control, name: 'contenido' }) || '';

  const rawContents = selectedUnitIndex >= 0 && syllabusDetail?.units?.[selectedUnitIndex]?.contents;
  const availableCompetences = React.useMemo(() => {
    if (!rawContents) return [];
    return rawContents
      .split('.')
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0);
  }, [rawContents]);

  const handleToggleCompetence = (comp: string) => {
    const current = getValues('contenido') || '';
    const currentItems = current.split('.').map(s => s.trim()).filter(Boolean);
    const index = currentItems.indexOf(comp);
    
    let newItems;
    if (index >= 0) {
      newItems = currentItems.filter((_, i) => i !== index);
    } else {
      newItems = [...currentItems, comp];
    }
    
    const newValue = newItems.length > 0 ? newItems.join('. ') + '.' : '';
    setValue('contenido', newValue, { shouldDirty: true });
  };

  const handleDragStart = (e: React.DragEvent, comp: string) => {
    e.dataTransfer.setData('text/plain', comp);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const comp = e.dataTransfer.getData('text/plain');
    if (!comp) return;

    const current = getValues('contenido') || '';
    const currentItems = current.split('.').map(s => s.trim()).filter(Boolean);
    
    if (!currentItems.includes(comp)) {
      const newItems = [...currentItems, comp];
      const newValue = newItems.join('. ') + '.';
      setValue('contenido', newValue, { shouldDirty: true });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleEvaluationDateChange = (dateStr: string) => {
    if (selectedUnitIndex < 0) return;
    updateEvaluationItem(selectedUnitIndex, 'due_date', dateStr);
    
    if (!dateStr || !activePeriod?.start_date) {
      updateEvaluationItem(selectedUnitIndex, 'due_week', null);
      return;
    }

    const start = new Date(activePeriod.start_date);
    const selected = new Date(dateStr);
    
    if (selected >= start) {
      const diffTime = selected.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      let weekNumber = Math.floor(diffDays / 7) + 1;
      updateEvaluationItem(selectedUnitIndex, 'due_week', weekNumber);
    } else {
      updateEvaluationItem(selectedUnitIndex, 'due_week', 1);
    }
  };

  const prevWeekIdRef = React.useRef<string | undefined>(undefined);

  useEffect(() => {
    if (week) {
      if (week.id !== prevWeekIdRef.current) {
        reset(week);
        prevWeekIdRef.current = week.id;
      }
    } else {
      prevWeekIdRef.current = undefined;
    }
  }, [week, reset]);

  const onSubmit = (data: WeekData) => {
    if (week) {
      onSave({ ...week, ...data });
      reset(data); // reset dirty state
      onClose();
    }
  };

  const handleAutoFill = () => {
    if (!syllabusDetail) return;
    
    // Check if fields already have data
    const currentValues = getValues();
    const hasData = currentValues.contenido || currentValues.estrategiasDidacticas || currentValues.criteriosDesempeno || currentValues.bibliografia;
    
    if (hasData) {
      if (!confirm('Los campos ya contienen información. ¿Estás seguro de que deseas sobrescribirlos con la información del sinóptico?')) {
        return;
      }
    }

    if (selectedUnitIndex >= 0 && syllabusDetail.units && syllabusDetail.units.length > selectedUnitIndex) {
      const unit = syllabusDetail.units[selectedUnitIndex];
      if (unit.contents) setValue('contenido', unit.contents, { shouldDirty: true });
      
      const criteria = unit.performance_criteria || '';
      const criteriosMatch = criteria.match(/Criterios de Desempeño:\n([\s\S]*)$/);
      const criteriosText = criteriosMatch ? criteriosMatch[1].trim() : criteria;
      if (criteriosText) setValue('criteriosDesempeno', criteriosText, { shouldDirty: true });
    }
    
    if (syllabusDetail.teaching_strategies) {
      setValue('estrategiasDidacticas', syllabusDetail.teaching_strategies, { shouldDirty: true });
    }
    
    if (syllabusDetail.bibliographic_references) {
      setValue('bibliografia', syllabusDetail.bibliographic_references, { shouldDirty: true });
    }
  };

  if (!week) return null;

  return (
    <div className="h-full flex flex-col bg-card text-card-foreground overflow-hidden shadow-2xl relative border-l border-border">
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <h2 className="font-bold uppercase tracking-wider text-sm flex items-center gap-2">
          DETALLE DE SEMANA {week.weekNumber}
        </h2>
        <div className="flex items-center gap-1">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={handleAutoFill}
            className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 gap-1 px-2"
            title="Autocompletar con información del Sinóptico"
          >
            <Wand2 size={14} />
            <span className="text-xs font-bold hidden sm:inline">Sinóptico</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-accent" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <form id="week-details-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          
          <div className="space-y-1.5">
            <Label htmlFor="unitId" className="text-xs font-bold text-foreground">Unidad Temática (Asignada automáticamente por fecha)</Label>
            <select
              id="unitId"
              disabled
              {...register('unitId')}
              className="w-full flex h-10 rounded-md border border-input bg-muted px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-80 text-foreground"
            >
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.title}</option>
              ))}
            </select>

            <div className="space-y-1.5 mt-3">
              <Label htmlFor="title" className="text-xs font-bold text-foreground">Unidad de Contenido</Label>
              <Input
                id="title"
                {...register('title')}
                className="bg-background border-border text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="Ej. Unidad I: Conceptos Básicos..."
              />
            </div>

            <div className="space-y-1.5 mt-3">
              <Label htmlFor="specificCompetence" className="text-xs font-bold text-foreground">Competencia Específica</Label>
              <Textarea
                id="specificCompetence"
                {...register('specificCompetence')}
                className="bg-background border-border text-sm min-h-[60px] resize-none text-foreground placeholder:text-muted-foreground"
                placeholder="Describa la competencia específica..."
              />
            </div>

            {selectedEvaluationPlan && (
              <div className="mt-2 p-3 bg-muted/30 border border-border rounded-md text-xs space-y-2">
                <div>
                  <span className="font-bold text-foreground">Estrategia de Evaluación: </span>
                  <span className="text-muted-foreground">{selectedEvaluationPlan.strategy || <span className="italic">Sin definir</span>}</span>
                </div>
                {selectedEvaluationPlan.due_date && (
                  <div>
                    <span className="font-bold text-foreground">Fecha de Entrega: </span>
                    <span className="text-muted-foreground">
                      {(() => {
                        const [y, m, d] = selectedEvaluationPlan.due_date.split('-');
                        return format(new Date(parseInt(y), parseInt(m) - 1, parseInt(d)), "PPP", { locale: es });
                      })()}
                    </span>
                  </div>
                )}
                <div>
                  <span className="font-bold text-foreground">Entrega/Lapso: </span>
                  <span className="text-muted-foreground">
                    {selectedEvaluationPlan.due_week ? `Semana ${selectedEvaluationPlan.due_week}` : <span className="italic">Sin definir</span>}
                  </span>
                </div>
              </div>
            )}
          </div>



          <div className="space-y-1.5">
            <Label htmlFor="contenido" className="text-xs font-bold text-foreground">Competencias</Label>
            
            {availableCompetences.length > 0 && (
              <div className="p-3 bg-muted/20 border border-border rounded-md space-y-2">
                <span className="text-xs font-bold text-muted-foreground block">
                  Competencias del Sinóptico (Haz clic o arrastra al cuadro de texto):
                </span>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                  {availableCompetences.map((comp: string, idx: number) => {
                    const isSelected = contenidoValue.includes(comp);
                    return (
                      <div
                        key={idx}
                        draggable
                        onDragStart={(e) => handleDragStart(e, comp)}
                        onClick={() => handleToggleCompetence(comp)}
                        className={cn(
                          "text-xs px-2.5 py-1.5 rounded-md cursor-pointer border transition-all duration-200 select-none flex items-start gap-1.5 active:scale-95 text-left",
                          isSelected 
                            ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm" 
                            : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                        )}
                        title="Arrastra o haz clic para agregar/quitar"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0 mt-1.5" />
                        <span className="flex-1 leading-normal">{comp}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <input
              type="hidden"
              id="contenido"
              {...register('contenido')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="estrategiasDidacticas" className="text-xs font-bold text-foreground">Estrategias Didácticas</Label>
            <Textarea
              id="estrategiasDidacticas"
              {...register('estrategiasDidacticas')}
              className="bg-background border-border text-sm min-h-[80px] resize-none text-foreground placeholder:text-muted-foreground"
              placeholder="Ej. Clase magistral, aprendizaje basado en proyectos..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recursosAprendizaje" className="text-xs font-bold text-foreground">Recursos de Aprendizaje</Label>
            <Textarea
              id="recursosAprendizaje"
              {...register('recursosAprendizaje')}
              className="bg-background border-border text-sm min-h-[80px] resize-none text-foreground placeholder:text-muted-foreground"
              placeholder="Materiales, presentaciones, lecturas..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="criteriosDesempeno" className="text-xs font-bold text-foreground">Criterios de Desempeño</Label>
            <Textarea
              id="criteriosDesempeno"
              {...register('criteriosDesempeno')}
              className="bg-background border-border text-sm min-h-[80px] resize-none text-foreground placeholder:text-muted-foreground"
              placeholder="Criterios para evaluar la competencia..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bibliografia" className="text-xs font-bold text-foreground">Bibliografía</Label>
            <Textarea
              id="bibliografia"
              {...register('bibliografia')}
              className="bg-background border-border text-sm min-h-[80px] resize-none text-foreground placeholder:text-muted-foreground"
              placeholder="Referencias bibliográficas..."
            />
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">
              Evaluación de la Semana
            </Label>
            
            {/* Fixed evaluations assigned to this week */}
            {weekEvaluations.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-muted-foreground block">
                  Evaluaciones del Plan de Unidad (Fijo):
                </span>
                <div className="space-y-2">
                  {weekEvaluations.map((ev, idx) => (
                    <div key={idx} className="p-3 bg-muted border border-border rounded-md text-xs flex justify-between items-center font-medium">
                      <span className="text-foreground">{ev.title}</span>
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">{ev.weight}% Peso</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Field for placing other evaluations by hand */}
            <div className="space-y-1.5">
              <Label htmlFor="evaluationFeedback" className="text-[11px] font-bold text-muted-foreground">
                Otras Evaluaciones / Retroalimentación (Escrito a mano)
              </Label>
              <Textarea
                id="evaluationFeedback"
                {...register('evaluationFeedback')}
                className="bg-background border-border text-sm min-h-[80px] resize-none text-foreground placeholder:text-muted-foreground"
                placeholder="Describe otras actividades evaluativas o de retroalimentación para esta semana..."
              />
            </div>
          </div>

        </form>
      </div>

      <div className="p-4 border-t border-border bg-card shrink-0 flex gap-2">
        {onDelete && (
          <Button 
            type="button" 
            variant="outline"
            onClick={() => { if(confirm('¿Eliminar esta semana y todo su contenido?')) onDelete(); }}
            className="border-red-500/50 text-red-500 hover:bg-red-500/10 px-3"
          >
            <X size={16} />
          </Button>
        )}
        <Button 
          type="submit" 
          form="week-details-form" 
          disabled={!isDirty} 
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold"
        >
          <Save size={16} className="mr-2" />
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
}
