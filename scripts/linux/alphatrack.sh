#!/usr/bin/env bash
# AlphaTrack - Dev Server (Linux/CachyOS)

set -e

cd "$(dirname "$0")/../.."

# Farben
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

clear
echo
echo -e "${GREEN} =========================================="
echo -e "   AlphaTrack - Development Server"
echo -e " ==========================================${RESET}"
echo

if ! command -v npm &>/dev/null; then
    echo " FEHLER: npm nicht gefunden!"
    echo " Bitte Node.js installieren: https://nodejs.org"
    echo
    exit 1
fi

# Lokale IP ermitteln (erste nicht-loopback IPv4-Adresse)
IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1); exit}')

echo -e " Lokale URL:   ${CYAN}http://localhost:3000${RESET}"
if [ -n "$IP" ]; then
    echo -e " Netzwerk URL: ${CYAN}http://${IP}:3000${RESET}"
fi
echo
echo " Server laeuft... Strg+C zum Beenden."
echo " ------------------------------------------"
echo

npm run dev
