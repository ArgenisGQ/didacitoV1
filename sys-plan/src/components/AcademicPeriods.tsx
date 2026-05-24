import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, isBefore, isAfter, isWithinInterval, addDays, parseISO } from 'date-fns'
import api from '../lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Wand2, Plus, Calendar as CalendarIcon, Trash2, CheckCircle2, Clock, History, Pencil, Power } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AcademicPeriod {
  id: number
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  type: string
}

export default function AcademicPeriods() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    type: 'NORMAL',
    is_active: false
  })
  const [futurePage, setFuturePage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const ITEMS_PER_PAGE = 3
  const { data: periods = [], isLoading } = useQuery<AcademicPeriod[]>({
    queryKey: ['academic-periods'],
    queryFn: async () => {
      const { data } = await api.get('/academic-periods')
      return data
    }
  })

  useEffect(() => {
    setFuturePage(1)
    setHistoryPage(1)
  }, [periods])

  useEffect(() => {
    // Automatically load suggested dates on initial load
    const loadInitialDates = async () => {
      try {
        const { data } = await api.get('/academic-periods/suggest-dates?type=NORMAL')
        if (data.start_date && data.end_date) {
          setFormData(prev => ({
            ...prev,
            start_date: data.start_date,
            end_date: data.end_date
          }))
        }
      } catch (e) {
        console.error('Error fetching initial suggested dates:', e)
      }
    }
    loadInitialDates()
  }, [])

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/academic-periods', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-periods'] })
      setIsCreating(false)
      setEditingPeriod(null)
      setFormData({ name: '', start_date: '', end_date: '', type: 'NORMAL', is_active: false })
      toast({ title: 'Periodo creado exitosamente' })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al crear',
        description: error.response?.data?.detail || 'Ocurrió un error inesperado',
        variant: 'destructive'
      })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const { data } = await api.put(`/academic-periods/${id}`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-periods'] })
      setIsCreating(false)
      setEditingPeriod(null)
      setFormData({ name: '', start_date: '', end_date: '', type: 'NORMAL', is_active: false })
      toast({ title: 'Periodo actualizado' })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/academic-periods/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-periods'] })
      toast({ title: 'Periodo eliminado' })
    }
  })

  const handleSuggestDates = async () => {
    try {
      const { data } = await api.get(`/academic-periods/suggest-dates?type=${formData.type}`)
      if (data.start_date && data.end_date) {
        setFormData(prev => ({
          ...prev,
          start_date: data.start_date,
          end_date: data.end_date
        }))
        toast({ title: 'Fechas autocompletadas según historial' })
      }
    } catch (e) {
      toast({ title: 'Error al sugerir fechas', variant: 'destructive' })
    }
  }

  const handleSave = () => {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast({ title: 'Complete todos los campos obligatorios', variant: 'destructive' })
      return
    }
    if (editingPeriod) {
      updateMutation.mutate({ id: editingPeriod.id, ...formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEditClick = (period: AcademicPeriod) => {
    setEditingPeriod(period)
    setFormData({
      name: period.name,
      start_date: period.start_date,
      end_date: period.end_date,
      type: period.type,
      is_active: period.is_active
    })
    setIsCreating(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  const { activePeriod, futurePeriods, historyPeriods } = useMemo(() => {
    const active = periods.find(p => p.is_active)
    const future = periods.filter(p => !p.is_active && p.start_date > today)
    const history = periods.filter(p => !p.is_active && p.start_date <= today)

    return {
      activePeriod: active,
      futurePeriods: future,
      historyPeriods: history
    }
  }, [periods, today])

  const paginatedFuturePeriods = useMemo(() => {
    const startIdx = (futurePage - 1) * ITEMS_PER_PAGE
    return futurePeriods.slice(startIdx, startIdx + ITEMS_PER_PAGE)
  }, [futurePeriods, futurePage])

  const paginatedHistoryPeriods = useMemo(() => {
    const startIdx = (historyPage - 1) * ITEMS_PER_PAGE
    return historyPeriods.slice(startIdx, startIdx + ITEMS_PER_PAGE)
  }, [historyPeriods, historyPage])

  const totalFuturePages = Math.ceil(futurePeriods.length / ITEMS_PER_PAGE)
  const totalHistoryPages = Math.ceil(historyPeriods.length / ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Periodos Académicos</h2>
        <p className="text-muted-foreground">Configura los semestres y periodos intensivos de la institución.</p>
      </div>

      {isCreating ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>{editingPeriod ? 'Editar Periodo Académico' : 'Nuevo Periodo Académico'}</CardTitle>
            <CardDescription>{editingPeriod ? 'Modifica los parámetros del periodo seleccionado.' : 'Crea un nuevo periodo y opcionalmente autocompleta las fechas.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del Periodo</Label>
                <Input
                  placeholder="Ej. Semestre 2026-I"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={async (val) => {
                    setFormData(prev => ({ ...prev, type: val }))
                    try {
                      const { data } = await api.get(`/academic-periods/suggest-dates?type=${val}`)
                      if (data.start_date && data.end_date) {
                        setFormData(prev => ({
                          ...prev,
                          type: val,
                          start_date: data.start_date,
                          end_date: data.end_date
                        }))
                        toast({ title: `Fechas sugeridas para periodo ${val === 'NORMAL' ? 'Normal' : 'Intensivo'}` })
                      }
                    } catch (e) {
                      // ignore
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="INTENSIVO">Intensivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button type="button" variant="secondary" onClick={handleSuggestDates} className="gap-2">
                <Wand2 size={16} /> Autocompletar Fechas
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Inicio</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Fin</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="is_active_check"
                checked={formData.is_active}
                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active_check">Marcar como periodo activo actual (Desactivará los demás)</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="ghost" onClick={() => {
                  setIsCreating(false)
                  setEditingPeriod(null)
                  setFormData({ name: '', start_date: '', end_date: '', type: 'NORMAL', is_active: false })
              }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>{editingPeriod ? 'Guardar Cambios' : 'Guardar Periodo'}</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus size={16} /> Nuevo Periodo
          </Button>
        </div>
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="active" className="gap-2">
            <CheckCircle2 size={16} /> Periodo Actual
          </TabsTrigger>
          <TabsTrigger value="future" className="gap-2">
            <Clock size={16} /> Planificados
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History size={16} /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activePeriod ? (
            <Card className="border-green-500 shadow-md">
              <CardHeader className="bg-green-50/50 dark:bg-green-900/10">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-green-700 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle2 /> {activePeriod.name}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">{activePeriod.type}</Badge>
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(activePeriod)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => updateMutation.mutate({ id: activePeriod.id, is_active: false })}>
                      <Power size={14} />
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => {
                        if (confirm('¿Está seguro de que desea eliminar este periodo activo?')) {
                          deleteMutation.mutate(activePeriod.id)
                        }
                    }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <CardDescription>Semestre actualmente vigente en el sistema</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex gap-8 text-sm">
                  <div>
                    <span className="text-muted-foreground block mb-1">Inicio:</span>
                    <span className="font-semibold">{format(parseISO(activePeriod.start_date), 'dd/MM/yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Fin:</span>
                    <span className="font-semibold">{format(parseISO(activePeriod.end_date), 'dd/MM/yyyy')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 border rounded-xl bg-muted/20">
              <p className="text-muted-foreground">No hay ningún periodo activo actualmente.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="future" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Próximos Periodos</h3>
            <Badge variant={futurePeriods.length >= 3 ? "destructive" : "secondary"}>
              {futurePeriods.length} {futurePeriods.length > 3 ? "creados" : "de 3 permitidos"}
            </Badge>
          </div>
          
          {futurePeriods.length === 0 ? (
            <div className="text-center py-12 border rounded-xl bg-muted/20">
              <p className="text-muted-foreground">No hay periodos planificados para el futuro.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {paginatedFuturePeriods.map(period => (
                  <Card key={period.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{period.name}</CardTitle>
                        <Badge variant="outline">{period.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground mb-4 space-y-1">
                        <div className="flex items-center gap-2"><CalendarIcon size={14} /> Inicio: {format(parseISO(period.start_date), 'dd/MM/yyyy')}</div>
                        <div className="flex items-center gap-2"><CalendarIcon size={14} /> Fin: {format(parseISO(period.end_date), 'dd/MM/yyyy')}</div>
                      </div>
                       <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 font-bold" onClick={() => updateMutation.mutate({ id: period.id, is_active: true })}>
                          Activar
                        </Button>
                        <Button variant="outline" size="sm" className="font-bold border-slate-200 dark:border-slate-800" onClick={() => handleEditClick(period)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 font-bold" onClick={() => {
                          if (confirm('¿Está seguro de que desea eliminar este periodo académico?')) {
                            deleteMutation.mutate(period.id)
                          }
                        }}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totalFuturePages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-muted-foreground">
                    Mostrando página {futurePage} de {totalFuturePages} ({futurePeriods.length} total)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFuturePage(prev => Math.max(prev - 1, 1))}
                      disabled={futurePage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFuturePage(prev => Math.min(prev + 1, totalFuturePages))}
                      disabled={futurePage === totalFuturePages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {historyPeriods.length === 0 ? (
            <div className="text-center py-12 border rounded-xl bg-muted/20">
              <p className="text-muted-foreground">No hay historial de periodos.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {paginatedHistoryPeriods.map(period => (
                  <Card key={period.id} className="opacity-75">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{period.name}</CardTitle>
                        <Badge variant="outline">{period.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><CalendarIcon size={14} /> Inicio: {format(parseISO(period.start_date), 'dd/MM/yyyy')}</div>
                        <div className="flex items-center gap-2"><CalendarIcon size={14} /> Fin: {format(parseISO(period.end_date), 'dd/MM/yyyy')}</div>
                      </div>
                          <div className="mt-4 flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1 font-bold" onClick={() => updateMutation.mutate({ id: period.id, is_active: true })}>
                              Reactivar
                            </Button>
                            <Button variant="outline" size="sm" className="font-bold border-slate-200 dark:border-slate-800" onClick={() => handleEditClick(period)}>
                              <Pencil size={14} />
                            </Button>
                            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 font-bold" onClick={() => {
                              if (confirm('¿Está seguro de que desea eliminar este periodo académico?')) {
                                deleteMutation.mutate(period.id)
                              }
                            }}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totalHistoryPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-muted-foreground">
                    Mostrando página {historyPage} de {totalHistoryPages} ({historyPeriods.length} total)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage(prev => Math.max(prev - 1, 1))}
                      disabled={historyPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage(prev => Math.min(prev + 1, totalHistoryPages))}
                      disabled={historyPage === totalHistoryPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
