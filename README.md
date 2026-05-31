# Proyecto Maestría: Sistema Integral de Planificación Estratégica

**Autor:** Ing. Argenis Gil

Este proyecto constituye el desarrollo de un Sistema de Planificación Estratégica, diseñado para gestionar, monitorear y evaluar planes institucionales o corporativos. Su propósito central es proveer una plataforma tecnológica robusta que facilite a las organizaciones la traducción de su visión en objetivos cuantificables, centralizando la toma de decisiones, el seguimiento de indicadores clave de rendimiento (KPIs) y la coordinación de equipos en torno a metas comunes. 

Aplicación web integral desarrollada con una arquitectura moderna de microservicios. Utiliza un modelo híbrido en el backend combinando el panel de administración robusto de Django con la alta velocidad de FastAPI para la API pública, conectado a un frontend de alto rendimiento en React compilado con Vite.

## 🚧 Estado del Proyecto
Este proyecto se encuentra actualmente en **fase de desarrollo activo**. Las siguientes funcionalidades o módulos están planificados o aún se encuentran en construcción:

*   **[Módulo de Reportería y Exportación Avanzada]:** Generación y descarga automatizada de matrices y consolidados curriculares en formatos Excel (`.xlsx`) y CSV de forma dinámica (¡Completado!).
*   **[Dashboards Analíticos en Tiempo Real]:** Panel de control con estadísticas clave consolidadas sobre asignaturas, niveles curriculares (Pregrado y Postgrado) y carga horaria (¡Completado!).
*   **[Integradores de Identidad Externos (OAuth/SSO)]**: Soporte adicional opcional para autenticación federada con Google Workspace, Microsoft Azure AD u otros proveedores de identidad corporativos.
*   **[Cobertura de Pruebas Unitarias/E2E de Alta Fidelidad (Fase 2)]**: Extensión de pruebas automatizadas integrales del lado del cliente y flujos interactivos de gobernanza.

---

## ✨ Nuevas Funcionalidades Implementadas: Seguridad, Autenticación y Gobernanza Dinámica

Recientemente, el ecosistema de **DIDACTICO** ha sido robustecido con una arquitectura de seguridad y gobernanza IT de nivel empresarial, organizada en dos categorías operativas principales para garantizar la confidencialidad, integridad y la autogestión ágil de identidades.

### 🔐 Categoría A: Seguridad de Sesión e Infraestructura de Acceso

1. **Gobernanza de Sesiones Concurrentes (Refresh Tokens en Cookies HttpOnly)**
   * **Tabla de Sesiones Activas:** Base de datos estructurada con `plan_app_refresh_tokens` para controlar de manera granular todas las sesiones activas en el sistema, registrando el hash del token, su expiración y la genealogía del token (`parent_jti`) mediante Rotación de Refresh Tokens (RTR).
   * **Directivas de Cookie Ultra-Seguras:** Emisión del Refresh Token con políticas estrictas: `HttpOnly`, `Secure`, `SameSite=Strict`, y restringido exclusivamente a la ruta `/api/auth/refresh`, eliminando por completo vectores de ataque XSS y CSRF.
   * **Defensa contra Replay Attacks:** Si se detecta un intento de reutilización de un token de refresco ya revocado, el backend automáticamente bloquea la sesión entera y desactiva todas las demás sesiones activas asociadas al usuario como medida de mitigación instantánea.
   * **Cierre de Sesión Seguro en Todos los Dispositivos:** Al cambiar o restablecer la contraseña, el sistema marca inmediatamente todas las sesiones del usuario como revocadas (`is_revoked = True`), desautenticándolo en tiempo real de todos sus dispositivos.

2. **Autenticación Multifactor (MFA/2FA - TOTP)**
   * **Criptografía Secundaria Independiente:** Soporte nativo para autenticación de dos pasos empleando contraseñas de un solo uso basadas en el tiempo (TOTP) generadas por aplicaciones móviles como Google Authenticator o Authy.
   * **Stepper Animado Premium:** Flujo guiado en el perfil de usuario para activación con escaneo de código QR dinámico (generado y codificado en Base64 en el backend) e inputs segmentados interactivos para validar el código inicial.
   * **Seguridad en Primer y Segundo Factor:** El login inicial devuelve una redirección `HTTP 202 Accepted` si el usuario tiene MFA activo, requiriendo un JWT temporal firmado de corta duración para ingresar el código OTP, mitigando ataques de replay de OTP mediante ventanas de tiempo de sincronización.

