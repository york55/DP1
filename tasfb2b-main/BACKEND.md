# TASF.B2B — Backend Documentation

> Baggage Transfer Management & Planning System  
> Spring Boot 3.2.5 · Java 21 · MySQL · WebSocket/STOMP

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Configuration & Profiles](#4-configuration--profiles)
5. [Domain Model](#5-domain-model)
6. [REST API](#6-rest-api)
7. [Service Layer](#7-service-layer)
8. [Optimization Algorithm — ALNS](#8-optimization-algorithm--alns)
9. [Simulation Engine](#9-simulation-engine)
10. [WebSocket Events](#10-websocket-events)
11. [End-to-End Data Flows](#11-end-to-end-data-flows)
12. [Database Migrations](#12-database-migrations)
13. [Security & CORS](#13-security--cors)
14. [Async & Scheduling](#14-async--scheduling)
15. [Exception Handling](#15-exception-handling)

---

## 1. Project Overview

TASF.B2B optimises the transfer of baggage across a multi-airport network. It models airports, flights, and batches of bags, then uses an **Adaptive Large Neighbourhood Search (ALNS)** algorithm to route every batch to its destination through one or more connecting flights. A discrete-event **simulation engine** advances simulated time in 30-minute ticks, processing arrivals, departures, random cancellations, SLA checks, and KPI snapshots — streaming everything to the frontend via WebSocket.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Language | Java 21 |
| Framework | Spring Boot 3.2.5 |
| ORM / DB access | Spring Data JPA (Hibernate) |
| Database | MySQL 8 with Flyway migrations |
| Messaging | Spring WebSocket + STOMP (SockJS fallback) |
| File parsing | Apache Commons CSV, custom line parser |
| Build | Maven 3 |
| Mapping | Manual mapper classes (no MapStruct) |
| Async | `@EnableAsync`, `ScheduledExecutorService` (10 threads) |
| Security | Spring Security (stateless, permit-all for `/api/**`) |

---

## 3. Project Structure

```
backend/src/main/java/pe/pucp/tasfb2b/
├── TasfB2bApplication.java          Main entry point (@SpringBootApplication, @EnableScheduling, @EnableAsync)
├── config/
│   ├── CorsConfig.java              CORS bean — allowed origins from application.yml
│   ├── SecurityConfig.java          Stateless security, CSRF off, all /api/** permitted
│   └── WebSocketConfig.java         STOMP broker /topic, endpoint /ws, SockJS enabled
├── controller/
│   ├── SimulationController.java    POST/GET/PUT /api/simulations
│   ├── ShipmentController.java      GET /api/shipments, POST /api/batches/upload
│   ├── FlightController.java        GET/POST /api/flights
│   └── AirportController.java       GET /api/airports
├── service/
│   ├── SimulationService.java       Lifecycle + scheduler management
│   ├── PlannerService.java          Algorithm orchestration + DB persistence of routes
│   ├── ShipmentService.java         Async file upload + batch insert
│   ├── FlightService.java           CSV upload + manual cancellation
│   ├── AirportService.java          Occupancy + semaphore level computation
│   └── KpiService.java              KPI snapshot retrieval
├── simulation/
│   ├── SimulationEngine.java        Per-tick event processing
│   ├── SimulationClock.java         Simulated-time state
│   └── SimulationRuntimeState.java  In-memory state per running simulation
├── planner/
│   ├── alns/
│   │   ├── AlnsEngine.java          ALNS main loop
│   │   ├── AlnsSolution.java        Solution representation
│   │   ├── AlnsParams.java          Tuning record
│   │   ├── destroy/
│   │   │   ├── RouteRemoval.java    Random removal operator
│   │   │   ├── RelatedRemoval.java  Related-route removal operator
│   │   │   └── WorstRemoval.java    Cost-based removal operator
│   │   └── repair/
│   │       └── RegretKInsertion.java k-regret insertion heuristic
│   ├── SimulationContext.java       Input snapshot for the planner
│   └── OptimizationResult.java      Output: assignments + unassigned + routes
├── domain/
│   ├── Airline.java
│   ├── Airport.java
│   ├── Flight.java
│   ├── BaggageBatch.java
│   ├── Shipment.java
│   ├── Route.java
│   ├── RouteLeg.java
│   ├── Simulation.java
│   ├── KpiSnapshot.java
│   ├── FlightCancellation.java
│   ├── ShipmentStatusHistory.java
│   └── enums/   (FlightStatus, BatchStatus, ShipmentStatus, RouteLegStatus, SimulationStatus, SemaphoreLevel)
├── repository/   (one JpaRepository per entity)
├── dto/
│   ├── request/   (CreateSimulationRequest, CancelFlightRequest, AlnsParamsRequest)
│   └── response/  (SimulationDto, ShipmentDto, FlightDto, AirportDto, KpiDto, SimulationTickEvent, UploadProgressDto, AlertEvent, PlanProgressSnapshot)
├── mapper/        (entity → DTO converters)
├── websocket/
│   └── WebSocketEventPublisher.java Wraps messagingTemplate.convertAndSend
└── exception/     (SimulationNotFoundException, PlanningException, CapacityExceededException, GlobalExceptionHandler)
```

---

## 4. Configuration & Profiles

**`application.yml`** — common defaults

```yaml
server.port: 8080                           # overridable via SERVER_PORT
spring.datasource.url: jdbc:mysql://localhost:3306/tasfb2b
spring.flyway.enabled: true
websocket.allowed-origins: http://localhost:5173,http://localhost:3000,http://localhost:4173
simulation.tick-interval-ms: 1000
alns.default.t0: 100.0
alns.default.alpha: 0.9995
alns.default.qPct: 0.25
alns.default.max-iterations: 1000
```

| Profile | Purpose |
|---|---|
| `dev` | Local MySQL, verbose SQL logging |
| `demo` | Demo DB with pre-seeded data, `startDate=2026-05-10` |
| `test` | H2 in-memory, Flyway off |

---

## 5. Domain Model

### Entity Relationship Overview

```
Airline ──────┐
              ├──► BaggageBatch ──► Shipment ──► Route ──► RouteLeg ──► Flight
Airport ──────┘
                                                                      ↑
                                                         Airport ─────┘ (origin/destination)

Simulation ──► KpiSnapshot
Flight     ──► FlightCancellation
Shipment   ──► ShipmentStatusHistory
```

### Key Entities

#### Airport
| Field | Type | Notes |
|---|---|---|
| `iataCode` | String(4) | Unique |
| `city`, `country`, `continent` | String | — |
| `warehouseCapacity` | int | Max bags stored |
| `currentOccupancy` | int | Updated each tick |
| `latitude`, `longitude` | BigDecimal(9,6) | Map coordinates |

#### Flight
| Field | Type | Notes |
|---|---|---|
| `originAirport`, `destinationAirport` | Airport (FK) | Lazy |
| `departureTime`, `arrivalTime` | LocalDateTime | Simulated |
| `baggageCapacity` | int | Max bags |
| `currentLoad` | int | Bags already assigned |
| `status` | FlightStatus | `SCHEDULED → IN_FLIGHT → LANDED / CANCELLED` |

`getRemainingCapacity()` = `baggageCapacity − currentLoad`  
`getProgress(simNow)` = fractional completion between departure and arrival

#### BaggageBatch
Represents a group of bags from an airline uploaded before simulation starts.  
Status progression: `IN_ORIGIN → IN_TRANSIT → DELIVERED` (or `DELAYED`)

#### Shipment
One-to-one with BaggageBatch. Created by the planner.  
Carries `deadline` (computed from continent distance) and `deliveredAt`.  
Status: `PLANNED → IN_TRANSIT → DELIVERED / DELAYED`

#### Route / RouteLeg
A Route is a sequence of RouteLeg records, each pointing to one Flight.  
`legOrder` determines traversal order. Leg status: `PENDING → IN_FLIGHT → COMPLETED / CANCELLED`

#### Simulation
Holds all tuning parameters:

| Field | Default | Description |
|---|---|---|
| `periodDays` | 3–7 | Simulated time window |
| `cancellationRate` | 0–1 | Probability per tick per flight |
| `seed` | — | RNG seed for reproducibility |
| `algorithm` | `ALNS` | Optimiser name |
| `t0`, `alphaSa`, `qPct`, `maxIterations` | 100, 0.9995, 0.25, 1000 | ALNS overrides |

Status flow: `CONFIGURED → PLANNING → RUNNING → PAUSED ↔ RUNNING → FINISHED`

#### KpiSnapshot
Persisted each tick with: `onTimePct`, `delayedCount`, `avgFlightOccupancy`, `avgWarehouseOccupancy`.

---

## 6. REST API

### Simulations — `/api/simulations`

| Method | Path | Body / Params | Response | Description |
|---|---|---|---|---|
| `POST` | `/` | `CreateSimulationRequest` | `SimulationDto` 201 | Create in CONFIGURED state |
| `GET` | `/` | — | `List<SimulationDto>` | All simulations |
| `GET` | `/{id}` | — | `SimulationDto` | Single simulation |
| `PUT` | `/{id}/start` | — | `SimulationDto` | Begin PLANNING → RUNNING |
| `PUT` | `/{id}/pause` | — | `SimulationDto` | Suspend ticks |
| `PUT` | `/{id}/resume` | — | `SimulationDto` | Restart ticks |
| `PUT` | `/{id}/stop` | — | `SimulationDto` | Cancel + FINISHED |
| `GET` | `/{id}/kpis` | — | `List<KpiDto>` | Full KPI history |

**`CreateSimulationRequest` fields:**

```json
{
  "scenarioType": "PERIOD",
  "periodDays": 5,
  "startDate": "2026-05-10",
  "algorithm": "ALNS",
  "cancellationRate": 0.05,
  "seed": 42,
  "volumePerDay": 1000,
  "alnsParams": {
    "t0": 100.0, "alpha": 0.9995, "qPct": 0.25, "maxIterations": 1000,
    "segLen": 100, "sigma1": 9.0, "sigma2": 3.0, "sigma3": 1.0,
    "rho": 0.1, "pNoise": 0.05, "w1": 0.7, "w2": 0.15, "w3": 0.15, "kRegret": 3
  }
}
```

---

### Shipments — `/api/shipments` and `/api/batches`

| Method | Path | Body / Params | Response | Description |
|---|---|---|---|---|
| `GET` | `/api/shipments` | `status`, `simulationId`, `page`, `size` | `Page<ShipmentDto>` or `List` | Query shipments |
| `GET` | `/api/shipments/{id}/status` | — | `ShipmentDto` | Single shipment |
| `POST` | `/api/batches/upload` | `multipart/form-data` (file) | `{message}` 202 | Async baggage file upload |

**Batch file format** (one record per line):

```
{id}-{YYYYMMDD}-{HH}-{mm}-{destIATA}-{qty}-{tracking}
```

Example: `000000001-20260102-00-47-SUAA-002-0032535`

The origin airport is extracted from the filename pattern `envios_{IATA}_`.  
Records are inserted in batches of 1 000, progress streamed via WebSocket.

---

### Flights — `/api/flights`

| Method | Path | Body / Params | Response | Description |
|---|---|---|---|---|
| `GET` | `/` | `status` (optional) | `List<FlightDto>` | All flights, optionally filtered |
| `POST` | `/{id}/cancel` | `CancelFlightRequest {reason}` | `FlightDto` | Manual cancellation |
| `POST` | `/upload` | CSV file | `{imported, failed, errors}` | Bulk flight import |

**CSV headers:** `origin_iata, destination_iata, departure_time, arrival_time, baggage_capacity, frequency`

---

### Airports — `/api/airports`

| Method | Path | Response | Description |
|---|---|---|---|
| `GET` | `/` | `List<AirportDto>` | All airports with live occupancy and semaphore level |

**Semaphore levels:** `LOW (<25%) → MODERATE (<50%) → HIGH (<amber) → VERY_HIGH (<red) → CRITICAL`

---

## 7. Service Layer

### SimulationService
- Manages simulation lifecycle and a `ScheduledExecutorService` (10 threads).
- On `startSimulation`: resets all flights in the period, sets status `PLANNING`, then registers a `TransactionSynchronization` — **after the DB commit**, calls `runInitialPlanning()` asynchronously.
- Once planning finishes, transitions to `RUNNING` and schedules `SimulationEngine.tick(id)` every `tickIntervalMs` (1 000 ms).
- `pauseSimulation` / `resumeSimulation` cancel / reschedule the per-simulation `ScheduledFuture`.
- Runtime state (`SimulationRuntimeState`) lives in a `ConcurrentHashMap<Long, SimulationRuntimeState>` for fast access without DB round-trips.

### PlannerService
- Entry points: `plan(context, algorithm)` and `replan(affectedBatches, context, algorithm)`.
- Delegates to `AlnsEngine`.
- Persists results: for every assigned batch creates a `Shipment` (with deadline), a `Route`, and one `RouteLeg` per flight hop — all in one transaction.
- **Deadline rule:** same continent → `simNow + 1 day`; different continent → `simNow + 2 days`.

### ShipmentService
- `@Async uploadBatchesAsync`: two-pass file parse (count lines, then process).
- Caches destination `Airport` lookups to avoid N+1 queries.
- Publishes `UploadProgressDto` to `/topic/shipments/progress` every 1 000 records.

### FlightService
- CSV upload via Apache Commons CSV with per-row error capture; returns summary `{imported, failed, errors}`.
- Manual `cancelFlight` records a `FlightCancellation` audit row.

### KpiService
- `findBySimulation(id)` → ordered list of snapshots.
- `getLatest(id)` → most recent snapshot (or `null`).

---

## 8. Optimization Algorithm — ALNS

**Goal:** assign each `BaggageBatch` to a sequence of one or two flights that deliver it on time, minimising unassigned bags, flight overloads, and waiting time.

### 8.1 Solution Representation

```
AlnsSolution
  assignments : Map<batchId, List<flightId>>   // assigned routes
  bank        : Set<batchId>                   // unassigned batches
  extraLoad   : Map<flightId, int>             // load above currentLoad
```

### 8.2 Greedy Initialisation

1. Sort batches by `availableFrom`.
2. For each batch: find the cheapest direct flight or cheapest two-hop connection (minimum 30-minute connection gap).
3. Assign if capacity allows; otherwise leave in `bank`.

### 8.3 ALNS Main Loop

```
T ← T₀
bestSolution ← greedySolution

for iter in 1..maxIterations:
    select destroyOp  by weighted roulette (weights updated every segLen)
    remove q% batches using destroyOp
    repair using RegretKInsertion
    Δcost ← eval(new) − eval(current)
    
    if Δcost ≤ 0:
        accept
    elif random() < exp(−Δcost / T):
        accept                              // Metropolis criterion
    
    update operator score (σ₁/σ₂/σ₃)
    T ← T × α                              // cooling
    
    if iter % segLen == 0:
        update weights using rho
        publish progress callback
```

### 8.4 Evaluation Function

```
cost = w₁ × (unassigned / total)           // w₁ = 0.70
     + w₂ × (totalOverload / totalCapacity) // w₂ = 0.15
     + w₃ × (totalWaitingMin / (assigned × 1440)) // w₃ = 0.15
```

### 8.5 Destroy Operators

| Operator | Strategy |
|---|---|
| `RouteRemoval` | Remove a random q% of assigned batches |
| `RelatedRemoval` | Remove batches sharing the highest-cost route |
| `WorstRemoval` | Remove batches with worst insertion cost (+ noise `pNoise=0.05`) |

### 8.6 Repair Operator — RegretK Insertion

For each unassigned batch, compute the **regret**: difference between the k-th best and best insertion cost.  
Always insert the batch with the highest regret first (most "urgent" assignment).  
Candidates include direct flights and two-hop connections with ≥ 30-minute layover.

### 8.7 Default Parameters

| Parameter | Value | Meaning |
|---|---|---|
| `T₀` | 100.0 | Initial SA temperature |
| `α` | 0.9995 | Cooling rate |
| `qPct` | 0.25 | Fraction destroyed per iteration |
| `maxIterations` | 1 000 | Loop limit |
| `segLen` | 100 | Weight-update interval |
| `σ₁ / σ₂ / σ₃` | 9 / 3 / 1 | Best / accepted / rejected score |
| `ρ` | 0.1 | Weight smoothing factor |
| `kRegret` | 3 | K for regret calculation |

### 8.8 Replanning (after cancellation)

When a flight is cancelled mid-simulation:
1. Find all `RouteLeg` records in `PENDING` state on that flight.
2. Extract affected `BaggageBatch` list.
3. Build a fresh `SimulationContext` with only `SCHEDULED` flights.
4. Call `AlnsEngine.replan()` — skips the destruction phase, runs only repair.
5. Persist new routes for the affected batches.

---

## 9. Simulation Engine

Each simulation tick advances simulated time by **30 minutes** and runs the following steps in order:

### Step 1 — Advance Clock
`SimulationClock.advance()` increments the internal `LocalDateTime` by `tickDurationMinutes`.  
`getSimulatedDay()` = `tickCount × tickDurationMinutes / 1440 + 1`

### Step 2 — Process Arrivals
For each `Flight` with `arrivalTime ≤ simNow` and `status = IN_FLIGHT`:
- Set flight → `LANDED`
- For each `RouteLeg` on that flight with status `IN_FLIGHT`:
  - If last leg → `Shipment.DELIVERED`, `BaggageBatch.DELIVERED`, record `Route.actualArrival`
  - Otherwise → `Shipment.IN_TRANSIT`
  - Append `ShipmentStatusHistory` row

### Step 3 — Process Departures
For each `Flight` with `departureTime ≤ simNow` and `status = SCHEDULED`:
- Set flight → `IN_FLIGHT`
- For each `RouteLeg` in `PENDING` → `IN_FLIGHT`
- `Shipment` and `BaggageBatch` → `IN_TRANSIT`

### Step 4 — Process Cancellations
For each remaining `SCHEDULED` flight, roll `random() < cancellationRate`:
- Set flight → `CANCELLED`, create `FlightCancellation`
- Cancel all `PENDING` legs on that flight
- Trigger `PlannerService.replan()` for affected batches
- Publish `AlertEvent` to `/topic/alerts`

### Step 5 — SLA Violation Check
For each `Shipment` with `deadline < simNow` and status not `DELIVERED`:
- Set `Shipment` → `DELAYED`, `BaggageBatch` → `DELAYED`

### Step 6 — Update Airport Occupancy
Count `BaggageBatch` records with `status = IN_ORIGIN` per airport → `currentOccupancy`.

### Step 7 — Persist KPI Snapshot
Calculate and save:
- `onTimePct` = delivered on time / total
- `delayedCount` = shipments in DELAYED state
- `avgFlightOccupancy` = mean `currentLoad / baggageCapacity` across IN_FLIGHT flights
- `avgWarehouseOccupancy` = mean `currentOccupancy / warehouseCapacity` across airports

### Step 8 — Check Period End
If `simNow ≥ startDate + periodDays` → set `FINISHED`, cancel scheduled task.

### Step 9 — Publish Tick Event
Send `SimulationTickEvent` to `/topic/simulation/{id}/tick` (see [WebSocket Events](#10-websocket-events)).

---

## 10. WebSocket Events

Connect: `ws://host:8080/ws` (SockJS)

| Destination | Payload | Trigger |
|---|---|---|
| `/topic/simulation/{id}/tick` | `SimulationTickEvent` | Every engine tick |
| `/topic/simulation/{id}/plan-progress` | `PlanProgressSnapshot` | Every 100 ALNS iterations |
| `/topic/alerts` | `AlertEvent` | Flight cancellation |
| `/topic/shipments/progress` | `UploadProgressDto` | Every 1 000 records during upload |

### SimulationTickEvent structure

```json
{
  "simulationId": 1,
  "simulatedDay": 2,
  "simulatedTime": "06:30",
  "elapsedRealSeconds": 45,
  "kpis": { "onTimePct": 94.2, "delayedCount": 3, "avgFlightOcc": 78.5, "avgWarehouseOcc": 42.1 },
  "airports": [{ "iata": "LIM", "occupancyPct": 65.0, "semaphoreLevel": "HIGH", "currentOccupancy": 650 }],
  "flights": [{ "flightId": 12, "originIata": "LIM", "destinationIata": "BOG", "progress": 0.42, "status": "IN_FLIGHT" }],
  "totalBags": 5000,
  "deliveredBags": 3200,
  "inTransitBags": 1500,
  "waitingBags": 250,
  "delayedBags": 50
}
```

### UploadProgressDto structure

```json
{ "processed": 3000, "total": 10000, "status": "IN_PROGRESS", "message": "Inserting batch 3/10..." }
```

---

## 11. End-to-End Data Flows

### 11.1 Create and Run a Simulation

```
POST /api/simulations
    → SimulationService.createSimulation()
    → Simulation saved (CONFIGURED)

PUT /api/simulations/{id}/start
    → Reset flights in period (SCHEDULED, currentLoad=0)
    → Simulation → PLANNING  [DB commit]
    → @Async: runInitialPlanning()
        → build SimulationContext (airports, flights, pending batches)
        → PlannerService.plan(context, "ALNS")
            → AlnsEngine.optimize()  [~1 000 iterations]
            → persistRoutes()  [Shipment + Route + RouteLeg saved]
        → Simulation → RUNNING
        → scheduleAtFixedRate(tick, 1 000 ms)
```

### 11.2 Per-Tick Simulation Loop

```
ScheduledExecutorService fires every 1 000 ms
    → SimulationEngine.tick(simulationId)
        → advance clock (+30 min)
        → processArrivals  → processDepaartures  → processCancellations
        → checkSlaViolations  → updateAirportOccupancy
        → persistKpi
        → if time ≥ end: FINISHED, cancel scheduler
        → publishTick → /topic/simulation/{id}/tick
```

### 11.3 Baggage File Upload

```
POST /api/batches/upload  (multipart)
    → ShipmentService.uploadBatchesAsync(bytes, filename)  [@Async]
        → extract origin IATA from filename
        → pass 1: count lines
        → pass 2: parse records, batch-insert every 1 000
            → publish progress to /topic/shipments/progress
        → publish COMPLETED
```

### 11.4 Flight Cancellation During Simulation

```
processCancellations() [inside tick]
    → Flight → CANCELLED + FlightCancellation row
    → RouteLeg (PENDING) → CANCELLED
    → PlannerService.replan(affectedBatches, context, "ALNS")
        → AlnsEngine quick repair (no destruction)
        → persistRoutes(new assignments)
    → publishAlert → /topic/alerts
```

---

## 12. Database Migrations

| Version | Content |
|---|---|
| V1 | `airlines` + `airports` |
| V2 | `flights` + `baggage_batches` |
| V3 | `shipments` + `routes` + `route_legs` |
| V4 | `simulations` + `kpi_snapshots` + `flight_cancellations` + `shipment_status_history` |
| V5 | Seed data — airlines and airports |

Key constraints: `UNIQUE(iataCode)` on airports, `UNIQUE(baggage_batch_id)` on shipments, `UNIQUE(shipment_id)` on routes, FK cascades throughout.

---

## 13. Security & CORS

- **CSRF:** disabled (stateless REST + WebSocket).
- **Sessions:** stateless (`SessionCreationPolicy.STATELESS`).
- **Authorization:** all `/api/**`, `/ws/**`, and `/actuator/**` paths are `permitAll`.
- **CORS:** configured via `CorsConfig` bean; allowed origins come from `websocket.allowed-origins` property; all standard HTTP methods and headers allowed; `allowCredentials = true`.

---

## 14. Async & Scheduling

| Mechanism | Used for |
|---|---|
| `@Async` on `uploadBatchesAsync` | Parse large baggage files off the HTTP thread |
| `@Async` on `runInitialPlanning` | Run ALNS without blocking the start endpoint |
| `ScheduledExecutorService (10 threads)` | Per-simulation fixed-rate tick tasks |
| `TransactionSynchronization` | Delay async planning start until after the DB commit |
| `@EnableScheduling` | Activates Spring scheduler infrastructure |

Simulation tick tasks are stored in a `ConcurrentHashMap<Long, ScheduledFuture<?>>` so they can be cancelled on pause/stop.

---

## 15. Exception Handling

| Exception | HTTP Status | Trigger |
|---|---|---|
| `SimulationNotFoundException` | 404 | Simulation ID not found |
| `PlanningException` | 500 | ALNS or replan failure |
| `CapacityExceededException` | 400 | Assigning more bags than flight capacity |

All exceptions are caught by `GlobalExceptionHandler` (`@RestControllerAdvice`), which returns a uniform `ErrorResponse { message, timestamp }` JSON body.
