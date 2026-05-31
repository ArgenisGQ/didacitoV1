import React from 'react';
import { PlanStatus } from '../../types/lessonPlan';

interface WatermarkOverlayProps {
  status: PlanStatus;
}

export default function WatermarkOverlay({ status }: WatermarkOverlayProps) {
  const isDraft = status === 'DRAFT' || status === 'draft';

  if (!isDraft) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden flex items-center justify-center print:absolute print:inset-0"
      aria-hidden="true"
    >
      <div 
        className="text-[10rem] md:text-[15rem] font-black text-red-600/15 rotate-[-45deg] select-none uppercase tracking-widest whitespace-nowrap"
      >
        BORRADOR
      </div>
    </div>
  );
}