3. **Mecanismos de Protección Antifuerza Bruta y Rate Limiting**
   * **Rate Limiting por Red (`slowapi`):** Límites de peticiones estrictos por IP en endpoints críticos (máximo de 5 intentos/minuto en `/api/token` y 3 intentos/minuto en `/api/auth/forgot-password` para salvaguardar el servidor SMTP).
   * **Bloqueo Inteligente de Cuentas (Account Lockout):** Tras 5 intentos fallidos consecutivos de contraseña o código OTP, la cuenta se bloquea automáticamente por 15 minutos (`lockout_until`), impidiendo cualquier intento de descifrado en base de datos.
   * **UX Dinámico con Contador en Tiempo Real:** El frontend intercepta el estado `HTTP 423 Locked`, deshabilita los controles y muestra un banner premium rojo fuego con una cuenta regresiva dinámica en tiempo real.

4. **Flujo de Recuperación Autónoma de Credenciales**
   * **Previene Enumeración de Usuarios:** Las respuestas de recuperación (`/forgot-password`) son uniformes y simulan retardos aleatorios para evitar que atacantes deduzcan cuentas válidas.
   * **Tokens JWT de Un Solo Uso:** Generación de tokens temporales de 15 minutos firmados criptográficamente que invalidan inmediatamente su uso posterior en la tabla `plan_app_password_resets`.

5. **Entropía de Contraseñas en Tiempo Real (`zxcvbn`)**
   * **Evaluación Inteligente:** Integración de la librería `zxcvbn` para medir la entropía basada en patrones comunes, nombres, y fechas.
   * **Restricción de Fuerza Mínima:** Candado estricto en el backend y frontend que impide contraseñas con robustez menor a Nivel 3.

### ⚙️ Categoría B: Gobernanza Dinámica del Sistema y Experiencia de Usuario (UX)

1. **Área Especial de Configuración de Gobernanza (System Settings Panel)**
   * **Base de Datos Dinámica:** Tabla `plan_app_system_settings` en PostgreSQL que almacena parámetros en tiempo de ejecución (`SUPPORT_EMAIL`, `INVITATION_TOKEN_EXPIRE_HOURS`, etc.).
   * **Gestor de Caché asíncrono (`SettingsManager`):** Sistema de caché en memoria en FastAPI que optimiza las lecturas evitando consultas recurrentes a base de datos.
   * **Consola SMTP Diagnóstica:** Panel con validación de credenciales SMTP en tiempo real para verificar el estado de envío de correos institucionales.

2. **Cargador Masivo de Usuarios en Lote (CSV & Excel)**
   * **Analizador Inteligente con `pandas`:** Validación sintáctica de correos, comprobación de roles del sistema y detección de duplicados en tiempo real.
   * **Diálogo Drag-and-Drop Premium:** Interfaz interactiva de cristal (Glassmorphic) en el frontend que permite subir el archivo, muestra una grilla de previsualización con marcado en rojo brillante y badges explicativos para filas inválidas, permitiendo importar omitiendo las filas erróneas de manera atómica.

3. **Gobernanza de Invitaciones y Onboarding de Usuarios**
   * **Invitaciones Cifradas y Temporales:** Envío de enlaces seguros con firma criptográfica que vencen tras la cantidad de horas dictadas por el panel de gobernanza.
   * **Panel de Control de Invitaciones (`InvitationsManagement.tsx`):** Grilla interactiva que muestra las invitaciones activas, expiradas o revocadas, con acciones de reenvío automático o revocación atómica en cascada.

4. **Interfaces Frontend Premium y Glassmorphism (Efecto Cristal)**
   * **Perfil de Usuario Autogestionable (`UserProfile.tsx`):** Candados visuales plateados con tooltips flotantes inteligentes en los campos deshabilitados por la gobernanza centralizada de la institución (por ejemplo, el correo institucional).
   * **Gobernanza IT de Elite (`AdminSettings.tsx`):** Panel exclusivo para `SUPER_ADMIN` con sub-tabs responsivas de cristal, control de switches de políticas de accesos, editor dinámico de tags de columnas CSV requeridas y terminal SMTP interactivo.
    * **Gestión de Identidades Eficiente (`UserManagement.tsx`):** Barra superior de búsqueda con **Debounce de 300 ms** para aliviar la carga de peticiones al backend y selectores avanzados por rol y estado MFA.

