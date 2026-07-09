/**
 * Returns semaphore level information based on occupancy percentage.
 * @param {number} pct - Occupancy percentage (0-100)
 * @param {number} thresholdAmber - Threshold for amber level (default 75)
 * @param {number} thresholdRed - Threshold for red level (default 90)
 * @returns {{ color: string, label: string, iconName: string, severity: number }}
 */
export function getSemaphoreLevel(pct, thresholdAmber = 75, thresholdRed = 90) {
  if (pct === 0) {
    return { color: '#9E9E9E', label: 'Vacío', iconName: 'CheckCircle', severity: -1 }
  }
  if (pct < 25) {
    return { color: '#2E7D32', label: 'Bajo', iconName: 'CheckCircle', severity: 0 }
  }
  if (pct < 50) {
    return { color: '#66BB6A', label: 'Moderado', iconName: 'Info', severity: 1 }
  }
  if (pct < thresholdAmber) {
    return { color: '#FB8C00', label: 'Alto', iconName: 'Warning', severity: 2 }
  }
  if (pct < thresholdRed) {
    return { color: '#E65100', label: 'Muy Alto', iconName: 'Warning', severity: 3 }
  }
  return { color: '#C62828', label: 'Crítico', iconName: 'Error', severity: 4 }
}

/**
 * Returns the semaphore color for a given percentage.
 */
export function getSemaphoreColor(pct, thresholdAmber = 75, thresholdRed = 90) {
  return getSemaphoreLevel(pct, thresholdAmber, thresholdRed).color
}

/**
 * Returns occupancy as a percentage given current and max values.
 */
export function toOccupancyPct(current, max) {
  if (!max || max === 0) return 0
  return Math.min(100, Math.max(0, (current / max) * 100))
}
