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
        <p className="text-xs font-semibold text-foreground/80 line-clamp-3 leading-normal">
          {competence.description}
        </p>
      </div>
    </div>
  );
}
