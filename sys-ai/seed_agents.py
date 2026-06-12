import os
import sys
import django

# Configure Django settings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ai_project.settings")
django.setup()

from ai_app.models import AgentTemplate, AIProvider

def seed_agents():
    print("Iniciando la siembra de Agentes de Referencia...")
    
    # Obtener el primer proveedor activo para asociarlo
    provider = AIProvider.objects.filter(is_active=True).first()
    if not provider:
        print("Advertencia: No se encontró ningún proveedor activo. Los agentes se crearán sin proveedor asignado.")
    
    agents_data = [
        {
            "id": 1,
            "name": "Asistente Pedagogico General",
            "description": "Asistente conversacional experto en pedagogía universitaria y competencias.",
            "agent_type": "chat",
            "is_active": True,
            "system_prompt": (
                "Eres un asistente experto en pedagogía. Responde a las dudas del usuario basándote únicamente "
                "en el contexto de los documentos vectorizados. Tu rol es cualitativo, guiando al profesor sobre "
                "competencias, metodologías y bibliografía."
            )
        },
        {
            "id": 2,
            "name": "Administrador Estadistico RAG",
            "description": "Agente experto en estadísticas y conteo de planes en tiempo real.",
            "agent_type": "chat",
            "is_active": True,
            "system_prompt": (
                "Eres un agente de inteligencia empresarial y estadísticas. Tienes acceso a herramientas para "
                "contar planes y sinópticos en tiempo real, así como a búsqueda semántica. Utiliza la herramienta "
                "adecuada dependiendo de si te preguntan cantidades o contenidos."
            )
        },
        {
            "id": 3,
            "name": "Evaluador de Planes Estricto",
            "description": "Agente encargado de auditar y evaluar críticamente planes de clase contra sinópticos.",
            "agent_type": "evaluator",
            "is_active": True,
            "system_prompt": (
                "Eres un evaluador experto en diseño curricular y coherencia pedagógica universitaria. Tu tarea es "
                "auditar planes de clase contrastándolos críticamente contra su programa sinóptico oficial.\n\n"
                "Analiza minuciosamente los siguientes aspectos:\n"
                "1. Contenidos: Valida que los temas del plan correspondan estrictamente a las unidades del sinóptico, sin omisiones ni desviaciones arbitrarias.\n"
                "2. Competencias: Verifica que las actividades y objetivos del plan tributen directamente a las competencias del sinóptico."
            )
        },
        {
            "id": 4,
            "name": "Asistente de Diseño Curricular",
            "description": "Asistente para redactar y estructurar nuevas asignaturas basadas en los sinópticos existentes.",
            "agent_type": "chat",
            "is_active": True,
            "system_prompt": (
                "Eres un consultor de diseño curricular. Tu tarea es ayudar a redactar y estructurar nuevas asignaturas "
                "tomando como referencia los programas sinópticos existentes en el sistema para mantener la coherencia institucional."
            )
        }
    ]

    for data in agents_data:
        agent, created = AgentTemplate.objects.get_or_create(
            name=data["name"],
            defaults={
                "id": data["id"],
                "description": data["description"],
                "agent_type": data["agent_type"],
                "is_active": data["is_active"],
                "system_prompt": data["system_prompt"],
                "provider": provider
            }
        )
        if created:
            print(f"  - Agente '{agent.name}' creado con éxito.")
        else:
            # Aseguramos actualizar campos en caso de que ya existieran pero estuviesen vacíos
            agent.system_prompt = data["system_prompt"]
            agent.description = data["description"]
            agent.agent_type = data["agent_type"]
            if provider and not agent.provider:
                agent.provider = provider
            agent.save()
            print(f"  - Agente '{agent.name}' ya existía (campos actualizados).")

    print("Siembra completada con éxito.")

if __name__ == "__main__":
    seed_agents()
