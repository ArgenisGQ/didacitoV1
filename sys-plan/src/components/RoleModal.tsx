import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import api from '../lib/api-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RoleData, PermissionData } from './RoleManagement'

interface RoleModalProps {
  isOpen: boolean
  onClose: () => void
  initialData: RoleData | null
}

interface RoleFormData {
  name: string
  description: string
  permission_ids: number[]
}

export default function RoleModal({ isOpen, onClose, initialData }: RoleModalProps) {
  const queryClient = useQueryClient()

  const { control, handleSubmit, reset, setValue, watch } = useForm<RoleFormData>({
    defaultValues: {
      name: '',
      description: '',
      permission_ids: []
    }
  })

  useEffect(() => {
    if (initialData && isOpen) {
      reset({
        name: initialData.name,
        description: initialData.description || '',
        permission_ids: initialData.permissions.map(p => p.id)
      })
    } else if (isOpen) {
      reset({
        name: '',
        description: '',
        permission_ids: []
      })
    }
  }, [initialData, isOpen, reset])

  const { data: allPermissions = [] } = useQuery<PermissionData[]>({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data } = await api.get('/roles/permissions')
      return data
    },
    enabled: isOpen
  })

  const saveMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      if (initialData) {
        await api.put(`/roles/${initialData.id}`, data)
      } else {
        await api.post('/roles', data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      onClose()
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Ocurrió un error')
    }
  })

  const onSubmit = (data: RoleFormData) => {
    saveMutation.mutate(data)
  }

  // Group permissions by module
  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = []
    }
    acc[perm.module].push(perm)
    return acc
  }, {} as Record<string, PermissionData[]>)

  const selectedPermissions = watch('permission_ids')

  const togglePermission = (id: number) => {
    const current = selectedPermissions || []
    if (current.includes(id)) {
      setValue('permission_ids', current.filter(x => x !== id))
    } else {
      setValue('permission_ids', [...current, id])
    }
  }

  const toggleModule = (moduleName: string) => {
    const modulePermIds = groupedPermissions[moduleName].map(p => p.id)
    const current = selectedPermissions || []
    
    // If all module perms are selected, deselect them
    const allSelected = modulePermIds.every(id => current.includes(id))
    
    if (allSelected) {
      setValue('permission_ids', current.filter(id => !modulePermIds.includes(id)))
    } else {
      const newPerms = new Set([...current, ...modulePermIds])
      setValue('permission_ids', Array.from(newPerms))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col glass-morphism border-slate-200/80 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">
            {initialData ? 'Editar Rol' : 'Nuevo Rol'}
          </DialogTitle>
        </DialogHeader>

        <form id="role-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6 overflow-y-auto pr-2 py-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-bold">Nombre del Rol</Label>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Input id="name" {...field} placeholder="Ej. EDITOR_CONTENIDO" disabled={initialData?.is_system} />
                  )}
                />
                {initialData?.is_system && (
                  <p className="text-xs text-amber-600 font-semibold">El nombre de un rol de sistema no puede ser modificado.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="font-bold">Descripción</Label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <Textarea id="description" {...field} placeholder="Breve descripción del propósito del rol" />
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label className="font-bold text-lg">Permisos Asignados</Label>
              <div className="space-y-6">
                {Object.entries(groupedPermissions).map(([moduleName, perms]) => {
                  const modulePermIds = perms.map(p => p.id)
                  const allSelected = modulePermIds.every(id => selectedPermissions.includes(id))
                  const someSelected = modulePermIds.some(id => selectedPermissions.includes(id)) && !allSelected
                  
                  return (
                    <div key={moduleName} className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <input 
                          type="checkbox"
                          id={`mod-${moduleName}`}
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                          ref={(input) => {
                            if (input) {
                              input.indeterminate = !allSelected && someSelected;
                            }
                          }}
                          checked={allSelected}
                          onChange={() => toggleModule(moduleName)}
                        />
                        <Label htmlFor={`mod-${moduleName}`} className="font-black uppercase tracking-wider text-sm cursor-pointer">
                          Módulo: {moduleName}
                        </Label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                        {perms.map(perm => (
                          <div key={perm.id} className="flex items-start gap-2">
                            <input 
                              type="checkbox"
                              id={`perm-${perm.id}`}
                              className="w-4 h-4 mt-0.5 rounded border-slate-300 text-primary focus:ring-primary"
                              checked={selectedPermissions.includes(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                            />
                            <div className="grid gap-0.5 leading-none">
                              <Label htmlFor={`perm-${perm.id}`} className="font-bold cursor-pointer text-sm">
                                {perm.name}
                              </Label>
                              <p className="text-xs text-muted-foreground font-mono">{perm.code}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </form>

        <DialogFooter className="mt-4 pt-4 border-t border-slate-200">
          <Button type="button" variant="ghost" onClick={onClose} className="font-bold">
            Cancelar
          </Button>
          <Button type="submit" form="role-form" disabled={saveMutation.isPending} className="font-extrabold px-8">
            {saveMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
