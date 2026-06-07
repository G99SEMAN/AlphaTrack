#!/bin/bash
# Wird auf dem Synology NAS ausgefuehrt - zieht Updates und rebuildet den Container

set -e

DOCKER=/usr/local/bin/docker
PROJECT_DIR="/volume1/docker/alphatrack"

echo ""
echo "  =========================================="
echo "   AlphaTrack - NAS Update"
echo "  =========================================="
echo ""

cd "$PROJECT_DIR"

echo "  [1/5] Container stoppen..."
sudo $DOCKER compose down 2>/dev/null || true

echo ""
echo "  [2/5] Daten sichern..."
BACKUP_DIR=/tmp/alphatrack-backup
rm -rf "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
if [ -d "$PROJECT_DIR/data" ]; then
  cp -r "$PROJECT_DIR/data" "$BACKUP_DIR/"
  echo "        Gesichert: $(find "$BACKUP_DIR/data" -type f | wc -l) Dateien"
fi

echo ""
echo "  [3/5] Code von GitHub holen..."
git fetch origin
git reset --hard origin/main

echo ""
echo "  [4/5] Daten wiederherstellen..."
mkdir -p "$PROJECT_DIR/data" "$PROJECT_DIR/data/screenshots"

if [ -d "$BACKUP_DIR/data" ]; then
  # JSON-Datendateien
  cp "$BACKUP_DIR/data/"*.json "$PROJECT_DIR/data/" 2>/dev/null || true
  # Screenshots
  if [ -d "$BACKUP_DIR/data/screenshots" ] && [ "$(ls -A "$BACKUP_DIR/data/screenshots" 2>/dev/null)" ]; then
    cp -n "$BACKUP_DIR/data/screenshots/"* "$PROJECT_DIR/data/screenshots/" 2>/dev/null || true
    echo "        Screenshots wiederhergestellt: $(ls "$PROJECT_DIR/data/screenshots" | wc -l)"
  fi
fi

echo ""
echo "  [5/5] Docker Image bauen und Container starten..."
sudo $DOCKER compose build --no-cache
sudo $DOCKER compose up -d

echo ""
echo "  Fertig! AlphaTrack laeuft auf Port 3002."
echo "  =========================================="
echo ""
