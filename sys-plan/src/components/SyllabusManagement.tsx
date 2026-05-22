import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Upload,
  FileArchive,
  Download,
  FileSpreadsheet,
  FileDown,
  Search,
  Plus,
  Edit3,
  History,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  GraduationCap,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  X,
  ArrowRight,
  FileText
} from 'lucide-react'
import api from '../lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

// Interface definitions
interface Subject {
  id: number
  code: string
  name: string
  program: string | null
  level: string
  academic_credits: number
  had_hours: number
  hde_hours: number
  hts_hours: number
  academic_period: number | null
  prerequisite: string | null
  document_code: string | null
  identification_date: string | null
  syllabus_version_year: string | null
  active_version: number | null
  filename: string | null
  version_id: number | null
  uploaded_at: string | null
  units_count: number
  correspondences_count: number
}

interface SubjectUnit {
  unit_number: string
  unit_title: string | null
  contents: string | null
  performance_criteria: string | null
}

interface SubjectCorrespondence {
  code: string
  name: string
  requirements: string | null
}

interface SubjectDetail extends Subject {
  presentation: string | null
  purpose: string | null
  previous_competencies: string | null
  generic_competencies: string | null
  relation_other_subjects: string | null
  teaching_strategies: string | null
  eval_diagnostica: string | null
  eval_formativa: string | null
  eval_sumativa: string | null
  bibliographic_references: string | null
  units: SubjectUnit[]
  correspondences: SubjectCorrespondence[]
}

interface SyllabusVersion {
  id: number
  version_number: number
  filename: string
  file_hash: string
  uploaded_at: string
  uploaded_by: string
  is_active: boolean
}

const formatParagraphs = (text: string | null | undefined): string => {
  if (!text) return ''
  
  // 1. Normalize tabs and multiple spaces
  let cleanedText = text.replace(/[ \t]+/g, ' ')
  
  // 2. Pre-process: detect pathological word-per-line patterns from PyMuPDF extraction.
  //    If most blocks between blank lines are just 1-2 words, collapse all blank lines
  //    into single newlines so the line-joining logic below can reconstruct paragraphs.
  const blocks = cleanedText.split(/\n\s*\n/).filter(b => b.trim())
  if (blocks.length > 3) {
    const shortBlockCount = blocks.filter(b => b.trim().split(/\s+/).length <= 2).length
    if (shortBlockCount / blocks.length > 0.5) {
      cleanedText = cleanedText.replace(/\n\s*\n/g, '\n')
    }
  }
  
  // 3. Split into lines and reconstruct paragraphs
  const lines = cleanedText.split('\n')
  
  const cleanedParagraphs: string[] = []
  let currentPara: string[] = []
  
  for (const line of lines) {
    const lineStr = line.trim()
    if (!lineStr) {
      if (currentPara.length > 0) {
        cleanedParagraphs.push(currentPara.join(' '))
        currentPara = []
      }
      continue
    }
    
    // Check if line starts with a list bullet, or list number/letter
    const isBullet = /^([-*•+o✓]|\d+\.|\w\))\s/.test(lineStr) || /^(TEMA|UNIDAD|SECCIÓN|CAPÍTULO)\s+\w+/i.test(lineStr)
    
    if (isBullet) {
      if (currentPara.length > 0) {
        cleanedParagraphs.push(currentPara.join(' '))
        currentPara = []
      }
      cleanedParagraphs.push(lineStr)
    } else {
      if (currentPara.length > 0 && currentPara[currentPara.length - 1].endsWith('-')) {
        currentPara[currentPara.length - 1] = currentPara[currentPara.length - 1].slice(0, -1) + lineStr
      } else {
        currentPara.push(lineStr)
      }
    }
  }
  
  if (currentPara.length > 0) {
    cleanedParagraphs.push(currentPara.join(' '))
  }
  
  return cleanedParagraphs
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

