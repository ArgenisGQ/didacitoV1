import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Trash2,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react'
import api from '../lib/api-client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface BulkImportDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface RowPreview {
  row_num: number
  email: string | null
  full_name: string | null
  role: string | null
  status: 'VALID' | 'INVALID'
  errors: string[]
  warnings: string[]
}

interface ImportPreviewResponse {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  rows: RowPreview[]
}

interface ConfirmedInvitation {
  email: string
  token: string
}

interface ImportConfirmResponse {
  success: boolean
  imported_count: number
  auto_activate: boolean
  invitations: ConfirmedInvitation[]
}

export default function BulkImportDialog({ isOpen, onClose }: BulkImportDialogProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Clean up and reset states when dialog is closed
  useEffect(() => {
    if (!isOpen) {
      handleReset()
    }
  }, [isOpen])
  
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [omitErrors, setOmitErrors] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [result, setResult] = useState<ImportConfirmResponse | null>(null)

  // 1. Upload & Preview Mutation
  const previewMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      const formData = new FormData()
      formData.append('file', uploadFile)
      const { data } = await api.post<ImportPreviewResponse>('/admin/users/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      setPreview(data)
      setErrorMsg(null)
    },
    onError: (err: any) => {
      console.error(err)
      setErrorMsg(err.response?.data?.detail || 'Error al procesar el archivo. Verifique el formato e intente nuevamente.')
    },
  })

  // 2. Confirm Import Mutation
  const confirmMutation = useMutation({
    mutationFn: async (usersToConfirm: { email: string; full_name: string; role: string }[]) => {
      const { data } = await api.post<ImportConfirmResponse>('/admin/users/import/confirm', {
        users: usersToConfirm,
      })
      return data
    },
    onSuccess: (data) => {
      setResult(data)
      // Invalidate both users and pending invitations lists
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
    },
    onError: (err: any) => {
      console.error(err)
      setErrorMsg(err.response?.data?.detail || 'Error al confirmar la importación de usuarios.')
    },
  })

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      processFile(droppedFile)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0])
    }
  }

  const processFile = (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      setErrorMsg('Formato de archivo no soportado. Por favor, suba un archivo CSV o Excel (.xlsx, .xls).')
      return
    }
    setFile(selectedFile)
    previewMutation.mutate(selectedFile)
  }

  const handleReset = () => {
    setFile(null)
    setPreview(null)
    setErrorMsg(null)
    setOmitErrors(false)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleConfirm = () => {
    if (!preview) return

    const rowsToProcess = omitErrors 
      ? preview.rows.filter(r => r.status === 'VALID')
      : preview.rows

    // Map rows to correct structure matching BulkImportRowInput in schemas.py
    const usersPayload = rowsToProcess
      .filter((r): r is typeof r & { email: string; full_name: string; role: string } => 
        !!r.email && !!r.full_name && !!r.role && r.status === 'VALID'
      )
      .map(r => ({
        email: r.email,
        full_name: r.full_name,
        role: r.role,
      }))

    if (usersPayload.length === 0) {
      setErrorMsg('No hay registros válidos disponibles para importar.')
      return
    }

    confirmMutation.mutate(usersPayload)
  }

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const getActivationLink = (token: string) => {
    return `${window.location.origin}/activate-account?token=${token}`
  }

  const activeRows = preview 
    ? (omitErrors ? preview.rows.filter(r => r.status === 'VALID') : preview.rows)
    : []

  const hasInvalidRows = preview ? preview.invalid_rows > 0 : false
  const validRowsCount = preview ? preview.valid_rows : 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { handleReset(); onClose(); } }}>
      <DialogContent className={`sm:max-w-[760px] max-h-[85vh] flex flex-col p-6 overflow-hidden glass-morphism border border-slate-200/80 dark:border-slate-800/80 shadow-2xl`} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="shrink-0 mb-4">
          <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Sparkles size={24} className="text-primary animate-pulse" />
            Importación Masiva de Usuarios
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Cargue un archivo CSV o Excel estructurado para dar de alta múltiples docentes o coordinadores de forma segura en un proceso atómico.
          </DialogDescription>
        </DialogHeader>

        {/* Dynamic content wrapper */}
        <div className="flex-1 overflow-y-auto px-1 py-2 space-y-5">
          {errorMsg && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm font-semibold flex items-start gap-2.5 animate-fadeIn">
              <AlertTriangle className="shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <p className="font-bold">Error en la validación</p>
                <p className="text-xs text-destructive/90 mt-1 font-medium">{errorMsg}</p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-destructive hover:bg-destructive/10" onClick={() => setErrorMsg(null)}>
                Descartar
              </Button>
            </div>
          )}

          {/* PHASE 1: DRAG & DROP ZONE */}
          {!file && !previewMutation.isPending && !result && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-4 ${
                dragOver
                  ? 'border-primary bg-primary/5 scale-[0.99] shadow-inner shadow-primary/10'
                  : 'border-slate-300 dark:border-slate-800 hover:border-primary hover:bg-primary/5'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
              />
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                <UploadCloud size={40} className="animate-bounce" />
              </div>
              <div>
                <p className="text-lg font-bold">Arrastre su archivo aquí o haga clic</p>
                <p className="text-sm text-muted-foreground mt-1">Soporta formatos CSV, XLSX o XLS (Máximo 5MB)</p>
              </div>
              <div className="text-xs font-semibold text-primary/80 bg-primary/10 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Info size={13} />
                La cabecera debe contener exactamente: email, full_name, role
              </div>
            </div>
          )}

          {/* PREVIEW MUTATION LOADING SKELETON */}
          {previewMutation.isPending && (
            <div className="py-16 flex flex-col items-center justify-center gap-4 animate-pulse">
              <Loader2 className="animate-spin text-primary" size={48} strokeWidth={2.5} />
              <div className="text-center">
                <p className="font-extrabold text-lg">Analizando filas y consistencia...</p>
                <p className="text-sm text-slate-500 font-medium">Validando sintaxis de correos, roles institucionales y duplicados...</p>
              </div>
            </div>
          )}

          {/* PHASE 2: PARSE PREVIEW GRID */}
          {file && preview && !result && (
            <div className="space-y-5 animate-fadeIn">
              {/* File Info Bar */}
              <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <FileText size={22} />
                  </div>
                  <div>
                    <p className="font-bold text-sm truncate max-w-[280px]">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleReset}>
                  Cambiar archivo
                </Button>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filas Totales</p>
                  <p className="text-2xl font-black mt-1 text-slate-700 dark:text-slate-300">{preview.total_rows}</p>
                </div>
                <div className="p-3.5 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-center">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Válidos</p>
                  <p className="text-2xl font-black mt-1 text-emerald-600">{preview.valid_rows}</p>
                </div>
                <div className="p-3.5 rounded-xl border border-destructive/10 bg-destructive/5 text-center">
                  <p className="text-xs font-bold text-destructive uppercase tracking-wider">Con Errores</p>
                  <p className="text-2xl font-black mt-1 text-destructive">{preview.invalid_rows}</p>
                </div>
              </div>

              {/* Options */}
              {hasInvalidRows && (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-500/10 bg-amber-500/5 text-sm font-semibold">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={18} />
                    <span>Se detectaron registros con anomalías críticas.</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={omitErrors}
                      onChange={(e) => setOmitErrors(e.target.checked)}
                      className="rounded border-amber-500/30 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                    />
                    <span className="text-amber-800 dark:text-amber-300 text-xs font-bold">Ignorar filas con errores</span>
                  </label>
                </div>
              )}

              {/* Row Grid Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-xs font-bold uppercase text-slate-500 tracking-wider sticky top-0 border-b z-10">
                    <tr>
                      <th className="p-3 w-12 text-center">Fila</th>
                      <th className="p-3">Docente</th>
                      <th className="p-3">Rol</th>
                      <th className="p-3 w-28 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium">
                    {activeRows.map((row) => (
                      <tr key={row.row_num} className={`hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors ${row.status === 'INVALID' ? 'bg-destructive/5' : ''}`}>
                        <td className="p-3 text-center text-xs text-muted-foreground">{row.row_num}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{row.full_name || <span className="italic text-slate-400">Sin nombre</span>}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{row.email || <span className="italic text-slate-400">Sin correo</span>}</div>
                          {row.errors.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {row.errors.map((e, i) => (
                                <p key={i} className="text-xs text-destructive flex items-center gap-1">
                                  <XCircle size={10} /> {e}
                                </p>
                              ))}
                            </div>
                          )}
                          {row.warnings.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {row.warnings.map((w, i) => (
                                <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <AlertTriangle size={10} /> {w}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {row.role ? (
                            <Badge variant="outline" className="text-[10px] uppercase font-extrabold">{row.role}</Badge>
                          ) : (
                            <span className="italic text-xs text-slate-400">Sin especificar</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {row.status === 'VALID' ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-bold text-xs">Válido</Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-none font-bold text-xs">Error</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PHASE 3: CONFIRMATION SUCCESS VIEW */}
          {result && (
            <div className="py-6 text-center space-y-6 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto scale-110">
                <CheckCircle size={36} className="animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                  ¡Importación Completada Exitosamente!
                </h3>
                <p className="text-sm text-muted-foreground font-semibold">
                  Se crearon de forma atómica <span className="font-extrabold text-primary">{result.imported_count}</span> usuarios en la base de datos de DIDACTICO.
                </p>
              </div>

              {!result.auto_activate && result.invitations.length > 0 && (
                <div className="space-y-4 text-left max-w-lg mx-auto">
                  <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Info size={14} className="text-primary" />
                      Enlaces de Activación Generados
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      Los usuarios han sido registrados en estado inactivo. Comparta o reenvíe los enlaces a continuación para que establezcan sus contraseñas.
                    </p>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl max-h-[220px] overflow-y-auto divide-y dark:divide-slate-800">
                    {result.invitations.map((inv, idx) => {
                      const activationLink = getActivationLink(inv.token)
                      return (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs font-medium hover:bg-slate-50/50 dark:hover:bg-slate-950/10">
                          <div className="truncate pr-4 flex-1">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{inv.email}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[340px]">{activationLink}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-primary hover:bg-primary/10 shrink-0"
                            onClick={() => copyToClipboard(activationLink, idx)}
                          >
                            {copiedIndex === idx ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dialog footer controls */}
        <DialogFooter className="shrink-0 border-t pt-4 mt-2">
          {!result ? (
            <div className="flex w-full items-center justify-between">
              <Button variant="outline" onClick={() => { handleReset(); onClose(); }}>
                Cancelar
              </Button>
              {file && preview && (
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleReset}>
                    Cargar otro
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={
                      confirmMutation.isPending || 
                      (omitErrors ? validRowsCount === 0 : preview.invalid_rows > 0)
                    }
                    className="gap-1.5 font-bold"
                  >
                    {confirmMutation.isPending ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        Proceder a Importar
                        <ArrowRight size={16} />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Button className="w-full font-bold" onClick={() => { handleReset(); onClose(); }}>
              Finalizar Proceso
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
