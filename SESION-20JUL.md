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

---

## Incidente aparte (2026-07-23): Milo/Luna caídos — key de Gemini expuesta + rotada, RESUELTO

No relacionado con PayPal ni Videollamada. Al activar una key nueva de
Gemini ("FamiliaCerca IA Key", proyecto limpio) en Supabase secrets, Milo/
Luna dejaron de responder para usuarios reales — `src/lib/gemini.js`
llamaba directo a Google con `VITE_GEMINI_API_KEY` **expuesta en el bundle
del frontend** (la key vieja, ya inválida tras la rotación).

**Fix — Edge Function `gemini-proxy` (commit `8a84891`):** mismo patrón de
auth que `gemini-vision` (JWT de usuario Supabase obligatorio, key solo en
`Deno.env`). `geminiGenerate`/`geminiChat` mantienen sus firmas —cero
cambios en Dashboard.jsx/Chat.jsx/CompanionChat.jsx/activitySummary.js.
`VITE_GEMINI_API_KEY` eliminada de `.env`/`.env.example`.

**Segundo hallazgo, más importante — `gemini-flash-latest` cambió de
modelo subyacente:** con la key nueva, ese alias ahora resuelve a una
generación más nueva (`gemini-3.6-flash`) que **rechaza
`thinkingConfig.thinkingBudget: 0`** (`400 INVALID_ARGUMENT`) — antes se
usaba budget:0 para no gastar tokens "pensando". Confirmado que
`gemini-vision` (sin tocar) fallaba exactamente igual, descartando que
fuera un bug del proxy nuevo. Además, un budget bajo NO se respeta como
techo estricto — el modelo puede gastar cientos de tokens pensando de
todos modos, y esos tokens cuentan contra `maxOutputTokens`, truncando la
respuesta a vacío si el techo es chico. **Fix:** `thinkingBudget: 256` +
margen fijo de +700 tokens sobre el `maxOutputTokens` pedido, del lado del
servidor en `gemini-proxy`. Detalle completo y cómo re-diagnosticar si
Google vuelve a rotar el alias: ver `CLAUDE.md` → "Proxy de Gemini".

**Verificado end-to-end sin credenciales de usuario real:** signup
desechable vía email `@familiacerca-test.invalid` (TLD reservado, auto-
confirm activado en el proyecto → devuelve JWT real en el mismo response;
sign-in anónimo está deshabilitado). Con ese JWT: `generate` y `chat`
devuelven texto real de Gemini (200), sin token devuelve 401. Draft
promovido a Yasmin, confirmado por ella con su usuario real: Milo/Luna,
resumen narrado y "Ponte al día" funcionando.

**Deploy y verificación del bundle público:**
- Push: `git push origin main` → `45c0359..8a84891`.
- `netlify deploy --prod --build` (build gestionado por Netlify con las
  env vars reales del sitio) → `familiacerca.com` sirve
  `index-Cqf4KA0P.js`. Descargado directo del dominio: **cero** referencias
  a `VITE_GEMINI`, **cero** llamadas directas a
  `generativelanguage.googleapis.com`, string `gemini-proxy` presente
  (confirma que el frontend pasa por el proxy). El único match de
  `AIzaSy` en el bundle es el `apiKey` público de Firebase (esperado, no
  es la key de Gemini).

**⚠️ Casi repito el incidente de PayPal del 20 jul (bare `npm run build`
horneando env vars locales vacías) — sin impacto real, pero anótalo:**
antes de este cierre corrí `npm run build` local (no `netlify deploy
--build`) y subí ese `dist/` directo a producción con `netlify deploy
--dir=dist --prod`. Al releer esta misma nota de la sesión de PayPal
noté el riesgo y verifiqué: el `.env` local tiene `VITE_PAYPAL_CLIENT_ID`
**vacío** (confirmado reproducible con un rebuild limpio — un `npm run
build` local hoy hornea el Client ID de PayPal vacío, igual que el 20
jul). Sin embargo, el `dist/` que efectivamente llegó a producción en
esta sesión sí tenía el Client ID correcto horneado (`AVE784...`,
verificado en el bundle servido por `familiacerca.com` antes de tocar
nada más) — no se rompió nada esta vez. Para eliminar cualquier duda
igual re-desplegué con `netlify deploy --prod --build` (la vía correcta,
usa las env vars reales del sitio en Netlify) — mismo hash de bundle,
sin cambios funcionales, pero ahora construido por el proceso correcto.
**`VITE_POSTHOG_KEY` también está vacío en el `.env` local** (no crítico,
solo analytics). Regla para toda sesión futura: en este repo, **nunca**
`npm run build` + deploy manual de `dist/` para nada que vaya a
producción o a un draft de verificación — siempre `netlify deploy
--build` (o `--prod --build`), sin excepción, por el mismo motivo que ya
costó un incidente el 20 jul.

---

## Videollamada — Fase 2, CERRADA y en producción (2026-07-23)

Retomado después del incidente de Gemini. Alcance: integrar Daily.co
Prebuilt (`@daily-co/daily-js`) con theme propio, lobby con presencia
real, simplificar `VideoCallScheduleModal.jsx`, y adoptar un hook de
"volver" (`useGoBack`) que deshace el paso real de navegación en vez de
caer siempre a `/dashboard`. Detalle de arquitectura completo en
`CLAUDE.md`.

**⚠️ Hallazgo importante — el código ya estaba de facto en producción
antes de commitearse:** estos cambios llevaban sin commitear desde antes
de empezar con el incidente de Gemini. Un build (local o vía Netlify)
compila lo que hay en el disco de trabajo, no lo que está commiteado en
git — así que cada deploy hecho durante el cierre de Gemini (incluida la
promoción a producción) ya incluía este código de Videollamada sin que
git lo reflejara. La única pieza que faltaba de verdad era la Edge
Function `get-call-presence`, recién desplegada en este cierre — antes
de eso, el polling de presencia en el lobby fallaba en silencio (falla
soft, sin error visible) para cualquiera que entrara a `/videollamada` en
producción durante esa ventana. Sin reportes de usuarios afectados.

