import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { CompetenceItem } from './CompetenceItem';
import { Competence } from './types';
import { Target } from 'lucide-react';

interface Props {
  competences: Competence[];
}

export function AvailableCompetencesPanel({ competences }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'available-comps',
  });

  return (
    <div className="flex flex-col h-full bg-card transition-colors duration-200 border-t border-border">
      <div className="p-4 border-b border-border bg-accent/5 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Target size={16} />
          Competencias Disponibles
        </h3>
      </div>
      
      <div 
        ref={setNodeRef}
        className={`flex-1 flex flex-col p-4 overflow-hidden ${isOver ? 'bg-muted/80' : ''}`}
      >
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 pb-4">
          {competences.map((c) => (
            <CompetenceItem key={c.id} competence={c} />
          ))}
          {competences.length === 0 && (
            <div className="text-center text-sm font-medium text-muted-foreground py-10 px-4 border-2 border-dashed border-border rounded-xl">
              Todas las competencias han sido asignadas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
