import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  Layers,
  Clock,
  Sparkles,
  Info,
  Download,
  X,
  GraduationCap,
  Calendar,
  FileText
} from 'lucide-react'
import api from '../lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

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

interface SubjectDetail {
  id: number
  code: string
  name: string
  document_code: string | null
  program: string | null
  level: string
  identification_date: string | null
  syllabus_version_year: string | null
  academic_credits: number
  had_hours: number
  hde_hours: number
  hts_hours: number
  academic_period: number | null
  prerequisite: string | null
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
  active_version: number | null
  version_id: number | null
  units: SubjectUnit[]
  correspondences: SubjectCorrespondence[]
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

export function SubjectDetailModal({
  subjectId,
  onClose
}: {
  subjectId: number
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'units' | 'strategies' | 'references'>('general')

  // Fetch subject details via proxy (now accessible to DOCENTES)
  const { data: subject, isLoading, error } = useQuery<SubjectDetail>({
    queryKey: ['subjectDetail', subjectId],
    queryFn: async () => {
      const { data } = await api.get(`/syllabus/subjects/${subjectId}`)
      return data
    },
    enabled: !!subjectId
  })

  // Download syllabus PDF
  const handleDownloadFile = async () => {
    if (!subject || !subject.version_id) return
    try {
      const response = await api.get(`/syllabus/download/${subject.version_id}`, {
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${subject.code}_Syllabus.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Error al descargar el archivo físico del programa sinóptico.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[85vh] bg-card border rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 md:p-8 bg-muted/40 border-b flex items-center justify-between shrink-0">
          {subject ? (
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 font-extrabold text-xs">
                  {subject.code}
                </Badge>
                {subject.active_version && (
                  <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-full">
                    Activo v{subject.active_version}
                  </Badge>
                )}
              </div>
              <h3 className="text-xl md:text-2xl font-black truncate text-card-foreground">
                {subject.name}
              </h3>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            </div>
          )}
          
          <div className="flex items-center gap-2 shrink-0">
            {subject?.version_id && (
              <Button
                onClick={handleDownloadFile}
                variant="outline"
                className="border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/5 h-10 px-4 font-bold gap-1.5"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Descargar PDF</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-10 w-10"
              onClick={onClose}
            >
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Tab Selector */}
        {subject && (
          <div className="px-6 md:px-8 border-b bg-card shrink-0 flex gap-4 overflow-x-auto scrollbar-none">
            {[
              { id: 'general', label: 'Información General', icon: Info },
              { id: 'units', label: 'Unidades de Aprendizaje', icon: Layers },
              { id: 'strategies', label: 'Estrategias y Evaluación', icon: Sparkles },
              { id: 'references', label: 'Prelaciones y Referencias', icon: BookOpen }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-all shrink-0 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground animate-pulse gap-3">
              <Clock className="animate-spin text-primary" size={32} />
              <p className="font-bold">Cargando especificaciones del syllabus...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-destructive gap-3 text-center p-6">
              <X className="bg-destructive/10 p-2 rounded-full" size={48} />
              <h4 className="text-xl font-bold">Error de Carga</h4>
              <p className="text-sm max-w-md text-muted-foreground">
                No se pudo cargar la información curricular de la materia. Puede que el programa sinóptico no esté completamente registrado.
              </p>
            </div>
          ) : subject ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* TAB 1: General Info */}
              {activeTab === 'general' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Programa Académico</span>
                      <p className="font-bold text-base bg-muted/30 p-3 rounded-xl">{subject.program || 'No Registrado'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Código de Documento</span>
                      <p className="font-mono font-bold text-base bg-muted/30 p-3 rounded-xl">{subject.document_code || 'S/N'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Nivel de Estudio</span>
                      <p className="font-bold text-base text-primary bg-muted/30 p-3 rounded-xl">{subject.level}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Créditos Académicos</span>
                      <p className="font-bold text-base bg-muted/30 p-3 rounded-xl">{subject.academic_credits} UC</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Periodo Recomendado</span>
                      <p className="font-bold text-base bg-muted/30 p-3 rounded-xl">Trimestre / Semestre {subject.academic_period || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Horas Acompañamiento (HAD)</span>
                      <p className="font-bold text-base text-emerald-600 dark:text-emerald-400 bg-muted/30 p-3 rounded-xl">{subject.had_hours} horas</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Horas Trabajo Independiente (HDE)</span>
                      <p className="font-bold text-base text-violet-600 dark:text-violet-400 bg-muted/30 p-3 rounded-xl">{subject.hde_hours} horas</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Horas Totales Semanales (HTS)</span>
                      <p className="font-bold text-base text-blue-600 dark:text-blue-400 bg-muted/30 p-3 rounded-xl">{subject.hts_hours} horas</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Año de Versión Syllabus</span>
                      <p className="font-bold text-base bg-muted/30 p-3 rounded-xl">{subject.syllabus_version_year || '2024'}</p>
                    </div>
                  </div>

                  <Separator />

                  {subject.purpose && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-500" />
                        Propósito de la Asignatura
                      </h4>
                      <Card className="bg-muted/15 border-none shadow-none">
                        <CardContent className="p-4 text-sm font-medium leading-relaxed whitespace-pre-line text-muted-foreground">
                          {formatParagraphs(subject.purpose)}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {subject.presentation && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                        <Info size={16} className="text-blue-500" />
                        Presentación Curricular
                      </h4>
                      <Card className="bg-muted/15 border-none shadow-none">
                        <CardContent className="p-4 text-sm font-medium leading-relaxed whitespace-pre-line text-muted-foreground">
                          {formatParagraphs(subject.presentation)}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: Learning Units */}
              {activeTab === 'units' && (
                <div className="space-y-6">
                  {subject.units && subject.units.length > 0 ? (
                    subject.units.map((unit, idx) => (
                      <Card key={idx} className="border bg-card shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                        <div className="bg-muted/35 px-6 py-4 border-b">
                          <h4 className="font-black text-base text-foreground flex items-center gap-2.5">
                            <Badge className="bg-primary hover:bg-primary text-primary-foreground font-black px-2 py-0.5 rounded-lg text-xs">
                              U {unit.unit_number}
                            </Badge>
                            {unit.unit_title || 'Unidad de Aprendizaje'}
                          </h4>
                        </div>
                        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <BookOpen size={14} className="text-primary" />
                              Contenidos Temáticos
                            </h5>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/10 p-4 rounded-xl font-medium min-h-[100px]">
                              {unit.contents ? formatParagraphs(unit.contents) : 'No especificados.'}
                            </p>
                          </div>
                          <div className="space-y-3">
                            <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles size={14} className="text-amber-500" />
                              Criterios de Desempeño
                            </h5>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/10 p-4 rounded-xl font-medium min-h-[100px]">
                              {unit.performance_criteria ? formatParagraphs(unit.performance_criteria) : 'No especificados.'}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Layers size={36} className="mx-auto mb-2 text-muted-foreground/50" />
                      <p className="font-bold">No hay unidades de aprendizaje cargadas.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Strategies and Evaluations */}
              {activeTab === 'strategies' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {subject.teaching_strategies && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                        <Sparkles size={16} className="text-primary" />
                        Estrategias de Aprendizaje y Enseñanza
                      </h4>
                      <Card className="bg-muted/15 border-none shadow-none">
                        <CardContent className="p-4 text-sm font-medium leading-relaxed whitespace-pre-line text-muted-foreground">
                          {formatParagraphs(subject.teaching_strategies)}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="space-y-6">
                    <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                      <Layers size={16} className="text-violet-500" />
                      Plan de Evaluación
                    </h4>

                    {subject.eval_diagnostica && (
                      <div className="space-y-2">
                        <Badge className="bg-blue-500 text-white font-bold text-[10px]">DIAGNÓSTICA</Badge>
                        <p className="text-sm leading-relaxed text-muted-foreground bg-muted/20 p-3 rounded-xl font-medium">
                          {formatParagraphs(subject.eval_diagnostica)}
                        </p>
                      </div>
                    )}

                    {subject.eval_formativa && (
                      <div className="space-y-2">
                        <Badge className="bg-violet-500 text-white font-bold text-[10px]">FORMATIVA</Badge>
                        <p className="text-sm leading-relaxed text-muted-foreground bg-muted/20 p-3 rounded-xl font-medium">
                          {formatParagraphs(subject.eval_formativa)}
                        </p>
                      </div>
                    )}

                    {subject.eval_sumativa && (
                      <div className="space-y-2">
                        <Badge className="bg-amber-500 text-white font-bold text-[10px]">SUMATIVA</Badge>
                        <p className="text-sm leading-relaxed text-muted-foreground bg-muted/20 p-3 rounded-xl font-medium">
                          {formatParagraphs(subject.eval_sumativa)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: Prerequisites and Bibliographies */}
              {activeTab === 'references' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    {subject.prerequisite && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                          <Layers size={16} className="text-primary" />
                          Prelaciones y Requisitos
                        </h4>
                        <p className="text-sm leading-relaxed text-muted-foreground bg-muted/15 p-4 rounded-xl font-medium whitespace-pre-line">
                          {formatParagraphs(subject.prerequisite)}
                        </p>
                      </div>
                    )}

                    {subject.relation_other_subjects && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                          <Info size={16} className="text-blue-500" />
                          Relación con Otras Asignaturas
                        </h4>
                        <p className="text-sm leading-relaxed text-muted-foreground bg-muted/15 p-4 rounded-xl font-medium whitespace-pre-line">
                          {formatParagraphs(subject.relation_other_subjects)}
                        </p>
                      </div>
                    )}

                    {subject.previous_competencies && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                          <GraduationCap size={16} className="text-violet-500" />
                          Competencias Previas Recomendadas
                        </h4>
                        <p className="text-sm leading-relaxed text-muted-foreground bg-muted/15 p-4 rounded-xl font-medium whitespace-pre-line">
                          {formatParagraphs(subject.previous_competencies)}
                        </p>
                      </div>
                    )}
                  </div>

                  {subject.bibliographic_references && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                        <BookOpen size={16} className="text-amber-500" />
                        Referencias Bibliográficas (APA)
                      </h4>
                      <Card className="bg-muted/15 border-none shadow-none">
                        <CardContent className="p-4 text-sm font-mono leading-relaxed whitespace-pre-line text-muted-foreground text-xs">
                          {formatParagraphs(subject.bibliographic_references)}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : null}
        </div>

      </div>
    </div>
  )
}