**Revisión de coherencia antes de tocar nada:** `git diff` completo de
los 12 archivos (`VideoCall.jsx`, `VideoCallScheduleModal.jsx`,
`useGoBack.js`, `get-call-presence`, `Layout.jsx`, `Chat.jsx`,
`Cuidado.jsx`, `Medications.jsx`, `MedicationTimeline.jsx`,
`Dashboard.jsx`) + build + lint — coherente y completo, nada a medio
romper. Los errores de lint que salieron son ruido preexistente de todo
el proyecto (variables sin usar en `Medications.jsx`/`Dashboard.jsx`, una
regla nueva `react-hooks/set-state-in-effect` que marca el patrón
`useEffect`+fetch usado en toda la app por igual), no algo introducido
por este trabajo.

**Bug encontrado y corregido — modal "Programar llamada" se salía de la
pantalla:** con 2+ llamadas en "Programadas", el contenido excedía la
altura del modal sin poder scrollear (el bug clásico de un hijo flex que
necesita `minHeight: 0` explícito para que `overflow: auto` funcione en
vez de estirarse fuera del contenedor). Fix: el modal se divide en una
zona fija arriba (header + formulario, `flexShrink: 0`) y una zona
scrolleable abajo (divisor "Programadas" + lista, `flex: 1, minHeight: 0,
overflowY: 'auto'`). Además, 32px de aire fijo bajo la última tarjeta
(además del `safe-area-inset-bottom`, que puede ser 0 en desktop/algunos
navegadores) para que nunca quede pegada al borde.

**Verificación visual sin navegador interactivo disponible:** armado un
harness estático fuera del repo con el CSS exacto del componente (mismo
patrón que la verificación de VideoCall.jsx en Fase 1), 5 llamadas de
prueba y viewport reducido a propósito para forzar overflow real.
Confirmado con Playwright: el panel nunca se sale de la pantalla, la
región scrolleable sí scrollea (`canScroll: true`), el botón "Programar"
queda en el mismo píxel antes y después de scrollear la lista (confirma
que el formulario de arriba queda fijo), y el gap final medido en
píxeles reales es de 32.0px exactos. Yasmin confirmó en su teléfono real
con llamadas reales antes del commit.

**No verificado directamente (código revisado, no clickeado en vivo):**
el theme de Daily Prebuilt (`DAILY_THEME`, colores del iframe al unirse a
una llamada real) y la navegación real de `useGoBack` en Chat/Cuidado/
Medicamentos/Historial — ninguno de los dos requiere cámara/micrófono
real ni sesión autenticada interactiva, que no están disponibles en este
entorno. Riesgo aceptado como bajo (cosmético/navegación, sin impacto en
datos) dado que ya llevaban un rato de facto en producción sin reportes.
Pendiente: que Yasmin confirme si nota algo raro en cualquiera de los dos.

**Deploy:**
- Commit `8975964` (`1c7ee8a..8975964`), separado del commit de Gemini
  (`8a84891`).
- `netlify deploy --prod --build` → `familiacerca.com` sirve
  `index-Bz2fVHzW.js`. Verificado en el bundle: `gemini-proxy` y
  `get-call-presence` presentes, `AVE784...` (PayPal) correcto, el CSS
  `safe-area-inset-bottom) + 32px` presente.
- `get-call-presence` desplegada (antes solo existía el archivo, nunca se
  había desplegado). Verificada: 401 sin auth, 400 sin `callId`, 404 con
  `callId` inexistente — el guard de acceso funciona. La consulta real a
  la presence API de Daily.co (con una sala real) queda pendiente de
  verificación por Yasmin, no reproducible sin crear una sala de pago.

**Pendiente (sin cambios, hereda de Fase 1):**
- [ ] Historial real de llamadas (webhook `meeting.ended` de Daily.co) —
      ver `CLAUDE.md`

---

## Rediseño de /familia — CERRADO y en producción (2026-07-23)

Pantalla principal de familia ("Familiar a cuidar", "¿Quién cuida hoy?",
calendario semanal, "Equipo de cuidado"), `src/pages/Familia.jsx`.
Diagnóstico previo (PASO 0) en el hilo de la sesión — no repetido aquí.

**Colores y tipografía:** reemplazado el verde vivo `#0d6b63` (discontinuado
según `CLAUDE.md`) y sus gradientes con `#2D6A4F`/`#3A6347` por teal oficial
`#087F70` en los ~30 usos (botones, badges, iconos, avatares, tarjeta de la
persona a cuidar). Georgia/serif → Plus Jakarta Sans en toda la pantalla,
incluidos los modales de miembro/turno/invitación. Se quitó "38 años" de la
tarjeta de la persona. Marca de agua nueva en teal, mismo trazo SVG que
`VideoCall.jsx` (no existía ninguna en esta pantalla antes, ni Dashboard.jsx
tiene una — solo VideoCall).

**Header compartido corregido aparte:** el bloque verde oscuro de arriba
("Familia de Deborath") no vivía en `Familia.jsx` sino en el header
compartido de `Layout.jsx`. Se agregó `/familia` a su lista `isLightHeader`
— mecanismo que ya existía en el código pero era código muerto (las otras 4
rutas que lo tenían asignado ya dibujan su propio header, así que nunca se
ejecutaba). Al activarlo se encontró que `FamilySwitcher.jsx` (el chip
"Familia de X" dentro de ese header) tenía el texto hardcodeado en blanco,
asumiendo fondo oscuro — se le agregó un prop `isLight` que Layout solo
pasa como `true` para `/familia`; ninguna otra pantalla cambia.

