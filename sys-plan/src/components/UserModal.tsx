import { useMemo, useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  initialData?: {
    id: number
    email: string
    full_name: string
    role: string
  } | null
}

export default function UserModal({ isOpen, onClose, initialData }: UserModalProps) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData

  const [serverError, setServerError] = useState<string | null>(null)

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email('Correo invalido'),
        full_name: z.string().min(3, 'Nombre muy corto'),
        role: z.enum(['SUPER_ADMIN', 'ADMIN_GESTION', 'COORDINADOR', 'DOCENTE']),
        password: isEditing
          ? z.string().optional().or(z.literal('')).refine((val) => !val || val.length >= 6, {
              message: 'Minimo 6 caracteres',
            })
          : z.string().min(6, 'Minimo 6 caracteres'),
      }),
    [isEditing]
  )

  type FormData = z.infer<typeof schema>

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: initialData?.email || '',
      full_name: initialData?.full_name || '',
      role: (initialData?.role as FormData['role']) || 'DOCENTE',
      password: '',
    },
  })

  useEffect(() => {
    if (isOpen) {
      form.reset({
        email: initialData?.email || '',
        full_name: initialData?.full_name || '',
        role: (initialData?.role as FormData['role']) || 'DOCENTE',
        password: '',
      })
      setServerError(null)
    }
  }, [isOpen, initialData, form.reset])

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      setServerError(null)
      const payload: Record<string, unknown> = {
        email: data.email,
        full_name: data.full_name,
        role: data.role,
      }
      if (data.password && data.password.trim() !== '') {
        payload.password = data.password
      }

      if (isEditing) {
        await api.put(`/users/${initialData!.id}`, payload)
      } else {
        await api.post('/users', payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err: any) => {
      console.error(err)
      const detail = err.response?.data?.detail
      if (detail) {
        if (typeof detail === 'string') {
          setServerError(detail)
        } else if (Array.isArray(detail)) {
          const messages = detail
            .map((d: any) => {
              const field = d.loc ? d.loc[d.loc.length - 1] : ''
              const msg = d.msg || ''
              return field ? `${field}: ${msg}` : msg
            })
            .join(', ')
          setServerError(messages)
        } else {
          setServerError(JSON.stringify(detail))
        }
      } else {
        setServerError(err.message || 'Ocurrió un error al procesar el usuario.')
      }
    }
  })

  const onSubmit = (data: FormData) => mutation.mutate(data)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[480px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
          </DialogTitle>
          <DialogDescription>
            Configura los accesos y privilegios del sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {serverError && (
            <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm font-semibold animate-fadeIn">
              {serverError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre Completo</Label>
            <Input
              id="full_name"
              placeholder="Ej. Juan Perez"
              {...form.register('full_name')}
            />
            {form.formState.errors.full_name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.full_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo Institucional</Label>
            <Input
              id="email"
              type="email"
              placeholder="juan.perez@universidad.edu"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol Asignado</Label>
            <Select
              value={form.watch('role')}
              onValueChange={(v) => form.setValue('role', v as FormData['role'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPER_ADMIN">Super Administrador (IT)</SelectItem>
                <SelectItem value="ADMIN_GESTION">Admin de Gestion</SelectItem>
                <SelectItem value="COORDINADOR">Coordinador</SelectItem>
                <SelectItem value="DOCENTE">Docente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {isEditing
                ? 'Contrasena (dejar en blanco para no cambiar)'
                : 'Contrasena'}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="........"
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Save size={18} />
              )}
              {isEditing ? 'Actualizar Usuario' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
