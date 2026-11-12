# Demostración manual — Sprint 2

Desde la carpeta raíz de AulaSync, ejecutar npm run db:local:start y luego npm run dev. Mantener esa terminal abierta. No ejecutar seeds ni resetear la base para la demostración.

1. Abrir http://127.0.0.1:5173 en el navegador de esta computadora. Una ruta privada sin sesión conduce al acceso.
2. Elegir Creá tu cuenta. Completar nombre, un correo propio de demostración que no exista y una contraseña de 10 a 128 caracteres. La contraseña no se recorta; guardarla de forma privada.
3. Al crear la cuenta aparece la confirmación y se abre el dashboard. Las materias iniciales son cero para un usuario nuevo; no se muestran materias del seed ni de otros estudiantes.
4. Entrar en Materias y elegir Nueva materia. Completar nombre y descripción opcional; guardar. La tarjeta debe mostrar los datos ingresados.
5. Editar nombre y descripción, guardar y comprobar los cambios. Volver a Inicio: el conteo y las últimas materias deben coincidir con los datos guardados.
6. Recargar el navegador. La sesión y las materias deben conservarse.
7. Cerrar sesión. Volver a una ruta privada debe mostrar el acceso. Iniciar sesión otra vez con el mismo correo y contraseña; el correo admite mayúsculas y espacios exteriores.
8. Abrir una ventana privada/incógnita, crear una segunda cuenta y comprobar que no ve las materias de la primera. La ventana normal puede conservar la sesión de la primera cuenta. No usar dos pestañas del mismo perfil para simular dos sesiones distintas, porque comparten cookies.
9. Eliminar únicamente una materia de demostración, revisar la confirmación, cancelar una vez y luego confirmar. No eliminar materias preexistentes que se quieran conservar.
10. Probar validaciones de campos vacíos, correo duplicado y contraseña incorrecta. El sistema debe informar el error sin aparentar un guardado exitoso.
11. En una ventana angosta, revisar el menú: cerrado no debe introducir sus enlaces en Tab; abierto debe enfocar el cierre, mantener Tab/Shift+Tab dentro del panel, cerrar con Escape y restaurar el foco. Revisar también con lector de pantalla si está disponible.

Esta guía no equivale a una validación ejecutada. La revisión visual del menú del Sprint 1 y el recorrido manual de estas pantallas siguen pendientes mientras el navegador local esté deshabilitado en Work. Los resultados automatizados reales se registran en docs/validacion.md.

Si aparece un error CSRF, recargar la página para recuperar el token de la sesión. Si se llega al límite de acceso, esperar el tiempo indicado; no modificar credenciales ni desactivar protecciones para continuar la demostración.