**Sección "Hoy" nueva** (medicación pendiente + próxima cita, sin backend
nuevo) — pasó por dos rondas de bugs reales antes de aprobarse:

1. Primera versión mostraba una fila de "actividad reciente"
   (`activity_log`) que resultó ser ruido: un trigger (`trg_care_routine`
   en `add_care_routine_status_and_activity_log.sql`) auto-registra
   `actor_name='Sistema automático'` cuando algo de la rutina diaria queda
   sin marcar al cerrar el día — dato real de producción, pero no
   accionable para la sección. Se quitó esa query por completo.
2. La sección aparecía completamente vacía pese a haber medicamentos
   claramente pendientes en Medicamentos ("Hoy"). Causa doble, encontrada
   comparando línea por línea contra `Medications.jsx` (fuente de verdad):
   - Fecha calculada con `new Date().toISOString()` (UTC) en vez de
     `getTodayPR()` (`lib/utils.js`, Puerto Rico/Venezuela) — el helper que
     usa el resto de la app (`Medications.jsx`, `careContext.js`,
     `CareRecord.jsx`).
   - Más importante: la query filtraba `medication_logs.status='pending'`,
     pero **esa fila nunca existe** — confirmado en `Medications.jsx`
     (línea 910-912) que "pendiente" ahí se calcula como *ausencia* de un
     log `confirmed`/`missed` hoy, comparando la hora programada contra la
     hora actual. `loadTodayGlance()` se reescribió para replicar esa
     misma lógica (trae `medications` + logs de hoy, calcula pendientes
     client-side, excluye "tarde" — esas se auto-marcan `missed` aparte —
     ordena por hora, toma la más próxima). Badge "Pendiente" en dorado
     `#7A5A18`/`#FEF3C7`, mismo par ya usado en este archivo para
     "Invitación pendiente".

**Bug preexistente corregido de paso:** el calendario "¿Quién cuida hoy?"
tenía el mismo bug de fecha UTC (`care_shifts.shift_date` comparado con
`today.toISOString().split('T')[0]`) — no reportado originalmente, pero
mismo root cause fresco, corregido en el mismo pase con `getTodayPR()`/
`getDatePR()`.

**Verificación:** build + lint limpios en cada iteración (mismo ruido
preexistente del proyecto, nada nuevo). Sin navegador interactivo
disponible, se armó dos veces un harness visual estático (mismo patrón que
VideoCall/VideoCallScheduleModal en Fase 1/2) para revisar paleta, header y
la tarjeta "Hoy" antes de cada draft. Las queries nuevas (`scheduled_times`,
`time_window_minutes`) se probaron contra la API real con un usuario
desechable (`@familiacerca-test.invalid`) para confirmar que no hay error
de columna/RLS. Yasmin confirmó en su teléfono real con Losartán/Metformina
reales que "Hoy" coincide exactamente con lo que muestra Medicamentos.

**Deploy:** commit `a374332` (`7ed5642..a374332`), separado de Videollamada
y de Gemini. `netlify deploy --prod --build` → `familiacerca.com` sirve
`index-BG7dtdxy.js`.
- [ ] Mejora futura: max-width desktop — ver `CLAUDE.md`

---

## Header claro extendido a todas las rutas del Layout — CERRADO (2026-07-23)

Después del rediseño de `/familia`, inventario completo del router: de las
~32 rutas, solo Dashboard/Chat/Cuidado/Historial/Medicamentos/Todo el
cuidado/Videollamada dibujan su propio header (`hasOwnHeader`); el resto
dependía del header compartido de `Layout.jsx`, que antes de este cambio
solo trataba como "claro" a 5 rutas — 4 de ellas ya cubiertas por
`hasOwnHeader` (código muerto en la práctica) y `/familia` (agregada esta
misma sesión, ver sección anterior). Todo lo demás (Calendar, Notes,
Album, Memorias, Reportes, Gastos, Directorio, Ajustes, Perfil paciente,
Upgrade, Admin, Diario médico, Registros, Incidentes, Roles) seguía
viendo el bloque verde oscuro `#0B4F4A`, sin importar si el contenido de
esa pantalla ya estaba migrado o no (caso `Reports.jsx`, que ya tenía
paleta nueva pero header viejo).

**Diagnóstico previo importante:** la lista que se iba a migrar incluía
algunas rutas que en realidad no pasan por el header de Layout en
absoluto — `NotasFamilia`, `Permissions` y `Pricing` no importan
`Layout` — agregarlas a `isLightHeader` no habría tenido ningún efecto.
Se corrigió la lista a las 15 rutas que sí aplican antes de tocar código.

**Cambio:** `isLightHeader` pasó de una cadena de `===` encadenados a un
`Set` (`LIGHT_HEADER_PAGES`, más manejable con 15+ entradas), con las 15
rutas correctas agregadas. `FamilySwitcher.jsx` no necesitó ningún cambio
nuevo — el prop `isLight` que ya se le agregó para `/familia` es genérico
a nivel de Layout, así que se beneficia automáticamente en cuanto una
ruta entra a la lista.

**Bug encontrado al ampliar el alcance:** el título del header claro
nunca tuvo protección contra overflow — con "Mi Familia" (10 caracteres)
nunca se notó, pero títulos más largos que ahora sí pasan por esa rama
("Permisos de acceso", "Perfil del paciente", 18-19 caracteres) podían
desbordar en pantallas angostas junto al chip de `FamilySwitcher` y el
avatar. Se agregó el mismo truncado con ellipsis que ya usa la rama
`isSecondary` del mismo header. Verificado con Playwright a 360px: trunca
limpio con "...", sin desbordar.

**No se tocó:** `hasOwnHeader` (Dashboard/Chat/Cuidado/Historial/
Medicamentos/Todo el cuidado/Videollamada dibujan su header exactamente
igual que antes) ni el contenido interno de ninguna pantalla — este
cambio es solo el header compartido.

