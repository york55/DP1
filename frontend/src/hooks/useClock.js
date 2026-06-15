import { useState, useEffect } from 'react'
import { formatUTC } from '../utils/timeUtils'

/**
 * Hook that returns a live UTC time string, updating every second.
 * @returns {string} UTC time string in format "HH:MM:SS UTC"
 */
export function useClock() {
  const [utcTime, setUtcTime] = useState(() => formatUTC(new Date()))

  useEffect(() => {
    const interval = setInterval(() => {
      setUtcTime(formatUTC(new Date()))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return utcTime
}
