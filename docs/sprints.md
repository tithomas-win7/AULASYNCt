# Plan de implementación

| Sprint | Alcance                                                               | Estado                                                                                                                 |
| ------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1      | Estructura y configuración                                            | PostgreSQL y persistencia verificados. Revisión visual del menú pendiente, aceptada por el usuario para avanzar.       |
| 2      | HU-01/02/03: registro, sesiones y materias                            | Implementado y verificado: 49 tests y smoke HTTP de 29 pasos. Revisión visual pendiente; ver límites en validacion.md. |
| 3      | HU-04: tareas, trabajos prácticos y exámenes por materia              | Verificado con 57 pruebas automatizadas, 14 pasos HTTP y 14 comprobaciones relacionales.                               |
| 4      | HU-05: almacenamiento privado y consulta de PDF y texto               | Implementado. Ver evidencia y límites en validacion.md.                                                                |
| 5      | HU-06/07/08: extracción, generación, guardado y consulta de resúmenes | Flujo validado con simulación y Ollama real en modo extractivo.                                                        |
| 6      | Integración, pruebas de negocio, aislamiento y errores                | Pendiente                                                                                                              |
| 7      | Validación académica y preparación de entrega                         | Pendiente                                                                                                              |

## Criterios para Sprint 2

1. Validar el modelo con los documentos académicos cuando estén disponibles.
2. Implementar registro con nombre/email/contraseña validados, email normalizado, hash seguro y unicidad manejada sin filtrar datos sensibles.
3. Implementar login/logout y consulta de sesión con persistencia PostgreSQL, rotación al autenticar, vencimiento e invalidación. Cookies HttpOnly, SameSite y Secure en producción; protección CSRF y límites de intentos.
4. Proteger rutas del frontend y toda operación del backend. Ningún recurso debe aceptar el propietario desde el cuerpo de la solicitud.
5. Implementar CRUD de materias con comprobación de propiedad en lectura, escritura y borrado. Usar la política de borrado documentada.
6. Incorporar formularios accesibles, validación cliente/servidor, carga, errores y confirmación de borrado conectados a operaciones reales.
7. Probar registro, credenciales inválidas, cierre y expiración de sesión, CSRF, duplicados y aislamiento entre dos estudiantes. Ejecutar migraciones y seed en PostgreSQL real.

No avanzar a actividades, archivos ni IA durante Sprint 2.

## Resultado de Sprint 2

- HU-01: registro validado, correo normalizado único, scrypt y confirmación; pruebas de datos inválidos, duplicados y concurrencia.
- HU-02: login/logout, sesión PostgreSQL, rotación y vencimiento, cookies, CSRF y límites de intentos; pruebas de persistencia al recrear aplicación/cliente y rechazo de cookies alteradas.
- HU-03: listado, consulta, creación, edición de nombre/descripción y borrado transaccional de materias propias; aislamiento entre dos estudiantes y conservación de materiales/resúmenes.
- Dashboard conectado al listado real de materias del usuario. Formularios, errores, carga, confirmaciones y rutas privadas probados en jsdom; recorrido HTTP real mediante Vite.
- No se ejecutó seed ni se modificaron los registros existentes del dominio. Sólo se limpiaron fixtures creadas por las pruebas.
- El usuario autorizó explícitamente este sprint con la revisión visual del Sprint 1 pendiente. No se implementaron Sprint 3, 4 ni 5.
- Pendientes transversales: recorrido visual real, seis PDF de referencia y avisos de dependencias de Prisma CLI. No se afirma despliegue productivo verificado.

## Sprint 3 · HU-04

No se encontró el Product Backlog académico en el proyecto. La correspondencia T3.1–T3.6 de esta tabla se adoptó para registrar el trabajo del sprint y queda pendiente de cotejo con el documento original.

