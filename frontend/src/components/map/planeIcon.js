import { rasterizeToIcon } from '../../utils/iconRasterizer'

const SEMAPHORE_COLORS = ['#9E9E9E', '#2E7D32', '#66BB6A', '#FB8C00', '#E65100', '#C62828']

// viewBox expanded to -12/-12 so the feDropShadow has room to bleed outside.
function planeSvg(color) {
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-12 -12 24 24' width='24' height='24'>
  <defs>
    <filter id="s" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="rgba(0,0,0,0.65)"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <path d='M-1.2,0 L-9.5,5 L-9,6.5 L-1.5,3 Z' fill='${color}' stroke='black' stroke-width='0.5' stroke-linejoin='round'/>
    <path d='M1.2,0 L9.5,5 L9,6.5 L1.5,3 Z' fill='${color}' stroke='black' stroke-width='0.5' stroke-linejoin='round'/>
    <ellipse cx='-6.2' cy='3.5' rx='1.2' ry='2' fill='${color}' stroke='black' stroke-width='0.5'/>
    <ellipse cx='6.2' cy='3.5' rx='1.2' ry='2' fill='${color}' stroke='black' stroke-width='0.5'/>
    <path d='M0,-9.5 C1,-9.5 1.8,-7 1.8,-3 L1.8,5 C1,9 -1,9 -1.8,5 L-1.8,-3 C-1.8,-7 -1,-9.5 0,-9.5 Z' fill='${color}' stroke='black' stroke-width='0.5' stroke-linejoin='round'/>
    <path d='M-0.8,6 L-5,8.5 L-4.8,9.5 L0,7.8 L4.8,9.5 L5,8.5 L0.8,6 Z' fill='${color}' stroke='black' stroke-width='0.5' stroke-linejoin='round'/>
  </g>
</svg>`
}

// PLANE_IMAGES maps semaphore hex color → HTMLImageElement for canvas drawImage().
export const PLANE_IMAGES = Object.fromEntries(SEMAPHORE_COLORS.map(c => [c, null]))

let _initPromise = null

export function initPlaneIcons() {
  if (_initPromise) return _initPromise
  _initPromise = Promise.all(
    SEMAPHORE_COLORS.map(color =>
      rasterizeToIcon(planeSvg(color), [24, 24], [12, 12]).then(icon => {
        const img = new Image()
        img.src = icon.options.iconUrl
        PLANE_IMAGES[color] = img
      })
    )
  )
  return _initPromise
}
