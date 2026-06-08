export interface Evaluation {
  id: string;
  title: string;
  weight: number; // percentage, e.g., 20 for 20%
  description?: string;
  color?: string; // color hex or tailwind class for the progress bar segment
}

export interface Competence {
  id: string;
  description: string;
}

export interface WeekData {
  id: string;
  unitId?: string; // Links this week to a specific Unit
  unitTitle?: string; // Full title of the unit
  weekNumber: number; // For grouping, this could be the starting week
  weekLabel?: string; // Optional custom label, e.g., "Semanas 6, 7 y 8"
  colspan?: number; // How many weeks this block spans visually
  
  // Fields aligned to PDF structure
  title: string;
  contenido: string;
  criteriosDesempeno: string;
  estrategiasDidacticas: string;
  recursosAprendizaje: string;
  bibliografia: string;

  evaluations: Evaluation[];
  competences: Competence[]; // Drag & Drop competences
}

export interface UnitData {
  id: string;
  title: string; // e.g., "Unidad 1 Visión general sobre las TIC"
}

export type TimelineConfig = {
  dataSource: 'mock' | 'api';
  numberOfWeeks: number;
  availableEvaluations: Evaluation[];
};
