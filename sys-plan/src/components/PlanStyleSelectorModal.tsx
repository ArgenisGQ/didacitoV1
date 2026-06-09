import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LayoutList, Map } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (style: 'wizard' | 'timeline') => void;
}

export function PlanStyleSelectorModal({ isOpen, onClose, onSelect }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-center mb-2">
            Elige el Estilo de Planificación
          </DialogTitle>
          <DialogDescription className="text-center">
            Selecciona la herramienta que mejor se adapte a tu forma de trabajar para diseñar esta asignatura.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          <button
            onClick={() => onSelect('wizard')}
            className="flex flex-col items-center text-center p-6 border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:text-primary transition-colors text-muted-foreground">
              <LayoutList size={32} />
            </div>
            <h3 className="font-bold text-lg mb-2 text-foreground">Asistente Clásico</h3>
            <p className="text-sm text-muted-foreground">
              Proceso guiado paso a paso. Ideal para un enfoque lineal y detallado.
            </p>
          </button>

          <button
            onClick={() => onSelect('timeline')}
            className="flex flex-col items-center text-center p-6 border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:text-primary transition-colors text-muted-foreground">
              <Map size={32} />
            </div>
            <h3 className="font-bold text-lg mb-2 text-foreground">Asistente Dinamico</h3>
            <p className="text-sm text-muted-foreground">
              Visión panorámica e interactiva. Ideal para distribuir cargas de trabajo.
            </p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
