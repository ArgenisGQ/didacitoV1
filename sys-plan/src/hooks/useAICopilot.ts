import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api-client'

export interface CopilotStatus {
  has_assigned_agent: boolean
  attempts_used: number
  attempts_remaining: number
}

export function useAICopilot(subjectCode: string | null, section: string | null) {
  const [localAttemptsUsed, setLocalAttemptsUsed] = useState<number | null>(null)
  const [suggestingObjectives, setSuggestingObjectives] = useState(false)
  const [suggestingFullPlan, setSuggestingFullPlan] = useState(false)

  // Query copilot status
  const { data: statusData, refetch: refetchStatus, isLoading } = useQuery<CopilotStatus>({
    queryKey: ['copilotStatus', subjectCode, section],
    queryFn: async () => {
      if (!subjectCode || !section) {
        return { has_assigned_agent: false, attempts_used: 0, attempts_remaining: 0 }
      }
      const { data } = await api.get('/plans/suggest/status', {
        params: { subject_code: subjectCode, section },
      })
      setLocalAttemptsUsed(data.attempts_used)
      return data
    },
    enabled: !!subjectCode && !!section,
  })

  const attemptsUsed = localAttemptsUsed ?? statusData?.attempts_used ?? 0
  const attemptsRemaining = Math.max(0, 2 - attemptsUsed)
  const hasAssignedAgent = statusData?.has_assigned_agent ?? false
  const limitReached = attemptsUsed >= 2

  const suggestObjectives = useCallback(async () => {
    if (!subjectCode || !section) return null
    if (limitReached) {
      throw new Error('Has alcanzado el límite de 2 sugerencias de IA para esta asignatura.')
    }
    setSuggestingObjectives(true)
    try {
      const { data } = await api.post('/ai/suggest-objectives/', {
        subject_code: subjectCode,
        section,
      })
      setLocalAttemptsUsed((prev) => (prev !== null ? prev + 1 : 1))
      refetchStatus()
      return data
    } finally {
      setSuggestingObjectives(false)
    }
  }, [subjectCode, section, limitReached, refetchStatus])

  const suggestFullPlan = useCallback(async (modality: string) => {
    if (!subjectCode || !section) return null
    if (limitReached) {
      throw new Error('Has alcanzado el límite de 2 sugerencias de IA para esta asignatura.')
    }
    setSuggestingFullPlan(true)
    try {
      const { data } = await api.post('/ai/suggest-full-plan/', {
        subject_code: subjectCode,
        section,
        modality,
      })
      setLocalAttemptsUsed((prev) => (prev !== null ? prev + 1 : 1))
      refetchStatus()
      return data
    } finally {
      setSuggestingFullPlan(false)
    }
  }, [subjectCode, section, limitReached, refetchStatus])

  return {
    isLoading,
    hasAssignedAgent,
    attemptsUsed,
    attemptsRemaining,
    limitReached,
    suggestingObjectives,
    suggestingFullPlan,
    suggestObjectives,
    suggestFullPlan,
    refetchStatus,
  }
}
