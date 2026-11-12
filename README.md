# AulaSync — Sprint 2

Proyecto de Metodología en Sistemas, UTN. Están implementadas HU-01 (registro), HU-02 (sesiones) y HU-03 (materias). El dashboard consulta datos reales del usuario autenticado. Actividades, materiales e IA continúan pendientes; sus secciones son informativas y no simulan operaciones.

## Abrir en esta computadora

Desde la carpeta del proyecto en PowerShell:

```powershell
npm run db:local:start
npm run dev
```

Abrir **http://127.0.0.1:5173** y mantener la terminal abierta. Si los servidores ya están iniciados, basta con abrir esa dirección. El backend escucha en 127.0.0.1:3001. Usar 127.0.0.1, sin sustituirlo por localhost, para mantener el origen configurado y las cookies coherentes.

1. Elegir Creá tu cuenta y completar nombre, correo y contraseña de 10 a 128 caracteres. El registro inicia sesión automáticamente y muestra una confirmación.
2. Entrar en Materias, elegir Nueva materia, completar nombre y descripción opcional y guardar.
3. Probar Editar, volver a Inicio y comprobar el conteo. Eliminar sólo una materia de demostración, revisando la confirmación.
4. Cerrar sesión e iniciar sesión nuevamente con las mismas credenciales. Recargar la página para comprobar persistencia.
5. Para probar aislamiento, registrar otra cuenta en una ventana privada/incógnita. No compartirá las materias de la primera.

Las credenciales del seed no se publican. Crear cuentas propias para la demostración. No ejecutar seeds, reset ni db push para probar estas funciones. La [guía manual](docs/prueba-manual-sprint2.md) detalla también validaciones y revisión del menú.

## Entorno y configuración

React 19, TypeScript, Vite 7, Tailwind CSS 4; Node.js, Express 5, Prisma 6.19 y PostgreSQL 17.11. Sesiones persistidas en PostgreSQL mediante express-session y un store Prisma. Se requiere Node 22.12 o superior; verificado con Node 24.15.

En esta computadora las dependencias, PostgreSQL y backend/.env ya están preparados. En un clon nuevo, ejecutar npm ci, preparar PostgreSQL local y copiar backend/.env.example únicamente si todavía no existe backend/.env. No sobrescribir secretos existentes. Los binarios y datos de .local/ no se versionan.

| Variable de backend | Uso                                                                            |
| ------------------- | ------------------------------------------------------------------------------ |
| DATABASE_URL        | Conexión privada a aulasync_dev en loopback; se rechazan otras bases           |
| SESSION_SECRET      | Secreto aleatorio estable, mínimo 32 caracteres; necesario para firmar cookies |
| APP_ORIGIN          | Origen exacto de la interfaz, por defecto http://127.0.0.1:5173                |
| SESSION_TTL_HOURS   | Duración de autenticación, por defecto 8 horas                                 |
| NODE_ENV            | development para esta instalación; production activa cookies Secure            |
| PORT                | 3001; si se cambia, ajustar el proxy de Vite                                   |
| SEED_PASSWORD       | Sólo fixtures locales; no se utiliza para registrar usuarios nuevos            |
| AI_*                | Configuración del proveedor de resúmenes. La instalación local usa Ollama.     |

No agregar secretos a variables VITE_*. El .env privado y .local/ están ignorados por Git; Vite bloquea su publicación y la del backend. La aplicación local no está configurada como despliegue de producción.

## PostgreSQL y migraciones

```powershell
npm run db:local:status
npm run db:validate
npm exec -w backend -- prisma migrate status
npm run db:check
```

Datos en .local/pgdata, únicamente localhost:5432 y autenticación SCRAM. npm run db:local:stop detiene el clúster conservando los datos. No es un servicio Windows y no inicia automáticamente al reiniciar la computadora. Esta instalación no utiliza Docker ni compose.yaml.

Las dos migraciones versionadas ya están aplicadas. La segunda agrega descripcion opcional a Materia y la tabla técnica Sesion, sin cambiar ni borrar las filas académicas existentes. db:check verifica 14 relaciones y restricciones usando fixtures nuevas en transacciones revertidas.

Para una base nueva de desarrollo previamente inspeccionada, db:migrate aplica el historial existente y db:generate genera el cliente. Los cambios futuros del esquema deben tener nuevas migraciones; no modificar las ya aplicadas. db:seed existe para fixtures locales y no se ejecutó durante Sprint 2.