**Verificación:** Yasmin confirmó en su teléfono real Calendar, Settings,
Directory y Roles (caso de título largo) con header claro correcto y
texto legible; confirmó que Dashboard y Videollamada no cambiaron.

**Deploy:** commit `de4b800` (`03b70dc..de4b800`), separado de todo lo
demás. `netlify deploy --prod --build` → `familiacerca.com` sirve
`index-C7ZXJcpA.js`.

**Pendiente:** la migración de paleta/tipografía del *contenido* de cada
pantalla (colores viejos `#0d6b63`/`#3A6347`/`#143C32`, Georgia puro) sigue
sin tocar — esto fue solo el header. Inventario completo de qué pantalla
falta migrar en el hilo de la sesión (no volcado a este archivo todavía).

---

## Migración de /gastos (Expenses.jsx) — CERRADA, y hallazgo de componentes compartidos (2026-07-23)

**Decisión de paleta de categorías (Yasmin):** el sistema de color por
categoría de gasto se mantiene — solo Medicamentos/Transporte (que usaban
el verde vivo `#0d6b63`) pasan a teal `#087F70`. Azul `#2D86A0`, dorado
`#C9882A` y gris `#9CA3AF` de las demás categorías quedan intactos: no son
parte de la paleta discontinuada de `CLAUDE.md`, cumplen una función real
de diferenciación visual, y tocarlos sería un rediseño de sistema de
categorías aparte, no pedido hoy. `#D63031` (eliminar/error) también
intacto — semántico, ya exceptuado por `CLAUDE.md`.

**Cambios en Expenses.jsx:** tarjeta "Total del mes" de gradiente oscuro
(`#0d6b63`+`#2E5240`, una tercera variante de verde oscuro no vista antes
en ninguna otra pantalla) a tarjeta blanca con el monto en teal — mismo
patrón que Familia/Videollamada. FAB, botón "Reintentar", medalla/%/barra
de "¿Quién aportó más?", y "Tomar foto"/"Elegir de galería" — todo el
verde vivo restante a teal sólido. 5 títulos en Georgia puro → Plus
Jakarta Sans. Marca de agua nueva en teal. Estructura y contenido sin
cambios.

**Hallazgo importante — el barrido por archivo de pantalla no alcanza:**
al pedir revisar el modal completo, aparecieron 4 componentes
*compartidos* con el mismo resabio, que un `grep` sobre `Expenses.jsx`
nunca iba a encontrar porque el color vive en el componente importado, no
en la página:

| Componente compartido | Dónde aparece en /gastos | Otras pantallas que también lo heredaban |
|---|---|---|
| `LoadingButton.jsx` | Botón "Guardar gasto" | **Chat.jsx y Medications.jsx** — ya dadas por migradas, tenían este resabio sin que nadie lo notara |
| `EmptyState.jsx` | "Sin gastos este mes" | Dashboard, Cuidado, Calendar, Directory, Medications |
| `EvidencePhoto.jsx` | Link "tomar/subir foto" del recibo | Cuidado, Incidents, Medications |
| `Paywall.jsx` | Bloqueo por prueba vencida (global, vía `Layout.jsx`) | Todas las pantallas |
| `PaywallModal.jsx` | Modal de prueba vencida al agregar gasto | **Familia.jsx** (recién migrada), DiarioMedico, Notes, Medications |

Los 5 se corrigieron (gradiente → `#087F70` sólido, Georgia puro → Plus
Jakarta Sans) — mismo commit que Expenses.jsx. Esto significa que
Chat.jsx, Medications.jsx y Familia.jsx quedaron un poco más migradas de
lo que ya estaban, como efecto colateral correcto.

**Candidatos pendientes para una limpieza sistemática de componentes
compartidos (sesión futura, NO tocados ahora — ninguno se renderiza en
`/gastos`):** un barrido de `src/components/*.jsx` completo encontró estos
~15-18 archivos más con `#0d6b63`/`#3A6347`/Georgia puro:

`CareCard.jsx`, `CompanionChat.jsx`, `DiarioMedicoEntryModal.jsx`,
`EmergencyAlert.jsx`, `FamilySelector.jsx`, `FamilySwitcher.jsx` (el chip
del header ya se arregló — queda el modal "Tus familias" del propio
componente), `InstallBanner.jsx`, `InstallPrompt.jsx`, `Layout.jsx` (el
header ya se arregló — queda al menos el botón del banner de
inactividad), `Logo.jsx`, `MedicationDetail.jsx`, `MemberOnboarding.jsx`,
`PWAInstallBanner.jsx`, `PayPalSubscription.jsx`, `ProtectedRoute.jsx`,
`TrialBanner.jsx` (usado en Dashboard), `VoiceInput.jsx`,
`VoiceRecorder.jsx`, `WelcomeSlides.jsx`. (`Icons.jsx` también matchea
pero es solo un comentario de ejemplo, no código real — no cuenta.)

**Lección para toda migración de pantalla futura:** no basta con `grep`
sobre el archivo de la página — hay que revisar también qué componentes
compartidos importa y renderiza, porque el resabio puede vivir ahí y
quedar invisible para un barrido por archivo.

**Deploy:** commit `dd429eb` (`136d665..dd429eb`), separado de todo lo
demás. `netlify deploy --prod --build` → `familiacerca.com` sirve
`index-8vGJFLk5.js`. Yasmin confirmó en su teléfono con un gasto real de
prueba ($10, Medicamentos) que todo se ve correcto, incluido el botón ya
sin gradiente.

---

## Barrido de componentes compartidos — Tanda 1 (mayor impacto) — CERRADA (2026-07-23)

Continuación del hallazgo de `/gastos`: se inventariaron ~15-18
componentes compartidos con el patrón viejo, ordenados por impacto real
(rutas donde el resabio es visible). Yasmin aprobó empezar por los 5 de
mayor alcance:

