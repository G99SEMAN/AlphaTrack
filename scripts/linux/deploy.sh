#!/usr/bin/env bash
# AlphaTrack - Deploy zu NAS (Linux/CachyOS)

# ==========================================
#  Konfiguration - bitte anpassen
# ==========================================
NAS_USER="deinuser"
NAS_HOST="192.168.1.100"
NAS_PORT="88"
NAS_PROJECT_DIR="/volume1/docker/alphatrack"
# ==========================================

set -e

cd "$(dirname "$0")"

# Farben
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
RESET='\033[0m'

clear
echo
echo -e "${CYAN} =========================================="
echo -e "   AlphaTrack - Deploy zu Synology NAS"
echo -e " ==========================================${RESET}"
echo

echo " Update auf NAS ausfuehren..."
echo " Verbinde mit ${NAS_USER}@${NAS_HOST}..."
echo " (Erwartet, dass der aktuelle Stand bereits per 'git push' auf GitHub liegt.)"
echo

if ! ssh -p "$NAS_PORT" "${NAS_USER}@${NAS_HOST}" "bash ${NAS_PROJECT_DIR}/scripts/nas-update.sh"; then
    echo
    echo -e "${RED} FEHLER: Update auf NAS fehlgeschlagen.${RESET}"
    exit 1
fi

echo
echo -e "${GREEN} Deploy abgeschlossen!"
echo " AlphaTrack ist jetzt auf dem NAS aktualisiert."
echo -e " ==========================================${RESET}"
echo
