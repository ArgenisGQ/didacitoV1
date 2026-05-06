import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Save, Target, Lightbulb, Package } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const planSchema = z.object({
  title: z.string().min(3, 'El titulo debe tener al menos 3 caracteres'),
  objectives: z.array(z.string()).min(1, 'Al menos un objetivo'),
  strategies: z.array(z.string()).min(1, 'Al menos una estrategia'),
  resources: z.array(z.string()),
  evaluation: z.string().optional(),
  status: z.enum(['draft', 'published', 'IN_REVIEW']),
})

type PlanFormData = z.infer<typeof planSchema>

interface LessonPlanModalProps {
  onClose: () => void
  onSave: (plan: any) => void
  initialData?: any
}

export default function LessonPlanModal({
  onClose,
  onSave,
  initialData,
}: LessonPlanModalProps) {
  const isEditing = !!initialData

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      title: initialData?.title || '',
      objectives: initialData?.content?.objectives?.length
        ? initialData.content.objectives
        : [''],
      strategies: initialData?.content?.strategies?.length
        ? initialData.content.strategies
        : [''],
      resources: initialData?.content?.resources?.length
        ? initialData.content.resources
        : [''],
      evaluation: initialData?.content?.evaluation || '',
      status: initialData?.status || 'draft',
    },
  })

  const { fields: objectives, append: addObjective, remove: removeObjective } = {
    fields: form.watch('objectives'),
    append: (val: string) =>
      form.setValue('objectives', [...form.watch('objectives'), val]),
    remove: (idx: number) =>
      form.setValue(
        'objectives',
        form.watch('objectives').filter((_: string, i: number) => i !== idx)
      ),
  }

  const stratFields = form.watch('strategies')
  const resFields = form.watch('resources')

  const onSubmit = (data: PlanFormData) => {
    onSave({
      ...initialData,
      title: data.title,
      status: data.status,
      content: {
        objectives: data.objectives,
        strategies: data.strategies,
        resources: data.resources,
        evaluation: data.evaluation,
      },
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {isEditing ? 'Editar Planificacion' : 'Nueva Planificacion'}
          </DialogTitle>
          <DialogDescription>
            Disena los componentes didacticos de tu clase.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titulo de la Clase</Label>
            <Input
              id="title"
              placeholder="Ej. Introduccion a la Inteligencia Artificial"
              className="h-12 text-base"
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Objectives */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <Target size={20} />
                  <span>Objetivos</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => addObjective('')}
                >
                  <Plus size={20} />
                </Button>
              </div>
              <div className="space-y-3">
                {objectives.map((obj: string, i: number) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={obj}
                      onChange={(e) => {
                        const copy = [...objectives]
                        copy[i] = e.target.value
                        form.setValue('objectives', copy)
                      }}
                      placeholder={`Objetivo #${i + 1}`}
                    />
                    {objectives.length > 1 && (
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
              </div>
            </div>

            {/* Strategies */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <Lightbulb size={20} />
                  <span>Estrategias</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    form.setValue('strategies', [...stratFields, ''])
                  }
                >
                  <Plus size={20} />
                </Button>
              </div>
              <div className="space-y-3">
                {stratFields.map((s: string, i: number) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={s}
                      onChange={(e) => {
                        const copy = [...stratFields]
                        copy[i] = e.target.value
                        form.setValue('strategies', copy)
                      }}
                      placeholder={`Estrategia #${i + 1}`}
                    />
                    {stratFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive shrink-0"
                        onClick={() =>
                          form.setValue(
                            'strategies',
                            stratFields.filter(
                              (_: string, j: number) => j !== i
                            )
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Package size={20} />
                <span>Recursos y Materiales</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => form.setValue('resources', [...resFields, ''])}
              >
                <Plus size={20} />
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {resFields.map((r: string, i: number) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={r}
                    onChange={(e) => {
                      const copy = [...resFields]
                      copy[i] = e.target.value
                      form.setValue('resources', copy)
                    }}
                    placeholder={`Recurso #${i + 1}`}
                  />
                  {resFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive shrink-0"
                      onClick={() =>
                        form.setValue(
                          'resources',
                          resFields.filter((_: string, j: number) => j !== i)
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Evaluation */}
          <div className="space-y-2">
            <Label htmlFor="evaluation">Metodo de Evaluacion</Label>
            <Textarea
              id="evaluation"
              placeholder="Describe el metodo de evaluacion..."
              rows={3}
              {...form.register('evaluation')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Descartar
            </Button>
            <Button type="submit" size="lg" className="gap-2 font-extrabold">
              <Save size={20} strokeWidth={2.5} />
              Guardar Planificacion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
