/**
 * Conversor de datos crudos del proyecto PDDS → CSVs compatibles con Tasf.B2B
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DATOS_DIR = path.join(PROJECT_ROOT, 'datos');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs', 'sample_data');
const ENVIOS_DIR = path.join(DATOS_DIR, '_envios_preliminar-20260416T023321Z-3-001', '_envios_preliminar');

const BASE_DATE = '2026-01-02';
const PERIOD_DAYS = 3;
const MAX_ENVIOS_PER_ORIGIN = 300;
const ORIGIN_AIRPORTS = ['SPIM', 'SKBO', 'SCEL', 'SABE', 'SBBR', 'SEQM'];

// ── Helper: read UTF-16BE file ──────────────────────────────────────
function readUTF16BE(filePath) {
    const buf = fs.readFileSync(filePath);
    let start = 0;
    if (buf[0] === 0xFE && buf[1] === 0xFF) start = 2;
    const swapped = Buffer.alloc(buf.length - start);
    for (let i = 0; i < swapped.length - 1; i += 2) {
        swapped[i] = buf[start + i + 1];
        swapped[i + 1] = buf[start + i];
    }
    return swapped.toString('utf16le');
}

// ── 1. Parsear Aeropuertos ──────────────────────────────────────────
function parseDMS(dmsStr) {
    const cleaned = dmsStr.replace(/[°?]/g, ' ').replace(/'/g, ' ').replace(/"/g, ' ');
    const parts = cleaned.trim().split(/\s+/).filter(p => p.length > 0);
    let deg = 0, min = 0, sec = 0, dir = '';
    if (parts.length >= 4) {
        deg = parseFloat(parts[0]) || 0;
        min = parseFloat(parts[1]) || 0;
        sec = parseFloat(parts[2]) || 0;
        dir = parts[3];
    } else if (parts.length >= 3) {
        deg = parseFloat(parts[0]) || 0;
        min = parseFloat(parts[1]) || 0;
        dir = parts[2];
    }
    let decimal = deg + min / 60 + sec / 3600;
    if (dir === 'S' || dir === 'W') decimal *= -1;
    return decimal;
}

function parseAeropuertos() {
    const fileName = fs.readdirSync(DATOS_DIR).find(f => f.includes('Aeropuerto'));
    if (!fileName) { console.log('  ERROR: No airport file found'); return []; }
    const content = readUTF16BE(path.join(DATOS_DIR, fileName));
    const lines = content.split(/\r?\n/);
    const airports = [];
    let currentContinent = 'SUR_AMERICA';
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('PDDS')) continue;
        if (/America del Sur/i.test(trimmed)) { currentContinent = 'SUR_AMERICA'; continue; }
        if (/^Europa/i.test(trimmed)) { currentContinent = 'EUROPA'; continue; }
        if (/^Asia/i.test(trimmed)) { currentContinent = 'ASIA'; continue; }
        const match = trimmed.match(/^\d+\s+([A-Z]{4})\s+(.+?)\s{2,}(\S+)\s+\S+\s+([\-+]?\d+)\s+(\d+)\s+Latitude:\s*(.+?)\s+Longitude:\s*(.+?)$/);
        if (match) {
            const icao = match[1];
            const city = match[2].trim().replace(/,/g, '');
            const country = match[3].trim().replace(/,/g, '');
            const gmtOffset = parseInt(match[4]);
            const capacity = parseInt(match[5]);
            const latStr = match[6].replace(/E\??$/, '').trim();
            const lonStr = match[7].replace(/E\??$/, '').trim();
            airports.push({
                icao, city, country, continent: currentContinent,
                lat: parseDMS(latStr).toFixed(6), lon: parseDMS(lonStr).toFixed(6),
                capacity, gmtOffset, processingTimeMin: 30
            });
        }
    }
    console.log(`  Aeropuertos parseados: ${airports.length}`);
    return airports;
}

// ── 2. Parsear Vuelos ───────────────────────────────────────────────
function parseVuelos(airports) {
    const content = fs.readFileSync(path.join(DATOS_DIR, 'planes_vuelo.txt'), 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const airportMap = {};
    airports.forEach(a => { airportMap[a.icao] = a; });
    const flights = [];
    let flightId = 1;
    const baseDate = new Date(BASE_DATE + 'T00:00:00Z');
    for (let day = 0; day < PERIOD_DAYS; day++) {
        for (const line of lines) {
            const parts = line.trim().split('-');
            if (parts.length < 5) continue;
            const origin = parts[0];
            const dest = parts[1];
            const depTimeParts = parts[2].split(':');
            const arrTimeParts = parts[3].split(':');
            const capStr = parts[4];
            if (depTimeParts.length < 2 || arrTimeParts.length < 2) continue;
            const depHour = parseInt(depTimeParts[0]);
            const depMinute = parseInt(depTimeParts[1]);
            const arrHour = parseInt(arrTimeParts[0]);
            const arrMinute = parseInt(arrTimeParts[1]);
            const capacity = parseInt(capStr);
            if (isNaN(depHour) || isNaN(capacity)) continue;
            const originApt = airportMap[origin];
            const destApt = airportMap[dest];
            if (!originApt || !destApt) continue;
            const depDate = new Date(baseDate.getTime());
            depDate.setUTCDate(baseDate.getUTCDate() + day);
            depDate.setUTCHours(depHour - originApt.gmtOffset, depMinute, 0, 0);
            const arrDate = new Date(baseDate.getTime());
            arrDate.setUTCDate(baseDate.getUTCDate() + day);
            arrDate.setUTCHours(arrHour - destApt.gmtOffset, arrMinute, 0, 0);
            if (arrDate <= depDate) arrDate.setUTCDate(arrDate.getUTCDate() + 1);
            const id = `V${String(flightId++).padStart(6, '0')}`;
            flights.push({ id, origin, dest, departure: depDate.toISOString(), arrival: arrDate.toISOString(), capacity, cancelled: false });
        }
    }
    console.log(`  Vuelos generados: ${flights.length} (${PERIOD_DAYS} dias x ~${lines.length} lineas)`);
    return flights;
}

// ── 3. Parsear Envios ───────────────────────────────────────────────
function parseEnvios(airports) {
    const airportMap = {};
    airports.forEach(a => { airportMap[a.icao] = a; });
    const envios = [];
    const baseDateObj = new Date(BASE_DATE + 'T00:00:00Z');
    const endDate = new Date(baseDateObj);
    endDate.setUTCDate(endDate.getUTCDate() + PERIOD_DAYS);
    for (const apt of airports) {
        const originICAO = apt.icao;
        const filePath = path.join(ENVIOS_DIR, `_envios_${originICAO}_.txt`);
        if (!fs.existsSync(filePath)) { console.log(`  [WARN] Not found: ${originICAO}`); continue; }
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        let count = 0;
        for (const line of lines) {
            if (count >= MAX_ENVIOS_PER_ORIGIN) break;
            const parts = line.trim().split('-');
            if (parts.length < 7) continue;
            const seqId = parts[0], dateStr = parts[1];
            const hour = parseInt(parts[2]), minute = parseInt(parts[3]);
            const destICAO = parts[4], typeCode = parts[5], bags = parseInt(parts[6]);
            if (isNaN(hour) || isNaN(bags) || !airportMap[destICAO]) continue;
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            const originApt = airportMap[originICAO];
            const localDate = new Date(Date.UTC(year, month, day, hour, minute, 0));
            localDate.setUTCHours(localDate.getUTCHours() - originApt.gmtOffset);
            if (localDate < baseDateObj || localDate >= endDate) continue;
            envios.push({
                id: `${originICAO}-${seqId}`, origin: originICAO, dest: destICAO,
                type: typeCode === '001' ? 'NORMAL' : 'URGENTE',
                bags: Math.max(1, Math.round(bags / 100)), // Escalar: datos crudos son ~12000, vuelos ~300-480
                availability: localDate.toISOString()
            });
            count++;
        }
        console.log(`  Envios de ${originICAO}: ${count}`);
    }
    console.log(`  Total envios: ${envios.length}`);
    return envios;
}

// ── 4. Escribir CSVs ────────────────────────────────────────────────
function writeCSVs(airports, flights, envios) {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    let csv = 'idAeropuerto,ciudad,pais,continente,latitud,longitud,capacidadMaxima,tiempoProcesamientoMin\n';
    for (const a of airports) csv += `${a.icao},${a.city},${a.country},${a.continent},${a.lat},${a.lon},${a.capacity},${a.processingTimeMin}\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'aeropuertos.csv'), csv);
    console.log(`  aeropuertos.csv (${airports.length} registros)`);
    csv = 'idVuelo,iataOrigen,iataDestino,horaSalidaUtc,horaLlegadaUtc,capacidadMaletas,cancelado\n';
    for (const f of flights) csv += `${f.id},${f.origin},${f.dest},${f.departure},${f.arrival},${f.capacity},${f.cancelled}\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'vuelos.csv'), csv);
    console.log(`  vuelos.csv (${flights.length} registros)`);
    csv = 'idEnvio,iataOrigen,iataDestino,tipoPaquete,cantidadMaletas,horaDisponibilidadUtc\n';
    for (const e of envios) csv += `${e.id},${e.origin},${e.dest},${e.type},${e.bags},${e.availability}\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'envios.csv'), csv);
    console.log(`  envios.csv (${envios.length} registros)`);
    csv = 'periodoDias,fechaInicioUtc,semillaAleatoria,configuracionAdicional,w1,w2,w3\n';
    csv += `${PERIOD_DAYS},${BASE_DATE}T00:00:00Z,42,ninguna,0.5,0.2,0.3\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'parametros.csv'), csv);
    console.log(`  parametros.csv`);
}

// ── Main ────────────────────────────────────────────────────────────
console.log('=== Conversor PDDS -> Tasf.B2B CSVs ===\n');
console.log('[1/4] Parseando aeropuertos...');
const airports = parseAeropuertos();
console.log('[2/4] Generando vuelos...');
const flights = parseVuelos(airports);
console.log('[3/4] Parseando envios...');
const envios = parseEnvios(airports);
console.log('\n[4/4] Escribiendo CSVs...');
writeCSVs(airports, flights, envios);
console.log('\n=== Conversion completada ===');
console.log(`Archivos en: ${OUTPUT_DIR}`);
