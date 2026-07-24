## Reglas de trabajo — NO ROMPER LA APP

Esta es una aplicación en producción. En tareas de UI solo se permite
mejorar estilos.

### 🚫 PROHIBIDO CAMBIAR
- No eliminar ni modificar navegación
- No eliminar ni cambiar links (href, router links, Link components)
- No modificar ni borrar onClick handlers
- No cambiar lógica de routing
- No eliminar state management (useState, context, stores)
- No simplificar ni refactorizar componentes que contengan lógica
- No reemplazar elementos interactivos por estáticos
- Si algo es funcional, NO SE TOCA

### 🎨 PERMITIDO CAMBIAR
- Layout (spacing, padding, alineación)
- Colores (usando el design system existente)
- Tipografía (tamaño, peso, jerarquía)
- Jerarquía visual
- Estilos de UI (cards, sombras, bordes)
- Presentación de componentes (NO su estructura)

### 🧠 ALMA DEL PRODUCTO
FamiliaCerca NO es una app médica. Es una app de COORDINACIÓN DE
CUIDADO FAMILIAR. La UI debe sentirse: humana, cálida, emocional,
de apoyo, no clínica, SaaS moderno. Evitar sensación de hospital.

### 💚 PRINCIPIO UX
El centro de la UI es la PERSONA (ej. Deborath). Todo lo demás es
secundario.

### 🧩 REGLA DE REFACTOR SEGURO
Solo se puede refactorizar: CSS/estilos, estructura de layout dentro
de un componente, agrupación visual de elementos existentes.
NO se puede: cambiar lógica, navegación, flujo de datos, ni
arquitectura de componentes.

### ⚠️ CHECK DE SEGURIDAD ANTES DE FINALIZAR
1. Toda la navegación sigue funcionando
2. Todos los botones siguen clickeables
3. Ningún link eliminado
4. Ninguna ruta cambiada
5. Ningún event handler eliminado
Si algo de esto se rompió → corregir antes de entregar.

## 🎨 MIGRACIÓN DE DISEÑO — TEAL COMPLETA (2026-07-24)

**STATUS:** ✅ 100% COMPLETADA

**Sesión:** Miércoles 24 julio 2026 — Migración total de paleta de petróleo
(`#143C32`, `#0d6b63`, `#0B4F4A`) a **teal moderno** (`#087F70`) + tipografía
Georgia → **Plus Jakarta Sans** en toda la aplicación.

**Alcance:**
- 34 archivos modificados (componentes, páginas, públicas/privadas)
- 150+ resabios de color/tipografía eliminados
- 5 commits temáticos (Tanda 2, Tanda 3, Landing, Pantallas, Legales)

**Cambios aplicados:**
- **Color primario:** `#143C32` → `#087F70` (verde petróleo → teal)
- **Color acción:** `#0d6b63` → `#087F70` (accents)
- **RGBA colors:** `rgba(13,107,99)` / `rgba(20,60,50)` → `rgba(8,127,112)`
- **Tipografía:** `Georgia, serif` / `Cormorant Garamond` → `'Plus Jakarta Sans', sans-serif`
- **Gradientes:** petróleo → `#087F70 → #A8E5D6` (teal → light teal)

**Archivos cubiertos:**
- Componentes: Layout, Logo, CompanionChat, VoiceRecorder, VoiceInput,
  WelcomeSlides, MemberOnboarding, DiarioMedicoEntryModal, TrialBanner,
  PWAInstallBanner, InstallPrompt
- Páginas internas: Calendar, Login, Register, Notes, PatientProfile,
  Permissions, DiarioMedico, Directory, Incidents, Onboarding, Upgrade
- Públicas: Landing.jsx (29 resabios), TermsOfService, PrivacyPolicy

**Verificado:**
- Navegación intacta (no se modificó ningún link/routing)
- Funcionalidad preservada (botones, handlers, lógica)
- Solo estilos/presentación cambiados
- Aprobación visual requerida en localhost antes de push



⚠️ **REBRAND paleta app (2026-07-08):** paleta reemplazada de forma
permanente. **Verde petróleo `#143C32` queda DESCONTINUADO — no usar en
ningún lugar nuevo.** Motivo: rebrand aprobado para darle a la app
(Dashboard) una identidad propia — más cálida, humana y menos
"corporativa" — distinta de la paleta anterior. Verde vivo `#0d6b63`
también queda superado: su rol de color protagonista/acción lo hereda el
teal principal.

