# Validación de AulaSync

**Estado actual:** Sprint 5 validado con proveedor simulado y con Ollama real en modo extractivo. Las secciones anteriores conservan el historial.

Verificación local del 6 de noviembre de 2026, Windows, Node 24.15.0 y npm 11.12.1. La primera tabla conserva el resultado de la entrega inicial; la revalidación de cierre se registra más abajo.

| Comprobación                  | Resultado                                                              |
| ----------------------------- | ---------------------------------------------------------------------- |
| Instalación npm y lockfile    | Correcta; 340 paquetes iniciales                                       |
| TypeScript frontend y backend | Correcto                                                               |
| Compilación Vite y backend    | Correcta                                                               |
| Pruebas frontend              | 3 aprobadas: navegación, error/reintento y ruta desconocida            |
| Pruebas backend               | 4 aprobadas: health, rutas pendientes, errores JSON/límite y entorno   |
| Prisma validate               | Esquema válido                                                         |
| Prisma generate               | Cliente 6.19.0 generado                                                |
| Migración inicial             | SQL generado desde esquema con `migrate diff --from-empty`             |
| Seed                          | Tipos verificados contra el cliente Prisma; sin ejecutar en PostgreSQL |
| Arranque `npm run dev`        | Frontend y backend iniciados                                           |
| HTTP directo y proxy Vite     | `/api/health` responde JSON correcto en ambos puertos                  |
| Ruta directa `/materias`      | HTTP 200 con página base de Vite                                       |

La instalación y descarga del motor Prisma requirieron acceso de red fuera del sandbox. El sandbox también impidió que esbuild resolviera la configuración e hizo fallar `tsx` al consultar el usuario del sistema; compilación, pruebas y arranque se ejecutaron correctamente fuera de esa restricción.

## Límites de la verificación

No se encontraron los comandos `docker` ni `psql` en PATH. No se aplicó la migración ni se ejecutó el seed contra PostgreSQL. Queda pendiente verificar esas operaciones y las restricciones relacionales sobre una base real siguiendo el README.

La herramienta de navegador informó que el uso local está deshabilitado en la configuración de Work. Por eso no se realizó revisión visual ni interacción manual en navegador, incluida la vista móvil y navegación por teclado. Las pruebas de React utilizan jsdom, que no verifica el layout de CSS.

Las pruebas cubren el alcance de Sprint 1. No validan autenticación, CRUD, aislamiento de endpoints de negocio, PDF o IA porque esas funciones todavía no están implementadas.

## Revalidación para cierre del Sprint 1

Estado de esa etapa, antes de preparar PostgreSQL: **Sprint 1 todavía no cerrado**. No se inició el Sprint 2. Todos los cambios se hicieron dentro de la carpeta existente del proyecto. No se instalaron dependencias ni servicios, no se modificaron credenciales y no se ejecutaron operaciones de escritura en bases de datos.

| Comprobación ejecutada                   | Resultado real                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Compilación inicial antes de los cambios | Frontend y backend correctos                                                                                                           |
| Pruebas iniciales antes de los cambios   | 7 aprobadas: 3 frontend y 4 backend                                                                                                    |
| Compilación final `npm run build`        | Frontend Vite y backend TypeScript correctos                                                                                           |
| Control final `npm run typecheck`        | Correcto en ambos proyectos; backend incluye código, pruebas y seed                                                                    |
| Archivos incluidos por TypeScript        | Confirmados `src/app.test.ts` y `prisma/seed.ts` mediante `--listFilesOnly`                                                            |
| Pruebas finales `npm test`               | 12 aprobadas: 8 frontend y 4 backend                                                                                                   |
| `npm run db:validate`                    | Prisma confirmó que el esquema es válido                                                                                               |
| Comparación de migración con esquema     | SQL existente idéntico al generado en memoria por `prisma migrate diff --from-empty`; sin consultar PostgreSQL ni escribir migraciones |
| Conexión TCP al destino configurado      | Entorno `development`, host local, puerto 5432: `ECONNREFUSED`                                                                         |
| Herramientas y servicios PostgreSQL      | No detectados en PATH, servicios/procesos consultados, registro de aplicaciones ni directorios habituales                              |
| Docker                                   | No detectado en PATH ni en el registro de aplicaciones consultado                                                                      |
| Migraciones sobre PostgreSQL             | No ejecutadas: no hay servidor accesible                                                                                               |
| Seed                                     | No ejecutado: no se pudo inspeccionar una base para comprobar que esté vacía y sea de desarrollo                                       |
| Navegador real                           | No disponible: la herramienta volvió a informar que el navegador local está deshabilitado en Work                                      |

