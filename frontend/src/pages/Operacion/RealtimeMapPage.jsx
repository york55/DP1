import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import client from '../../api/client'

const parseDMS = (deg, min, sec, dir) => {
  const decimal = deg + min / 60 + sec / 3600
  return dir === 'S' || dir === 'W' ? -decimal : decimal
}

const AIRPORTS = {
  SKBO: { name: 'Bogotá',       lat: parseDMS(4,42,5,'N'),   lng: parseDMS(74,8,49,'W')  },
  SEQM: { name: 'Quito',        lat: parseDMS(0,6,48,'N'),   lng: parseDMS(78,21,31,'W') },
  SVMI: { name: 'Caracas',      lat: parseDMS(10,36,11,'N'), lng: parseDMS(66,59,26,'W') },
  SBBR: { name: 'Brasilia',     lat: parseDMS(15,51,53,'S'), lng: parseDMS(47,55,5,'W')  },
  SPIM: { name: 'Lima',         lat: parseDMS(12,1,19,'S'),  lng: parseDMS(77,6,52,'W')  },
  SLLP: { name: 'La Paz',       lat: parseDMS(16,30,47,'S'), lng: parseDMS(68,11,32,'W') },
  SCEL: { name: 'Santiago',     lat: parseDMS(33,23,47,'S'), lng: parseDMS(70,47,41,'W') },
  SABE: { name: 'Buenos Aires', lat: parseDMS(34,33,33,'S'), lng: parseDMS(58,24,56,'W') },
  SGAS: { name: 'Asunción',     lat: parseDMS(25,14,24,'S'), lng: parseDMS(57,31,12,'W') },
  SUAA: { name: 'Montevideo',   lat: parseDMS(34,47,21,'S'), lng: parseDMS(56,15,53,'W') },
  LATI: { name: 'Tirana',       lat: parseDMS(41,24,53,'N'), lng: parseDMS(19,43,14,'E') },
  EDDI: { name: 'Berlín',       lat: parseDMS(52,28,25,'N'), lng: parseDMS(13,24,6,'E')  },
  LOWW: { name: 'Viena',        lat: parseDMS(48,6,39,'N'),  lng: parseDMS(16,34,15,'E') },
  EBCI: { name: 'Bruselas',     lat: parseDMS(50,27,33,'N'), lng: parseDMS(4,27,13,'E')  },
  UMMS: { name: 'Minsk',        lat: parseDMS(53,52,57,'N'), lng: parseDMS(28,1,57,'E')  },
  LBSF: { name: 'Sofía',        lat: parseDMS(42,41,25,'N'), lng: parseDMS(23,24,17,'E') },
  LKPR: { name: 'Praga',        lat: parseDMS(50,6,5,'N'),   lng: parseDMS(14,15,56,'E') },
  LDZA: { name: 'Zagreb',       lat: parseDMS(45,44,34,'N'), lng: parseDMS(16,4,7,'E')   },
  EKCH: { name: 'Copenhague',   lat: parseDMS(55,37,5,'N'),  lng: parseDMS(12,39,22,'E') },
  EHAM: { name: 'Amsterdam',    lat: parseDMS(52,18,0,'N'),  lng: parseDMS(4,45,54,'E')  },
  VIDP: { name: 'Delhi',        lat: parseDMS(28,33,59,'N'), lng: parseDMS(77,6,11,'E')  },
  OSDI: { name: 'Damasco',      lat: parseDMS(33,24,41,'N'), lng: parseDMS(36,30,56,'E') },
  OERK: { name: 'Riad',         lat: parseDMS(24,57,28,'N'), lng: parseDMS(46,41,56,'E') },
  OMDB: { name: 'Dubai',        lat: parseDMS(25,15,10,'N'), lng: parseDMS(55,21,52,'E') },
  OAKB: { name: 'Kabul',        lat: parseDMS(34,33,56,'N'), lng: parseDMS(69,12,39,'E') },
  OOMS: { name: 'Mascate',      lat: parseDMS(23,35,22,'N'), lng: parseDMS(58,17,3,'E')  },
  OYSN: { name: 'Saná',         lat: parseDMS(15,28,34,'N'), lng: parseDMS(44,13,11,'E') },
  OPKC: { name: 'Karachi',      lat: parseDMS(24,54,0,'N'),  lng: parseDMS(67,9,0,'E')   },
  UBBB: { name: 'Bakú',         lat: parseDMS(40,28,2,'N'),  lng: parseDMS(50,2,48,'E')  },
  OJAI: { name: 'Amán',         lat: parseDMS(31,43,21,'N'), lng: parseDMS(35,59,36,'E') },
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const nowMinutes = () => {
  const now = new Date()
  return now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60
}

const getProgress = (depMin, arrMin, nowMin) => {
  let dep = depMin, arr = arrMin, now = nowMin
  if (arr < dep) arr += 1440
  if (now < dep) now += 1440
  if (now < dep || now > arr) return null
  return (now - dep) / (arr - dep)
}

const getBearing = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180
  const dLng = toRad(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

const planeIcon = (bearing) => {
  const L = window.L
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      style="transform: rotate(${bearing}deg); display:block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4))">
      <path fill="#2E75B6" stroke="white" stroke-width="1"
        d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1l3.5 1v-1.5L13 19v-5.5z"/>
    </svg>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    className: '',
  })
}

