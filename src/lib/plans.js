// FamiliaCerca — ÚNICA fuente de verdad de los planes.
//
// La landing (Landing.jsx), la página de Planes (Upgrade.jsx) y Mi cuenta
// (Settings.jsx) leen de aquí. Antes cada una tenía su propia lista y se
// contradecían (ej. el PDF aparecía en planes distintos). Si cambias un plan,
// cámbialo SOLO aquí.
//
// Regla: no listar como pago algo que el código no limita, ni prometer algo
// que la app no hace todavía. Lo que se limita de verdad vive en
// contexts/FamilyPlanContext.jsx.
//
// Decisiones (nov 2026):
// - Prueba: 14 días con todo incluido, sin tarjeta. Al terminar baja a Gratis
//   y la familia conserva lo esencial; solo se pausan los extras.
// - PDF para el médico: 1 al mes en Gratis, sin límite en los pagos.
// - Milo y Luna: ayuda con la app siempre gratis; la memoria del cuidado
//   crece con el plan.
// - Anual: 2 meses gratis. ANNUAL_ENABLED queda en false hasta que existan
//   los planes anuales en PayPal; mientras tanto no se muestra.

export const TRIAL_DAYS = 14

export const ANNUAL_ENABLED = false

export const TRIAL_COPY = {
  short: '14 días con todo incluido · sin tarjeta',
  long: 'Pruébalo 14 días con todo incluido, sin tarjeta. Si no eliges un plan, sigues gratis con lo esencial: nada se borra.',
}

export const PLANS = {
  free: {
    key: 'free',
    name: 'Gratis',
    tagline: 'Para empezar a coordinar',
    price: 0,
    annualPrice: 0,
    caregivers: 'Hasta 2 personas',
    features: [
      'Hasta 2 personas en el equipo',
      'Medicamentos con recordatorios',
      'Rutina diaria',
      'Chat familiar',
      'Notas del día',
      'Historial de 7 días',
      '1 reporte PDF para el médico al mes',
      'Milo y Luna: ayuda para usar la app',
    ],
  },
  familiar: {
    key: 'familiar',
    name: 'Familiar',
    tagline: 'Para la familia que cuida desde varios lugares',
    badge: 'Recomendado para la mayoría de las familias',
    price: 12.99,
    annualPrice: 129.9,
    caregivers: 'Hasta 6 personas',
    features: [
      'Todo lo del plan Gratis',
      'Hasta 6 personas en el equipo',
      'Reportes PDF para el médico sin límite',
      'Videollamada familiar',
      'Gastos del cuidado',
      'Notas médicas con Milo (voz y foto)',
      'Historial de 90 días',
      'Milo y Luna recuerdan los últimos 90 días',
    ],
  },
  care_plus: {
    key: 'care_plus',
    name: 'Cuidado Total',
    tagline: 'Para el cuidado más intenso',
    price: 24.99,
    annualPrice: 249.9,
    caregivers: 'Personas sin límite',
    features: [
      'Todo lo del plan Familiar',
      'Personas sin límite en el equipo',
      'Historial completo, sin límite',
      'Milo y Luna con tendencias de la semana',
      'Modo hospital',
      'Soporte prioritario',
    ],
  },
}

export const PLAN_ORDER = ['free', 'familiar', 'care_plus']

// Lo que se pausa al terminar la prueba si la familia no elige plan.
export const PAUSED_ON_FREE = [
  'Más de 2 personas en el equipo',
  'Reportes PDF ilimitados',
  'Videollamada familiar',
  'Gastos del cuidado',
  'Notas médicas con Milo',
  'Historial de más de 7 días',
]
