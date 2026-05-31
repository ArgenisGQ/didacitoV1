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

      </CardContent>
    </Card>
  )
}
