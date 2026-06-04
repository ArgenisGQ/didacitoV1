import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Cpu, Key, Database, Play, AlertTriangle, Zap, FileText, CheckCircle2, XCircle, Binary, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const [activeTab, setActiveTab] = useState<'providers' | 'templates' | 'rag' | 'chat'>('providers')
  
  // States for Provider Modal
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<any>(null)
  
  // States for Template Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)

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

  const { mutate: testConnection, isPending: isTesting, variables: testVariables } = useMutation({
    mutationFn: async (payload: any) => {
      // Support passing id directly (from table) or payload (from modal)
      const body = typeof payload === 'number' ? { provider_id: payload } : payload
      const { data } = await api.post('/ai/admin/test-provider/', body)
      return { ...data, targetKey: body.provider_id ? `${body.provider_id}-${body.test_target || 'all'}` : null }
    },
    onSuccess: (data, variables) => {
      toast.success(data.message || 'Conexión exitosa')
      if (data.targetKey) {
        setTestResults(prev => ({ ...prev, [data.targetKey]: 'success' }))
      }
      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models)
      }
    },
    onError: (error: any, variables) => {
      toast.error(error.response?.data?.error || 'Error al probar conexión')
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
    setAvailableModels([])
    setIsProviderModalOpen(true)
  }

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
    mutationFn: async () => {
      const { data } = await api.post('/ai/admin/sync-all/')
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
    mutationFn: async () => {
      const { data } = await api.post('/ai/admin/sync-all-plans/')
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

  const saveTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const payload = Object.fromEntries(formData.entries())
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
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No hay proveedores configurados.
                    </TableCell>
                  </TableRow>
                ) : (
                  providers.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold">{p.name}</TableCell>
                      <TableCell>{p.provider_type}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{p.base_url || 'N/A'}</TableCell>
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
            <div className="flex gap-2">
              <Button onClick={() => { setIsLogsModalOpen(true); fetchLogs(); }} variant="outline" className="gap-2">
                <FileText size={16} /> Ver Logs
              </Button>
              <Button onClick={() => refetchRag()} variant="outline" className="gap-2" disabled={loadingRag || isSyncing}>
                <Play size={16} /> Actualizar
              </Button>
              <Button onClick={() => syncAll()} className="gap-2" disabled={!hasActiveProvider || isSyncing || loadingRag || ragStatus?.is_fully_synced}>
                <Database size={16} /> Sincronizar Todos
              </Button>
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
                    <Button onClick={() => syncAllPlans()} className="mt-4 gap-2 w-full" disabled={!hasActiveProvider || isSyncingPlans || loadingRag || ragStatus.is_plans_fully_synced}>
                      <Database size={16} /> Sincronizar Planes
                    </Button>
                  </div>
                </div>

                {/* Progress bar logic (shows when syncing and there are >0 total) */}
                {(!ragStatus.is_fully_synced && ragStatus.total_active_syllabuses > 0) && (
                  <div className="mt-6 p-4 border rounded-xl bg-slate-50">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-bold text-slate-700">Progreso de Sincronización</p>
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
              </div>
            ) : (
              <p className="text-center py-8 text-red-500">No se pudo cargar el estado del RAG.</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'chat' && (
        <AIChat />
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
              <Select name="provider_type" defaultValue={editingProvider?.provider_type || 'openai-compatible'}>
                <SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (Oficial)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="openai-compatible">Compatible con OpenAI (DeepSeek, Qwen)</SelectItem>
                  <SelectItem value="lmstudio">LMStudio (Local IA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Base URL (Requerido para LMStudio/Compatible)</label>
              <Input name="base_url" defaultValue={editingProvider?.base_url} placeholder="Ej: http://host.docker.internal:1234/v1" />
              <p className="text-xs text-muted-foreground mt-1">Si usas LMStudio local y Docker, coloca <b>http://host.docker.internal:1234/v1</b></p>
            </div>
            <div>
              <label className="text-sm font-medium">API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input name="api_key" type="password" className="pl-10" placeholder={editingProvider ? '*** Dejar en blanco para no cambiar ***' : 'sk-...'} required={!editingProvider} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">La llave se almacenará cifrada en la base de datos.</p>
            </div>

            <div className="pt-2">
              <Button type="button" variant="secondary" className="w-full gap-2" onClick={handleTestModal} disabled={isTesting}>
                {isTesting ? <Zap size={16} className="animate-pulse" /> : <Play size={16} />}
                Probar Conexión y Cargar Modelos
              </Button>
            </div>

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
            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <input type="checkbox" name="is_active" defaultChecked={editingTemplate?.is_active ?? true} />
                Activo
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTemplateModalOpen(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Logs Modal */}
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
