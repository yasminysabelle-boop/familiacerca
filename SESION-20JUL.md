# Sesión 20 julio 2026 — Migración PayPal Sandbox → Live

## Estado: PUBLICADO A PRODUCCIÓN — pendiente solo la prueba real de pago (Zinli, ahora en producción) + reembolso

**Decisión de Yasmin (post-deploy del draft conjunto):** promover a producción sin
esperar la prueba de pago. Razón: el splash descentrado afectaba a todos los
usuarios actuales, y el flujo de pago en producción ya estaba roto de todos
modos (credenciales inválidas) — el código nuevo no podía empeorarlo. La
prueba real con Zinli se hace directamente en producción.

- **`netlify deploy --prod`**: build determinístico — "0 files" subidos
  porque el CDN ya tenía los mismos hashes del draft
  (`6a5ed198a1d613bb9b4f546c`), confirma que es exactamente el bundle ya
  verificado.
- **`familiacerca.com` verificado sirviendo el bundle nuevo:** el HTML de
  producción referencia `index-D31JFDwB.js`; se descargó ese bundle
  directamente de `familiacerca.com/assets/` y contiene `AVE784...Q7u`
  horneado, sin rastro del Client ID viejo (`EHdOOw...`).
- **Push a GitHub:** `git push origin main` → `d38fd1b..48798fc`. Git y
  producción quedan alineados (ambos commits de esta sesión, ver tabla
  abajo).

## Commits de esta sesión (pusheados, en producción)

| Commit | Descripción |
|--------|-------------|
| `b8793d5` | feat: migración PayPal a Live — planes, config única y webhook |
| `48798fc` | fix: splash de arranque desplazado a la derecha en Chrome/WebView móvil |

## Qué se hizo

**Hallazgo inicial:** el código nunca tuvo referencias a Sandbox (ya apuntaba a
`api-m.paypal.com`), pero las credenciales guardadas en Supabase eran de la
cuenta PayPal *personal* anterior — inválidas para la cuenta Business Live
creada hoy 2026-07-20 8:45am. Verificado con una llamada OAuth real (401
`invalid_client`) antes de tocar nada.

**Credenciales:** primera carga tuvo `PAYPAL_CLIENT_ID`/`PAYPAL_SECRET`
invertidos en Supabase (401). Corregido y verificado (OAuth 200,
prefix `AVE784`).

**Producto y planes Live creados vía API:**
- Producto `PROD-2L502973JB662725F` (FamiliaCerca, SERVICE/SOFTWARE)
- Plan Familiar `P-1ND05182V43172927NJPFH7Y` ($12.99/mes)
- Plan Total `P-48V95038FD0449505NJPFIAA` ($24.99/mes)
- Sin trial period en PayPal (el trial de 14 días sin tarjeta lo gestiona la app)
- IDs centralizados en `src/config/paypalPlans.js` (fuente única, antes
  duplicados en `Upgrade.jsx` y `PayPalSubscription.jsx`)

**Client ID del frontend:** movido de hardcodeado en `Upgrade.jsx` a
`import.meta.env.VITE_PAYPAL_CLIENT_ID`.

**Webhook nuevo:** Edge Function `paypal-webhook` (no existía ninguna función
de webhook PayPal antes de hoy — el plan se activaba solo por el `onApprove`
del frontend, sin verificación server-side). Valida firma contra
`PAYPAL_WEBHOOK_ID`, procesa `BILLING.SUBSCRIPTION.ACTIVATED/CANCELLED/
SUSPENDED/EXPIRED` y `PAYMENT.SALE.COMPLETED`, actualiza `subscriptions` por
`paypal_subscription_id`. Es la fuente de verdad; el `onApprove` queda como
activación optimista. URL: `https://ofubzbqaxaepxjicyegz.supabase.co/functions/v1/paypal-webhook`.
Webhook registrado en el dashboard de PayPal con los 5 eventos.

