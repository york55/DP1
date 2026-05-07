/**
 * Formats a Date object to a UTC time string (HH:MM:SS UTC).
 * @param {Date} date
 * @returns {string}
 */
export function formatUTC(date) {
  if (!date) return '--:--:-- UTC'
  const h = String(date.getUTCHours()).padStart(2, '0')
  const m = String(date.getUTCMinutes()).padStart(2, '0')
  const s = String(date.getUTCSeconds()).padStart(2, '0')
  return `${h}:${m}:${s} UTC`
}

/**
 * Formats a Date object to a full UTC datetime string.
 * @param {Date} date
 * @returns {string}
 */
export function formatUTCFull(date) {
  if (!date) return '-- --- ---- --:--:-- UTC'
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const dayName = days[date.getUTCDay()]
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = months[date.getUTCMonth()]
  const year = date.getUTCFullYear()
  const h = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  const s = String(date.getUTCSeconds()).padStart(2, '0')
  return `${dayName} ${day} ${month} ${year} ${h}:${min}:${s} UTC`
}

/**
 * Formats elapsed seconds into a human-readable string (HH:MM:SS).
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatElapsed(totalSeconds) {
  const s = Math.floor(totalSeconds % 60)
  const m = Math.floor((totalSeconds / 60) % 60)
  const h = Math.floor(totalSeconds / 3600)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Formats elapsed seconds into a short label (e.g., "2h 15m").
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatElapsedShort(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const h = Math.floor(m / 60)
  const remainingM = m % 60
  if (h > 0) return `${h}h ${remainingM}m`
  return `${m}m`
}

/**
 * Formats a UTC ISO string to a short display format (DD/MM HH:MM).
 * @param {string} isoString
 * @returns {string}
 */
export function formatFlightTime(isoString) {
  if (!isoString) return '--'
  const d = new Date(isoString)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${day}/${month} ${h}:${min}`
}

/**
 * Calculates flight progress (0-1) based on simulated time.
 * @param {string} departureUTC - ISO string
 * @param {string} arrivalUTC - ISO string
 * @param {Date} simulatedTime - current simulated time
 * @returns {number} progress 0-1
 */
export function getFlightProgress(departureUTC, arrivalUTC, simulatedTime) {
  if (!simulatedTime || !departureUTC || !arrivalUTC) return 0
  const dep = new Date(departureUTC).getTime()
  const arr = new Date(arrivalUTC).getTime()
  const now = simulatedTime.getTime()
  if (now <= dep) return 0
  if (now >= arr) return 1
  return (now - dep) / (arr - dep)
}
