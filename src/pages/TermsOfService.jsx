import { useNavigate, Link } from 'react-router-dom'
import Logo from '../components/Logo'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2
        className="text-base font-bold text-gray-900 mb-3 pb-2"
        style={{ fontFamily: 'Georgia, serif', borderBottom: '2px solid #EDE5D8' }}
      >
        {title}
      </h2>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function Item({ children }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: '#4A7C59', marginTop: 6 }} />
      <p>{children}</p>
    </div>
  )
}

function Callout({ icon, children, color = '#EBF3EE', border = '#F0C8B0' }) {
  return (
    <div
      className="flex gap-3 px-4 py-3.5 rounded-2xl"
      style={{ background: color, border: `1px solid ${border}` }}
    >
      <span className="text-xl flex-shrink-0">{icon}</span>
      <p className="text-sm text-gray-700 leading-relaxed">{children}</p>
    </div>
  )
}

export default function TermsOfService() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen" style={{ background: '#F7F3ED' }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4"
        style={{
          height: 56,
          background: 'rgba(255,248,240,0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #EDE5D8',
          boxShadow: '0 1px 12px rgba(0,0,0,0.05)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0 transition-all active:scale-90"
          style={{ background: '#EDE5D8', color: '#555' }}
        >
          ←
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <Logo size={26} />
          <span
            className="text-sm font-bold text-gray-900 truncate"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Términos de Servicio
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="max-w-2xl mx-auto px-4 py-8 pb-20">

        {/* Title block */}
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-4"
            style={{ background: '#EBF3EE', color: '#3A6347' }}
          >
            📄 Documento legal
          </div>
          <h1
            className="text-2xl font-bold text-gray-900 leading-tight mb-2"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Términos de Servicio
          </h1>
          <p className="text-xs text-gray-400">
            Última actualización: 1 de mayo de 2025 · Vigente a partir de esa fecha
          </p>
        </div>

        <Callout icon="ℹ️">
          Al crear una cuenta o utilizar FamiliaCerca, aceptas estos Términos de Servicio en su totalidad.
          Si no estás de acuerdo con alguno de los términos, no debes usar el servicio.
        </Callout>

        <div className="mt-8 space-y-0">

          {/* 1. Descripción */}
          <Section title="1. Descripción del Servicio">
            <p>
              FamiliaCerca es una herramienta digital de coordinación de cuidado familiar diseñada para ayudar a
              familias a organizar y registrar información relacionada con el cuidado de sus seres queridos.
            </p>
            <Callout icon="⚕️" color="#FFF0F0" border="#FFBABA">
              <strong>FamiliaCerca NO es un proveedor de servicios médicos.</strong> No somos una clínica,
              hospital, consultorio médico ni entidad de salud de ningún tipo. La aplicación no ofrece
              diagnósticos, tratamientos, prescripciones ni asesoramiento médico profesional de ninguna clase.
            </Callout>
            <p>
              Toda la información médica registrada en la aplicación (medicamentos, citas, síntomas) es
              responsabilidad exclusiva del usuario. FamiliaCerca solo actúa como herramienta organizacional.
            </p>
          </Section>

          {/* 2. Responsabilidades */}
          <Section title="2. Responsabilidades del Usuario">
            <p>Al usar FamiliaCerca, el usuario se compromete a:</p>
            <Item>Proporcionar información veraz y actualizada al momento de crear su cuenta.</Item>
            <Item>Mantener la confidencialidad de sus credenciales de acceso (correo y contraseña).</Item>
            <Item>No compartir su cuenta con personas no autorizadas.</Item>
            <Item>Usar el servicio únicamente para fines legales y conforme a estos términos.</Item>
            <Item>No intentar acceder a datos de otros usuarios ni interferir con el funcionamiento del sistema.</Item>
            <Item>Notificarnos de inmediato si detecta un acceso no autorizado a su cuenta.</Item>
            <p>
              El usuario es el único responsable del contenido que registra en la aplicación, incluyendo
              nombres, fotografías, medicamentos y notas.
            </p>
          </Section>

          {/* 3. Planes */}
          <Section title="3. Planes y Precios">
            <p>FamiliaCerca ofrece los siguientes planes de suscripción:</p>
            <div className="space-y-3">
              <div
                className="rounded-2xl p-4"
                style={{ background: 'white', border: '1.5px solid #EDE5D8', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Plan Familiar</p>
                  <span className="font-bold" style={{ color: '#4A7C59' }}>$19 / mes</span>
                </div>
                <p className="text-xs text-gray-500">Coordinación familiar básica: medicamentos, calendario, notas y álbum familiar.</p>
              </div>
              <div
                className="rounded-2xl p-4"
                style={{ background: 'white', border: '1.5px solid #C9882A', boxShadow: '0 2px 12px rgba(201,136,42,0.1)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Plan Premium</p>
                  <span className="font-bold" style={{ color: '#A07830' }}>$29 / mes</span>
                </div>
                <p className="text-xs text-gray-500">Todo el Plan Familiar más: reportes avanzados, diario de voz, y soporte prioritario.</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Los precios están en dólares estadounidenses (USD) e incluyen impuestos aplicables.
              Nos reservamos el derecho de modificar los precios con un aviso mínimo de 30 días
              a los usuarios activos antes de que el cambio entre en vigor.
            </p>
          </Section>

          {/* 4. Prueba gratuita */}
          <Section title="4. Prueba Gratuita de 14 Días">
            <Item>Al registrarte, recibes acceso completo al servicio por 14 días calendario sin costo alguno.</Item>
            <Item>No se requiere tarjeta de crédito para iniciar la prueba gratuita.</Item>
            <Item>Al finalizar el período de prueba, deberás registrar un método de pago válido para continuar usando el servicio.</Item>
            <Item>Si no activas un plan al vencer la prueba, tu acceso quedará suspendido. Tu información se conservará por 30 días adicionales para que puedas recuperarla si decides suscribirte.</Item>
            <Item>Cada usuario tiene derecho a una sola prueba gratuita. La creación de múltiples cuentas para obtener pruebas adicionales viola estos términos.</Item>
          </Section>

          {/* 5. Cancelación */}
          <Section title="5. Política de Cancelación">
            <Item>Puedes cancelar tu suscripción en cualquier momento desde la sección de configuración de tu cuenta o escribiendo a <strong>legal@familiacerca.com</strong>.</Item>
            <Item>Al cancelar, conservarás acceso al servicio hasta el final del período mensual ya pagado.</Item>
            <Item>No realizamos reembolsos por períodos de suscripción parcialmente utilizados.</Item>
            <Item>Si cancelas durante el período de prueba gratuita, no se te cobrará nada.</Item>
            <Item>Puedes solicitar la eliminación permanente de todos tus datos en cualquier momento, incluso después de cancelar.</Item>
          </Section>

          {/* 6. Limitación */}
          <Section title="6. Limitación de Responsabilidad">
            <Callout icon="⚠️" color="#FFF8EE" border="#F0D998">
              <strong>Importante:</strong> FamiliaCerca no es responsable bajo ninguna circunstancia por decisiones
              médicas, de salud o de cuidado tomadas basándose en la información registrada o gestionada a través
              de la aplicación. Las decisiones de salud deben tomarse siempre en consulta con profesionales médicos calificados.
            </Callout>
            <p>En la máxima medida permitida por la ley, FamiliaCerca no será responsable por:</p>
            <Item>Daños directos, indirectos, incidentales o consecuentes derivados del uso o imposibilidad de uso del servicio.</Item>
            <Item>Pérdida de datos por fallas técnicas, siempre que hayamos actuado con diligencia razonable.</Item>
            <Item>Actos u omisiones de terceros, incluyendo proveedores de infraestructura.</Item>
            <Item>Interrupciones del servicio por mantenimiento programado o eventos fuera de nuestro control.</Item>
            <p>
              Nuestra responsabilidad máxima en cualquier caso se limita al importe pagado por el usuario
              en los últimos 3 meses de servicio.
            </p>
          </Section>

          {/* 7. HIPAA */}
          <Section title="7. No Somos una Entidad Cubierta por HIPAA">
            <Callout icon="📋" color="#F0F7FF" border="#C0D8F0">
              FamiliaCerca <strong>no es una "covered entity"</strong> (entidad cubierta) ni un "business associate"
              según la Ley de Portabilidad y Responsabilidad de Seguros de Salud de los Estados Unidos (HIPAA,
              por sus siglas en inglés). La información de salud almacenada en FamiliaCerca no está protegida
              bajo las regulaciones HIPAA.
            </Callout>
            <p>
              FamiliaCerca es una herramienta personal de organización familiar, no un sistema de registros
              médicos electrónicos (EMR/EHR). Si necesitas una plataforma que cumpla con HIPAA para el manejo
              de información médica clínica, te recomendamos consultar con un proveedor de salud certificado.
            </p>
          </Section>

          {/* 8. Propiedad intelectual */}
          <Section title="8. Propiedad Intelectual">
            <p>
              Todo el contenido, diseño, código, marca y logotipos de FamiliaCerca son propiedad de
              FamiliaCerca LLC y están protegidos por las leyes de propiedad intelectual aplicables.
            </p>
            <Item>El contenido que <em>tú</em> registras en la app (fotos, notas, etc.) es tuyo. FamiliaCerca no reclama ningún derecho sobre él.</Item>
            <Item>No puedes copiar, redistribuir ni modificar el software o diseño de FamiliaCerca sin autorización escrita.</Item>
          </Section>

          {/* 9. Modificaciones */}
          <Section title="9. Modificaciones a los Términos">
            <p>
              Nos reservamos el derecho de modificar estos Términos de Servicio en cualquier momento.
              Cuando lo hagamos, te notificaremos por correo electrónico y mediante un aviso prominente
              dentro de la aplicación con al menos <strong>15 días de anticipación</strong>.
            </p>
            <p>
              El uso continuado del servicio después de la fecha de entrada en vigor de los cambios
              constituye tu aceptación de los nuevos términos.
            </p>
          </Section>

          {/* 10. Ley aplicable */}
          <Section title="10. Ley Aplicable y Jurisdicción">
            <p>
              Estos Términos de Servicio se rigen por las leyes del <strong>Estado de Florida, Estados Unidos</strong>,
              sin perjuicio de sus disposiciones sobre conflicto de leyes.
            </p>
            <p>
              Cualquier disputa derivada de estos términos o del uso del servicio se someterá a la
              jurisdicción exclusiva de los tribunales del Estado de Florida, condado de Miami-Dade.
            </p>
            <p>
              Si eres usuario fuera de los Estados Unidos, eres responsable de cumplir con las leyes
              locales aplicables en tu jurisdicción.
            </p>
          </Section>

          {/* 11. Contacto */}
          <Section title="11. Contacto">
            <p>Si tienes preguntas sobre estos Términos de Servicio, contáctanos en:</p>
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'white', border: '1px solid #EDE5D8' }}
            >
              <span className="text-2xl">✉️</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">legal@familiacerca.com</p>
                <p className="text-xs text-gray-400 mt-0.5">Respondemos en un plazo de 5 días hábiles</p>
              </div>
            </div>
          </Section>

        </div>

        {/* Footer links */}
        <div
          className="mt-8 pt-6 flex flex-col items-center gap-3"
          style={{ borderTop: '1px solid #EDE5D8' }}
        >
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            ¿Prefieres leer esto en inglés? Escríbenos a{' '}
            <a href="mailto:legal@familiacerca.com" className="underline" style={{ color: '#4A7C59' }}>
              legal@familiacerca.com
            </a>{' '}
            y te enviamos la versión en inglés.
          </p>
          <Link
            to="/privacidad"
            className="text-xs font-semibold underline"
            style={{ color: '#4A7C59' }}
          >
            Ver Política de Privacidad →
          </Link>
          <p className="text-[10px] text-gray-300 mt-1">
            © 2025 FamiliaCerca LLC · Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  )
}
