# Sesión 4 julio 2026 — Splash, arquitectura, naming, landing y detección de instalación

## Commits de esta sesión (sin pushear — pendientes de confirmación)

| Commit | Descripción |
|--------|-------------|
| `ed36333` | feat: splash y apertura crema — manifest, theme-color y animación premium |
| `6c2fe46` | docs: arquitectura conceptual del producto en CLAUDE.md |
| `e37dcf0` | feat: renombrar /cuidado a "Rutina diaria" en textos visibles |
| `1c31ed1` | feat: unificar colores de la Landing con los tokens oficiales |
| `5c19001` | fix: detectar app instalada con getInstalledRelatedApps y appinstalled |

(Además, en esta misma sesión pero ya pusheados antes de esta tanda: `43d1212` refinamiento visual del dashboard, `246267f` estado global del día.)

## Qué se hizo

**Splash (`ed36333`):** `manifest.json` y `theme-color` de `#ffffff` → `#F8F4ED`; `body` de `index.css` también a crema (evita flash blanco antes de que React monte). Animación del logo: fade+scale 0.85→1 (600ms ease-out) + latido único (scale 1→1.04→1, ease-in-out) + texto escalonado a 150ms, todo en un solo `@keyframes` usando `animation-timing-function` por punto. Respeta `prefers-reduced-motion`. Transición splash→destino verificada como cross-fade real (ya funcionaba), sin cambios.

**Arquitectura conceptual (`6c2fe46`):** nueva sección en CLAUDE.md con las 4 capas del producto (Home/Cuidado/Registro/Hospital) y el principio "la app organiza el cuidado de una persona, no medicamentos".

**Naming (`e37dcf0`):** `/cuidado` ahora se llama "Rutina diaria" en el header (`PAGE_TITLES`, antes vacío por falta de entrada) y en el label del ícono en "Más herramientas". Se dejaron sin tocar a propósito: "Registrar rutina" (acción rápida, es un verbo) y `CareDaySection title="Cuidado"` en Dashboard.jsx:1697 (sección genérica no relacionada con el módulo /cuidado — habría sido un naming cruzado).

**Landing (`1c31ed1`):** unificados ~30 colores distintos a los tokens oficiales (verde `#143C32`, coral `#E9826E`, crema `#F8F4ED`, texto `#6B7280`). Resoluciones aplicadas: `MINT_C`→`#EBF3EE` con texto/checkmarks en la misma familia clara (se verificó contraste real sobre fondos oscuros, no simplemente `#143C32`), `SAND`→snap exacto a `#EDE5D8`, gradiente de círculos numerados mantenido pero derivado del verde oficial (`#143C32 → #1E5245`). Excluidos intencionalmente: mockup de comparación WhatsApp (colores de marca reales, ya comentado en el código) y mockup decorativo de teléfono (hardware genérico, no UI real).

**Detección de instalación (`5c19001`):** nuevo `src/lib/pwaInstall.js` compartido con `getInstalledRelatedApps()` + listener `appinstalled` + flag persistido en `localStorage`. Aplicado a los 3 mecanismos existentes (`usePWAInstall.js`, `useInstallPrompt.js`, `InstallBanner.jsx`); `PWAInstallBanner.jsx` hereda el fix sin cambios propios porque ya consume `usePWAInstall()`.

## Pendiente
- [ ] Push de cierre de estos 5 commits (esperando confirmación en el cel)
- [ ] Revisar visualmente la Landing tras el cambio de colores (flattening de verdes: PRIMARY/ACTION/DARK ahora son el mismo `#143C32` — antes tenían 3 tonos distintos para dar profundidad entre secciones)

---

# Sesión 2 julio 2026 — Resumen de cambios y pendientes

## Commits de esta sesión

| Commit | Descripción |
|--------|-------------|
| `dea3542` | feat: nuevo logo + íconos PWA optimizados, limpieza de assets (-5 MB) |
| `f55de30` | fix: splash crema con logo imagen, texto FamiliaCerca fijo |
| `1480d7d` | feat: reemplazar monograma FC por logo imagen en toda la app |
| `806b531` | debug: instrumentar submit del onboarding con logs numerados ← **QUITAR** |
| `f02f43e` | fix: prevenir onboarding falso en timeout + flag servidor en finish() |

---

## Qué se arregló

### Assets / Branding
- `public/logo.png` y 6 íconos PWA reemplazados por versiones optimizadas (<30 KB cada uno)
- Eliminados assets huérfanos: `hero-1.png` (2.6 MB), `logo-new.png` (1.4 MB), `logo1.png` (577 KB)
- Monograma "FC" en SVG eliminado de **todos** los lugares:
  - `src/components/Logo.jsx` → ahora usa `<img src="/logo.png">`
  - `src/components/WelcomeSlides.jsx` → fondo crema + `<Logo>`
  - `src/components/FamilySelector.jsx` → `<Logo size={64}>`
  - `src/components/PWAInstallBanner.jsx` → slot blanco sólido + logo 28px
  - `src/App.jsx` (Splash) → fondo #F8F4ED, logo imagen, texto "FamiliaCerca" fijo

