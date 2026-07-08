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

## Design tokens (fuente de verdad)

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
