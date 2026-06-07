import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Save } from 'lucide-react'
import api from '../lib/api-client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AcademicLoadModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    id: number
    full_name: string
    subject_code?: string | null
    section?: string | null
  } | null
}

const schema = z.object({
  subject_code: z.string().optional().or(z.literal('')),
  section: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

export default function AcademicLoadModal({ isOpen, onClose, user }: AcademicLoadModalProps) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject_code: user?.subject_code || '',
      section: user?.section || '',
    },
  })

  useEffect(() => {
    if (isOpen && user) {
      form.reset({
        subject_code: user.subject_code || '',
        section: user.section || '',
      })
      setServerError(null)
    }
  }, [isOpen, user, form])

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      setServerError(null)
      const payload = {
        subject_code: data.subject_code || null,
        section: data.section || null,
      }
      await api.put(`/users/${user!.id}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Error al actualizar la carga académica'
      setServerError(msg)
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate(data)
  }

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Carga Académica</DialogTitle>
          <DialogDescription>
            Asignar materias y secciones a: <strong>{user.full_name}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          {serverError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
              {serverError}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject_code">Código(s) de Materia</Label>
              <Input
                id="subject_code"
                placeholder="Ej. MAT101, FIS202"
                {...form.register('subject_code')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="section">Sección(es)</Label>
              <Input
                id="section"
                placeholder="Ej. A, B"
                {...form.register('section')}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
