export type PlanStatus = 'DRAFT' | 'draft' | 'IN_REVIEW' | 'OBSERVED' | 'APPROVED' | 'PRUEBA';

export interface UserAuthor {
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
}

export interface WeeklyContent {
  week_number: number;
  content_description: string;
  teaching_strategy: string;
  resources: string;
  bibliography: string;
}

export interface EvaluationPlan {
  unit?: number;
  competence: string;
  strategy: string;
  instrument: string;
  evidence: string;
  feedback_method: string;
  weight?: number;
  due_week?: number;
}

export interface LessonPlan {
  id?: number;
  title: string;
  status: PlanStatus;
  subject_code?: string;
  section?: string;
  
  // These might come populated from backend
  author?: UserAuthor;
  author_name?: string;
  
  content?: {
    objectives?: string[];
    strategies?: string[];
    resources?: string[];
    evaluation?: string;
  };

  weekly_contents?: WeeklyContent[];
  evaluation_plans?: EvaluationPlan[];

  created_at?: string;
  updated_at?: string;
}
