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
- Fondo: crema #F8F4ED · Header claro vía isLightHeader en Layout.jsx
- Cards: blanco, borderRadius 16-20px, sombra suave
- Acentos: coral #E9826E (activos/CTAs), verde #143C32 (primarios)
- GOLD (acento terciario, uso limitado): #D99A18 — solo para warnings suaves y categorización de íconos; nunca para CTAs ni superficies
- Textos: #143C32 títulos, #6B7280 secundarios
- Chips: activo coral con texto #143C32, inactivo transparente borde #EDE5D8
- Colores semánticos (danger/estados de dosis) NO se tocan: son información
- Referencias de migración: Chat ed8e21d, Historial 7d6fb81, VideoCall a09b5e1

## Proceso
- Toda migración de pantalla: mostrar plan ANTES de aplicar
- El hero del Dashboard está CERRADO — no rediseñar
- La sala de videollamada activa permanece oscura (estándar de video)
- Actualizar SESION-*.md al completar cada pantalla
