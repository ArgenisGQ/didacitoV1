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
  userRole?: string | null;
  onApprove?: (planId: number) => void;
  onObserve?: (planId: number, feedback: string) => void;
}

export function LessonPlanWebModal({ plan, onClose, userRole, onApprove, onObserve }: LessonPlanWebModalProps) {
  const [localFeedback, setLocalFeedback] = React.useState('');
  const { data: aiEvaluation, isLoading: isLoadingAI } = useQuery({
    queryKey: ['ai-evaluation', plan.id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/ai/evaluation/${plan.id}/`);
        return data;
      } catch (err: any) {
        return {
          status: 'FETCH_ERROR',
          statusCode: err.response?.status,
          message: err.response?.data?.detail || err.response?.data?.error || err.message
        };
      }
    },
    enabled: plan.status === 'IN_REVIEW' || plan.status === 'APPROVED' || plan.status === 'OBSERVED',
    refetchInterval: (query) => {
      const data = query?.state?.data as any;
      return data?.status === 'PROCESSING' ? 3000 : false;
    },
    retry: false
  });

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-secondary/30">
        <DialogHeader className="px-6 py-4 border-b bg-background shrink-0 shadow-sm z-10 flex flex-row items-center justify-between">
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="bg-background shadow-xl max-w-[1100px] mx-auto border border-border print:shadow-none print:border-none">
              <LessonPlanView plan={plan} />
            </div>
          </div>

          {/* AI Sidebar */}
          {(plan.status === 'IN_REVIEW' || plan.status === 'APPROVED' || plan.status === 'OBSERVED') && (
            <div className="w-[400px] border-l bg-background flex flex-col shrink-0 shadow-xl z-10">
              <div className="p-4 border-b bg-muted/20 flex items-center gap-3">
                <div className="bg-primary/10 text-primary p-2 rounded-xl">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Análisis de IA</h3>
                  <p className="text-xs text-muted-foreground">Revisión Automática del Sinóptico</p>
                </div>
              </div>

              {/* Progress Bar Component */}
              {(() => {
                let width = '0%';
                let colorClass = 'bg-muted';
                let label = 'Desconectado';
                let description = 'Servicio no disponible';

                if (isLoadingAI) {
                  width = '30%';
                  colorClass = 'bg-blue-500 animate-pulse';
                  label = 'Conectando...';
                  description = 'Estableciendo comunicación';
                } else if (aiEvaluation) {
                  if (aiEvaluation.status === 'PROCESSING') {
                    width = '65%';
                    colorClass = 'bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse';
                    label = 'IA Analizando...';
                    description = 'Evaluando coherencia pedagógica';
                  } else if (aiEvaluation.status === 'SUCCESS') {
                    width = '100%';
                    colorClass = 'bg-emerald-500';
                    label = 'Análisis Completado';
                    description = 'Revisión finalizada con éxito';
                  } else if (aiEvaluation.status === 'ERROR') {
                    width = '100%';
                    colorClass = 'bg-rose-500';
                    label = 'Error en el Análisis';
                    description = aiEvaluation.error_message || 'Fallo durante el procesamiento';
                  } else if (aiEvaluation.status === 'FETCH_ERROR') {
                    if (aiEvaluation.statusCode === 400) {
                      width = '100%';
                      colorClass = 'bg-amber-500';
                      label = 'IA no activa para análisis';
                      description = 'El proveedor de IA no está activo';
                    } else {
                      width = '100%';
                      colorClass = 'bg-rose-500';
                      label = 'IA no activa en el servidor';
                      description = 'No se pudo conectar con el servidor de IA';
                    }
                  }
                }

                return (
                  <div className="px-4 py-2.5 border-b bg-muted/5 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">{label}</span>
                      <span className="text-muted-foreground text-[10px] truncate max-w-[200px]" title={description}>{description}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width }} />
                    </div>
                  </div>
                );
              })()}
              
              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                {isLoadingAI ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                    <p className="text-sm font-semibold">Generando evaluación de IA...</p>
                  </div>
                ) : !aiEvaluation ? (
                  plan.feedback ? (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-xl border flex items-start gap-3 ${plan.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                        {plan.status === 'APPROVED' ? (
                          <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                        ) : (
                          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                        )}
                        <div>
                          <h4 className="font-bold text-sm">
                            {plan.status === 'APPROVED' ? 'Cumple con el Programa Sinóptico' : 'Presenta observaciones pedagógicas'}
                          </h4>
                          <p className="text-xs opacity-80 mt-1">
                            Análisis guardado en el Plan
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted/40 p-4 rounded-xl border space-y-2">
                        <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Feedback y Directrices de la IA</h4>
                        <div className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                          {plan.feedback}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                      <AlertCircle className="text-amber-500" size={32} />
                      <p className="text-sm font-semibold text-center">No hay evaluación disponible para este plan.</p>
                    </div>
                  )
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
                ) : aiEvaluation.status === 'FETCH_ERROR' ? (
                  <div className={`p-4 rounded-xl border flex flex-col gap-2 ${aiEvaluation.statusCode === 400 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <AlertTriangle className={aiEvaluation.statusCode === 400 ? 'text-amber-600' : 'text-red-600'} size={18} />
                      <p>{aiEvaluation.statusCode === 400 ? 'IA no activa para análisis' : 'IA no activa en el servidor'}</p>
                    </div>
                    <p className="text-xs opacity-90">{aiEvaluation.message || 'Por favor contacte al administrador del sistema.'}</p>
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

              {/* Coordinator Actions */}
              {onApprove && onObserve && plan.status === 'IN_REVIEW' && (userRole === 'COORDINADOR' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_GESTION') && (
                <div className="p-4 border-t bg-muted/40 space-y-4 shrink-0 shadow-lg">
                  <h4 className="font-bold text-sm text-card-foreground">Dictamen del Coordinador</h4>
                  <textarea
                    placeholder="Escribe observaciones para devolver el plan (requerido para corregir)..."
                    value={localFeedback}
                    onChange={(e) => setLocalFeedback(e.target.value)}
                    className="w-full min-h-[90px] p-2 text-sm rounded-lg border border-border bg-background resize-none focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (window.confirm('¿Estás seguro de devolver este plan para correcciones?')) {
                          onObserve(plan.id!, localFeedback);
                        }
                      }}
                      disabled={!localFeedback.trim()}
                      className="flex-1 py-2 px-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shadow"
                    >
                      Corregir (Observar)
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('¿Estás seguro de aprobar este plan?')) {
                          onApprove(plan.id!);
                        }
                      }}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow"
                    >
                      Aceptar (Aprobar)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
