const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const SAMPLE_DATA_DIR = path.join(PROJECT_ROOT, 'docs', 'sample_data');
const ENVIOS_FILE = path.join(SAMPLE_DATA_DIR, 'envios.csv');

function generateSubsets() {
    if (!fs.existsSync(ENVIOS_FILE)) {
        console.error(`Error: ${ENVIOS_FILE} no existe.`);
        return;
    }

    const content = fs.readFileSync(ENVIOS_FILE, 'utf8');
    const lines = content.split(/\r?\n/);
    const header = lines[0];
    const dataLines = lines.slice(1).filter(l => l.trim());

    // Parsear y ordenar por fecha
    const orders = dataLines.map(line => {
        const parts = line.split(',');
        return {
            line: line,
            id: parts[0],
            dateStr: parts[5] // horaDisponibilidadUtc
        };
    });

    // Agrupar por día (2026-01-02, 2026-01-03, 2026-01-04)
    const days = {
        '2026-01-02': [],
        '2026-01-03': [],
        '2026-01-04': []
    };

    orders.forEach(o => {
        if (o.dateStr.startsWith('2026-01-02')) days['2026-01-02'].push(o);
        else if (o.dateStr.startsWith('2026-01-03')) days['2026-01-03'].push(o);
        else if (o.dateStr.startsWith('2026-01-04')) days['2026-01-04'].push(o);
    });

    // Ordenar cada día por fecha/hora
    Object.keys(days).forEach(day => {
        days[day].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    });

    const sizes = [10, 30, 50];
    const dayKeys = ['2026-01-02', '2026-01-03', '2026-01-04'];

    sizes.forEach(size => {
        dayKeys.forEach((day, index) => {
            const pass = index + 1;
            const subset = days[day].slice(0, size);
            
            if (subset.length < size) {
                console.warn(`[WARN] No hay suficientes pedidos para el día ${day}. Requeridos: ${size}, Disponibles: ${subset.length}`);
            }

            const outputFile = path.join(SAMPLE_DATA_DIR, `envios_${size}_${pass}.csv`);
            const csvContent = [header, ...subset.map(o => o.line)].join('\n');
            fs.writeFileSync(outputFile, csvContent);
            console.log(`Creado: envios_${size}_${pass}.csv con ${subset.length} pedidos.`);
        });
    });
}

generateSubsets();
