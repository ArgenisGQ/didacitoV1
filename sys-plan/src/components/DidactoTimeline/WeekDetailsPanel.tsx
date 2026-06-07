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

interface Props {
  week: WeekData | null;
  units: UnitData[];
  onSave: (week: WeekData) => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function WeekDetailsPanel({ week, units, onSave, onClose, onDelete }: Props) {
  const { register, handleSubmit, reset, control, setValue, getValues, formState: { isDirty } } = useForm<WeekData>();
  const { state } = useWizard();
  
  const { data: academicLoad } = useQuery({
    queryKey: ['academicLoad'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/academic-load');
      return data;
    },
  });

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

  useEffect(() => {
    if (week) {
      reset(week);
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
      if (unit.performance_criteria) setValue('criteriosDesempeno', unit.performance_criteria, { shouldDirty: true });
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
            <Label htmlFor="unitId" className="text-xs font-bold text-foreground">Unidad Temática</Label>
            <select
              id="unitId"
              {...register('unitId')}
              className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
            >
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.title}</option>
              ))}
            </select>
            {selectedEvaluationPlan && (
              <div className="mt-2 p-3 bg-muted/30 border border-border rounded-md text-xs space-y-2">
                <div>
                  <span className="font-bold text-foreground">Competencia de Unidad: </span>
                  <span className="text-muted-foreground">{selectedEvaluationPlan.competence || <span className="italic">Sin definir</span>}</span>
                </div>
                <div>
                  <span className="font-bold text-foreground">Estrategia de Evaluación: </span>
                  <span className="text-muted-foreground">{selectedEvaluationPlan.strategy || <span className="italic">Sin definir</span>}</span>
                </div>
                <div>
                  <span className="font-bold text-foreground">Entrega/Lapso: </span>
                  <span className="text-muted-foreground">{selectedEvaluationPlan.due_week || <span className="italic">Sin definir</span>}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-bold text-foreground">Nombre del Tema</Label>
            <Input
              id="title"
              {...register('title')}
              className="bg-background border-border text-sm h-10 text-foreground placeholder:text-muted-foreground"
              placeholder="Ej. Orígenes de Sociología..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="weekLabel" className="text-xs font-bold text-foreground">Etiqueta Visual</Label>
              <Input
                id="weekLabel"
                {...register('weekLabel')}
                className="bg-background border-border text-sm h-10 text-foreground placeholder:text-muted-foreground"
                placeholder="Ej. Semanas 6 y 7"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="colspan" className="text-xs font-bold text-foreground">Agrupación (Columnas)</Label>
              <Input
                id="colspan"
                type="number"
                min="1"
                max="10"
                {...register('colspan', { valueAsNumber: true })}
                className="bg-background border-border text-sm h-10 text-foreground placeholder:text-muted-foreground"
                placeholder="1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contenido" className="text-xs font-bold text-foreground">Contenido (Temas)</Label>
            <Textarea
              id="contenido"
              {...register('contenido')}
              className="bg-background border-border text-sm min-h-[100px] resize-none text-foreground placeholder:text-muted-foreground"
              placeholder="Descripción detallada de los temas..."
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
