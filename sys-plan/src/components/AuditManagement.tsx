import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  UserX,
  Send,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Database,
  Calendar,
  Lock,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import api from '@/lib/api-client'

interface AuditLog {
  id: number
  user_id: number | null
  user_email: string | null
  action: string
  ip_address: string
  user_agent: string
  details: string | null
  created_at: string
}

interface InactiveUser {
  id: number
  email: string
  full_name: string
  role: string
  last_login: string | null
  days_inactive: number
}

interface SettingItem {
  id: number
  key: string
  value: string
  description: string
  category: string
}

export default function AuditManagement() {
  const [activeTab, setActiveTab] = useState<'logs' | 'inactivity'>('logs')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUser[]>([])
  const [settings, setSettings] = useState<SettingItem[]>([])

  const { data: profileConfig } = useQuery({
    queryKey: ['profileConfig'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/profile-config')
      return data
    },
  })
  
  // Loading states
  const [isLogsLoading, setIsLogsLoading] = useState(true)
  const [isUsersLoading, setIsUsersLoading] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  
  // Filter states
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  
  // Expanded log IDs for details
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  
  // Local settings values
  const [autoDeactivate, setAutoDeactivate] = useState<boolean>(false)
  const [thresholdDays, setThresholdDays] = useState<number>(90)
  const [isDirty, setIsDirty] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch logs on filter changes
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs()
    }
  }, [debouncedSearch, actionFilter, startDate, endDate, activeTab])

  // Fetch inactive users on tab switch
  useEffect(() => {
    if (activeTab === 'inactivity') {
      fetchInactiveData()
    }
  }, [activeTab])

  const fetchLogs = async () => {
    setIsLogsLoading(true)
    try {
      const params: Record<string, any> = {
        search: debouncedSearch || undefined,
        action: actionFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: 50
      }
      const res = await api.get('/admin/audit-logs', { params })
      setLogs(res.data)
    } catch (err) {
      console.error(err)
      setMsg({ type: 'error', text: 'Error al cargar la bitácora de auditoría.' })
    } finally {
      setIsLogsLoading(false)
    }
  }

  const fetchInactiveData = async () => {
    setIsUsersLoading(true)
    try {
      // 1. Fetch current settings to get threshold & auto deactivation
      const settingsRes = await api.get('/admin/settings')
      const allSettings: SettingItem[] = settingsRes.data
      setSettings(allSettings)
      
      const autoDeactSetting = allSettings.find(s => s.key === 'AUTO_DEACTIVATE_INACTIVE_ACCOUNTS')
      const thresholdSetting = allSettings.find(s => s.key === 'INACTIVE_ACCOUNT_THRESHOLD_DAYS')
      
      const autoVal = autoDeactSetting?.value === 'true'
      const threshVal = thresholdSetting ? parseInt(thresholdSetting.value, 10) : 90
      
      setAutoDeactivate(autoVal)
      setThresholdDays(threshVal)
      setIsDirty(false)

      // 2. Fetch inactive users analytics based on threshold setting
      const usersRes = await api.get('/admin/analytics/inactivity', {
        params: { threshold_days: threshVal }
      })
      setInactiveUsers(usersRes.data)
    } catch (err) {
      console.error(err)
      setMsg({ type: 'error', text: 'Error al obtener datos de inactividad de docentes.' })
    } finally {
      setIsUsersLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setIsSavingSettings(true)
    setMsg({ type: '', text: '' })
    try {
      const updatedValues = {
        AUTO_DEACTIVATE_INACTIVE_ACCOUNTS: autoDeactivate ? 'true' : 'false',
        INACTIVE_ACCOUNT_THRESHOLD_DAYS: thresholdDays.toString()
      }
      
      await api.patch('/admin/settings', updatedValues)
      setIsDirty(false)
      setMsg({ type: 'success', text: 'Parámetros de inactividad actualizados con éxito en base de datos.' })
      
      // Refresh list using the new threshold
      const usersRes = await api.get('/admin/analytics/inactivity', {
        params: { threshold_days: thresholdDays }
      })
      setInactiveUsers(usersRes.data)
    } catch (err: any) {
      setMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Error al guardar los parámetros de inactividad.'
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleDeactivateUser = async (id: number) => {
    if (!confirm('¿Está seguro de que desea desactivar permanentemente la cuenta de este usuario debido a inactividad?')) {
      return
    }
    setActionLoadingId(`deactivate-${id}`)
    setMsg({ type: '', text: '' })
    try {
      await api.post(`/admin/users/${id}/deactivate-inactivity`)
      setMsg({ type: 'success', text: 'Cuenta desactivada de inmediato. Todos sus tokens han sido revocados.' })
      // Remove from table locally
      setInactiveUsers(prev => prev.filter(u => u.id !== id))
    } catch (err: any) {
      setMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Error al desactivar al usuario.'
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleWarnUser = async (id: number) => {
    setActionLoadingId(`warn-${id}`)
    setMsg({ type: '', text: '' })
    try {
      await api.post(`/admin/users/${id}/warn-inactivity`)
      setMsg({
        type: 'success',
        text: 'Advertencia institucional simulada enviada al correo del docente de manera exitosa.'
      })
    } catch (err: any) {
      setMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Error al enviar advertencia.'
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleExportCSV = async () => {
    try {
      const params: Record<string, any> = {
        search: debouncedSearch || undefined,
        action: actionFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      }
      
      // Make a GET request that retrieves raw blob
      const res = await api.get('/admin/audit-logs/export', {
        params,
        responseType: 'blob'
      })
      
      // Create link and download
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bitacora_auditoria_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      setMsg({ type: 'error', text: 'Error al exportar los logs de auditoría.' })
    }
  }

  const toggleExpandLog = (id: number) => {
    setExpandedLogId(expandedLogId === id ? null : id)
  }

  const getActionBadgeColor = (action: string) => {
    if (action.includes('SUCCESS') || action === 'USER_ACTIVATION_SUCCESS') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900'
    }
    if (action.includes('FAILED') || action === 'ACCOUNT_LOCKOUT' || action === 'MFA_VERIFICATION_FAILED') {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900'
    }
    if (action === 'USER_DEACTIVATED') {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900'
    }
    return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900'
  }

  const getFormattedJSON = (jsonStr: string | null) => {
    if (!jsonStr) return 'Sin detalles adicionales'
    try {
      const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
      return JSON.stringify(obj, null, 2)
    } catch {
      return jsonStr
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter">Auditoría y Control</h1>
          <p className="text-lg text-muted-foreground font-medium">
            Supervise la bitácora de eventos de seguridad y gestione la inactividad de las cuentas institucionales.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="bg-muted/80 p-1 rounded-xl flex items-center border border-border max-w-md shrink-0">
          <Button
            variant={activeTab === 'logs' ? 'default' : 'ghost'}
            className="rounded-lg font-bold"
            onClick={() => {
              setActiveTab('logs')
              setMsg({ type: '', text: '' })
            }}
          >
            <Database size={16} className="mr-2" />
            Bitácora de Logs
          </Button>
          <Button
            variant={activeTab === 'inactivity' ? 'default' : 'ghost'}
            className="rounded-lg font-bold"
            onClick={() => {
              setActiveTab('inactivity')
              setMsg({ type: '', text: '' })
            }}
          >
            <Clock size={16} className="mr-2" />
            Adopción e Inactividad
          </Button>
        </div>
      </div>

      {msg.text && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 border text-sm ${
            msg.type === 'success'
              ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50/50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-300'
          }`}
        >
          <AlertCircle className="shrink-0 mt-0.5" size={16} />
          <span>{msg.text}</span>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Advanced Filters Card */}
          <Card className="backdrop-blur-md bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Filter size={18} className="text-primary" />
                Filtros Avanzados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search Term */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500">Buscar por IP/User Agent/Detalles</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input
                      placeholder="Ej: 127.0.0.1, Chrome, reset..."
                      className="pl-8 h-9 text-xs"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Action Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500">Acción o Evento</Label>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">Todos los eventos</option>
                    <option value="LOGIN_SUCCESS">LOGIN_SUCCESS (Inicio Exitoso)</option>
                    <option value="LOGIN_FAILED">LOGIN_FAILED (Intento Fallido)</option>
                    <option value="ACCOUNT_LOCKOUT">ACCOUNT_LOCKOUT (Bloqueo Temporal)</option>
                    <option value="MFA_VERIFICATION_FAILED">MFA_VERIFICATION_FAILED</option>
                    <option value="LOGOUT">LOGOUT (Cierre de Sesión)</option>
                    <option value="PASSWORD_RESET_SUCCESS">PASSWORD_RESET_SUCCESS</option>
                    <option value="USER_ACTIVATION_SUCCESS">USER_ACTIVATION_SUCCESS</option>
                    <option value="USER_DEACTIVATED">USER_DEACTIVATED (Desactivado)</option>
                    <option value="USER_INACTIVITY_WARNING">USER_INACTIVITY_WARNING</option>
                    <option value="SYSTEM_SETTINGS_UPDATED">SYSTEM_SETTINGS_UPDATED</option>
                  </select>
                </div>

                {/* Start Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Calendar size={12} />
                    Fecha Inicial
                  </Label>
                  <Input
                    type="date"
                    className="h-9 text-xs"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Calendar size={12} />
                    Fecha Final
                  </Label>
                  <Input
                    type="date"
                    className="h-9 text-xs"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-bold text-xs"
                  onClick={() => {
                    setSearch('')
                    setActionFilter('')
                    setStartDate('')
                    setEndDate('')
                  }}
                >
                  Limpiar Filtros
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-bold text-xs gap-1"
                    onClick={fetchLogs}
                  >
                    <RefreshCw size={14} className={isLogsLoading ? 'animate-spin' : ''} />
                    Actualizar
                  </Button>
                  <Button
                    size="sm"
                    className="font-bold text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleExportCSV}
                    disabled={logs.length === 0}
                  >
                    <Download size={14} />
                    Exportar Bitácora (CSV)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs Table */}
          <Card className="backdrop-blur-md bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle>Bitácora de Eventos de Seguridad</CardTitle>
              <CardDescription>
                Historial cronológico de accesos, actualizaciones de privilegios y auditoría profunda de la aplicación.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {isLogsLoading ? (
                <div className="py-16 text-center text-slate-400 flex flex-col justify-center items-center gap-3">
                  <Loader2 className="animate-spin text-primary" size={32} />
                  <span className="font-semibold text-sm">Escaneando bitácora de auditoría en la base de datos...</span>
                </div>
              ) : logs.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-3">
                  <Database size={40} className="mx-auto text-muted-foreground/60" />
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Sin registros coincidentes</h3>
                    <p className="text-sm mt-1">Ningún log de auditoría satisface los filtros configurados actualmente.</p>
                  </div>
                </div>
              ) : (
                <div className="border border-border/60 rounded-xl overflow-hidden bg-background/50">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="font-bold text-xs">Fecha y Hora</TableHead>
                        <TableHead className="font-bold text-xs">Evento/Acción</TableHead>
                        <TableHead className="font-bold text-xs">Usuario / Email</TableHead>
                        <TableHead className="font-bold text-xs">IP Origen</TableHead>
                        <TableHead className="font-bold text-xs hidden md:table-cell">Dispositivo (User Agent)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const isExpanded = expandedLogId === log.id
                        return (
                          <>
                            <TableRow
                              key={log.id}
                              className={`hover:bg-muted/30 border-b cursor-pointer transition-colors duration-200 ${
                                isExpanded ? 'bg-muted/40' : ''
                              }`}
                              onClick={() => toggleExpandLog(log.id)}
                            >
                              <TableCell className="text-center p-2.5">
                                {isExpanded ? (
                                  <ChevronUp size={16} className="text-slate-400" />
                                ) : (
                                  <ChevronDown size={16} className="text-slate-400" />
                                )}
                              </TableCell>
                              <TableCell className="text-xs font-medium py-3">
                                {(() => {
                                  const tz = profileConfig?.system_timezone || 'America/Caracas';
                                  try {
                                    return new Intl.DateTimeFormat('es-ES', {
                                      timeZone: tz,
                                      dateStyle: 'short',
                                      timeStyle: 'medium'
                                    }).format(new Date(log.created_at))
                                  } catch (e) {
                                    return new Date(log.created_at).toLocaleString()
                                  }
                                })()}
                              </TableCell>
                              <TableCell className="py-3">
                                <Badge variant="outline" className={`font-bold text-[10px] tracking-wide rounded-full px-2 py-0.5 ${getActionBadgeColor(log.action)}`}>
                                  {log.action}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs font-semibold py-3">
                                {log.user_email ? (
                                  <span className="flex items-center gap-1">
                                    <User size={12} className="text-slate-400" />
                                    {log.user_email}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground italic font-normal text-slate-400">Sistema / Anónimo</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs font-mono py-3">{log.ip_address}</TableCell>
                              <TableCell className="text-[11px] text-slate-400 truncate max-w-xs py-3 hidden md:table-cell">
                                {log.user_agent}
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow key={`details-${log.id}`} className="bg-muted/20 border-b">
                                <TableCell colSpan={6} className="p-4 bg-muted/10">
                                  <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row justify-between text-xs text-slate-500 gap-2">
                                      <span><strong>ID del Log:</strong> #{log.id}</span>
                                      <span><strong>Usuario ID:</strong> {log.user_id || 'N/A'}</span>
                                      <span><strong>Navegador completo:</strong> {log.user_agent}</span>
                                    </div>
                                    <div className="bg-slate-950 dark:bg-black text-slate-100 p-4 rounded-xl font-mono text-[11px] shadow-inner border border-slate-800 space-y-1 overflow-x-auto">
                                      <p className="text-slate-500 border-b border-slate-800 pb-1.5 mb-1.5 font-bold">// Metadatos del Evento (JSON Detalles)</p>
                                      <pre className="text-emerald-400 leading-relaxed font-mono whitespace-pre-wrap">
                                        {getFormattedJSON(log.details)}
                                      </pre>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'inactivity' && (
        <div className="space-y-6">
          {/* Analytics Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* INACTIVE USERS CARD */}
            <Card className="bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-background border-rose-200 dark:border-rose-900/60 shadow-md">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest">Docentes Inactivos</span>
                    <h3 className="text-4xl font-black tracking-tight">{inactiveUsers.length}</h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      Activos sin conexión por más de {thresholdDays} días.
                    </p>
                  </div>
                  <div className="bg-rose-100 dark:bg-rose-950/50 p-2.5 rounded-xl text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                    <AlertTriangle size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* THRESHOLD SETTING CARD */}
            <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background border-indigo-200 dark:border-indigo-900/60 shadow-md">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Umbral de Expiración</span>
                    <h3 className="text-4xl font-black tracking-tight">{thresholdDays}</h3>
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      Días reglamentarios establecidos
                    </p>
                  </div>
                  <div className="bg-indigo-100 dark:bg-indigo-950/50 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                    <Sliders size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AUTOMATIC CLEANUP CARD */}
            <Card className={`bg-gradient-to-br ${
              autoDeactivate
                ? 'from-emerald-50 to-white dark:from-emerald-950/20'
                : 'from-slate-100 to-white dark:from-slate-900/20'
            } dark:to-background border border-border shadow-md`}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Limpieza Automática</span>
                    <h3 className="text-2xl font-black tracking-tight mt-1 flex items-center gap-2">
                      {autoDeactivate ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1">ACTIVADA</Badge>
                      ) : (
                        <Badge variant="secondary" className="font-bold px-3 py-1 bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">DESACTIVADA</Badge>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      Barriada diaria por cron del sistema.
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    autoDeactivate
                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300'
                  }`}>
                    {autoDeactivate ? <CheckCircle2 size={24} /> : <EyeOff size={24} />}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settings Control Panel for Inactivity */}
          <Card className="backdrop-blur-md bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Sliders size={18} className="text-primary" />
                Políticas de Gobernanza de Inactividad
              </CardTitle>
              <CardDescription>
                Ajuste las reglas globales de suspensión automática de docentes. Los cambios toman efecto inmediatamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AUTO DEACTIVATE TOGGLE */}
                <div className="space-y-2 border border-border/80 p-4 rounded-xl bg-background/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-extrabold text-sm block">Suspensión Automática de Cuentas</Label>
                      <span className="text-xs text-muted-foreground">Suspende automáticamente tras superar el umbral.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoDeactivate(!autoDeactivate)
                        setIsDirty(true)
                      }}
                      className="focus:outline-none"
                    >
                      {autoDeactivate ? (
                        <ToggleRight className="text-primary h-9 w-9" strokeWidth={1.5} />
                      ) : (
                        <ToggleLeft className="text-slate-400 h-9 w-9" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed pt-2 border-t border-border/40">
                    Al activarse, el scheduler diario revocará todas las sesiones activas del usuario y suspenderá su estado de cuenta (`is_active = False`), emitiendo un log de auditoría.
                  </p>
                </div>

                {/* THRESHOLD DAYS INPUT */}
                <div className="space-y-3 border border-border/80 p-4 rounded-xl bg-background/40">
                  <div className="space-y-1">
                    <Label className="font-extrabold text-sm block">Días de Inactividad Permitidos</Label>
                    <span className="text-xs text-muted-foreground">Tiempo límite antes de considerar la cuenta inactiva.</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      className="max-w-[120px] font-bold h-10 text-center"
                      value={thresholdDays}
                      onChange={(e) => {
                        setThresholdDays(parseInt(e.target.value, 10) || 90)
                        setIsDirty(true)
                      }}
                    />
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">días hábiles</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-border/40 pt-2">
                    Las cuentas que no hayan registrado inicios de sesión válidos dentro de este lapso serán listadas como inactivas.
                  </p>
                </div>
              </div>

              {isDirty && (
                <div className="flex items-center justify-between p-3 border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Hay cambios de políticas pendientes.</span>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    size="sm"
                    className="font-bold flex items-center gap-1.5"
                  >
                    {isSavingSettings ? <Loader2 className="animate-spin mr-1" size={14} /> : <Save size={14} />}
                    Guardar Parámetros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inactive Users Table / Control Area */}
          <Card className="backdrop-blur-md bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle>Listado de Cuentas Inactivas</CardTitle>
              <CardDescription>
                Cuentas activas en el sistema sin conexión por un lapso superior a {thresholdDays} días. Envíe advertencias o aplique suspensiones manuales.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {isUsersLoading ? (
                <div className="py-16 text-center text-slate-400 flex flex-col justify-center items-center gap-3">
                  <Loader2 className="animate-spin text-primary" size={32} />
                  <span className="font-semibold text-sm">Escaneando usuarios inactivos bajo el umbral actual...</span>
                </div>
              ) : inactiveUsers.length === 0 ? (
                <div className="py-16 text-center text-emerald-600 dark:text-emerald-400 space-y-3">
                  <CheckCircle2 size={40} className="mx-auto" />
                  <div>
                    <h3 className="font-bold text-lg text-foreground">¡Todo en orden!</h3>
                    <p className="text-sm mt-1 text-slate-500">Ningún docente supera el umbral de {thresholdDays} días de inactividad.</p>
                  </div>
                </div>
              ) : (
                <div className="border border-border/60 rounded-xl overflow-hidden bg-background/50">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="font-bold text-xs">Docente</TableHead>
                        <TableHead className="font-bold text-xs">Rol</TableHead>
                        <TableHead className="font-bold text-xs">Última Conexión</TableHead>
                        <TableHead className="font-bold text-xs">Tiempo Inactivo</TableHead>
                        <TableHead className="font-bold text-xs text-right">Acciones de Calidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveUsers.map((user) => (
                        <TableRow key={user.id} className="hover:bg-muted/30 border-b">
                          <TableCell className="py-3">
                            <div>
                              <p className="font-bold text-xs">{user.full_name}</p>
                              <p className="text-[10px] text-muted-foreground">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="secondary" className="text-[9px] uppercase tracking-wider px-2 font-bold bg-slate-100 border text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-semibold py-3 text-slate-500">
                            {user.last_login ? (() => {
                              const tz = profileConfig?.system_timezone || 'America/Caracas';
                              try {
                                return new Intl.DateTimeFormat('es-ES', {
                                  timeZone: tz,
                                  dateStyle: 'short',
                                  timeStyle: 'medium'
                                }).format(new Date(user.last_login))
                              } catch (e) {
                                return new Date(user.last_login).toLocaleString()
                              }
                            })() : (
                              <span className="text-amber-600 italic">Nunca registrado</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs font-black text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-full px-3 py-1">
                              {user.days_inactive} días
                            </span>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="font-bold text-[10px] h-8 px-2 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400"
                                onClick={() => handleWarnUser(user.id)}
                                disabled={actionLoadingId === `warn-${user.id}`}
                              >
                                {actionLoadingId === `warn-${user.id}` ? (
                                  <Loader2 className="animate-spin h-3.5 w-3.5 mr-1" />
                                ) : (
                                  <Send size={12} className="mr-1" />
                                )}
                                Advertir
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="font-bold text-[10px] h-8 px-2 text-white bg-rose-600 hover:bg-rose-700"
                                onClick={() => handleDeactivateUser(user.id)}
                                disabled={actionLoadingId === `deactivate-${user.id}`}
                              >
                                {actionLoadingId === `deactivate-${user.id}` ? (
                                  <Loader2 className="animate-spin h-3.5 w-3.5 mr-1" />
                                ) : (
                                  <UserX size={12} className="mr-1" />
                                )}
                                Suspender
                              </Button>
                            </div>
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
      )}
    </div>
  )
}
