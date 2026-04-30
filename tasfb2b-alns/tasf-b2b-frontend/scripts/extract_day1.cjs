/**
 * Script para extraer pedidos de un solo dia (2026-01-02) y ejecutar ALNS
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DATOS_DIR = path.join(PROJECT_ROOT, 'datos');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs', 'sample_data', 'day2');
const ENVIOS_DIR = path.join(DATOS_DIR, '_envios_preliminar-20260416T023321Z-3-001', '_envios_preliminar');

const TARGET_DATE = '2026-01-02';
const PERIOD_DAYS = 5;

// Helper: read UTF-16BE file
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

// 1. Parse Aeropuertos
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
    if (!fileName) { console.error('ERROR: No airport file found'); process.exit(1); }
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
    console.log(`Aeropuertos parseados: ${airports.length}`);
    return airports;
}

// 2. Parse Vuelos (solo dia 1)
function parseVuelos(airports) {
    const content = fs.readFileSync(path.join(DATOS_DIR, 'planes_vuelo.txt'), 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const airportMap = {};
    airports.forEach(a => { airportMap[a.icao] = a; });
    const flights = [];
    let flightId = 1;
    const baseDate = new Date(TARGET_DATE + 'T00:00:00Z');

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
    console.log(`Vuelos generados: ${flights.length} (dia ${TARGET_DATE})`);
    return flights;
}

// 3. Parse Envios (TARGET_DATE y los PERIOD_DAYS siguientes)
function parseEnvios(airports) {
    const airportMap = {};
    airports.forEach(a => { airportMap[a.icao] = a; });
    const envios = [];
    const baseDate = new Date(TARGET_DATE + 'T00:00:00Z');
    const validDates = new Set();
    for (let d = 0; d < PERIOD_DAYS; d++) {
        const date = new Date(baseDate.getTime());
        date.setUTCDate(date.getUTCDate() + d);
        validDates.add(date.toISOString().substring(0, 10).replace(/-/g, ''));
    }
    let totalParsed = 0;

    for (const apt of airports) {
        const originICAO = apt.icao;
        const filePath = path.join(ENVIOS_DIR, `_envios_${originICAO}_.txt`);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        const fileLines = content.split(/\r?\n/).filter(l => l.trim());
        let dayCount = 0;

        for (const line of fileLines) {
            const parts = line.trim().split('-');
            if (parts.length < 7) continue;

            const seqId = parts[0];
            const dateStr = parts[1];

            if (!validDates.has(dateStr)) continue;

            const hour = parseInt(parts[2]);
            const minute = parseInt(parts[3]);
            const destICAO = parts[4];
            const typeCode = parts[5];
            const bags = parseInt(parts[6]);

            if (isNaN(hour) || isNaN(bags) || !airportMap[destICAO]) continue;

            const originApt = airportMap[originICAO];
            const localDate = new Date(Date.UTC(
                parseInt(dateStr.substring(0, 4)),
                parseInt(dateStr.substring(4, 6)) - 1,
                parseInt(dateStr.substring(6, 8)),
                hour, minute, 0
            ));
            localDate.setUTCHours(localDate.getUTCHours() - originApt.gmtOffset);

            envios.push({
                id: `${originICAO}-${seqId}`,
                origin: originICAO,
                dest: destICAO,
                type: typeCode === '001' ? 'NORMAL' : 'URGENTE',
                bags: Math.max(1, Math.round(bags / 100)),
                availability: localDate.toISOString()
            });
            dayCount++;
            totalParsed++;
        }

        if (dayCount > 0) {
            console.log(`  ${originICAO}: ${dayCount} pedidos`);
        }
    }

    console.log(`\nTotal pedidos encontrados para ${PERIOD_DAYS} dias (${TARGET_DATE} a ${TARGET_DATE.split('-').slice(0,2).join('-')}-${String(parseInt(TARGET_DATE.split('-')[2]) + PERIOD_DAYS - 1).padStart(2,'0')}): ${totalParsed}`);
    return envios;
}

// 4. Write CSVs
function writeCSVs(airports, flights, envios) {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    let csv = 'idAeropuerto,ciudad,pais,continente,latitud,longitud,capacidadMaxima,tiempoProcesamientoMin\n';
    for (const a of airports) csv += `${a.icao},${a.city},${a.country},${a.continent},${a.lat},${a.lon},${a.capacity},${a.processingTimeMin}\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'aeropuertos.csv'), csv);

    csv = 'idVuelo,iataOrigen,iataDestino,horaSalidaUtc,horaLlegadaUtc,capacidadMaletas,cancelado\n';
    for (const f of flights) csv += `${f.id},${f.origin},${f.dest},${f.departure},${f.arrival},${f.capacity},${f.cancelled}\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'vuelos.csv'), csv);

    csv = 'idEnvio,iataOrigen,iataDestino,tipoPaquete,cantidadMaletas,horaDisponibilidadUtc\n';
    for (const e of envios) csv += `${e.id},${e.origin},${e.dest},${e.type},${e.bags},${e.availability}\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'envios.csv'), csv);

    csv = 'periodoDias,fechaInicioUtc,semillaAleatoria,configuracionAdicional,w1,w2,w3\n';
    csv += `${PERIOD_DAYS},${TARGET_DATE}T00:00:00Z,42,ninguna,0.5,0.2,0.3\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'parametros.csv'), csv);

    console.log(`\nCSVs generados en: ${OUTPUT_DIR}`);
    console.log(`  aeropuertos.csv: ${airports.length} registros`);
    console.log(`  vuelos.csv: ${flights.length} registros`);
    console.log(`  envios.csv: ${envios.length} registros`);
    console.log(`  parametros.csv: 1 registro`);
}

// 5. Run ALNS via API
function runALNS() {
    console.log('\n=== Ejecutando ALNS ===\n');

    const aeropuertosCsv = fs.readFileSync(path.join(OUTPUT_DIR, 'aeropuertos.csv'), 'utf8');
    const vuelosCsv = fs.readFileSync(path.join(OUTPUT_DIR, 'vuelos.csv'), 'utf8');
    const enviosCsv = fs.readFileSync(path.join(OUTPUT_DIR, 'envios.csv'), 'utf8');
    const parametrosCsv = fs.readFileSync(path.join(OUTPUT_DIR, 'parametros.csv'), 'utf8');

    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

    const bodyParts = [];

    function addField(name, filename, content, contentType = 'text/csv') {
        bodyParts.push(`--${boundary}`);
        bodyParts.push(`Content-Disposition: form-data; name="${name}"${filename ? `; filename="${filename}"` : ''}`);
        bodyParts.push(`Content-Type: ${contentType}`);
        bodyParts.push('');
        bodyParts.push(content);
    }

    addField('aeropuertos', 'aeropuertos.csv', aeropuertosCsv);
    addField('vuelos', 'vuelos.csv', vuelosCsv);
    addField('envios', 'envios.csv', enviosCsv);
    addField('parametros', 'parametros.csv', parametrosCsv);
    addField('algoritmo', null, 'ALNS', 'text/plain');

    bodyParts.push(`--${boundary}--`);

    const body = bodyParts.join('\r\n');

    const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/api/planner/execute',
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                console.log('=== Resultados ALNS ===\n');

                if (result.metadata) {
                    console.log('Metricas de Rendimiento:');
                    console.log(`  Size (Pedidos): ${envios.length}`);
                    console.log(`  Mean Time: ${result.metadata.tiempoEjecucionMs || 'N/A'} ms`);
                    console.log(`  Mean RAM: ${result.metadata.ramPromedioMb?.toFixed(2) || 'N/A'} MB`);
                    console.log(`  Mean CPU: ${result.metadata.cpuUsagePct?.toFixed(2) || 'N/A'}%`);
                    console.log(`  Tiempo total de entrega: ${result.metadata.totalDeliveryTimeMin || 'N/A'} min`);
                }

                if (result.kpis) {
                    console.log('\nKPIs:');
                    console.log(`  Funcion objetivo: ${result.kpis.objectiveValue?.toFixed(6) || 'N/A'}`);
                    console.log(`  Lotes asignados: ${result.kpis.lotesAsignados || 'N/A'}`);
                    console.log(`  Lotes no asignados: ${result.kpis.lotesNoAsignados || 'N/A'}`);
                    console.log(`  Maletas asignadas: ${result.kpis.maletasAsignadas || 'N/A'}`);
                    console.log(`  Tiempo espera promedio (min): ${result.kpis.tiempoEsperaPromedioMin?.toFixed(2) || 'N/A'}`);
                    console.log(`  Sobrecapacidad aeropuertos: ${result.kpis.sobrecapacidadAeropuertos || 'N/A'}`);
                }

                if (result.asignaciones) {
                    console.log(`\nTotal asignaciones: ${result.asignaciones.length}`);
                    console.log('\nPrimeras 10 asignaciones:');
                    result.asignaciones.slice(0, 10).forEach((a, i) => {
                        console.log(`  ${i + 1}. Envio ${a.idEnvio} -> Vuelo ${a.idVuelo} (${a.iataOrigen} -> ${a.iataDestino})`);
                    });
                    if (result.asignaciones.length > 10) {
                        console.log(`  ... y ${result.asignaciones.length - 10} mas`);
                    }
                }
            } catch (e) {
                console.log('Response (non-JSON):');
                console.log(data.substring(0, 500));
            }
        });
    });

    req.on('error', (e) => {
        console.log(`\nERROR: No se pudo conectar al backend ALNS en localhost:8080`);
        console.log(`\nPara ejecutar ALNS manualmente:`);
        console.log(`  1. Inicia el backend: cd ${path.join(PROJECT_ROOT, 'tasf-b2b-backend')} && run_backend.bat`);
        console.log(`  2. Luego re-ejecuta: node ${path.relative(PROJECT_ROOT, __filename)}`);
        console.log(`\nO sube los CSVs manualmente al frontend en http://localhost:5173`);
        console.log(`Los CSVs estan listos en: ${OUTPUT_DIR}`);
    });

    req.write(body);
    req.end();
}

// Main
console.log('=== Extraccion de pedidos para ' + TARGET_DATE + ' ===\n');

console.log('[1/5] Parseando aeropuertos...');
const airports = parseAeropuertos();

console.log('[2/5] Generando vuelos (solo dia 1)...');
const flights = parseVuelos(airports);

console.log('[3/5] Extrayendo pedidos del dia ' + TARGET_DATE + '...');
const envios = parseEnvios(airports);

console.log('\n[4/5] Escribiendo CSVs...');
writeCSVs(airports, flights, envios);

console.log('\n[5/5] Intentando ejecutar ALNS...');
runALNS();
