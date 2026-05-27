import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
    roles?: string[]
    is_active?: boolean
    academic_period_id?: number | null
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
        roles: z.array(z.string()).min(1, 'Seleccione al menos un rol'),
        password: isEditing
          ? z.string().optional().or(z.literal('')).refine((val) => !val || val.length >= 6, {
              message: 'Minimo 6 caracteres',
            })
          : z.string().min(6, 'Minimo 6 caracteres'),
        is_active: z.boolean().optional(),
        academic_period_id: z.string().optional().or(z.literal('')),
      }),
    [isEditing]
  )

  type FormData = z.infer<typeof schema>

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: initialData?.email || '',
      full_name: initialData?.full_name || '',
      roles: initialData?.roles || [],
      password: '',
      is_active: initialData?.is_active ?? true,
      academic_period_id: initialData?.academic_period_id ? String(initialData.academic_period_id) : 'none',
    },
  })

  useEffect(() => {
    if (isOpen) {
      form.reset({
        email: initialData?.email || '',
        full_name: initialData?.full_name || '',
        roles: initialData?.roles || [],
        password: '',
        is_active: initialData?.is_active ?? true,
        academic_period_id: initialData?.academic_period_id ? String(initialData.academic_period_id) : 'none',
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
        roles: data.roles,
      }
      if (data.password && data.password.trim() !== '') {
        payload.password = data.password
      }
      if (isEditing && data.is_active !== undefined) {
        payload.is_active = data.is_active
      }
      if (data.academic_period_id && data.academic_period_id !== 'none') {
        payload.academic_period_id = parseInt(data.academic_period_id, 10)
      } else {
        payload.academic_period_id = null
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
  
  const { data: periods = [] } = useQuery<any[]>({
    queryKey: ['academic-periods-dropdown'],
    queryFn: async () => {
      const { data } = await api.get('/academic-periods')
      return data
    },
    enabled: isOpen
  })

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
            <Label htmlFor="roles">Roles Asignados</Label>
            <div className="flex flex-col gap-2 p-4 border rounded-md max-h-48 overflow-y-auto bg-card">
              {['SUPER_ADMIN', 'ADMIN_GESTION', 'COORDINADOR', 'DOCENTE'].map((roleKey) => {
                const currentRoles = form.watch('roles') || [];
                const isSelected = currentRoles.includes(roleKey);
                
                return (
                  <label key={roleKey} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted/50 rounded-md transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          form.setValue('roles', [...currentRoles, roleKey]);
                        } else {
                          form.setValue('roles', currentRoles.filter(r => r !== roleKey));
                        }
                      }}
                    />
                    <span className="text-sm font-medium">{roleKey.replace('_', ' ')}</span>
                  </label>
                )
              })}
            </div>
            {form.formState.errors.roles && (
              <p className="text-sm text-destructive">
                {form.formState.errors.roles.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="academic_period_id">Periodo Académico</Label>
            <Select
              value={form.watch('academic_period_id') || 'none'}
              onValueChange={(v) => form.setValue('academic_period_id', v)}
            >
              <SelectTrigger id="academic_period_id">
                <SelectValue placeholder="Seleccionar periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguno / Sin asignar</SelectItem>
                {periods.map((period) => (
                  <SelectItem key={period.id} value={String(period.id)}>
                    {period.name} {period.is_active ? '(Activo)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEditing && (
            <div className="space-y-2 animate-fadeIn">
              <Label htmlFor="is_active">Estado de Cuenta</Label>
              <Select
                value={form.watch('is_active') ? 'true' : 'false'}
                onValueChange={(v) => form.setValue('is_active', v === 'true')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Activo</SelectItem>
                  <SelectItem value="false">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

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
