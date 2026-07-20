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

**Deploy:** draft en Netlify (no toca producción todavía). En el primer intento
el build horneó el `clientId` viejo/inválido (`EHdOOw...`) porque
`VITE_PAYPAL_CLIENT_ID` en Netlify aún tenía el valor incorrecto de la ronda
de credenciales invertidas. **Al momento de pausar esta sesión, `netlify
env:get VITE_PAYPAL_CLIENT_ID` (los 3 contextos: production, deploy-preview,
branch-deploy) sigue devolviendo el valor viejo `EHdOOw...` — el ajuste en el
dashboard de Netlify no se guardó o se aplicó al campo equivocado. Falta
corregirlo y volver a verificar antes de generar un draft URL válido para la
prueba real.**

## Checklist restante (en orden)

- [ ] **Corregir `VITE_PAYPAL_CLIENT_ID` en Netlify** — confirmar que el valor
      guardado empiece con `AVE784` (verificar con `netlify env:get
      VITE_PAYPAL_CLIENT_ID`, no solo mirar el dashboard)
- [ ] Rebuild + redeploy draft, verificar el prefix horneado en el bundle antes
      de dar la URL por buena
- [ ] Prueba real: suscripción al Plan Familiar con cuenta Zinli invitada
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
