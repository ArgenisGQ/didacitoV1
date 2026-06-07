import React from 'react';
import { Competence } from './types';
import { Target } from 'lucide-react';

interface Props {
  competence: Competence;
  isOverlay?: boolean;
}

export function CompetenceItem({ competence, isOverlay }: Props) {
  return (
    <div
      className={`group relative flex items-start gap-3 p-3 bg-background border border-border rounded-lg shadow-sm hover:border-primary/50 hover:shadow-md transition-all`}
    >
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Target size={14} className="text-blue-500" />
          <span className="font-bold text-xs uppercase text-foreground">Competencia</span>
        </div>
        <p className="text-sm font-medium text-foreground/80 line-clamp-2 leading-tight">
          {competence.description}
        </p>
      </div>
    </div>
  );
}