| Tarea | Trabajo realizado                                                              | Estado                                    |
| ----- | ------------------------------------------------------------------------------ | ----------------------------------------- |
| T3.1  | Revisar Actividad, TipoActividad, DATE y la clave foránea con cascada          | Implementado                              |
| T3.2  | Registrar actividades con POST por materia propia y validar la entrada con Zod | Implementado                              |
| T3.3  | Consultar con GET por materia propia, en orden fecha e ID                      | Implementado                              |
| T3.4  | Integrar selección de materia, formulario, listado y estados de interfaz       | Implementado                              |
| T3.5  | Ejecutar regresiones, aislamiento, persistencia y comprobaciones relacionales  | Aprobado. Ver [validación](validacion.md) |
| T3.6  | Documentar API, decisiones y pasos de demostración                             | Documentado                               |

La fecha se recibe y devuelve en YYYY-MM-DD y se guarda como DATE. El título admite hasta 200 caracteres después de recortar espacios. El modelo vigente carece de campo estado. Los endpoints y códigos de respuesta están en [API REST](api.md).

## Sprint 4 · HU-05

- Registro y consulta privada de texto y PDF desde Materiales. La materia es opcional y debe ser propia.
- El texto se conserva en `contenido`. El PDF se almacena en `archivoPdf` (BYTEA) junto con sus metadatos, en la misma transacción. La migración agrega una columna nullable y conserva los materiales anteriores.
- La eliminación de una materia desvincula sus materiales. Se reutilizan la sesión, el token CSRF y la clave foránea compuesta de usuario y materia.
- La comprobación de PDF usa el tipo de contenido, el nombre, el tamaño y los marcadores de inicio y cierre. La extracción corresponde al Sprint 5.
- [Contrato REST](api.md) y [evidencia](validacion.md).

## Sprint 5 · HU-06, HU-07 y HU-08

El Product Backlog académico no estaba disponible. La correspondencia T5.1–T5.9 queda pendiente de cotejo.

| Tarea | Trabajo                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------- |
| T5.1  | Verificar Actividades y Materiales, y conservar la relación única Resumen–Material.                           |
| T5.2  | Obtener texto persistido y extraer texto de PDF con PDF.js.                                                   |
| T5.3  | Desacoplar el proveedor. Integrar Ollama local y simulación de desarrollo.                                    |
| T5.4  | Generar borradores en español, con límites de entrada y tiempo y manejo de errores.                           |
| T5.5  | Guardar explícitamente un borrador firmado para la sesión y el material, con restricción única en PostgreSQL. |
| T5.6  | Consultar listado, detalle y resumen por material con autorización por propietario.                           |
| T5.7  | Integrar generación y guardado en Materiales y lectura en Resúmenes.                                          |
| T5.8  | Validar integración, regresiones y generación local. Ver validacion.md.                                       |
| T5.9  | Documentar configuración, límites, API y demostración.                                                        |

El borrador dura 15 minutos y está firmado con HMAC. El guardado conserva la fecha de generación. Se reutiliza la sesión, CSRF y el modelo Prisma existente. Las consultas leen PostgreSQL.

El flujo funcional del Sprint 5 cubre la generación, el guardado y la consulta. En la revisión de **Introducción al Derecho** quedó registrada una incidencia de calidad: el resumen incluye datos editoriales y apartados del índice, con cobertura insuficiente del texto del libro. Su revisión queda para después del cierre funcional.

## Sprint 6 · Integración y estabilización

El Product Backlog original no estaba disponible para cotejar los identificadores. Se trabajó sobre los criterios HU-01 a HU-08 suministrados para el sprint.

- Entorno aislado para pruebas HTTP y verificaciones de relaciones. Las suites exigen credenciales y secreto de sesión específicos.
- Recorrido HTTP integral con dos estudiantes sintéticos. Cubre registro, autenticación, materias, actividades, materiales, generación simulada, guardado y consulta tras recrear la aplicación.
- Validación de apertura de PDF antes del guardado. La regresión cubre archivos vacíos, corruptos, con extensión engañosa y PDF válidos sin texto.
- Revisión de dependencias y estado de validación en [validacion.md](validacion.md).
- La incidencia de calidad de **Introducción al Derecho** se conserva por separado. Los problemas de extracción de texto y la cobertura del resumen requieren verificaciones distintas.