### 📚 Categoría C: Gestión e Inteligencia de Programas Sinópticos (Syllabus)

Recientemente, el ecosistema de **DIDACTICO** ha sido enriquecido con un módulo robusto de inteligencia curricular y gobernanza de planes de estudio estructurado como un microservicio independiente.

1. **Inteligencia de Extracción y Parsing Curricular (`PyMuPDF`)**
   * **Lectura Sintáctica de PDFs (`app/parser.py`):** Un extractor de alta precisión basado en la biblioteca PyMuPDF (`fitz`) procesa los archivos PDF subidos, lee y estructura metadatos del programa como el código de materia, nombre, nivel curricular, créditos académicos y distribución horaria (HAD, HDE, HTS).
   * **Estructuración Semántica Dinámica:** Extrae de manera granular los bloques textuales correspondientes a la presentación, propósito, competencias previas/genéricas, estrategias de enseñanza, metodologías de evaluación y la lista detallada de unidades de aprendizaje (número, título, contenidos y criterios de desempeño).

2. **Gobernanza Física de Archivos y Control de Versiones con Seguridad Criptográfica**
   * **Prevención de Duplicidad Física (SHA-256):** El microservicio calcula el hash `SHA-256` en tiempo real de cada archivo PDF. Si coincide de forma exacta con uno existente, previene la inserción de datos redundantes para salvaguardar el almacenamiento.
   * **Versionamiento Atómico:** Si la materia ya existe en el sistema, la versión activa anterior se marca como inactiva de manera atómica, y se genera un incremento incremental (`v1`, `v2`, etc.), guardando físicamente el PDF bajo la nomenclatura `{codigo}_v{version}.pdf` en el volumen compartido.

3. **Carga e Importación Masiva en Lotes (ZIP)**
   * **Procesamiento Asíncrono Tolerante a Fallos:** Permite subir archivos comprimidos `.zip` con decenas de programas sinópticos. El backend los extrae a un directorio temporal, los procesa y valida individualmente de manera transaccional.
   * **Consolidación Limpia del Servidor:** Omitirá los archivos duplicados de forma segura sin interrumpir la cola y, una vez terminada la operación (exitosa o fallida), realiza una purga absoluta del directorio y archivos ZIP temporales del disco del servidor.

4. **Matriz de Exportación e Integraciones en Tiempo Real**
   * **Streaming Consolidado (Excel & CSV):** Los administradores pueden descargar instantáneamente la matriz curricular global de la institución a formatos Excel (`.xlsx`) y CSV de forma fluida, transmitidos directamente mediante `StreamingResponse` para alto rendimiento y bajo uso de memoria.

5. **Experiencia de Usuario Premium e Interfaces Interactivas**
   * **Panel de Control Curricular (`SyllabusManagement.tsx`):** Grid responsivo avanzado con búsqueda en tiempo real, ordenación y selectores dinámicos basados en programas académicos y niveles escolares.
   * **KPIs Dinámicos en Tiempo Real:** Tarjetas premium en cabecera con recuentos globales de asignaturas, distribución de Pregrado/Postgrado e indicador de horas promedio HAD.
   * **Visor Estructurado de Asignaturas:** Un modal premium en pestañas interactivas que muestra detalladamente toda la estructura modular de la materia, la grilla interactiva de Unidades de Aprendizaje y sus materias correspondientes/requisitos.
   * **Historial de Auditoría Interno:** Modal de historial que detalla cronológicamente las versiones subidas de una materia, el usuario administrativo responsable de la carga, la fecha/hora y firma SHA-256 con botón de copiado rápido al portapapeles.
    * **Edición Manual Flexible:** Permite corregir o actualizar manualmente datos de asignaturas de forma directa sin alterar el PDF original de soporte, sincronizándose reactivamente con React Query.

