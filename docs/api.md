# API REST — AulaSync

Base durante el desarrollo: http://127.0.0.1:3001/api. El frontend usa /api a través del proxy de Vite en http://127.0.0.1:5173. Usar ese hostname al demostrar la aplicación, para que coincidan cookies y APP_ORIGIN. Respuestas JSON, excepto operaciones con estado 204.

## Autenticación

| Método y ruta       | Cuerpo                  | Resultado                                                                           |
| ------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| GET /auth/session   | Sin cuerpo              | 200: usuario público o null y csrfToken; prepara una sesión anónima si hace falta   |
| POST /auth/register | nombre, email, password | 201: usuario público, csrfToken nuevo y confirmación; inicia sesión automáticamente |
| POST /auth/login    | email, password         | 200: usuario público, csrfToken nuevo y confirmación                                |
| POST /auth/logout   | Sin cuerpo              | 204: destruye la sesión persistida y elimina la cookie                              |

Todas las operaciones POST requieren la cookie de sesión y X-CSRF-Token. Primero consultar GET /auth/session y conservar la cookie; después enviar el token recibido en esa cabecera. El token cambia al registrar o iniciar sesión y el cliente debe reemplazarlo por el nuevo. El frontend lo mantiene en memoria, sin localStorage.

El usuario público contiene exclusivamente id, nombre y email. Nunca se devuelve passwordHash ni la contraseña. Los datos de entrada admitidos son estrictos: no se acepta usuarioId del cliente.

Validaciones: nombre de 2 a 100 caracteres tras trim; correo válido, trim y minúsculas, hasta 254 caracteres; contraseña de 10 a 128 caracteres en el registro, sin recortarla ni cambiar sus caracteres. El inicio de sesión admite contraseñas existentes de hasta 128 caracteres. La unicidad del correo está protegida por PostgreSQL después de normalizarlo en el backend. Los correos preexistentes ya estaban normalizados al inspeccionar la base.

## Materias privadas

| Método y ruta        | Cuerpo                       | Resultado                                            |
| -------------------- | ---------------------------- | ---------------------------------------------------- |
| GET /materias        | Sin cuerpo                   | 200: materias propias, de más reciente a más antigua |
| GET /materias/:id    | Sin cuerpo                   | 200: una materia propia                              |
| POST /materias       | nombre, descripcion opcional | 201: materia creada para el usuario de la sesión     |
| PATCH /materias/:id  | nombre y/o descripcion       | 200: materia actualizada                             |
| DELETE /materias/:id | Sin cuerpo                   | 204: materia eliminada                               |

Cada materia devuelta contiene id, nombre, descripcion, creadoEn y actualizadoEn. El nombre se recorta y admite de 1 a 120 caracteres. La descripción se recorta y admite hasta 1000 caracteres; null o una cadena vacía la eliminan. Un PATCH de nombre conserva la descripción previa. No se acepta un PATCH vacío ni campos ajenos al contrato.

Las operaciones de escritura requieren X-CSRF-Token. Los identificadores deben ser UUID. La propiedad se comprueba en cada lectura, actualización y borrado del backend. Una materia ajena y una inexistente producen el mismo 404.

El borrado bloquea la fila de la materia y ejecuta una transacción: desvincula sus materiales, conserva los resúmenes de esos materiales y elimina la materia junto con sus actividades por la cascada existente. Esto respeta las relaciones del Sprint 1; la gestión de materiales y resúmenes sigue pendiente.

## Seguridad y sesión

- Sesiones en la tabla técnica Sesion de PostgreSQL; la cookie sólo contiene un identificador firmado. El secreto está en SESSION_SECRET, excluido del repositorio.
- Cookie aulasync.sid en desarrollo, con HttpOnly, SameSite=Lax y Path=/. NODE_ENV=production activa Secure y el nombre __Host-aulasync.sid. El desarrollo local usa HTTP y no activa Secure. Un despliegue real requerirá HTTPS y configuración explícita del proxy de confianza; no se realizó ese despliegue.
- SESSION_TTL_HOURS vale 8 por defecto. El backend comprueba expiración de almacenamiento y duración absoluta de la autenticación. Login y registro rotan identificador y token; logout elimina la sesión del servidor.
- CSRF se compara con el token de la sesión; también se rechazan Origin distinto de APP_ORIGIN y Sec-Fetch-Site=cross-site en operaciones mutantes. No se habilitó CORS abierto.
- Registro e inicio de sesión tienen límites independientes de 20 intentos por IP cada 15 minutos. Respuesta 429 con Retry-After. El contador es en memoria del proceso y se reinicia al reiniciar el backend; es protección básica para esta instancia local, no un limitador distribuido.
- Las contraseñas nuevas usan scrypt asíncrono con N=32768, r=8, p=1, sal aleatoria de 16 bytes y clave de 64 bytes. La comparación es constante y sigue admitiendo el formato scrypt del seed anterior.
- Respuestas de sesión y recursos privados llevan Cache-Control=no-store. Las claves, hashes, cookies y tokens no se imprimen en logs de aplicación.

