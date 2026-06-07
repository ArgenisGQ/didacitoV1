import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { EvaluationItem } from './EvaluationItem';
import { Evaluation } from './types';
import { CheckCircle2, AlertCircle, Plus, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  evaluations: Evaluation[];
  assignedEvaluations: Evaluation[];
  onAddEvaluation: (e: Omit<Evaluation, 'id'>) => void;
}

export function AvailableEvaluationsPanel({ evaluations, assignedEvaluations, onAddEvaluation }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'available-evals',
  });

  const [isOpen, setIsOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');

  const totalAssignedWeight = assignedEvaluations.reduce((sum, e) => sum + e.weight, 0);
  const totalAvailableWeight = evaluations.reduce((sum, e) => sum + e.weight, 0);
  const totalWeight = totalAssignedWeight + totalAvailableWeight;
  const isComplete = totalAssignedWeight === 100 && totalWeight === 100;
  const isOverweight = totalWeight > 100;

  const handleCreate = () => {
    if (!newTitle.trim() || !newWeight) return;
    onAddEvaluation({
      title: newTitle,
      weight: Number(newWeight),
      color: newColor
    });
    setNewTitle('');
    setNewWeight('');
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-card transition-colors duration-200">
      <div className="p-6 border-b border-border bg-accent/10 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <PieChart size={16} />
          Estado del Plan
        </h3>
        <div className="flex flex-col items-center justify-center py-2 text-center">
          {isComplete ? (
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 mb-3 ring-4 ring-green-500/10">
              <CheckCircle2 size={32} />
            </div>
          ) : (
            <div className="relative w-16 h-16 rounded-full flex items-center justify-center mb-3">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-muted stroke-current"
                  strokeWidth="4"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={`${isOverweight ? 'text-red-500' : 'text-primary'} stroke-current transition-all duration-500`}
                  strokeWidth="4"
                  strokeDasharray={`${Math.min(totalAssignedWeight, 100)}, 100`}
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-black ${isOverweight ? 'text-red-500' : 'text-foreground'}`}>
                  {totalAssignedWeight}%
                </span>
              </div>
            </div>
          )}
          
          <div className="text-lg font-black text-foreground">
            {isComplete ? 'Plan Completado' : 'Plan Incompleto'}
          </div>
          <div className="text-xs text-muted-foreground font-medium mt-1">
            {totalAssignedWeight}% asignado de 100%
            {isOverweight && <span className="text-red-500 block">Excede el 100%</span>}
          </div>
        </div>
      </div>
      
      <div 
        ref={setNodeRef}
        className={`flex-1 flex flex-col p-4 overflow-hidden ${isOver ? 'bg-muted/80' : ''}`}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
            Pendientes
          </h3>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1 px-2 border-dashed">
                <Plus size={14} /> Crear
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Nueva Evaluación</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título de Evaluación</Label>
                  <Input id="title" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ej. Examen Parcial" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Peso (%)</Label>
                    <Input id="weight" type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="Ej. 25" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">Color Visual</Label>
                    <div className="flex gap-2 h-10 items-center">
                      <Input id="color" type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-12 p-1 h-10" />
                      <span className="text-sm text-muted-foreground">{newColor}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate}>Añadir a Disponibles</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 pb-10">
          {evaluations.map((e) => (
            <EvaluationItem key={e.id} evaluation={e} />
          ))}
          {evaluations.length === 0 && (
            <div className="text-center text-sm font-medium text-muted-foreground py-10 px-4 border-2 border-dashed border-border rounded-xl">
              No hay evaluaciones pendientes. Crea una nueva.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
