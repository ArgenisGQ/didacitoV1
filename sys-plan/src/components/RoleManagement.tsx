import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Shield, Search, Info } from 'lucide-react'
import api from '../lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import RoleModal from './RoleModal'

export interface PermissionData {
  id: number
  code: string
  name: string
  module: string
}

export interface RoleData {
  id: number
  name: string
  description: string
  is_system: boolean
  is_active: boolean
  permissions: PermissionData[]
}

export default function RoleManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleData | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()

  const { data: roles = [], isLoading } = useQuery<RoleData[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get('/roles')
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/roles/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })

  const handleEdit = (role: RoleData) => {
    setEditingRole(role)
    setIsModalOpen(true)
  }

  const handleDelete = async (role: RoleData) => {
    if (role.is_system) {
      alert('No se pueden eliminar roles del sistema.');
      return;
    }
    if (window.confirm(`¿Está seguro de eliminar permanentemente el rol ${role.name}?`)) {
      try {
        await deleteMutation.mutateAsync(role.id)
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Error al eliminar el rol. Podria estar asignado a usuarios.')
      }
    }
  }

  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter">
            Gestión de Roles
          </h1>
          <p className="text-lg text-muted-foreground font-medium">
            Administre roles y privilegios granulares del sistema.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            className="gap-2 font-extrabold text-base px-6 h-12"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={20} />
            Nuevo Rol
          </Button>
        </div>
      </div>

      <Card className="glass-morphism border-slate-200/80 dark:border-slate-800/80 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Shield className="text-primary" size={24} />
            Roles del Sistema
          </CardTitle>
          <CardDescription className="text-sm font-medium text-slate-500">
            Listado de todos los roles configurados. Los roles de sistema no pueden ser eliminados, pero puede editar sus permisos.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Toolbar */}
          <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-850/50">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Filtrar por nombre o descripcion..."
                className="pl-10 bg-card border-slate-200/80 h-11"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="font-bold">Nombre del Rol</TableHead>
                  <TableHead className="font-bold">Descripción</TableHead>
                  <TableHead className="font-bold text-center">Permisos Asignados</TableHead>
                  <TableHead className="font-bold text-center">Tipo</TableHead>
                  <TableHead className="font-bold text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/10">
                    <TableCell className="font-bold">{role.name}</TableCell>
                    <TableCell className="text-muted-foreground">{role.description || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-bold">
                        {role.permissions.length} permisos
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {role.is_system ? (
                        <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 font-bold">
                          Sistema
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-bold">
                          Personalizado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => handleEdit(role)}
                        >
                          <Edit2 size={15} />
                        </Button>

                        {!role.is_system && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(role)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRoles.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-32 text-muted-foreground font-semibold">
                      Ningún rol coincide con su búsqueda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Create/Edit Modal */}
      {isModalOpen && (
        <RoleModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setEditingRole(null)
          }}
          initialData={editingRole}
        />
      )}
    </div>
  )
}
