import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface EvaluationItem {
  unit: number | null
  title?: string
  competence: string
  performance_criterion: string
  strategy: string
  instrument: string
  evaluation_type: string
  evidence: string
  feedback_method: string
  weight: number | string
  due_week: number | string | null
  due_date?: string
}

export interface WeeklyItem {
  week_number: number
  unit_id?: string | null
  unit_content?: string
  content_description: string
  specific_competence?: string
  performance_criteria?: string
  teaching_strategy: string
  evaluation_feedback?: string
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
  subject_code: string | null
  section: string | null
  academic_period_id: number | null
  base_score: number
  modality: string | null
  component_type: string | null
  hd_t: number
  hd_lt: number
  hd_iscp: number
  hiv_s: number
  hiv_a: number
  hde: number
  subject_purpose: string | null
  pre_requisite: string | null
  program: string | null
}

const createEmptyEvaluation = (unitNum: number): EvaluationItem => ({
  unit: unitNum,
  title: '',
  competence: '',
  performance_criterion: '',
  strategy: '',
  instrument: '',
  evaluation_type: '',
  evidence: '',
  feedback_method: '',
  weight: '',
  due_week: '',
  due_date: '',
})

function makeDefaultWeeks(): WeeklyItem[] {
  return Array.from({ length: 12 }, (_, i) => ({
    week_number: i + 1,
    unit_id: null,
    unit_content: '',
    content_description: '',
    specific_competence: '',
    performance_criteria: '',
    teaching_strategy: '',
    evaluation_feedback: '',
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
  updateEvaluationPredictive: (idx: number, strategy: string, rules: Record<string, any>) => void
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
  evaluation_plans: [1, 2, 3, 4].map(createEmptyEvaluation),
  weekly_contents: makeDefaultWeeks(),
  subject_code: null,
  section: null,
  academic_period_id: null,
  base_score: 20,
  modality: null,
  component_type: null,
  hd_t: 0,
  hd_lt: 0,
  hd_iscp: 0,
  hiv_s: 0,
  hiv_a: 0,
  hde: 0,
  subject_purpose: null,
  pre_requisite: null,
  program: null,
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
      evaluation_plans: [...prev.evaluation_plans, createEmptyEvaluation(prev.evaluation_plans.length + 1)],
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

  const updateEvaluationPredictive = useCallback(
    (idx: number, strategy: string, rules: Record<string, any>) => {
      setState((prev) => {
        const copy = [...prev.evaluation_plans]
        const plan = { ...copy[idx], strategy }
        
        const rule = rules[strategy]
        if (rule) {
           if (!plan.evidence && rule.evidence) plan.evidence = rule.evidence
           if (!plan.instrument && rule.instrument) plan.instrument = rule.instrument
           if (!plan.feedback_method && rule.feedback_method) plan.feedback_method = rule.feedback_method
        }
        
        copy[idx] = plan
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
      subject_code: plan.subject_code || null,
      section: plan.section || null,
      academic_period_id: plan.academic_period_id || null,
      base_score: plan.base_score || 20,
      modality: plan.modality || null,
      component_type: plan.component_type || null,
      hd_t: plan.hd_t || 0,
      hd_lt: plan.hd_lt || 0,
      hd_iscp: plan.hd_iscp || 0,
      hiv_s: plan.hiv_s || 0,
      hiv_a: plan.hiv_a || 0,
      hde: plan.hde || 0,
      subject_purpose: plan.subject_purpose || null,
      pre_requisite: plan.pre_requisite || null,
      program: plan.program || null,
      objectives: plan.objectives?.length ? plan.objectives : [''],
      strategies: plan.strategies?.length ? plan.strategies : [''],
      evaluation_plans: (() => {
        const loadedPlans = plan.evaluation_plans || [];
        const plansMap = new Map<number, any>();
        loadedPlans.forEach((ep: any) => {
          if (ep.unit !== null && ep.unit !== undefined) {
            plansMap.set(ep.unit, ep);
          }
        });
        
        return [1, 2, 3, 4].map((unitNum) => {
          const ep = plansMap.get(unitNum);
          if (ep) {
            return {
              unit: unitNum,
              title: ep.title || '',
              competence: ep.competence || '',
              performance_criterion: ep.performance_criteria || ep.performance_criterion || '',
              strategy: ep.strategy || '',
              instrument: ep.instrument || '',
              evaluation_type: ep.evaluation_type || '',
              evidence: ep.evidence || '',
              feedback_method: ep.feedback_method || '',
              weight: ep.weight || '',
              due_week: ep.due_week || '',
              due_date: ep.due_date || '',
            };
          } else {
            return createEmptyEvaluation(unitNum);
          }
        });
      })(),
      weekly_contents: plan.weekly_contents?.length
        ? plan.weekly_contents.map((wc: any) => ({
            week_number: wc.week_number,
            unit_id: wc.unit_id || null,
            unit_content: wc.unit_content || '',
            content_description: wc.content_description || '',
            specific_competence: wc.specific_competence || '',
            performance_criteria: wc.performance_criteria || '',
            teaching_strategy: wc.teaching_strategy || '',
            evaluation_feedback: wc.evaluation_feedback || '',
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
        updateEvaluationPredictive,
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