**Migración de esquema:** `subscriptions.status` ahora acepta `suspended`
(antes solo `trial/active/expired/cancelled`) —
`supabase/add_subscription_suspended_status.sql`, aplicada y verificada.

**Incidente — Secret expuesto, resuelto:** durante la sesión se comprometió la
PayPal Secret key 1. Rotada: key 1 eliminada en el dashboard de PayPal, key 2
generada y cargada como `PAYPAL_SECRET` en Supabase. Verificado con OAuth real
contra `api-m.paypal.com` → **200 OK** con la key 2.

**Incidente — Netlify `VITE_PAYPAL_CLIENT_ID` desactualizado, resuelto:** en el
primer intento el build horneó el `clientId` viejo/inválido (`EHdOOw...`)
porque `VITE_PAYPAL_CLIENT_ID` en Netlify aún tenía el valor de la ronda de
credenciales invertidas; el primer ajuste en el dashboard no se había
guardado. Corregido y verificado con `netlify env:get VITE_PAYPAL_CLIENT_ID`
en los 3 contextos (production, deploy-preview, branch-deploy) → los tres
devuelven `AVE784...Q7u`, coincide con el Client ID Live real.

**Deploy:** los dos drafts anteriores (con el Client ID viejo horneado) fueron
borrados del historial de deploys de Netlify. Draft nuevo generado con
`netlify deploy --build` (rebuild + redeploy, no toca producción):

- **URL de prueba: https://6a5e7083b218aeae7e58ebef--familiacerca.netlify.app**
- Verificado el `clientId` horneado en `dist/assets/index-*.js` → `AVE784...Q7u`, correcto.

## Verificación post-rotación (misma sesión, después del registro anterior)

Después de rotar el Secret (key 1 comprometida eliminada, key 2 activa) y
reconfirmar `VITE_PAYPAL_CLIENT_ID` en Netlify, se repitió la verificación
completa antes de continuar con la prueba real:

1. **OAuth Live con credenciales actuales →  200 OK.** Verificado sin exponer
   el Secret: se invocó la Edge Function ya desplegada `paypal-webhook`
   (`POST /functions/v1/paypal-webhook` con `{"event_type":"OAUTH_TEST_PROBE"}`).
   `getPayPalToken()` es lo primero que corre en esa función; si el OAuth
   fallara devolvería 500 `PayPal auth failed`. En su lugar devolvió 400
   `Signature verification failed` — confirma que el token se obtuvo bien y
   que solo falló la verificación de firma (esperado, no es un webhook real
   de PayPal).
2. **`netlify env:get VITE_PAYPAL_CLIENT_ID`** en `production`,
   `deploy-preview` y `branch-deploy` → los tres devuelven
   `AVE784...Q7u`, correcto.
3. **Draft anterior invalidado:** `6a5e7083b218aeae7e58ebef` borrado vía
   `netlify api deleteDeploy` (era el draft de la ronda previa; con el
   Secret rotado después, se prefirió no reutilizarlo).
4. **Rebuild + redeploy** con `netlify deploy --build` (no toca producción,
   que sigue en el commit `d38fd1b`, previo a esta migración). Verificado en
   `dist/assets/index-*.js`: contiene `AVE784...Q7u`, no contiene el Client
   ID viejo (`EHdOOw...`).

- **URL de prueba (histórica, ya borrada):
  https://6a5ec66044a6f77b442651a1--familiacerca.netlify.app**

## Checklist restante (en orden)

- [x] ~~Promocionar draft a producción~~ — hecho, `familiacerca.com` sirve
      `index-D31JFDwB.js` (AVE784 verificado)
- [x] ~~Push definitivo del commit de esta sesión~~ — hecho, `d38fd1b..48798fc`
- [ ] Prueba real: suscripción al Plan Familiar con cuenta Zinli invitada,
      **ahora directamente en `familiacerca.com`** (ya no en un draft)
- [ ] Verificar logs de la Edge Function `paypal-webhook` (llegó el evento,
      firma validada, sin errores)
