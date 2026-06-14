import React from 'react';
import { WeekData } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EvaluationItem } from './EvaluationItem';
import { CompetenceItem } from './CompetenceItem';
import { Edit3, AlertTriangle, Target, CheckSquare, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  week: WeekData;
  onOpen: () => void;
  onDropCompetence?: (comp: string) => void;
  onRemoveCompetence?: (comp: string) => void;
}

export function WeekColumn({ week, onOpen, onDropCompetence, onRemoveCompetence }: Props) {
  // Automatically calculated based on unit mapping
  const [isDragOver, setIsDragOver] = React.useState(false);

  const totalWeight = week.evaluations.reduce((sum, e) => sum + e.weight, 0);
  
  // Highlight if there is a bottleneck (e.g., > 40% in a single week is excessive)
  const isHighWeight = totalWeight >= 40;
  const isHighQuantity = week.evaluations.length >= 3;
  const isMissingContent = totalWeight > 0 && (!week.contenido || !week.recursosAprendizaje);
  const isBottleneck = isHighWeight || isHighQuantity || isMissingContent;

  const weekCompetences = React.useMemo(() => {
    if (!week.contenido) return [];
    return week.contenido
      .split('.')
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0);
  }, [week.contenido]);

  const getBottleneckReasons = () => {
    const reasons = [];
    if (isHighWeight) reasons.push(`• El peso de evaluación (${totalWeight}%) supera el umbral recomendado (< 40%).`);
    if (isHighQuantity) reasons.push(`• Exceso de hitos (${week.evaluations.length} en una sola semana).`);
    if (isMissingContent) reasons.push(`• Hay evaluaciones programadas pero faltan temas o recursos de estudio.`);
    return reasons;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const comp = e.dataTransfer.getData('text/plain');
    if (comp && onDropCompetence) {
      onDropCompetence(comp);
    }
  };

  return (
    <Card
      onClick={onOpen}
      className={`h-full bg-card border-border text-card-foreground flex flex-col cursor-pointer transition-all duration-200 group hover:bg-muted/30 hover:border-border/80
        ${isBottleneck ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : ''}
      `}
    >
      <CardHeader className="pb-3 border-b border-border/50 group-hover:border-border transition-colors">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-bold tracking-tight text-foreground flex flex-col">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">{week.weekLabel || `Semana ${week.weekNumber}`}</span>
            {week.unitTitle || 'Unidad no asignada'}
          </CardTitle>
          <div className="bg-muted p-1.5 rounded-md text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
            <Edit3 size={16} />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
        {isBottleneck && (
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs p-2 rounded-md font-bold flex items-center gap-2 cursor-help transition-colors hover:bg-amber-500/20">
                  <AlertTriangle size={14} />
                  Cuello de botella detectado
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[250px] p-3 shadow-lg border-amber-500/30">
                <p className="font-bold text-sm mb-1.5 text-foreground">Motivos de la advertencia:</p>
                <div className="text-xs space-y-1 text-muted-foreground font-medium">
                  {getBottleneckReasons().map((reason, idx) => (
                    <p key={idx}>{reason}</p>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Resumen abstracto */}
        <div className="space-y-3 flex-1">
          
          {/* Zona de Competencias */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mt-2 p-2.5 rounded-lg border-2 border-dashed transition-all duration-200 ${
              isDragOver 
                ? 'border-primary bg-primary/5 shadow-sm scale-[1.02]' 
                : 'border-border/60 hover:border-border'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Target size={12}/> Contenido</p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-accent/10">{weekCompetences.length}</Badge>
            </div>
            <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
              {weekCompetences.map((comp, idx) => (
                <div key={idx} className="group/item relative p-2.5 bg-background border border-border rounded-lg shadow-sm flex items-start gap-2">
                  <p className="text-xs font-semibold text-foreground/80 leading-normal flex-1">
                    {comp}
                  </p>
                  {onRemoveCompetence && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveCompetence(comp);
                      }}
                      className="text-muted-foreground hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                      title="Eliminar contenido"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {weekCompetences.length === 0 && (
                <div className="h-[40px] flex items-center justify-center p-2 text-[10px] font-medium text-muted-foreground text-center leading-normal">
                  Arrastra contenidos aquí
                </div>
              )}
            </div>
          </div>

          {/* Competencia Específica */}
          {week.specificCompetence && (
            <div className="border-l-2 border-primary/30 pl-2 py-0.5 space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Competencia Específica</p>
              <p className="text-xs font-semibold text-foreground/85 line-clamp-4 leading-relaxed">
                {week.specificCompetence}
              </p>
            </div>
          )}

          {/* Criterios de Desempeño */}
          {week.criteriosDesempeno && (
            <div className="border-l-2 border-primary/30 pl-2 py-0.5 space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Criterios de Desempeño</p>
              <p className="text-xs font-semibold text-foreground/85 line-clamp-4 leading-relaxed">
                {week.criteriosDesempeno}
              </p>
            </div>
          )}
          {/* Estrategias Didácticas */}
          {week.estrategiasDidacticas && (
            <div className="border-l-2 border-primary/30 pl-2 py-0.5 space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Estrategias Didácticas</p>
              <p className="text-xs font-semibold text-foreground/85 line-clamp-4 leading-relaxed">
                {week.estrategiasDidacticas}
              </p>
            </div>
          )}

          {/* Recursos de Aprendizaje */}
          {week.recursosAprendizaje && (
            <div className="border-l-2 border-primary/30 pl-2 py-0.5 space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recursos de Aprendizaje</p>
              <p className="text-xs font-semibold text-foreground/85 line-clamp-4 leading-relaxed">
                {week.recursosAprendizaje}
              </p>
            </div>
          )}

          {/* Bibliografía */}
          {week.bibliografia && (
            <div className="border-l-2 border-primary/30 pl-2 py-0.5 space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bibliografía</p>
              <p className="text-xs font-semibold text-foreground/85 line-clamp-4 leading-relaxed">
                {week.bibliografia}
              </p>
            </div>
          )}
        </div>

        {/* Zona de Evaluaciones */}
        <div className={`mt-auto pt-4 border-t border-border/50 ${isBottleneck ? 'border-amber-500/30' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><CheckSquare size={12}/> Evaluación</p>
            {totalWeight > 0 && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isBottleneck ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                {totalWeight}% Peso
              </Badge>
            )}
          </div>
          <div className="space-y-2 min-h-[60px]">
            {week.evaluations.map((e) => (
              <EvaluationItem key={e.id} evaluation={e} />
            ))}
            {week.evaluationFeedback && (
              <div className="p-2.5 bg-muted/40 border border-border/50 rounded-lg text-xs font-semibold text-foreground/80 leading-normal">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Otras Evaluaciones</span>
                {week.evaluationFeedback}
              </div>
            )}
            {week.evaluations.length === 0 && !week.evaluationFeedback && (
              <div className="h-[60px] flex items-center justify-center border-2 border-dashed border-border rounded-lg p-3 text-xs font-medium text-muted-foreground transition-colors group-hover:border-border/80">
                Sin evaluación programada
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
