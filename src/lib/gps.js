export const GPS_KEY = 'location_sharing_enabled'

export function isLocationEnabled() {
  return localStorage.getItem(GPS_KEY) === '1'
}

export function setLocationEnabled(val) {
  localStorage.setItem(GPS_KEY, val ? '1' : '0')
}

export async function getLocation() {
  if (!isLocationEnabled()) return null
  if (!navigator.geolocation) return null
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        let address = null
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept-Language': 'es' } }
          )
          const d = await res.json()
          const parts = [
            d.address?.road,
            d.address?.suburb ?? d.address?.neighbourhood,
            d.address?.city ?? d.address?.town ?? d.address?.village,
          ].filter(Boolean)
          address = parts.join(', ') || d.display_name?.split(',').slice(0, 2).join(', ') || null
        } catch {}
        resolve({ latitude, longitude, address })
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 }
    )
  })
}

export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