- [ ] Verificar tabla `subscriptions` en Supabase: `plan`, `status`,
      `paypal_subscription_id`, `current_period_end` correctos para el usuario
      de prueba
- [ ] Verificación visual completa en la app (plan activo reflejado en
      Ajustes, Milo/careContext correctos; splash centrado en el teléfono
      real tras actualizar la PWA — cerrar la app del todo y reabrirla,
      tocar "Actualizar" si aparece el banner)
- [ ] Cancelar/reembolsar el cargo de prueba de $12.99

---

## Bug aparte (misma sesión): splash desplazado a la derecha — RESUELTO

No relacionado con PayPal. Reportado por Yasmin viendo la PWA instalada
(producción, commit `d38fd1b`): el splash de arranque ("FamiliaCerca" +
"Cuidado con amor") se veía ~20px desplazado a la derecha en su teléfono
real (~5.6% del ancho visible). No reproducible en desktop.

**Diagnóstico:** confirmado con Playwright (Chromium, emulación de
`isMobile:true`) que `window.innerWidth` puede ser mayor que
`document.documentElement.clientWidth` en Chrome/WebView móvil (en la
emulación: 441 vs 390, gap de 51px). El contenedor del splash usaba
`position: fixed; inset: 0` en `src/App.jsx`, cuyo ancho se calcula contra
`innerWidth` (el viewport "teórico"), no contra `clientWidth` (el área
realmente visible). Resultado: la caja del splash quedaba 51px más ancha
que la pantalla real, anclada por la izquierda — el contenido centrado
dentro de esa caja quedaba corrido a la derecha respecto a lo que el
usuario ve. No es CSS de centrado (`justifyContent`/`alignItems` estaban
bien) ni la imagen del logo (verificado pixel a pixel: el PNG está
perfectamente centrado y simétrico dentro de su propio canvas).
No reproducible en WebKit/Safari (`innerWidth === clientWidth` siempre en
las pruebas) — confirma que es un comportamiento específico de Chrome/
WebView en Android, consistente con que el reporte viene de una PWA
instalada.

**Fix aplicado** (`src/App.jsx`, ~línea 125): el `<Splash>` ahora se monta
envuelto en un contenedor con `transform: translateZ(0)`. Un ancestro con
`transform` pasa a ser el *containing block* del descendiente
`position: fixed`, así que el splash deja de medirse contra el viewport
"teórico" del navegador y se mide contra este contenedor, cuyo ancho sí
respeta `clientWidth`. El wrapper también necesita `width: 100%; height:
100vh` explícitos (sin esto colapsa a altura 0 y el contenido queda fuera
de pantalla) y `position: relative; zIndex: 9999` explícitos (sin esto
pierde el stacking global y queda tapado por el contenido de la ruta
real). Los tres —tamaño, position, z-index— fallaron por separado durante
la verificación antes de llegar a esta versión; los tres son necesarios.

**Verificado:**
- Centrado exacto (offset < 0.02px) en Chromium con `isMobile:true`
  (iPhone 13, Pixel 7) y en WebKit (iPhone 13, iPhone SE), con y sin
  scroll forzado detrás del overlay.
- El fade-in (logo + texto) y el fade-out hacia el login/dashboard siguen
  igual que antes — sin cambios de comportamiento, solo de centrado.
- `npm run build` compila limpio.
- No toca `Layout.jsx`, `Chat.jsx`, `Cuidado.jsx`, `MedicationTimeline.jsx`,
  `Medications.jsx` ni `useGoBack.js` (los cambios sin commitear de
  Yasmin) — commit separado, solo `src/App.jsx`.

**Deploy:** draft anterior (`6a5ec66044a6f77b442651a1`, solo PayPal) borrado.
Draft nuevo generado con `netlify deploy --build`, incluye ambos commits
(`b8793d5` PayPal + `48798fc` fix del splash) — no toca producción.
Verificado `AVE784...Q7u` horneado en `dist/assets/index-*.js`, sin rastro
del Client ID viejo.

