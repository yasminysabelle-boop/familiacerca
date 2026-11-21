// Tipos de negocio que compran FamiliaCerca (nov 2026). Todos entran por
// /empresa. Lo que cambia es la regla de privacidad:
// - 'pacientes': cuidan al paciente → ven a cada paciente, con permiso de la familia.
// - 'beneficio': lo regalan a sus empleados o afiliados → solo ven totales.
export const NEGOCIOS = [
  { k: 'agencia', label: 'Agencia de cuidado en casa', corto: 'la agencia', modo: 'pacientes' },
  { k: 'hospital', label: 'Hospital', corto: 'el hospital', modo: 'pacientes' },
  { k: 'clinica', label: 'Clínica o centro médico', corto: 'la clínica', modo: 'pacientes' },
  { k: 'hogar', label: 'Hogar de ancianos o égida', corto: 'el hogar', modo: 'pacientes' },
  { k: 'empresa', label: 'Empresa (beneficio para empleados)', corto: 'la empresa', modo: 'beneficio' },
  { k: 'aseguradora', label: 'Aseguradora o plan médico (beneficio para afiliados)', corto: 'el plan', modo: 'beneficio' },
]
export const negocio = (k, kind) => NEGOCIOS.find(n => n.k === k) || NEGOCIOS.find(n => n.k === (kind === 'agencia' ? 'agencia' : 'empresa'))
export const kindOf = k => (NEGOCIOS.find(n => n.k === k)?.modo === 'pacientes' ? 'agencia' : 'empresa')
