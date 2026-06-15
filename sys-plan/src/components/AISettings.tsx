import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Cpu, Key, Database, Play, AlertTriangle, Zap, FileText, CheckCircle2, XCircle, Binary, MessageSquare, Layers, BarChart3, Download, Calendar, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush, ReferenceArea } from 'recharts'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import api from '../lib/api-client'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import AIChat from './AIChat'

export default function AISettings() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'providers' | 'templates' | 'rag' | 'chat' | 'assignments' | 'metrics'>('providers')
  
  // States for Provider Modal
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<any>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [selectedProviderType, setSelectedProviderType] = useState<string>('openai-compatible')
  
  // States for Template Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)

  // States for Assignment Modal
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<any>(null)

  // Queries for Assignments
  const { data: assignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['ai-assignments'],
    queryFn: async () => {
      const { data } = await api.get('/ai/admin/assignments')
      return data
    },
    enabled: activeTab === 'assignments',
    retry: false
  })

  const { data: allFaculties = [] } = useQuery({
    queryKey: ['dist-faculties'],
    queryFn: async () => {
      const { data } = await api.get('/distribution/faculties')
      return data
    },
    enabled: activeTab === 'assignments',
    retry: false
  })

  const { data: allDepartments = [] } = useQuery({
    queryKey: ['dist-departments'],
    queryFn: async () => {
      const { data } = await api.get('/distribution/departments')
      return data
    },
    enabled: activeTab === 'assignments',
    retry: false
  })

  const { data: allCareers = [] } = useQuery({
    queryKey: ['dist-careers'],
    queryFn: async () => {
      const { data } = await api.get('/distribution/careers')
      return data
    },
    enabled: activeTab === 'assignments',
    retry: false
  })

  const deleteAssignment = async (id: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta asignación de agente?")) return
    try {
      await api.delete(`/ai/admin/assignments/${id}`)
      toast.success("Asignación eliminada")
      refetchAssignments()
    } catch (e) {
      toast.error("Error al eliminar asignación")
    }
  }

  // States for Metrics Filters
  const getWeekDates = () => {
    const today = new Date();
    const day = today.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
    
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - day);
    
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + (6 - day));
    
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${d}`;
    };
    
    return {
      sunday: formatDate(sunday),
      saturday: formatDate(saturday)
    };
  };

  const weekDates = getWeekDates();
  const [metricsStartDate, setMetricsStartDate] = useState(weekDates.sunday)
  const [metricsEndDate, setMetricsEndDate] = useState(weekDates.saturday)

  const [metricsViewMode, setMetricsViewMode] = useState<'total' | 'provider' | 'model'>('total')
  const [selectedMetricsProvider, setSelectedMetricsProvider] = useState<string>('')
  const [selectedMetricsModel, setSelectedMetricsModel] = useState<string>('')

  // Query for Metrics Summary
  const { data: metricsSummary, isLoading: loadingMetrics, refetch: refetchMetrics } = useQuery({
    queryKey: ['ai-metrics-summary', metricsStartDate, metricsEndDate],
    queryFn: async () => {
      const { data } = await api.get('/ai/admin/metrics/summary/', {
        params: {
          start_date: metricsStartDate || undefined,
          end_date: metricsEndDate || undefined
        }
      })
      return data
    },
    enabled: activeTab === 'metrics',
    retry: false
  })

  useEffect(() => {
    if (metricsSummary) {
      if (metricsSummary.available_providers && metricsSummary.available_providers.length > 0 && !selectedMetricsProvider) {
        setSelectedMetricsProvider(metricsSummary.available_providers[0])
      }
      if (metricsSummary.available_models && metricsSummary.available_models.length > 0 && !selectedMetricsModel) {
        setSelectedMetricsModel(metricsSummary.available_models[0])
      }
    }
  }, [metricsSummary, selectedMetricsProvider, selectedMetricsModel])

  const handleExportEvaluations = async () => {
    try {
      const { data } = await api.get('/ai/admin/metrics/evaluations/export/', {
        params: {
          start_date: metricsStartDate || undefined,
          end_date: metricsEndDate || undefined
        },
        responseType: 'blob'
      })
      const blob = new Blob([data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_evaluaciones_ia_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      toast.error("Error al exportar evaluaciones")
    }
  }

  const handleExportChats = async () => {
    try {
      const { data } = await api.get('/ai/admin/metrics/chats/export/', {
        params: {
          start_date: metricsStartDate || undefined,
          end_date: metricsEndDate || undefined
        },
        responseType: 'blob'
      })
      const blob = new Blob([data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_chats_ia_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      toast.error("Error al exportar chats")
    }
  }

  const handleExportTokens = async () => {
    try {
      const { data } = await api.get('/ai/admin/metrics/tokens/export/', {
        params: {
          start_date: metricsStartDate || undefined,
          end_date: metricsEndDate || undefined
        },
        responseType: 'blob'
      })
      const blob = new Blob([data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_consumo_tokens_ia_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      toast.error("Error al exportar reporte de consumo de tokens")
    }
  }

  const openAssignmentModal = (a: any = null) => {
    setEditingAssignment(a)
    setIsAssignmentModalOpen(true)
  }

  const saveAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const payload = Object.fromEntries(formData.entries())
    try {
      if (editingAssignment?.id) {
        await api.put(`/ai/admin/assignments/${editingAssignment.id}`, payload)
        toast.success('Asignación actualizada')
      } else {
        await api.post('/ai/admin/assignments', payload)
        toast.success('Asignación creada')
      }
      refetchAssignments()
      setIsAssignmentModalOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al guardar asignación')
    }
  }

  // States for Logs
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false)
  const [ragLogs, setRagLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [selectedLog, setSelectedLog] = useState<any>(null)

  // State for available models
  const [availableModels, setAvailableModels] = useState<string[]>([])

  const fetchLogs = async () => {
    setLoadingLogs(true)
    try {
      const { data } = await api.get('/ai/admin/rag-logs/')
      setRagLogs(data)
    } catch (e) {
      toast.error('Error al cargar los logs')
    } finally {
      setLoadingLogs(false)
    }
  }

  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({})
  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: async () => {
      // Proxy route /ai/admin/providers to sys-ai
      const { data } = await api.get('/ai/admin/providers')
      return data
    },
    // We don't have the backend ready yet, so catch error and return empty array
    retry: false
  })

  const [selectedSyncProviderId, setSelectedSyncProviderId] = useState<string>('')

  useEffect(() => {
    const active = providers.filter((p: any) => p.is_active)
    if (active.length > 0 && !selectedSyncProviderId) {
      setSelectedSyncProviderId(active[0].id.toString())
    }
  }, [providers, selectedSyncProviderId])

  const { mutate: testConnection, isPending: isTesting, variables: testVariables } = useMutation({
    mutationFn: async (payload: any) => {
      // Support passing id directly (from table) or payload (from modal)
      const body = typeof payload === 'number' ? { provider_id: payload } : payload
      const { data } = await api.post('/ai/admin/test-provider/', body)
      return { ...data, targetKey: body.provider_id ? `${body.provider_id}-${body.test_target || 'all'}` : null }
    },
    onMutate: () => {
      setTestError(null)
    },
    onSuccess: (data, variables) => {
      toast.success(data.message || 'Conexión exitosa')
      setTestError(null)
      if (data.targetKey) {
        setTestResults(prev => ({ ...prev, [data.targetKey]: 'success' }))
      }
      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models)
      }
    },
    onError: (error: any, variables) => {
      const errMsg = error.response?.data?.error || 'Error al probar conexión'
      toast.error(errMsg)
      setTestError(errMsg)
      const body = typeof variables === 'number' ? { provider_id: variables } : variables
      if (body.provider_id) {
        const targetKey = `${body.provider_id}-${body.test_target || 'all'}`
        setTestResults(prev => ({ ...prev, [targetKey]: 'error' }))
      }
    }
  })

  const handleTestModal = () => {
    const form = document.getElementById('provider-form') as HTMLFormElement
    if (!form) return
    const formData = new FormData(form)
    const payload = Object.fromEntries(formData.entries())
    if (editingProvider?.id) {
       payload.provider_id = editingProvider.id
    }
    testConnection(payload)
  }

  const openProviderModal = (p: any = null) => {
    setEditingProvider(p)
    setSelectedProviderType(p?.provider_type || 'openai-compatible')
    setAvailableModels([])
    setTestError(null)
    setIsProviderModalOpen(true)
  }

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['ai-templates'],
    queryFn: async () => {
      const { data } = await api.get('/ai/admin/templates')
      return data
    },
    retry: false
  })

  const { data: ragStatus, isLoading: loadingRag, refetch: refetchRag } = useQuery({
    queryKey: ['ai-rag-status'],
    queryFn: async () => {
      const { data } = await api.get('/ai/admin/rag-status/')
      return data
    },
    enabled: activeTab === 'rag',
    refetchInterval: (query) => {
      // Polling every 3s if not fully synced
      const data = query.state.data as any
      if (data && (!data.is_fully_synced || !data.is_plans_fully_synced) && (data.total_active_syllabuses > 0 || data.total_approved_plans > 0)) {
        return 3000;
      }
      return false;
    },
    retry: false
  })

  const { mutate: syncAll, isPending: isSyncing } = useMutation({
    mutationFn: async (providerId?: number) => {
      const { data } = await api.post('/ai/admin/sync-all/', providerId ? { provider_id: providerId } : {})
      return data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Sincronización iniciada en segundo plano')
      // Refetch after a small delay to see progress if fast
      setTimeout(() => refetchRag(), 2000)
    },
    onError: () => {
      toast.error('Error al iniciar la sincronización de sinópticos')
    }
  })

  const { mutate: syncAllPlans, isPending: isSyncingPlans } = useMutation({
    mutationFn: async (providerId?: number) => {
      const { data } = await api.post('/ai/admin/sync-all-plans/', providerId ? { provider_id: providerId } : {})
      return data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Sincronización de planes iniciada')
      setTimeout(() => refetchRag(), 2000)
    },
    onError: () => {
      toast.error('Error al iniciar la sincronización de planes')
    }
  })

  const { mutate: cancelSync, isPending: isCancelling } = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/ai/admin/cancel-sync/')
      return data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Sincronización detenida')
      refetchRag()
    },
    onError: () => {
      toast.error('Error al intentar detener la sincronización')
    }
  })

  // Mutations would go here (omitted for brevity, will implement if backend is ready)
  const saveProvider = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const payload = Object.fromEntries(formData.entries())
    try {
      if (editingProvider?.id) {
        await api.put(`/ai/admin/providers/${editingProvider.id}`, payload)
        toast.success('Proveedor actualizado')
      } else {
        await api.post('/ai/admin/providers', payload)
        toast.success('Proveedor creado')
      }
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] })
      setIsProviderModalOpen(false)
    } catch (error) {
      toast.error('Error al guardar proveedor')
    }
  }

  const deleteProvider = async (id: number) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este proveedor?')) return
    try {
      await api.delete(`/ai/admin/providers/${id}`)
      toast.success('Proveedor eliminado')
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] })
    } catch (error) {
      toast.error('Error al eliminar proveedor')
    }
  }

  const saveTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const payload: any = Object.fromEntries(formData.entries())
    payload.enabled_tools = formData.getAll('enabled_tools')
    try {
      if (editingTemplate?.id) {
        await api.put(`/ai/admin/templates/${editingTemplate.id}`, payload)
        toast.success('Agente actualizado')
      } else {
        await api.post('/ai/admin/templates', payload)
        toast.success('Agente creado')
      }
      queryClient.invalidateQueries({ queryKey: ['ai-templates'] })
      setIsTemplateModalOpen(false)
    } catch (error) {
      toast.error('Error al guardar agente')
    }
  }

  const hasActiveProvider = providers.some((p: any) => p.is_active)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter">Configuración de Inteligencia Artificial</h2>
          <p className="text-muted-foreground mt-1 text-lg">
            Gestiona los proveedores de IA, llaves de API y los agentes que evaluarán las planificaciones.
          </p>
        </div>
      </div>

      {!hasActiveProvider && !loadingProviders && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start gap-3 shadow-sm">
          <AlertTriangle className="text-red-500 mt-0.5" size={20} />
          <div>
            <h3 className="text-red-800 font-bold text-sm">Alerta del Sistema: Modelo IA no configurado</h3>
            <p className="text-red-700 text-sm mt-1">
              El sistema no tiene un modelo de Inteligencia Artificial configurado o activo en este momento. 
              Cualquier proceso que requiera IA (como vectorización o evaluación de planes) fallará hasta que configures uno.
              Por favor ve a <b>Proveedores & APIs</b> para configurarlo.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-4 border-b pb-2">
        <Button 
          variant={activeTab === 'providers' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('providers')}
          className="gap-2"
        >
          <Database size={18} />
          Proveedores & APIs
        </Button>
        <Button 
          variant={activeTab === 'templates' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('templates')}
          className="gap-2"
        >
          <Cpu size={18} />
          Agentes IA (RAG)
        </Button>
        <Button 
          variant={activeTab === 'assignments' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('assignments')}
          className="gap-2"
        >
          <Layers size={18} />
          Asignación de Agentes
        </Button>
        <Button 
          variant={activeTab === 'rag' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('rag')}
          className="gap-2"
        >
          <Database size={18} />
          Estado del RAG
        </Button>
        <Button 
          variant={activeTab === 'chat' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('chat')}
          className="gap-2"
          disabled={!hasActiveProvider}
        >
          <MessageSquare size={18} />
          Chat RAG
        </Button>
        <Button 
          variant={activeTab === 'metrics' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('metrics')}
          className="gap-2"
        >
          <BarChart3 size={18} />
          Métricas de Uso
        </Button>
      </div>

      {activeTab === 'providers' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Proveedores de IA</CardTitle>
              <CardDescription>Configura los endpoints y claves para OpenAI, DeepSeek, Anthropic, Qwen, etc.</CardDescription>
            </div>
            <Button onClick={() => openProviderModal(null)} className="gap-2">
              <Plus size={16} /> Nuevo Proveedor
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo / Modelo</TableHead>
                  <TableHead>Base URL</TableHead>
                  <TableHead>Límite Contexto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No hay proveedores configurados.
                    </TableCell>
                  </TableRow>
                ) : (
                  providers.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold">{p.name}</TableCell>
                      <TableCell>{p.provider_type}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{p.base_url || 'N/A'}</TableCell>
                      <TableCell className="text-xs font-semibold">{p.context_limit ? `${p.context_limit.toLocaleString()} carac.` : '2,000 carac.'}</TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? 'default' : 'secondary'}>
                          {p.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => testConnection({ provider_id: p.id, test_target: 'all' })} disabled={isTesting} title="Probar Conexión General (Listar Modelos)">
                          {testResults[`${p.id}-all`] === 'success' ? (
                            <CheckCircle2 size={16} className="text-emerald-500" />
                          ) : testResults[`${p.id}-all`] === 'error' ? (
                            <XCircle size={16} className="text-red-500" />
                          ) : (
                            <Zap size={16} className={isTesting && testVariables?.test_target === 'all' && testVariables?.provider_id === p.id ? 'animate-pulse text-amber-500' : 'text-amber-500'} />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => testConnection({ provider_id: p.id, test_target: 'embedding' })} disabled={isTesting || !p.embedding_model} title={p.embedding_model ? `Probar Embeddings (${p.embedding_model})` : 'Configura un modelo de Embeddings primero'}>
                          {testResults[`${p.id}-embedding`] === 'success' ? (
                            <CheckCircle2 size={16} className="text-emerald-500" />
                          ) : testResults[`${p.id}-embedding`] === 'error' ? (
                            <XCircle size={16} className="text-red-500" />
                          ) : (
                            <Binary size={16} className={isTesting && testVariables?.test_target === 'embedding' && testVariables?.provider_id === p.id ? 'animate-pulse text-blue-500' : 'text-slate-400'} />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => testConnection({ provider_id: p.id, test_target: 'llm' })} disabled={isTesting || !p.llm_model} title={p.llm_model ? `Probar LLM (${p.llm_model})` : 'Configura un modelo LLM primero'}>
                          {testResults[`${p.id}-llm`] === 'success' ? (
                            <CheckCircle2 size={16} className="text-emerald-500" />
                          ) : testResults[`${p.id}-llm`] === 'error' ? (
                            <XCircle size={16} className="text-red-500" />
                          ) : (
                            <MessageSquare size={16} className={isTesting && testVariables?.test_target === 'llm' && testVariables?.provider_id === p.id ? 'animate-pulse text-purple-500' : 'text-slate-400'} />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openProviderModal(p)} title="Editar Proveedor">
                          <Edit size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteProvider(p.id)} title="Eliminar Proveedor" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'templates' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Agentes de Evaluación</CardTitle>
              <CardDescription>Define cómo la IA evaluará las planificaciones leyendo los programas sinópticos.</CardDescription>
            </div>
            <Button onClick={() => { setEditingTemplate(null); setIsTemplateModalOpen(true) }} className="gap-2">
              <Plus size={16} /> Nuevo Agente
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Agente</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No hay agentes configurados.
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-bold">{t.name}</TableCell>
                      <TableCell>{t.provider_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.description}</TableCell>
                      <TableCell>
                        <Badge variant={t.is_active ? 'default' : 'secondary'}>
                          {t.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingTemplate(t); setIsTemplateModalOpen(true) }}>
                          <Edit size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'rag' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Estado de Sincronización RAG</CardTitle>
              <CardDescription>Verifica la sincronización de los programas sinópticos con la base de datos vectorial.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => { setIsLogsModalOpen(true); fetchLogs(); }} variant="outline" className="gap-2">
                <FileText size={16} /> Ver Logs
              </Button>
              <Button onClick={() => refetchRag()} variant="outline" className="gap-2" disabled={loadingRag || isSyncing}>
                <Play size={16} /> Actualizar
              </Button>
              
              <div className="flex items-center gap-2 border rounded-md px-2 py-1 bg-background">
                <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Proveedor:</label>
                <Select value={selectedSyncProviderId} onValueChange={setSelectedSyncProviderId}>
                  <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {providers.filter((p: any) => p.is_active).map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={() => { 
                const pid = selectedSyncProviderId ? Number(selectedSyncProviderId) : undefined;
                syncAll(pid); 
                syncAllPlans(pid); 
              }} className="gap-2" disabled={!hasActiveProvider || isSyncing || isSyncingPlans || loadingRag || (ragStatus?.is_fully_synced && ragStatus?.is_plans_fully_synced)}>
                <Database size={16} /> Sincronizar Todos
              </Button>

              {ragStatus && (!ragStatus.is_fully_synced || !ragStatus.is_plans_fully_synced) && (
                <Button onClick={() => cancelSync()} variant="destructive" className="gap-2" disabled={isCancelling}>
                  <XCircle size={16} /> Detener Sincronización
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingRag ? (
              <p className="text-center py-8 text-muted-foreground">Cargando estado...</p>
            ) : ragStatus ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
                    <p className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-2">Total Sinópticos</p>
                    <p className="text-5xl font-black text-blue-600">{ragStatus.total_active_syllabuses}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 text-center">
                    <p className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-2">Vectorizados</p>
                    <p className="text-5xl font-black text-emerald-600">{ragStatus.total_synced}</p>
                  </div>
                  <div className={`border rounded-xl p-6 flex flex-col justify-center items-center ${ragStatus.is_fully_synced ? 'bg-emerald-100 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${ragStatus.is_fully_synced ? 'text-emerald-800' : 'text-amber-800'}`}>Estado Sinópticos</p>
                    <Badge variant={ragStatus.is_fully_synced ? 'default' : 'destructive'} className="text-lg px-4 py-1">
                      {ragStatus.is_fully_synced ? 'Sincronizado' : 'Incompleto'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-center">
                    <p className="text-sm font-bold text-indigo-800 uppercase tracking-wider mb-2">Planes Aprobados</p>
                    <p className="text-5xl font-black text-indigo-600">{ragStatus.total_approved_plans}</p>
                  </div>
                  <div className="bg-teal-50 border border-teal-100 rounded-xl p-6 text-center">
                    <p className="text-sm font-bold text-teal-800 uppercase tracking-wider mb-2">Vectorizados</p>
                    <p className="text-5xl font-black text-teal-600">{ragStatus.total_synced_plans}</p>
                  </div>
                  <div className={`border rounded-xl p-6 flex flex-col justify-center items-center ${ragStatus.is_plans_fully_synced ? 'bg-teal-100 border-teal-200' : 'bg-orange-50 border-orange-200'}`}>
                    <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${ragStatus.is_plans_fully_synced ? 'text-teal-800' : 'text-orange-800'}`}>Estado Planes</p>
                    <Badge variant={ragStatus.is_plans_fully_synced ? 'default' : 'destructive'} className="text-lg px-4 py-1">
                      {ragStatus.is_plans_fully_synced ? 'Sincronizado' : 'Incompleto'}
                    </Badge>
                  </div>
                </div>

                {/* Progress bar logic (shows when syncing and there are >0 total) */}
                {(!ragStatus.is_fully_synced && ragStatus.total_active_syllabuses > 0) && (
                  <div className="mt-6 p-4 border rounded-xl bg-slate-50">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-bold text-slate-700">Progreso de Sincronización (Sinópticos)</p>
                      <p className="text-sm font-medium text-slate-500">
                        Procesados: {ragStatus.total_synced} de {ragStatus.total_active_syllabuses} documentos ({Math.round((ragStatus.total_synced / ragStatus.total_active_syllabuses) * 100)}%)
                      </p>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.round((ragStatus.total_synced / ragStatus.total_active_syllabuses) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center animate-pulse">
                      {ragStatus.current_task_detail || "La IA está vectorizando documentos en segundo plano. Esto puede demorar varios minutos dependiendo de la carga."}
                    </p>
                  </div>
                )}

                {(!ragStatus.is_plans_fully_synced && ragStatus.total_approved_plans > 0) && (
                  <div className="mt-6 p-4 border rounded-xl bg-slate-50">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-bold text-slate-700">Progreso de Sincronización (Planes)</p>
                      <p className="text-sm font-medium text-slate-500">
                        Procesados: {ragStatus.total_synced_plans} de {ragStatus.total_approved_plans} documentos ({Math.round((ragStatus.total_synced_plans / ragStatus.total_approved_plans) * 100)}%)
                      </p>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div 
                        className="bg-teal-600 h-2.5 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.round((ragStatus.total_synced_plans / ragStatus.total_approved_plans) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center animate-pulse">
                      {ragStatus.current_task_detail || "La IA está vectorizando planes en segundo plano. Esto puede demorar varios minutos dependiendo de la carga."}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center py-8 text-red-500">No se pudo cargar el estado del RAG.</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'assignments' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Asignaciones de Agentes</CardTitle>
              <CardDescription>Asigna agentes de IA específicos a determinadas áreas, carreras, asignaturas o facultades.</CardDescription>
            </div>
            <Button onClick={() => openAssignmentModal(null)} className="gap-2">
              <Plus size={16} /> Nueva Asignación
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente IA</TableHead>
                  <TableHead>Nivel de Asignación</TableHead>
                  <TableHead>Detalle de Asignación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No hay asignaciones registradas. El sistema utilizará el agente activo por defecto.
                    </TableCell>
                  </TableRow>
                ) : (
                  assignments.map((a: any) => {
                    let level = "Global"
                    let detail = "-"
                    if (a.subject_code) {
                      level = "Asignatura"
                      detail = `Código: ${a.subject_code}`
                      if (a.section) {
                        detail += ` | Secc: ${a.section}`
                      }
                    } else if (a.career_id) {
                      level = "Carrera"
                      detail = a.career_name || `ID: ${a.career_id}`
                    } else if (a.department_id) {
                      level = "Departamento"
                      detail = a.department_name || `ID: ${a.department_id}`
                    } else if (a.faculty_id) {
                      level = "Facultad"
                      detail = a.faculty_name || `ID: ${a.faculty_id}`
                    }
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-bold">{a.agent_name}</TableCell>
                        <TableCell><Badge variant="outline">{level}</Badge></TableCell>
                        <TableCell>{detail}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={a.is_active ? 'default' : 'secondary'}
                            className={`cursor-pointer select-none transition-colors ${!hasActiveProvider ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={async () => {
                              if (!hasActiveProvider) {
                                toast.error("El sistema de IA no está activo. Active un proveedor primero.")
                                return
                              }
                              try {
                                await api.put(`/ai/admin/assignments/${a.id}`, { is_active: !a.is_active })
                                toast.success(!a.is_active ? "Asignación activada" : "Asignación desactivada")
                                refetchAssignments()
                              } catch (err) {
                                toast.error("Error al actualizar estado")
                              }
                            }}
                          >
                            {a.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {(() => {
                            const date = new Date(a.created_at)
                            if (isNaN(date.getTime())) return "-"
                            const day = String(date.getDate()).padStart(2, '0')
                            const month = String(date.getMonth() + 1).padStart(2, '0')
                            const year = date.getFullYear()
                            return `${day}/${month}/${year}`
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openAssignmentModal(a)} title="Editar Asignación" className="mr-1">
                            <Edit size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => deleteAssignment(a.id)} title="Eliminar Asignación">
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'chat' && (
        <AIChat />
      )}

      {activeTab === 'metrics' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Filters Card */}
          <Card className="backdrop-blur-md bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <BarChart3 size={18} className="text-primary" />
                Filtros y Descarga de Historial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Calendar size={12} />
                    Fecha de Inicio
                  </label>
                  <Input
                    type="date"
                    className="h-10 text-sm"
                    value={metricsStartDate}
                    onChange={(e) => setMetricsStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Calendar size={12} />
                    Fecha de Fin
                  </label>
                  <Input
                    type="date"
                    className="h-10 text-sm"
                    value={metricsEndDate}
                    onChange={(e) => setMetricsEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-bold text-xs"
                  onClick={() => {
                    setMetricsStartDate('')
                    setMetricsEndDate('')
                  }}
                >
                  Limpiar Filtros
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-bold text-xs gap-1"
                    onClick={() => refetchMetrics()}
                    disabled={loadingMetrics}
                  >
                    <RefreshCw size={14} className={loadingMetrics ? 'animate-spin' : ''} />
                    Actualizar
                  </Button>
                  <Button
                    size="sm"
                    className="font-bold text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleExportEvaluations}
                    disabled={loadingMetrics}
                  >
                    <Download size={14} />
                    Exportar Evaluaciones (CSV)
                  </Button>
                  <Button
                    size="sm"
                    className="font-bold text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleExportChats}
                    disabled={loadingMetrics}
                  >
                    <Download size={14} />
                    Exportar Chats (CSV)
                  </Button>
                  <Button
                    size="sm"
                    className="font-bold text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={handleExportTokens}
                    disabled={loadingMetrics}
                  >
                    <Download size={14} />
                    Exportar Consumo de Tokens (CSV)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {loadingMetrics ? (
            <div className="py-16 text-center text-slate-400 flex flex-col justify-center items-center gap-3">
              <Loader2 className="animate-spin text-primary" size={32} />
              <span className="font-semibold text-sm">Cargando métricas de uso de IA de la base de datos...</span>
            </div>
          ) : metricsSummary ? (
            <div className="space-y-6">
              {/* KPIs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-gradient-to-br from-indigo-50/50 to-white border-indigo-100 shadow-sm">
                  <CardContent className="pt-6">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Evaluaciones Realizadas</span>
                    <h3 className="text-3xl font-black tracking-tight mt-1">{metricsSummary.total_evaluations}</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-medium font-sans">Planes de clase procesados</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50/50 to-white border-emerald-100 shadow-sm">
                  <CardContent className="pt-6">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Evaluaciones Exitosas</span>
                    <h3 className="text-3xl font-black tracking-tight mt-1 text-emerald-600">{metricsSummary.success_evaluations}</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-medium font-sans">Cumplieron directrices</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-rose-50/50 to-white border-rose-100 shadow-sm">
                  <CardContent className="pt-6">
                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Tasa de Errores</span>
                    <h3 className="text-3xl font-black tracking-tight mt-1 text-rose-600">{metricsSummary.failed_evaluations}</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-medium font-sans">Fallas de API o proveedor</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50/50 to-white border-blue-100 shadow-sm">
                  <CardContent className="pt-6">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Mensajes de Chat</span>
                    <h3 className="text-3xl font-black tracking-tight mt-1">{metricsSummary.total_messages}</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-medium font-sans">En {metricsSummary.total_chats} sesiones activas</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tokens Consumed Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-amber-50/40 to-white border-amber-100 shadow-sm">
                  <CardContent className="pt-6">
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Tokens Totales Consumidos</span>
                    <h3 className="text-3xl font-black tracking-tight mt-1 text-amber-800">{metricsSummary.total_tokens?.toLocaleString() || 0}</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-medium font-sans">Suma de entrada y salida</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-slate-50/50 to-white border-slate-200 shadow-sm">
                  <CardContent className="pt-6">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tokens de Entrada (Prompt)</span>
                    <h3 className="text-3xl font-black tracking-tight mt-1">{metricsSummary.total_prompt_tokens?.toLocaleString() || 0}</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-medium font-sans">Enviados en peticiones de análisis</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-slate-50/50 to-white border-slate-200 shadow-sm">
                  <CardContent className="pt-6">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tokens de Salida (Completion)</span>
                    <h3 className="text-3xl font-black tracking-tight mt-1">{metricsSummary.total_completion_tokens?.toLocaleString() || 0}</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-medium font-sans">Generados por el modelo de IA</p>
                  </CardContent>
                </Card>
              </div>

              {(() => {
                let tokensSeries = metricsSummary.tokens_series || [];
                if (metricsViewMode === 'provider' && selectedMetricsProvider) {
                  tokensSeries = (metricsSummary.tokens_series_by_provider || {})[selectedMetricsProvider] || [];
                } else if (metricsViewMode === 'model' && selectedMetricsModel) {
                  tokensSeries = (metricsSummary.tokens_series_by_model || {})[selectedMetricsModel] || [];
                }

                const todayIndex = tokensSeries.findIndex((d: any) => d.is_today);
                let chartStartIndex = 0;
                let chartEndIndex = tokensSeries.length - 1;
                if (todayIndex !== -1) {
                  chartStartIndex = Math.max(0, todayIndex - 3);
                  chartEndIndex = Math.min(tokensSeries.length - 1, todayIndex + 3);
                }

                return (
                  <Card className="shadow-lg border-border bg-card">
                    <CardHeader>
                      <CardTitle className="text-md font-bold flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <span>Consumo Diario de Tokens (Prompt vs Completion)</span>
                        <div className="flex items-center gap-3">
                          {/* Selector de Modo */}
                          <Select value={metricsViewMode} onValueChange={(val: any) => setMetricsViewMode(val)}>
                            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Ver por" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="total">Consumo Total</SelectItem>
                              <SelectItem value="provider">Por Proveedor</SelectItem>
                              <SelectItem value="model">Por Modelo</SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Selector de Proveedor */}
                          {metricsViewMode === 'provider' && (
                            <Select value={selectedMetricsProvider} onValueChange={setSelectedMetricsProvider}>
                              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Proveedor" /></SelectTrigger>
                              <SelectContent>
                                {(metricsSummary.available_providers || []).map((p: string) => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {/* Selector de Modelo */}
                          {metricsViewMode === 'model' && (
                            <Select value={selectedMetricsModel} onValueChange={setSelectedMetricsModel}>
                              <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Modelo" /></SelectTrigger>
                              <SelectContent>
                                {(metricsSummary.available_models || []).map((m: string) => (
                                  <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </CardTitle>
                      <CardDescription>Visualiza el volumen histórico de tokens procesados por día en evaluaciones y vectorizaciones.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full mt-4">
                        {tokensSeries.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={tokensSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorPrompt" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorCompletion" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                              
                              {/* Sombreado alterno por semanas para dar matices */}
                              {[...Array(13)].map((_, i) => (
                                <ReferenceArea 
                                  key={`week-shade-${i}`} 
                                  x1={`S${i}-Lun`} 
                                  x2={`S${i}-Dom`} 
                                  fill={i % 2 === 0 ? 'hsl(var(--muted))' : 'transparent'} 
                                  fillOpacity={0.4} 
                                />
                              ))}

                              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
                              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  borderColor: 'hsl(var(--border))',
                                  color: 'hsl(var(--card-foreground))',
                                  borderRadius: '8px'
                                }}
                              />
                              <Legend verticalAlign="top" height={36} />
                              <Area 
                                type="monotone" 
                                name="Tokens Entrada (Prompt)" 
                                dataKey="prompt_tokens" 
                                stroke="#f59e0b" 
                                fillOpacity={1} 
                                fill="url(#colorPrompt)" 
                                strokeWidth={2} 
                              />
                              <Area 
                                type="monotone" 
                                name="Tokens Salida (Completion)" 
                                dataKey="completion_tokens" 
                                stroke="#10b981" 
                                fillOpacity={1} 
                                fill="url(#colorCompletion)" 
                                strokeWidth={2} 
                              />
                              <Brush 
                                dataKey="name" 
                                height={24} 
                                stroke="hsl(var(--border))" 
                                fill="hsl(var(--card))"
                                travellerWidth={8}
                                startIndex={chartStartIndex}
                                endIndex={chartEndIndex}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                            <BarChart3 className="h-10 w-10 mb-2 opacity-50" />
                            <p className="text-sm">No hay suficientes datos de consumo diario en este rango de fechas.</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Middle Section: Agent Evals & Top Chatters */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Agent Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-md font-bold">Uso por Agente de IA</CardTitle>
                    <CardDescription>Distribución del volumen de evaluaciones por cada agente configurado.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metricsSummary.agent_evaluations.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-8">No hay datos para mostrar.</p>
                    ) : (
                      <div className="space-y-4">
                        {metricsSummary.agent_evaluations.map((ae: any, i: number) => (
                          <div key={i} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs font-semibold">
                              <span>{ae.name}</span>
                              <span>{ae.count} ({Math.round((ae.count / (metricsSummary.total_evaluations || 1)) * 100)}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div
                                className="bg-indigo-600 h-2 rounded-full"
                                style={{ width: `${(ae.count / (metricsSummary.total_evaluations || 1)) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Users in Chat */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-md font-bold">Top Usuarios en Chat</CardTitle>
                    <CardDescription>Usuarios con mayor nivel de adopción e interacción con el Chat de IA.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metricsSummary.top_chatters.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-8 font-sans">No hay datos de chat registrados.</p>
                    ) : (
                      <div className="border border-border/40 rounded-xl overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="text-xs font-bold">Nombre</TableHead>
                              <TableHead className="text-xs font-bold">Rol</TableHead>
                              <TableHead className="text-xs font-bold text-right">Sesiones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {metricsSummary.top_chatters.map((tc: any, i: number) => (
                              <TableRow key={i} className="hover:bg-muted/20">
                                <TableCell className="py-2.5">
                                  <div className="text-xs font-bold">{tc.full_name}</div>
                                  <div className="text-[10px] text-muted-foreground">{tc.email}</div>
                                </TableCell>
                                <TableCell className="py-2.5">
                                  <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold">{tc.role}</Badge>
                                </TableCell>
                                <TableCell className="text-right py-2.5 text-xs font-extrabold">{tc.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Last 10 Evaluations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-md font-bold">Últimas Evaluaciones Realizadas por la IA</CardTitle>
                  <CardDescription>Auditoría rápida del estado y observaciones de los planes procesados.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                  {metricsSummary.last_evaluations.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8 font-sans">No hay evaluaciones recientes registradas.</p>
                  ) : (
                    <div className="border border-border/60 rounded-xl overflow-hidden bg-background/50">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow>
                            <TableHead className="font-bold text-xs">Plan de Clase</TableHead>
                            <TableHead className="font-bold text-xs">Asignatura</TableHead>
                            <TableHead className="font-bold text-xs">Docente</TableHead>
                            <TableHead className="font-bold text-xs">Agente</TableHead>
                            <TableHead className="font-bold text-xs">Estado</TableHead>
                            <TableHead className="font-bold text-xs text-center">Observaciones</TableHead>
                            <TableHead className="font-bold text-xs text-center">Tokens (E/S)</TableHead>
                            <TableHead className="font-bold text-xs">Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {metricsSummary.last_evaluations.map((ev: any) => (
                            <TableRow key={ev.id} className="hover:bg-muted/20">
                              <TableCell className="py-3 text-xs font-bold">{ev.lesson_plan_title}</TableCell>
                              <TableCell className="py-3 text-xs font-mono">{ev.subject_code}</TableCell>
                              <TableCell className="py-3 text-xs font-medium">{ev.author_name}</TableCell>
                              <TableCell className="py-3 text-xs text-slate-500">{ev.agent_name}</TableCell>
                              <TableCell className="py-3">
                                <Badge variant={ev.status === 'SUCCESS' ? 'default' : ev.status === 'PROCESSING' ? 'secondary' : 'destructive'} className="text-[10px] font-bold">
                                  {ev.status === 'SUCCESS' ? 'Completado' : ev.status === 'PROCESSING' ? 'Procesando' : 'Error'}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 text-center text-xs font-extrabold">{ev.status === 'SUCCESS' ? ev.observations_count : '-'}</TableCell>
                              <TableCell className="py-3 text-center text-xs font-mono text-slate-500">
                                {ev.status === 'SUCCESS' ? `${ev.prompt_tokens} / ${ev.completion_tokens}` : '-'}
                              </TableCell>
                              <TableCell className="py-3 text-[11px] text-slate-400">
                                {new Date(ev.created_at).toLocaleDateString()} {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center py-8 text-red-500">Error al cargar métricas de la IA.</p>
          )}
        </div>
      )}

      {/* Provider Modal */}
      <Dialog open={isProviderModalOpen} onOpenChange={setIsProviderModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
          </DialogHeader>
          <form id="provider-form" onSubmit={saveProvider} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre (Ej. OpenAI, DeepSeek, Qwen Local)</label>
              <Input name="name" defaultValue={editingProvider?.name} required />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo de Proveedor</label>
              <Select 
                name="provider_type" 
                defaultValue={editingProvider?.provider_type || 'openai-compatible'}
                onValueChange={(val) => setSelectedProviderType(val)}
              >
                <SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (Oficial)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="google">Google Gemini (Oficial)</SelectItem>
                  <SelectItem value="openai-compatible">Compatible con OpenAI (DeepSeek, Qwen)</SelectItem>
                  <SelectItem value="lmstudio">LMStudio (Local IA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              {(() => {
                const getUrlHelperJSX = (type: string) => {
                  switch (type) {
                    case 'google':
                      return {
                        placeholder: 'Dejar en blanco (Google API oficial)',
                        info: <span>No es necesario configurar Base URL para Google Gemini oficial.</span>
                      }
                    case 'lmstudio':
                      return {
                        placeholder: 'http://host.docker.internal:1234/v1',
                        info: <span>LM Studio local. Usa <b>http://host.docker.internal:1234/v1</b> si usas Docker en Windows, o <b>http://localhost:1234/v1</b> si ejecutas en local directo sin Docker.</span>
                      }
                    case 'openai':
                      return {
                        placeholder: 'Dejar en blanco (Usa https://api.openai.com/v1 por defecto)',
                        info: <span>Opcional. Modifica este valor únicamente si utilizas un proxy o gateway personalizado para OpenAI.</span>
                      }
                    case 'anthropic':
                      return {
                        placeholder: 'Dejar en blanco (Usa oficial por defecto)',
                        info: <span>Opcional. Modifica únicamente si usas un proxy o endpoint intermedio para Anthropic.</span>
                      }
                    case 'openai-compatible':
                    default:
                      return {
                        placeholder: 'Ej: https://api.deepseek.com/v1 o http://host.docker.internal:11434/v1',
                        info: <span>Requerido para servicios compatibles (ej. <b>https://api.deepseek.com/v1</b> para DeepSeek, o <b>http://host.docker.internal:11434/v1</b> para Ollama).</span>
                      }
                  }
                }
                const urlHelper = getUrlHelperJSX(selectedProviderType)
                return (
                  <>
                    <label className="text-sm font-medium">Base URL (Sugerencias según tipo)</label>
                    <Input name="base_url" autoComplete="off" defaultValue={editingProvider?.base_url} placeholder={urlHelper.placeholder} />
                    <p className="text-xs text-muted-foreground mt-1">{urlHelper.info}</p>
                  </>
                )
              })()}
            </div>
            <div>
              <label className="text-sm font-medium">API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input name="api_key" type="password" autoComplete="new-password" className="pl-10" placeholder={editingProvider ? '*** Dejar en blanco para no cambiar ***' : 'sk-...'} required={!editingProvider} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">La llave se almacenará cifrada en la base de datos.</p>
            </div>

            <div>
              <label className="text-sm font-medium">Límite de Contexto (caracteres)</label>
              <Input 
                name="context_limit" 
                type="number" 
                min={1000} 
                max={10000} 
                defaultValue={editingProvider?.context_limit ?? 2000} 
                required 
              />
              <p className="text-xs text-muted-foreground mt-1">
                Límite de caracteres para el análisis de planes y contexto del programa sinóptico (mínimo 1,000, máximo 10,000, por defecto 2,000).
              </p>
            </div>

            <div className="pt-2">
              <Button type="button" variant="secondary" className="w-full gap-2" onClick={handleTestModal} disabled={isTesting}>
                {isTesting ? <Zap size={16} className="animate-pulse" /> : <Play size={16} />}
                Probar Conexión y Cargar Modelos
              </Button>
            </div>

            {testError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-xs space-y-1.5 animate-in fade-in duration-200">
                <p className="font-bold flex items-center gap-1">
                  <AlertTriangle size={14} className="text-red-500" />
                  Error de Conexión Detectado
                </p>
                <p className="font-mono bg-white/70 p-2 rounded border border-red-100 overflow-x-auto whitespace-pre-wrap max-h-24">
                  {testError}
                </p>
                <p className="text-[10px] text-red-600 mt-1 leading-relaxed">
                  <b>¿Estás usando Docker en Windows?</b><br />
                  1. Asegúrate de colocar <b>http://host.docker.internal:1234/v1</b> como Base URL en vez de <i>localhost</i>.<br />
                  2. Asegúrate de que LM Studio tenga habilitado el servidor local y que el modelo de embedding/texto esté cargado.
                </p>
              </div>
            )}

            {availableModels.length > 0 && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-4">
                <div>
                  <label className="text-sm font-medium">Modelo para Embeddings</label>
                  <Select name="embedding_model" defaultValue={editingProvider?.embedding_model}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {availableModels.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Modelo LLM</label>
                  <Select name="llm_model" defaultValue={editingProvider?.llm_model}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {availableModels.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <input type="checkbox" name="is_active" defaultChecked={editingProvider?.is_active ?? true} />
                Activo
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsProviderModalOpen(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Template Modal */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar Agente' : 'Nuevo Agente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveTemplate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nombre del Agente</label>
                <Input name="name" defaultValue={editingTemplate?.name} required placeholder="Ej. Evaluador Riguroso" />
              </div>
              <div>
                <label className="text-sm font-medium">Proveedor de IA a usar</label>
                <Select name="provider_id" defaultValue={editingTemplate?.provider_id?.toString()}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {providers.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input name="description" defaultValue={editingTemplate?.description} placeholder="Breve descripción de su rol" />
            </div>
            <div>
              <label className="text-sm font-medium">System Prompt (Directrices del Agente)</label>
              <Textarea 
                name="system_prompt" 
                defaultValue={editingTemplate?.system_prompt} 
                className="h-32" 
                required 
                placeholder="Eres un agente especializado en pedagogía universitaria. Tu trabajo es comparar un programa sinóptico con una planificación de clase y determinar si cumple los objetivos..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tipo de Agente</label>
                <Select name="agent_type" defaultValue={editingTemplate?.agent_type || 'chat'}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chat">Chat / RAG Agent</SelectItem>
                    <SelectItem value="evaluator">Evaluador Automático</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mt-8">
                  <input type="checkbox" name="is_active" defaultChecked={editingTemplate?.is_active ?? true} />
                  Activo
                </label>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Herramientas Permitidas (Agentic RAG)</label>
              <div className="space-y-2 mt-2 p-4 border rounded-md bg-secondary/30 text-foreground">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" name="enabled_tools" value="obtener_estadisticas_planes" defaultChecked={editingTemplate?.enabled_tools?.includes('obtener_estadisticas_planes')} />
                  Estadísticas de Planes (Cantidades)
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" name="enabled_tools" value="obtener_estadisticas_sinopticos" defaultChecked={editingTemplate?.enabled_tools?.includes('obtener_estadisticas_sinopticos')} />
                  Estadísticas de Sinópticos (Cantidades)
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" name="enabled_tools" value="busqueda_semantica_sinopticos" defaultChecked={editingTemplate?.enabled_tools?.includes('busqueda_semantica_sinopticos')} />
                  Búsqueda Semántica en Sinópticos
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" name="enabled_tools" value="busqueda_semantica_planes" defaultChecked={editingTemplate?.enabled_tools?.includes('busqueda_semantica_planes')} />
                  Búsqueda Semántica en Planes
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Selecciona qué acciones puede ejecutar la IA.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTemplateModalOpen(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assignment Modal */}
      <Dialog open={isAssignmentModalOpen} onOpenChange={setIsAssignmentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAssignment ? 'Editar Asignación de Agente' : 'Nueva Asignación de Agente'}</DialogTitle>
            <DialogDescription>Define qué agente de IA evaluará qué área académica.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveAssignment} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Agente IA a Asignar</label>
              <Select name="agent_id" required key={editingAssignment ? `agent-${editingAssignment.id}` : 'new'} defaultValue={editingAssignment?.agent_id?.toString()}>
                <SelectTrigger><SelectValue placeholder="Seleccione un agente" /></SelectTrigger>
                <SelectContent>
                  {templates.filter((t: any) => t.is_active).map((t: any) => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="border-t pt-4 space-y-4">
              <p className="text-xs text-muted-foreground font-semibold">ASIGNAR A UNO DE LOS SIGUIENTES CRITERIOS (ASIGNACIÓN ÚNICA O JERÁRQUICA):</p>
              
              <div>
                <label className="text-sm font-medium">Asignar a Facultad</label>
                <Select name="faculty_id" key={editingAssignment ? `faculty-${editingAssignment.id}` : 'new'} defaultValue={editingAssignment?.faculty_id?.toString() || 'none'}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguna</SelectItem>
                    {allFaculties.map((f: any) => (
                      <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Asignar a Departamento</label>
                <Select name="department_id" key={editingAssignment ? `dept-${editingAssignment.id}` : 'new'} defaultValue={editingAssignment?.department_id?.toString() || 'none'}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {allDepartments.map((d: any) => (
                      <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Asignar a Carrera</label>
                <Select name="career_id" key={editingAssignment ? `career-${editingAssignment.id}` : 'new'} defaultValue={editingAssignment?.career_id?.toString() || 'none'}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguna</SelectItem>
                    {allCareers.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Asignar a Asignatura (Código)</label>
                <Input name="subject_code" key={editingAssignment ? `subj-${editingAssignment.id}` : 'new'} defaultValue={editingAssignment?.subject_code || ''} placeholder="Ej: MAT-101 (Dejar vacío para no usar)" />
              </div>

              <div>
                <label className="text-sm font-medium">Asignar a Sección (Opcional)</label>
                <Input name="section" key={editingAssignment ? `sect-${editingAssignment.id}` : 'new'} defaultValue={editingAssignment?.section || ''} placeholder="Ej: MC01T0S, MC01T1S (Puedes separar varias por comas)" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAssignmentModalOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingAssignment ? 'Guardar Cambios' : 'Crear Asignación'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isLogsModalOpen} onOpenChange={setIsLogsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registro de Eventos de Sincronización</DialogTitle>
          </DialogHeader>
          {loadingLogs ? (
            <p className="text-center py-4">Cargando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha / Hora</TableHead>
                  <TableHead>Acción y Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ragLogs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center">No hay registros recientes.</TableCell></TableRow>
                ) : (
                  ragLogs.map((log: any) => (
                    <TableRow key={log.id} onClick={() => setSelectedLog(log)} className="cursor-pointer hover:bg-slate-100 transition-colors">
                      <TableCell className="text-xs font-mono">{log.id}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'success' ? 'default' : log.status === 'started' ? 'secondary' : 'destructive'}>
                          {log.status === 'success' ? 'Exitoso' : log.status === 'started' ? 'Iniciado' : 'Falló'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{log.started ? new Date(log.started).toLocaleString() : 'N/A'}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title="Haz clic para ver más detalles">
                        <b>{log.name}</b>: {log.result}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Log Details Modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle del Evento</DialogTitle>
            <DialogDescription>ID de Tarea: {selectedLog?.id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold mb-2">Estado</p>
              <Badge variant={selectedLog?.status === 'success' ? 'default' : selectedLog?.status === 'started' ? 'secondary' : 'destructive'}>
                {selectedLog?.status === 'success' ? 'Exitoso' : selectedLog?.status === 'started' ? 'Iniciado' : 'Falló'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-bold mb-2">Acción: {selectedLog?.name}</p>
            </div>
            <div>
              <p className="text-sm font-bold mb-2">Detalles Completos</p>
              <Textarea 
                readOnly 
                value={selectedLog?.result || ''} 
                className="h-64 font-mono text-xs bg-slate-900 text-slate-100 border-slate-700 resize-none" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSelectedLog(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