## Errores

| Estado | Significado                                                           |
| ------ | --------------------------------------------------------------------- |
| 400    | Datos inválidos, campos no admitidos, UUID inválido o JSON incorrecto |
| 401    | Sin autenticación, sesión vencida o credenciales incorrectas          |
| 403    | CSRF inválido o procedencia rechazada                                 |
| 404    | Recurso propio no encontrado o endpoint fuera del alcance             |
| 409    | Correo duplicado                                                      |
| 413    | Cuerpo superior a 32 KiB                                              |
| 429    | Límite de intentos alcanzado                                          |
| 500    | Error interno; se muestra un mensaje genérico                         |

Los errores contienen error y, para validaciones, fields por nombre del campo. No incluyen detalles internos de Prisma. Un GET /health sólo comprueba liveness; la conexión real a PostgreSQL se verifica con las pruebas y db:check.

## Actividades de una materia (HU-04)

| Método y ruta                             | Resultado                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| GET /api/materias/:materiaId/actividades  | 200 con { actividades }, ordenadas por fecha ascendente e ID ascendente. |
| POST /api/materias/:materiaId/actividades | 201 con { actividad }. Requiere X-CSRF-Token.                            |

Ambas operaciones requieren sesión y una materia propia. El POST acepta titulo, tipo y fecha. El título se recorta y admite de 1 a 200 caracteres. Tipo admite TAREA, TRABAJO_PRACTICO y EXAMEN. Fecha admite días válidos de calendario en YYYY-MM-DD, con años 0001 a 9999 y fechas pasadas o futuras. PostgreSQL almacena DATE y el API devuelve YYYY-MM-DD. Cada actividad incluye id, titulo, tipo, fecha y materiaId.

Un UUID mal formado, campos extra como usuarioId o materiaId en el cuerpo, y datos inválidos devuelven 400. Una sesión ausente devuelve 401. Un POST con CSRF inválido devuelve 403. Una materia ajena o inexistente devuelve el mismo 404. La asociación usa la clave compuesta de la materia y el usuario de sesión.

El esquema inicial ya contiene Actividad y la clave foránea obligatoria con ON DELETE CASCADE. HU-04 reutiliza ese esquema, que carece de campo estado.

## Materiales · HU-05

Todos los endpoints requieren sesión. Los POST requieren token CSRF.

| Método y ruta                 | Entrada                                                                                                 | Resultado                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `GET /api/materiales`         | —                                                                                                       | `200`, listado de metadatos propios  |
| `POST /api/materiales`        | JSON con `titulo`, `contenido` y `materiaId` opcional                                                   | `201`, material de texto             |
| `POST /api/materiales/pdf`    | Cuerpo binario `application/pdf`. Parámetros `titulo`, `nombreArchivo` y `materiaId` opcional en la URL | `201`, metadatos del PDF             |
| `GET /api/materiales/:id`     | UUID del material                                                                                       | `200`, metadatos y contenido textual |
| `GET /api/materiales/:id/pdf` | UUID del material                                                                                       | `200`, PDF como archivo adjunto      |

Título de 1 a 200 caracteres, texto de 1 a 4000 caracteres y PDF de hasta 5 MiB con nombre de hasta 200 caracteres terminado en .pdf. El servidor comprueba el encabezado y el marcador final del PDF. Los archivos se sirven como adjuntos y las respuestas de la API llevan `Cache-Control: no-store`.

Las entradas inválidas devuelven `400`, la falta de sesión `401`, el rechazo CSRF `403`, un recurso ajeno o inexistente `404`, el exceso de tamaño `413` y un tipo de contenido incompatible para PDF `415`. La identidad se obtiene de la sesión. Al eliminar una materia, sus materiales siguen disponibles sin asociación.

## Resúmenes · HU-06 a HU-08

| Método y ruta                                      | Resultado                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `POST /api/materiales/:materialId/resumen/generar` | Borrador firmado, contenido, fecha e indicador de simulación.       |
| `POST /api/materiales/:materialId/resumen`         | Guarda el resumen mediante el campo JSON `borrador`. Devuelve 201.  |
| `GET /api/resumenes`                               | Lista resúmenes guardados propios con datos del material de origen. |
| `GET /api/resumenes/:id`                           | Consulta el contenido completo de un resumen propio.                |
| `GET /api/materiales/:materialId/resumen`          | Consulta el resumen guardado del material propio.                   |

Todas las rutas requieren sesión y las escrituras requieren CSRF. Una referencia ajena o inexistente devuelve 404. Un resumen guardado o una generación en curso devuelven 409. Un material sin texto procesable devuelve 422. Fallos del proveedor devuelven 502 y un tiempo de espera agotado devuelve 504. La consulta posterior no invoca al proveedor.
