"""
AlphaTrack Bridge Setup
Interaktive Konfiguration der Bridge-Verbindung.
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

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

SEP = "-" * 55


DEFAULT_CONFIG = {
    "alphatrack_url": "http://192.168.178.30:3000",
    "api_key": secrets.token_hex(32),
    "bridge_id": "",
    "bridge_name": "AlphaTrack Bridge",
    "bridge_version": "1.0.0",
    "profile_id": "",
    "heartbeat_interval_sec": 5,
    "trade_sync_interval_sec": 30,
    "command_server_port": 8765,
    "mt5_login": 0,
    "mt5_password": "",
    "mt5_server": "",
    "symbols_to_watch": ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY"],
    "mt5_exe_path": "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
    "mt5_restart_wait_sec": 10,
    "mt5_restart_max_attempts": 3,
    "mt5_startup_wait_sec": 15,
}


def load_config() -> dict:
    if not os.path.exists(CONFIG_FILE):
        print("  [INFO] Keine config.json gefunden - starte mit Standardwerten.")
        return dict(DEFAULT_CONFIG)
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_config(config: dict):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def ask(label: str, current, secret: bool = False) -> str:
    """Fragt nach einem Wert - Enter behaelt den aktuellen."""
    display = "****" if secret and current else str(current) if current else "(leer)"
    raw = input(f"  {label} [{display}]: ").strip()
    if raw == "":
        return current
    # Typ-Konvertierung wenn noetig
    if isinstance(current, int):
        try:
            return int(raw)
        except ValueError:
            print(f"  -> Ungueltige Zahl, Wert unveraendert: {current}")
            return current
    return raw


def test_connection(url: str) -> list | None:
    """Testet die Verbindung zu AlphaTrack und gibt Profile zurueck oder None."""
    print(f"\n  -> Teste Verbindung zu {url} ...")
    try:
        resp = requests.get(f"{url}/api/profiles", timeout=8)
        if resp.status_code == 200:
            profiles = resp.json().get("profiles", [])
            print(f"  -> Verbunden! {len(profiles)} Profil(e) gefunden.")
            return profiles
        else:
            print(f"  -> Verbindung OK, aber unerwarteter Status: {resp.status_code}")
            return []
    except requests.exceptions.ConnectionError:
        print(f"  -> FEHLER: AlphaTrack nicht erreichbar unter {url}")
        print("     Stelle sicher, dass AlphaTrack laeuft und die IP korrekt ist.")
        return None
    except requests.exceptions.Timeout:
        print(f"  -> FEHLER: Verbindungs-Timeout nach 8 Sekunden.")
        return None
    except Exception as e:
        print(f"  -> FEHLER: {e}")
        return None


def choose_profile(profiles: list, current_id: str) -> str:
    """Zeigt Profile zur Auswahl an und gibt die gewaehle ID zurueck."""
    if not profiles:
        print("  -> Keine Profile verfuegbar - Profil-ID manuell eingeben.")
        return ask("Profil-ID", current_id)

    print()
    print("  Verfuegbare Profile:")
    for i, p in enumerate(profiles, 1):
        marker = " <- aktuell" if p["id"] == current_id else ""
        print(f"    {i}) {p['name']} ({p['type'].upper()}) - {p['broker']} [{p['currency']}] - ID: {p['id']}{marker}")

    print(f"    0) Manuell eingeben")
    print()

    while True:
        raw = input(f"  Profil waehlen [1-{len(profiles)} / 0 / Enter = behalten]: ").strip()
        if raw == "":
            return current_id
        if raw == "0":
            return ask("Profil-ID", current_id)
        try:
            idx = int(raw) - 1
            if 0 <= idx < len(profiles):
                chosen = profiles[idx]
                print(f"  -> Gewaehlt: {chosen['name']} (ID: {chosen['id']})")
                return chosen["id"]
        except ValueError:
            pass
        print(f"  -> Bitte eine Zahl zwischen 0 und {len(profiles)} eingeben.")


def main():
    os.system("cls" if os.name == "nt" else "clear")

    print(SEP)
    print("   AlphaTrack Bridge - Setup")
    print(SEP)
    print()

    config = load_config()
    print(f"  Konfigurationsdatei: {CONFIG_FILE}")
    print()
    print("  Enter druecken = Wert unveraendert uebernehmen.")
    print()

    # ── 1) AlphaTrack URL ──────────────────────────────────
    print(SEP)
    print("  [1] AlphaTrack URL")
    print(SEP)

    new_url = ask("URL (z.B. http://192.168.178.30:3000)", config.get("alphatrack_url", ""))

    profiles = []
    if new_url != config.get("alphatrack_url"):
        profiles = test_connection(new_url) or []

    config["alphatrack_url"] = new_url
    print()

    # ── 2) API-Key ────────────────────────────────────────
    print(SEP)
    print("  [2] API-Key")
    print(SEP)
    config["api_key"] = ask("API-Key", config.get("api_key", ""), secret=True)
    print()

    # ── 3) Profil ─────────────────────────────────────────
    print(SEP)
    print("  [3] Trading-Profil")
    print(SEP)
    config["profile_id"] = choose_profile(profiles, config.get("profile_id", ""))
    print()

    # ── 4) Bridge-Name ────────────────────────────────────
    print(SEP)
    print("  [4] Bridge-Name")
    print(SEP)
    config["bridge_name"] = ask("Name", config.get("bridge_name", "AlphaTrack Bridge"))
    print()

    # ── 5) MT5-Zugangsdaten ───────────────────────────────
    print(SEP)
    print("  [5] MetaTrader 5 - Zugangsdaten")
    print(SEP)
    config["mt5_login"]    = ask("Login (Kontonummer)", config.get("mt5_login", ""))
    config["mt5_password"] = ask("Passwort", config.get("mt5_password", ""), secret=True)
    config["mt5_server"]   = ask("Server (z.B. BlackBullMarkets-Demo)", config.get("mt5_server", ""))
    config["mt5_exe_path"] = ask(
        "MT5-Pfad (z.B. C:\\Program Files\\MetaTrader 5\\terminal64.exe)",
        config.get("mt5_exe_path", ""),
    )
    print()

    # ── 6) Ports & Intervalle ─────────────────────────────
    print(SEP)
    print("  [6] Ports & Intervalle")
    print(SEP)
    config["command_server_port"]     = ask("Command-Server Port", config.get("command_server_port", 8765))
    config["heartbeat_interval_sec"]  = ask("Heartbeat-Intervall (Sek)", config.get("heartbeat_interval_sec", 5))
    config["trade_sync_interval_sec"] = ask("Trade-Sync-Intervall (Sek)", config.get("trade_sync_interval_sec", 30))
    print()

    # ── Abschluss ─────────────────────────────────────────
    print(SEP)
    config["bridge_id"] = ""
    print("  -> Bot-ID geleert (automatische Neuregistrierung beim naechsten Start)")

    save_config(config)
    print("  -> Konfiguration gespeichert!")
    print()
    print("  Naechster Schritt: start_bridge.bat ausfuehren")
    print(SEP)
    print()
    input("  Enter zum Beenden...")


if __name__ == "__main__":
    main()
