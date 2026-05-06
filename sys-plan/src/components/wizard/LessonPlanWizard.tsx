import { useEffect, useMemo } from 'react'
import { WizardProvider, useWizard } from '@/context/WizardContext'
import { useAutosave } from '@/hooks/useAutosave'
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

  const payload = useMemo(
    () => ({
      title: state.title,
      status: state.status,
      objectives: state.objectives.filter((o) => o.trim()),
      strategies: state.strategies.filter((s) => s.trim()),
      evaluation_plans: state.evaluation_plans.filter((e) => e.competence.trim()),
      weekly_contents: state.weekly_contents.filter((w) => w.content_description.trim()),
    }),
    [state]
  )

  const { saveState, saving, markDirty, forceSave } = useAutosave(
    () => payload,
    {
      planId,
      enabled: planId !== null,
      intervalMs: 10000,
    }
  )

  const isLastStep = step === totalSteps - 1
  const isFirstStep = step === 0

  // Mark dirty when state changes
  useEffect(() => {
    if (planId !== null) markDirty()
  }, [state, planId, markDirty])

  const handleSubmit = () => {
    onSave({ ...payload, planId })
  }

  return (
    <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col">
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
            onClick={() => goToStep(i)}
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
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft size={16} /> Anterior
            </Button>
          )}
          {planId && (
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
          <Button onClick={handleSubmit} className="gap-2 font-extrabold">
            <Check size={18} strokeWidth={2.5} />
            {planId ? 'Actualizar Planificacion' : 'Crear Planificacion'}
          </Button>
        ) : (
          <Button onClick={nextStep}>
            Siguiente <ChevronRight size={16} />
          </Button>
        )}
      </DialogFooter>
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
