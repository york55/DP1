# 🚀 Guía de Despliegue - Sistema Tasf.B2B

Este repositorio contiene la solución final del proyecto **Tasf.B2B**, un sistema de optimización logística para el enrutamiento de equipajes extraviados utilizando los algoritmos **ALNS** (Adaptive Large Neighborhood Search) y **ACO** (Ant Colony Optimization).

El proyecto se divide en tres componentes principales:
1. **Backend (Java/Spring Boot)**: Motor de cálculo y APIs.
2. **Frontend (React/Vite)**: Interfaz gráfica y mapa de simulación.
3. **Scripts de Simulación (Node/Bash)**: Automatización de experimentos masivos.

---

## 📋 Pre-requisitos

Antes de comenzar, asegúrate de tener instalado en tu entorno (recomendado probar en ambiente similar a laboratorio LE-068):
- **Java 21 LTS** (JDK 21)
- **Maven 3.9+**
- **Node.js 18+** y **npm**

---

## ⚙️ 1. Levantar el Backend (Spring Boot)

El backend es el núcleo de optimización y expone los endpoints REST para ser consumidos tanto por el frontend como por los scripts.

1. Abre una terminal y sitúate en el directorio del backend (asumiendo que se llama `tasf-b2b-backend` o estás en la raíz del proyecto backend):
   ```bash
   cd tasf-b2b-backend
   ```
2. Compila y empaqueta el proyecto asegurando que pasen las pruebas unitarias:
   ```bash
   mvn clean package
   ```
3. Inicia el servidor Spring Boot:
   ```bash
   mvn spring-boot:run
   ```
   *El servidor se iniciará en `http://localhost:8080`.*

---

## 🖥️ 2. Levantar el Frontend (React + Vite)

El frontend proporciona una interfaz gráfica para cargar los archivos CSV, elegir el algoritmo y visualizar las rutas calculadas en un mapa global.

1. En una **nueva terminal**, navega a la carpeta del frontend:
   ```bash
   cd tasf-b2b-frontend
   ```
2. Instala las dependencias del proyecto:
   ```bash
   npm install
   ```
3. Levanta el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   *La aplicación estará disponible típicamente en `http://localhost:5173`. Asegúrate de que el backend ya esté corriendo para que la comunicación API funcione correctamente.*

---

## 🧪 3. Ejecución de la Solución Conjunta y Experimentos (Scripts)

Para pruebas automatizadas, simulaciones masivas y validación de las hipótesis (comparativa ALNS vs ACO), utilizamos scripts que interactúan directamente con los endpoints del backend (por ejemplo `POST /api/planner/execute` o sus variantes asíncronas).

### Uso del script principal (Ejemplo)

Si tienes un script Bash o en Node (`run_experiment.js`, `extract_day1.cjs`, etc.) en una carpeta como `scripts/` o `experimentos/`:

1. Abre una terminal en la carpeta correspondiente:
   ```bash
   cd scripts
   ```
2. (Opcional) Si es un script de Node.js con dependencias propias, instálalas:
   ```bash
   npm install
   ```
3. Ejecuta la simulación por lotes:
   ```bash
   node run_experiment.js
   ```
   *(O si tienes un script en bash `.sh`)*
   ```bash
   ./correr_pruebas.sh
   ```

Este proceso subirá automáticamente los `aeropuertos.csv`, `vuelos.csv`, `envios.csv` y `parametros_simulacion.csv` al backend, esperará los resultados y generará los JSON u hojas de cálculo exportadas para el diseño experimental.

---

## 💡 Notas adicionales
- Asegúrate de que los puertos **8080** y **5173** estén libres.
- Todo el estado de la simulación se maneja **en memoria** según lo especificado. Si necesitas limpiar la simulación anterior, simplemente refresca el Frontend o reinicia la carga de CSVs.