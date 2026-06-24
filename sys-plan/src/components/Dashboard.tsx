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
  Cpu,
  MessageSquare,
  Megaphone,
  Database,
  GraduationCap,
  ListTree,
  UserCog,
  Settings2
} from 'lucide-react'
import api, { getAccessToken } from '../lib/api-client'
import SecuritySettings from './SecuritySettings'
import AdminSettings from './AdminSettings'
import { DashboardSettings } from './DashboardSettings'
import { DashboardView } from './DashboardView'
import { TaxonomySettings } from './TaxonomySettings'
import UserProfile from './UserProfile'
import AuditManagement from './AuditManagement'
import SyllabusManagement from './SyllabusManagement'
import AISettings from './AISettings'
import AIChat from './AIChat'
import AcademicPeriods from './AcademicPeriods'
import { AcademicDistribution } from './AcademicDistribution'
import { PdfPreviewModal } from './PdfPreviewModal'
import { DidactoTimeline } from './DidactoTimeline'
import { CompactSidebar, NavItem } from './layout/CompactSidebar'
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
import UserManagement from './UserManagement'
import RoleManagement from './RoleManagement'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SubjectDetailModal } from './SubjectDetailModal'
import { LessonPlanWebModal } from './LessonPlan/LessonPlanWebModal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

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
  component_type?: string
  hd_t?: number
  hd_lt?: number
  hd_iscp?: number
  hde?: number
  hiv_s?: number
  hiv_a?: number
  subject_purpose?: string
  pre_requisite?: string
  modality?: string | null
  subject_bibliography?: string
  subject_strategies?: string
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [planningStyle, setPlanningStyle] = useState<'wizard' | 'timeline' | null>(null)
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('Admin')
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null)
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [previewPlanId, setPreviewPlanId] = useState<number | null>(null)
  const [previewPlanTitle, setPreviewPlanTitle] = useState<string>('')
  const [webPreviewPlan, setWebPreviewPlan] = useState<any | null>(null)
  
  // Coordinator observe plan modal states
  const [isObserveModalOpen, setIsObserveModalOpen] = useState(false)
  const [observePlanId, setObservePlanId] = useState<number | null>(null)
  const [observeFeedback, setObserveFeedback] = useState('')

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
        setUserPermissions(decoded.permissions || [])
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

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const { data: notifications = [], refetch: refetchNotifications } = useQuery<any[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications')
      return data
    },
    refetchInterval: 10000
  })

  const markAsRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`)
      refetchNotifications()
    } catch (e) {
      console.error(e)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all')
      refetchNotifications()
    } catch (e) {
      console.error(e)
    }
  }

  const { data: profileConfig } = useQuery({
    queryKey: ['profileConfig'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/profile-config')
      return data
    },
  })

  const { data: analytics } = useQuery({
    queryKey: ['analytics', userRole],
    queryFn: async () => {
      const endpoint = userRole === 'DOCENTE' 
        ? '/dashboard/analytics/personal' 
        : userRole === 'COORDINADOR' 
          ? '/dashboard/analytics/coordinator' 
          : '/dashboard/analytics/global';
      const { data } = await api.get(endpoint)
      return data
    },
    enabled: !!userRole
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

  const { createMutation, updateMutation, deleteMutation } = useLessonPlanMutations()

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
      objectives: payload.objectives || [],
      strategies: payload.strategies || [],
      modality: payload.modality || editingPlan?.modality || null,
      component_type: payload.component_type || editingPlan?.component_type || null,
      hd_t: payload.hd_t ?? editingPlan?.hd_t ?? 0,
      hd_lt: payload.hd_lt ?? editingPlan?.hd_lt ?? 0,
      hd_iscp: payload.hd_iscp ?? editingPlan?.hd_iscp ?? 0,
      hiv_s: payload.hiv_s ?? editingPlan?.hiv_s ?? 0,
      hiv_a: payload.hiv_a ?? editingPlan?.hiv_a ?? 0,
      hde: payload.hde ?? editingPlan?.hde ?? 0,
    }

    const targetId = existingId || editingPlan?.id
    if (targetId) {
      await updateMutation.mutateAsync({ id: targetId, ...apiPayload })
    } else {
      await createMutation.mutateAsync(apiPayload)
    }
    setIsModalOpen(false)
    setEditingPlan(null)
  }

  const handleApprovePlan = async (planId: number) => {
    if (window.confirm('¿Estás seguro de aprobar este plan? Esta acción no se puede deshacer.')) {
      try {
        await updateMutation.mutateAsync({ id: planId, status: 'APPROVED' } as any)
      } catch (e: any) {
        alert(e.response?.data?.detail || 'Error al aprobar el plan')
      }
    }
  }

  const handleObservePlan = (planId: number) => {
    setObservePlanId(planId)
    setObserveFeedback('')
    setIsObserveModalOpen(true)
  }

  const handleConfirmObserve = async () => {
    if (!observePlanId) return
    try {
      await updateMutation.mutateAsync({ 
        id: observePlanId, 
        status: 'OBSERVED', 
        feedback: observeFeedback 
      } as any)
      setIsObserveModalOpen(false)
      setObservePlanId(null)
      setObserveFeedback('')
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Error al observar el plan')
    }
  }

  const handleDeletePlan = async (planId: number) => {
    if (window.confirm('¿Estás seguro de ELIMINAR este plan? Esta acción no se puede deshacer.')) {
      try {
        await deleteMutation.mutateAsync(planId)
      } catch (e: any) {
        alert(e.response?.data?.detail || 'Error al eliminar el plan')
      }
    }
  }

  const filteredPlans = useMemo(() => {
    let combined = [...plans];
    
    if (userRole === 'COORDINADOR' && analytics?.expected_sections) {
      analytics.expected_sections.forEach((sec: any) => {
        const exists = plans.some(p => p.subject_code === sec.subject_code && p.section === sec.section);
        if (!exists) {
          combined.push({
            id: -1, // Use a dummy ID for NOT_STARTED plans
            title: `Plan No Creado`,
            subject_code: sec.subject_code,
            section: sec.section,
            author_name: sec.author_name,
            status: 'NOT_STARTED'
          });
        }
      });
    }

    return combined.filter((p) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        p.title.toLowerCase().includes(query) ||
        (p.author_name && p.author_name.toLowerCase().includes(query)) ||
        (p.subject_code && p.subject_code.toLowerCase().includes(query))
      );
      
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
  }, [plans, searchQuery, statusFilter, analytics, userRole])

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
          subject: subject, // <- Agregado para disponer de los datos del sinóptico
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
          const label = s === 'DRAFT' ? 'Borrador' : s === 'IN_REVIEW' ? 'En Revision' : s === 'APPROVED' ? 'Aprobado' : s === 'NOT_STARTED' ? 'No Iniciado' : s === 'OBSERVED' ? 'En Observación' : s
          const variant = s === 'DRAFT' ? 'outline' : s === 'APPROVED' ? 'default' : s === 'NOT_STARTED' ? 'destructive' : 'secondary'
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
      cell: ({ row }) => {
        const isCoordinator = userRole === 'COORDINADOR' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_GESTION';
        const isTeacher = userRole === 'DOCENTE';
        const status = row.original.status;
        const canApprove = 
          status === 'IN_REVIEW' && 
          (userPermissions.includes('lesson_plan:approve_global') || userPermissions.includes('lesson_plan:approve_department'));
        
        if (status === 'NOT_STARTED') {
          return (
            <div className="flex justify-end pr-2 text-muted-foreground text-xs font-semibold">
              Pendiente
            </div>
          )
        }
        
        return (
          <div className="flex justify-end gap-2">
            {canApprove && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleApprovePlan(row.original.id!)}
                >
                  Aceptar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1"
                  onClick={() => handleObservePlan(row.original.id!)}
                >
                  Corregir
                </Button>
              </>
            )}

            {status === 'IN_REVIEW' ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-primary/20 hover:border-primary/40 text-primary hover:bg-primary/5 font-bold"
                onClick={() => setWebPreviewPlan(row.original)}
              >
                Versión Borrador
              </Button>
            ) : (
              <>
                {status === 'APPROVED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 border-primary/20 hover:border-primary/40 text-primary hover:bg-primary/5 font-bold"
                    onClick={() => {
                      setPreviewPlanTitle(row.original.title)
                      setPreviewPlanId(row.original.id!)
                    }}
                  >
                    Ver Documento
                  </Button>
                )}
                {isTeacher && (status === 'DRAFT' || status === 'OBSERVED') && (
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
              </>
            )}
          </div>
        );
      },
    });

    return baseCols;
  }, [profileConfig, userRole, userPermissions, updateMutation]);

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

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard / Calificaciones',
      icon: LayoutDashboard,
      isActive: activeTab === 'dashboard',
      onClick: () => setActiveTab('dashboard')
    },
    {
      id: 'plans',
      title: 'Evaluaciones / Planes',
      icon: Megaphone,
      isActive: activeTab === 'plans',
      onClick: () => setActiveTab('plans')
    },

    ...(hasPermission('syllabus:read') ? [{
      id: 'syllabus',
      title: 'Programas Sinópticos',
      icon: Database,
      isActive: activeTab === 'syllabus',
      onClick: () => setActiveTab('syllabus')
    }] : []),
    {
      id: 'profile',
      title: 'Mi Perfil',
      icon: User,
      isActive: activeTab === 'profile',
      onClick: () => setActiveTab('profile')
    },
    {
      id: 'security',
      title: 'Seguridad de la Cuenta',
      icon: Shield,
      isActive: activeTab === 'security',
      onClick: () => setActiveTab('security')
    },
    ...(hasPermission('users:read') ? [{
      id: 'users',
      title: 'Gestión de Usuarios',
      icon: Users,
      isActive: activeTab === 'users',
      onClick: () => setActiveTab('users')
    }] : []),
    ...(hasPermission('roles:read') ? [{
      id: 'roles',
      title: 'Roles y Permisos',
      icon: UserCog,
      isActive: activeTab === 'roles',
      onClick: () => setActiveTab('roles')
    }] : []),
    ...(hasPermission('periods:read') ? [{
      id: 'academic_periods',
      title: 'Periodos Académicos',
      icon: GraduationCap,
      isActive: activeTab === 'academic_periods',
      onClick: () => setActiveTab('academic_periods')
    }] : []),
    ...(hasPermission('distribution:read') ? [{
      id: 'academic_distribution',
      title: 'Distribución Académica',
      icon: Building,
      isActive: activeTab === 'academic_distribution',
      onClick: () => setActiveTab('academic_distribution')
    }] : []),
    ...(hasPermission('ai_chat:read') ? [{
      id: 'ai_chat',
      title: 'Asistente IA',
      icon: MessageSquare,
      isActive: activeTab === 'ai_chat',
      onClick: () => setActiveTab('ai_chat')
    }] : []),
    ...(hasPermission('audit:read') ? [{
      id: 'audit',
      title: 'Auditoría y Control',
      icon: FileText,
      isActive: activeTab === 'audit',
      onClick: () => setActiveTab('audit')
    }] : []),
    ...(hasPermission('settings:manage') ? [{
      id: 'dashboard_settings',
      title: 'Módulos del Dashboard',
      icon: Settings2,
      isActive: activeTab === 'dashboard_settings',
      onClick: () => setActiveTab('dashboard_settings')
    }] : []),
    ...(hasPermission('taxonomies:manage') ? [{
      id: 'taxonomy_settings',
      title: 'Catálogos de Evaluación',
      icon: ListTree,
      isActive: activeTab === 'taxonomy_settings',
      onClick: () => setActiveTab('taxonomy_settings')
    }] : []),
    ...(userRole === 'SUPER_ADMIN' ? [{
      id: 'ai_settings',
      title: 'Configuración de IA',
      icon: Cpu,
      isActive: activeTab === 'ai_settings',
      onClick: () => setActiveTab('ai_settings')
    }] : []),
  ];

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
      <div className="hidden lg:block z-40 shrink-0 h-screen">
        <CompactSidebar
          onLogout={onLogout}
          onSettings={() => setActiveTab('settings')}
          items={navItems}
        />
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-y-0 left-0 z-40 lg:hidden">
          <CompactSidebar
            onLogout={onLogout}
            onSettings={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
            items={navItems.map(item => ({
              ...item,
              onClick: () => {
                if (item.onClick) item.onClick();
                setIsSidebarOpen(false);
              }
            }))}
          />
        </div>
      )}


      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-30">
          <div className="flex-1 max-w-xl relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Buscar planificaciones..."
              className="pl-10 bg-muted/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4 ml-6">
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                <Bell size={20} />
                {notifications.some(n => !n.is_read) && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-destructive rounded-full animate-pulse" />
                )}
              </Button>
              
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-card border rounded-2xl shadow-xl z-50 p-4 space-y-4 max-h-96 overflow-y-auto">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="font-bold text-sm">Notificaciones</span>
                    <button 
                      onClick={markAllAsRead} 
                      className="text-xs text-primary hover:underline font-semibold"
                    >
                      Marcar todo leído
                    </button>
                  </div>
                  <div className="space-y-3">
                    {notifications.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">No tienes notificaciones</p>
                    ) : (
                      notifications.map((n: any) => (
                        <div 
                          key={n.id} 
                          className={`p-2.5 rounded-xl text-xs space-y-1 transition-colors cursor-pointer ${n.is_read ? 'bg-background/40 opacity-70' : 'bg-primary/5 border-l-2 border-primary'}`}
                          onClick={() => {
                            markAsRead(n.id);
                            if (n.lesson_plan_id) {
                              const found = plans.find(p => p.id === n.lesson_plan_id);
                              if (found) {
                                setWebPreviewPlan(found);
                              } else {
                                // Buscar los detalles del plan del backend en caso de no estar en caché local
                                api.get(`/plans/${n.lesson_plan_id}`).then(({ data }) => {
                                  setWebPreviewPlan(data);
                                }).catch(() => {
                                  console.error("No se pudo cargar el plan");
                                });
                              }
                            }
                            setIsNotificationsOpen(false);
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold">{n.title}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <p className="text-muted-foreground whitespace-pre-line">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
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
            <DashboardView 
              userRole={userRole || ''} 
              plans={filteredPlans}
              onEditPlan={(planId) => {
                const planToEdit = plans.find(p => p.id === planId)
                if (planToEdit) {
                  setEditingPlan(planToEdit)
                  setPlanningStyle('timeline')
                  setIsModalOpen(true)
                }
              }} 
              onDeletePlan={handleDeletePlan}
              onPreviewPlan={(planId, title) => {
                setPreviewPlanTitle(title)
                setPreviewPlanId(planId)
              }}
              onWebPreviewPlan={(plan) => setWebPreviewPlan(plan)}
              onApprovePlan={handleApprovePlan}
              onObservePlan={handleObservePlan}
            />
          ) : activeTab === 'users' ? (
            <UserManagement />
          ) : activeTab === 'roles' && hasPermission('roles:read') ? (
            <RoleManagement />
          ) : activeTab === 'syllabus' ? (
            <SyllabusManagement userRole={userRole} />
          ) : activeTab === 'academic_periods' && hasPermission('periods:read') ? (
            <AcademicPeriods />
          ) : activeTab === 'academic_distribution' && hasPermission('distribution:read') ? (
            <AcademicDistribution />
          ) : activeTab === 'settings' && hasPermission('settings:manage') ? (
            <AdminSettings />
          ) : activeTab === 'dashboard_settings' && hasPermission('settings:manage') ? (
            <DashboardSettings />
          ) : activeTab === 'taxonomy_settings' && hasPermission('taxonomies:manage') ? (
            <TaxonomySettings />
          ) : activeTab === 'ai_settings' && userRole === 'SUPER_ADMIN' ? (
            <AISettings />
          ) : activeTab === 'security' ? (
            <SecuritySettings />
          ) : activeTab === 'audit' ? (
            <AuditManagement />
          ) : activeTab === 'ai_chat' ? (
            <AIChat />
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
                    {userRole === 'DOCENTE' ? 'Diseña, organiza y transforma tu planificación didáctica en un entorno inteligente' : 'Visualiza las planificaciones creadas por los docentes.'}
                  </p>
                </div>
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
                              const displayStatus = planStatus === 'DRAFT' ? 'Borrador' : planStatus === 'IN_REVIEW' ? 'En Revision' : planStatus === 'APPROVED' ? 'Aprobado' : planStatus === 'OBSERVED' ? 'En Observación' : '-'
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
                                        {planStatus === 'OBSERVED' && item.plan?.feedback && (
                                          <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-1 max-w-[250px] truncate font-medium" title={item.plan.feedback}>
                                            Obs: {item.plan.feedback}
                                          </p>
                                        )}
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
                                        {planStatus === 'IN_REVIEW' ? (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1 border-primary/20 hover:border-primary/40 text-primary hover:bg-primary/5 font-bold"
                                            onClick={() => setWebPreviewPlan(item.plan)}
                                          >
                                            Versión Borrador
                                          </Button>
                                        ) : (
                                          <>
                                            {planStatus === 'APPROVED' && (
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
                                            )}
                                            {(planStatus === 'DRAFT' || planStatus === 'OBSERVED') && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-1 border border-transparent hover:border-primary/20 text-primary hover:bg-primary/5 font-extrabold"
                                                onClick={() => {
                                                  setEditingPlan(item.plan)
                                                  setPlanningStyle('timeline')
                                                  setIsModalOpen(true)
                                                }}
                                              >
                                                Editar
                                                <ChevronRight size={16} />
                                              </Button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        className="gap-1 font-extrabold shadow-md hover:shadow-lg transition-all"
                                        onClick={() => {
                                          setEditingPlan({
                                            title: item.subjectName,
                                            subject_code: item.subjectCode,
                                            section: item.section,
                                            academic_period_id: item.academicPeriodId,
                                            component_type: item.subject?.component_type || '',
                                            hd_t: item.subject?.hd_t || 0,
                                            hd_lt: item.subject?.hd_lt || 0,
                                            hd_iscp: item.subject?.hd_iscp || 0,
                                            hde: item.subject?.hde_hours || 0,
                                            hiv_s: item.subject?.hiv_s || 0,
                                            hiv_a: item.subject?.hiv_a || 0,
                                            subject_purpose: item.subject?.purpose || '',
                                            pre_requisite: item.subject?.prerequisite || '',
                                            subject_bibliography: item.subject?.bibliographic_references || '',
                                            subject_strategies: item.subject?.teaching_strategies || '',
                                          })
                                          setPlanningStyle('timeline')
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
                        <div className="relative flex-1 w-full max-w-md">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                          <Input
                            placeholder="Buscar planificaciones por título, docente, materia o código..."
                            className="pl-10 bg-card border-slate-200/80 dark:border-slate-800/60 dark:focus-visible:border-slate-700 h-11"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-[180px] bg-card h-11 border-slate-200/80 dark:border-slate-800/60 font-semibold">
                            <SelectValue placeholder="Filtrar por estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">Todos los planes</SelectItem>
                            <SelectItem value="APPROVED">Aprobados</SelectItem>
                            <SelectItem value="IN_REVIEW">En Revisión</SelectItem>
                            <SelectItem value="OBSERVED">En Observación</SelectItem>
                            <SelectItem value="DRAFT">Borradores</SelectItem>
                            <SelectItem value="NOT_STARTED">No Iniciados</SelectItem>
                          </SelectContent>
                        </Select>
                        {(searchQuery || statusFilter !== 'ALL') && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSearchQuery('')
                              setStatusFilter('ALL')
                            }}
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

              {userRole === 'DOCENTE' && (
                <>
                  {/* Planes Observados */}
                  {plans.filter(p => p.status === 'OBSERVED').length > 0 && (
                    <Card className="border-amber-500/20 bg-amber-500/5 mt-8">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl text-amber-600 flex items-center gap-2">
                          <AlertTriangle size={20} />
                          Planes Observados (Requieren Corrección)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="font-bold">Título</TableHead>
                                <TableHead className="font-bold">Asignatura</TableHead>
                                <TableHead className="font-bold text-center">Sección</TableHead>
                                <TableHead className="font-bold text-right">Acción</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {plans.filter(p => p.status === 'OBSERVED').map((plan, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-bold text-sm">{plan.title}</TableCell>
                                  <TableCell className="text-muted-foreground">{plan.subject_code}</TableCell>
                                  <TableCell className="text-center font-bold">{plan.section}</TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1 border-primary/20 hover:border-primary/40 text-primary hover:bg-primary/5 font-extrabold"
                                      onClick={() => {
                                        setEditingPlan(plan)
                                        setPlanningStyle('timeline')
                                        setIsModalOpen(true)
                                      }}
                                    >
                                      Corregir Plan
                                      <ChevronRight size={16} />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Planes Aceptados */}
                  {plans.filter(p => p.status === 'APPROVED').length > 0 && (
                    <Card className="border-emerald-500/20 bg-emerald-500/5 mt-8">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl text-emerald-600 flex items-center gap-2">
                          <CheckCircle2 size={20} />
                          Planes Aceptados
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="font-bold">Título</TableHead>
                                <TableHead className="font-bold">Asignatura</TableHead>
                                <TableHead className="font-bold text-center">Sección</TableHead>
                                <TableHead className="font-bold text-right">Acción</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {plans.filter(p => p.status === 'APPROVED').map((plan, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-bold text-sm">{plan.title}</TableCell>
                                  <TableCell className="text-muted-foreground">{plan.subject_code}</TableCell>
                                  <TableCell className="text-center font-bold">{plan.section}</TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="gap-1 bg-emerald-600 hover:bg-emerald-700 font-extrabold shadow-sm"
                                      onClick={() => {
                                        setPreviewPlanTitle(plan.title)
                                        setPreviewPlanId(plan.id!)
                                      }}
                                    >
                                      <FileText size={16} />
                                      Ver Documento
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {isModalOpen && planningStyle === 'timeline' && (
        <DidactoTimeline
          onClose={() => {
            setIsModalOpen(false)
            setPlanningStyle(null)
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

      {webPreviewPlan && (
        <LessonPlanWebModal
          plan={webPreviewPlan}
          userRole={userRole}
          onApprove={async (id) => {
            try {
              await updateMutation.mutateAsync({ id, status: 'APPROVED' } as any);
              setWebPreviewPlan(null);
            } catch (e: any) {
              alert(e.response?.data?.detail || 'Error al aprobar el plan');
            }
          }}
          onObserve={async (id, feedback) => {
            try {
              await updateMutation.mutateAsync({ id, status: 'OBSERVED', feedback } as any);
              setWebPreviewPlan(null);
            } catch (e: any) {
              alert(e.response?.data?.detail || 'Error al observar el plan');
            }
          }}
          onClose={() => setWebPreviewPlan(null)}
        />
      )}

      <Dialog open={isObserveModalOpen} onOpenChange={setIsObserveModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="text-orange-500 w-5 h-5" />
              Devolver Plan a Revisión
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              Proporcione comentarios u observaciones detalladas para que el docente pueda corregir la planificación didáctica.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Escribe las observaciones aquí..."
              value={observeFeedback}
              onChange={(e) => setObserveFeedback(e.target.value)}
              className="min-h-[120px] rounded-xl border-border bg-muted/40 focus:bg-background resize-none focus:ring-primary"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsObserveModalOpen(false)
                setObservePlanId(null)
                setObserveFeedback('')
              }}
              className="rounded-xl font-semibold border-border hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={handleConfirmObserve}
              className="rounded-xl font-semibold bg-orange-600 hover:bg-orange-700 text-white"
              disabled={!observeFeedback.trim()}
            >
              Devolver con Observaciones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
