import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Save, Loader2 } from 'lucide-react';
import apiClient from '../lib/api-client';

interface Widget {
  widget_id: number;
  code: string;
  name: string;
  description: string;
  component_name: string;
  is_active: boolean;
  order: number;
}

interface RoleWidgets {
  role_id: number;
  role_name: string;
  widgets: Widget[];
}

function SortableItem({ id, widget, onToggle }: { id: string; widget: Widget; onToggle: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-4 p-3 rounded-xl border mb-2 transition-colors ${widget.is_active ? 'border-primary bg-card/80 backdrop-blur-sm' : 'border-border bg-muted/50 opacity-60'}`}>
      <div {...attributes} {...listeners} className="cursor-grab hover:text-primary text-muted-foreground">
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-card-foreground">{widget.name}</h4>
        <p className="text-xs text-muted-foreground">{widget.description}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={() => onToggle(widget.widget_id)}>
        {widget.is_active ? <Eye className="h-5 w-5 text-primary" /> : <EyeOff className="h-5 w-5 text-muted-foreground" />}
      </Button>
    </div>
  );
}

export function DashboardSettings() {
  const [rolesData, setRolesData] = useState<RoleWidgets[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/dashboard/settings/roles-widgets');
      const data = response.data || [];
      setRolesData(data);
      if (data.length > 0 && !selectedRoleId) {
        setSelectedRoleId(data[0].role_id.toString());
      }
    } catch (error) {
      console.error("Error al cargar configuración de roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setRolesData((items) => {
        const newRoles = [...items];
        const roleIndex = newRoles.findIndex(r => r.role_id.toString() === selectedRoleId);
        if (roleIndex === -1) return items;

        const widgets = [...newRoles[roleIndex].widgets];
        const oldIndex = widgets.findIndex(w => w.widget_id.toString() === active.id);
        const newIndex = widgets.findIndex(w => w.widget_id.toString() === over?.id);
        
        newRoles[roleIndex].widgets = arrayMove(widgets, oldIndex, newIndex);
        return newRoles;
      });
    }
  };

  const toggleWidget = (widgetId: number) => {
    setRolesData(items => {
      const newRoles = [...items];
      const roleIndex = newRoles.findIndex(r => r.role_id.toString() === selectedRoleId);
      if (roleIndex === -1) return items;
      
      const widget = newRoles[roleIndex].widgets.find(w => w.widget_id === widgetId);
      if (widget) {
        widget.is_active = !widget.is_active;
      }
      return newRoles;
    });
  };

  const handleSave = async () => {
    const roleData = rolesData.find(r => r.role_id.toString() === selectedRoleId);
    if (!roleData) return;
    
    setSaving(true);
    try {
      const assignments = roleData.widgets.map((w, i) => ({
        widget_id: w.widget_id,
        is_active: w.is_active,
        order: i
      }));
      
      await apiClient.post('/dashboard/settings/roles-widgets', {
        role_id: roleData.role_id,
        assignments
      });
      // Optionally show success toast
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Cargando...</div>;

  const currentRoleData = rolesData.find(r => r.role_id.toString() === selectedRoleId);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Widgets del Dashboard</h2>
          <p className="text-muted-foreground">Configura qué módulos visuales están disponibles para cada rol.</p>
        </div>
        <div className="w-full sm:w-64">
          <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar Rol" />
            </SelectTrigger>
            <SelectContent>
              {rolesData.map(r => (
                <SelectItem key={r.role_id} value={r.role_id.toString()}>{r.role_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="shadow-lg border-border bg-card">
        <CardHeader>
          <CardTitle>Orden de Widgets</CardTitle>
          <CardDescription>Arrastra para reordenar. Haz clic en el ojo para ocultar un widget para este rol.</CardDescription>
        </CardHeader>
        <CardContent>
          {(!currentRoleData || rolesData.length === 0) ? (
             <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center border border-dashed border-border rounded-xl">
               <p className="mb-2">No hay roles disponibles o no tienes permiso para administrarlos.</p>
             </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={currentRoleData.widgets.map(w => w.widget_id.toString())} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {currentRoleData.widgets.map(widget => (
                    <SortableItem 
                      key={widget.widget_id} 
                      id={widget.widget_id.toString()} 
                      widget={widget} 
                      onToggle={toggleWidget} 
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          
          {currentRoleData && (
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar Configuración
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
