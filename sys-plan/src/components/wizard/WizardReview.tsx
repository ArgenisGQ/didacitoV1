import { useWizard } from '@/context/WizardContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function WizardReview() {
  const { state, updateField } = useWizard()

  const totalWeight = state.evaluation_plans.reduce(
    (s, e) => s + (e.weight || 0),
    0
  )
  const weeksFilled = state.weekly_contents.filter(
    (w) => w.content_description.trim().length > 0
  ).length

  const issues: string[] = []
  if (!state.title.trim()) issues.push('Falta el titulo de la planificacion')
  if (state.objectives.every((o) => !o.trim()))
    issues.push('Define al menos un objetivo')
  if (state.strategies.every((s) => !s.trim()))
    issues.push('Define al menos una estrategia')
  if (state.evaluation_plans.length === 0)
    issues.push('Agrega al menos un plan de evaluacion')
  if (totalWeight !== 100 && state.status === 'IN_REVIEW')
    issues.push('Los pesos de evaluacion deben sumar 100% para enviar a revision')
  if (weeksFilled < 12 && state.status === 'IN_REVIEW')
    issues.push('Las 12 semanas deben tener contenido para enviar a revision')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Resumen de la Planificacion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Title */}
        <div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
            Titulo
          </span>
          <p className="text-lg font-bold">{state.title || '(Sin titulo)'}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-muted rounded-xl text-center">
            <p className="text-2xl font-black">{state.objectives.filter((o) => o.trim()).length}</p>
            <p className="text-xs text-muted-foreground font-medium">Objetivos</p>
          </div>
          <div className="p-3 bg-muted rounded-xl text-center">
            <p className="text-2xl font-black">{state.strategies.filter((s) => s.trim()).length}</p>
            <p className="text-xs text-muted-foreground font-medium">Estrategias</p>
          </div>
          <div className="p-3 bg-muted rounded-xl text-center">
            <p className="text-2xl font-black">{weeksFilled}/12</p>
            <p className="text-xs text-muted-foreground font-medium">Semanas</p>
          </div>
          <div className="p-3 bg-muted rounded-xl text-center">
            <p className="text-2xl font-black">{totalWeight}%</p>
            <p className="text-xs text-muted-foreground font-medium">Peso Eval.</p>
          </div>
        </div>

        {/* Evaluation items summary */}
        <div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
            Planes de Evaluacion ({state.evaluation_plans.length})
          </span>
          <div className="space-y-2 mt-2">
            {state.evaluation_plans.map((ev, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
              >
                <span className="font-medium truncate max-w-[60%]">
                  {ev.competence || `Evaluacion #${i + 1}`}
                </span>
                <Badge variant="outline">{ev.weight}%</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Issues */}
        {issues.length > 0 && (
          <div className="border border-amber-500/30 bg-amber-500/5 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <AlertTriangle size={16} />
              Pendiente
            </div>
            <ul className="space-y-1">
              {issues.map((issue, i) => (
                <li
                  key={i}
                  className="text-sm text-muted-foreground flex items-start gap-2"
                >
                  <span className="text-amber-500 mt-1">•</span>
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {issues.length === 0 && (
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm mb-4">
            <CheckCircle2 size={16} />
            Todo listo para guardar
          </div>
        )}

        {/* Status Selector */}
        <div className="space-y-2 mt-6 pt-4 border-t">
          <Label htmlFor="status" className="font-bold">Estado Final de la Planificación</Label>
          <Select
            value={state.status}
            onValueChange={(v) => updateField('status', v)}
          >
            <SelectTrigger className="h-12 border-primary/20 bg-primary/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Borrador</SelectItem>
              <SelectItem value="IN_REVIEW">Enviar a Revision</SelectItem>
            </SelectContent>
          </Select>
          {state.status === 'IN_REVIEW' && issues.length > 0 && (
            <p className="text-xs text-amber-500 font-medium">
              Aún no puedes enviar a revisión porque hay tareas pendientes.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
