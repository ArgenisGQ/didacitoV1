import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table'
import {
  UserPlus,
  Edit2,
  Trash2,
  Mail,
  CheckCircle2,
  XCircle,
  Search,
  UploadCloud,
  Filter,
  Users,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react'
import api from '../lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import UserModal from './UserModal'
import BulkImportDialog from './BulkImportDialog'
import InvitationsManagement from './InvitationsManagement'

interface UserData {
  id: number
  email: string
  full_name: string
  role: string
  is_active: boolean
  date_joined: string
  mfa_enabled: boolean
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_GESTION: 'Admin Gestión',
  COORDINADOR: 'Coordinador',
  DOCENTE: 'Docente',
}

const roleVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SUPER_ADMIN: 'destructive',
  ADMIN_GESTION: 'default',
  COORDINADOR: 'secondary',
  DOCENTE: 'outline',
}

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState<'registered' | 'invitations'>('registered')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  
  // Search & Filter States
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [mfaFilter, setMfaFilter] = useState<string>('ALL')
  
  const queryClient = useQueryClient()

  // 300ms Debounce implementation for high responsiveness without lag
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchInput])

  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/users')
      return data
    },
  })

  // Count pending invitations dynamically for the tab badge
  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const { data } = await api.get('/admin/invitations')
      return data
    },
    enabled: activeTab === 'invitations' || true // load in background for accurate badge count
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/users/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const handleEdit = useCallback((user: UserData) => {
    setEditingUser(user)
    setIsModalOpen(true)
  }, [])

  const handleDelete = useCallback(async (id: number) => {
    if (window.confirm('¿Está seguro de desactivar este usuario? (Se aplicará borrado lógico en base de datos)')) {
      await deleteMutation.mutateAsync(id)
    }
  }, [deleteMutation])

  // Local filtering based on debounced search and active filters
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const fullName = u.full_name || ''
      const email = u.email || ''
      const matchesSearch = 
        fullName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        email.toLowerCase().includes(debouncedSearch.toLowerCase())
      
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter
      
      const matchesMFA = 
        mfaFilter === 'ALL' || 
        (mfaFilter === 'MFA_ENABLED' && u.mfa_enabled) || 
        (mfaFilter === 'MFA_DISABLED' && !u.mfa_enabled)

      return matchesSearch && matchesRole && matchesMFA
    })
  }, [users, debouncedSearch, roleFilter, mfaFilter])

  const columns = useMemo<ColumnDef<UserData>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: 'Docente / Administrador',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {(row.original.full_name || '').charAt(0).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{row.original.full_name}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail size={12} />
                {row.original.email}
              </div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: 'Rol de Sistema',
        cell: ({ row }) => (
          <Badge variant={roleVariants[row.original.role] || 'outline'} className="font-extrabold text-[10px] uppercase">
            {roleLabels[row.original.role] || row.original.role}
          </Badge>
        ),
      },
      {
        accessorKey: 'mfa_enabled',
        header: 'Doble Factor (MFA)',
        cell: ({ row }) =>
          row.original.mfa_enabled ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
              <ShieldCheck size={14} className="text-emerald-500" /> Protegido
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-xs">
              <ShieldAlert size={14} className="text-slate-300" /> Sin Activar
            </span>
          ),
      },
      {
        accessorKey: 'is_active',
        header: 'Estado',
        cell: ({ row }) =>
          row.original.is_active ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-sm">
              <CheckCircle2 size={14} /> Activo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-destructive font-semibold text-sm">
              <XCircle size={14} /> Inactivo
            </span>
          ),
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => handleEdit(row.original)}
            >
              <Edit2 size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleDelete(row.original.id)}
              disabled={!row.original.is_active}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDelete]
  )

  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const activePendingInvs = invitations.filter((inv: any) => !inv.is_revoked && new Date(inv.expires_at) > new Date())

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter">
            Gestión de Identidades
          </h1>
          <p className="text-lg text-muted-foreground font-medium">
            Control de accesos, gobernanza de roles institucionales y doble factor en DIDACTICO.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200/80"
            onClick={() => setIsImportOpen(true)}
          >
            <UploadCloud size={20} />
            Carga Masiva Lote
          </Button>
          
          <Button
            className="gap-2 font-extrabold text-base px-6 h-12"
            onClick={() => setIsModalOpen(true)}
          >
            <UserPlus size={20} />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Premium Segmented Glass Tabs */}
      <div className="flex p-1.5 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-800/50 w-fit gap-2">
        <button
          onClick={() => setActiveTab('registered')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
            activeTab === 'registered'
              ? 'bg-card text-foreground shadow-md shadow-slate-200/40 dark:shadow-none font-black scale-[1.02]'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users size={16} />
          Usuarios Registrados
          <Badge variant="secondary" className="ml-1 text-[11px] font-extrabold">
            {users.length}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
            activeTab === 'invitations'
              ? 'bg-card text-foreground shadow-md shadow-slate-200/40 dark:shadow-none font-black scale-[1.02]'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Mail size={16} />
          Invitaciones Enviadas
          {activePendingInvs.length > 0 && (
            <Badge variant="destructive" className="ml-1 text-[11px] font-extrabold animate-pulse">
              {activePendingInvs.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'registered' ? (
        <Card className="glass-morphism border-slate-200/80 dark:border-slate-800/80 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold">Docentes y Colaboradores Oficiales</CardTitle>
            <CardDescription className="text-sm font-medium text-slate-500">
              Visualice y edite los privilegios del equipo académico de la institución.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Real-time Debounced Filter Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-850/50">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Filtrar por nombre o dirección de correo..."
                  className="pl-10 bg-card border-slate-200/80 h-11"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                <div className="w-full md:w-44">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="bg-card border-slate-200/80 h-11">
                      <SelectValue placeholder="Rol de Sistema" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los Roles</SelectItem>
                      <SelectItem value="SUPER_ADMIN">Super Admin (IT)</SelectItem>
                      <SelectItem value="ADMIN_GESTION">Admin Gestión</SelectItem>
                      <SelectItem value="COORDINADOR">Coordinador</SelectItem>
                      <SelectItem value="DOCENTE">Docente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full md:w-48">
                  <Select value={mfaFilter} onValueChange={setMfaFilter}>
                    <SelectTrigger className="bg-card border-slate-200/80 h-11">
                      <SelectValue placeholder="Verificación MFA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Cualquier MFA</SelectItem>
                      <SelectItem value="MFA_ENABLED">Con Doble Factor (MFA)</SelectItem>
                      <SelectItem value="MFA_DISABLED">Sin Doble Factor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(roleFilter !== 'ALL' || mfaFilter !== 'ALL' || searchInput) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setSearchInput(''); setRoleFilter('ALL'); setMfaFilter('ALL'); }}
                    className="h-11 font-bold text-xs"
                  >
                    Restablecer
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id} className="p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className={`hover:bg-slate-50/20 dark:hover:bg-slate-950/10 font-medium ${!row.original.is_active ? 'opacity-50' : ''}`}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="p-3.5">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="text-center h-32 text-muted-foreground font-semibold"
                        >
                          Ningún usuario coincide con los filtros especificados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="animate-fadeIn">
          <InvitationsManagement />
        </div>
      )}

      {/* User Create/Edit Modal */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingUser(null)
        }}
        initialData={editingUser}
      />

      {/* CSV / Excel Bulk Importer Dialog */}
      <BulkImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
    </div>
  )
}
