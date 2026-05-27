import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { jwtDecode } from 'jwt-decode'
import { useLessonPlanMutations } from '../hooks/useLessonPlanMutations'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table'
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Plus,
  Search,
  Bell,
  LogOut,
  ChevronRight,
  CheckCircle2,
  Moon,
  Sun,
  Menu,
  X,
  User,
  Shield,
  Clock,
  BookOpen,
  Calendar as CalendarIcon,
  AlertTriangle,
  Lock,
  Building,
} from 'lucide-react'
import api, { getAccessToken } from '../lib/api-client'
import SecuritySettings from './SecuritySettings'
import AdminSettings from './AdminSettings'
import { DashboardSettings } from './DashboardSettings'
import { DashboardView } from './DashboardView'
import UserProfile from './UserProfile'
import AuditManagement from './AuditManagement'
import SyllabusManagement from './SyllabusManagement'
import AcademicPeriods from './AcademicPeriods'
import { AcademicDistribution } from './AcademicDistribution'
import { PdfPreviewModal } from './PdfPreviewModal'
import { Button } from '@/components/ui/button'
import { hasPermission } from '../lib/permissions'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LessonPlanWizard } from './wizard/LessonPlanWizard'
import UserManagement from './UserManagement'
import RoleManagement from './RoleManagement'
import { SubjectDetailModal } from './SubjectDetailModal'

