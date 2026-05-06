# Proyecto Maestría: Sistema Integral de Planificación Estratégica

**Autor:** Ing. Argenis Gil

Este proyecto constituye el desarrollo de un Sistema de Planificación Estratégica, diseñado para gestionar, monitorear y evaluar planes institucionales o corporativos. Su propósito central es proveer una plataforma tecnológica robusta que facilite a las organizaciones la traducción de su visión en objetivos cuantificables, centralizando la toma de decisiones, el seguimiento de indicadores clave de rendimiento (KPIs) y la coordinación de equipos en torno a metas comunes. 

Aplicación web integral desarrollada con una arquitectura moderna de microservicios. Utiliza un modelo híbrido en el backend combinando el panel de administración robusto de Django con la alta velocidad de FastAPI para la API pública, conectado a un frontend de alto rendimiento en React compilado con Vite.

## 🚧 Estado del Proyecto
Este proyecto se encuentra actualmente en **fase de desarrollo activo**. Las siguientes funcionalidades o módulos no están habilitados o aún están en construcción:

*   **[Gestión Completa de Autenticación / Roles]:** [Validación de correos, integración con proveedores de identidad externos (OAuth) y control de acceso basado en roles granulares (RBAC)].
*   **[Módulo de Reportería y Exportación Avanzada]:** [Generación automatizada de reportes gerenciales en formatos PDF y Excel].
*   **[Dashboards Analíticos en Tiempo Real]:** [Integración completa de gráficos interactivos basados en los datos del sistema].
*   **[Cobertura Total de Pruebas Unitarias/E2E]:** [Implementación de suite completa de pruebas automatizadas para garantizar estabilidad en despliegues continuos].

## 🏗️ Arquitectura y Tecnologías (Stack Detallado)

El proyecto está dockerizado y dividido en dos contenedores principales de desarrollo, orquestados junto a una base de datos PostgreSQL.

### Infraestructura / Orquestación
*   **Docker & Docker Compose**
*   **Base de Datos:** PostgreSQL `16-alpine`

### Backend (`sys-core`)
Escrito en Python y diseñado para exponer las APIs y administrar la base de datos de manera eficiente.
*   **Lenguaje Base:** Python `3.12-slim`
*   **Frameworks:**
    *   Django `5.0.4` (Core, ORM base y Panel de Administración)
    *   FastAPI `0.110.1` (API RESTful asíncrona de alto rendimiento)
    *   Django REST Framework `3.15.1`
*   **Servidores Web:**
    *   Uvicorn `0.29.0` (Para FastAPI)
    *   Gunicorn `22.0.0` (Para Django)
*   **Base de Datos y ORM Asíncrono:**
    *   SQLAlchemy `2.0.29` (Soporte asyncio)
    *   Asyncpg `0.29.0`
    *   Psycopg2-binary `2.9.9` (Driver sincrónico para Django)
*   **Utilidades y Seguridad:**
    *   Pydantic `2.6.4`
    *   Python-jose `3.3.0`, Passlib `1.7.4`, Bcrypt `3.2.2` (Autenticación JWT y hashing)
*   **Testing:** Pytest `8.1.1`, Pytest-asyncio `0.23.6`, Pytest-django `4.8.0`

### Frontend (`sys-plan`)
Aplicación de una sola página (SPA) responsiva y moderna.
*   **Entorno Base:** Node.js `v20-alpine`
*   **Servidor Web (Producción):** Nginx `alpine`
*   **Core:**
    *   React `19.2.5`
    *   Vite `8.0.10`
    *   TypeScript `~6.0.2`
*   **Estilos y UI:**
    *   Tailwind CSS `3.4.19`
    *   Componentes base de Radix UI (Avatar, Dialog, Dropdown Menu, Select, etc.)
    *   Lucide React `1.14.0` (Iconografía)
    *   Tailwind-merge `3.5.0` y Clsx `2.1.1`
*   **Gestión de Estado y Formularios:**
    *   TanStack React Query `5.100.9` (Gestión de estado del servidor)
    *   React Hook Form `7.54.2`
    *   Zod `4.4.2` (Validación de esquemas)
*   **Herramientas de Desarrollo:** ESLint `10.2.1`, Babel React Compiler `1.0.0`

## ⚙️ Requisitos Previos

Asegúrate de tener instalado lo siguiente en tu máquina local:
1.  [Docker Desktop](https://www.docker.com/products/docker-desktop) o Docker Engine + Docker Compose.
2.  (Opcional) Node.js v20+ y Python 3.12 si deseas correr los servicios localmente sin contenedores para depuración profunda.

## 🚀 Instalación y Ejecución Local

1.  **Clonar el repositorio:**
    ```bash
    git clone <url-del-repositorio>
    cd PROYECTO-MAESTRIA-PY
    ```

2.  **Configurar Variables de Entorno:**
    Existe un archivo `.env` en la raíz y configuraciones pasadas a través de `docker-compose.yml`. Las credenciales por defecto están configuradas para el entorno de desarrollo (Usuario DB: `user`, Contraseña: `password`, BD: `planning_db`).

3.  **Desplegar los servicios con Docker Compose:**
    Este comando descargará las imágenes base, instalará dependencias, y levantará la Base de datos, el panel de Django, la API de FastAPI y el cliente frontend de React.
    ```bash
    docker-compose up --build
    ```

4.  **Acceso a los Servicios:**
    *   **Frontend (React/Vite):** [http://localhost:80](http://localhost:80)
    *   **Backend FastAPI (API y Swagger UI):** [http://localhost:8001/docs](http://localhost:8001/docs)
    *   **Backend Django (Panel de Administración):** [http://localhost:8000/admin](http://localhost:8000/admin)
    *   **Base de datos (PostgreSQL):** `localhost:5432`

## 📁 Estructura Principal del Directorio

```text
PROYECTO-MAESTRIA-PY/
├── docker-compose.yml       # Orquestación de servicios locales
├── .env                     # Variables de entorno compartidas
├── .agents/                 # Herramientas de agentes IA
├── sys-core/                # Aplicaciones Backend
│   ├── api/                 # Módulo de la API (FastAPI)
│   ├── django_project/      # Módulo Core de Administración y ORM (Django)
│   ├── tests/               # Pruebas automatizadas backend (Pytest)
│   ├── Dockerfile.django    # Contenedor dedicado a Django
│   ├── Dockerfile.fastapi   # Contenedor dedicado a FastAPI
│   └── requirements.txt     # Dependencias de Python
└── sys-plan/                # Aplicación Frontend
    ├── src/                 # Código fuente de React
    ├── public/              # Archivos estáticos
    ├── Dockerfile           # Contenedor Multi-stage (Node build -> Nginx serve)
    ├── package.json         # Dependencias de Node.js
    ├── tailwind.config.js   # Configuración del tema de Tailwind
    └── vite.config.ts       # Configuración del empaquetador Vite
```