- Fondo: crema `#F8F4ED` (sin cambio) · Header claro vía isLightHeader en Layout.jsx
- Cards: blanco, borderRadius 16-24px, sombra suave
- **Teal principal `#087F70`** — cuidado/confianza, estado "todo bien", botones primarios, CTAs, estados activos, iconos de acción, degradados
- **Teal claro `#A8E5D6`** — degradados (siempre en pareja con teal principal), fondos suaves
- **Coral acción `#E9826E`** (sin cambio) — marca/amor, alertas moderadas
- **Coral emergencia `#D9534F`** (NUEVO) — urgencia real; distinto del coral de acción, solo para estados críticos genuinos (ej. "Requiere seguimiento")
- Melocotón `#FBEAE4` (sin cambio) — fondo de atención suave
- Gold `#D99A18` (sin cambio, acento terciario, uso limitado) — recuerdos/momentos especiales, warnings suaves, categorización de íconos; nunca para CTAs ni superficies
- **Morado IA `#7566D8`** (NUEVO, EXCLUSIVO) — solo Milo/Luna e "Inteligencia FamiliaCerca"; NO usar en estados, alertas ni navegación
- Textos: `#334155` gris texto (reemplaza a petróleo como color de texto/títulos), `#6B7280` secundarios (sin cambio)
- Chips: activo coral con texto `#334155`, inactivo transparente borde `#EDE5D8`
- Colores semánticos (danger/estados de dosis) NO se tocan: son información
- Referencias de migración: Chat ed8e21d, Historial 7d6fb81, VideoCall a09b5e1, CareCard/rebrand app 2026-07-08

## Arquitectura conceptual del producto

Principio: "La app no organiza medicamentos. Organiza el cuidado de una persona."
Posicionamiento: "FamiliaCerca reduce la incertidumbre de cuidar a un ser querido."

Cuatro capas:
- 💚 **HOME** (emocional): responder "¿cómo está hoy?" en 3 segundos
- 🟡 **CUIDADO** (operativo): Medicamentos (Hoy/Lista/Inventario/Recetas), Rutina diaria (/cuidado: Hoy/Horarios), Citas, Alertas, Chat/Video
- 🔵 **REGISTRO** (técnico): logs, historial, evidencias — invisible
- 🏥 **HOSPITAL** (excepción): solo en hospitalización

Regla: cada sección responde UNA pregunta.

## Proceso
- Toda migración de pantalla: mostrar plan ANTES de aplicar
- El hero del Dashboard está CERRADO — no rediseñar
- La sala de videollamada activa permanece oscura (estándar de video)
- Actualizar SESION-*.md al completar cada pantalla

## PayPal Live (producción) — registro de IDs

Migrado a la cuenta PayPal Business Live el 2026-07-20. Producto y planes
creados vía API contra `api-m.paypal.com` con las credenciales Live
(`PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` en Supabase Edge Function secrets).

- Producto: `PROD-2L502973JB662725F` ("FamiliaCerca", SERVICE/SOFTWARE)
- Plan Familiar ($12.99/mes): `P-1ND05182V43172927NJPFH7Y`
- Plan Total ($24.99/mes): `P-48V95038FD0449505NJPFIAA`
- Fuente única de los Plan IDs en el código: `src/config/paypalPlans.js`
  (importado por `Upgrade.jsx`, `PayPalSubscription.jsx` y la Edge Function
  `paypal-webhook`)
- Sin trial period en PayPal — el trial de 14 días sin tarjeta lo gestiona
  la app; el usuario se suscribe en PayPal al terminar el trial.
- Webhook: Edge Function `paypal-webhook`, valida firma contra
  `PAYPAL_WEBHOOK_ID` (Supabase secret). Eventos procesados:
  `BILLING.SUBSCRIPTION.ACTIVATED/CANCELLED/SUSPENDED/EXPIRED`,
  `PAYMENT.SALE.COMPLETED`. Es la fuente de verdad del estado de la
  suscripción — el `onApprove` del frontend es solo activación optimista.
