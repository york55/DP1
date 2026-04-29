const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const SAMPLE_DATA_DIR = path.join(PROJECT_ROOT, 'docs', 'sample_data');
const REPORT_FILE = path.join(PROJECT_ROOT, 'docs', 'reporte_ejecuciones.csv');

const aeropuertosPath = path.join(SAMPLE_DATA_DIR, 'aeropuertos.csv');
const vuelosPath = path.join(SAMPLE_DATA_DIR, 'vuelos.csv');
const parametrosPath = path.join(SAMPLE_DATA_DIR, 'parametros.csv');

async function runRun(enviosPath, size, pass, runIndex) {
    const form = new FormData();
    
    const aeropuertosBlob = new Blob([fs.readFileSync(aeropuertosPath)]);
    const aeropuertosFile = new File([aeropuertosBlob], 'aeropuertos.csv', { type: 'text/csv' });
    form.append('aeropuertos', aeropuertosFile);
    
    const vuelosBlob = new Blob([fs.readFileSync(vuelosPath)]);
    const vuelosFile = new File([vuelosBlob], 'vuelos.csv', { type: 'text/csv' });
    form.append('vuelos', vuelosFile);
    
    const enviosBlob = new Blob([fs.readFileSync(enviosPath)]);
    const enviosFile = new File([enviosBlob], path.basename(enviosPath), { type: 'text/csv' });
    form.append('envios', enviosFile);
    
    const parametrosBlob = new Blob([fs.readFileSync(parametrosPath)]);
    const parametrosFile = new File([parametrosBlob], 'parametros.csv', { type: 'text/csv' });
    form.append('parametros', parametrosFile);
    
    form.append('algoritmo', 'ALNS');

    try {
        const res = await fetch('http://localhost:8080/api/planner/execute', {
            method: 'POST',
            body: form
        });
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        return {
            size,
            pass,
            run: runIndex,
            tiempoEjecucionMs: data.metadata.tiempoEjecucionMs,
            ramPromedioMb: data.metadata.ramPromedioMb,
            cpuUsagePct: data.metadata.cpuUsagePct,
            totalDeliveryTimeMin: data.metadata.totalDeliveryTimeMin
        };
    } catch (error) {
        console.error(`Error en ejecucion ${size}_${pass} run ${runIndex}:`, error.message);
        return null;
    }
}

async function main() {
    const sizes = [10, 30, 50];
    const passes = [1, 2, 3];
    const executions = 30;

    // Escribir header
    fs.writeFileSync(REPORT_FILE, 'Tamaño,Pasada,Ejecucion,TiempoEjecucionMs,UsoMemoriaMB,UsoCPU,TiempoTotalEntregaMin\n');

    for (const size of sizes) {
        for (const pass of passes) {
            const enviosFile = path.join(SAMPLE_DATA_DIR, `envios_${size}_${pass}.csv`);
            console.log(`Iniciando ${executions} ejecuciones para ${enviosFile}...`);
            
            for (let i = 1; i <= executions; i++) {
                const result = await runRun(enviosFile, size, pass, i);
                if (result) {
                    const line = `${result.size},${result.pass},${result.run},${result.tiempoEjecucionMs},${result.ramPromedioMb},${result.cpuUsagePct},${result.totalDeliveryTimeMin}\n`;
                    fs.appendFileSync(REPORT_FILE, line);
                    console.log(`  [${i}/${executions}] Size=${size} Pass=${pass} Time=${result.tiempoEjecucionMs}ms RAM=${result.ramPromedioMb.toFixed(2)}MB CPU=${result.cpuUsagePct.toFixed(1)}% Delivery=${result.totalDeliveryTimeMin}min`);
                }
            }
        }
    }
    console.log(`Proceso completado. Reporte guardado en: ${REPORT_FILE}`);
}

main();