6. **Integración Automática con Distribución Académica**
   * **Auto-creación de Carreras:** Al procesar un PDF (individual o por lote), el sistema detecta de forma inteligente el nombre de la carrera y la crea automáticamente en el módulo de Distribución Académica.
   * **Facultad Base Dinámica:** Toda nueva carrera descubierta mediante la carga de PDFs se asocia de forma predeterminada a una "Facultad Base", la cual también es generada por el sistema si no existe, centralizando los datos sin requerir intervención manual previa.

### 🏫 Categoría D: Gestión Relacional Multiperiodo (Many-to-Many) y Auditoría de Planta Docente

Para dar soporte a la evolución organizativa de la institución, se diseñó e implementó un sistema de asignación de muchos a muchos (`many-to-many`) para los docentes, desvinculando la carga académica directa del modelo físico del usuario e introduciendo una tabla pivot relacional de auditoría.

1. **Arquitectura Relacional Muchos a Muchos (`UserAcademicPeriod`)**
   * **Tabla Pivot en PostgreSQL:** Introducción del modelo `plan_app_user_academic_period` con llaves foráneas a las tablas de usuarios y periodos académicos con integridad en cascada.
   * **Separación de Contextos Curriculares:** Los campos de carga académica (`subject_code`, `section`) se administran de forma independiente por cada periodo, permitiendo que el mismo docente físico posea cargas horarias y materias completamente distintas a lo largo del historial institucional sin duplicar su cuenta global.

2. **Auditoría IT y Logs de Asignación por Periodo**
   * **Metadatos de Registro:** Cada vinculación de un docente a un periodo académico registra automáticamente el usuario administrativo responsable del alta (`created_by_id`), la fecha y hora exacta localizada del registro (`created_at`) y el canal de alta (`creation_method`), distinguiendo entre `"MANUAL"` (creación individual en el modal) y `"BULK"` (carga masiva en lote).
   * **Activación por Periodo:** Introducción del switch de estado `is_active` específico en la relación. Permite inhabilitar a un docente para operar en un periodo académico en particular sin dar de baja ni bloquear su acceso global al sistema.

3. **Lógica de Previsualización Flexibilizada y Carga Masiva Tolerante**
   * **Validación no Bloqueante de Duplicados (Warnings):** Adaptación del parseador en la importación masiva. Si un docente ya existe globalmente en la base de datos (por correo o cédula), el preview lo cataloga como una advertencia (Warning) en lugar de un error crítico. La fila se marca como válida (`VALID`), lo que permite proceder con la importación y crear automáticamente su relación en el periodo elegido de forma transparente.
   * **Inactivación Automática por Lote:** Al consolidar una carga masiva en un periodo académico, el backend asocia a todos los docentes de la lista como activos (`is_active = True`). En paralelo, identifica a toda la planta de profesores global no incluida y les asocia un registro inactivo (`is_active = False`) en ese periodo, garantizando la consistencia total del listado.

4. **Experiencia de Usuario Premium e Interfaces Interactivas**
   * **Filtros e Integraciones en Servidor:** El selector de periodo en el panel de control de usuarios (`UserManagement.tsx`) realiza consultas asíncronas optimizadas enviando el parámetro `period_id` directamente al backend (incluyendo la opción `0` para docentes sin periodo), acelerando la velocidad de visualización.
   * **Tarjeta de Auditoría en Modal Curricular:** Diseño ultra-premium de un bloque de auditoría integrado en la vista rápida del modal de carga académica del docente. Muestra detalladamente los metadatos de quién registró al profesor, cuándo, bajo qué método y su estado exacto en ese trimestre.

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
    *   Pyotp `2.9.0` & Qrcode `7.4.2` (Generación y validación de MFA / TOTP)
    *   Slowapi `0.1.9` (Rate limiting dinámico por dirección IP)
    *   Pandas `2.2.1` & Openpyxl `3.1.2` (Procesamiento inteligente de archivos masivos CSV/Excel)
    *   Zxcvbn-python `4.4.28` (Evaluación de entropía y robustez de contraseñas)
*   **Testing:** Pytest `8.1.1`, Pytest-asyncio `0.23.6`, Pytest-django `4.8.0`

