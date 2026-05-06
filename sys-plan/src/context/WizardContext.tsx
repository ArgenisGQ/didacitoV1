import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface EvaluationItem {
  unit: number | null
  competence: string
  strategy: string
  instrument: string
  evidence: string
  feedback_method: string
  weight: number
  due_week: number | null
}

export interface WeeklyItem {
  week_number: number
  content_description: string
  teaching_strategy: string
  resources: string
  bibliography: string
}

export interface WizardState {
  title: string
  program_id: number | null
  status: string
  objectives: string[]
  strategies: string[]
  evaluation_plans: EvaluationItem[]
  weekly_contents: WeeklyItem[]
}

const EMPTY_EVALUATION: EvaluationItem = {
  unit: null,
  competence: '',
  strategy: '',
  instrument: '',
  evidence: '',
  feedback_method: '',
  weight: 0,
  due_week: null,
}

function makeDefaultWeeks(): WeeklyItem[] {
  return Array.from({ length: 12 }, (_, i) => ({
    week_number: i + 1,
    content_description: '',
    teaching_strategy: '',
    resources: '',
    bibliography: '',
  }))
}

interface WizardContextType {
  step: number
  totalSteps: number
  state: WizardState
  updateField: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (s: number) => void
  addEvaluationItem: () => void
  removeEvaluationItem: (idx: number) => void
  updateEvaluationItem: (idx: number, field: keyof EvaluationItem, value: any) => void
  updateWeekItem: (idx: number, field: keyof WeeklyItem, value: string) => void
  setEditingPlan: (plan: any) => void
  reset: () => void
}

const WizardContext = createContext<WizardContextType | null>(null)

const TOTAL_STEPS = 5

const initialState: WizardState = {
  title: '',
  program_id: null,
  status: 'DRAFT',
  objectives: [''],
  strategies: [''],
  evaluation_plans: [EMPTY_EVALUATION],
  weekly_contents: makeDefaultWeeks(),
}

export function WizardProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(initialState)

  const reset = useCallback(() => {
    setStep(0)
    setState(initialState)
  }, [])

  const updateField = useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const nextStep = useCallback(() => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  }, [])

  const prevStep = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0))
  }, [])

  const goToStep = useCallback((s: number) => {
    setStep(Math.max(0, Math.min(s, TOTAL_STEPS - 1)))
  }, [])

  const addEvaluationItem = useCallback(() => {
    setState((prev) => ({
      ...prev,
      evaluation_plans: [...prev.evaluation_plans, { ...EMPTY_EVALUATION }],
    }))
  }, [])

  const removeEvaluationItem = useCallback((idx: number) => {
    setState((prev) => ({
      ...prev,
      evaluation_plans: prev.evaluation_plans.filter((_, i) => i !== idx),
    }))
  }, [])

  const updateEvaluationItem = useCallback(
    (idx: number, field: keyof EvaluationItem, value: any) => {
      setState((prev) => {
        const copy = [...prev.evaluation_plans]
        copy[idx] = { ...copy[idx], [field]: value }
        return { ...prev, evaluation_plans: copy }
      })
    },
    []
  )

  const updateWeekItem = useCallback(
    (idx: number, field: keyof WeeklyItem, value: string) => {
      setState((prev) => {
        const copy = [...prev.weekly_contents]
        copy[idx] = { ...copy[idx], [field]: value }
        return { ...prev, weekly_contents: copy }
      })
    },
    []
  )

  const setEditingPlan = useCallback((plan: any) => {
    setStep(0)
    setState({
      title: plan.title || '',
      program_id: plan.program_id || null,
      status: plan.status || 'DRAFT',
      objectives: plan.objectives?.length ? plan.objectives : [''],
      strategies: plan.strategies?.length ? plan.strategies : [''],
      evaluation_plans: plan.evaluation_plans?.length
        ? plan.evaluation_plans.map((ep: any) => ({
            unit: ep.unit ?? null,
            competence: ep.competence || '',
            strategy: ep.strategy || '',
            instrument: ep.instrument || '',
            evidence: ep.evidence || '',
            feedback_method: ep.feedback_method || '',
            weight: ep.weight ?? 0,
            due_week: ep.due_week ?? null,
          }))
        : [EMPTY_EVALUATION],
      weekly_contents: plan.weekly_contents?.length
        ? plan.weekly_contents.map((wc: any) => ({
            week_number: wc.week_number,
            content_description: wc.content_description || '',
            teaching_strategy: wc.teaching_strategy || '',
            resources: wc.resources || '',
            bibliography: wc.bibliography || '',
          }))
        : makeDefaultWeeks(),
    })
  }, [])

  return (
    <WizardContext.Provider
      value={{
        step,
        totalSteps: TOTAL_STEPS,
        state,
        updateField,
        nextStep,
        prevStep,
        goToStep,
        addEvaluationItem,
        removeEvaluationItem,
        updateEvaluationItem,
        updateWeekItem,
        setEditingPlan,
        reset,
      }}
    >
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard() {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error('useWizard must be used within WizardProvider')
  return ctx
}
