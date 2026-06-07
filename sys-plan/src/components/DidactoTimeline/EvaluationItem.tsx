import React from 'react';
import { Evaluation } from './types';

interface Props {
  evaluation: Evaluation;
  isOverlay?: boolean;
}

export function EvaluationItem({ evaluation, isOverlay }: Props) {
  return (
    <div
      className={`group relative flex items-center gap-3 p-3 bg-card border border-border rounded-lg transition-colors shadow-sm select-none`}
    >

      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{evaluation.title}</p>
        {evaluation.description && (
          <p className="text-[10px] text-muted-foreground truncate">{evaluation.description}</p>
        )}
      </div>

      <div className="flex-shrink-0">
        <span 
          className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-black ring-1 ring-inset ${!evaluation.color ? 'bg-rose-500/10 text-rose-500 ring-rose-500/20' : ''}`}
          style={evaluation.color ? { backgroundColor: `${evaluation.color}1A`, color: evaluation.color, borderColor: `${evaluation.color}33` } : undefined}
        >
          {evaluation.weight}%
        </span>
      </div>
    </div>
  );
}
