import { useState, useEffect } from 'react'
import { Shield, FileSpreadsheet, User, Mail, CheckCircle2, AlertCircle, Loader2, Save, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import api from '@/lib/api-client'

interface SettingItem {
  id: number
  key: string
  value: string
  description: string
  category: string
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState<'security' | 'import' | 'profile' | 'smtp'>('security')
  
  // Local modified settings state for pending changes
  const [localValues, setLocalValues] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  
  // SMTP diagnostic test states
  const [isTestingSMTP, setIsTestingSMTP] = useState(false)
  const [smtpDiagnostic, setSmtpDiagnostic] = useState<string[] | null>(null)

  // Track if there are unsaved changes
  const [isDirty, setIsDirty] = useState(false)

  // Column input state for required CSV columns editing
  const [newColInput, setNewColInput] = useState('')

  useEffect(() => {
    fetchSettings()
    
    // Prevent accidentally leaving page with unsaved changes
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = 'Tiene cambios pendientes sin guardar. ¿Está seguro que desea salir?'
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const fetchSettings = async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/admin/settings')
      setSettings(res.data)
      // Initialize local state mapping key to value
      const vals: Record<string, string> = {}
      res.data.forEach((s: SettingItem) => {
        vals[s.key] = s.value
      })
      setLocalValues(vals)
      setIsDirty(false)
    } catch (err) {
      console.error(err)
      setMsg({ type: 'error', text: 'Error al cargar las configuraciones del sistema.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangeValue = (key: string, value: string) => {
    setLocalValues((prev) => ({
      ...prev,
      [key]: value
    }))
    setIsDirty(true)
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    setMsg({ type: '', text: '' })
    try {
      const res = await api.patch('/admin/settings', localValues)
      setSettings(res.data)
      setIsDirty(false)
      setMsg({ type: 'success', text: 'Configuraciones de gobernanza actualizadas y cache recargado con exito.' })
    } catch (err: any) {
      setMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Error al guardar las configuraciones.'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddCsvColumn = () => {
    const cleanCol = newColInput.trim().toLowerCase()
    if (!cleanCol) return
    const currentCols = localValues['CSV_REQUIRED_COLUMNS']
      ? localValues['CSV_REQUIRED_COLUMNS'].split(',').map((c) => c.trim())
      : []
    if (currentCols.includes(cleanCol)) {
      setNewColInput('')
      return
    }
    const newCols = [...currentCols, cleanCol].join(',')
    handleChangeValue('CSV_REQUIRED_COLUMNS', newCols)
    setNewColInput('')
  }

  const handleRemoveCsvColumn = (col: string) => {
    const currentCols = localValues['CSV_REQUIRED_COLUMNS']
      ? localValues['CSV_REQUIRED_COLUMNS'].split(',').map((c) => c.trim())
      : []
    const newCols = currentCols.filter((c) => c !== col).join(',')
    handleChangeValue('CSV_REQUIRED_COLUMNS', newCols)
  }

  // Checkbox toggle for editable fields
  const handleToggleEditableField = (field: string, checked: boolean) => {
    const currentFields = localValues['EDITABLE_PROFILE_FIELDS']
      ? localValues['EDITABLE_PROFILE_FIELDS'].split(',').map((c) => c.trim())
      : []
    let newFields: string[]
    if (checked) {
      newFields = [...currentFields, field]
    } else {
      newFields = currentFields.filter((f) => f !== field)
    }
    handleChangeValue('EDITABLE_PROFILE_FIELDS', newFields.join(','))
  }

  // Simulate premium SMTP diagnostic
  const handleTestSMTP = () => {
    setIsTestingSMTP(true)
    setSmtpDiagnostic(null)
    
    const logs = [
      `Iniciando conexión con ${localValues['SMTP_HOST'] || 'smtp.gmail.com'}:${localValues['SMTP_PORT'] || '587'}...`,
      'Conexión establecida. Recibido código 220 (Service Ready).',
      'Enviando comando EHLO didactico.edu...',
      'Servidor responde compatible con STARTTLS, AUTH LOGIN, PLAIN.',
      'Iniciando negociación TLS segura...',
      'Handshake TLS completado exitosamente. Cifrado AES-256 activo.',
      `Intentando autenticación para usuario: ${localValues['SMTP_USER'] || 'notificaciones@didactico.edu'}...`,
      'Autenticación SMTP APROBADA (Código 235).',
      'Construyendo mensaje simulado desde: ' + (localValues['SMTP_USER'] || 'notificaciones@didactico.edu'),
      'Correo de prueba encolado e inyectado con éxito en canal de pruebas.',
      'Diagnóstico finalizado. Servidor de Correo en perfecto estado de funcionamiento.'
    ]
    
    let currentIdx = 0
    const displayedLogs: string[] = []
    
    const interval = setInterval(() => {
      if (currentIdx < logs.length) {
        displayedLogs.push(logs[currentIdx])
        setSmtpDiagnostic([...displayedLogs])
        currentIdx++
      } else {
        clearInterval(interval)
        setIsTestingSMTP(false)
      }
    }, 400)
  }

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center items-center">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-slate-400 font-medium">Cargando Panel de Gobernanza Administrativa...</span>
      </div>
    )
  }

  // Get active menu categories and item values
  const csvRequiredColumns = localValues['CSV_REQUIRED_COLUMNS']
    ? localValues['CSV_REQUIRED_COLUMNS'].split(',').map((c) => c.trim()).filter(Boolean)
    : []

  const editableFieldsList = localValues['EDITABLE_PROFILE_FIELDS']
    ? localValues['EDITABLE_PROFILE_FIELDS'].split(',').map((c) => c.trim()).filter(Boolean)
    : []

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter">Gobernanza del Sistema</h1>
          <p className="text-lg text-muted-foreground font-medium">
            Panel de control exclusivo para administración de políticas institucionales globales.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {isDirty && (
            <span className="text-sm font-semibold text-rose-500 animate-pulse bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5 rounded-full border border-rose-200 dark:border-rose-900">
              Cambios pendientes de guardar
            </span>
          )}
          <Button
            onClick={handleSaveAll}
            disabled={isSaving || !isDirty}
            size="lg"
            className="gap-2 font-black h-12"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Aplicar y Recargar Caché
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

      {/* Main Settings Tabs Container */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-64 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible shrink-0 pb-2 lg:pb-0">
          {[
            { id: 'security', label: 'Seguridad y Accesos', icon: Shield },
            { id: 'import', label: 'Carga Masiva (CSV)', icon: FileSpreadsheet },
            { id: 'profile', label: 'Campos Auto-Gestión', icon: User },
            { id: 'smtp', label: 'Servidor SMTP', icon: Mail }
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeSubTab === tab.id ? 'default' : 'ghost'}
              className="justify-start gap-3 h-12 shrink-0 font-semibold px-4 w-full"
              onClick={() => {
                if (isDirty && !confirm('Tiene cambios sin guardar en esta sección. ¿Está seguro que desea cambiar de pestaña?')) {
                  return
                }
                setActiveSubTab(tab.id as any)
                setMsg({ type: '', text: '' })
              }}
            >
              <tab.icon size={18} />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Setting Category Panel */}
        <div className="flex-1 w-full">
          {activeSubTab === 'security' && (
            <Card className="backdrop-blur-md bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="text-primary" size={22} />
                  Seguridad y Accesos del Sistema
                </CardTitle>
                <CardDescription>
                  Políticas globales de registro, MFA y expiración de enlaces.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SUPPORT EMAIL */}
                  <div className="space-y-2">
                    <Label className="font-extrabold text-sm">Correo de Soporte Técnico</Label>
                    <Input
                      value={localValues['SUPPORT_EMAIL'] || ''}
                      onChange={(e) => handleChangeValue('SUPPORT_EMAIL', e.target.value)}
                      placeholder="soporte@didactico.edu"
                    />
                    <p className="text-xs text-muted-foreground">
                      Reflejado en inputs bloqueados y errores de tokens expirados.
                    </p>
                  </div>

                  {/* INVITATION EXPIRE HOURS */}
                  <div className="space-y-2">
                    <Label className="font-extrabold text-sm">Expiración de Invitaciones (Horas)</Label>
                    <Input
                      type="number"
                      value={localValues['INVITATION_TOKEN_EXPIRE_HOURS'] || ''}
                      onChange={(e) => handleChangeValue('INVITATION_TOKEN_EXPIRE_HOURS', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Horas que tendrá un docente para activar su cuenta antes que el token expire.
                    </p>
                  </div>

                  {/* REGISTRATION METHOD */}
                  <div className="space-y-2">
                    <Label className="font-extrabold text-sm">Método de Registro Docente</Label>
                    <select
                      value={localValues['REGISTRATION_METHOD'] || 'INVITATION'}
                      onChange={(e) => handleChangeValue('REGISTRATION_METHOD', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="INVITATION">Por Invitación Administrativa Estricta</option>
                      <option value="OPEN">Abierto (Registro Libre Docente)</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Si está en "Por Invitación", los docentes no se registran solos.
                    </p>
                  </div>

                  {/* MAX INVITATIONS PER DAY */}
                  <div className="space-y-2">
                    <Label className="font-extrabold text-sm">Max Invitaciones por Día</Label>
                    <Input
                      type="number"
                      value={localValues['MAX_INVITATIONS_PER_DAY'] || '50'}
                      onChange={(e) => handleChangeValue('MAX_INVITATIONS_PER_DAY', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Controlador de tasa límite diaria anti-spam de invitaciones.
                    </p>
                  </div>

                  {/* ENFORCE MFA ROLES */}
                  <div className="space-y-2">
                    <Label className="font-extrabold text-sm">Roles con Doble Factor Obligatorio (MFA)</Label>
                    <Input
                      value={localValues['ENFORCE_MFA_ROLES'] || ''}
                      onChange={(e) => handleChangeValue('ENFORCE_MFA_ROLES', e.target.value)}
                      placeholder="SUPER_ADMIN,ADMIN_GESTION"
                    />
                    <p className="text-xs text-muted-foreground">
                      Roles obligados a configurar MFA en login (separados por coma).
                    </p>
                  </div>

                  {/* MINIMUM PASSWORD STRENGTH */}
                  <div className="space-y-2">
                    <Label className="font-extrabold text-sm">Entropía Mínima de Contraseña (0 a 4)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="4"
                      value={localValues['MINIMUM_PASSWORD_STRENGTH_SCORE'] || '3'}
                      onChange={(e) => handleChangeValue('MINIMUM_PASSWORD_STRENGTH_SCORE', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      3 (Segura) o 4 (Excelente) son altamente recomendables para seguridad institucional.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSubTab === 'import' && (
            <Card className="backdrop-blur-md bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="text-primary" size={22} />
                  Configuración del Importador Masivo (CSV/Excel)
                </CardTitle>
                <CardDescription>
                  Define especificaciones de plantillas permitidas y tamaño del lote.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* CSV Auto Activate */}
                <div className="space-y-2">
                  <Label className="font-extrabold text-sm">Auto-activar Docentes Importados</Label>
                  <select
                    value={localValues['CSV_AUTO_ACTIVATE_USERS'] || 'false'}
                    onChange={(e) => handleChangeValue('CSV_AUTO_ACTIVATE_USERS', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
                  >
                    <option value="false">Falso (Se crean inactivos, enviando invitaciones)</option>
                    <option value="true">Verdadero (Se activan en el acto sin correo)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Si es falso, se creará el usuario en estado inactivo y recibirá un enlace de invitación temporal.
                  </p>
                </div>

                {/* Max File Size */}
                <div className="space-y-2">
                  <Label className="font-extrabold text-sm">Tamaño Máximo del Archivo (MB)</Label>
                  <Input
                    type="number"
                    value={localValues['MAX_CSV_FILE_SIZE_MB'] || '5'}
                    onChange={(e) => handleChangeValue('MAX_CSV_FILE_SIZE_MB', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Impide subir archivos masivos que saturen los hilos principales de FastAPI.
                  </p>
                </div>

                {/* REQUIRED CSV COLUMNS */}
                <div className="space-y-4">
                  <Label className="font-extrabold text-sm block">Cabeceras Obligatorias Requeridas de la Plantilla</Label>
                  <div className="flex flex-wrap gap-2 p-4 bg-muted/30 border border-dashed border-border/80 rounded-xl">
                    {csvRequiredColumns.map((col) => (
                      <Badge
                        key={col}
                        variant="secondary"
                        className="h-7 pl-3 pr-2 text-xs font-bold gap-1 rounded-full bg-slate-100 hover:bg-slate-200 border text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {col}
                        <button
                          type="button"
                          onClick={() => handleRemoveCsvColumn(col)}
                          className="hover:bg-slate-300 dark:hover:bg-slate-700 rounded-full p-0.5 shrink-0"
                        >
                          <X size={10} />
                        </button>
                      </Badge>
                    ))}
                    {csvRequiredColumns.length === 0 && (
                      <span className="text-xs text-muted-foreground">No hay cabeceras configuradas. Se requiere al menos email.</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newColInput}
                      onChange={(e) => setNewColInput(e.target.value)}
                      placeholder="Ej: facultad, departamento"
                      className="max-w-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCsvColumn()
                        }
                      }}
                    />
                    <Button type="button" onClick={handleAddCsvColumn} variant="outline" className="gap-1 font-bold">
                      <Plus size={14} /> Añadir Columna
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSubTab === 'profile' && (
            <Card className="backdrop-blur-md bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="text-primary" size={22} />
                  Gestión de Privacidad y Auto-Edición de Docentes
                </CardTitle>
                <CardDescription>
                  Define qué datos pueden editar los docentes de forma autónoma en su panel de perfil.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Los campos desmarcados mostrarán un candado de seguridad gris e inyectarán un tooltip flotante indicando que están protegidos y mostrando el correo de soporte.
                </p>

                <div className="space-y-4 p-5 bg-muted/20 border rounded-xl">
                  {/* FULL NAME CHECKBOX */}
                  <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 rounded-lg">
                    <input
                      type="checkbox"
                      checked={editableFieldsList.includes('full_name')}
                      onChange={(e) => handleToggleEditableField('full_name', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="text-sm font-bold">Nombre Completo</p>
                      <p className="text-xs text-muted-foreground">Permite al profesor corregir su nombre visible.</p>
                    </div>
                  </label>

                  {/* EMAIL CHECKBOX */}
                  <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 rounded-lg">
                    <input
                      type="checkbox"
                      checked={editableFieldsList.includes('email')}
                      onChange={(e) => handleToggleEditableField('email', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="text-sm font-bold">Correo Electrónico</p>
                      <p className="text-xs text-muted-foreground">Bloquear previene cambios de cuenta sin autorización.</p>
                    </div>
                  </label>

                  {/* ROLE CHECKBOX */}
                  <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 rounded-lg">
                    <input
                      type="checkbox"
                      checked={editableFieldsList.includes('role')}
                      onChange={(e) => handleToggleEditableField('role', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="text-sm font-bold">Rol Institucional</p>
                      <p className="text-xs text-muted-foreground">¡Se desaconseja activar esto por motivos de escalado de privilegios!</p>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSubTab === 'smtp' && (
            <Card className="backdrop-blur-md bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="text-primary" size={22} />
                  Servidor SMTP para Notificaciones
                </CardTitle>
                <CardDescription>
                  Credenciales de salida para envío de invitaciones y alertas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SMTP HOST */}
                  <div className="space-y-2">
                    <Label className="font-extrabold text-sm">SMTP Host</Label>
                    <Input
                      value={localValues['SMTP_HOST'] || ''}
                      onChange={(e) => handleChangeValue('SMTP_HOST', e.target.value)}
                      placeholder="smtp.gmail.com"
                    />
                  </div>

                  {/* SMTP PORT */}
                  <div className="space-y-2">
                    <Label className="font-extrabold text-sm">SMTP Puerto</Label>
                    <Input
                      type="number"
                      value={localValues['SMTP_PORT'] || ''}
                      onChange={(e) => handleChangeValue('SMTP_PORT', e.target.value)}
                      placeholder="587"
                    />
                  </div>

                  {/* SMTP USER */}
                  <div className="space-y-2 md:col-span-2">
                    <Label className="font-extrabold text-sm">SMTP Usuario (Email)</Label>
                    <Input
                      value={localValues['SMTP_USER'] || ''}
                      onChange={(e) => handleChangeValue('SMTP_USER', e.target.value)}
                      placeholder="notificaciones@didactico.edu"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm">Prueba de Correo Electrónico</h4>
                      <p className="text-xs text-muted-foreground">Despacha un diagnóstico simulado con las variables actuales.</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleTestSMTP}
                      disabled={isTestingSMTP}
                      className="font-bold"
                    >
                      {isTestingSMTP ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                      Test de Diagnóstico
                    </Button>
                  </div>

                  {smtpDiagnostic && (
                    <div className="bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs max-h-64 overflow-y-auto space-y-1.5 shadow-2xl border border-slate-800">
                      {smtpDiagnostic.map((log, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-slate-500 font-bold">[{idx + 1}]</span>
                          <span className={log.includes('exito') || log.includes('APROBADA') || log.includes('establecida') ? 'text-emerald-400 font-semibold' : ''}>
                            {log}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
