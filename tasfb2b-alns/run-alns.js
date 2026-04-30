const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const boundary = crypto.randomBytes(16).toString('hex');
const CRLF = '\r\n';

function appendField(data, name, value, filename, contentType) {
  data.push(`--${boundary}${CRLF}`);
  if (filename) {
    data.push(`Content-Disposition: form-data; name="${name}"; filename="${filename}"${CRLF}`);
    data.push(`Content-Type: ${contentType}${CRLF}${CRLF}`);
  } else {
    data.push(`Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}`);
  }
  if (Buffer.isBuffer(value)) {
    data.push(value);
  } else {
    data.push(Buffer.from(String(value)));
  }
  data.push(CRLF);
}

const bodyParts = [];
appendField(bodyParts, 'algoritmo', 'ALNS');
appendField(bodyParts, 'aeropuertos', fs.readFileSync('docs/sample_data/day1/aeropuertos.csv'), 'aeropuertos.csv', 'text/csv');
appendField(bodyParts, 'vuelos', fs.readFileSync('docs/sample_data/day1/vuelos.csv'), 'vuelos.csv', 'text/csv');
appendField(bodyParts, 'envios', fs.readFileSync('docs/sample_data/day1/envios.csv'), 'envios.csv', 'text/csv');
appendField(bodyParts, 'parametros', fs.readFileSync('docs/sample_data/day1/parametros.csv'), 'parametros.csv', 'text/csv');
bodyParts.push(`--${boundary}--${CRLF}`);

const bodyBuffer = Buffer.concat(bodyParts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/planner/execute',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': bodyBuffer.length,
  },
  timeout: 1800000,
};

console.log(`Enviando ${bodyBuffer.length} bytes al backend...`);
console.log('Esto tomará ~10 minutos. Esperando respuesta...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  const chunks = [];
  res.on('data', (chunk) => {
    chunks.push(chunk);
    process.stdout.write('.');
  });
  res.on('end', () => {
    const body = Buffer.concat(chunks);
    console.log('\nRespuesta recibida!');
    console.log(`Tamaño: ${body.length} bytes`);
    fs.writeFileSync('docs/sample_data/day1/resultado.json', body);
    console.log('Guardado en docs/sample_data/day1/resultado.json');
    try {
      const json = JSON.parse(body);
      console.log('\n=== RESULTADO ===');
      console.log(`Algoritmo: ${json.metadata.algoritmo}`);
      console.log(`Pedidos procesados: ${json.metadata.totalPedidosProcesados}`);
      console.log(`Envíos asignados: ${json.asignaciones.length}`);
      console.log(`Entregas a tiempo: ${(json.kpis.pctEntregasATiempo * 100).toFixed(1)}%`);
      console.log(`F mejor: ${json.funcionObjetivo.valorFinal}`);
      console.log(`Tiempo ejecución: ${json.metadata.tiempoEjecucionMs} ms`);
    } catch (e) {
      console.log('Error parsing JSON:', e.message);
      console.log('Response:', body.toString().substring(0, 500));
    }
  });
});

req.on('timeout', () => {
  console.log('\nRequest timeout!');
  req.destroy();
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(bodyBuffer);
req.end();
