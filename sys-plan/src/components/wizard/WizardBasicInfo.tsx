import { useWizard } from '@/context/WizardContext'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wand2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api-client'

export function WizardBasicInfo() {
  const { state, updateField } = useWizard()

  const { data: academicLoad } = useQuery({
    queryKey: ['academicLoad'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/academic-load')
      return data
    },
  })

  const subject = academicLoad?.subjects?.find((s: any) => s.code === state.subject_code)

  const handleAutoFillFromSyllabus = () => {
    if (!subject) return
    
    if (confirm('¿Deseas autocompletar la información del componente y las horas con los datos del sinóptico?')) {
      if (subject.component_type) updateField('component_type', subject.component_type)
      if (subject.hd_t !== undefined) updateField('hd_t', subject.hd_t)
      if (subject.hd_lt !== undefined) updateField('hd_lt', subject.hd_lt)
      if (subject.hd_iscp !== undefined) updateField('hd_iscp', subject.hd_iscp)
      if (subject.hiv_s !== undefined) updateField('hiv_s', subject.hiv_s)
      if (subject.hiv_a !== undefined) updateField('hiv_a', subject.hiv_a)
      if (subject.hde_hours !== undefined) updateField('hde', subject.hde_hours)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-xl">Informacion General</CardTitle>
        <Button 
          type="button"
          variant="outline" 
          size="sm"
          className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 gap-1 px-2"
          onClick={handleAutoFillFromSyllabus}
          title="Autocompletar con Sinóptico"
        >
          <Wand2 size={14} />
          <span className="text-xs font-bold hidden sm:inline">Sinóptico</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {state.subject_code && (
          <div className="grid grid-cols-2 gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
            <div>
              <Label className="text-xs text-muted-foreground uppercase font-extrabold">Materia / Curso</Label>
              <p className="font-black text-primary text-base mt-0.5">{state.subject_code}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase font-extrabold">Sección Activa</Label>
              <p className="font-black text-primary text-base mt-0.5">{state.section}</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="title">Titulo de la Planificacion</Label>
          <Input
            id="title"
            className="h-12 text-base font-semibold"
            placeholder="Ej. Introduccion a la Inteligencia Artificial"
            value={state.title}
            onChange={(e) => updateField('title', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="base_score">Puntaje Máximo por Unidad</Label>
          <div className="flex items-center gap-2">
            <Input
              id="base_score"
              type="number"
              min={1}
              className="h-12 text-base font-semibold w-32"
              value={state.base_score || ''}
              onChange={(e) => updateField('base_score', parseInt(e.target.value) || 0)}
            />
            <span className="text-muted-foreground font-medium">Puntos (Escala máxima en la que se evalúa cada unidad)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Este valor es la nota máxima posible a obtener en cada unidad de evaluación.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="modality">Modalidad</Label>
            <Select
              value={state.modality || ''}
              onValueChange={(val) => updateField('modality', val)}
            >
              <SelectTrigger className="h-12 text-base font-semibold">
                <SelectValue placeholder="Seleccione modalidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Presencial">Presencial</SelectItem>
                <SelectItem value="Distancia">A Distancia</SelectItem>
                <SelectItem value="Mixta">Mixta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="component_type">Componente</Label>
            <Input
              id="component_type"
              className="h-12 text-base font-semibold"
              placeholder="Ej. Formación Profesional"
              value={state.component_type || ''}
              onChange={(e) => updateField('component_type', e.target.value)}
            />
          </div>
        </div>

        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-4">
          <h3 className="font-extrabold text-sm text-primary uppercase">Horas Semanales</h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">HD (T)</Label>
              <Input
                type="number" min={0}
                value={state.hd_t ?? ''}
                onChange={(e) => updateField('hd_t', e.target.value === '' ? 0 : parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">HD (L/T)</Label>
              <Input
                type="number" min={0}
                value={state.hd_lt ?? ''}
                onChange={(e) => updateField('hd_lt', e.target.value === '' ? 0 : parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">HD (ISCP)</Label>
              <Input
                type="number" min={0}
                value={state.hd_iscp ?? ''}
                onChange={(e) => updateField('hd_iscp', e.target.value === '' ? 0 : parseInt(e.target.value))}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">HIV (S)</Label>
              <Input
                type="number" min={0}
                value={state.hiv_s ?? ''}
                onChange={(e) => updateField('hiv_s', e.target.value === '' ? 0 : parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">HIV (A)</Label>
              <Input
                type="number" min={0}
                value={state.hiv_a ?? ''}
                onChange={(e) => updateField('hiv_a', e.target.value === '' ? 0 : parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">HDE</Label>
              <Input
                type="number" min={0}
                value={state.hde ?? ''}
                onChange={(e) => updateField('hde', e.target.value === '' ? 0 : parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
