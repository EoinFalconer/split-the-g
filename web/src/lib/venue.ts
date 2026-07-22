'use client'

// "Share your location"-style venue suggestion: browser geolocation reverse-
// geocoded through OpenStreetMap Nominatim (no key, CORS-friendly, light use).
// Best effort — returns null and lets the guest type the pub name themselves.
export async function lookupVenue(): Promise<string | null> {
  if (!navigator.geolocation) return null
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 8000,
        maximumAge: 60000,
      }),
    )
    const {latitude, longitude} = pos.coords
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18`,
      {headers: {Accept: 'application/json'}},
    )
    if (!res.ok) return null
    const data = await res.json()
    // Prefer the named place (the pub itself); fall back to street + town.
    const a = data.address ?? {}
    const place =
      data.name ||
      a.amenity ||
      a.pub ||
      a.bar ||
      a.restaurant ||
      [a.road, a.village || a.town || a.city].filter(Boolean).join(', ')
    return typeof place === 'string' && place.trim() ? place.trim().slice(0, 80) : null
  } catch {
    return null
  }
}
