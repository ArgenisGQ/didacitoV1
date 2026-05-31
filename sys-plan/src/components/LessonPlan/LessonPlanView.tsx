import React from 'react';
import { LessonPlan } from '../../types/lessonPlan';
import WatermarkOverlay from './WatermarkOverlay';

interface LessonPlanViewProps {
  plan: LessonPlan;
}

export default function LessonPlanView({ plan }: LessonPlanViewProps) {
  // Use tailwind arbitrary values to exactly match backend PDF colors
  const borderColor = "border-[#7cb3d1]";
  const bgColor = "bg-[#e6f0fa]";

  const tdClass = `border ${borderColor} px-2 py-1 text-center align-middle text-[10px] sm:text-xs`;
  const thClass = `border ${borderColor} ${bgColor} px-2 py-1 text-center font-bold text-[10px] sm:text-xs`;
  const tdLeftClass = `border ${borderColor} px-2 py-1 text-left align-middle text-[10px] sm:text-xs`;

  // Provide fallbacks for UI
  const subjectName = plan.title || "---"; // using title as subject name for preview
  const authorName = plan.author_name || "---";
  const authorEmail = plan.author?.email || "---";

  return (
    <div className="relative min-h-screen bg-white text-black p-4 sm:p-8 max-w-[1000px] mx-auto print:p-0 print:m-0 font-sans">
      <WatermarkOverlay status={plan.status} />

      {/* Header Table */}
      <table className={`w-full border-collapse mb-4 ${borderColor} border`}>
        <tbody>
          <tr>
            <td rowSpan={2} className={`${tdClass} w-[100px]`}>
              <img src="/university_logo.png" alt="Logo" className="max-w-[80px] h-auto mx-auto" />
            </td>
            <td rowSpan={2} className={`${tdClass} font-bold text-xs`}>
              UNIVERSIDAD<br />YACAMBÚ<br />VICERRECTORADO<br />ACADÉMICO
            </td>
            <td rowSpan={2} className={`${tdClass} font-bold text-sm`}>
              PLANIFICACIÓN DIDÁCTICA
            </td>
            <td className={`${thClass} w-[120px]`}>
              CÓDIGO:
            </td>
          </tr>
          <tr>
            <td className={tdClass}>F01-VRA100-110423-265</td>
          </tr>
        </tbody>
      </table>

      {/* Subject Info */}
      <div className="text-left font-bold text-[11px] mt-4 mb-2">
        Nombre de la Asignatura: 
        <span className={`font-normal ml-2 ${bgColor} px-12 py-0.5 inline-block border ${borderColor} w-[75%]`}>
          {subjectName}
        </span>
      </div>

      <table className="w-full border-collapse mb-2">
        <thead>
          <tr>
            <th rowSpan={2} className={`${thClass} w-[25%]`}>Propósito</th>
            <th rowSpan={2} className={thClass}>Código de la<br/>Asignatura</th>
            <th rowSpan={2} className={thClass}>Sección</th>
            <th rowSpan={2} className={thClass}>Prelación</th>
            <th rowSpan={2} className={thClass}>Total,<br/>Horas</th>
            <th rowSpan={2} className={thClass}>Total,<br/>Horas</th>
            <th colSpan={2} className={thClass}>HD</th>
            <th colSpan={3} className={thClass}>HIV</th>
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
            <td className={`${tdClass} h-[25px]`}></td>
            <td className={tdClass}>{plan.subject_code || ''}</td>
            <td className={tdClass}>{plan.section || ''}</td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th colSpan={3} className={thClass}>Componente Pregrado</th>
            <th colSpan={3} className={thClass}>Componente Postgrado</th>
            <th rowSpan={2} className={thClass}>Período<br/>Académico</th>
            <th colSpan={3} className={thClass}>Modalidad</th>
            <th rowSpan={2} className={thClass}>Facultad/Carrera</th>
            <th rowSpan={2} className={thClass}>Programa<br/>/Postgrado</th>
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
            <td className={`${tdClass} h-[20px]`}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
          </tr>
        </tbody>
      </table>

      {/* Teacher Info */}
      <div className="text-left font-bold text-[11px] mt-4 mb-1">II. Identificación del Docente</div>
      <table className="w-full border-collapse mb-2">
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
            <td className={`${tdClass} h-[25px]`}>{authorName}</td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
            <td className={tdClass}>{authorEmail}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th className={thClass}>Horario de clases:</th>
            <th className={thClass}>Horario de Tutoría Docente:</th>
            <th className={thClass}>Total, horas docentes:</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${tdClass} h-[35px]`}></td>
            <td className={tdClass}></td>
            <td className={tdClass}></td>
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
      <div className="text-left font-bold text-[11px] mt-4 mb-1">III. Plan de evaluación</div>
      <table className="w-full border-collapse mb-4">
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
              <td className={`${tdClass} h-[35px]`}>{evalPlan.unit || ''}</td>
              <td className={tdLeftClass}>{evalPlan.competence}</td>
              <td className={tdClass}></td>
              <td className={tdLeftClass}>{evalPlan.strategy}</td>
              <td className={tdLeftClass}>{evalPlan.instrument}</td>
              <td className={tdClass}></td>
              <td className={tdLeftClass}>{evalPlan.evidence}</td>
              <td className={tdLeftClass}>{evalPlan.feedback_method}</td>
              <td className={tdClass}>{evalPlan.due_week || ''}</td>
              <td className={tdClass}>{evalPlan.weight || 0}%</td>
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
              <th colSpan={2} className={`${thClass} text-left border-r-0`}>
                Semana: {week.week_number}
              </th>
              <th colSpan={3} className={`${thClass} text-left border-l-0`}>
                Unidad de Contenido: 
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
              <td className={`${tdLeftClass} h-[40px]`}>{week.content_description}</td>
              <td className={tdLeftClass}></td> {/* specific_competence missing from type? */}
              <td className={tdClass}></td>
              <td className={tdLeftClass}>{week.teaching_strategy}</td>
              <td className={tdClass}></td>
            </tr>
            <tr>
              <th className={`${thClass} text-left`}>Recursos de Aprendizaje<br/>/ Bibliografía</th>
              <td colSpan={4} className={tdLeftClass}>
                {week.resources}
                {week.resources && week.bibliography && <br/>}
                {week.bibliography}
              </td>
            </tr>
          </tbody>
        </table>
      ))}

    </div>
  );
}
