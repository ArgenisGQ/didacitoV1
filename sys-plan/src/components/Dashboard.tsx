import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { jwtDecode } from 'jwt-decode'
import { useLessonPlanMutations } from '../hooks/useLessonPlanMutations'
import {
  useReactTable,
  getCoreRowModel,
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
} from 'lucide-react'
import api from '../lib/api-client'
import { Button } from '@/components/ui/button'
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

interface LessonPlan {
  id: number
  title: string
  status: string
  content: any
  created_at: string
  updated_at?: string
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('plans')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('Admin')
  const [searchQuery, setSearchQuery] = useState('')

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
    const token = localStorage.getItem('token')
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

  const { createMutation, updateMutation } = useLessonPlanMutations()

  const handleSavePlan = async (wizardData: any) => {
    const { planId: existingId, ...payload } = wizardData

    // Map wizard structure to backend API format
    const apiPayload = {
      title: payload.title,
      status: payload.status || 'DRAFT',
      evaluation_plans: payload.evaluation_plans || [],
      weekly_contents: payload.weekly_contents || [],
    }

    if (existingId || editingPlan) {
      await updateMutation.mutateAsync({ id: existingId || editingPlan!.id, ...apiPayload })
    } else {
      await createMutation.mutateAsync(apiPayload)
    }
    setIsModalOpen(false)
    setEditingPlan(null)
  }

  const filteredPlans = plans.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const columns: ColumnDef<LessonPlan>[] = [
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
              {new Date(row.original.created_at).toLocaleDateString()}
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
    {
      accessorKey: 'content',
      header: 'Objetivos',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <CheckCircle2 size={14} />
          {row.original.content?.objectives?.length || 0} objetivos
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Accion</div>,
      cell: ({ row }) => (
        <div className="flex justify-end">
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
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: filteredPlans,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
            { id: 'plans', icon: FileText, label: 'Planificaciones', count: plans.length },
            ...(userRole === 'SUPER_ADMIN'
              ? [{ id: 'users', icon: Users, label: 'Gestion de Usuarios' }]
              : [{ id: 'teachers', icon: Users, label: 'Profesores' }]),
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

          <Separator className="my-4" />

          <Button
            variant={activeTab === 'settings' ? 'default' : 'ghost'}
            className="w-full justify-start gap-3 h-12 text-base font-semibold"
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            Configuracion
          </Button>
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
          {activeTab === 'users' ? (
            <UserManagement />
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div className="space-y-2">
                  <h1 className="text-4xl lg:text-5xl font-black tracking-tighter">
                    Mis Planificaciones
                  </h1>
                  <p className="text-lg text-muted-foreground font-medium">
                    Gestiona y disena estrategias academicas de alto impacto.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="gap-2 font-extrabold text-base h-14 px-8"
                  onClick={() => setIsModalOpen(true)}
                >
                  <Plus size={22} strokeWidth={2.5} />
                  Nueva Planificacion
                </Button>
              </div>

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
                  ) : filteredPlans.length === 0 ? (
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
                            ? 'Intenta con otra busqueda.'
                            : 'Comienza creando tu primera planificacion.'}
                        </p>
                      </div>
                      {!searchQuery && (
                        <Button onClick={() => setIsModalOpen(true)}>
                          Crear Plan Ahora
                        </Button>
                      )}
                    </div>
                  ) : (
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
    </div>
  )
}
