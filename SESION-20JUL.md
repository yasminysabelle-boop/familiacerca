# Sesión 20 julio 2026 — Migración PayPal Sandbox → Live

## Estado: PAUSADO — pendiente prueba real de pago, sin push

## Commits de esta sesión (local, sin pushear)

| Commit | Descripción |
|--------|-------------|
| (pendiente) | feat: migración PayPal a Live — planes, config única y webhook (pendiente prueba real antes de push) |

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

- **URL de prueba nueva (usar esta, la anterior ya no existe):
  https://6a5ec66044a6f77b442651a1--familiacerca.netlify.app**

## Checklist restante (en orden)

- [ ] Prueba real: suscripción al Plan Familiar con cuenta Zinli invitada, en
      la URL de draft de arriba
- [ ] Verificar logs de la Edge Function `paypal-webhook` (llegó el evento,
      firma validada, sin errores)
- [ ] Verificar tabla `subscriptions` en Supabase: `plan`, `status`,
      `paypal_subscription_id`, `current_period_end` correctos para el usuario
      de prueba
- [ ] Verificación visual completa en la app (plan activo reflejado en
      Ajustes, Milo/careContext correctos)
- [ ] Promocionar draft a producción (`netlify deploy --prod`)
- [ ] Push definitivo del commit de esta sesión
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

**Pendiente:** verificación visual de Yasmin en su teléfono real tras el
próximo deploy (este fix vive en un commit local aparte, todavía sin
desplegar — no se mezcla con el draft/commit de PayPal).
