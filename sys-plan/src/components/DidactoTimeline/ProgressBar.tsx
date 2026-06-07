import React from 'react';
import { Evaluation } from './types';

interface Props {
  evaluations: Evaluation[];
  max?: number;
}

export function ProgressBar({ evaluations, max = 100 }: Props) {
  const current = evaluations.reduce((sum, e) => sum + e.weight, 0);
  const isOverweight = current > max;
  const isComplete = current === max;

  // We want to group evaluations by ID or Title to show unique legend items
  const uniqueEvaluations = Array.from(new Map(evaluations.map(e => [e.id, e])).values());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
          Carga de Evaluación ({current}%)
          {isComplete && <span className="text-emerald-500 text-xs">(Completado)</span>}
          {isOverweight && <span className="text-rose-500 text-xs">(Excede Límite)</span>}
        </h3>
        <div className="flex items-center gap-4">
          {uniqueEvaluations.map(e => (
            <div key={e.id} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: e.color || '#3b82f6' }} />
              {e.title}
            </div>
          ))}
        </div>
      </div>

      <div className="h-4 w-full bg-muted rounded-md overflow-hidden flex relative border border-border">
        {evaluations.map((e, idx) => (
          <div
            key={`${e.id}-${idx}`}
            className="h-full transition-all duration-500 ease-out border-r border-background/20 last:border-r-0 hover:brightness-110"
            style={{ width: `${(e.weight / max) * 100}%`, backgroundColor: e.color || '#3b82f6' }}
            title={`${e.title} (${e.weight}%)`}
          />
        ))}
      </div>
    </div>
  );
}