- **`Layout.jsx`** (~24 rutas) — título Georgia→Sans, avatar `#143C32`
  →`#334155`, bordes/sombras `rgba(20,60,50,X)`→`rgba(8,127,112,X)` (era
  `#143C32` con transparencia), botón del banner de inactividad y los
  fallbacks `hdrBg`/`navBg` `#0d6b63`/`#0B4F4A`→`#087F70`.
- **`FamilySwitcher.jsx`** (~24 rutas, vía Layout) — el chip del header ya
  se había arreglado antes; esta vez el modal "Tus familias" completo
  (título, rol admin, borde activo, avatar, "✓ Viendo", botón "Ver →").
- **`InstallBanner.jsx`** (~24 rutas, global vía Layout + JoinFamily +
  Landing) — check del paso 3 de iOS, título, franja de Android.
- **`ProtectedRoute.jsx`** (todas las rutas protegidas, pantalla de
  carga/error transitoria) — texto y botón "Reintentar".
- **`Logo.jsx`** (~10 rutas directas + 5 componentes que lo anidan) —
  verificados los 14 usos del componente en el código antes de tocar el
  color: la variante `light` (blanca) siempre se usa sobre fondo oscuro/
  foto, `default` siempre sobre fondo claro. Solo se cambió el tono de
  `default` (`#0d6b63`→`#087F70`), la rama `light` no se tocó.

**Verificación:** harness visual estático (mismo patrón de siempre) para
header claro + modal "Tus familias" + logo en ambas variantes, antes del
draft. Yasmin confirmó en su teléfono: Dashboard, Ajustes/Calendar, el
modal "Tus familias", y Login (logo sigue blanco) — todo correcto.

**Hallazgos aparte durante la verificación, resueltos en la misma
sesión:**

1. **Bug de navegación — "Permisos de acceso" en Todo el cuidado
   navegaba al Dashboard.** Causa: `TodoElCuidado.jsx` apuntaba a
   `/permisos` (`Permissions.jsx`, la pantalla de solicitud de permisos
   de *dispositivo* — cámara/micrófono/galería — del onboarding), que se
   auto-salta a `/dashboard` vía `localStorage` en cuanto ya se completó
   una vez. La pantalla real de "Permisos de acceso" (roles del equipo de
   cuidado) es `FamilyRoles.jsx` en `/roles` — mismo destino que ya usaba
   bien el menú equivalente en `Settings.jsx`. Fix: una línea en
   `TodoElCuidado.jsx`, commit `b7c4c37`.

2. **Unificación de pagos — Stripe seguía siendo el camino real para
   casi todo el mundo, no solo texto residual.** Al aclarar la pantalla
   "Planes y precios" (`Pricing.jsx`), se descubrió que **no es un resto
   visual** — `createCheckoutSession()` invoca de verdad la Edge Function
   `create-checkout`, que crea un Stripe Customer y una Checkout Session
   reales. `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/price IDs siguen
   cargados en Supabase secrets. Casi todos los disparadores reales de
   "actualiza tu plan" (`Paywall.jsx` global, `PaywallModal.jsx` en
   Familia/DiarioMedico/Notes/Medications/Gastos, `TrialBanner.jsx` en
   Dashboard, el intento de editar en modo solo-lectura de Calendar y
   Notes, "Planes y suscripción" tanto en Todo el cuidado como en
   Ajustes) mandaban a `/pricing` (Stripe) — solo "Mejorar mi plan" en
   Ajustes ya apuntaba a `/upgrade` (PayPal, el sistema oficial desde la
   migración del 20 jul).

   **Verificación antes de tocar nada:** `supabase db query` de solo
   lectura contra `subscriptions` — 11 filas, solo 1 con
   `stripe_customer_id` (y ninguna con `stripe_subscription_id`): un
   checkout abandonado de 2026-05-14, nunca pagado, sin actividad desde
   2026-05-27. Cero suscripciones activas o pagas por Stripe. Nada real
   que migrar — seguro desconectar la navegación.

   **Fix:** los 7 disparadores redirigidos a `/upgrade`. **No se tocó**
   `Pricing.jsx`, `create-checkout`, `stripe-webhook`, `create-portal` ni
   las keys de Stripe — decisión explícita de Yasmin de dejarlos ahí sin
   uso (por si sirven de respaldo/auditoría) en vez de borrarlos ahora;
   esa decisión de apagar el backend de Stripe queda para otra sesión.
   Commit `0265793`.

**Pendiente — hallazgo nuevo, NO es un componente compartido:**
`src/pages/Admin.jsx` (ruta `/admin`, "Panel de administración", tabs
Equipo/Cuenta/Datos/Actividad) tiene su propio header en gradiente
oscuro (`linear-gradient(135deg, #0B4F4A, #1A3A12)` — `#1A3A12` es una
**quinta** variante de verde oscuro no vista en ningún otro archivo) y
título en Georgia puro. No es parte del barrido de componentes
compartidos — es contenido propio de esa pantalla (mismo tipo de trabajo
que Familia.jsx o Gastos: header/hero interno de la página). Ya estaba
en el inventario original de rutas con "3 resabios", pero se subestimó
por contar sin abrir el archivo a ver qué eran esos 3 hits — lección
repetida de la de Fraunces. Queda pendiente como su propia migración de
pantalla completa (paleta + tipografía de `/admin` entero), sesión
futura, sin tocar todavía.

**Deploy:** 3 commits separados — `b7c4c37` (bug de permisos), `0265793`
(unificación de pagos), `d86e6fd` (Tanda 1 de componentes compartidos).
`netlify deploy --prod --build` → `familiacerca.com` sirve
`index-W0NpbcK1.js`.

---

## Migración de /admin (Panel de administración) — CERRADA (2026-07-24)

`src/pages/Admin.jsx` + sus 4 secciones en `src/components/admin/`
(`AdminTeamSection`, `AdminAccountSection`, `AdminDataSection`,
`AdminActivitySection`). Header ya estaba en `LIGHT_HEADER_PAGES` desde
la migración anterior — este trabajo fue solo el contenido interno.