export default function RealtimeMapPage() {
  const mapRef     = useRef(null)
  const mapInst    = useRef(null)
  const flightsRef = useRef([])
  const layersRef  = useRef({})

  // Fetch único al montar
  useEffect(() => {
    client.get('/flight-ops')
      .then(res => { flightsRef.current = res.data })
      .catch(e => console.error('Error fetching flight-ops:', e))
  }, [])

  // Inicializar mapa
  useEffect(() => {
    if (mapInst.current || !mapRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      center: [20, 10],
      zoom: 2,
      zoomControl: true,
      minZoom: 2,
      maxBounds: [[-90, -180], [90, 180]],
      maxBoundsViscosity: 1.0,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)

    mapInst.current = map

    // Marcadores fijos de aeropuertos
    Object.entries(AIRPORTS).forEach(([icao, ap]) => {
      const icon = L.divIcon({
        html: `<div style="
          background:#1F3864;width:7px;height:7px;
          border-radius:50%;border:1.5px solid white;
          box-shadow:0 0 3px rgba(0,0,0,0.3)
        "></div>`,
        iconSize: [7, 7], iconAnchor: [3.5, 3.5], className: '',
      })
      L.marker([ap.lat, ap.lng], { icon })
        .addTo(map)
        .bindTooltip(`<b>${icao}</b> — ${ap.name}`, { direction: 'top', offset: [0, -8] })
    })
  }, [])

  // Tick cada segundo — solo mueve, no recrea
  useEffect(() => {
    const tick = () => {
      const L   = window.L
      const map = mapInst.current
      if (!L || !map) return

      const now     = nowMinutes()
      const flights = flightsRef.current
      const layers  = layersRef.current

      flights.forEach((f) => {
        const orig = AIRPORTS[f.origin]
        const dest = AIRPORTS[f.destination]
        if (!orig || !dest) return

        const progress = getProgress(toMinutes(f.departureUtc), toMinutes(f.arrivalUtc), now)

        if (progress === null) {
          if (layers[f.flightKey]) {
            layers[f.flightKey].marker.remove()
            layers[f.flightKey].polyline.remove()
            delete layers[f.flightKey]
          }
          return
        }

        const curLat = orig.lat + (dest.lat - orig.lat) * progress
        const curLng = orig.lng + (dest.lng - orig.lng) * progress
        const bearing = getBearing(orig.lat, orig.lng, dest.lat, dest.lng)

        if (!layers[f.flightKey]) {
          const polyline = L.polyline(
            [[orig.lat, orig.lng], [dest.lat, dest.lng]],
            { color: '#2E75B6', weight: 1, dashArray: '5 5', opacity: 0.35 }
          ).addTo(map)

          const marker = L.marker([curLat, curLng], { icon: planeIcon(bearing) })
            .addTo(map)
            .bindTooltip(
              `<b>${f.flightKey}</b><br/>${f.origin} → ${f.destination}<br/>Sale ${f.departureUtc} · Llega ${f.arrivalUtc} UTC`,
              { direction: 'top', offset: [0, -12] }
            )

          layers[f.flightKey] = { marker, polyline }
        } else {
          layers[f.flightKey].marker.setLatLng([curLat, curLng])
        }
      })
    }

    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <Box sx={{ flex: 1, height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </Box>
  )
}