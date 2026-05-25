import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
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
  ShieldAlert,
  UserCheck,
  UserX,
  BookOpen
} from 'lucide-react'
import { jwtDecode } from 'jwt-decode'
import api, { getAccessToken } from '../lib/api-client'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  id_user?: string
  username?: string
  subject_code?: string
  section?: string
  academic_period?: string
  academic_period_id?: number
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
  const [selectedAcademicLoadUser, setSelectedAcademicLoadUser] = useState<UserData | null>(null)
  const [expandedSubjectCode, setExpandedSubjectCode] = useState<string | null>(null)
  
  // Search & Filter States
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [mfaFilter, setMfaFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [periodFilter, setPeriodFilter] = useState<string>('ACTIVE')
  
  const queryClient = useQueryClient()

  // Fetch all subjects from the syllabus microservice proxy to match codes with names
  const { data: allSubjects = [] } = useQuery<any[]>({
    queryKey: ['syllabusSubjects'],
    queryFn: async () => {
      const { data } = await api.get('/syllabus/subjects')
      return data
    },
  })

  // Get logged-in user email and role from JWT token
  const currentUserInfo = useMemo(() => {
    const token = getAccessToken();
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        return {
          email: decoded.sub,
          role: decoded.role
        };
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      await api.put(`/users/${id}`, { is_active })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  // 300ms Debounce implementation for high responsiveness without lag
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchInput])

  // Fetch academic periods to filter
  const { data: periods = [] } = useQuery<any[]>({
    queryKey: ['academic-periods'],
    queryFn: async () => {
      const { data } = await api.get('/academic-periods')
      return data
    },
  })

  const activePeriodObj = useMemo(() => periods.find((p: any) => p.is_active), [periods])

  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: ['users', periodFilter, activePeriodObj?.id],
    queryFn: async () => {
      let url = '/users'
      if (periodFilter === 'ACTIVE' && activePeriodObj) {
        url += `?period_id=${activePeriodObj.id}`
      } else if (periodFilter === 'NONE') {
        url += `?period_id=0`
      } else if (periodFilter !== 'ALL' && periodFilter !== 'ACTIVE') {
        url += `?period_id=${periodFilter}`
      }
      const { data } = await api.get(url)
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

  const handleToggleStatus = useCallback(async (user: UserData) => {
    const actionText = user.is_active ? 'desactivar' : 'activar';
    if (window.confirm(`¿Está seguro de ${actionText} este usuario?`)) {
      await toggleStatusMutation.mutateAsync({ id: user.id, is_active: !user.is_active })
    }
  }, [toggleStatusMutation])

  const handleDelete = useCallback(async (user: UserData) => {
    const subjectStr = user.subject_code || '';
    const subjects = subjectStr.split(',').map(s => s.trim()).filter(Boolean);
    
    let warningMsg = `¿Está seguro de eliminar permanentemente al docente ${user.full_name}?`;
    if (subjects.length > 0) {
      warningMsg += `\n\n¡ADVERTENCIA DE VÍNCULOS ACADÉMICOS!\nSe eliminarán de forma irreversible todas sus relaciones con las siguientes materias asignadas:\n- ${subjects.join('\n- ')}`;
    } else {
      warningMsg += `\n\nNo tiene materias asignadas actualmente.`;
    }
    warningMsg += `\n\nEsta acción es definitiva y realizará un borrado físico en la base de datos. ¿Desea continuar?`;
    
    if (window.confirm(warningMsg)) {
      await deleteMutation.mutateAsync(user.id);
    }
  }, [deleteMutation])

  // Local filtering based on debounced search and active filters
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const fullName = u.full_name || ''
      const email = u.email || ''
      const idUser = u.id_user || ''
      const username = u.username || ''
      const matchesSearch = 
        fullName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        idUser.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        username.toLowerCase().includes(debouncedSearch.toLowerCase())
      
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter
      
      const matchesMFA = 
        mfaFilter === 'ALL' || 
        (mfaFilter === 'MFA_ENABLED' && u.mfa_enabled) || 
        (mfaFilter === 'MFA_DISABLED' && !u.mfa_enabled)

      const matchesStatus = 
        statusFilter === 'ALL' || 
        (statusFilter === 'ACTIVE' && u.is_active) || 
        (statusFilter === 'INACTIVE' && !u.is_active)

      let matchesPeriod = true
      if (periodFilter === 'ACTIVE') {
        if (activePeriodObj) {
          matchesPeriod = (u.academic_period_id === activePeriodObj.id) || 
                          (u.academic_period?.trim().toLowerCase() === activePeriodObj.name.trim().toLowerCase())
        }
      } else if (periodFilter === 'NONE') {
        matchesPeriod = !u.academic_period_id && !u.academic_period
      } else if (periodFilter !== 'ALL') {
        const targetPeriodId = parseInt(periodFilter, 10)
        const targetPeriodObj = periods.find((p: any) => p.id === targetPeriodId)
        matchesPeriod = (u.academic_period_id === targetPeriodId) ||
                        (targetPeriodObj && u.academic_period?.trim().toLowerCase() === targetPeriodObj.name.trim().toLowerCase())
      }

      return matchesSearch && matchesRole && matchesMFA && matchesStatus && matchesPeriod
    })
  }, [users, debouncedSearch, roleFilter, mfaFilter, statusFilter, periodFilter, activePeriodObj, periods])

  const columns = useMemo<ColumnDef<UserData>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: 'Docente / Colaborador',
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
        accessorKey: 'id_user',
        header: 'ID / Cédula',
        cell: ({ row }) => (
          <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-350">
            {row.original.id_user || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'role',
        header: 'Rol',
        cell: ({ row }) => (
          <Badge variant={roleVariants[row.original.role] || 'outline'} className="font-extrabold text-[10px] uppercase">
            {roleLabels[row.original.role] || row.original.role}
          </Badge>
        ),
      },
      {
        id: 'academic_load',
        header: 'Carga Académica',
        cell: ({ row }) => {
          const isDocente = row.original.role === 'DOCENTE';
          if (!isDocente) return <span className="text-slate-400 font-medium text-xs">—</span>;
          
          const subjectStr = row.original.subject_code || '';
          const sectionStr = row.original.section || '';
          
          const subjects = subjectStr.split(',').map(s => s.trim()).filter(Boolean);
          const sections = sectionStr.split(',').map(s => s.trim()).filter(Boolean);
          
          return (
            <div className="flex flex-col gap-0.5">
              <button 
                onClick={() => setSelectedAcademicLoadUser(row.original)}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer group text-left"
                title="Haga clic para ver detalles de la carga académica"
              >
                <Badge className="font-extrabold text-[9px] bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 border border-blue-500/25 transition-all duration-300">
                  {subjects.length} {subjects.length === 1 ? 'materia' : 'materias'}
                </Badge>
                <Badge variant="outline" className="font-extrabold text-[9px] bg-orange-500/5 text-orange-500 border border-orange-500/30 group-hover:bg-orange-500/10 transition-all duration-300">
                  {sections.length} {sections.length === 1 ? 'sección' : 'secciones'}
                </Badge>
              </button>
              {(subjects.length > 0 || sections.length > 0) && (
                <p className="text-[10px] text-muted-foreground font-medium max-w-[180px] truncate" title={`${subjectStr} | ${sectionStr}`}>
                  {subjects.join(', ')} ({sections.join(', ')})
                </p>
              )}
            </div>
          );
        }
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
        cell: ({ row }) => {
          const isCurrentUser = currentUserInfo?.email === row.original.email;
          const isDocente = row.original.role === 'DOCENTE';
          const isSuperAdmin = currentUserInfo?.role === 'SUPER_ADMIN';

          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => handleEdit(row.original)}
                title="Editar Usuario"
              >
                <Edit2 size={15} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 transition-colors duration-250 ${
                  row.original.is_active
                    ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                    : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
                onClick={() => handleToggleStatus(row.original)}
                disabled={isCurrentUser}
                title={row.original.is_active ? 'Desactivar Cuenta' : 'Activar Cuenta'}
              >
                {row.original.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
              </Button>

              {isDocente && isSuperAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete(row.original)}
                  title="Eliminar Docente Permanentemente"
                >
                  <Trash2 size={15} />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [handleEdit, handleDelete, handleToggleStatus, currentUserInfo, setSelectedAcademicLoadUser]
  )

  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
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
              <div className="flex items-center gap-3 w-full md:w-auto shrink-0 flex-wrap md:flex-nowrap">
                <div className="w-full md:w-56">
                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger className="bg-card border-slate-200/80 h-11">
                      <SelectValue placeholder="Periodo Académico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">
                        Periodo Actual {activePeriodObj ? `(${activePeriodObj.name})` : ''}
                      </SelectItem>
                      <SelectItem value="ALL">Todos los Periodos</SelectItem>
                      <SelectItem value="NONE">Sin Periodo Académico</SelectItem>
                      {periods.filter((p: any) => !p.is_active).map((period: any) => (
                        <SelectItem key={period.id} value={String(period.id)}>
                          {period.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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

                <div className="w-full md:w-44">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-card border-slate-200/80 h-11">
                      <SelectValue placeholder="Estado de Cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los Estados</SelectItem>
                      <SelectItem value="ACTIVE">Activos Únicamente</SelectItem>
                      <SelectItem value="INACTIVE">Inactivos Únicamente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(roleFilter !== 'ALL' || mfaFilter !== 'ALL' || statusFilter !== 'ALL' || periodFilter !== 'ACTIVE' || searchInput) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { 
                      setSearchInput(''); 
                      setRoleFilter('ALL'); 
                      setMfaFilter('ALL'); 
                      setStatusFilter('ALL'); 
                      setPeriodFilter('ACTIVE'); 
                    }}
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
              <>
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

                {/* Premium Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 text-sm text-slate-500 font-medium">
                  <div className="flex items-center gap-2">
                    <span>Mostrar</span>
                    <Select
                      value={table.getState().pagination.pageSize.toString()}
                      onValueChange={(val) => table.setPageSize(parseInt(val, 10))}
                    >
                      <SelectTrigger className="w-[80px] h-9 bg-card border-slate-200/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>por página</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span>
                      Página <strong>{table.getState().pagination.pageIndex + 1}</strong> de{' '}
                      <strong>{table.getPageCount() || 1}</strong>
                    </span>
                    <span className="mx-2 text-slate-350">•</span>
                    <span>Total: <strong>{filteredUsers.length}</strong> usuarios</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.setPageIndex(0)}
                      disabled={!table.getCanPreviousPage()}
                      className="h-9 px-3 border-slate-200/85"
                    >
                      «
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      className="h-9 px-3 font-semibold border-slate-200/85"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      className="h-9 px-3 font-semibold border-slate-200/85"
                    >
                      Siguiente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                      disabled={!table.getCanNextPage()}
                      className="h-9 px-3 border-slate-200/85"
                    >
                      »
                    </Button>
                  </div>
                </div>
              </>
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

      {/* Detailed Academic Load Modal / Dialog */}
      {selectedAcademicLoadUser && (
        <Dialog 
          open={!!selectedAcademicLoadUser} 
          onOpenChange={(open) => { 
            if (!open) {
              setSelectedAcademicLoadUser(null);
              setExpandedSubjectCode(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[600px] border-slate-200/80 dark:border-slate-800/80 glass-morphism shadow-2xl animate-fadeIn">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight text-slate-850 dark:text-slate-100 flex items-center gap-2">
                <BookOpen className="text-primary" size={24} />
                Carga Académica Detallada
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-muted-foreground mt-1">
                Materias, códigos y secciones oficiales asignadas al docente: <strong className="text-slate-700 dark:text-slate-350">{selectedAcademicLoadUser.full_name}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-3 max-h-[420px] overflow-y-auto pr-1">
              {/* Información de Registro en Periodo */}
              {(selectedAcademicLoadUser as any).period_created_at && (
                <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 space-y-2 text-xs animate-fadeIn">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-primary" />
                    Detalles de Registro en {selectedAcademicLoadUser.academic_period || 'Periodo Actual'}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-muted-foreground font-medium">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400">Método de Registro</span>
                      <span className="text-slate-700 dark:text-slate-350 font-bold">
                        {(selectedAcademicLoadUser as any).period_creation_method === 'BULK' ? 'Carga por Lote' : 'Individual / Manual'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400">Registrado por</span>
                      <span className="text-slate-700 dark:text-slate-350 font-bold truncate block" title={(selectedAcademicLoadUser as any).period_created_by_email}>
                        {(selectedAcademicLoadUser as any).period_created_by_email || 'Sistema / Automático'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400">Fecha de Registro</span>
                      <span className="text-slate-700 dark:text-slate-350 font-bold">
                        {new Date((selectedAcademicLoadUser as any).period_created_at).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400">Estado en Periodo</span>
                      <span className={`font-bold inline-flex items-center gap-1 ${(selectedAcademicLoadUser as any).period_is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        {(selectedAcademicLoadUser as any).period_is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {(() => {
                const subjectCodes = (selectedAcademicLoadUser.subject_code || '').split(',').map(s => s.trim()).filter(Boolean);
                const sections = (selectedAcademicLoadUser.section || '').split(',').map(s => s.trim()).filter(Boolean);
                
                if (subjectCodes.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground font-semibold">
                      Este docente no tiene materias asignadas actualmente.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3.5">
                    {subjectCodes.map((code, idx) => {
                      const resolvedSubject = allSubjects.find(s => s.code.toUpperCase() === code.toUpperCase());
                      const subjectName = resolvedSubject ? resolvedSubject.name : 'Unidad Curricular Sin Registrar';
                      const sectionName = sections[idx] || (sections[0] ? `${sections[0]}` : 'Sin Sección');
                      
                      return (
                        <div 
                          key={idx} 
                          className="flex flex-col rounded-2xl bg-slate-50/50 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-900/30 transition-all duration-300 animate-fadeIn"
                        >
                          {/* Tarjeta Principal */}
                          <div className="flex items-start justify-between gap-4 p-4 w-full">
                            <div className="space-y-1">
                              <span className="font-mono font-black text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md uppercase">
                                {code}
                              </span>
                              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 pt-1 leading-snug">
                                {subjectName}
                              </h4>
                              <p className="text-[11px] font-semibold text-muted-foreground">
                                Programa: {resolvedSubject?.program || 'Por asignar'}
                              </p>
                            </div>
                            
                            <div className="flex flex-col items-end shrink-0 gap-2">
                              <Badge variant="outline" className="font-extrabold text-[10px] bg-orange-500/5 text-orange-500 border border-orange-500/20 px-2 py-0.5 rounded-lg uppercase shrink-0">
                                {sectionName}
                              </Badge>
                              {resolvedSubject && (
                                <button
                                  onClick={() => {
                                    setExpandedSubjectCode(expandedSubjectCode === code ? null : code);
                                  }}
                                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer select-none"
                                >
                                  {expandedSubjectCode === code ? 'Ocultar Detalle' : 'Vista Rápida'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Acordeón Expansible Inline (Opción A) */}
                          {resolvedSubject && expandedSubjectCode === code && (
                            <div className="mx-4 mb-4 p-4 rounded-xl bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 animate-fadeIn space-y-2">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {/* Tarjeta de Nivel */}
                                <div className="p-3 bg-card border rounded-xl text-center space-y-1 shadow-sm">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Nivel</span>
                                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase">{resolvedSubject.level}</span>
                                </div>
                                {/* Tarjeta de Créditos */}
                                <div className="p-3 bg-card border rounded-xl text-center space-y-1 shadow-sm">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Créditos</span>
                                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">{resolvedSubject.academic_credits}</span>
                                </div>
                                {/* Tarjeta de Horas HAD */}
                                <div className="p-3 bg-card border rounded-xl text-center space-y-1 shadow-sm">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Horas HAD</span>
                                  <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">{resolvedSubject.had_hours}h</span>
                                </div>
                                {/* Tarjeta de Periodo */}
                                <div className="p-3 bg-card border rounded-xl text-center space-y-1 shadow-sm">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Periodo</span>
                                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">{resolvedSubject.academic_period || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <DialogFooter>
              <Button 
                onClick={() => {
                  setSelectedAcademicLoadUser(null);
                  setExpandedSubjectCode(null);
                }} 
                className="font-bold w-full sm:w-auto"
              >
                Cerrar Carga Académica
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
