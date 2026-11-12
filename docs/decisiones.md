# Decisiones iniciales y arquitectura

No había archivos en el repositorio al inspeccionarlo. No se encontraron AulaSync_Descripcion_del_Sistema.pdf, AulaSync_Analisis_del_Modelo.pdf, AulaSync_Historias_de_Usuario.pdf, AulaSync_Diagrama_Entidad_Relacion.pdf, AulaSync_DFD.pdf ni AulaSync_Product_Backlog.pdf. La única fuente de requisitos es la solicitud del proyecto; contrastar estas decisiones cuando se incorporen los seis documentos.

## Relaciones

- Usuario 1:N Materia; email único (normalización a minúsculas pendiente de HU-01).
- Materia 1:N Actividad; fecha académica sin hora (`date`). La propiedad de una actividad se obtiene a través de su materia.
- Usuario 1:N Material; cada material tiene propietario obligatorio.
- Materia 1:N Material, con materia opcional. La FK compuesta `(materiaId, usuarioId)` impide asociaciones entre propietarios diferentes aun desde SQL.
- Material 1:0..1 Resumen. `materialId` único garantiza un solo resumen guardado; la propiedad del resumen se obtiene a través del material.

**Validar académicamente:** material sin materia y máximo de un resumen por material, según las decisiones iniciales solicitadas.

## Borrado y representación: pendientes de validar

Usuario elimina sus materias, actividades, materiales y resúmenes en cascada. Eliminar una materia debe, en una transacción futura del servicio, desvincular sus materiales (`materiaId = null`) antes del borrado; las actividades se eliminan en cascada. La FK `NoAction` bloquea borrados directos que dejarían materiales asociados inválidos. No se usa `SetNull` en la FK compuesta porque `usuarioId` es obligatorio. Eliminar un material elimina su resumen. El tratamiento de archivos físicos se resolverá en Sprint 4.

Los materiales PDF guardarán una clave privada de almacenamiento, nombre, MIME, tamaño y texto extraído en `contenido`; los de texto usarán directamente `contenido`. No se almacena un PDF binario en la tabla ni se publican rutas de archivos. Las invariantes específicas de formato y contenido se implementarán al crear el servicio de materiales, junto con sus validaciones.

No se incorpora estado de actividad, calendario, docentes, administradores, notificaciones, carrera ni otras entidades ajenas al alcance. Las sesiones usarán almacenamiento técnico persistente a definir en Sprint 2, sin presentarlo como entidad del dominio académico.

## Separación de responsabilidades

Frontend presenta vistas y consume HTTP. El backend compone middleware y rutas en `app.ts`; `server.ts` carga entorno e inicia el proceso. Prisma define persistencia y migraciones. No se crean servicios CRUD vacíos ni proveedores simulados. Al incorporar cada HU se agregará su módulo con rutas, validación, servicio y acceso a persistencia; el servicio recibirá el usuario autenticado desde la sesión, nunca desde un identificador de propietario enviado por el cliente.

La integración de IA se decidirá en Sprint 5: proveedor, modelo, costos, límites de texto, timeout y política de privacidad pendientes. No hay API key requerida en esta entrega.

## Decisiones aplicadas en Sprint 2

La autorización del usuario permitió avanzar manteniendo pendiente la revisión visual del menú del Sprint 1. Los seis PDF siguen ausentes: no se atribuyen decisiones a documentos que no pudieron leerse.

Se agregó descripcion opcional (hasta 1000 caracteres) a Materia porque HU-03 solicita editarla. La migración es aditiva y conserva las cinco entidades y sus relaciones. Sesion es una tabla técnica para persistir sesiones del servidor, no un nuevo rol ni una entidad académica.

El registro inicia sesión automáticamente, con identificador y CSRF nuevos. El email se recorta y pasa a minúsculas antes de consultar/guardar; PostgreSQL garantiza unicidad ante registros concurrentes. Las contraseñas no se recortan. La configuración se restringe a aulasync_dev local y las pruebas usan exclusivamente esa base.

Se aplicó la política de borrado documentada: bloqueo de fila, desvinculación de materiales y borrado de materia/actividades dentro de una transacción. La descripción vacía se guarda como null; un PATCH que sólo cambia nombre conserva la descripción.

Las sesiones duran hasta ocho horas de autenticación por defecto; el servidor revisa su expiración. El limitador de acceso es básico, por IP y proceso. Secure se activa con NODE_ENV=production; el despliegue HTTPS y cualquier proxy requieren una configuración explícita futura. Ninguna credencial se entrega en la documentación.