- `subscriptions.status` admite `suspended` desde 2026-07-20
  (`supabase/add_subscription_suspended_status.sql`).

## Proxy de Gemini — arquitectura (2026-07-23)

`src/lib/gemini.js` (`geminiGenerate`/`geminiChat`, consumido por
Dashboard/Chat/CompanionChat/activitySummary) y `src/pages/Medications.jsx`
(extracción de datos de medicamentos por imagen) **nunca deben llamar a
`generativelanguage.googleapis.com` directo desde el frontend** — la key
viajaría expuesta en el bundle (ya pasó, incidente 2026-07-23 en
`SESION-20JUL.md`). Ambos pasan por Edge Functions con el mismo patrón de
auth: JWT de usuario Supabase obligatorio, `GEMINI_API_KEY` solo en
`Deno.env` (nunca en `VITE_*`).

- **`gemini-proxy`** (texto): una función, dos acciones —
  `{action: 'generate', prompt, maxTokens}` y `{action: 'chat',
  systemPrompt, history, text, maxTokens}`. Cualquier llamada nueva de
  texto a Gemini desde el frontend debe pasar por aquí, nunca directo.
- **`gemini-vision`** (imágenes, preexistente): extracción de datos de
  cajas/recetas de medicamentos.
- **`gemini-flash-latest` es un alias inestable — Google puede rotarlo a
  otro modelo en cualquier momento sin aviso.** El 2026-07-23, al activar
  una key nueva, el alias empezó a resolver a una generación
  (`gemini-3.6-flash`, visto en `modelVersion` de la respuesta) que
  **rechaza `thinkingConfig.thinkingBudget: 0`** (`400 INVALID_ARGUMENT`)
  y **no respeta un budget bajo como techo estricto** — puede gastar
  cientos de tokens "pensando" igual, y esos tokens cuentan contra
  `maxOutputTokens`, truncando la respuesta a vacío si el techo es chico.
  Config actual en `gemini-proxy`: `thinkingBudget: 256` + margen fijo de
  `+700` sobre el `maxOutputTokens` que pide el caller.
  **Si Milo/Luna (o gemini-vision) vuelven a devolver `null`/vacío sin
  motivo aparente, sospechar esto primero.** Diagnóstico rápido: agregar
  temporalmente una acción a la función que le pegue a `GET
  https://generativelanguage.googleapis.com/v1beta/models?key=...` para
  ver el `modelVersion` real y si acepta el thinking budget configurado
  — quitar el diagnóstico antes de dejar la función en el estado final.
- **Testing de Edge Functions con auth sin credenciales de usuario real:**
  el sign-in anónimo de Supabase está deshabilitado en este proyecto
  (`anonymous_provider_disabled`). Para probar una función que exige JWT,
  crear un usuario desechable vía `POST {url}/auth/v1/signup` con email
  `algo@algo-test.invalid` (TLD reservado, nunca entrega correo real) +
  password — el proyecto tiene auto-confirm de email, así que el signup
  devuelve `access_token` en el mismo response. Quedan filas huérfanas en
  `auth.users` con ese dominio; inofensivas, limpiar de vez en cuando
  desde el dashboard (Authentication > Users, filtrar
  `familiacerca-test.invalid`).

## ⚠️ Deploy — NUNCA `npm run build` + deploy manual de `dist/`

Confirmado dos veces (incidente PayPal 2026-07-20, casi-incidente Gemini
2026-07-23): el `.env` **local** de esta máquina tiene `VITE_PAYPAL_CLIENT_ID`
y `VITE_POSTHOG_KEY` vacíos. Un `npm run build` corrido directo en la
terminal hornea esos valores vacíos en el bundle — si ese `dist/` se sube
a un draft o a producción, rompe lo que dependa de esa env var (ya rompió
PayPal una vez). Para **cualquier** build que vaya a terminar en un
deploy real (draft de verificación o producción), usar siempre:

```
netlify deploy --build           # draft
netlify deploy --prod --build    # producción
```

Esto le pide a Netlify que construya usando las env vars reales
configuradas en el sitio, ignorando el `.env` local roto. Un `npm run
build` suelto solo sirve para verificar que el código compila (errores de
sintaxis/build), nunca para verificar el contenido real de un bundle que
se va a desplegar.

