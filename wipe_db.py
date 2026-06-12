import subprocess
import sys

def run_command(cmd):
    print(f"Ejecutando: {cmd}")
    # Use shell=True to support windows/linux environments
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error al ejecutar comando:\n{result.stderr}")
        return False
    else:
        print(result.stdout)
        return True

def main():
    print("=========================================================")
    print("INICIANDO LIMPIEZA COMPLETA DE LA BASE DE DATOS")
    print("=========================================================")

    # 1. Droppear y recrear el esquema public en el contenedor de postgres
    # Esto elimina todas las tablas, vistas, tipos y datos de forma instantánea.
    sql_command = (
        'DROP SCHEMA public CASCADE; '
        'CREATE SCHEMA public; '
        'GRANT ALL ON SCHEMA public TO public; '
        'GRANT ALL ON SCHEMA public TO user;'
    )
    
    db_cmd = f'docker exec -i planning_db psql -U user -d planning_db -c "{sql_command}"'
    
    if not run_command(db_cmd):
        print("No se pudo limpiar la base de datos directamente a través de psql. "
              "Asegúrate de que el contenedor 'planning_db' esté corriendo.")
        sys.exit(1)

    print("Base de datos limpia (esquema public recreado).")

    # 1.1 Borrar PDFs y documentos del contenedor syllabus-service
    print("=========================================================")
    print("BORRANDO DOCUMENTOS Y PDFS DEL SISTEMA")
    print("=========================================================")
    pdf_clear_cmd = 'docker exec -i planning_syllabus sh -c "rm -rf /app/syllabus_pdfs/*"'
    if run_command(pdf_clear_cmd):
        print("Todos los PDFs y documentos fueron eliminados de la carpeta de almacenamiento.")
    else:
        print("Advertencia: No se pudieron borrar los PDFs. Asegúrate de que el contenedor 'planning_syllabus' esté activo.")
    print("=========================================================")
    print("REINICIANDO CONTENEDORES PARA RECREAR TABLAS Y SEMILLAS")
    print("=========================================================")

    # 2. Reiniciar los contenedores de django y fastapi para que vuelvan a ejecutar
    # las migraciones y las semillas (seeds) de manera limpia sobre la base vacía.
    restart_cmd = "docker compose restart django-admin fastapi-api"
    if run_command(restart_cmd):
        print("\n¡Proceso completado con éxito!")
        print("La base de datos fue borrada por completo y los contenedores "
              "se están reiniciando para aplicar las migraciones y semillas desde cero.")
    else:
        print("\nSe limpió la base de datos, pero hubo un problema al reiniciar los contenedores.")
        print("Por favor ejecuta manualmente: docker compose restart django-admin fastapi-api")

if __name__ == "__main__":
    main()