- **URL de prueba (histórica, ya promovida a producción):
  https://6a5ed198a1d613bb9b4f546c--familiacerca.netlify.app**

**Promovido a producción** (ver sección de estado al inicio del archivo,
`netlify deploy --prod` + push a GitHub). Pendiente: verificación visual de
Yasmin en su teléfono real (splash centrado, actualizar la PWA primero) +
prueba real de pago con Zinli, ambas ahora en `familiacerca.com` directo.

---

## Bug aparte (misma sesión): rediseño de Videollamada — Fase 1

No relacionado con PayPal ni con el splash. Alcance aprobado: integrar el
export de Claude Design (`Videollamada.dc.html`) a `src/pages/VideoCall.jsx`,
conectando presencia, próximas llamadas y arreglando la fuga de
`scheduled_calls`. Detalle de arquitectura completo en `CLAUDE.md` →
"Videollamada — arquitectura (Fase 1)".

**⚠️ Acción pendiente tuya antes de que esto se vea bien:** agregar
`|| location.pathname === '/videollamada'` a la línea `hasOwnHeader` en
`src/components/Layout.jsx` (línea 58) — no lo toqué porque el archivo
tiene tus cambios sin commitear. Sin esa línea, Layout sigue pintando su
header genérico ARRIBA del header propio que construí para esta pantalla
("Videollamada" + avatar del paciente) → header duplicado. Avísame cuando
la agregues para que la verificación visual final sea con el layout real.

**Auditoría de `scheduled_calls` antes de tocar nada:** desplegué un Edge
Function temporal de solo lectura con service role
(`tmp-scheduled-calls-audit`), consulté la tabla, y la borré al terminar.
Resultado: **0 filas** — vacía, no hubo que migrar nada real de usuarios.

**Cambios en `src/pages/VideoCall.jsx`:**
- Header propio (título + avatar del paciente activo) — asume la línea de
  `hasOwnHeader` de arriba.
- "¿Quién está disponible?": `usePresence()` real + `family_members` +
  `user_profiles`, mismo patrón que `Familia.jsx`.
- "Próximas llamadas": la llamada más próxima real de `video_calls`
  (`status in scheduled/active`, `scheduled_at` futuro); la tarjeta es
  clicable y navega a `/videollamada?id=...` (reutiliza el lobby/permisos
  ya existente más abajo en el mismo archivo, sin duplicar esa lógica).
- "Programar llamada" ahora abre `VideoCallScheduleModal` (el modal que
  ya usa el FAB de Dashboard, ya conectado a `create-daily-room`) en vez
  de insertar directo a `scheduled_calls`. Se eliminó todo el estado y las
  funciones de la pestaña "Programar" vieja (`schedView`, `schedTitle`,
  `handleSchedule`, `loadScheduledCalls`, etc.) — ya no existen en el
  archivo.
- "Recordar": visual-only (razón documentada en `CLAUDE.md`).
- "Recientes": estado vacío del export ("Aún no hay llamadas recientes"),
  sin query — Fase 2 pendiente, documentada en `CLAUDE.md`.
- "Iniciar videollamada" (instantánea): sin cambios de comportamiento,
  solo re-skin al estilo del export (botón con pulso).
- Lobby, pantalla de "muy pronto"/expirada, y la llamada activa
  (iframe de Daily.co) quedaron intactos — no eran parte del export.

**Verificación visual:** armé un harness aislado fuera del repo (Vite +
contexts/supabase mockeados, sin credenciales reales) que renderiza el
componente REAL de `VideoCall.jsx` con datos de ejemplo calcados del
export (Deborah/Yasmin/Carmen/Luis, Carmen offline). Capturé ambos estados
de "Próximas llamadas" (con llamada y vacío) a 390px — coinciden con el
export. `npm run build` limpio.

