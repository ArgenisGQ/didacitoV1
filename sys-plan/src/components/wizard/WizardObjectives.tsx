import { useWizard } from '@/context/WizardContext'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Wand2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api-client'

export function WizardObjectives() {
  const { state, updateField } = useWizard()

  const { data: academicLoad } = useQuery({
    queryKey: ['academicLoad'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/academic-load');
      return data;
    },
  });

  const subject = academicLoad?.subjects?.find((s: any) => s.code === state.subject_code);

  const { data: syllabusDetail } = useQuery({
    queryKey: ['syllabus', subject?.id],
    queryFn: async () => {
      if (!subject?.id) return null;
      const { data } = await api.get(`/syllabus/subjects/${subject.id}`);
      return data;
    },
    enabled: !!subject?.id,
  });

  const handleAutoFillObjectives = () => {
    if (!syllabusDetail) return;
    
    const hasData = state.objectives.length > 1 || (state.objectives.length === 1 && state.objectives[0].trim() !== '');
    if (hasData) {
      if (!confirm('Ya tienes objetivos escritos. ¿Estás seguro de que deseas sobrescribirlos con la información del sinóptico?')) {
        return;
      }
    }

    const rawText = [syllabusDetail.purpose, syllabusDetail.generic_competencies].filter(Boolean).join('. ');
    if (!rawText) return;

    const items = rawText.split('.')
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    if (items.length > 0) {
      updateField('objectives', items);
    }
  };

  const handleAutoFillStrategies = () => {
    if (!syllabusDetail) return;
    
    const hasData = state.strategies.length > 1 || (state.strategies.length === 1 && state.strategies[0].trim() !== '');
    if (hasData) {
      if (!confirm('Ya tienes estrategias escritas. ¿Estás seguro de que deseas sobrescribirlas con la información del sinóptico?')) {
        return;
      }
    }

    if (!syllabusDetail.teaching_strategies) return;

    const items = syllabusDetail.teaching_strategies.split('.')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
      
    if (items.length > 0) {
      updateField('strategies', items);
    }
  };

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
          <div className="flex gap-2">
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 gap-1 px-2"
              onClick={handleAutoFillObjectives}
              title="Autocompletar con Sinóptico"
            >
              <Wand2 size={14} />
              <span className="text-xs font-bold hidden sm:inline">Sinóptico</span>
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={addObjective}>
              <Plus size={18} />
            </Button>
          </div>
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
                  type="button"
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
          <div className="flex gap-2">
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 gap-1 px-2"
              onClick={handleAutoFillStrategies}
              title="Autocompletar con Sinóptico"
            >
              <Wand2 size={14} />
              <span className="text-xs font-bold hidden sm:inline">Sinóptico</span>
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={addStrategy}>
              <Plus size={18} />
            </Button>
          </div>
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
                  type="button"
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