interface LessonPlan {
  id?: number
  title: string
  status?: string
  content?: any
  created_at?: string
  updated_at?: string
  subject_code?: string | null
  section?: string | null
  academic_period_id?: number | null
  author_name?: string
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('Admin')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null)
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [previewPlanId, setPreviewPlanId] = useState<number | null>(null)
  const [previewPlanTitle, setPreviewPlanTitle] = useState<string>('')

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      )
    }
    return false
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    const token = getAccessToken()
    if (token) {
      try {
        const decoded: any = jwtDecode(token)
        setUserRole(decoded.role)
        setUserName(decoded.sub.split('@')[0])
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkMode])

  const { data: plans = [], isLoading } = useQuery<LessonPlan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data } = await api.get('/plans')
      return data
    },
  })

  const { data: profileConfig } = useQuery({
    queryKey: ['profileConfig'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/profile-config')
      return data
    },
  })

  const { data: academicLoad, isLoading: isLoadingLoad } = useQuery({
    queryKey: ['academicLoad'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/academic-load')
      return data
    },
    enabled: userRole === 'DOCENTE'
  })

  const isAuditViewer = useMemo(() => {
    if (!profileConfig || !userRole) return false
    const viewerRoles = profileConfig.audit_viewer_roles || ['SUPER_ADMIN']
    return viewerRoles.includes(userRole)
  }, [profileConfig, userRole])

  const { createMutation, updateMutation } = useLessonPlanMutations()

  const handleSavePlan = async (wizardData: any) => {
    const { planId: existingId, ...payload } = wizardData

    // Map wizard structure to backend API format
    const apiPayload = {
      title: payload.title,
      status: payload.status || 'DRAFT',
      evaluation_plans: payload.evaluation_plans || [],
      weekly_contents: payload.weekly_contents || [],
      subject_code: payload.subject_code || editingPlan?.subject_code || null,
      section: payload.section || editingPlan?.section || null,
      academic_period_id: payload.academic_period_id || editingPlan?.academic_period_id || null,
    }

    if (existingId || editingPlan) {
      await updateMutation.mutateAsync({ id: existingId || editingPlan!.id, ...apiPayload })
    } else {
      await createMutation.mutateAsync(apiPayload)
    }
    setIsModalOpen(false)
    setEditingPlan(null)
  }

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const query = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(query) ||
        (p.author_name && p.author_name.toLowerCase().includes(query)) ||
        (p.subject_code && p.subject_code.toLowerCase().includes(query))
      );
    })
  }, [plans, searchQuery])

  const teacherRequiredPlans = useMemo(() => {
    if (userRole !== 'DOCENTE' || !academicLoad || !academicLoad.active_period) {
      return []
    }
    const assignedSections = academicLoad.section
      ? academicLoad.section.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []
    const required: any[] = []

    academicLoad.subjects.forEach((subject: any) => {
      const sections = assignedSections.length > 0 ? assignedSections : ['N/A']

      sections.forEach((sec: string) => {
        const existingPlan = plans.find(
          (p: any) =>
            p.subject_code === subject.code &&
            p.section === sec &&
            p.academic_period_id === academicLoad.active_period.id
        )

        required.push({
          subjectCode: subject.code,
          subjectName: subject.name,
          section: sec,
          academicPeriodId: academicLoad.active_period.id,
          academicPeriodName: academicLoad.active_period.name,
          plan: existingPlan || null,
          hasSyllabus: subject.has_syllabus,
        })
      })
    })

    return required
  }, [userRole, academicLoad, plans])

  const filteredTeacherRequiredPlans = useMemo(() => {
    return teacherRequiredPlans.filter((item) => {
      const query = searchQuery.toLowerCase();
      return (
        item.subjectCode.toLowerCase().includes(query) ||
        item.subjectName.toLowerCase().includes(query) ||
        (item.plan && item.plan.title.toLowerCase().includes(query))
      );
    });
  }, [teacherRequiredPlans, searchQuery])

  const columns = useMemo<ColumnDef<LessonPlan>[]>(() => {
    const baseCols: ColumnDef<LessonPlan>[] = [
      {
        accessorKey: 'title',
        header: 'Titulo',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary">
              <FileText size={20} />
            </div>
            <div>
              <p className="font-bold">{row.original.title}</p>
              <p className="text-xs text-muted-foreground">
                {(() => {
                  if (!row.original.created_at) return 'Sin fecha';
                  const tz = profileConfig?.system_timezone || 'America/Caracas';
                  try {
                    return new Intl.DateTimeFormat('es-ES', {
                      timeZone: tz,
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    }).format(new Date(row.original.created_at))
                  } catch (e) {
                    return new Date(row.original.created_at).toLocaleDateString()
                  }
                })()}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const s = row.original.status
          const label = s === 'DRAFT' ? 'Borrador' : s === 'IN_REVIEW' ? 'En Revision' : s === 'APPROVED' ? 'Aprobado' : s
          const variant = s === 'DRAFT' ? 'outline' : s === 'APPROVED' ? 'default' : 'secondary'
          return <Badge variant={variant as any}>{label}</Badge>
        },
      },
    ];

    if (userRole !== 'DOCENTE') {
      baseCols.splice(1, 0, {
        accessorKey: 'author_name',
        header: 'Docente',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <User size={16} className="text-muted-foreground" />
            <span className="font-bold">{row.original.author_name || 'Desconocido'}</span>
          </div>
        ),
      });
    } else {
      baseCols.push({
        accessorKey: 'content',
        header: 'Objetivos',
        cell: ({ row }) => (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <CheckCircle2 size={14} />
            {row.original.content?.objectives?.length || 0} objetivos
          </div>
        ),
      });
    }

    baseCols.push({
      id: 'actions',
      header: () => <div className="text-right">Accion</div>,
      cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-primary/20 hover:border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => {
                setPreviewPlanTitle(row.original.title)
                setPreviewPlanId(row.original.id!)
              }}
            >
              Ver Documento
            </Button>
            {userRole === 'DOCENTE' && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => {
                  setEditingPlan(row.original)
                  setIsModalOpen(true)
                }}
              >
                Editar
                <ChevronRight size={16} />
              </Button>
            )}
          </div>
      ),
    });

    return baseCols;
  }, [profileConfig, userRole]);

  const table = useReactTable({
    data: filteredPlans,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      {/* Mobile toggle */}
      <Button
        className="lg:hidden fixed bottom-6 right-6 z-50 rounded-full shadow-2xl h-14 w-14"
        size="icon"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </Button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-card border-r flex flex-col transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary p-2.5 rounded-2xl shadow-lg shadow-primary/20">
            <FileText size={24} className="text-primary-foreground" />
          </div>
          <span className="text-2xl font-black tracking-tighter">
            DIDACTICO
          </span>
        </div>

        <Separator />

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'plans', icon: FileText, label: 'Planificaciones', count: userRole === 'DOCENTE' ? `${teacherRequiredPlans.filter((p: any) => p.plan).length}/${teacherRequiredPlans.filter((p: any) => p.hasSyllabus).length}` : plans.length },
            ...(hasPermission('syllabus:read')
              ? [
                  { id: 'syllabus', icon: BookOpen, label: 'Programas Sinópticos' }
                ]
              : []),
            { id: 'profile', icon: User, label: 'Mi Perfil' },
            { id: 'security', icon: Shield, label: 'Seguridad de la Cuenta' },
            ...(hasPermission('users:read')
              ? [
                  { id: 'users', icon: Users, label: 'Gestion de Usuarios' }
                ]
              : []),
            ...(hasPermission('roles:read')
              ? [
                  { id: 'roles', icon: Shield, label: 'Roles y Permisos' }
                ]
              : []),
            ...(hasPermission('periods:read')
              ? [
                  { id: 'academic_periods', icon: CalendarIcon, label: 'Periodos Académicos' }
                ]
              : []),
            ...(hasPermission('distribution:read')
              ? [
                  { id: 'academic_distribution', icon: Building, label: 'Distribución Académica' }
                ]
              : []),
            ...(hasPermission('audit:read')
              ? [
                  { id: 'audit', icon: Clock, label: 'Auditoría y Control' }
                ]
              : []),
          ].map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? 'default' : 'ghost'}
              className="w-full justify-start gap-3 h-12 text-base font-semibold"
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon size={20} />
              {item.label}
              {'count' in item && item.count !== undefined && (
                <Badge variant="secondary" className="ml-auto">
                  {item.count}
                </Badge>
              )}
            </Button>
          ))}

          {hasPermission('settings:manage') && (
            <>
              <Separator className="my-4" />
              <Button
                variant={activeTab === 'settings' ? 'default' : 'ghost'}
                className="w-full justify-start gap-3 h-12 text-base font-semibold"
                onClick={() => setActiveTab('settings')}
              >
                <Settings size={20} />
                Configuración del Sistema
              </Button>
              <Button
                variant={activeTab === 'dashboard_settings' ? 'default' : 'ghost'}
                className="w-full justify-start gap-3 h-12 text-base font-semibold mt-1"
                onClick={() => setActiveTab('dashboard_settings')}
              >
                <LayoutDashboard size={20} />
                Módulos del Dashboard
              </Button>
            </>
          )}
        </nav>

        <div className="p-4 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-12 text-base"
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            Modo {isDarkMode ? 'Claro' : 'Oscuro'}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-12 text-base text-destructive hover:text-destructive"
            onClick={onLogout}
          >
            <LogOut size={20} />
            Cerrar Sesion
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Buscar planificaciones..."
              className="pl-10 bg-muted/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4 ml-6">
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-destructive rounded-full" />
            </Button>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-bold leading-none">{userName}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                  {userRole?.replace('_', ' ') || 'Usuario'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8">
          {activeTab === 'dashboard' ? (
            <DashboardView userRole={userRole || ''} />
          ) : activeTab === 'users' ? (
            <UserManagement />
          ) : activeTab === 'roles' && hasPermission('roles:read') ? (
            <RoleManagement />
          ) : activeTab === 'syllabus' ? (
            <SyllabusManagement />
          ) : activeTab === 'academic_periods' && hasPermission('periods:read') ? (
            <AcademicPeriods />
          ) : activeTab === 'academic_distribution' && hasPermission('distribution:read') ? (
            <AcademicDistribution />
          ) : activeTab === 'settings' && hasPermission('settings:manage') ? (
            <AdminSettings />
          ) : activeTab === 'dashboard_settings' && hasPermission('settings:manage') ? (
            <DashboardSettings />
          ) : activeTab === 'security' ? (
            <SecuritySettings />
          ) : activeTab === 'audit' ? (
            <AuditManagement />
          ) : activeTab === 'profile' ? (
            <UserProfile onForceLogout={onLogout} />
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div className="space-y-2">
                  <h1 className="text-4xl lg:text-5xl font-black tracking-tighter">
                    {userRole === 'DOCENTE' ? 'Mis Planificaciones' : 'Listado de Planificaciones'}
                  </h1>
                  <p className="text-lg text-muted-foreground font-medium">
                    {userRole === 'DOCENTE' ? 'Gestiona y disena estrategias academicas de alto impacto.' : 'Visualiza las planificaciones creadas por los docentes.'}
                  </p>
                </div>
                {userRole === 'DOCENTE' && (
                  <Button
                    size="lg"
                    className="gap-2 font-extrabold text-base h-14 px-8"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <Plus size={22} strokeWidth={2.5} />
                    Nueva Planificacion
                  </Button>
                )}
              </div>

              {/* BLOQUE DE CARGA ACADÉMICA ACTIVA (Solo para docentes) */}
              {userRole === 'DOCENTE' && (
                <Card className="border rounded-3xl overflow-hidden bg-card/65 shadow-md">
                  <CardHeader className="bg-muted/15 border-b pb-4">
                    <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2.5">
                      <div className="bg-primary/10 text-primary p-2 rounded-xl">
                        <BookOpen size={20} />
                      </div>
                      <span>
                        Carga Académica — Periodo Académico: {academicLoad?.active_period?.name || (isLoadingLoad ? 'Cargando...' : 'Sin periodo activo')}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoadingLoad ? (
                      <div className="p-8 text-center text-muted-foreground animate-pulse flex flex-col items-center justify-center gap-2">
                        <Clock className="animate-spin text-primary" size={24} />
                        <span>Cargando carga académica...</span>
                      </div>
                    ) : !academicLoad?.active_period ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <AlertTriangle className="mx-auto mb-2 text-amber-500" size={32} />
                        <p className="font-bold">No hay un período académico marcado como activo en el sistema.</p>
                      </div>
                    ) : academicLoad.subjects.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <BookOpen className="mx-auto mb-2 text-muted-foreground/50" size={32} />
                        <p className="font-bold">No tienes carga académica asignada para el periodo actual.</p>
                        <p className="text-xs mt-1">Si consideras esto un error, por favor contacta al administrador de gestión.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow>
                              <TableHead className="font-bold pl-6">Código</TableHead>
                              <TableHead className="font-bold">Asignatura / Carga Académica</TableHead>
                              <TableHead className="font-bold">Programa Académico</TableHead>
                              <TableHead className="font-bold text-center">Nivel</TableHead>
                              <TableHead className="font-bold text-center">Créditos</TableHead>
                              {academicLoad.section && <TableHead className="font-bold text-center">Sección</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {academicLoad.subjects.map((sub: any) => (
                              <TableRow key={sub.code} className="hover:bg-muted/10">
                                <TableCell className="font-bold pl-6 text-primary">
                                  {sub.id ? (
                                    <Button
                                      variant="link"
                                      className="p-0 font-black text-primary hover:text-primary/80 transition-colors h-auto text-sm"
                                      onClick={() => {
                                        setSelectedSubjectId(sub.id)
                                        setIsSubjectModalOpen(true)
                                      }}
                                    >
                                      {sub.code}
                                    </Button>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-muted-foreground text-sm">{sub.code}</span>
                                      <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/20 bg-amber-500/5 font-extrabold px-1.5 py-0">
                                        Pendiente
                                      </Badge>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="font-bold text-sm">{sub.name}</TableCell>
                                <TableCell className="text-muted-foreground text-xs font-semibold">{sub.program || 'No Asignado'}</TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant={sub.level.toUpperCase() === 'PREGRADO' ? 'default' : 'secondary'}
                                    className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5"
                                  >
                                    {sub.level}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center font-bold text-sm">{sub.academic_credits} UC</TableCell>
                                {academicLoad.section && (
                                  <TableCell className="text-center text-muted-foreground font-extrabold text-sm">
                                    {academicLoad.section}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Planes de Clase</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : userRole === 'DOCENTE' ? (
                    // Vista dinámica personalizada para el Docente
                    filteredTeacherRequiredPlans.length === 0 ? (
                      <div className="text-center py-16 space-y-4">
                        <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto">
                          <BookOpen size={40} className="text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold">Sin asignaciones</h3>
                          <p className="text-muted-foreground mt-1">
                            No tienes materias o secciones asignadas en el periodo activo.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow>
                              <TableHead className="font-bold pl-6">Asignatura</TableHead>
                              <TableHead className="font-bold text-center">Sección</TableHead>
                              <TableHead className="font-bold text-center">Estado de Planificación</TableHead>
                              <TableHead className="font-bold text-center">Estado del Flujo</TableHead>
                              <TableHead className="font-bold text-right pr-6">Acción</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTeacherRequiredPlans.map((item: any, idx: number) => {
                              const isRealizado = !!item.plan
                              const planStatus = item.plan?.status
                              const displayStatus = planStatus === 'DRAFT' ? 'Borrador' : planStatus === 'IN_REVIEW' ? 'En Revision' : planStatus === 'APPROVED' ? 'Aprobado' : '-'
                              const isBlocked = !item.hasSyllabus
                              
                              return (
                                <TableRow key={idx} className="hover:bg-muted/10">
                                  <TableCell className="font-bold pl-6">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBlocked ? 'bg-muted text-muted-foreground' : isRealizado ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                        <BookOpen size={20} />
                                      </div>
                                      <div>
                                        <p className="font-bold text-sm">{item.subjectName}</p>
                                        <p className="text-xs text-muted-foreground font-semibold">{item.subjectCode}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center font-extrabold text-sm">{item.section}</TableCell>
                                  <TableCell className="text-center">
                                    {isBlocked ? (
                                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive/20 bg-destructive/5 font-extrabold px-1.5 py-0">
                                        Sin Programa Sinóptico
                                      </Badge>
                                    ) : (
                                      <Badge
                                        className={`font-black text-xs px-3 py-1 rounded-xl shadow-sm ${
                                          isRealizado 
                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                        }`}
                                      >
                                        {isRealizado ? 'Realizado' : 'Pendiente'}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {isRealizado && !isBlocked ? (
                                      <Badge
                                        variant={planStatus === 'DRAFT' ? 'outline' : planStatus === 'APPROVED' ? 'default' : 'secondary'}
                                        className="text-xs font-bold px-2 py-0.5"
                                      >
                                        {displayStatus}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs font-medium">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right pr-6">
                                    {isBlocked ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled
                                        className="gap-1 font-extrabold shadow-sm"
                                      >
                                        <Lock size={14} strokeWidth={2.5} />
                                        Bloqueado
                                      </Button>
                                    ) : isRealizado ? (
                                      <div className="flex items-center gap-2 justify-end">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-1 border-primary/20 hover:border-primary/40 text-primary hover:bg-primary/5 font-bold"
                                          onClick={() => {
                                            setPreviewPlanTitle(item.plan.title)
                                            setPreviewPlanId(item.plan.id)
                                          }}
                                        >
                                          Ver Documento
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-1 border-primary/20 hover:border-primary/40 text-primary hover:bg-primary/5 font-bold"
                                          onClick={() => {
                                            setEditingPlan(item.plan)
                                            setIsModalOpen(true)
                                          }}
                                        >
                                          Editar
                                          <ChevronRight size={16} />
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        className="gap-1 font-extrabold shadow-md hover:shadow-lg transition-all"
                                        onClick={() => {
                                          setEditingPlan({
                                            title: `Plan de Clase: ${item.subjectName} (${item.subjectCode}) - Sección ${item.section}`,
                                            subject_code: item.subjectCode,
                                            section: item.section,
                                            academic_period_id: item.academicPeriodId,
                                          })
                                          setIsModalOpen(true)
                                        }}
                                      >
                                        <Plus size={14} strokeWidth={2.5} />
                                        Realizar Planificación
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-850/50">
                        <div className="relative flex-1 w-full">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                          <Input
                            placeholder="Buscar planificaciones por título, docente, materia o código..."
                            className="pl-10 bg-card border-slate-200/80 h-11"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        {searchQuery && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSearchQuery('')}
                            className="h-11 font-bold text-xs shrink-0"
                          >
                            Restablecer
                          </Button>
                        )}
                      </div>

                      {filteredPlans.length === 0 ? (
                        <div className="text-center py-16 space-y-4">
                          <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto">
                            <FileText size={40} className="text-muted-foreground" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold">
                              {searchQuery
                                ? 'Sin resultados'
                                : 'No hay planes registrados'}
                            </h3>
                            <p className="text-muted-foreground mt-1">
                              {searchQuery
                                ? 'Intenta con otra búsqueda.'
                                : 'Las planificaciones de los docentes aparecerán aquí.'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-md border">
                            <Table>
                          <TableHeader>
                            {table.getHeaderGroups().map((hg) => (
                              <TableRow key={hg.id}>
                                {hg.headers.map((h) => (
                                  <TableHead key={h.id}>
                                    {h.isPlaceholder
                                      ? null
                                      : flexRender(
                                          h.column.columnDef.header,
                                          h.getContext()
                                        )}
                                  </TableHead>
                                ))}
                              </TableRow>
                            ))}
                          </TableHeader>
                          <TableBody>
                            {table.getRowModel().rows.map((row) => (
                              <TableRow key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                  <TableCell key={cell.id}>
                                    {flexRender(
                                      cell.column.columnDef.cell,
                                      cell.getContext()
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex items-center justify-between px-2">
                        <div className="flex-1 text-sm text-muted-foreground">
                          Página {table.getState().pagination.pageIndex + 1} de{' '}
                          {table.getPageCount() || 1} ({table.getFilteredRowModel?.().rows.length || filteredPlans.length} planificaciones)
                        </div>
                        <div className="flex items-center space-x-6 lg:space-x-8">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium hidden sm:block">Filas por página</p>
                            <select
                              className="h-8 w-[70px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              value={table.getState().pagination.pageSize}
                              onChange={(e) => {
                                table.setPageSize(Number(e.target.value))
                              }}
                            >
                              {[10, 20, 50].map((pageSize) => (
                                <option key={pageSize} value={pageSize}>
                                  {pageSize}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => table.previousPage()}
                              disabled={!table.getCanPreviousPage()}
                            >
                              Anterior
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => table.nextPage()}
                              disabled={!table.getCanNextPage()}
                            >
                              Siguiente
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                )}
              </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

      {isModalOpen && (
        <LessonPlanWizard
          onClose={() => {
            setIsModalOpen(false)
            setEditingPlan(null)
          }}
          onSave={handleSavePlan}
          initialData={editingPlan}
          planId={editingPlan?.id ?? null}
        />
      )}

      {isSubjectModalOpen && selectedSubjectId && (
        <SubjectDetailModal
          subjectId={selectedSubjectId}
          onClose={() => {
            setIsSubjectModalOpen(false)
            setSelectedSubjectId(null)
          }}
        />
      )}

      {previewPlanId && (
        <PdfPreviewModal
          planId={previewPlanId}
          title={previewPlanTitle}
          onClose={() => {
            setPreviewPlanId(null)
            setPreviewPlanTitle('')
          }}
        />
      )}
    </div>
  )
}