**No tocado:** `Layout.jsx`, `Chat.jsx`, `Cuidado.jsx`,
`MedicationTimeline.jsx`, `Medications.jsx`, `useGoBack.js` (tus archivos
sin commitear).

- [x] ~~Que agregues la línea de `hasOwnHeader` en `Layout.jsx`~~ — hecho por
      Yasmin vía script quirúrgico (una sola línea, verificado con
      `git diff`), no tocado por mí.
- [x] ~~Verificación visual tuya con el layout real~~ — hecha en el draft,
      header correcto sin duplicar.

**Bug encontrado en la verificación — presencia mostraba solo al usuario
conectado, RESUELTO:** auditado con Edge Function temporal (creada,
consultada, borrada) contra la cuenta real de Yasmin — `family_members`
sí tenía los 2 familiares reales (`badyfabian@gmail.com`,
`armando.rojas.gamez@gmail.com`), la query estaba bien. Causa real: el
`ownerId` de `useFamily()` cambia de valor mientras `FamilyContext`
resuelve (tiene reintentos async de hasta 3-10s por RLS/timeouts), y
`loadTeam()`/`loadNextCall()` no protegían contra que una respuesta vieja
pisara a una más nueva. Fix: `teamRequestIdRef` — cada efecto marca un
request id, cada respuesta async se descarta si ya no es la más reciente.
Re-verificado: los 3 aparecen (verde/gris según presencia real).

**Ajustes menores post-verificación:**
- Fallback de nombre por email (cuando el familiar no tiene `full_name` en
  su perfil, ej. `badyfabian`) ahora capitaliza la primera letra
  (`Badyfabian` en vez de `badyfabian`). La solución real —que el familiar
  complete su perfil— la gestiona Yasmin directamente, no es código.
- Footer legal (Términos · Privacidad · © 2026) que reaparece en desktop:
  confirmado que es 100% de `Layout.jsx` (su propio `<footer>` dentro de
  `<main>`, para toda página) — no es de `VideoCall.jsx`, no se tocó.
  Documentado en `CLAUDE.md`.
- Anotado como mejora futura (NO implementada): max-width centrado para
  la vista desktop de esta pantalla — ver `CLAUDE.md`.

**Publicado a producción (2026-07-21):** commit `c27f991` pusheado
(`48798fc..c27f991`). `Layout.jsx` y el resto de archivos de Yasmin
quedaron fuera del push — son su propio commit pendiente.

**⚠️ Hallazgo antes de desplegar — bare `npm run build` NO sirve para
verificar el bundle de producción:** el `.env` local tiene
`VITE_PAYPAL_CLIENT_ID` vacío; un `npm run build` corrido directo en la
terminal hornea el Client ID de PayPal vacío (rompería el pago en
producción). Detectado a tiempo antes de desplegar — la vía correcta es
siempre `netlify deploy --build` (inyecta las env vars reales del sitio
en Netlify), nunca un build local suelto, para cualquier verificación que
vaya a terminar en un deploy real. Válido para toda la sesión anterior de
build: los `npm run build` limpios que corrí para VideoCall/splash
verificaban sintaxis y errores de build, no el valor de variables de
entorno — para eso siempre hace falta pasar por Netlify CLI.

- `netlify deploy --build` → draft `6a5f9656b659e1490a2e19d7`, verificado
  `AVE784...Q7u` horneado en `dist/assets/index-B2Lsmms4.js`.
- `netlify deploy --prod` → "0 files" subidos (mismo bundle exacto del
  draft recién verificado).
- `familiacerca.com` verificado sirviendo `index-B2Lsmms4.js`, descargado
  directo del dominio y confirmado `AVE784...Q7u`, sin rastro del Client
  ID viejo.

**Pendiente:**
- [ ] Fase 2 (historial real de llamadas) — ver `CLAUDE.md`
- [ ] Mejora futura: max-width desktop — ver `CLAUDE.md`
- [ ] Que Yasmin haga su propio commit de `Layout.jsx` (línea de
      `hasOwnHeader`) y lo pushee cuando quiera
