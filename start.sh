#!/bin/bash

set -e

echo "===================================="
echo " Iniciando stack completo (MySQL + Nginx + Docker)"
echo "===================================="

# 1. Obtener de Git con Pull

# 2. Reiniciar Nginx del sistema
echo "[2/3] Reiniciando Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "✔ Nginx reiniciado"

# 3. Levantar Docker Compose
echo "[3/3] Levantando Docker en /opt/demo..."

cd /opt/demo

sudo docker compose down
sudo docker compose up -d --build

echo "✔ Docker levantado"

# 4. Estado final
echo "===================================="
echo " ESTADO FINAL"
echo "===================================="

sudo systemctl status nginx --no-pager | head -n 10

echo ""
sudo docker ps

echo ""
echo "✔ Stack listo"
