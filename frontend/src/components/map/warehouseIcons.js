import L from 'leaflet'
import { rasterizeToIcon } from '../../utils/iconRasterizer'

const SEMAPHORE_COLORS = ['#9E9E9E', '#2E7D32', '#66BB6A', '#FB8C00', '#E65100', '#C62828']
const ICON_SIZE = [26, 26]
const ICON_ANCHOR = [13, 13]
const POPUP_ANCHOR = [0, -13]

// viewBox expanded to -3/-3/26/26 so feDropShadow has room to bleed outside.
function warehouseSvg(color) {
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-3 -3 26 26' width='26' height='26'>
    <defs>
      <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="rgba(0,0,0,0.55)"/>
      </filter>
    </defs>
    <g filter="url(#s)">
      <path d='M0.5,8 Q10,0.5 19.5,8 Z' fill='${color}' opacity='0.8'/>
      <rect x='0.5' y='8' width='19' height='11' fill='${color}' rx='0.5'/>
      <rect x='3' y='10' width='3.5' height='2.5' fill='white' fill-opacity='0.45' rx='0.3'/>
      <rect x='13.5' y='10' width='3.5' height='2.5' fill='white' fill-opacity='0.45' rx='0.3'/>
      <rect x='7.5' y='12.5' width='5' height='6.5' fill='black' fill-opacity='0.35' rx='0.4'/>
    </g>
  </svg>`
}

function buildWarehouseDivIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="line-height:0;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.55));"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' width='24' height='24'>
      <path d='M0.5,8 Q10,0.5 19.5,8 Z' fill='${color}' opacity='0.8'/>
      <rect x='0.5' y='8' width='19' height='11' fill='${color}' rx='0.5'/>
      <rect x='3' y='10' width='3.5' height='2.5' fill='white' fill-opacity='0.45' rx='0.3'/>
      <rect x='13.5' y='10' width='3.5' height='2.5' fill='white' fill-opacity='0.45' rx='0.3'/>
      <rect x='7.5' y='12.5' width='5' height='6.5' fill='black' fill-opacity='0.35' rx='0.4'/>
    </svg></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: POPUP_ANCHOR,
  })
}

// Starts with synchronous divIcon fallbacks. initWarehouseIcons() replaces each
// entry with a rasterized L.icon in place, so lookups remain O(1) after the swap.
export const WAREHOUSE_ICONS = Object.fromEntries(
  SEMAPHORE_COLORS.map(c => [c, buildWarehouseDivIcon(c)])
)

let _initPromise = null

export function initWarehouseIcons() {
  if (_initPromise) return _initPromise
  _initPromise = Promise.all(
    SEMAPHORE_COLORS.map(async color => {
      const icon = await rasterizeToIcon(warehouseSvg(color), ICON_SIZE, ICON_ANCHOR, POPUP_ANCHOR)
      WAREHOUSE_ICONS[color] = icon
    })
  )
  return _initPromise
}
