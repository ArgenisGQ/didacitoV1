import { useEffect, useRef, useState } from 'react'
import api from '../lib/api-client'

interface AutosaveOptions {
  planId: number | null
  enabled: boolean
  intervalMs?: number
}

export function useAutosave(serialize: () => unknown, options: AutosaveOptions) {
  const { planId, enabled, intervalMs = 8000 } = options
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const markDirty = () => {
    dirtyRef.current = true
  }

  useEffect(() => {
    if (!enabled || planId === null) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(async () => {
      if (!dirtyRef.current) return
      dirtyRef.current = false
      setSaving(true)
      try {
        const payload = serialize()
        await api.put(`/plans/${planId}`, { ...(payload as any), status: 'DRAFT' })
        setLastSaved(new Date())
      } catch {
        dirtyRef.current = true
      } finally {
        setSaving(false)
      }
    }, intervalMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [enabled, planId, intervalMs, serialize])

  const forceSave = async () => {
    if (planId === null) return
    dirtyRef.current = false
    setSaving(true)
    try {
      await api.put(`/plans/${planId}`, { ...(serialize() as any), status: 'DRAFT' })
      setLastSaved(new Date())
    } finally {
      setSaving(false)
    }
  }

  return { saveState: lastSaved, saving, markDirty, forceSave }
}
