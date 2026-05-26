import { useEffect, useMemo, useState } from 'react'
import { WizardProvider, useWizard } from '@/context/WizardContext'
import { useAutosave } from '@/hooks/useAutosave'
import api from '@/lib/api-client'
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
} from 'lucide-react'
import { WizardBasicInfo } from './WizardBasicInfo'
import { WizardObjectives } from './WizardObjectives'
import { WizardWeeklyContent } from './WizardWeeklyContent'
import { WizardEvaluation } from './WizardEvaluation'
import { WizardReview } from './WizardReview'
import { PdfPreviewModal } from '../PdfPreviewModal'

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
  const [activePlanId, setActivePlanId] = useState<number | null>(planId)

  const payload = useMemo(
    () => ({
      title: state.title,
      status: state.status,
      objectives: state.objectives.filter((o) => o.trim()),
      strategies: state.strategies.filter((s) => s.trim()),
      evaluation_plans: state.evaluation_plans.filter((e) => e.competence.trim()),
      weekly_contents: state.weekly_contents.filter((w) => w.content_description.trim()),
      subject_code: state.subject_code,
      section: state.section,
      academic_period_id: state.academic_period_id,
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
      <div className="flex items-center gap-1 px-2">
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
