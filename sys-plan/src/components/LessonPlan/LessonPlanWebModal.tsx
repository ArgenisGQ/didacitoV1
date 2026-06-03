import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import LessonPlanView from './LessonPlanView';
import { LessonPlan } from '../../types/lessonPlan';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api-client';
import { Bot, CheckCircle, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LessonPlanWebModalProps {
  plan: LessonPlan;
  onClose: () => void;
}

export function LessonPlanWebModal({ plan, onClose }: LessonPlanWebModalProps) {
  const { data: aiEvaluation, isLoading: isLoadingAI } = useQuery({
    queryKey: ['ai-evaluation', plan.id],
    queryFn: async () => {
      const { data } = await api.get(`/ai/evaluation/${plan.id}`);
      return data;
    },
    enabled: plan.status === 'IN_REVIEW' || plan.status === 'APPROVED' || plan.status === 'OBSERVED',
    retry: false
  });

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-[#e6f0fa]">
        <DialogHeader className="px-6 py-4 border-b bg-white shrink-0 shadow-sm z-10 flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Versión Borrador: {plan.title || plan.subject_code}
          </DialogTitle>
          <div className="flex gap-2">
            <Badge variant="secondary" className="px-3 py-1 font-bold">
              ID: {plan.id}
            </Badge>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Main Plan View */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="bg-white shadow-xl max-w-[900px] mx-auto border border-gray-200 print:shadow-none print:border-none">
              <LessonPlanView plan={plan} />
            </div>
          </div>

          {/* AI Sidebar */}
          {(plan.status === 'IN_REVIEW' || plan.status === 'APPROVED' || plan.status === 'OBSERVED') && (
            <div className="w-[400px] border-l bg-white flex flex-col shrink-0 shadow-xl z-10">
              <div className="p-4 border-b bg-muted/20 flex items-center gap-3">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-xl">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Análisis de IA</h3>
                  <p className="text-xs text-muted-foreground">Revisión Automática del Sinóptico</p>
                </div>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                {isLoadingAI ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                    <p className="text-sm font-semibold">Generando evaluación de IA...</p>
                  </div>
                ) : !aiEvaluation ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                    <AlertCircle className="text-amber-500" size={32} />
                    <p className="text-sm font-semibold text-center">No hay evaluación disponible para este plan.</p>
                  </div>
                ) : aiEvaluation.status === 'PROCESSING' ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                    <p className="text-sm font-semibold">La IA está evaluando este plan. Vuelve en un momento...</p>
                  </div>
                ) : aiEvaluation.status === 'ERROR' ? (
                  <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                    <div className="flex items-center gap-2 text-red-600 font-bold mb-2">
                      <AlertTriangle size={18} />
                      <p>Error en la evaluación</p>
                    </div>
                    <p className="text-sm text-red-800">{aiEvaluation.error_message}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Status Badge */}
                    <div className={`p-4 rounded-xl border flex items-start gap-3 ${aiEvaluation.result_data?.cumple_objetivos ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                      {aiEvaluation.result_data?.cumple_objetivos ? (
                        <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                      ) : (
                        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                      )}
                      <div>
                        <h4 className="font-bold text-sm">
                          {aiEvaluation.result_data?.cumple_objetivos ? 'Cumple con el Programa Sinóptico' : 'Presenta desviaciones importantes'}
                        </h4>
                        <p className="text-xs opacity-80 mt-1">
                          Evaluado el {new Date(aiEvaluation.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Observaciones */}
                    {aiEvaluation.result_data?.observaciones && aiEvaluation.result_data.observaciones.length > 0 && (
                      <div>
                        <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">Observaciones</h4>
                        <ul className="space-y-2">
                          {aiEvaluation.result_data.observaciones.map((obs: string, idx: number) => (
                            <li key={idx} className="bg-muted/30 p-3 rounded-lg text-sm border">
                              {obs}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recomendaciones */}
                    {aiEvaluation.result_data?.recomendaciones && aiEvaluation.result_data.recomendaciones.length > 0 && (
                      <div>
                        <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">Recomendaciones</h4>
                        <ul className="space-y-2">
                          {aiEvaluation.result_data.recomendaciones.map((rec: string, idx: number) => (
                            <li key={idx} className="bg-blue-50/50 p-3 rounded-lg text-sm border border-blue-100 text-blue-900">
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
