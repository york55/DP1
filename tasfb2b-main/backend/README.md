# TASF.B2B Backend

Sistema de Gestión y Planificación de Traslado de Equipaje — Spring Boot 3.2 + Java 21.

## Requisitos previos

- Java 21 LTS
- MySQL 8.0+
- Apache Maven 3.9+

## Configuración de base de datos

```sql
CREATE DATABASE tasfb2b CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tasfb2b_user'@'localhost' IDENTIFIED BY 'changeme';
GRANT ALL PRIVILEGES ON tasfb2b.* TO 'tasfb2b_user'@'localhost';
FLUSH PRIVILEGES;
```

## Variables de entorno

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `DB_URL` | `jdbc:mysql://localhost:3306/tasfb2b?useSSL=false&serverTimezone=UTC` | URL de conexión MySQL |
| `DB_USER` | `tasfb2b_user` | Usuario de base de datos |
| `DB_PASSWORD` | `changeme` | Contraseña de base de datos |
| `SERVER_PORT` | `8080` | Puerto del servidor |
| `WS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Orígenes permitidos CORS/WS |

## Arrancar el backend

```bash
# Compilar
mvn clean package -DskipTests

# Arrancar en modo dev (Flyway crea el esquema y carga datos semilla)
java -jar target/tasfb2b.jar --spring.profiles.active=dev

# Arrancar en modo demo
java -jar target/tasfb2b.jar --spring.profiles.active=demo
```

Flyway ejecuta automáticamente V1–V5 al arrancar por primera vez.

## Datos semilla

Los vuelos de demo están configurados para **startDate = 2026-05-10** (7 días disponibles).
Al crear una simulación, usa `startDate: "2026-05-10"` para el demo.

## Endpoints principales

### Simulaciones

```bash
# Crear simulación
curl -X POST http://localhost:8080/api/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "scenarioType": "PERIOD",
    "periodDays": 3,
    "startDate": "2026-05-10",
    "algorithm": "ALNS",
    "cancellationRate": 10.0,
    "seed": 42,
    "volumePerDay": 10
  }'

# Iniciar simulación (id=1)
curl -X PUT http://localhost:8080/api/simulations/1/start

# Pausar
curl -X PUT http://localhost:8080/api/simulations/1/pause

# Reanudar
curl -X PUT http://localhost:8080/api/simulations/1/resume

# KPIs
curl http://localhost:8080/api/simulations/1/kpis
```

### Aeropuertos y vuelos

```bash
curl http://localhost:8080/api/airports
curl http://localhost:8080/api/flights
curl http://localhost:8080/api/shipments
```

## WebSocket STOMP

Conectarse con SockJS + STOMP.js al endpoint `/ws`:

```javascript
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const client = new Client({
  webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
  onConnect: () => {
    client.subscribe('/topic/simulation/1/tick', (msg) => {
      const event = JSON.parse(msg.body)
      console.log('Tick:', event.simulatedTime, event.kpis)
    })
  }
})
client.activate()
```

**Tópicos:**
- `/topic/simulation/{id}/tick` — eventos de tick (KPIs, vuelos, aeropuertos)
- `/topic/alerts` — alertas operacionales (cancelaciones, retrasos, capacidad crítica)

## Health Check

```bash
curl http://localhost:8080/actuator/health
```

## Migración a AWS

1. **DB_URL** → endpoint de Amazon RDS MySQL 8
2. **DB_USER / DB_PASSWORD** → AWS Secrets Manager o Parameter Store
3. Subir `tasfb2b.jar` a Elastic Beanstalk (Java 21 platform)
4. Configurar sticky sessions en ALB para WebSocket
5. Logs a CloudWatch via stdout (Logback ya configurado)

## Algoritmos

- **ALNS** (default): Adaptive Large Neighborhood Search con Simulated Annealing
  - Operadores destroy: RouteRemoval, RelatedRemoval, WorstRemoval
  - Operador repair: Regret-k Insertion


## Ejecutar tests

```bash
mvn test -Dspring.profiles.active=test
```