**Colores:** el header propio de la página tenía un gradiente
`linear-gradient(135deg, #0B4F4A, #1A3A12)` — `#1A3A12` resultó ser una
**quinta variante** de verde oscuro, nunca vista en ningún otro archivo
del proyecto. Migrado al mismo patrón de tarjeta clara que Familia.jsx/
Gastos (blanco, ícono en teal claro `#A8E5D6`, texto `#334155`). Tab
activo `#0B4F4A`→`#087F70`. 6 usos más de `#0d6b63` repartidos en las 4
secciones (Equipo, Cuenta x2, Datos x2) a teal oficial. 3 Georgia puro a
Plus Jakarta Sans. Marca de agua nueva. `AdminActivitySection.jsx`
mantiene su sistema de color por tipo de actividad (azul/morado/dorado/
azul oscuro para nota/voz/gasto/documento/videollamada) — mismo criterio
que Expenses.jsx, solo los 2 tipos en verde vivo (medicamento
confirmado, visita anotada) cambiaron. Sin cambios de estructura.

**Hallazgo de Stripe — tercer punto de contacto real, no cubierto en la
unificación de pagos anterior:** `AdminAccountSection.jsx` tenía dos
botones ("Gestionar suscripción", siempre visible; "⭐ Ver planes y
precios", solo si prueba vencida/plan free) que llamaban a
`createPortalSession()` (`lib/stripe`), abriendo el **Portal de
Facturación real de Stripe** vía `window.location.href`. La sesión
anterior solo había cubierto los `navigate('/pricing')` — este era un
mecanismo distinto (redirección directa), por eso se escapó.

**Antes de asumir que ambos botones debían ir al mismo lugar,** se
verificó `Upgrade.jsx`: muestra el plan activo como "Tu plan actual"
deshabilitado, pero **no tiene ninguna opción de cancelar o gestionar
facturación** — es solo vitrina de planes/checkout. La cancelación real
ya existe, completa, en `Settings.jsx` (`/ajustes`): mensaje de
retención, confirmación, llamada a la Edge Function
`cancel-paypal-subscription`. Por eso los dos botones quedaron con
destinos distintos: **"Gestionar suscripción" → `/ajustes`** (donde está
cancelar), **"Ver planes y precios" → `/upgrade`** (donde está
suscribirse/cambiar de plan). Se quitó `createPortalSession`/`openPortal`
y el estado `loading`/`error` de este archivo (sin uso ya); no se tocó
`lib/stripe.js` ni la Edge Function `create-portal`.

**Verificación:** build + lint limpios, harness visual estático antes
del draft. Yasmin confirmó en su teléfono los 4 tabs — especialmente que
"Ver planes y precios" lleva a `/upgrade` con los botones reales de
PayPal, y "Gestionar suscripción" lleva a `/ajustes` (Mi Cuenta).

**Pendiente, anotado por Yasmin — NO tocar todavía:** el header de
"Mi Cuenta" (`Settings.jsx`, ruta `/ajustes`) sigue con un bloque verde
oscuro sólido — parece ser un header propio de esa pantalla (no el
compartido de `Layout.jsx`, que ya está migrado para esa ruta). Queda
para una sesión futura junto con el resto de la migración de contenido
de `Settings.jsx` (que ya sabíamos, por el inventario original de rutas,
que tiene 21 resabios sin migrar).

**Deploy:** 2 commits separados — `7e6c65a` (diseño de `/admin`),
`239d211` (desconexión del Portal de Stripe). `netlify deploy --prod
--build` → `familiacerca.com` sirve `index-Dk30GtBY.js`.

---

## Hallazgo pendiente (2026-07-25): paleta dual `#087F70` / `#0B4F4A` — decidir en sesión futura

Surgió durante una auditoría de UX de fricción de entrada (voz vs. texto
libre), al verificar si `CareRecord.jsx` (`/registros`, "Síntomas físicos
del día") tenía resabios de la paleta vieja (`#0d6b63`/`#3A6347`/
`#2D6A4F`).

**Verificado con grep:** `CareRecord.jsx` tiene **cero** coincidencias de
esos tres colores. Usa `#0B4F4A` + `#3D6128` (header degradado, borde y
fondo de los chips seleccionados, botón guardar).

**No es un resabio — es un segundo sistema de color vigente:** `#0B4F4A`
aparece en 13 archivos activos y ya migrados/modernos: `Dashboard.jsx`,
`PatientProfile.jsx`, `Directory.jsx`, `Incidents.jsx`,
`OnboardingFlow.jsx`, `FamilyRoles.jsx`, `NotasFamilia.jsx`,
`Upgrade.jsx`, `Settings.jsx`, `EmptyState.jsx`, `PayPalSubscription.jsx`,
`MedicationTabs.jsx`, `generateMedicalReport.js`. `Incidents.jsx` en
particular ya fue tocado por la migración teal reciente (commit
`d2bf416`, fuente/spinner `#0d6b63`→`#087F70`) y ese pase **dejó
`#0B4F4A` intacto a propósito** — confirma que hoy conviven dos teales
oficiales: `#087F70` (acento/CTA/botones primarios) y `#0B4F4A` (headers y
selección en pantallas "clínicas": Registros, Incidentes, Diario Médico,
Perfil del paciente, Directorio).

**Pendiente — decisión de Yasmin para sesión futura:** ¿unificar todo a
`#087F70`, o mantener el sistema dual intencionalmente (un teal para
acción, otro para contexto clínico)? No tocado — anotado solo como
hallazgo, sin cambios de código en esta sesión.

---

## Fase 1 de optimización UX (voz > foto > selección > texto libre) — CERRADA (2026-07-25)

Auditoría de fricción de entrada del cuidador (todas las pantallas:
Medicamentos, Cuidado, Historial, Chat, Notas, Registros, Diario Médico,
Gastos, Incidentes, y luego ampliada a Directorio, Calendario, Onboarding,
Perfil del paciente, Familia, Álbum, Permisos, Ajustes). Clasificación
🟢 óptimo / 🟡 mejorable / 🔴 alto esfuerzo por campo, sin editar nada
hasta tener el diagnóstico completo aprobado.

**Hallazgos de la auditoría (sin cambios de código):**
- Dos pantallas de "Notas" duplicadas escribiendo a la misma tabla
  (`Notes.jsx` en `/notes`, sin ningún punto de entrada en la navegación
  actual — huérfana; `NotasFamilia.jsx` en `/paciente/notas-familia`, la
  que sí usan Dashboard/notificaciones).
- `CareSchedule.jsx` (`/cuidado/horarios`) es una pantalla completa
  duplicada de la pestaña "Horarios" de `Cuidado.jsx`, ya sin ruta activa
  (redirect en `App.jsx`) pero el archivo sigue vivo en el repo.
- Campos de renovación de stock (`renewalMethod`, `pharmacyName`,
  `refillsRemaining`, `lastMailDate`) se guardan y se muestran en
  `MedicationStockTab.jsx`, pero no hay ningún input en el formulario de
  Agregar/Editar medicamento para llenarlos — función a medio construir.
- El modal "Registrar omisión" de dosis (Medicamentos) no tiene ningún
  botón que lo abra en el código actual — vestigio inalcanzable, no
  tocado (fuera de alcance de esta fase).
- Ya existían **4 patrones distintos** de captura de voz en el código
  antes de esta fase: `VoiceInput.jsx` (Diario Médico), `MicButton` +
  `useSpeechToText` directo (Chat, Notas), `VoiceRecorder.jsx`
  (NotasFamilia, grabación principal de Diario Médico), y una
  implementación propia dentro de `PatientProfile.jsx` (`VoiceArea`, sin
  `continuous`, un solo resultado por toque — resultó ser el único de los
  4 que no comparte el bug de duplicación descrito más abajo).

**Cambios implementados (commits separados por pantalla, todos con draft
+ verificación de Yasmin antes de commit/push):**
- Gastos: voz en "Descripción"; "Pagó \*" pasa de texto libre obligatorio
  a mostrarse precargado y de solo lectura con un botón "Cambiar" —
  se mantuvo editable (no solo-lectura fijo) porque el campo se usa de
  verdad para atribuir gastos a otro familiar distinto de quien los
  registra (ver "¿Quién aportó más este mes?").
- Registros (`CareRecord.jsx`): voz en "Notas".
- Incidentes: voz en "Descripción".
- Calendario: campo de fecha con máscara manual `dd/mm/aaaa`
  (`dateDisplay`/`handleDateInput`/`dateError`, parseo custom) reemplazado
  por `<input type="date">` nativo — el único valor real usado en toda la
  pantalla ya era `form.date` en ISO (guardado, consultado y comparado
  así en `fetchEvents`/`eventsOnDay`/`openEdit`); la máscara era solo de
  presentación, confirmado antes de tocar el código que no rompía nada.
  Voz agregada en "Título", "Descripción" y "Notas de la cita" (modal de
  prueba de asistencia). "Título" perdió el `required` nativo del HTML al
  dejar de ser un `<input>` plano — se agregó el guard equivalente en
  `handleSubmit`.

**Bug crítico encontrado a mitad de la fase — duplicación de texto en
dictado por voz, RESUELTO DE RAÍZ:** Yasmin reportó un registro real en
"Historia de cuidado" con el texto `"visita visita visita visita visita
al visita al ginecólogo visita al ginecólogo"`. Diagnóstico confirmado
con consulta directa a la base (`supabase db query --linked`, sin tocar
nada): el dato vivía en `care_expenses.description` (gasto de prueba de
$12, creado hoy — el campo "Descripción" agregado en esta misma fase).
"Historia de cuidado" es `MedicationTimeline.jsx` (`/historial`) — un
timeline de solo lectura que agrega eventos de varias tablas (incluida
`care_expenses`); no es una pantalla duplicada, solo estaba reflejando
correctamente el dato ya corrompido en el origen.

**Causa raíz:** `useSpeechToText.js` (hook compartido detrás de **todos**
los caminos de voz de la app) trataba cada resultado `isFinal` de
`SpeechRecognition` como un fragmento nuevo independiente y lo concatenaba
sin deduplicar. En modo `continuous: true`, Chrome a veces revisa/alarga
un resultado ya marcado final en vez de agregar uno nuevo ("visita" →
"visita al" → "visita al ginecólogo"), y el código anterior reemitía cada
revisión completa, duplicando el texto acumulado. **Alcance real: no era
un bug de Gastos** — el mismo hook alimenta `VoiceInput.jsx` (Diario
Médico, Gastos, Registros, Incidentes, y el Calendario recién agregado),
`MicButton` (Chat, Notas) y `VoiceRecorder.jsx` (NotasFamilia, Diario
Médico) — 6+ puntos de uso con el mismo riesgo latente.

**Fix:** dentro de `useSpeechToText.js`, se reconstruye el texto final
completo de la sesión de reconocimiento en cada evento (recorriendo
`e.results` desde el índice 0, no desde `e.resultIndex`) y se emite solo
la diferencia real respecto al texto ya reportado. El contrato hacia
afuera no cambió — el hook sigue emitiendo fragmentos incrementales que
el caller concatena — así que **no hizo falta tocar ningún consumidor**
(`VoiceInput.jsx`, `VoiceRecorder.jsx`, `Chat.jsx`, `Notes.jsx`,
`NotasFamilia.jsx`), un solo fix beneficia a los 6+ puntos de uso.
Caso borde documentado y aceptado: si Chrome revisa el texto de una forma
que no es una simple extensión (cambia palabras del medio en vez de solo
alargar), el hook prefiere no reemitir nada antes que arriesgarse a
duplicar — se puede perder una corrección menor de texto, nunca se
duplica.

**Verificación antes de aprobar el fix:** dos simulaciones con un arnés
en Node que ejecuta el archivo real (no una copia) contra un
`SpeechRecognition` falso controlado a mano — (A) la secuencia exacta
que causó el bug de hoy → ya no duplica, reconstruye "visita al
ginecólogo" limpio; (B) el patrón de frases cortas con pausas limpias de
Diario Médico → idéntico resultado que antes, cero regresión. Ambas
`PASA`. Draft conjunto (fix + Calendario) desplegado para que Yasmin
probara con voz real en su teléfono: Gastos/Registros/Incidentes con
dictado largo y pausas — confirmado que el bug ya no reproduce en
producción, no solo en la simulación.

**Dato de prueba corrompido eliminado:** el gasto de $12
(`care_expenses.id = 405a4080-2af1-4561-b31c-9ae959fda29f`, "visita al
ginecólogo..."), confirmado por id antes de borrar, eliminado después de
aprobar el fix — era dato de prueba de Yasmin, sin impacto real.

**Deploy:** 3 commits separados — fix de `useSpeechToText.js`, Calendar.jsx,
y los 3 anteriores de Gastos/Registros/Incidentes ya estaban pusheados
antes de este cierre. `netlify deploy --prod --build`.

**Pendiente para sesión futura (fuera de alcance de esta fase, solo
diagnóstico, no tocado):**
- [ ] Decidir qué hacer con `Notes.jsx` (huérfana) y `CareSchedule.jsx`
      (vestigio sin ruta) — ¿eliminar o reconectar?
- [ ] Campos de stock (`renewalMethod`/`pharmacyName`/`refillsRemaining`/
      `lastMailDate`) sin UI para llenarlos.
- [ ] Modal "Registrar omisión" sin botón que lo abra.
- [ ] Unificar los 4 patrones de voz existentes en uno solo (candidato:
      `VoiceInput.jsx`, ya el más usado) — no es urgente ahora que el bug
      compartido está resuelto, pero simplificaría mantenimiento futuro.
- [ ] Resto de la lista ampliada de la auditoría con fricción 🟡 (nombres
      cortos sin voz en Directorio/Onboarding, etc.) — de menor prioridad
      que lo ya resuelto en esta fase.

---

## Hallazgo aparte (2026-07-25): Landing.jsx tiene una migración PARCIAL, no completa

Al verificar por qué el hero de Landing.jsx se veía en itálica grande
(pregunta de Yasmin sobre si algo de hoy lo había afectado sin querer),
se confirmó con `git blame`/`git log` que **no fue nada de esta sesión**
— el archivo no tiene ningún cambio sin commitear y ninguno de los
cambios de hoy lo toca ni importa nada relacionado.

El estilo itálico + tamaño grande del `<h1>` del hero es del commit
`6e15354` (6 de julio 2026). La tipografía específica (`Plus Jakarta
Sans`, vía la constante `SERIF`) es del commit `4e94323` (24 de julio
2026, un día antes de esta sesión) — el mismo commit mencionado en la
sección "Migración de diseño teal" de este archivo, con el mensaje
"29 resabios eliminados".

**Pendiente sin verificar — anotado, no investigado a fondo hoy:** ese
commit del 24 de julio dice haber migrado colores/tipografía de
`Landing.jsx` por completo, pero no se confirmó en esta sesión cuánto de
esos "29 resabios" originales quedó realmente resuelto vs. cuánto pudo
quedar parcial (mismo tipo de sorpresa que ya pasó antes en esta sesión
con componentes compartidos que un grep por archivo no alcanza a ver, o
con hallazgos de Stripe que aparecieron en más de un punto de contacto).
Queda para una sesión futura: auditar `Landing.jsx` completo contra la
paleta oficial y confirmar si el mensaje del commit del 24 jul describe
el estado real del archivo hoy.

---

## Fase 2 de optimización UX — Directorio — CERRADA (2026-07-25)

Continuación de la Fase 1 (voz), ahora sobre `/directorio` (Médicos,
Lugares, Familia). Diagnóstico previo (PASO 0): las 3 sub-formas
(`docForm`/`insForm`/`conForm`) usan el mismo componente compartido
`FormInput` para el campo "Notas" — mismo nombre de campo por forma,
misma etiqueta, mismo mecanismo interno (`rows` truthy → `<textarea>`).
Sin divergencia estructural real entre las 3, solo `rows` (3 en Médico, 2
en Lugares y Familia) y el placeholder.

**Cambio:** `VoiceInput.jsx` reemplaza `FormInput` únicamente en los 3
usos de "Notas", sin tocar `FormInput`/`FormSelect` en sí — así Nombre,
Especialidad/Tipo/Parentesco, Teléfono, Correo, Dirección y Sitio web
(explícitamente fuera de alcance, ya confirmados como texto estructurado
correcto) quedan intactos en las 3 sub-formas.

**Verificado con voz real en el teléfono** (dictado con pausa a mitad de
frase, el mismo escenario que reprodujo el bug de hoy) en las 3
sub-formas — sin duplicación, ya con el fix del hook compartido de la
Fase 1 aplicado.

**Deploy:** commit `a0c1e24` (`290a6b4..a0c1e24`), separado de todo lo
demás. `netlify deploy --prod --build` → "0 files" subidos (mismo bundle
exacto ya verificado en el draft).

**Pendiente (hereda de la Fase 1, sin cambios):** unificar los 4 patrones
de voz existentes, resto de la lista ampliada de la auditoría con
fricción 🟡, `Notes.jsx`/`CareSchedule.jsx` huérfanos, campos de stock sin
UI, modal de omisión sin botón que lo abra.
