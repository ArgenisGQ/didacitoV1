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

export function WizardBasicInfo() {
  const { state, updateField } = useWizard()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Informacion General</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Titulo de la Planificacion</Label>
          <Input
            id="title"
            className="h-12 text-base"
            placeholder="Ej. Introduccion a la Inteligencia Artificial"
            value={state.title}
            onChange={(e) => updateField('title', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <Select
            value={state.status}
            onValueChange={(v) => updateField('status', v)}
          >
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Borrador</SelectItem>
              <SelectItem value="IN_REVIEW">Enviar a Revision</SelectItem>
            </SelectContent>
          </Select>
          {state.status === 'IN_REVIEW' && (
            <p className="text-xs text-amber-500 font-medium">
              Requiere 12 semanas de contenido y pesos de evaluacion que sumen 100%.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
