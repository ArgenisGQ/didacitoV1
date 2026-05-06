import { useWizard } from '@/context/WizardContext'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2 } from 'lucide-react'

export function WizardEvaluation() {
  const { state, addEvaluationItem, removeEvaluationItem, updateEvaluationItem } =
    useWizard()

  const totalWeight = state.evaluation_plans.reduce(
    (sum, e) => sum + (e.weight || 0),
    0
  )
  const remaining = 100 - totalWeight

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl">Plan de Evaluacion</CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={totalWeight === 100 ? 'default' : 'destructive'}>
              Total: {totalWeight}%
            </Badge>
            {totalWeight !== 100 && (
              <span className="text-xs text-muted-foreground">
                Restante: {remaining}%
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={addEvaluationItem}>
          <Plus size={18} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {state.evaluation_plans.map((ev, idx) => (
          <div
            key={idx}
            className="p-4 border rounded-xl space-y-4 relative"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">
                Evaluacion #{idx + 1}
              </span>
              {state.evaluation_plans.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => removeEvaluationItem(idx)}
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Unidad</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Nro"
                  value={ev.unit ?? ''}
                  onChange={(e) =>
                    updateEvaluationItem(
                      idx,
                      'unit',
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Peso (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="0"
                  value={ev.weight || ''}
                  onChange={(e) =>
                    updateEvaluationItem(
                      idx,
                      'weight',
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Semana de Entrega</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="1-12"
                  value={ev.due_week ?? ''}
                  onChange={(e) =>
                    updateEvaluationItem(
                      idx,
                      'due_week',
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Competencia</Label>
              <Input
                placeholder="Competencia a evaluar..."
                value={ev.competence}
                onChange={(e) =>
                  updateEvaluationItem(idx, 'competence', e.target.value)
                }
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Estrategia</Label>
                <Input
                  placeholder="Estrategia evaluativa..."
                  value={ev.strategy}
                  onChange={(e) =>
                    updateEvaluationItem(idx, 'strategy', e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Instrumento</Label>
                <Input
                  placeholder="Ej. Rubrica, Examen..."
                  value={ev.instrument}
                  onChange={(e) =>
                    updateEvaluationItem(idx, 'instrument', e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Evidencia</Label>
                <Input
                  placeholder="Producto o evidencia..."
                  value={ev.evidence}
                  onChange={(e) =>
                    updateEvaluationItem(idx, 'evidence', e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Retroalimentacion</Label>
                <Input
                  placeholder="Metodo de feedback..."
                  value={ev.feedback_method}
                  onChange={(e) =>
                    updateEvaluationItem(idx, 'feedback_method', e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ))}

        {state.evaluation_plans.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Agrega al menos un componente de evaluacion.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