## Pruebas y compilación

```powershell
npm run typecheck
npm run build
npm test
npm run db:check
npm run format:check
```

npm test ejecuta 21 pruebas de interfaz en jsdom y 28 de backend, incluidas pruebas HTTP sobre PostgreSQL real. Requiere que aulasync_dev esté disponible. Crea usuarios con UUID y limpia exclusivamente sus propios IDs; no usa ni reemplaza usuarios existentes. El control de tipos del backend incluye pruebas, seed, verificador relacional y configuración de Vitest; la compilación excluye pruebas y sus auxiliares.

Con npm run dev iniciado en otra terminal:

```powershell
npm run test:smoke
```

El smoke ejecuta 29 pasos HTTP mediante Vite, con dos cuentas temporales y comprobación de conservación de los datos previos. También prueba que las rutas privadas de archivos del servidor de desarrollo respondan 403. No sustituye una revisión visual en navegador.

El frontend compilado queda en frontend/dist y el backend en backend/dist. npm run start -w backend inicia el backend compilado; la publicación del frontend y HTTPS de producción quedan fuera de esta entrega.

## Seguridad y límites verificados

Contraseñas con scrypt asíncrono y sal individual; correo normalizado y único; sesiones PostgreSQL con rotación, vencimiento y cierre; cookie HttpOnly/SameSite y Secure en producción; CSRF en registro, login y operaciones autenticadas; límites independientes de 20 intentos por IP cada 15 minutos en registro y login. El limitador es por proceso y no persiste al reiniciarlo.

La propiedad se obtiene de la sesión y se comprueba en cada operación de materias. El borrado es transaccional: elimina las actividades asociadas por cascada y conserva materiales y resúmenes desvinculando la materia. No se agregaron endpoints de esos módulos.

Pendientes: revisión visual del menú del Sprint 1 y del recorrido actual, validación con los seis PDF académicos ausentes, y cuatro avisos altos de npm en el árbol de Prisma CLI 6 (también reportados por --omit=dev). Se actualizó Vitest a 4.1.12 para retirar los avisos críticos detectados; no se forzó una migración mayor de Prisma. Ver el alcance real de las verificaciones en [validación](docs/validacion.md).

## Organización y documentación

- frontend/src/auth: estado de sesión y peticiones autenticadas.
- frontend/src/pages: acceso, registro, dashboard y materias.
- frontend/src/hooks: navegación accesible y consulta de materias.
- backend/src/auth: hashing, store de sesiones, middleware y endpoints.
- backend/src/materias: validación, autorización y CRUD.
- backend/prisma: esquema, migraciones y comprobación relacional.
- scripts: control del PostgreSQL local y smoke HTTP.

Consultar [API REST](docs/api.md), [decisiones](docs/decisiones.md), [sprints](docs/sprints.md) y [validación](docs/validacion.md).

## Resúmenes con IA local

En **Materiales**, elegí un texto o PDF y pulsá **Generar resumen con IA**. Revisá el borrador y pulsá **Guardar resumen** si querés conservarlo. En **Resúmenes** podés abrirlo con su fecha y material de origen. PostgreSQL permite un resumen por material y las consultas usan el registro guardado.

El backend admite `AI_PROVIDER=ollama` con `AI_BASE_URL=http://127.0.0.1:11435` y `AI_MODEL=qwen2.5:0.5b`. Ollama local no usa clave ni genera cargos por consulta. La descarga del modelo ocupa unos 398 MB. Configurá las variables en `backend/.env`. `AI_API_KEY` solo se utiliza con un proveedor remoto HTTPS compatible, cuyo consumo puede ser facturable.

Con Ollama instalado, ejecutá lo siguiente desde la raíz del proyecto en PowerShell:

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11435'
$env:OLLAMA_MODELS = Join-Path (Get-Location) '.local/ollama-models'
$env:OLLAMA_NO_CLOUD = '1'
ollama serve
```

En otra terminal configurá `$env:OLLAMA_HOST = '127.0.0.1:11435'` y ejecutá `ollama pull qwen2.5:0.5b` para descargar el modelo una vez. Iniciá AulaSync con `npm run dev` con sus puertos de desarrollo libres. El modo `mock` muestra un extracto etiquetado como simulación y está disponible para desarrollo y pruebas.

El procesamiento usa hasta 30 páginas y 8000 caracteres. Los PDF escaneados requieren una capa de texto. La primera generación local puede tardar mientras se carga el modelo.
