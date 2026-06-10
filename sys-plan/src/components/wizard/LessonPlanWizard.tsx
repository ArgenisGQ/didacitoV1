import { useEffect, useMemo, useState } from 'react'
import { WizardProvider, useWizard } from '@/context/WizardContext'
import { useAutosave } from '@/hooks/useAutosave'
import api from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Save,
  Clock,
  Eye,
} from 'lucide-react'
import { WizardBasicInfo } from './WizardBasicInfo'
import { WizardObjectives } from './WizardObjectives'
import { WizardWeeklyContent } from './WizardWeeklyContent'
import { WizardEvaluation } from './WizardEvaluation'
import { WizardReview } from './WizardReview'
import { PdfPreviewModal } from '../PdfPreviewModal'
import LessonPlanView from '../LessonPlan/LessonPlanView'
import { LessonPlan } from '../../types/lessonPlan'

const STEP_LABELS = [
  'Datos Generales',
  'Objetivos y Estrategias',
  'Contenido Semanal',
  'Evaluacion',
  'Revision Final',
]

function WizardInner({
  onSave,
  planId,
}: {
  onSave: (data: unknown) => void
  planId: number | null
}) {
  const { step, totalSteps, state, nextStep, prevStep, goToStep } = useWizard()
  const [showPreview, setShowPreview] = useState(false)
  const [showDraftPreview, setShowDraftPreview] = useState(false)
  const [activePlanId, setActivePlanId] = useState<number | null>(planId)

  const { data: academicLoad } = useQuery({
    queryKey: ['academicLoad'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/academic-load')
      return data
    },
  })

  const subject = academicLoad?.subjects?.find((s: any) => s.code === state.subject_code)


  const payload = useMemo(
    () => ({
      title: state.title,
      status: state.status,
      objectives: state.objectives.filter((o) => o?.trim()),
      strategies: state.strategies.filter((s) => s?.trim()),
      evaluation_plans: state.evaluation_plans.filter((e) => 
        e.competence?.trim() || e.due_week || e.weight || e.strategy?.trim() || e.evidence?.trim() || e.instrument?.trim()
      ),
      weekly_contents: state.weekly_contents,
      subject_code: state.subject_code,
      section: state.section,
      academic_period_id: state.academic_period_id,
      modality: state.modality,
      component_type: state.component_type,
      hd_t: state.hd_t,
      hd_lt: state.hd_lt,
      hd_iscp: state.hd_iscp,
      hiv_s: state.hiv_s,
      hiv_a: state.hiv_a,
      hde: state.hde,
    }),
    [state]
  )

  const { saveState, saving, markDirty, forceSave } = useAutosave(
    () => payload,
    {
      planId: activePlanId,
      enabled: activePlanId !== null,
      intervalMs: 10000,
    }
  )

  const saveCurrentStateToDB = async () => {
    try {
      if (activePlanId === null) {
        const { data } = await api.post('/plans', payload)
        setActivePlanId(data.id)
      } else {
        await api.put(`/plans/${activePlanId}`, payload)
      }
    } catch (err) {
      console.error('Error saving plan state:', err)
    }
  }

  const handleNextStep = async () => {
    await saveCurrentStateToDB()
    nextStep()
  }

  const handlePrevStep = async () => {
    await saveCurrentStateToDB()
    prevStep()
  }

  const handleGoToStep = async (i: number) => {
    await saveCurrentStateToDB()
    goToStep(i)
  }

  const handlePreview = async () => {
    await saveCurrentStateToDB()
    setShowPreview(true)
  }

  const isLastStep = step === totalSteps - 1
  const isFirstStep = step === 0

  // Mark dirty when state changes
  useEffect(() => {
    if (activePlanId !== null) markDirty()
  }, [state, activePlanId, markDirty])

  const handleSubmit = () => {
    onSave({ ...payload, planId: activePlanId })
  }

  return (
    <DialogContent className="sm:max-w-4xl h-[92vh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold">
          {planId ? 'Editar Planificacion' : 'Nueva Planificacion'}
        </DialogTitle>
        <DialogDescription>
          Completa los pasos del wizard para disenar tu planificacion didactica.
        </DialogDescription>
      </DialogHeader>

      {/* Progress bar */}
      <div className="flex items-center gap-2 px-2">
        <div className="flex-1 flex items-center gap-1">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
              className="flex-1 group"
              onClick={() => handleGoToStep(i)}
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-full h-1.5 rounded-full transition-all ${
                    i <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider transition-colors hidden sm:block ${
                    i <= step ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </div>
            </button>
          ))}
        </div>
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => { saveCurrentStateToDB().then(() => setShowDraftPreview(true)) }} 
          className="gap-1 font-bold bg-primary/10 text-primary hover:bg-primary/20 text-xs whitespace-nowrap"
        >
          <Eye size={14} />
          Versión Borrador
        </Button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between px-2">
        <Badge variant="outline">
          Paso {step + 1} de {totalSteps}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {saving ? (
            <>
              <span className="animate-pulse">Guardando...</span>
            </>
          ) : saveState ? (
            <>
              <Clock size={12} />
              <span>Guardado {saveState.toLocaleTimeString()}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-1">
        {step === 0 && <WizardBasicInfo />}
        {step === 1 && <WizardObjectives />}
        {step === 2 && <WizardWeeklyContent />}
        {step === 3 && <WizardEvaluation />}
        {step === 4 && <WizardReview />}
      </div>

      {/* Footer navigation */}
      <DialogFooter className="flex-row justify-between items-center sm:justify-between gap-2">
        <div className="flex gap-2">
          {!isFirstStep && (
            <Button variant="outline" onClick={handlePrevStep}>
              <ChevronLeft size={16} /> Anterior
            </Button>
          )}
          {activePlanId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={forceSave}
              disabled={saving}
              className="text-xs gap-1"
            >
              <Save size={14} />
              Guardar borrador
            </Button>
          )}
        </div>

        {isLastStep ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handlePreview} className="gap-2 font-bold bg-muted hover:bg-muted/80">
              Previsualizar Plan
            </Button>
            <Button onClick={handleSubmit} className="gap-2 font-extrabold">
              <Check size={18} strokeWidth={2.5} />
              {activePlanId ? 'Actualizar Planificacion' : 'Crear Planificacion'}
            </Button>
          </div>
        ) : (
          <Button onClick={handleNextStep}>
            Siguiente <ChevronRight size={16} />
          </Button>
        )}
      </DialogFooter>

      {showPreview && (
        <PdfPreviewModal
          title={payload.title || 'Plan de Clase Borrador'}
          draftData={payload}
          planId={undefined}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showDraftPreview && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowDraftPreview(false) }}>
          <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto p-0 bg-gray-100">
            <div className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-50 shadow-sm">
              <h2 className="text-xl font-bold">Versión Borrador</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => window.print()}>
                  Imprimir
                </Button>
                <Button onClick={() => setShowDraftPreview(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
            <div className="p-4">
              <LessonPlanView plan={{
                title: payload.title,
                status: payload.status as any,
                content: {
                  objectives: payload.objectives,
                  strategies: payload.strategies,
                  resources: [],
                  evaluation: ''
                },
                weekly_contents: payload.weekly_contents as any,
                evaluation_plans: payload.evaluation_plans as any,
                author_name: 'Autor Actual',
                subject_code: payload.subject_code ?? undefined,
                section: payload.section ?? undefined,
                subject_purpose: state.subject_purpose ?? undefined,
                pre_requisite: state.pre_requisite ?? undefined,
                program: state.program ?? undefined,
                modality: payload.modality ?? undefined,
                component_type: payload.component_type ?? undefined,
                hd_t: payload.hd_t,
                hd_lt: payload.hd_lt,
                hd_iscp: payload.hd_iscp,
                hiv_s: payload.hiv_s,
                hiv_a: payload.hiv_a,
                hde: payload.hde,
                total_hours: subject?.academic_credits ? subject.academic_credits * 16 : undefined,
                academic_period: academicLoad?.academic_period?.name ?? undefined
              }} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DialogContent>
  )
}

interface LessonPlanWizardProps {
  onClose: () => void
  onSave: (data: any) => void
  initialData?: any
  planId?: number | null
}

export function LessonPlanWizard({
  onClose,
  onSave,
  initialData,
  planId = null,
}: LessonPlanWizardProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <WizardProvider>
        <WizardInitializer initialData={initialData}>
          <WizardInner onSave={onSave} planId={planId} />
        </WizardInitializer>
      </WizardProvider>
    </Dialog>
  )
}

function WizardInitializer({
  initialData,
  children,
}: {
  initialData?: any
  children: React.ReactNode
}) {
  const { setEditingPlan } = useWizard()

  useEffect(() => {
    if (initialData) {
      setEditingPlan(initialData)
    }
  }, [initialData, setEditingPlan])

  return <>{children}</>
}
