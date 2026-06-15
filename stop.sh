#!/bin/bash

set -e

echo "===================================="
echo " Deteniendo stack (Docker + MySQL)"
echo "===================================="

# 1. Detener Docker Compose
echo "[1/2] Deteniendo Docker en /opt/demo..."

cd /opt/demo

sudo docker compose down

echo "✔ Docker detenido"

echo "===================================="
echo " STACK DETENIDO"
echo "===================================="

sudo docker ps

echo ""
echo "✔ Listo"