La compilación y las pruebas se ejecutaron fuera del sandbox por las restricciones de esbuild identificadas anteriormente. No se instalaron dependencias adicionales.

### Correcciones realizadas

- El menú móvil cerrado tiene `hidden` e `inert`, con una regla CSS explícita para que su estilo no invalide el ocultamiento.
- Al abrirlo se presenta como diálogo modal con nombre accesible, foco inicial en el cierre, ciclo de Tab/Shift+Tab, Escape y restauración del foco. El contenido de fondo queda inerte y se bloquea el scroll mientras está abierto.
- El cierre por selección de sección y los cambios de tamaño móvil/escritorio mantienen el foco en elementos disponibles.
- Cinco pruebas nuevas comprueban esos comportamientos. Son pruebas jsdom: no certifican comportamiento de CSS, lectores de pantalla ni el motor nativo de `inert` de un navegador.
- `backend/tsconfig.typecheck.json` incluye `src/**/*.ts` y `prisma/**/*.ts`, sin heredar la exclusión de pruebas de la compilación. El script `typecheck` usa esta configuración; `build` conserva la salida de producción sin tests ni seed.
- Vitest restaura los globals sustituidos entre pruebas mediante `unstubGlobals`.

El patrón de teclado del menú sigue el [patrón de diálogo modal de WAI-ARIA](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). La primera ejecución de las pruebas nuevas detectó una diferencia entre el nombre accesible de la marca y su texto visual; se explicitó el nombre `AulaSync` y la suite final pasó completa.

### Relaciones revisadas y pendiente de ejecución real

Se revisaron Usuario→Materia, Usuario→Material, Materia→Actividad, la materia opcional del material y el resumen único por material. El SQL contiene las claves foráneas, índices y unicidad definidos en Prisma, incluida la FK compuesta que impide asociaciones entre propietarios distintos. Esto comprueba consistencia estática, no ejecución de las restricciones en PostgreSQL.

Cuando exista una base local nueva y comprobada, falta verificar:

1. Conexión autenticada e identidad del servidor/base, sin exponer credenciales.
2. Ausencia de tablas o datos importantes antes de aplicar la migración y de ejecutar el seed. Si ya hay datos ajenos o su origen no es claro, detenerse y pedir autorización.
3. Aplicación de la migración existente con `prisma migrate deploy`, sin `reset`, sin `db push` y sin cambiar credenciales.
4. Ejecución del seed y comprobación de sus cinco entidades; comprobar que una segunda ejecución no duplica fixtures.
5. Rechazo de email duplicado, claves foráneas inexistentes, materia de otro propietario y segundo resumen para el mismo material; aceptación de material sin materia.
6. Comportamiento de cascadas y bloqueo `NoAction`. Usar únicamente fixtures nuevas dentro de una transacción revertida o una base de pruebas nueva; nunca borrar registros existentes.
7. Revisión real en navegador: menú cerrado sin enlaces en Tab, foco inicial, Tab/Shift+Tab, Escape, retorno de foco, cambio de tamaño y lectura del diálogo con tecnología asistiva.

### PostgreSQL: decisión anterior de autorización (resuelta en la siguiente sección)

