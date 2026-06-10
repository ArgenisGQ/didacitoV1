import React from 'react';
import { LessonPlan } from '../../types/lessonPlan';
import WatermarkOverlay from './WatermarkOverlay';
import { BookOpen } from 'lucide-react';

interface LessonPlanViewProps {
  plan: LessonPlan;
}

export default function LessonPlanView({ plan }: LessonPlanViewProps) {
  // Use tailwind arbitrary values to exactly match backend PDF colors
  const borderColor = 'border-[#4a86e8]'
  const bgColor = 'bg-[#dde6f0]'
  const thClass = `border ${borderColor} ${bgColor} px-1.5 py-0.5 text-center font-bold text-[9px]`
  const tdClass = `border ${borderColor} px-1.5 py-0.5 text-center text-[9px]`
  const tdLeftClass = `border ${borderColor} px-2 py-1 text-left align-middle text-[10px] sm:text-xs whitespace-pre-line`;

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const clean = dateStr.trim();
    if (clean.length === 10 && clean[2] === '/' && clean[5] === '/') {
      return clean;
    }
    if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return clean;
  };

  const formatWeight = (w?: number) => {
    if (w === undefined || w === null) return '0';
    return Number.isInteger(w) ? w.toString() : w.toFixed(1);
  };

  const formatPeriods = (text?: string, doubleNewline: boolean = true) => {
    if (!text) return '';
    const rep = doubleNewline ? '.\n\n' : '.\n';
    return text.toString().trim().replace(/\.(?!\d)(?!\s*$)\s*/g, rep);
  };

  // Provide fallbacks for UI
  const subjectName = plan.title || "---"; // using title as subject name for preview
  const authorName = plan.author_name || "---";
  const authorEmail = plan.author?.email || "---";

  return (
    <div className="relative min-h-screen bg-white text-black p-4 sm:p-8 max-w-[1056px] w-full mx-auto print:p-0 print:m-0 font-sans">
      <WatermarkOverlay status={plan.status} />

      <table className="w-full border-collapse mb-2">
        <tbody>
          <tr>
            <td rowSpan={2} className={`${borderColor} border p-1 w-[15%] text-center`}>
              <img src="/logo-sdu.png" alt="Logo SDU" className="max-h-12 mx-auto" />
            </td>
            <td rowSpan={2} className={`${borderColor} border p-1 w-[30%] text-center font-bold text-[10px]`}>
              SISTEMA DIDÁCTICO<br />UNIVERSITARIO
            </td>
            <td rowSpan={2} className={`${borderColor} border p-1 w-[40%] text-center font-bold text-[13px]`}>
              PLANIFICACIÓN DIDÁCTICA
            </td>
            <td className={`${thClass} w-[15%]`}>
              CÓDIGO
            </td>
          </tr>
          <tr>
            <td className={`${tdClass}`}>
              F01-SDU-2026
            </td>
          </tr>
        </tbody>
      </table>

      {/* I. Identificación de la Unidad Curricular */}
      <div className="text-left font-bold text-[10px] mt-2 mb-0.5">I. Identificación de la Unidad Curricular.</div>
      
      {/* Table 1 */}
      <table className="w-full border-collapse mb-1">
        <tbody>
          <tr>
            <th className={`${thClass} text-left w-[25%]`}>Nombre de la Unidad Curricular</th>
            <td className={`${tdClass} text-left w-[40%]`}>{subjectName}</td>
            <th className={`${thClass} w-[15%]`}>Código</th>
            <td className={`${tdClass} w-[20%]`}>{plan.subject_code || ''}</td>
          </tr>
          <tr>
            <th className={`${thClass} text-left`}>Propósito de la Unidad Curricular</th>
            <td colSpan={3} className={`${tdClass} text-left`}>{plan.subject_purpose || ''}</td>
          </tr>
          <tr>
            <th className={`${thClass} text-left`}>Facultad/Decanato</th>
            <td className={`${tdClass} text-left`}>Postgrado</td>
            <th className={thClass}>Carrera – Programa / Programa</th>
            <td className={tdClass}>{plan.program || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* Table 2 */}
      <table className="w-full border-collapse mb-2">
        <thead>
          <tr>
            <th rowSpan={2} className={thClass}>Sección</th>
            <th rowSpan={2} className={thClass}>Prelación</th>
            <th rowSpan={2} className={thClass}>Total Horas</th>
            <th colSpan={3} className={thClass}>HD</th>
            <th colSpan={2} className={thClass}>HIV</th>
            <th rowSpan={2} className={thClass}>HDE</th>
          </tr>
          <tr>
            <th className={thClass}>T</th>
            <th className={thClass}>L/T</th>
            <th className={thClass}>I/SC/P</th>
            <th className={thClass}>S</th>
            <th className={thClass}>A</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdClass}>{plan.section || ''}</td>
            <td className={tdClass}>{plan.pre_requisite || ''}</td>
            <td className={tdClass}>{plan.total_hours || ''}</td>
            <td className={tdClass}>{plan.hd_t || 0}</td>
            <td className={tdClass}>{plan.hd_lt || 0}</td>
            <td className={tdClass}>{plan.hd_iscp || 0}</td>
            <td className={tdClass}>{plan.hiv_s || 0}</td>
            <td className={tdClass}>{plan.hiv_a || 0}</td>
            <td className={tdClass}>{plan.hde || 0}</td>
          </tr>
        </tbody>
      </table>

      {/* Table 3 */}
      <table className="w-full border-collapse mb-2">
        <thead>
          <tr>
            <th colSpan={4} className={thClass}>Componente Pregrado</th>
            <th colSpan={3} className={thClass}>Componente Postgrado</th>
            <th rowSpan={2} className={thClass}>Período<br/>Académico</th>
            <th colSpan={3} className={thClass}>Modalidad</th>
          </tr>
          <tr>
            <th className={thClass}>General</th>
            <th className={thClass}>Básica</th>
            <th className={thClass}>Profesional</th>
            <th className={thClass}>Investigación<br/>/Pasantía</th>
            <th className={thClass}>Obligatorio</th>
            <th className={thClass}>Electiva</th>
            <th className={thClass}>Investigación</th>
            <th className={thClass}>Presencial</th>
            <th className={thClass}>Mixta</th>
            <th className={thClass}>Virtual</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdClass}>{plan.component_type === 'General' ? 'X' : ''}</td>
            <td className={tdClass}>{plan.component_type === 'Básica' ? 'X' : ''}</td>
            <td className={tdClass}>{plan.component_type === 'Profesional' ? 'X' : ''}</td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}>{plan.academic_period || ''}</td>
            <td className={tdClass}>{plan.modality === 'Presencial' ? 'X' : ''}</td>
            <td className={tdClass}>{plan.modality === 'Mixta' ? 'X' : ''}</td>
            <td className={tdClass}>{plan.modality === 'Distancia' || plan.modality === 'Virtual' ? 'X' : ''}</td>
          </tr>
        </tbody>
      </table>

      <div className="text-[9px] mt-1 mb-1 text-left">
        <strong>Leyenda:</strong> (HD) Horas Docentes, (T) Teóricas, (L/T) Laboratorio/Taller, (I/SC/P) Intervención / Servicio Comunitario / Proyecto, (HIV) Horas de Interacción Virtual, (S) Síncronas, (A) Asíncronas, (HDE) Horas de Dedicación Estudiante.
      </div>

      {/* Teacher Info */}
      <div className="text-left font-bold text-[10px] mt-2 mb-0.5">II. Identificación del Docente</div>
      <table className="w-full border-collapse mb-1">
        <thead>
          <tr>
            <th className={thClass}>Nombre Docente/Tutor:</th>
            <th className={thClass}>N° Cédula</th>
            <th className={thClass}>Teléfono</th>
            <th className={thClass}>Correo:</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdClass}>{authorName}</td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}>{authorEmail}</td>
          </tr>
        </tbody>
      </table>



      {/* Legend */}
      <div className="text-center font-bold mt-2 mb-1 text-[11px]">Leyenda</div>
      <table className="w-full border-collapse mb-4 text-[9px]">
        <thead>
          <tr>
            <th className={thClass}>HD</th>
            <th className={thClass}>T</th>
            <th className={thClass}>L/T</th>
            <th className={thClass}>I/SC/P</th>
            <th className={thClass}>HIV</th>
            <th className={thClass}>S</th>
            <th className={thClass}>A</th>
            <th className={thClass}>HDE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdClass}>Horas Docentes</td>
            <td className={tdClass}>Teóricas</td>
            <td className={tdClass}>Laboratorio / Taller</td>
            <td className={tdClass}>Intervención / Servicio Comunitario / Proyecto</td>
            <td className={tdClass}>Horas de Interacción Virtual</td>
            <td className={tdClass}>Síncronas</td>
            <td className={tdClass}>Asíncronas</td>
            <td className={tdClass}>Horas de Dedicación Estudiantes</td>
          </tr>
        </tbody>
      </table>

      {/* Page break in print */}
      <div className="break-before-page"></div>

      {/* Evaluation Plan */}
      <div className="text-left font-bold text-[10px] mt-2 mb-0.5">III. Plan de evaluación</div>
      <table className="w-full border-collapse mb-2">
        <thead>
          <tr>
            <th className={thClass}>Unidad</th>
            <th className={thClass}>Competencia<br/>específica</th>
            <th className={thClass}>Criterio de<br/>Desempeño</th>
            <th className={thClass}>Estrategia<br/>de<br/>Evaluación</th>
            <th className={thClass}>Instrumento<br/>de<br/>Evaluación</th>
            <th className={thClass}>Tipo de<br/>Evaluación</th>
            <th className={thClass}>Evidencia<br/>de<br/>Evaluación</th>
            <th className={thClass}>Retroalimentación</th>
            <th className={thClass}>Lapso/<br/>Entrega</th>
            <th className={thClass}>Ponderación<br/>/<br/>Calificación</th>
          </tr>
        </thead>
        <tbody>
          {(!plan.evaluation_plans || plan.evaluation_plans.length === 0) && (
            <tr>
              <td colSpan={10} className={`${tdClass} h-[35px] text-gray-400 italic`}>Sin planes de evaluación definidos</td>
            </tr>
          )}
          {plan.evaluation_plans?.map((evalPlan, idx) => (
            <tr key={idx}>
              <td className={`${tdClass} ${bgColor} h-[35px]`}>{evalPlan.unit || ''}</td>
              <td className={tdLeftClass}>{formatPeriods(evalPlan.competence)}</td>
              <td className={tdLeftClass}>{formatPeriods(evalPlan.performance_criterion)}</td>
              <td className={tdLeftClass}>{formatPeriods(evalPlan.strategy)}</td>
              <td className={tdLeftClass}>{formatPeriods(evalPlan.instrument)}</td>
              <td className={tdClass}>{evalPlan.evaluation_type}</td>
              <td className={tdLeftClass}>{formatPeriods(evalPlan.evidence)}</td>
              <td className={tdLeftClass}>{formatPeriods(evalPlan.feedback_method)}</td>
              <td className={tdClass}>
                {evalPlan.due_week ? `Semana ${evalPlan.due_week} /` : ''}
                {evalPlan.due_date && <><br/>{formatDueDate(evalPlan.due_date)}</>}
              </td>
              <td className={tdClass}>
                {formatWeight(evalPlan.weight)}% / 20 pts
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="break-before-page"></div>

      {/* Weekly Contents */}
      <div className="text-left font-bold text-[11px] mt-4 mb-2">IV. Desarrollo de las unidades de contenidos</div>
      
      {(!plan.weekly_contents || plan.weekly_contents.length === 0) && (
        <div className="text-[10px] text-gray-400 italic">No hay contenido semanal definido.</div>
      )}

      {plan.weekly_contents?.map((week, idx) => (
        <table key={idx} className="w-full border-collapse mb-4">
          <thead>
            <tr>
              <th className={`${thClass} text-left`}>
                Semana: {week.week_number}
              </th>
              <th className={thClass}>
                Unidad de Contenido
              </th>
              <th colSpan={3} className={`${thClass} text-left bg-white font-normal`}>
                {week.unit_content || ''}
              </th>
            </tr>
            <tr>
              <th className={`${thClass} w-[25%]`}>Contenido</th>
              <th className={`${thClass} w-[20%]`}>Competencia Específica</th>
              <th className={`${thClass} w-[20%]`}>Criterios de Desempeño</th>
              <th className={`${thClass} w-[20%]`}>Estrategias Didácticas</th>
              <th className={`${thClass} w-[15%]`}>Evaluación /<br/>Realimentación</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${tdLeftClass} h-[40px]`}>{formatPeriods(week.content_description)}</td>
              <td className={tdLeftClass}>{formatPeriods(week.specific_competence)}</td>
              <td className={tdLeftClass}>{formatPeriods(week.performance_criteria)}</td>
              <td className={tdLeftClass}>{formatPeriods(week.teaching_strategy)}</td>
              <td className={tdLeftClass}>{formatPeriods(week.evaluation_feedback)}</td>
            </tr>
            <tr>
              <th className={`${thClass} text-left`}>Recursos de Aprendizaje</th>
              <td colSpan={4} className={tdLeftClass}>{formatPeriods(week.resources, false)}</td>
            </tr>
            <tr>
              <th className={`${thClass} text-left`}>Bibliografía</th>
              <td colSpan={4} className={tdLeftClass}>{week.bibliography}</td>
            </tr>
          </tbody>
        </table>
      ))}

    </div>
  );
}
