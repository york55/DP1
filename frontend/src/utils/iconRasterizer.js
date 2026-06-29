import L from 'leaflet'

// Parses width/height from an SVG string's root element attributes.
function parseSvgDimensions(svgStr) {
  const w = parseFloat((svgStr.match(/width=['"]([\d.]+)['"]/) || [])[1] || 24)
  const h = parseFloat((svgStr.match(/height=['"]([\d.]+)['"]/) || [])[1] || 24)
  return { w, h }
}

async function svgToDataUrl(svgStr) {
  const { w, h } = parseSvgDimensions(svgStr)
  const SCALE = 2 // HiDPI / retina
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(w * SCALE)
  canvas.height = Math.ceil(h * SCALE)
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  await new Promise((res, rej) => {
    img.onload = res
    img.onerror = rej
    img.src = url
  })
  ctx.drawImage(img, 0, 0, w, h)
  URL.revokeObjectURL(url)
  return canvas.toDataURL('image/png')
}

/**
 * Rasterizes an SVG string to a PNG data URL and wraps it in a Leaflet L.icon.
 * The SVG must have explicit width and height attributes.
 * Embed a <feDropShadow> filter inside the SVG to bake shadows into the bitmap.
 */
export async function rasterizeToIcon(svgStr, iconSize, iconAnchor, popupAnchor) {
  const iconUrl = await svgToDataUrl(svgStr)
  return L.icon({ iconUrl, iconSize, iconAnchor, popupAnchor: popupAnchor || [0, 0] })
}
