/**
 * run_experiment.js
 * 
 * Script genérico para ejecutar experimentos ALNS.
 * Envía N iteraciones al backend y recopila métricas en un CSV.
 *
 * Uso:
 *   node run_experiment.js --data-dir <ruta> [--parametros <ruta>] [--iterations <N>] --output <archivo.csv>
 *
 * Ejemplo:
 *   node run_experiment.js --data-dir docs/sample_data/day1 --iterations 10 --output exp_3_day_results.csv
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Parse CLI arguments ────────────────────────────────────────────
function parseArgs() {
    const args = process.argv.slice(2);
    const opts = { iterations: 10 };
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--data-dir':    opts.dataDir    = args[++i]; break;
            case '--parametros':  opts.parametros = args[++i]; break;
            case '--iterations':  opts.iterations = parseInt(args[++i], 10); break;
            case '--maxBags':     opts.maxBags    = parseInt(args[++i], 10); break;
            case '--output':      opts.output     = args[++i]; break;
        }
    }
    if (!opts.dataDir || !opts.output) {
        console.error('Uso: node run_experiment.js --data-dir <dir> [--parametros <file>] [--iterations N] --output <file.csv>');
        process.exit(1);
    }
    return opts;
}

// ─── Build multipart body ───────────────────────────────────────────
function buildMultipartBody(dataDir, parametrosOverride, maxBags) {
    const boundary = crypto.randomBytes(16).toString('hex');
    const CRLF = '\r\n';
    const parts = [];

    function addField(name, value, filename, contentType) {
        parts.push(`--${boundary}${CRLF}`);
        if (filename) {
            parts.push(`Content-Disposition: form-data; name="${name}"; filename="${filename}"${CRLF}`);
            parts.push(`Content-Type: ${contentType}${CRLF}${CRLF}`);
        } else {
            parts.push(`Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}`);
        }
        parts.push(Buffer.isBuffer(value) ? value : Buffer.from(String(value)));
        parts.push(CRLF);
    }

    addField('algoritmo', 'ALNS');
    addField('aeropuertos', fs.readFileSync(path.join(dataDir, 'aeropuertos.csv')), 'aeropuertos.csv', 'text/csv');
    addField('vuelos',      fs.readFileSync(path.join(dataDir, 'vuelos.csv')),      'vuelos.csv',      'text/csv');
    addField('envios',      fs.readFileSync(path.join(dataDir, 'envios.csv')),      'envios.csv',      'text/csv');

    const parametrosPath = parametrosOverride || path.join(dataDir, 'parametros.csv');
    addField('parametros', fs.readFileSync(parametrosPath), 'parametros.csv', 'text/csv');

    if (maxBags) {
        addField('maxBags', maxBags);
    }

    parts.push(`--${boundary}--${CRLF}`);

    const buffer = Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));
    return { buffer, boundary };
}

// ─── Execute a single ALNS call ─────────────────────────────────────
function executeAlns(bodyBuffer, boundary) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 8080,
            path: '/api/planner/execute',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': bodyBuffer.length,
            },
            timeout: 3600000, // 1 hora timeout por iteración
        };

        const req = http.request(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString();
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 300)}`));
                    return;
                }
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error(`Error parsing JSON: ${e.message}\n${body.substring(0, 300)}`));
                }
            });
        });

        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        req.on('error', (e) => reject(e));
        req.write(bodyBuffer);
        req.end();
    });
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
    const opts = parseArgs();

    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       ALNS EXPERIMENT RUNNER                    ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Data dir   : ${opts.dataDir}`);
    console.log(`║  Parametros : ${opts.parametros || opts.dataDir + '/parametros.csv'}`);
    console.log(`║  Iteraciones: ${opts.iterations}`);
    console.log(`║  Output     : ${opts.output}`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    // Verificar que los archivos existen
    const dataDir = opts.dataDir;
    const requiredFiles = ['aeropuertos.csv', 'vuelos.csv', 'envios.csv'];
    for (const f of requiredFiles) {
        const fp = path.join(dataDir, f);
        if (!fs.existsSync(fp)) {
            console.error(`ERROR: No se encontró ${fp}`);
            process.exit(1);
        }
    }
    const parametrosPath = opts.parametros || path.join(dataDir, 'parametros.csv');
    if (!fs.existsSync(parametrosPath)) {
        console.error(`ERROR: No se encontró ${parametrosPath}`);
        process.exit(1);
    }

    // Construir el body una sola vez (es el mismo para todas las iteraciones)
    const { buffer, boundary } = buildMultipartBody(dataDir, opts.parametros, opts.maxBags);
    console.log(`Tamaño del request: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log('');

    // Escribir header del CSV
    const csvHeader = 'Iteracion,Tiempo_Ejecucion,Envios_Total,Envios_Asignados,Envios_Fallidos,Pct_Asignados,Pct_Entregas_Tiempo,Costo_Solucion,Tiempo_Entrega,Consumo_Memoria,Consumo_CPU\n';
    fs.writeFileSync(opts.output, csvHeader);

    const results = [];

    for (let i = 1; i <= opts.iterations; i++) {
        const startLabel = new Date().toLocaleTimeString();
        console.log(`── Iteración ${i}/${opts.iterations} iniciada a las ${startLabel} ──`);

        try {
            const response = await executeAlns(buffer, boundary);

            // Extraer métricas (según estructura de PlannerController.java)
            const metadata = response.metadata || {};

            const tiempoEjecucion = response.tiempoEjecucionMs || metadata.tiempoEjecucionMs || 0;
            const enviosTotal     = response.pedidosProcesados || metadata.totalPedidosProcesados || 0;
            const enviosAsignados = response.asignaciones || 0;
            const enviosFallidos  = enviosTotal - enviosAsignados;
            const pctAsignados    = response.enviosAsignados || 0; // Ya viene en % (0..100)
            const pctATiempo      = response.entregasATiempo || 0; // Ya viene en % (0..100)
            const costoSolucion   = response.funcionObjetivo || 0;
            const tiempoEntrega   = metadata.totalDeliveryTimeMin || 0;
            const consumoMemoria  = metadata.ramPromedioMb || 0;
            const consumoCPU      = metadata.cpuUsagePct || 0;

            const row = {
                Iteracion: i,
                Tiempo_Ejecucion: tiempoEjecucion,
                Envios_Total: enviosTotal,
                Envios_Asignados: enviosAsignados,
                Envios_Fallidos: enviosFallidos,
                Pct_Asignados: parseFloat(pctAsignados.toFixed(2)),
                Pct_Entregas_Tiempo: parseFloat(pctATiempo.toFixed(2)),
                Costo_Solucion: parseFloat(costoSolucion.toFixed(6)),
                Tiempo_Entrega: tiempoEntrega,
                Consumo_Memoria: parseFloat(consumoMemoria.toFixed(2)),
                Consumo_CPU: parseFloat(consumoCPU.toFixed(2)),
            };

            results.push(row);

            // Append al CSV
            const csvLine = `${row.Iteracion},${row.Tiempo_Ejecucion},${row.Envios_Total},${row.Envios_Asignados},${row.Envios_Fallidos},${row.Pct_Asignados},${row.Pct_Entregas_Tiempo},${row.Costo_Solucion},${row.Tiempo_Entrega},${row.Consumo_Memoria},${row.Consumo_CPU}\n`;
            fs.appendFileSync(opts.output, csvLine);

            console.log(`   ✔ Tiempo: ${tiempoEjecucion} ms | Entrega: ${tiempoEntrega} min | RAM: ${consumoMemoria.toFixed(2)} MB | CPU: ${consumoCPU.toFixed(1)}%`);
            console.log('');

        } catch (err) {
            console.error(`   ✘ ERROR en iteración ${i}: ${err.message}`);
            // Escribir fila de error en el CSV
            const csvLine = `${i},ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR\n`;
            fs.appendFileSync(opts.output, csvLine);
            console.log('');
        }
    }

    // Resumen final
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║                 RESUMEN FINAL                   ║');
    console.log('╠══════════════════════════════════════════════════╣');
    if (results.length > 0) {
        const avgTime   = results.reduce((s, r) => s + r.Tiempo_Ejecucion, 0) / results.length;
        const avgMem    = results.reduce((s, r) => s + r.Consumo_Memoria, 0) / results.length;
        const avgCPU    = results.reduce((s, r) => s + r.Consumo_CPU, 0) / results.length;
        console.log(`║  Iteraciones exitosas: ${results.length}/${opts.iterations}`);
        console.log(`║  Tiempo promedio     : ${avgTime.toFixed(0)} ms`);
        console.log(`║  RAM promedio        : ${avgMem.toFixed(2)} MB`);
        console.log(`║  CPU promedio        : ${avgCPU.toFixed(1)}%`);
    } else {
        console.log('║  No se completaron iteraciones exitosas.');
    }
    console.log(`║  Resultados en       : ${opts.output}`);
    console.log('╚══════════════════════════════════════════════════╝');
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
