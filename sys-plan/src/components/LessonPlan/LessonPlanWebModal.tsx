import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import LessonPlanView from './LessonPlanView';
import { LessonPlan } from '../../types/lessonPlan';

interface LessonPlanWebModalProps {
  plan: LessonPlan;
  onClose: () => void;
}

export function LessonPlanWebModal({ plan, onClose }: LessonPlanWebModalProps) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-[#e6f0fa]">
        <DialogHeader className="px-6 py-4 border-b bg-white shrink-0 shadow-sm z-10">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Versión Borrador: {plan.title || plan.subject_code}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 bg-[#e6f0fa]/20 p-4 sm:p-8 overflow-y-auto">
          <div className="bg-white shadow-xl max-w-[1000px] mx-auto border border-gray-200 print:shadow-none print:border-none">
            {/* The LessonPlanView will handle its own formatting and the Watermark if it's draft */}
            <LessonPlanView plan={plan} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
