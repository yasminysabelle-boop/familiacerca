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
      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: '#C4623A', marginTop: 6 }} />
      <p>{children}</p>
    </div>
  )
}

function Callout({ icon, children, color = '#FDF0EB', border = '#F0C8B0' }) {
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

function DataChip({ label }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{ background: '#FDF0EB', color: '#A85130', border: '1px solid #F0C8B0' }}
    >
      {label}
    </span>
  )
}

export default function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen" style={{ background: '#FFF8F0' }}>

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
            Política de Privacidad
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="max-w-2xl mx-auto px-4 py-8 pb-20">

        {/* Title block */}
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-4"
            style={{ background: '#EBF3EE', color: '#3A6147' }}
          >
            🔒 Tu privacidad nos importa
          </div>
          <h1
            className="text-2xl font-bold text-gray-900 leading-tight mb-2"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Política de Privacidad
          </h1>
          <p className="text-xs text-gray-400">
            Última actualización: 1 de mayo de 2025 · Vigente a partir de esa fecha
          </p>
        </div>

        <Callout icon="🤝" color="#EBF3EE" border="#B8D8C0">
          En FamiliaCerca entendemos que la información de tu familia es profundamente personal.
          Este documento explica de forma clara y directa qué datos recopilamos, cómo los usamos
          y cuáles son tus derechos.
        </Callout>

        <div className="mt-8 space-y-0">

          {/* 1. Datos que recopilamos */}
          <Section title="1. Datos que Recopilamos">
            <p>Recopilamos únicamente la información que tú nos proporcionas directamente:</p>

            <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #EDE5D8', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Información de cuenta</p>
              <div className="flex flex-wrap gap-2">
                <DataChip label="📛 Nombre completo" />
                <DataChip label="📧 Correo electrónico" />
                <DataChip label="🔐 Contraseña (cifrada)" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #EDE5D8', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Información del familiar</p>
              <div className="flex flex-wrap gap-2">
                <DataChip label="👤 Nombre del familiar" />
                <DataChip label="📷 Fotografías" />
                <DataChip label="💊 Nombres de medicamentos" />
                <DataChip label="📅 Fechas de citas" />
                <DataChip label="📝 Notas de texto" />
                <DataChip label="🎙️ Notas de voz" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #EDE5D8', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Datos técnicos (automáticos)</p>
              <div className="flex flex-wrap gap-2">
                <DataChip label="📱 Tipo de dispositivo" />
                <DataChip label="🌐 Idioma del navegador" />
                <DataChip label="⏰ Fecha/hora de acceso" />
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Estos datos son anónimos y se usan exclusivamente para mejorar el rendimiento de la aplicación.
              </p>
            </div>

            <Callout icon="🚫" color="#F0FAF2" border="#C0E4C8">
              <strong>No recopilamos:</strong> números de seguro social, números de tarjetas de crédito (gestionados
              directamente por el procesador de pagos), historial de navegación externo ni ubicación GPS.
            </Callout>
          </Section>

          {/* 2. Cómo usamos los datos */}
          <Section title="2. Cómo Usamos tu Información">
            <p>Usamos tu información <strong>únicamente</strong> para los siguientes fines:</p>
            <Item>Proveer y mantener el servicio de FamiliaCerca.</Item>
            <Item>Sincronizar la información de cuidado entre los miembros de tu familia dentro de la app.</Item>
            <Item>Enviarte notificaciones dentro de la app (recordatorios de medicamentos, alertas de emergencia).</Item>
            <Item>Comunicaciones de servicio: actualizaciones importantes, cambios en los términos o en los precios.</Item>
            <Item>Mejorar la aplicación a partir de patrones de uso agregados y anónimos.</Item>
            <Item>Responder a tus solicitudes de soporte técnico.</Item>
            <p className="font-semibold text-gray-800">
              Nunca usamos tu información para publicidad dirigida ni para perfilarte con fines comerciales.
            </p>
          </Section>

          {/* 3. No vendemos datos */}
          <Section title="3. No Vendemos tu Información">
            <Callout icon="🛡️" color="#F0FAF2" border="#C0E4C8">
              <strong>FamiliaCerca no vende, alquila, presta ni comparte tu información personal
              con terceros con fines comerciales. Nunca. Sin excepciones.</strong>
            </Callout>
            <p>
              Podemos compartir información con terceros únicamente en las siguientes circunstancias limitadas:
            </p>
            <Item>
              <strong>Proveedores de infraestructura:</strong> empresas que nos ayudan a operar el servicio
              (almacenamiento en la nube, procesamiento de pagos). Estos proveedores tienen acceso restringido
              y están obligados contractualmente a proteger tu información.
            </Item>
            <Item>
              <strong>Requerimientos legales:</strong> si una autoridad competente nos lo exige por orden judicial,
              solo proporcionaremos lo estrictamente requerido por ley y te notificaremos si nos está permitido hacerlo.
            </Item>
            <Item>
              <strong>Protección de derechos:</strong> en casos de fraude comprobado o violaciones graves a estos términos.
            </Item>
          </Section>

          {/* 4. Almacenamiento */}
          <Section title="4. Almacenamiento y Seguridad de tus Datos">
            <div
              className="rounded-2xl p-4 flex items-start gap-4"
              style={{ background: 'white', border: '1.5px solid #EDE5D8', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
            >
              <span className="text-3xl">🏗️</span>
              <div>
                <p className="font-bold text-gray-900 text-sm mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                  Infraestructura: Supabase en AWS (EE.UU.)
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Todos tus datos se almacenan en servidores de Amazon Web Services (AWS) ubicados
                  en los Estados Unidos, gestionados a través de Supabase. Supabase es un proveedor
                  de bases de datos que cumple con los estándares de seguridad SOC 2 Tipo II.
                </p>
              </div>
            </div>

            <p>Medidas de seguridad que aplicamos:</p>
            <Item>Cifrado en tránsito mediante TLS/HTTPS en todas las comunicaciones.</Item>
            <Item>Cifrado en reposo para todos los datos almacenados en nuestra base de datos.</Item>
            <Item>Contraseñas almacenadas únicamente como hashes (nunca en texto plano).</Item>
            <Item>Control de acceso por filas (Row Level Security) en la base de datos: cada usuario solo puede ver sus propios datos.</Item>
            <Item>Tokens de autenticación con expiración automática.</Item>

            <Callout icon="ℹ️">
              Ningún sistema es 100% seguro. En caso de una brecha de seguridad que afecte tus datos,
              te notificaremos dentro de las 72 horas siguientes a que tengamos conocimiento del incidente.
            </Callout>
          </Section>

          {/* 5. Derechos */}
          <Section title="5. Tus Derechos como Usuario">
            <p>
              Tienes control total sobre tu información. En cualquier momento puedes:
            </p>
            <Item>
              <strong>Acceder</strong> a todos tus datos desde la sección "Perfil" de la aplicación.
            </Item>
            <Item>
              <strong>Corregir</strong> cualquier información incorrecta directamente en la app.
            </Item>
            <Item>
              <strong>Exportar</strong> tus datos solicitándolo a legal@familiacerca.com. Te los
              enviaremos en formato JSON o CSV en un plazo de 5 días hábiles.
            </Item>
            <Item>
              <strong>Eliminar tu cuenta y todos tus datos</strong> permanentemente desde Ajustes → Eliminar cuenta,
              o escribiéndonos a legal@familiacerca.com. La eliminación es irreversible y se completa en 30 días.
            </Item>
            <Item>
              <strong>Retirar tu consentimiento</strong> para el uso de tus datos en cualquier momento,
              lo que implicará la cancelación de tu cuenta.
            </Item>
            <p className="text-xs text-gray-500">
              Si estás en la Unión Europea o California, también tienes derechos adicionales bajo el
              GDPR y CCPA respectivamente. Contáctanos para ejercerlos.
            </p>
          </Section>

          {/* 6. Cookies */}
          <Section title="6. Cookies y Almacenamiento Local">
            <p>
              FamiliaCerca usa <strong>almacenamiento local del navegador (localStorage)</strong> únicamente para:
            </p>
            <Item>Mantener tu sesión activa entre visitas.</Item>
            <Item>Guardar preferencias de interfaz (como notificaciones descartadas).</Item>
            <p>
              No usamos cookies de rastreo de terceros ni herramientas de análisis que compartan
              datos con otras empresas. No hay píxeles de Facebook, Google Analytics u otros rastreadores externos.
            </p>
          </Section>

          {/* 7. Menores */}
          <Section title="7. Usuarios Menores de Edad">
            <Callout icon="👶" color="#F0F7FF" border="#C0D8F0">
              FamiliaCerca <strong>no está dirigido a personas menores de 18 años</strong>. No recopilamos
              intencionalmente datos de menores. Si descubrimos que un menor de 18 años ha creado una cuenta,
              la eliminaremos de inmediato junto con todos sus datos.
            </Callout>
            <p>
              Si eres padre o tutor y crees que tu hijo menor registró una cuenta en FamiliaCerca,
              contáctanos a legal@familiacerca.com y eliminaremos la información de inmediato.
            </p>
          </Section>

          {/* 8. Cambios */}
          <Section title="8. Cambios a esta Política">
            <p>
              Cuando actualicemos esta Política de Privacidad, te notificaremos por correo electrónico
              y con un aviso visible dentro de la aplicación, con al menos <strong>15 días de anticipación</strong>.
            </p>
            <p>
              El uso continuado de FamiliaCerca después de la fecha de vigencia de los cambios
              constituye tu aceptación de la política actualizada.
            </p>
          </Section>

          {/* 9. Contacto */}
          <Section title="9. Contacto y Consultas de Privacidad">
            <p>
              Para cualquier pregunta, solicitud o inquietud relacionada con tu privacidad y el manejo de tus datos:
            </p>
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
            <p className="text-xs text-gray-500">
              FamiliaCerca LLC · Estado de Florida, Estados Unidos
            </p>
          </Section>

        </div>

        {/* Footer links */}
        <div
          className="mt-8 pt-6 flex flex-col items-center gap-3"
          style={{ borderTop: '1px solid #EDE5D8' }}
        >
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            ¿Prefieres leer esto en inglés? Escríbenos a{' '}
            <a href="mailto:legal@familiacerca.com" className="underline" style={{ color: '#C4623A' }}>
              legal@familiacerca.com
            </a>{' '}
            y te enviamos la versión en inglés.
          </p>
          <Link
            to="/terminos"
            className="text-xs font-semibold underline"
            style={{ color: '#C4623A' }}
          >
            Ver Términos de Servicio →
          </Link>
          <p className="text-[10px] text-gray-300 mt-1">
            © 2025 FamiliaCerca LLC · Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  )
}