export default function SyllabusManagement() {
  const queryClient = useQueryClient()
  
  // State variables
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProgram, setSelectedProgram] = useState('ALL')
  const [selectedLevel, setSelectedLevel] = useState('ALL')
  const [uploadType, setUploadType] = useState<'pdf' | 'zip' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  
  // For manual edits form
  const [editForm, setEditForm] = useState<Partial<SubjectDetail>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch subjects query
  const { data: subjects = [], isLoading, refetch } = useQuery<Subject[]>({
    queryKey: ['syllabusSubjects'],
    queryFn: async () => {
      const { data } = await api.get('/syllabus/subjects')
      return data
    }
  })

  // Fetch subject details query (runs conditionally when selectedSubjectId changes and DetailModal is open)
  const { data: subjectDetail, refetch: refetchDetails, isLoading: isLoadingDetails } = useQuery<SubjectDetail>({
    queryKey: ['subjectDetail', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) throw new Error('No subject selected')
      const { data } = await api.get(`/syllabus/subjects/${selectedSubjectId}`)
      return data
    },
    enabled: !!selectedSubjectId && isDetailModalOpen
  })

  // Fetch subject versions query
  const { data: subjectVersions = [], refetch: refetchVersions, isLoading: isLoadingVersions } = useQuery<SyllabusVersion[]>({
    queryKey: ['subjectVersions', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) return []
      const { data } = await api.get(`/syllabus/subjects/${selectedSubjectId}/versions`)
      return data
    },
    enabled: !!selectedSubjectId && isHistoryModalOpen
  })

  // Sync edit form with fetched details
  useEffect(() => {
    if (subjectDetail) {
      setEditForm(subjectDetail)
    }
  }, [subjectDetail])

  // Get distinct programs for filters
  const programsList = useMemo(() => {
    const programs = new Set<string>()
    subjects.forEach(s => {
      if (s.program) programs.add(s.program)
    })
    return Array.from(programs).sort()
  }, [subjects])

  // Computed statistics
  const stats = useMemo(() => {
    const total = subjects.length
    const pregrado = subjects.filter(s => s.level.toUpperCase() === 'PREGRADO').length
    const postgrado = subjects.filter(s => s.level.toUpperCase() === 'POSTGRADO').length
    const totalHad = subjects.reduce((acc, s) => acc + (s.had_hours || 0), 0)
    const avgHad = total > 0 ? (totalHad / total).toFixed(1) : '0'

    return { total, pregrado, postgrado, avgHad }
  }, [subjects])

  // Filtering logic
  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      const matchesSearch = 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesProgram = 
        selectedProgram === 'ALL' || 
        s.program === selectedProgram

      const matchesLevel = 
        selectedLevel === 'ALL' || 
        s.level === selectedLevel

      return matchesSearch && matchesProgram && matchesLevel
    })
  }, [subjects, searchQuery, selectedProgram, selectedLevel])

  // Reset page to 1 when search query or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedProgram, selectedLevel])

  // Total pages calculation
  const totalPages = useMemo(() => {
    return Math.ceil(filteredSubjects.length / pageSize)
  }, [filteredSubjects, pageSize])

  // Paginated subjects slice
  const paginatedSubjects = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredSubjects.slice(startIndex, startIndex + pageSize)
  }, [filteredSubjects, currentPage, pageSize])

  // Mutation for saving manual updates
  const updateSubjectMutation = useMutation({
    mutationFn: async (payload: Partial<SubjectDetail>) => {
      if (!selectedSubjectId) return
      const { data } = await api.put(`/syllabus/subjects/${selectedSubjectId}`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syllabusSubjects'] })
      queryClient.invalidateQueries({ queryKey: ['subjectDetail', selectedSubjectId] })
      setEditMode(false)
      setUploadSuccess('Programa curricular actualizado con éxito.')
      setTimeout(() => setUploadSuccess(null), 4000)
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.detail || 'Error al guardar los cambios de la materia.')
      setTimeout(() => setUploadError(null), 5000)
    }
  })

  // Handle file uploads (PDF / ZIP)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    try {
      if (uploadType === 'pdf') {
        const { data } = await api.post('/syllabus/upload/pdf', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        setUploadSuccess(`PDF procesado exitosamente. Materia [${data.subject.code}] ${data.subject.name} cargada versión ${data.subject.version}.`)
      } else if (uploadType === 'zip') {
        const { data } = await api.post('/syllabus/upload/zip', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        const errorsText = data.errors.length > 0 ? ` Con advertencias en ${data.errors.length} archivos.` : ''
        setUploadSuccess(`Lote ZIP completado: ${data.inserted} materias nuevas importadas, ${data.updated} actualizadas, y ${data.ignored_duplicates} archivos duplicados omitidos por hash de seguridad.${errorsText}`)
      }
      refetch()
      setUploadType(null)
    } catch (err: any) {
      console.error(err)
      setUploadError(err.response?.data?.detail || 'Error al procesar el archivo subido. Asegúrese de que no tenga protección o esté dañado.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Securely download a physical PDF version
  const handleDownloadFile = async (versionId: number, filename: string) => {
    try {
      const response = await api.get(`/syllabus/download/${versionId}`, {
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Error al descargar el archivo físico del servidor.')
    }
  }

  // Export consolidating lists to Excel / CSV
  const handleExport = async (format: 'excel' | 'csv') => {
    try {
      const response = await api.get(`/syllabus/export/${format}`, {
        responseType: 'blob'
      })
      const mime = format === 'excel' 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        : 'text/csv'
      const blob = new Blob([response.data], { type: mime })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `consolidado_syllabus.${format === 'excel' ? 'xlsx' : 'csv'}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Error al descargar la matriz consolidada.')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHash(text)
    setTimeout(() => setCopiedHash(null), 2000)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border rounded-3xl p-8 shadow-xl shadow-foreground/[0.02]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2 rounded-xl">
              <BookOpen size={24} />
            </div>
            <Badge variant="outline" className="text-primary border-primary/20 bg-primary/[0.03] font-bold">
              Modulo de Administracion
            </Badge>
          </div>
          <h1 className="text-3xl font-black tracking-tight lg:text-4xl text-card-foreground">
            Programas Sinópticos
          </h1>
          <p className="text-muted-foreground max-w-xl font-medium">
            Sube, extrae con IA (PyMuPDF) y realiza el control de versiones de los syllabus curriculares institucionales.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              setUploadType('pdf')
              fileInputRef.current?.click()
            }}
            variant="outline"
            className="border-primary/20 text-primary hover:bg-primary/5 hover:text-primary gap-2 h-12 px-5 font-bold"
          >
            <Upload size={18} />
            Subir PDF
          </Button>
          <Button
            onClick={() => {
              setUploadType('zip')
              fileInputRef.current?.click()
            }}
            className="bg-primary hover:bg-primary/95 text-primary-foreground gap-2 h-12 px-6 font-extrabold shadow-lg shadow-primary/10"
          >
            <FileArchive size={18} />
            Importar ZIP
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept={uploadType === 'pdf' ? '.pdf' : '.zip'}
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Upload Alerts */}
      {uploading && (
        <Card className="bg-primary/[0.02] border-primary/20 border-dashed animate-pulse">
          <CardContent className="flex items-center gap-4 py-4">
            <Clock className="text-primary animate-spin" size={24} />
            <div>
              <p className="font-bold text-primary">Procesando archivo...</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                PyMuPDF extrae los metadatos de las materias y calcula la firma SHA-256 de seguridad física.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadError && (
        <Card className="bg-destructive/[0.03] border-destructive/20 border">
          <CardContent className="flex items-start gap-4 py-4">
            <AlertTriangle className="text-destructive mt-0.5" size={20} />
            <div>
              <p className="font-bold text-destructive">Error en Procesamiento</p>
              <p className="text-sm text-destructive/80 mt-1">{uploadError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadSuccess && (
        <Card className="bg-emerald-500/[0.03] border-emerald-500/20 border">
          <CardContent className="flex items-start gap-4 py-4">
            <CheckCircle2 className="text-emerald-500 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-emerald-600 dark:text-emerald-400">Operación Completada</p>
              <p className="text-sm text-muted-foreground mt-1">{uploadSuccess}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: 'Asignaturas Registradas',
            val: stats.total,
            icon: Layers,
            color: 'text-blue-500 bg-blue-500/10'
          },
          {
            title: 'Syllabus Pregrado',
            val: stats.pregrado,
            icon: GraduationCap,
            color: 'text-violet-500 bg-violet-500/10'
          },
          {
            title: 'Syllabus Postgrado',
            val: stats.postgrado,
            icon: Sparkles,
            color: 'text-amber-500 bg-amber-500/10'
          },
          {
            title: 'Horas Promedio HAD',
            val: `${stats.avgHad}h`,
            icon: Clock,
            color: 'text-emerald-500 bg-emerald-500/10'
          }
        ].map((item, idx) => (
          <Card key={idx} className="border bg-card/45 backdrop-blur-md rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center justify-between p-6">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{item.title}</p>
                <p className="text-3xl font-black">{item.val}</p>
              </div>
              <div className={`p-3.5 rounded-2xl ${item.color}`}>
                <item.icon size={22} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Workspace */}
      <Card className="border rounded-3xl overflow-hidden bg-card/65 shadow-md">
        <CardHeader className="p-6 md:p-8 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <span>Listado Curricular Institucional</span>
              <Badge variant="secondary" className="font-extrabold text-sm">{filteredSubjects.length}</Badge>
            </CardTitle>

            {/* Matrix Exports */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs font-bold"
                onClick={() => handleExport('excel')}
              >
                <FileSpreadsheet size={15} className="text-emerald-500" />
                Matriz Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs font-bold"
                onClick={() => handleExport('csv')}
              >
                <FileDown size={15} className="text-blue-500" />
                Matriz CSV
              </Button>
            </div>
          </div>

          {/* Filtering and search bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
              <Input
                placeholder="Buscar por código o materia..."
                className="pl-10 h-11 bg-muted/30"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div>
              <select
                className="w-full h-11 px-3.5 bg-muted/30 border border-input rounded-md text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                value={selectedProgram}
                onChange={e => setSelectedProgram(e.target.value)}
              >
                <option value="ALL">Todos los Programas Académicos</option>
                {programsList.map((prog, idx) => (
                  <option key={idx} value={prog}>{prog}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                className="w-full h-11 px-3.5 bg-muted/30 border border-input rounded-md text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                value={selectedLevel}
                onChange={e => setSelectedLevel(e.target.value)}
              >
                <option value="ALL">Todos los Niveles</option>
                <option value="PREGRADO">Pregrado</option>
                <option value="POSTGRADO">Postgrado</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground animate-pulse">
              <Clock className="animate-spin mx-auto mb-3" size={32} />
              Cargando catálogo curricular...
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                <BookOpen size={30} />
              </div>
              <div>
                <h3 className="text-xl font-bold">Sin registros coincidentes</h3>
                <p className="text-muted-foreground max-w-sm mx-auto text-sm mt-1">
                  No se encontraron materias con el filtro o búsqueda actual. Sube un PDF para añadir registros.
                </p>
              </div>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/35">
                  <TableRow>
                    <TableHead className="font-bold pl-6">Código</TableHead>
                    <TableHead className="font-bold">Materia / Unidad Curricular</TableHead>
                    <TableHead className="font-bold">Programa Académico</TableHead>
                    <TableHead className="font-bold">Nivel</TableHead>
                    <TableHead className="font-bold text-center">Créditos</TableHead>
                    <TableHead className="font-bold text-center">Horas HAD/HDE</TableHead>
                    <TableHead className="font-bold text-center">Vigencia</TableHead>
                    <TableHead className="font-bold text-center">Carga Activa</TableHead>
                    <TableHead className="font-bold text-right pr-6">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSubjects.map(sub => (
                    <TableRow key={sub.id} className="hover:bg-muted/10">
                      <TableCell className="font-bold pl-6 text-primary">{sub.code}</TableCell>
                      <TableCell className="font-bold max-w-xs truncate">{sub.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs font-semibold">{sub.program || 'No Asignado'}</TableCell>
                      <TableCell>
                        <Badge variant={sub.level.toUpperCase() === 'PREGRADO' ? 'default' : 'secondary'} className="text-[10px] uppercase font-bold tracking-wider px-2">
                          {sub.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{sub.academic_credits}</TableCell>
                      <TableCell className="text-center text-xs font-medium">
                        <span className="text-emerald-500 font-bold">{sub.had_hours}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-violet-500 font-bold">{sub.hde_hours}</span>
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold text-muted-foreground">
                        {sub.syllabus_version_year || '2024'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-full px-2.5">
                          v{sub.active_version || 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 space-x-1.5">
                        <Button
                           variant="ghost"
                           size="sm"
                           className="h-8 w-8 p-0"
                           title="Detalles y Edición"
                           onClick={() => {
                             setSelectedSubjectId(sub.id)
                             setIsDetailModalOpen(true)
                             setEditMode(false)
                           }}
                        >
                          <Info size={15} />
                        </Button>
                        <Button
                           variant="ghost"
                           size="sm"
                           className="h-8 w-8 p-0 text-violet-500 hover:text-violet-600 hover:bg-violet-500/5"
                           title="Historial de Versiones"
                           onClick={() => {
                             setSelectedSubjectId(sub.id)
                             setIsHistoryModalOpen(true)
                           }}
                        >
                          <History size={15} />
                        </Button>
                        {sub.version_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/5"
                            title="Descargar PDF"
                            onClick={() => handleDownloadFile(sub.version_id!, sub.filename!)}
                          >
                            <Download size={15} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t bg-muted/10">
              <div className="text-xs font-bold text-muted-foreground">
                Mostrando <span className="text-foreground">{filteredSubjects.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> al{' '}
                <span className="text-foreground">
                  {Math.min(currentPage * pageSize, filteredSubjects.length)}
                </span>{' '}
                de <span className="text-foreground">{filteredSubjects.length}</span> asignaturas
              </div>
              
              <div className="flex items-center gap-6">
                {/* Selector de cantidad por página */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">Filas por página:</span>
                  <select
                    className="h-8 px-2 bg-muted/40 border border-input rounded-md text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                    value={pageSize}
                    onChange={e => {
                      setPageSize(parseInt(e.target.value))
                      setCurrentPage(1)
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                {/* Controles de página */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    title="Primera página"
                  >
                    <ChevronLeft size={14} className="stroke-[3]" />
                    <ChevronLeft size={14} className="stroke-[3] -ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    title="Página anterior"
                  >
                    <ChevronLeft size={14} className="stroke-[3]" />
                  </Button>
                  
                  <span className="text-xs font-bold text-muted-foreground px-2">
                    Pág. <span className="text-foreground">{currentPage}</span> de <span className="text-foreground">{totalPages || 1}</span>
                  </span>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    title="Siguiente página"
                  >
                    <ChevronRight size={14} className="stroke-[3]" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    title="Última página"
                  >
                    <ChevronRight size={14} className="stroke-[3]" />
                    <ChevronRight size={14} className="stroke-[3] -ml-2" />
                  </Button>
                </div>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal 1: Details & Editor Modal */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl h-[85vh] bg-card border rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 md:p-8 bg-muted/40 border-b flex items-center justify-between shrink-0">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 font-extrabold text-xs">
                    {editForm.code || 'NUEVO'}
                  </Badge>
                  <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-full">
                    Activo v{editForm.active_version || 1}
                  </Badge>
                </div>
                <h3 className="text-xl md:text-2xl font-black max-w-xl truncate text-card-foreground">
                  {editMode ? 'Editar Unidad Curricular' : editForm.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!editMode ? (
                  <Button
                    onClick={() => setEditMode(true)}
                    variant="outline"
                    className="border-primary/20 text-primary hover:bg-primary/5 h-10 px-4 font-bold"
                  >
                    <Edit3 size={16} className="mr-1.5" />
                    Editar
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => setEditMode(false)}
                      variant="ghost"
                      className="h-10 px-4 font-bold"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => updateSubjectMutation.mutate(editForm)}
                      className="bg-primary hover:bg-primary/95 text-primary-foreground h-10 px-5 font-bold shadow-lg shadow-primary/10"
                      disabled={updateSubjectMutation.isPending}
                    >
                      {updateSubjectMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-10 w-10 shrink-0"
                  onClick={() => setIsDetailModalOpen(false)}
                >
                  <X size={20} />
                </Button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
              {isLoadingDetails ? (
                <div className="h-full flex items-center justify-center text-muted-foreground animate-pulse">
                  <Clock className="animate-spin mr-2" /> Cargando especificaciones detalladas del syllabus...
                </div>
              ) : (
                <>
                  {/* Grid 1: Basic academic definitions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Unidad Curricular</label>
                      {editMode ? (
                        <Input
                          value={editForm.name || ''}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      ) : (
                        <p className="font-bold text-lg">{editForm.name}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Programa Académico (Carrera)</label>
                      {editMode ? (
                        <Input
                          value={editForm.program || ''}
                          onChange={e => setEditForm({ ...editForm, program: e.target.value })}
                        />
                      ) : (
                        <p className="font-bold text-lg">{editForm.program || 'No Registrado'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Código de Control (Documento)</label>
                      {editMode ? (
                        <Input
                          value={editForm.document_code || ''}
                          onChange={e => setEditForm({ ...editForm, document_code: e.target.value })}
                        />
                      ) : (
                        <p className="font-mono font-bold text-lg">{editForm.document_code || 'S/N'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nivel</label>
                      {editMode ? (
                        <select
                          className="w-full h-10 px-3 bg-background border border-input rounded-md text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                          value={editForm.level}
                          onChange={e => setEditForm({ ...editForm, level: e.target.value })}
                        >
                          <option value="PREGRADO">PREGRADO</option>
                          <option value="POSTGRADO">POSTGRADO</option>
                        </select>
                      ) : (
                        <p className="font-bold text-lg text-primary">{editForm.level}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Créditos Académicos</label>
                      {editMode ? (
                        <Input
                          type="number"
                          value={editForm.academic_credits || 0}
                          onChange={e => setEditForm({ ...editForm, academic_credits: parseInt(e.target.value) || 0 })}
                        />
                      ) : (
                        <p className="font-bold text-lg">{editForm.academic_credits} U.C.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Periodo Académico Recomendado</label>
                      {editMode ? (
                        <Input
                          type="number"
                          value={editForm.academic_period || ''}
                          onChange={e => setEditForm({ ...editForm, academic_period: parseInt(e.target.value) || null })}
                        />
                      ) : (
                        <p className="font-bold text-lg">Trimestre / Semestre {editForm.academic_period || 'N/A'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Horas HAD (Acompañamiento Docente)</label>
                      {editMode ? (
                        <Input
                          type="number"
                          value={editForm.had_hours || 0}
                          onChange={e => setEditForm({ ...editForm, had_hours: parseInt(e.target.value) || 0 })}
                        />
                      ) : (
                        <p className="font-bold text-lg text-emerald-500">{editForm.had_hours} horas</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Horas HDE (Trabajo Independiente)</label>
                      {editMode ? (
                        <Input
                          type="number"
                          value={editForm.hde_hours || 0}
                          onChange={e => setEditForm({ ...editForm, hde_hours: parseInt(e.target.value) || 0 })}
                        />
                      ) : (
                        <p className="font-bold text-lg text-violet-500">{editForm.hde_hours} horas</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Horas HTS (Totales Semanales)</label>
                      {editMode ? (
                        <Input
                          type="number"
                          value={editForm.hts_hours || 0}
                          onChange={e => setEditForm({ ...editForm, hts_hours: parseInt(e.target.value) || 0 })}
                        />
                      ) : (
                        <p className="font-bold text-lg text-blue-500">{editForm.hts_hours} horas</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Section 2: Requisites, Presentation and Purpose */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                        <Layers size={16} className="text-primary" />
                        Requisitos y Prelaciones Académicas
                      </h4>
                      {editMode ? (
                        <Textarea
                          className="min-h-[80px]"
                          value={editForm.prerequisite || ''}
                          onChange={e => setEditForm({ ...editForm, prerequisite: e.target.value })}
                        />
                      ) : (
                        <Card className="bg-muted/20">
                          <CardContent className="p-4 text-sm font-medium leading-relaxed">
                            {editForm.prerequisite ? formatParagraphs(editForm.prerequisite) : 'Ninguna prelación requerida para cursar la asignatura.'}
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-500" />
                        Propósito de la Unidad Curricular
                      </h4>
                      {editMode ? (
                        <Textarea
                          className="min-h-[80px]"
                          value={editForm.purpose || ''}
                          onChange={e => setEditForm({ ...editForm, purpose: e.target.value })}
                        />
                      ) : (
                        <Card className="bg-muted/20">
                          <CardContent className="p-4 text-sm font-medium leading-relaxed">
                            {editForm.purpose ? formatParagraphs(editForm.purpose) : 'Propósito institucional pendiente de registro.'}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                      <Info size={16} className="text-blue-500" />
                      Presentación Curricular General
                    </h4>
                    {editMode ? (
                      <Textarea
                        className="min-h-[120px]"
                        value={editForm.presentation || ''}
                        onChange={e => setEditForm({ ...editForm, presentation: e.target.value })}
                      />
                    ) : (
                      <Card className="bg-muted/20">
                        <CardContent className="p-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-line font-medium">
                          {editForm.presentation ? formatParagraphs(editForm.presentation) : 'Presentación sinóptica de la materia.'}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <Separator />

                  {/* Section 3: Competencies and Relationships */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Competencias Previas</h5>
                      {editMode ? (
                        <Textarea
                          className="min-h-[100px]"
                          value={editForm.previous_competencies || ''}
                          onChange={e => setEditForm({ ...editForm, previous_competencies: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm leading-relaxed text-muted-foreground font-semibold bg-muted/15 rounded-xl p-4 min-h-[100px] whitespace-pre-line">
                          {editForm.previous_competencies ? formatParagraphs(editForm.previous_competencies) : 'Ninguna especificada.'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Competencias Genéricas</h5>
                      {editMode ? (
                        <Textarea
                          className="min-h-[100px]"
                          value={editForm.generic_competencies || ''}
                          onChange={e => setEditForm({ ...editForm, generic_competencies: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm leading-relaxed text-muted-foreground font-semibold bg-muted/15 rounded-xl p-4 min-h-[100px] whitespace-pre-line">
                          {editForm.generic_competencies ? formatParagraphs(editForm.generic_competencies) : 'Ninguna especificada.'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Relación con otras Unidades</h5>
                      {editMode ? (
                        <Textarea
                          className="min-h-[100px]"
                          value={editForm.relation_other_subjects || ''}
                          onChange={e => setEditForm({ ...editForm, relation_other_subjects: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm leading-relaxed text-muted-foreground font-semibold bg-muted/15 rounded-xl p-4 min-h-[100px] whitespace-pre-line">
                          {editForm.relation_other_subjects ? formatParagraphs(editForm.relation_other_subjects) : 'Ninguna especificada.'}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Section 4: Learning units program structure */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                      <Layers size={16} className="text-primary" />
                      Estructura Programática y Unidades de Aprendizaje
                    </h4>
                    {editForm.units && editForm.units.length > 0 ? (
                      <div className="space-y-4">
                        {editForm.units.map((unit, idx) => (
                          <Card key={idx} className="border border-muted/50 overflow-hidden bg-card">
                            <div className="bg-muted/20 px-5 py-3 border-b flex justify-between items-center">
                              <Badge className="font-extrabold text-[11px] bg-primary/10 text-primary border-0 rounded-full px-3 py-1 uppercase">
                                {unit.unit_number}
                              </Badge>
                              <span className="text-sm font-black text-card-foreground">
                                {unit.unit_title || 'Unidad de Aprendizaje'}
                              </span>
                            </div>
                            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <span className="text-[10px] font-black tracking-wider uppercase text-muted-foreground">Contenidos Curriculares</span>
                                <p className="text-sm leading-relaxed text-muted-foreground bg-muted/10 rounded-xl p-4 whitespace-pre-line font-medium">
                                  {unit.contents ? formatParagraphs(unit.contents) : 'Contenidos temáticos no provistos.'}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <span className="text-[10px] font-black tracking-wider uppercase text-muted-foreground">Criterios de Desempeño</span>
                                <p className="text-sm leading-relaxed text-muted-foreground bg-muted/10 rounded-xl p-4 whitespace-pre-line font-medium">
                                  {unit.performance_criteria ? formatParagraphs(unit.performance_criteria) : 'Criterios evaluativos no provistos.'}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No se han cargado unidades de aprendizaje estructuradas para esta materia.
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Section 5: Strategies and Evaluative criteria */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-black text-foreground">Estrategias Didácticas Aplicadas</h4>
                    {editMode ? (
                      <Textarea
                        className="min-h-[80px]"
                        value={editForm.teaching_strategies || ''}
                        onChange={e => setEditForm({ ...editForm, teaching_strategies: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm leading-relaxed text-muted-foreground bg-muted/10 rounded-xl p-4 font-semibold whitespace-pre-line">
                        {editForm.teaching_strategies ? formatParagraphs(editForm.teaching_strategies) : 'Estrategias y dinámicas pedagógicas.'}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <span className="text-[10px] font-black tracking-wider uppercase text-muted-foreground">Evaluación Diagnóstica</span>
                      {editMode ? (
                        <Textarea
                          className="min-h-[80px]"
                          value={editForm.eval_diagnostica || ''}
                          onChange={e => setEditForm({ ...editForm, eval_diagnostica: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm leading-relaxed text-muted-foreground bg-muted/10 rounded-xl p-4 font-semibold min-h-[80px] whitespace-pre-line">
                          {editForm.eval_diagnostica ? formatParagraphs(editForm.eval_diagnostica) : 'No especificada.'}
                        </p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <span className="text-[10px] font-black tracking-wider uppercase text-muted-foreground">Evaluación Formativa</span>
                      {editMode ? (
                        <Textarea
                          className="min-h-[80px]"
                          value={editForm.eval_formativa || ''}
                          onChange={e => setEditForm({ ...editForm, eval_formativa: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm leading-relaxed text-muted-foreground bg-muted/10 rounded-xl p-4 font-semibold min-h-[80px] whitespace-pre-line">
                          {editForm.eval_formativa ? formatParagraphs(editForm.eval_formativa) : 'No especificada.'}
                        </p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <span className="text-[10px] font-black tracking-wider uppercase text-muted-foreground">Evaluación Sumativa</span>
                      {editMode ? (
                        <Textarea
                          className="min-h-[80px]"
                          value={editForm.eval_sumativa || ''}
                          onChange={e => setEditForm({ ...editForm, eval_sumativa: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm leading-relaxed text-muted-foreground bg-muted/10 rounded-xl p-4 font-semibold min-h-[80px] whitespace-pre-line">
                          {editForm.eval_sumativa ? formatParagraphs(editForm.eval_sumativa) : 'No especificada.'}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Section 6: Bibliographic references */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-black text-foreground">Referencias Bibliográficas Académicas</h4>
                    {editMode ? (
                      <Textarea
                        className="min-h-[120px]"
                        value={editForm.bibliographic_references || ''}
                        onChange={e => setEditForm({ ...editForm, bibliographic_references: e.target.value })}
                      />
                    ) : (
                      <Card className="bg-muted/20">
                        <CardContent className="p-5 text-sm font-mono leading-relaxed whitespace-pre-line text-muted-foreground">
                          {editForm.bibliographic_references ? formatParagraphs(editForm.bibliographic_references) : 'No se han registrado referencias de libros o autores para esta asignatura.'}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-muted/20 border-t shrink-0 flex justify-end">
              <Button
                variant="default"
                className="bg-foreground text-background hover:bg-foreground/90 font-bold"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Cerrar Ventana
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Versions History Timeline */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl h-[70vh] bg-card border rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-muted/40 border-b flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-card-foreground">
                  Historial de Versiones
                </h3>
                <p className="text-xs text-muted-foreground font-semibold">
                  Control de cambios e integridad física (hashes SHA-256) de los syllabus cargados.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-10 w-10"
                onClick={() => setIsHistoryModalOpen(false)}
              >
                <X size={20} />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isLoadingVersions ? (
                <div className="h-full flex items-center justify-center text-muted-foreground animate-pulse">
                  <Clock className="animate-spin mr-2" /> Cargando historial de cambios...
                </div>
              ) : subjectVersions.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No se han registrado versiones previas.</p>
              ) : (
                <div className="relative border-l border-primary/20 ml-3 pl-6 space-y-8 py-2">
                  {subjectVersions.map((version, idx) => (
                    <div key={version.id} className="relative group">
                      {/* Timeline Dot Indicator */}
                      <span className={`absolute -left-[31px] top-1.5 flex items-center justify-center w-5 h-5 rounded-full border-2 bg-card ${
                        version.is_active 
                          ? 'border-emerald-500 text-emerald-500 ring-4 ring-emerald-500/10' 
                          : 'border-primary/45 text-muted-foreground'
                      }`}>
                        {version.is_active ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                      </span>

                      {/* Content Card */}
                      <div className="bg-muted/15 hover:bg-muted/25 transition-colors p-5 rounded-2xl border space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm">Versión {version.version_number}</span>
                            {version.is_active && (
                              <Badge className="bg-emerald-500 text-white font-extrabold text-[9px] uppercase tracking-wider py-0.5 px-2 rounded-full">
                                Carga Activa
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                            <Calendar size={13} />
                            {new Date(version.uploaded_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-card-foreground font-bold">
                            <FileText size={14} className="text-primary/70" />
                            <span className="truncate max-w-sm">{version.filename}</span>
                          </div>
                          
                          {/* Actor responsible */}
                          <p className="text-[11px] text-muted-foreground font-semibold">
                            Subido por administrador: <span className="text-foreground">{version.uploaded_by}</span>
                          </p>

                          {/* Cryptographic SHA-256 validation */}
                          <div className="bg-card border rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-3 max-w-md">
                            <span className="text-[9px] font-mono text-muted-foreground truncate select-all">
                              SHA256: {version.file_hash}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0 text-muted-foreground"
                              title="Copiar Hash de Integridad"
                              onClick={() => copyToClipboard(version.file_hash)}
                            >
                              {copiedHash === version.file_hash ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </Button>
                          </div>
                        </div>

                        {/* Direct version file download */}
                        <div className="flex justify-end pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs font-bold gap-1 border-primary/20 text-primary hover:bg-primary/5 h-8"
                            onClick={() => handleDownloadFile(version.id, version.filename)}
                          >
                            <Download size={13} />
                            Descargar Archivo v{version.version_number}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-muted/20 border-t shrink-0 flex justify-end">
              <Button
                variant="default"
                className="bg-foreground text-background hover:bg-foreground/90 font-bold"
                onClick={() => setIsHistoryModalOpen(false)}
              >
                Cerrar Historial
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