### Microservicio de Syllabus (`sys-syllabus`)
Microservicio asíncrono e independiente especializado en la extracción, control de versiones y almacenamiento físico de programas sinópticos curriculares.
*   **Lenguaje Base:** Python `3.12-slim`
*   **Frameworks y Servidores:** FastAPI `0.110.1` expuesto de forma asíncrona mediante Uvicorn `0.29.0` en el puerto `8002` (localmente).
*   **Motor de Extracción y Parsing:** PyMuPDF (`fitz` `1.23.26`) para parsing de PDF y extracción estructurada de texto.
*   **Procesamiento de Datos:** Pandas `2.2.1` y Openpyxl `3.1.2` para la consolidación sintáctica y exportación dinámica de matrices Excel/CSV.
*   **ORM y Drivers:** SQLAlchemy `2.0.29` y Asyncpg `0.29.0` para operaciones relacionales no bloqueantes en PostgreSQL.

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
    *   Zxcvbn-ts (Cálculo de entropía y feedback interactivo de robustez en inputs)
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
    *   **Backend FastAPI Syllabus (API y Swagger UI):** [http://localhost:8002/docs](http://localhost:8002/docs)
    *   **Backend Django (Panel de Administración):** [http://localhost:8000/admin](http://localhost:8000/admin)
    *   **Base de datos (PostgreSQL):** `localhost:5432`

## 🌐 Despliegue y Configuración de Entorno

El proyecto utiliza una arquitectura de **Proxy Inverso** en producción para centralizar el tráfico bajo un único dominio y mejorar la seguridad.

### 💻 Entorno Local (Desarrollo)
Localmente, el sistema utiliza el archivo `docker-compose.override.yml` para facilitar la depuración:
*   El Frontend se comunica directamente con la API en `http://localhost:8001`.
*   No es necesario configurar dominios reales.
*   Los CORS están configurados para permitir tráfico desde `localhost`.

### 🚀 Despliegue en Producción (Dokploy / VPS)
En producción, todo el tráfico fluye a través del contenedor de Frontend (Nginx), el cual actúa como puerta de enlace.

#### 1. Variables de Entorno Críticas
Debes configurar estas variables en el panel de **Dokploy** (sección *Environment* del servicio Frontend):
*   `VITE_API_URL`: Debe apuntar a tu dominio seguido del prefijo `/api` (ej. `https://didactico.nexolab.dev/api`).
*   `ALLOWED_ORIGINS`: Lista de dominios permitidos para CORS (ej. `https://didactico.nexolab.dev`).

#### 2. Configuración de Dominios en Dokploy
*   **Servicio Frontend:** Asigna tu dominio principal (ej. `didactico.nexolab.dev`).
*   **Servicio Backend (`fastapi-api`):** **No requiere** un dominio público asignado. Nginx redirige el tráfico interno a través de la red de Docker.

#### 3. Paso Crítico: Rebuild
Debido a que Vite inyecta las variables de entorno en el código compilado:
> [!IMPORTANT]
> Cada vez que cambies la `VITE_API_URL` en las variables de entorno de Dokploy, **debes realizar un Rebuild / Redeploy** del servicio Frontend para que los cambios surtan efecto en los archivos estáticos.

### 🛡️ Arquitectura del Proxy Inverso
El archivo `sys-plan/nginx.conf` intercepta las peticiones que comienzan con `/api/` y las reenvía internamente al contenedor `fastapi-api:8001`, eliminando el prefijo para que la API las procese normalmente.

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
├── sys-syllabus/            # Microservicio de Gestión de Syllabus (FastAPI)
│   ├── app/                 # Módulo de base de datos, modelos, parser y API
│   ├── syllabus_pdfs/       # Almacenamiento persistente de PDFs curriculares
│   ├── Dockerfile           # Contenedor dedicado a Syllabus
│   ├── entrypoint-syllabus.sh # Script de arranque y migraciones
│   └── requirements.txt     # Dependencias de Python especializadas (fitz, openpyxl, pandas)
└── sys-plan/                # Aplicación Frontend
    ├── src/                 # Código fuente de React
    ├── public/              # Archivos estáticos
    ├── Dockerfile           # Contenedor Multi-stage (Node build -> Nginx serve)
    ├── package.json         # Dependencias de Node.js
    ├── tailwind.config.js   # Configuración del tema de Tailwind
    └── vite.config.ts       # Configuración del empaquetador Vite
```

---

## 🛠️ Solución de Problemas Frecuentes en Producción

### Recuperación del Rol SUPER_ADMIN en Producción
**¿Por qué sucede?** 
Al actualizar la plataforma en entornos de producción que mantienen volúmenes persistentes (como Dokploy), es posible que los scripts de semillas (`seed.py`) omitan reasignar roles de seguridad al usuario `superadmin@didactico.edu` porque detectan que la cuenta ya existe. Esto ocasiona que el usuario ingrese correctamente, pero el menú lateral (sidebar) aparezca vacío o incompleto debido a la falta de permisos en su token.

**¿Cómo usar este script y para qué?**
Este comando inyecta directamente el rol de `SUPER_ADMIN` al usuario existente dentro de la base de datos sin necesidad de borrar a los demás usuarios registrados. Cópialo y pégalo **exactamente con sus saltos de línea** en la terminal de tu servidor de producción:

```bash
sudo docker exec -it planning_fastapi python -c "
import asyncio
from api.database import AsyncSessionLocal
from api.models import User, Role
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def fix():
    db = AsyncSessionLocal()
    async with db:
        user_query = await db.execute(
            select(User).options(selectinload(User.roles)).where(User.email == 'superadmin@didactico.edu')
        )
        user = user_query.scalars().first()
        
        role_query = await db.execute(
            select(Role).where(Role.name == 'SUPER_ADMIN')
        )
        role = role_query.scalars().first()
        
        if user and role and role not in user.roles:
            user.roles.append(role)
            await db.commit()
            print('¡Éxito! Permisos asignados al superadmin correctamente.')
        else:
            print('El rol ya estaba asignado o no se encontró el usuario.')

asyncio.run(fix())
"
```
*(Luego de ejecutarlo, simplemente refresca tu navegador web para generar una nueva sesión con todos los permisos).*

---

## 🌟 Resumen de Novedades y Características Actuales de la App

La aplicación ha evolucionado significativamente hasta convertirse en un sistema integral de clase empresarial. Las novedades más destacadas incluyen:

1. **Dashboard en Tiempo Real (WebSocket):** Gráficos interactivos y conteo exacto de usuarios conectados (en base a conexiones WebSocket activas) y analíticas globales de la institución.
2. **Gobernanza Dinámica e Identidad:** Panel robusto de configuración del sistema (variables globales, SMTP), auditoría detallada de acciones, e integración de autenticación de Dos Factores (2FA/TOTP) con códigos QR.
3. **Carga Inteligente Masiva y Analítica:** Importación optimizada de usuarios y asignación de profesores a períodos académicos mediante archivos CSV o Excel (tolerante a fallos y con vistas previas interactivas).
4. **Módulo Inteligente de Syllabus (Microservicio Independiente):** Extracción automática y estructuración semántica de información desde archivos PDF usando PyMuPDF, control de versiones criptográfico (SHA-256) e inserción directa a la malla curricular.
5. **Arquitectura Relacional Avanzada (Many-to-Many):** Asignación granular de cargas horarias donde un mismo docente puede dictar materias distintas en periodos distintos sin requerir cuentas duplicadas, manteniendo siempre la trazabilidad histórica de auditoría.
6. **Diseño de Interfaz Premium (Glassmorphism):** Navegación fluida y responsiva, cuadros de diálogo modales con retroalimentación en vivo, y componentes modernos de React que otorgan una experiencia visual de élite.
7. **Jerarquía Institucional y Aprobación de Planes Didácticos:** Flujos de aprobación multinivel. Los `COORDINADORES` pueden aprobar planes didácticos únicamente de las asignaturas pertenecientes a su departamento asignado, mientras que los administradores generales (`SUPER_ADMIN`, `ADMIN_GESTION`) poseen aprobación global.
8. **Seguridad y Accesos Granulares por Rol:** El módulo de Programas Sinópticos restringe la carga masiva e individual (PDF/ZIP) y la modificación de metadatos exclusivamente a perfiles administrativos (`ADMIN_GESTION`, `SUPER_ADMIN`), estableciendo para los Coordinadores un entorno seguro de solo consulta. Asimismo, los Dashboards de revisión filtran los contenidos en tiempo real según el área de supervisión del usuario.