## Videollamada — arquitectura (Fase 1, 2026-07-20)

Rediseño de `/videollamada` (`src/pages/VideoCall.jsx`) fiel al export de
Claude Design `Videollamada.dc.html`. Resumen de arquitectura real detrás
de cada sección — importante antes de tocar esta pantalla otra vez:

- **Presencia** ("¿Quién está disponible?"): `usePresence()`
  (`src/contexts/PresenceContext.jsx`) — Supabase Realtime Presence, en
  vivo, sin tabla. Mismo hook que usan `Familia.jsx` y `Dashboard.jsx`. No
  hay "última vez visto" persistido, solo online/offline del momento.
- **Llamadas reales**: tabla `video_calls`, creada exclusivamente vía el
  Edge Function `create-daily-room` (aprovisiona una sala Daily.co
  permanente por perfil de cuidado — `fc-{8 chars del ownerId}` — y crea la
  fila). Cron `send-videocall-notifications` manda push a los 15 min y al
  momento exacto a todos los invitados. Esta es la ÚNICA vía correcta para
  crear una llamada (instantánea o programada) — cualquier código nuevo que
  programe una llamada debe pasar por `create-daily-room`, nunca insertar
  directo a una tabla.
- **`VideoCallScheduleModal.jsx`** (usado desde el FAB de Dashboard) ya
  implementaba el flujo correcto (instantánea + programada + selección de
  participantes, todo vía `create-daily-room`). El botón "Programar
  llamada" del rediseño reutiliza este mismo modal — no se duplicó la
  lógica de agendar una tercera vez.
- **`scheduled_calls` — tabla huérfana, sin uso, NO borrada.** Antes del
  rediseño, la pestaña "Programar" de `VideoCall.jsx` insertaba
  directamente en esta tabla (`patient_id, family_id, scheduled_at,
  created_by, status, title`) sin crear sala de Daily.co ni notificación —
  las llamadas "programadas" ahí no se podían ni siquiera unir. Auditado
  el 2026-07-20 vía Edge Function temporal con service role: **0 filas**,
  tabla completamente vacía — no hubo que migrar nada. El insert directo
  se eliminó de `VideoCall.jsx`; la tabla queda en el esquema sin ningún
  código que la use. Decisión: no borrarla todavía (por si acaso), pero no
  usarla — si se necesita en el futuro, primero confirmar que sigue vacía.
- **"Recordar" (toggle en la tarjeta de próxima llamada): visual-only,
  estado local del componente, no persiste.** Decisión explícita: los
  recordatorios push ya se mandan automáticamente a TODOS los invitados de
  cada fila de `video_calls` (cron de 15 min / al momento) — no existe un
  campo de preferencia por-usuario para activar/desactivar esto, y crear
  uno es trabajo de backend nuevo fuera del alcance de Fase 1. Conectar el
  toggle a algo que no controla nada real hubiera sido más confuso que
  dejarlo visual.
- **"Recientes" — estado vacío únicamente, Fase 2 pendiente.** No existe
  historial de llamadas: no hay webhook de Daily.co, no hay `ended_at` ni
  `duration_seconds` en `video_calls`, no hay registro de asistencia.
  Daily.co sí guarda esto en sus propios servidores. Para implementar
  Fase 2: Edge Function que reciba el webhook `meeting.ended` de Daily.co
  (agregar `ended_at`/`duration_seconds` a `video_calls`); si se quiere
  asistencia real por participante, además suscribirse a
  `participant.joined`/`participant.left` y una tabla nueva
  (`video_call_participants` o similar).
- **Mejora futura, NO en el alcance actual: max-width centrado en desktop.**
  El export está pensado mobile-first (390px); en pantallas anchas el
  contenido se ve estirado de borde a borde. Pendiente definir el
  max-width y el tratamiento del fondo sobrante antes de tocarlo.
- **Footer legal (Términos · Privacidad · © 2026) es de `Layout.jsx`, no de
  `VideoCall.jsx`** — vive en el `<footer>` dentro del `<main>` de Layout,
  se renderiza para toda página que use Layout. En pantallas cortas de
  contenido (ej. esta, en desktop) queda visible al fondo por espacio
  sobrante; es comportamiento global de Layout, no un bug de esta pantalla.