### Bug crítico: onboarding falso para usuarios existentes
**Causa raíz:** doble fallo simultáneo:
1. Usuarios del flujo antiguo (`Onboarding.jsx`) nunca tuvieron `fc_patient_onboarding_done` en localStorage
2. Timeout de 8 s en `FamilyContext` disparaba con `profile=null` → `ProtectedRoute` mostraba `OnboardingFlow`

**Fixes aplicados (`f02f43e`):**
- `FamilyContext.jsx`: nuevo estado `profileResolved` — solo se activa cuando la DB responde definitivamente (no en el timeout)
- `ProtectedRoute.jsx`: muestra `ConnectingScreen` ("Conectando…" + Reintentar) cuando `!profileResolved`, en vez de OnboardingFlow
- `ProtectedRoute.jsx`: `onboardingDone` ahora acepta `user_metadata.onboarding_completed` (flag del flujo antiguo)
- `OnboardingFlow.jsx finish()`: persiste `onboarding_completed: true` en el servidor vía `supabase.auth.updateUser`, con `try/catch` para que fallo de red nunca bloquee la navegación

### RLS care_profiles (ejecutado en Supabase SQL Editor)
- Reemplazado `"Own care profile"` (FOR ALL sin WITH CHECK) por `"care_profiles: owner all"` con `WITH CHECK` explícito
- Esto causaba que el upsert del paso 3 del onboarding quedara colgado indefinidamente

---

## Pendiente confirmación

### Bug onboarding paso 3 — "Guardando..." indefinido
Los logs de debug del commit `806b531` están **activos en producción**.
Una vez que se confirme que el paso 3 avanza correctamente, hacer:

```
# Quitar los logs [ONB-x] de src/pages/OnboardingFlow.jsx
```

**Logs a eliminar en `OnboardingFlow.jsx` función `handleSaveProfile`:**
```js
console.log('[ONB-1] inicio submit', { userId: user?.id, patientName, birthDate })
console.log('[ONB-2] antes de subir foto')
console.log('[ONB-3] foto subida', { photoUrl, upErr })
console.log('[ONB-4] antes de care_profiles')
console.log('[ONB-5] care_profiles respuesta', { e1 })
console.log('[ONB-6] antes de patient_profiles')
console.log('[ONB-7] patient_profiles respuesta', { e2 })
console.log('[ONB-8] avanzando a paso 4')
console.error('[ONB-ERR]', e)
```

También se agregó captura de error de `patient_profiles` (`e2`) y `throw e2` — esto es parte del fix real y **debe quedarse**.

### Verificar en producción
- [ ] Paso 3 del onboarding avanza sin colgar (ver consola por logs [ONB-x])
- [ ] Usuarios existentes no ven onboarding falso después de deploy
- [ ] `ConnectingScreen` aparece y desaparece correctamente cuando Supabase tarda en despertar
- [ ] Logo aparece correctamente en: splash, login, onboarding, FamilySelector, PWAInstallBanner, WelcomeSlides

---

## Migración visual (pantallas al lenguaje crema del dashboard)

**Tokens de referencia:** crema `#F8F4ED`, primario `#143C32`, secundario `#6B7280`, acento coral `#E9826E`.

| Pantalla | Estado | Commit |
|----------|--------|--------|
| Chat (`/chat`) | ✅ Migrado | `ed8e21d` |
| Hoy / Medicamentos | ⬜ Pendiente | — |
| Familia | ⬜ Pendiente | — |
| Historial (`/historial`) | ✅ Migrado | `7d6fb81` |
| Más opciones | ⬜ Pendiente | — |

**Patrón de header migrado:** `Layout.jsx` usa `isLightHeader` por pathname — expandir la condición al migrar cada pantalla.

### Pendiente de decisión de marca — Panel AI en Chat

El panel del asistente IA (`showAi`) usa paleta purple (`#5B21B6`, `#7C5CBF`, `#C4B5FD`, `#DDD6FE`) que **no existe en la paleta oficial** de FamiliaCerca (verde/coral/crema/gold). Opciones:
- **Integrar al sistema**: reemplazar purple por coral `#E9826E` o verde `#143C32` con acento dorado
- **Justificar como excepción**: AI = feature especial → purple como señal visual de "modo IA" (patrón común en producto)
- **Posponer**: dejarlo igual hasta definir la identidad de la feature AI

---

## Notas técnicas

- `patient_profiles` **no tiene archivo SQL de migración** — fue creada directamente en el dashboard de Supabase. Sus políticas RLS (INSERT/SELECT/UPDATE) existen en producción pero no están versionadas en `supabase/*.sql`
- El bucket `care-photos` no aparece en `missing_tables_and_buckets.sql` — verificar si existe en Supabase Storage
- `Logo.jsx` conserva la prop `variant` (afecta colores del wordmark) aunque ya no afecta la imagen