Para respetar el trabajo exclusivo en la carpeta del proyecto, se propone descargar los binarios oficiales de PostgreSQL 17 en una subcarpeta local, inicializar un clúster nuevo exclusivamente de desarrollo y ejecutarlo en localhost, sin registrar un servicio Windows ni modificar PATH global. PostgreSQL ofrece [binarios ZIP para Windows a través de EDB](https://www.postgresql.org/download/windows/).

No se descargó ni inicializó ese entorno. Hace falta autorización antes de prepararlo. Si se prefiere una instalación como servicio del sistema, requiere autorización específica adicional. Los directorios exactos, el puerto libre y la ausencia de datos se comprobarán antes de inicializar; no se sobrescribirá ningún directorio existente.

## Verificación real con PostgreSQL 17 — 6 de noviembre de 2026

El usuario autorizó preparar PostgreSQL únicamente dentro del proyecto. Se configuró un clúster nuevo, sin instalar un servicio Windows, modificar PATH global, cambiar firewall ni intervenir en otras bases. El Sprint 2 no se inició.

### Origen e integridad

- Publicación: [binarios Windows enlazados por PostgreSQL](https://www.postgresql.org/download/windows/) y [página de EDB](https://www.enterprisedb.com/download-postgresql-binaries).
- Archivo: [postgresql-17.11-5-windows-x64-binaries.zip](https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip), descargado por HTTPS.
- Tamaño recibido: 381531864 bytes.
- SHA-256 publicado por EDB: [checksum oficial](https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip.sha256).
- SHA-256 del ZIP local, coincidente: 80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f.
- Se comprobaron las rutas de las 22033 entradas del ZIP antes de extraerlo. El binario informó PostgreSQL 17.11. No tiene firma Authenticode; la integridad se contrastó con el SHA-256 publicado por el distribuidor oficial.

### Ubicación y credenciales

| Elemento                           | Ubicación o configuración                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Binarios                           | .local/postgresql/pgsql/                                                                 |
| Clúster y datos                    | .local/pgdata/                                                                           |
| ZIP y checksum                     | .local/downloads/                                                                        |
| Logs privados                      | .local/initdb.log y .local/postgres-startup.log                                          |
| Base creada                        | aulasync_dev                                                                             |
| Usuario del backend                | aulasync_app, sin superusuario, creación de bases ni creación de roles                   |
| Conexión de la aplicación          | DATABASE_URL en backend/.env                                                             |
| Credencial de fixture              | SEED_PASSWORD en backend/.env; el seed usa scrypt y ya no incluye una contraseña literal |
| Administración del clúster         | Variables en .local/postgres.env                                                         |
| Configuración anterior del backend | Copia privada en .local/backend.env.before-postgres                                      |

Las contraseñas nuevas se generaron aleatoriamente y no se mostraron. Tanto backend/.env como .local/ están excluidos de Git; .local/ también está excluido de Prettier. Una inspección del código y de la documentación no encontró los valores privados generados. No se alteraron credenciales de roles o bases preexistentes.

### Resultados ejecutados

| Comprobación                                  | Resultado real                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Identidad del servidor antes de crear la base | data_directory dentro de .local/pgdata del proyecto                                                |
| Base y rol anteriores                         | aulasync_dev y aulasync_app no existían en el clúster nuevo                                        |
| Base antes de migrar                          | 0 tablas de usuario, comprobado con SQL y nuevamente mediante Prisma                               |
| Migración                                     | 20261106000000_init aplicada con prisma migrate deploy                                             |
| Tablas                                        | Usuario, Materia, Actividad, Material, Resumen y tabla técnica _prisma_migrations                  |
| Estado posterior                              | prisma migrate status: Database schema is up to date                                               |
| Antes del seed                                | Las cinco tablas de dominio existían y tenían 0 registros                                          |
| Seed, primera ejecución                       | 1 usuario, 1 materia, 1 actividad, 1 material y 1 resumen                                          |
| Seed, segunda ejecución                       | Mismos conteos; idempotencia confirmada                                                            |
| Relaciones con Prisma                         | 14 comprobaciones aprobadas usando el usuario de aplicación                                        |
| Preservación durante pruebas                  | Todas las fixtures relacionales se revirtieron; los cinco conteos permanecieron en 1               |
| Reinicio                                      | Detención y arranque del clúster local correctos; datos conservados y conexión Prisma restablecida |
| Escucha SQL                                   | listen_addresses=localhost, puerto 5432                                                            |
| Escucha del sistema                           | netstat confirmó únicamente 127.0.0.1:5432 y [::1]:5432 como listeners de PostgreSQL               |
| Autenticación                                 | SCRAM-SHA-256; una contraseña intencionalmente incorrecta fue rechazada                            |
| Checksums de páginas                          | data_checksums=on                                                                                  |
| Compilación                                   | npm run build correcto para frontend y backend                                                     |
| Pruebas de aplicación                         | npm test: 12 aprobadas, 8 frontend y 4 backend                                                     |
| Tipos                                         | npm run typecheck correcto, incluyendo pruebas, seed y verificador relacional                      |

Las 14 comprobaciones relacionales cubren: lectura de las cinco entidades relacionadas, material sin materia, email único, un solo resumen por material, rechazo de una materia de otro propietario, las claves foráneas inexistentes de todas las relaciones, bloqueo NoAction, cascada de material a resumen, borrado de materia después de desvincular materiales y cascadas desde usuario. Los borrados de prueba afectaron exclusivamente fixtures nuevas dentro de transacciones revertidas.

Los rechazos de autenticación y de restricciones eran resultados esperados de pruebas negativas, no fallos de la instalación. El comando de arranque se ajustó para que el servidor no retenga las tuberías de salida de la terminal; su funcionamiento se verificó con el ciclo de detención y arranque.

### Reproducción sin reinstalar

Desde la raíz del proyecto:

```powershell
npm run db:local:start
npm run db:local:status
npm run db:check
npm run typecheck
npm run build
npm test
npm run format:check
```

Para detener sólo este clúster conservando los datos: npm run db:local:stop. No es un servicio Windows y no arranca automáticamente al iniciar sesión. Se dejó iniciado al finalizar la verificación.

El verificador db:check se encuentra en backend/prisma/verify-relations.ts. Exige NODE_ENV=development, host local, base aulasync_dev y rol de aplicación sin superusuario. No cambia el esquema ni deja fixtures persistentes. Las pruebas Vitest continúan siendo independientes de PostgreSQL.

### Cierre del Sprint 1

La instalación portable, la migración, el seed y la conexión del backend mediante Prisma quedaron verificados contra PostgreSQL real. No se atribuye acceso a datos al frontend: las historias de usuario siguen pendientes y /api/health continúa siendo sólo liveness.

**Pendiente para el cierre completo:** revisión visual y manual del menú móvil y su accesibilidad en navegador real. La herramienta volvió a informar que el navegador local está deshabilitado en Work. Las pruebas jsdom no sustituyen esa comprobación. No se comenzó el Sprint 2.

## Sprint 2 — HU-01, HU-02 y HU-03

El usuario autorizó avanzar dejando registrada la revisión visual del menú del Sprint 1. Se trabajó en la carpeta existente y exclusivamente sobre aulasync_dev local. No se ejecutó ningún seed ni reset. Los seis PDF académicos continúan ausentes; las decisiones se basan en los requisitos explícitos y se documentan para su validación posterior.

### Implementación y cambios de datos

- Registro con Zod en backend y frontend, nombre/correo/contraseña, email recortado y en minúsculas, unicidad de PostgreSQL y confirmación. Scrypt asíncrono con sal individual; la respuesta nunca incluye passwordHash.
- Inicio y cierre de sesión, almacenamiento PostgreSQL, rotación de SID y CSRF, vencimiento del registro y de la autenticación, cookies HttpOnly/SameSite y Secure en el caso HTTPS de producción simulado por la prueba. No se utilizó MemoryStore para sesiones.
- Protección CSRF en registro, login y todas las escrituras privadas. Comprobación de Origin y Sec-Fetch-Site, límites independientes de 20 intentos por IP/15 minutos y respuestas genéricas para credenciales incorrectas.
- CRUD de materias con propiedad obtenida de la sesión, descripción opcional y borrado transaccional. El borrado desvincula materiales y conserva sus resúmenes; las actividades de esa materia se eliminan por la relación existente.
- Formularios y rutas privadas, dashboard con cantidad y últimas materias reales, carga, errores, confirmaciones y diseño responsive coherente con la interfaz anterior. Actividades, materiales e IA siguen siendo secciones informativas, sin endpoints de negocio nuevos.
- Migración aditiva 20261106010000_sprint2_sesiones_materias: agrega Materia.descripcion nullable y la tabla técnica Sesion con índice de expiración. Las cinco entidades académicas y sus relaciones permanecen.

SESSION_SECRET se generó en el .env privado sólo porque estaba vacío y se mantuvo estable durante las verificaciones. APP_ORIGIN y duración de sesión quedaron configurados para esta instalación. Se confirmó que no hay valores privados del .env en el código o documentación inspeccionados. Vite bloquea .local/, el backend y archivos de entorno incluso mediante rutas /@fs/.

### Resultados reales de ejecución

| Verificación                    | Resultado                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Inspección previa de PostgreSQL | aulasync_dev, usuario aulasync_app; un registro por entidad académica y correos existentes normalizados           |
| Migración                       | Aplicada correctamente con Prisma; no contiene UPDATE, DELETE, DROP ni reset                                      |
| npm run typecheck               | Correcto en frontend y backend; incluye tests, seed, verificador y configuración Vitest                           |
| npm run build                   | Frontend Vite y backend TypeScript compilaron correctamente                                                       |
| npm test, frontend              | 21 pruebas aprobadas en 4 archivos                                                                                |
| npm test, backend               | 28 pruebas aprobadas en 3 archivos, con PostgreSQL real                                                           |
| npm run test:smoke              | 29 pasos HTTP aprobados a través de Vite                                                                          |
| npm run db:validate             | Esquema válido                                                                                                    |
| npm run db:check                | 14 comprobaciones relacionales aprobadas; fixtures revertidas y conteos conservados                               |
| Preservación del dominio        | Se compararon por ID todos los campos originales con la referencia privada tomada antes de la migración; intactos |
| Seeds durante Sprint 2          | Ninguno                                                                                                           |
| Servidores locales              | API 3001 y frontend 5173 respondieron HTTP 200 al finalizar las comprobaciones                                    |

La compilación mostró dos advertencias de Rollup sobre comentarios de anotación de Zod. Rollup retiró esos comentarios y completó la compilación; no fueron errores de tipos ni de ejecución.

Las pruebas de integración crean cuentas temporales identificadas por UUID y limpian únicamente los IDs que crearon. El smoke genera dos correos temporales que comprobó que no existían, limpia exclusivamente esas cuentas/SIDs y compara las cinco colecciones antes y después. No borra ni cambia registros previos. Las pruebas de relaciones usan exclusivamente transacciones revertidas para sus fixtures.

### Cobertura verificada

Backend: registro correcto e inválido, email normalizado duplicado y registro concurrente; hashes distintos por sal y compatibilidad con el formato del seed; login/logout, credenciales incorrectas, revocación de cookie y acceso sin autenticación; CRUD, UUID y campos inválidos, PATCH parcial y rechazo de propietario inyectado; lectura/modificación/borrado ajenos; CSRF ausente, incorrecto, anterior a autenticación y de otro usuario, orígenes ajenos; límites de login y registro; cookies alteradas; vencimientos; conservación de materiales/resúmenes al borrar materia. La persistencia se probó recreando aplicación, store y cliente Prisma con la misma cookie y secreto.

Frontend: rutas privadas, registro y validación, duplicados, errores de acceso, logout y sesión expirada; datos del dashboard, creación/edición/eliminación con confirmación, errores de consulta/guardado y reintentos; cinco pruebas del menú móvil. Estas pruebas usan jsdom y mocks explícitos de fetch; no equivalen a un navegador real.

Smoke: el cliente HTTP real recorrió registro, login/logout, restauración de sesión por cookie, CRUD, CSRF e aislamiento entre dos estudiantes mediante el proxy de Vite; confirmó 403 para archivos privados y 200 para las rutas SPA. No ejecuta el renderizado de React en un navegador.

### Dependencias y avisos pendientes

Se actualizó Vitest a 4.1.12, compatible con Node/Vite utilizados, retirando los avisos críticos inicialmente detectados en la herramienta de pruebas. Se mantuvo Prisma/Prisma Client 6.19.0.

npm audit y npm audit --omit=dev siguen reportando cuatro avisos altos en Prisma, @prisma/config, deepmerge-ts y effect; no hay avisos críticos en ese resultado. Los dos avisos de base corresponden a [deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) y [effect](https://github.com/advisories/GHSA-38f7-945m-qr2g); el resto se propaga por sus dependencias. Los ajustes auxiliares probados no resolvieron ese árbol y se retiraron: no se dejaron overrides que aparenten corregirlo. No se ejecutó audit fix --force ni se cambió a Prisma 7. La auditoría de dependencias queda pendiente y su comando termina con código 1; no se informa como aprobada ni como cero vulnerabilidades de producción.

El despliegue de producción, HTTPS real y un limitador distribuido no se implementaron ni verificaron. El límite actual es por proceso. Las pruebas comprueban la bandera Secure mediante una instancia de prueba con proxy TLS simulado; no prueban una instalación HTTPS real.

### Pendientes y demostración

La revisión visual del menú del Sprint 1 y el recorrido manual de las pantallas nuevas siguen pendientes. El usuario autorizó expresamente continuar pese a esa limitación; no se presenta como revisión realizada. También queda validar el modelo con los seis PDF cuando se incorporen y resolver los avisos de dependencias antes de considerar un despliegue productivo.

La aplicación quedó disponible en http://127.0.0.1:5173. Después de reiniciar la computadora: npm run db:local:start y npm run dev. Consultar [guía de demostración](prueba-manual-sprint2.md), [API REST](api.md) y README. No se implementó el Sprint 3 ni funcionalidades de materiales o inteligencia artificial.

## Sprint 3 · HU-04 · 12 de noviembre de 2026

HU-04 registra tareas, trabajos prácticos y exámenes en materias propias y permite consultar el listado por materia. La interfaz usa el selector de materias de la sesión y muestra título, tipo y fecha. Al guardar bloquea el botón y los controles, confirma y vuelve a consultar. Usa etiquetas asociadas, mensajes accesibles y estados de carga, error y lista vacía.

| Comprobación       | Resultado                                                                                                                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inspección inicial | PostgreSQL, API y Vite escuchaban. La API del Sprint 2 respondía por el proxy.                                                                                                                                                                                                         |
| Compilación        | npm run build aprobado en frontend y backend. Rollup emitió las advertencias previas por anotaciones en comentarios de Zod.                                                                                                                                                            |
| Tipos              | npm run typecheck aprobado.                                                                                                                                                                                                                                                            |
| Prisma             | npm run db:validate aprobado. migrate status confirmó dos migraciones aplicadas y esquema actualizado.                                                                                                                                                                                 |
| Backend            | 32 de 32 aprobadas, incluidas 4 de HU-04. Se ejecutó con npm test.                                                                                                                                                                                                                     |
| Frontend           | 25 de 25 aprobadas, incluidas 4 de HU-04. Se ejecutó con npm test -w frontend -- --configLoader native.                                                                                                                                                                                |
| Integración HTTP   | 14 pasos aprobados con node scripts/smoke-sprint3.mjs. Dos cuentas y dos materias, creación propia, 404 al acceder a la materia ajena y lectura idéntica tras reiniciar el proceso.                                                                                                    |
| Integridad         | 14 comprobaciones aprobadas con node prisma/verify-relations.ts desde backend. Actividad requiere materia existente y el borrado de la materia elimina sus actividades por cascada.                                                                                                    |
| Preservación       | El smoke comparó los registros antes y después de limpiar exclusivamente sus cuentas, materias, actividades y sesiones temporales. Las comprobaciones relacionales se revirtieron. Conteos finales por entidad académica: 2 usuarios, 2 materias, 1 actividad, 1 material y 1 resumen. |
| Vista local        | El puerto 5174 respondió 200 para la página y su JS, y 401 para la API de actividades sin sesión.                                                                                                                                                                                      |

La primera corrida de frontend detectó una expectativa obsoleta de la pantalla futura. Se corrigió y se repitió la suite. El cargador nativo resolvió un acceso denegado de esbuild al intentar leer directorios superiores en una de las corridas. El control de tipos también detectó el parámetro de Express sin tipo explícito y pasó después de corregirlo.

### Decisiones y límites

- El modelo Actividad ya cuenta con UUID, título de 200 caracteres, TipoActividad, DATE, materia obligatoria y cascada. No se necesitó migración ni se ejecutaron seeds.
- GET y POST /api/materias/:materiaId/actividades reutilizan la sesión existente. POST conserva CSRF y enlaza por la clave compuesta de materia y propietario autenticado. GET filtra por propietario y ordena por fecha ascendente e ID ascendente. Una materia ajena y una inexistente tienen el mismo 404.
- El API valida YYYY-MM-DD, permite pasado y futuro, escribe el día a medianoche UTC y serializa sólo el día. El formulario presenta DD/MM/YYYY mediante un elemento time con el valor ISO original. El esquema vigente carece de estado.
- El dashboard conserva sus datos de materias. La sección Actividades muestra los datos reales de la materia seleccionada.
- T3.1–T3.6 se detallan en [sprints](sprints.md). La numeración usa una correspondencia propuesta porque el Product Backlog no estaba disponible.
- La política de ejecución rechazó detener el backend anterior del puerto 3001. Se inició una vista local alternativa en 127.0.0.1:5174 con el frontend compilado y la API actual en el mismo origen. El recorrido visual manual en navegador y los avisos previos de Prisma CLI siguen pendientes.
- Para demostrar HU-04, abrir http://127.0.0.1:5174/actividades, iniciar sesión y crear una materia propia si todavía no hay ninguna. Elegirla en Actividades, completar título, tipo y fecha, y pulsar Guardar actividad. Cambiar de materia para consultar sus actividades. Después de reiniciar el equipo, el flujo habitual es npm run db:local:start y npm run dev desde el proyecto, con los puertos de desarrollo libres, y luego http://127.0.0.1:5173/actividades.

### Revisión visual de Actividades

Se revisó la compilación del Sprint 3 en el navegador integrado con una cuenta temporal. En escritorio (1280 × 900) se verificaron la navegación lateral, el formulario y la tarjeta con título, tipo, materia y fecha. En móvil (390 × 844) se verificaron el ancho sin desplazamiento horizontal, la validación al enviar campos vacíos y el estado vacío al cambiar a una segunda materia. Enter abrió el menú y Escape lo cerró devolviendo el foco al botón. Se cerró la sesión, se restauró el tamaño del navegador y se eliminó la cuenta temporal con sus datos asociados.

## Sprint 4 · HU-05 · 2026-11-12

- PostgreSQL local respondió en `127.0.0.1:5432`. Se aplicó `20261112000000_material_pdf` en `aulasync_dev`, que agrega únicamente `Material.archivoPdf` como BYTEA nullable. `prisma validate` aprobó y `prisma migrate status` confirmó las tres migraciones al día.
- Se comprobaron 34 pruebas de backend y 28 de frontend, 62 en total, incluidas las regresiones de HU-01 a HU-04. En este entorno se usó `npm test -w backend -- --configLoader native --maxWorkers 2` y el equivalente para frontend.
- La integración con PostgreSQL comprobó escritura y recuperación de texto y PDF, aislamiento con dos estudiantes, rechazo de materias ajenas o inexistentes, sesión y CSRF, validación de tipo y tamaño y conservación del material al borrar su materia.
- Pasaron 12 comprobaciones HTTP contra la compilación local en el puerto 5175. Se recuperaron exactamente los bytes del PDF cargado. El segundo estudiante recibió 404 al intentar descargarlo y su listado quedó vacío.
- Pasaron 14 comprobaciones relacionales. Al terminar se constataron 2 usuarios, 2 materias, 1 actividad, 1 material y 1 resumen, los mismos conteos registrados antes del recorrido HTTP. Se limpiaron únicamente los registros temporales. No se ejecutó seed.
- Compilación de ambos workspaces y comprobación de tipos aprobadas. La carga nativa de configuración evitó un error de acceso del cargador de Vitest. Para generar Prisma se usó una copia local del motor de la misma versión porque procesos anteriores mantenían abierta la DLL original.
- Antes de la prueba manual del usuario, la interfaz se probó con jsdom y el servidor compilado mediante HTTP. La validación de PDF comprueba marcadores y límites, y no analiza la estructura interna ni extrae el contenido.

### Prueba manual del usuario

El 12 de noviembre de 2026, el usuario confirmó que pudo usar la sección Materiales desde el navegador en el puerto 5175. La confirmación cubre el recorrido indicado para guardar y consultar texto y PDF. Queda pendiente una revisión visual específica en distintos tamaños de pantalla.

## Sprint 5 · 12 de noviembre de 2026

- Antes de modificar el código se revisaron HU-04 y HU-05. Se repitieron 12 comprobaciones HTTP de Materiales, con descarga idéntica y aislamiento entre estudiantes.
- Pasaron 37 pruebas de backend y 29 de frontend, 66 en total. El proveedor se simuló en las pruebas automatizadas. Se verificaron extracción del PDF, texto persistido, errores y timeout, borradores firmados, guardado concurrente, consulta tras recrear el backend y aislamiento. La lectura se probó con un proveedor configurado para fallar si se lo invocaba.
- Se reutilizaron la restricción única de Resumen y el campo creadoEn para conservar la fecha de generación. No se aplicaron migraciones ni se ejecutaron seeds.
- Se descargó Qwen2.5 0.5B en la carpeta local del proyecto y Ollama completó la verificación SHA-256. La instancia iniciada desde el entorno automatizado recibió «Acceso denegado» al leer el manifiesto en rutas absoluta y relativa. La prueba HTTP con generación real quedó pendiente. No hubo llamadas a un proveedor remoto ni cargos.
- La compilación de Vite requirió el cargador nativo por acceso denegado de esbuild. Se ajustó la espera de una prueba de navegación móvil para observar el control bajo prueba y se repitió la suite completa.

### Verificación con Ollama iniciado por el usuario

- La instancia iniciada desde PowerShell del usuario reconoció el modelo descargado. El primer recorrido con Ollama real aprobó 21 pasos HTTP, incluyendo texto, PDF, guardado, lectura e intentos de acceso cruzado con 404. La prueba limpió solo sus cuentas y datos temporales.
- La revisión de los resultados detectó afirmaciones ajenas al material. La implementación local se cambió a un resumen extractivo. Ollama selecciona hasta tres fragmentos y AulaSync valida las referencias y reconstruye el texto con los fragmentos originales.
- El backend recompiló y la vista actualizada respondió en el puerto 5178. La primera repetición encontró Ollama fuera de servicio en el puerto 11435. Al reiniciar Ollama desde PowerShell, la versión extractiva aprobó 21 comprobaciones HTTP. Los resultados de texto y PDF contenían únicamente fragmentos del material. Se verificaron el guardado, la consulta y el rechazo de accesos de otra cuenta.

## Sprint 6 · Aislamiento y correcciones

- La base de desarrollo se consultó en una transacción de solo lectura. Se observaron datos de usuarios, tres migraciones aplicadas y cero asociaciones huérfanas entre material y materia en la consulta realizada. No se mostraron datos personales.
- Se inicializó un clúster PostgreSQL separado en `127.0.0.1:5437`, con base `aulasync_test`, rol exclusivo sin superusuario y credenciales bajo `.local/sprint6-db`. Se comprobó puerto, identidad y ruta del clúster antes de crear la base. Las tres migraciones existentes se aplicaron allí. No se ejecutaron seeds.
- **Alto, corregido en la configuración.** La suite de integración antes escribía en desarrollo. Ahora exige `TEST_DATABASE_URL` y `TEST_SESSION_SECRET`. El recorrido y el verificador de relaciones controlan la identidad de la base. Los scripts de smoke de Sprints 2 y 3 son históricos y apuntan a desarrollo. El comando `npm run test:smoke` usa el recorrido aislado.
- **Medio, corregido en la carga.** Un archivo con encabezado y cierre PDF podía guardarse aunque no tuviera una estructura legible. Se reutilizó el parser existente para comprobar que se pueda abrir y leer la primera página antes de persistirlo. Un PDF válido sin texto sigue siendo un material admisible y al intentar resumirlo devuelve un error específico. No se incorporó OCR.
- **Medio, corregido durante la reanudación.** El manifiesto raíz contenía bytes nulos y npm rechazaba cualquier ejecución. Se restauraron los scripts y dependencias ya registrados y se validó el JSON.
- **Alto, avisos de dependencias.** El lockfile conserva Prisma y `@prisma/config` 6.19.0, `deepmerge-ts` 7.1.5 y `effect` 3.18.4. Las versiones transitivas coinciden con los rangos afectados. En la revisión del código no se encontró un endpoint que acepte grafos JavaScript recursivos ni que use Effect RPC. Los hallazgos siguen vigentes en las dependencias y no se aplicaron cambios de versión. [deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) · [Effect](https://github.com/advisories/GHSA-38f7-945m-qr2g)
- **Calidad pendiente.** En Introducción al Derecho se observó contenido editorial y cobertura insuficiente del cuerpo del libro. La validación técnica de carga y la extracción de archivos sintéticos no determinan la calidad de ese resumen. El original, el modelo y la estrategia quedan fuera de esta corrección.

### Revalidación tras recuperar el entorno

- Backend: 39 de 39 pruebas aprobadas, incluido el recorrido HTTP integral con proveedor simulado. Se registraron dos estudiantes sintéticos, se guardó y recuperó un resumen después de cerrar sesión y recrear la aplicación, y el contador del proveedor se mantuvo en una invocación. Los accesos cruzados devolvieron 404.
- PostgreSQL aislado: se confirmaron tres migraciones y cero resúmenes huérfanos. Las 14 comprobaciones relacionales pasaron y los cinco conteos de fixtures quedaron en cero.
- La primera pasada de backend excedió el tiempo de espera en cuatro casos. La repetición serial con una espera de 60 segundos por caso aprobó la suite completa. Se corrigió el tipo del auxiliar de cierre de sesión de la prueba HTTP.
- El registro npm no devolvió un informe en los intentos de auditoría. La evaluación de los avisos conocidos se basa en el lockfile y los rangos publicados. No equivale a una auditoría actual completa.
- Ollama respondió durante la auditoría inicial y dejó de escuchar al recuperar el entorno. La prueba nueva con el proveedor real queda pendiente. El recorrido HTTP con proveedor simulado sí se ejecutó. La verificación visual en navegador también queda pendiente.
- Frontend: 30 de 30 pruebas aprobadas en la repetición serial, incluida navegación móvil. La primera ejecución registró cinco fallas de espera y búsqueda de elementos. Se amplió a cinco segundos la espera de consultas asíncronas de Testing Library y se repitió la suite con un límite de 20 segundos por caso.
- Resultado final de las suites: 69 pruebas aprobadas de 69, más 14 comprobaciones relacionales. El recorrido integral es HTTP con Supertest y PostgreSQL aislado. La prueba de reinicio recrea la aplicación y el cliente Prisma.
- Tipo de dato y formato: TypeScript y Prettier aprobados. El proyecto no define un script de lint.
- Compilación de backend y frontend aprobadas. Vite completó el build con el cargador nativo y emitió dos advertencias por comentarios de Zod.
- La vista aislada se inició en 127.0.0.1:5182 con el proveedor simulado. El navegador integrado agotó el tiempo al abrirla. Quedan pendientes las comprobaciones visuales y de consola en un navegador real.
