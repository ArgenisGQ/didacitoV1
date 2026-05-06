import { useWizard } from '@/context/WizardContext'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'

export function WizardObjectives() {
  const { state, updateField } = useWizard()

  const addObjective = () => updateField('objectives', [...state.objectives, ''])
  const removeObjective = (i: number) =>
    updateField('objectives', state.objectives.filter((_, idx) => idx !== i))
  const setObjective = (i: number, v: string) => {
    const copy = [...state.objectives]
    copy[i] = v
    updateField('objectives', copy)
  }

  const addStrategy = () => updateField('strategies', [...state.strategies, ''])
  const removeStrategy = (i: number) =>
    updateField('strategies', state.strategies.filter((_, idx) => idx !== i))
  const setStrategy = (i: number, v: string) => {
    const copy = [...state.strategies]
    copy[i] = v
    updateField('strategies', copy)
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-xl">Objetivos</CardTitle>
          <Button variant="outline" size="icon" onClick={addObjective}>
            <Plus size={18} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.objectives.map((obj, i) => (
            <div key={i} className="flex gap-2">
              <Label className="pt-2.5 text-muted-foreground shrink-0 w-6 text-right">
                {i + 1}
              </Label>
              <Input
                value={obj}
                onChange={(e) => setObjective(i, e.target.value)}
                placeholder={`Objetivo ${i + 1}`}
              />
              {state.objectives.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive shrink-0"
                  onClick={() => removeObjective(i)}
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-xl">Estrategias</CardTitle>
          <Button variant="outline" size="icon" onClick={addStrategy}>
            <Plus size={18} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.strategies.map((st, i) => (
            <div key={i} className="flex gap-2">
              <Label className="pt-2.5 text-muted-foreground shrink-0 w-6 text-right">
                {i + 1}
              </Label>
              <Input
                value={st}
                onChange={(e) => setStrategy(i, e.target.value)}
                placeholder={`Estrategia ${i + 1}`}
              />
              {state.strategies.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive shrink-0"
                  onClick={() => removeStrategy(i)}
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
