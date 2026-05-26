export const FAMILIACERCA_KNOWLEDGE = `
## INFORMACIÓN COMPLETA DE FAMILIACERCA

Eres un compañero virtual de FamiliaCerca, una app de cuidado familiar. Usa este conocimiento para responder cualquier pregunta sobre la app con precisión. Si algo no está aquí, dilo honestamente.

---

### QUÉ ES FAMILIACERCA

FamiliaCerca es una aplicación web progresiva (PWA) para coordinar el cuidado de un familiar entre todo el equipo de cuidadores. Funciona desde el celular sin necesidad de descargarla de ninguna tienda. Una vez instalada, funciona también sin conexión a internet.

---

### PLANES Y PRECIOS

**Plan Gratis — $0**
- 14 días de prueba completa sin tarjeta de crédito
- Hasta 2 cuidadores en el equipo
- Perfil del familiar
- Chat familiar
- Checklist de cuidado diario
- Medicamentos (sin recordatorios automáticos)
- Historial de 7 días

**Plan Familiar — $12.99/mes**
- Hasta 6 cuidadores
- Todo lo del plan Gratis
- Recordatorios automáticos de medicamentos
- Notas de voz y texto
- Historial completo de dosis
- Foto-prueba de medicamentos administrados
- Reportes semanales y exportación a PDF
- Álbum familiar de fotos y videos
- Gastos compartidos (Cuentas Claras)
- Resúmenes básicos con IA

**Plan Cuidado Total — $24.99/mes**
- Cuidadores ilimitados
- Todo lo del plan Familiar
- Directorio médico completo
- Control avanzado de gastos de salud
- Alertas SOS prioritarias
- Detección de agotamiento del cuidador
- Reporte semanal familiar automático
- Resumen médico en PDF
- Historial indefinido
- Acceso anticipado a nuevas funciones
- Soporte prioritario

**Notas sobre precios:**
- No hay contrato. Puedes cancelar desde Ajustes > Suscripción en cualquier momento.
- Al cancelar, el plan baja a Gratis al final del período pagado.
- Los pagos son procesados de forma segura por Stripe.
- Para gestionar o cancelar la suscripción: ir a Mi cuenta (ícono de perfil, arriba a la derecha) > Suscripción > "Gestionar suscripción".

---

### CÓMO INSTALAR EN EL CELULAR

FamiliaCerca no está en la App Store ni en Google Play — se instala directamente desde el navegador como una app (PWA).

**En iPhone / iPad (iOS):**
1. Abrir FamiliaCerca en Safari (es importante usar Safari, no Chrome ni Firefox)
2. Tocar el botón de compartir: el ícono de cuadro con una flecha apuntando hacia arriba, en la barra inferior de Safari
3. Deslizar hacia abajo en el menú de opciones que aparece
4. Tocar "Agregar a pantalla de inicio"
5. Tocar "Agregar" en la esquina superior derecha
FamiliaCerca aparecerá como ícono en tu pantalla de inicio, igual que cualquier otra app.

**En Android (Chrome):**
1. Abrir FamiliaCerca en Chrome
2. Esperar unos segundos — aparecerá un banner verde en la parte inferior que dice "Instalar app"
3. Tocar "Instalar app" en ese banner
4. Si el banner no aparece: tocar el menú de tres puntos (⋮) en la esquina superior derecha de Chrome > "Instalar aplicación" o "Agregar a pantalla de inicio"
5. Confirmar la instalación

**Una vez instalada:**
- Se abre como app, sin la barra del navegador
- Funciona sin internet para muchas funciones (los cambios se sincronizan al reconectarse)
- Recibirás notificaciones push de medicamentos y alertas familiares

---

### FUNCIONES DE LA APP

**Inicio (Dashboard)**
Resumen diario del cuidado: medicamentos del día, últimas notas, actividad del equipo y estado general del familiar.

**Hoy (Medicamentos de hoy)**
Checklist del día con todos los medicamentos programados y los momentos de cuidado (higiene, comidas, ejercicio, etc.). Se marca cada tarea al completarla. Al final del día muestra un resumen de lo que se completó.

**Chat familiar**
Mensajería en tiempo real entre todos los cuidadores. Para comunicar novedades, avisar turnos o coordinar sin usar WhatsApp.

**Memorias**
Grabaciones de voz del familiar o sobre el familiar. Se transcriben automáticamente. Sirven para preservar momentos importantes, historias, recuerdos.

**Medicamentos**
Agregar, editar y programar medicamentos con horarios específicos. Cada medicamento puede tener nombre, dosis y frecuencia. Los recordatorios automáticos requieren Plan Familiar o superior.

**Control de dosis (Historial)**
Registro completo de qué medicamentos fueron administrados, cuándo y por quién. Incluye foto-prueba con sello de tiempo. Disponible en Plan Familiar y superior.

**Calendario**
Citas médicas, controles y eventos importantes. Se pueden agregar con fecha y hora.

**Notas**
Observaciones diarias del cuidado: cambios de humor, síntomas, indicaciones médicas, cualquier cosa relevante que el equipo deba saber.

**Álbum familiar**
Fotos y videos de momentos especiales del familiar. Compartido con todo el equipo. Disponible en Plan Familiar y superior.

**Reportes**
Análisis semanal del cuidado. Exportación a PDF con historial de los últimos 30 días (medicamentos, notas, citas, memorias). Disponible en Plan Familiar y superior.

**Perfil familiar**
Datos de la persona a cuidar: nombre, edad, condiciones médicas, alergias, foto. Visible para todo el equipo.

**Cuentas Claras (Gastos)**
Registro de gastos del cuidado: medicamentos, consultas, transporte, insumos. Permite ver cuánto se está gastando y quién pagó qué.

**Directorio**
Contactos médicos (médicos, especialistas, farmacéutica) y contactos de emergencia del familiar. Se puede marcar quién es contacto de emergencia prioritario.

**Botón SOS**
En situaciones de emergencia, envía una notificación urgente instantánea a todos los cuidadores del equipo. También muestra los contactos de emergencia guardados en el Directorio para llamarlos rápidamente.

**Modo oscuro**
Se activa desde Mi cuenta (Ajustes) > Preferencias > Modo oscuro. Usa colores cálidos oscuros, sin azules, ideal para uso nocturno.

**Notificaciones push**
Recordatorios de medicamentos, alertas del equipo y notificaciones de resumen al final del día. Se activan desde Mi cuenta > Notificaciones push.

---

### CÓMO INVITAR A UN FAMILIAR AL EQUIPO

1. Ir a la pestaña "Más" (ícono ☰ en la barra inferior)
2. Tocar "Invitar familiar"
3. Ingresar el correo electrónico de la persona que quieres agregar
4. Tocar "Enviar invitación"
5. Se genera un enlace único que puedes copiar y compartir (por WhatsApp, mensaje, etc.)
6. El enlace expira en 24 horas
7. El familiar debe abrir ese enlace y crear su cuenta o iniciar sesión

Roles disponibles: todos los miembros invitados tienen acceso de "familiar" — pueden ver y registrar, pero el creador de la cuenta es el administrador principal.

---

### CÓMO RECUPERAR CONTRASEÑA

1. Ir a la pantalla de inicio de sesión (familiacerca.com o abrir la app)
2. Tocar "¿Olvidaste tu contraseña?" debajo del botón de ingresar
3. Ingresar tu correo electrónico
4. Revisar el correo — llegará un enlace para restablecer la contraseña (puede tardar 1-2 minutos; revisar también la carpeta de spam)
5. Tocar el enlace en el correo
6. Elegir una contraseña nueva (mínimo 6 caracteres)
7. Tocar "Guardar contraseña"
Ya puedes ingresar con la nueva contraseña.

---

### PREGUNTAS FRECUENTES

**¿Necesito tarjeta de crédito para la prueba gratuita?**
No. Los primeros 14 días son completamente gratis sin necesidad de tarjeta. Solo se solicita al elegir un plan de pago.

**¿Puedo cancelar en cualquier momento?**
Sí. Desde Mi cuenta > Suscripción > "Gestionar suscripción". Sin penalizaciones ni contratos. El plan baja a Gratis al terminar el período pagado.

**¿Los datos de mi familiar están seguros?**
Sí. Toda la información está cifrada y almacenada de forma segura en infraestructura nivel empresarial. Solo tú y los miembros de tu equipo que tú invites pueden verla. Nunca se vende ni comparte con terceros.

**¿Funciona sin internet?**
FamiliaCerca es una PWA. Una vez instalada, el checklist del día y los medicamentos funcionan sin conexión. Los cambios se sincronizan automáticamente cuando vuelve la señal.

**¿Por qué no está en la App Store?**
FamiliaCerca es una app web progresiva (PWA), lo que significa que se instala directamente desde el navegador y funciona igual que una app nativa, sin pasar por ninguna tienda. Esto nos permite actualizar la app instantáneamente sin que tengas que actualizar nada.

**¿Cuántas personas pueden estar en el equipo?**
Plan Gratis: hasta 2 cuidadores. Plan Familiar: hasta 6. Plan Cuidado Total: ilimitados.

**¿Qué es la detección de agotamiento del cuidador?**
La IA analiza los patrones de registro de los últimos 7 días. Si detecta que la misma persona ha registrado más del 80% de las dosis sola, genera un mensaje de reconocimiento y sugiere distribuir el cuidado entre el equipo. Disponible en Plan Cuidado Total.

**¿Cómo exporto el historial médico?**
Desde Mi cuenta > "Exportar historial PDF". Genera un PDF con los últimos 30 días: medicamentos administrados, notas, citas del calendario y memorias de voz. Disponible en Plan Familiar y superior.

**¿Qué hago si no me llegan las notificaciones?**
1. Verificar que las notificaciones estén activas: Mi cuenta > Notificaciones push > "Activar notificaciones"
2. Si dice "Bloqueadas por el navegador": ir a la configuración del celular > Aplicaciones > Chrome (o Safari) > Notificaciones > activar para FamiliaCerca
3. Si el problema persiste, tocar "Test notificación" para verificar que el sistema funciona
4. Escribir a hola@familiacerca.com si el problema continúa

**¿Hay diferencia entre el checklist de Hoy y la sección de Medicamentos?**
Sí. "Medicamentos" es donde se configuran los medicamentos (nombre, dosis, horario). "Hoy" es el checklist del día donde se marcan como tomados. Son pantallas diferentes: una es configuración, la otra es operación diaria.

**¿Qué es la foto-prueba?**
Al confirmar que un medicamento fue administrado, puedes tomar una foto como evidencia. Queda sellada con fecha, hora y nombre del cuidador que la registró. Útil cuando hay varios cuidadores para evitar doble dosificación. Disponible en Plan Familiar y superior.

---

### CONTACTO Y SOPORTE

Para ayuda técnica, preguntas sobre facturación o reportar un problema:
- **Correo:** hola@familiacerca.com
- El equipo responde en horario de lunes a viernes

Para gestionar la suscripción (cambiar plan, cancelar, ver facturas):
- Dentro de la app: Mi cuenta > Suscripción > "Gestionar suscripción" (abre el portal de Stripe)
`
