import { useNavigate } from 'react-router-dom'

// "Atrás" que deshace el paso real dentro de la app cuando existe, y solo cae
// a /dashboard (reemplazando, sin apilar) cuando no hay historial propio al
// que volver — p.ej. la pantalla se abrió por deep-link directo.
export function useGoBack(fallback = '/dashboard') {
  const navigate = useNavigate()
  return () => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}
