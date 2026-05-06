import { useState } from 'react'
import { useWizard } from '@/context/WizardContext'
import type { WeeklyItem } from '@/context/WizardContext'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function WizardWeeklyContent() {
  const { state, updateWeekItem } = useWizard()
  const [activeWeek, setActiveWeek] = useState(0)

  const week = state.weekly_contents[activeWeek] as WeeklyItem

  const setField = (field: keyof WeeklyItem, value: string) => {
    updateWeekItem(activeWeek, field, value)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Contenido Semanal (12 semanas)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Week selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {state.weekly_contents.map((_, i) => (
            <Button
              key={i}
              variant={activeWeek === i ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveWeek(i)}
              className="min-w-[3rem]"
            >
              S{i + 1}
            </Button>
          ))}
        </div>

        <div className="text-sm text-muted-foreground font-medium">
          Semana {activeWeek + 1} de 12
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Contenido / Temas</Label>
            <Textarea
              rows={3}
              placeholder="Describe los temas y contenidos de esta semana..."
              value={week.content_description}
              onChange={(e) => setField('content_description', e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estrategia Didactica</Label>
              <Input
                placeholder="Ej. Aprendizaje basado en problemas"
                value={week.teaching_strategy}
                onChange={(e) => setField('teaching_strategy', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Recursos</Label>
              <Input
                placeholder="Ej. Laboratorio, Proyector, Software"
                value={week.resources}
                onChange={(e) => setField('resources', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bibliografia</Label>
            <Textarea
              rows={2}
              placeholder="Referencias bibliograficas para esta semana..."
              value={week.bibliography}
              onChange={(e) => setField('bibliography', e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={activeWeek === 0}
            onClick={() => setActiveWeek(activeWeek - 1)}
          >
            <ChevronLeft size={16} /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            {12 - activeWeek - 1} semanas restantes
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={activeWeek === 11}
            onClick={() => setActiveWeek(activeWeek + 1)}
          >
            Siguiente <ChevronRight size={16} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
