export type PlanStatus = 'DRAFT' | 'draft' | 'IN_REVIEW' | 'OBSERVED' | 'APPROVED' | 'PRUEBA';

export interface UserAuthor {
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
}

export interface WeeklyContent {
  week_number: number;
  unit_content?: string;
  content_description: string;
  specific_competence?: string;
  performance_criteria?: string;
  teaching_strategy: string;
  evaluation_feedback?: string;
  resources: string;
  bibliography: string;
}

export interface EvaluationPlan {
  unit?: number;
  competence: string;
  performance_criterion?: string;
  strategy: string;
  instrument: string;
  evaluation_type?: string;
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
  academic_period_id?: number;
  academic_period?: string;
  modality?: string;
  
  subject_purpose?: string;
  pre_requisite?: string;
  total_hours?: number;
  
  // Override hours
  hd_t?: number;
  hd_lt?: number;
  hd_iscp?: number;
  hiv_s?: number;
  hiv_a?: number;
  hde?: number;
  component_type?: string;
  
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
