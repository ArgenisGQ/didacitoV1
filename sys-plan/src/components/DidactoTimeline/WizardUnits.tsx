import React, { useState } from 'react';
import { UnitData } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  units: UnitData[];
  setUnits: React.Dispatch<React.SetStateAction<UnitData[]>>;
}

export function WizardUnits({ units, setUnits }: Props) {
  const [newTitle, setNewTitle] = useState('');

  const handleAddUnit = () => {
    if (units.length >= 8) return;
    if (!newTitle.trim()) return;
    
    const newUnit: UnitData = {
      id: `unit-${Date.now()}`,
      title: newTitle.trim(),
    };
    setUnits([...units, newUnit]);
    setNewTitle('');
  };

  const handleRemoveUnit = (id: string) => {
    setUnits(units.filter(u => u.id !== id));
  };

  const handleUpdateTitle = (id: string, newTitle: string) => {
    setUnits(units.map(u => (u.id === id ? { ...u, title: newTitle } : u)));
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
          <Layers className="h-6 w-6 text-primary" />
          Unidades Temáticas
        </h2>
        <p className="text-muted-foreground">
          Define las unidades temáticas que componen tu planificación. Luego podrás agregar semanas a cada unidad. (Máximo 8 unidades).
        </p>
      </div>

      <div className="grid gap-4">
        {units.map((unit, index) => (
          <Card key={unit.id} className="border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-shrink-0 bg-primary/10 text-primary w-10 h-10 rounded-full flex items-center justify-center font-bold">
                {index + 1}
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor={`unit-${unit.id}`} className="sr-only">
                  Título de la Unidad
                </Label>
                <Input
                  id={`unit-${unit.id}`}
                  value={unit.title}
                  onChange={(e) => handleUpdateTitle(unit.id, e.target.value)}
                  className="font-medium bg-transparent border-transparent hover:border-border focus:border-primary transition-colors text-base"
                  placeholder="Ej. Unidad I: Visión General"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => handleRemoveUnit(unit.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}

        {units.length < 8 && (
          <Card className="border-dashed border-border/60 bg-muted/30">
            <CardContent className="p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddUnit();
                }}
                className="flex items-center gap-4"
              >
                <div className="flex-shrink-0 bg-muted text-muted-foreground w-10 h-10 rounded-full flex items-center justify-center font-bold">
                  {units.length + 1}
                </div>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Título de la nueva unidad..."
                  className="flex-1"
                />
                <Button type="submit" disabled={!newTitle.trim()} className="gap-2">
                  <Plus className="h-4 w-4" /> Añadir
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
      <div className="text-sm text-muted-foreground text-center pt-4 border-t border-border/50">
        Tienes {units.length} de 8 unidades configuradas.
      </div>
    </div>
  );
}
