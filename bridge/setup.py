"""
AlphaTrack Bridge Setup — minimale Konfiguration.
Nur MT5-Zugangsdaten nötig. Alles andere wird automatisch ermittelt.
"""

import json
import os
import secrets
import sys

try:
    import requests
except ImportError:
    print("[FEHLER] 'requests' nicht installiert. Bitte 'pip install requests' ausfuehren.")
    input("Enter zum Beenden...")
    sys.exit(1)

from auto_discover import discover, fetch_setup_info

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
SEP = "-" * 55

DEFAULTS = {
    "alphatrack_url":         "",
    "api_key":                "",
    "bridge_id":              "",
    "bridge_name":            "",
    "bridge_version":         "1.0.0",
    "profile_id":             "",
    "heartbeat_interval_sec": 5,
    "trade_sync_interval_sec": 30,
    "command_server_port":    8765,
    "mt5_login":              0,
    "mt5_password":           "",
    "mt5_server":             "",
    "symbols_to_watch":       ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY"],
    "mt5_exe_path":           "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
    "mt5_restart_wait_sec":   10,
    "mt5_restart_max_attempts": 3,
    "mt5_startup_wait_sec":   15,
}


def load_config() -> dict:
    if not os.path.exists(CONFIG_FILE):
        return dict(DEFAULTS)
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    # Fehlende Felder mit Defaults auffüllen
    for k, v in DEFAULTS.items():
        cfg.setdefault(k, v)
    return cfg


def save_config(cfg: dict):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


def ask(label: str, current, secret: bool = False) -> str:
    display = "****" if secret and current else str(current) if current else "(leer)"
    raw = input(f"  {label} [{display}]: ").strip()
    if not raw:
        return current
    if isinstance(current, int):
        try:
            return int(raw)
        except ValueError:
            return current
    return raw


def choose_profile(profiles: list, current_id: str) -> str:
    if not profiles:
        print("  Keine Profile von AlphaTrack empfangen.")
        return ask("Profil-ID (manuell eingeben)", current_id)

    # Prüfen ob current_id noch gültig ist
    valid_ids = {p["id"] for p in profiles}
    effective_current = current_id if current_id in valid_ids else ""

    if len(profiles) == 1:
        chosen = profiles[0]
        print(f"  -> Nur ein Profil verfuegbar — automatisch gewaehlt: {chosen['name']}")
        return chosen["id"]

    print()
    print("  Verfuegbare Profile:")
    for i, p in enumerate(profiles, 1):
        marker = " <- aktuell" if p["id"] == effective_current else ""
        print(f"    {i}) {p['name']} ({p.get('currency','?')}) - {p.get('broker','?')}{marker}")
    print()

    # Falls kein gültiges Profil gesetzt: Auswahl zwingend
    pflicht = not effective_current
    while True:
        hint = f"1-{len(profiles)}" if pflicht else f"1-{len(profiles)} / Enter = behalten"
        raw = input(f"  Profil waehlen [{hint}]: ").strip()
        if not raw and not pflicht:
            return effective_current
        if not raw and pflicht:
            print("  -> Bitte ein Profil waehlen.")
            continue
        try:
            idx = int(raw) - 1
            if 0 <= idx < len(profiles):
                chosen = profiles[idx]
                print(f"  -> Gewaehlt: {chosen['name']} (ID: {chosen['id']})")
                return chosen["id"]
        except ValueError:
            pass
        print(f"  -> Bitte Zahl zwischen 1 und {len(profiles)} eingeben.")


def main():
    os.system("cls" if os.name == "nt" else "clear")

    print(SEP)
    print("   AlphaTrack Bridge — Setup")
    print(SEP)
    print()
    print("  Nur MT5-Zugangsdaten werden benoetigt.")
    print("  AlphaTrack-URL und API-Key werden automatisch ermittelt.")
    print()

    cfg = load_config()

    # ── 1) MT5-Zugangsdaten ───────────────────────────────
    print(SEP)
    print("  [1] MetaTrader 5 — Zugangsdaten")
    print(SEP)
    cfg["mt5_login"]    = ask("Kontonummer (Login)", cfg.get("mt5_login", ""))
    cfg["mt5_password"] = ask("Passwort",           cfg.get("mt5_password", ""), secret=True)
    cfg["mt5_server"]   = ask("Server (z.B. BlackBullMarkets-Demo)", cfg.get("mt5_server", ""))
    print()

    # ── 2) Auto-Discovery ─────────────────────────────────
    print(SEP)
    print("  [2] AlphaTrack suchen ...")
    print(SEP)

    last = cfg.get("alphatrack_url") or None
    found_url = discover(last_known_url=last)

    if not found_url:
        print()
        print("  [!] AlphaTrack nicht automatisch gefunden.")
        print("      Stelle sicher dass AlphaTrack laeuft (npm start).")
        manual = input("  Manuelle URL eingeben (oder Enter zum Abbrechen): ").strip()
        if not manual:
            print("  Setup abgebrochen.")
            input("Enter zum Beenden...")
            return
        found_url = manual

    cfg["alphatrack_url"] = found_url
    print(f"  -> AlphaTrack gefunden: {found_url}")

    # ── 3) API-Key und Profile holen ──────────────────────
    info = fetch_setup_info(found_url)
    if info:
        cfg["api_key"] = info.get("apiKey", cfg.get("api_key", secrets.token_hex(32)))
        print(f"  -> API-Key automatisch uebernommen.")
        profiles = info.get("profiles", [])
    else:
        print("  [!] Konnte Setup-Info nicht laden. API-Key manuell eingeben.")
        cfg["api_key"] = ask("API-Key", cfg.get("api_key", ""), secret=True)
        profiles = []

    print()

    # ── 4) Profil ─────────────────────────────────────────
    print(SEP)
    print("  [3] Trading-Profil waehlen")
    print(SEP)
    cfg["profile_id"] = choose_profile(profiles, cfg.get("profile_id", ""))
    print()

    # ── 5) Bridge-Name (optional) ─────────────────────────
    import socket as _socket
    default_name = cfg.get("bridge_name") or _socket.gethostname()
    cfg["bridge_name"] = ask("Bridge-Name (optional, Enter = Hostname)", default_name)

    # ── Abschluss ─────────────────────────────────────────
    cfg["bridge_id"] = ""  # Neuregistrierung erzwingen
    save_config(cfg)

    print()
    print(SEP)
    print("  Konfiguration gespeichert!")
    print(f"  AlphaTrack: {cfg['alphatrack_url']}")
    print(f"  Profil:     {cfg.get('profile_id', '(nicht gesetzt)')}")
    print()
    print("  Naechster Schritt: start_bridge.bat ausfuehren")
    print(SEP)
    print()
    input("  Enter zum Beenden...")


if __name__ == "__main__":
    main()
