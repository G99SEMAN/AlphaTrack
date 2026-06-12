"""
AlphaTrack Bridge - Hauptprogramm
Laeuft auf dem Mini PC, verbindet sich mit MetaTrader 5 und sendet
Daten an die AlphaTrack Webapp im Heimnetz.
"""

import json
import os
import queue
import signal
import socket
import subprocess
import sys
import time

import requests

from gateway import get_command_queue, set_trade_result, update_positions_cache, set_candles_fetcher, set_history_fetcher, set_account_fetcher, set_calendar_fetcher, set_log_callback, set_display_callback, start_server, config_lock, configure, get_connected_bots_info, get_at_bot_id_for_ticket
from heartbeat import send_heartbeat
from mt5_connector import MT5Connector
from trade_executor import execute_trade, close_position
from trade_sync import sync_trades
from display import BridgeDisplay
from local_log import LocalLog
from log_sync import sync_to_alphatrack
from auto_discover import discover, fetch_setup_info, discover_via_udp


CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")


def load_config() -> dict:
    if not os.path.exists(CONFIG_FILE):
        print("[FEHLER] config.json nicht gefunden!")
        print(f"         Erwartet unter: {CONFIG_FILE}")
        print("         Bitte zuerst setup.py ausfuehren.")
        input("Enter zum Beenden...")
        sys.exit(1)
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_config(config: dict):
    with config_lock:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def _register_bridge(config: dict, display, log_tag: str = "SETUP") -> bool:
    """Sendet das Registrierungs-POST, setzt bridge_id und speichert die Konfiguration.

    Gibt True bei Erfolg zurück, False bei Fehler (kein sys.exit – Aufrufer entscheidet).
    """
    local_ip = get_local_ip()
    bot_url = f"http://{local_ip}:{config['command_server_port']}"
    try:
        resp = requests.post(
            f"{config['alphatrack_url']}/api/bots",
            json={
                "name": config.get("bridge_name", "Bridge"),
                "profileId": config["profile_id"],
                "url": bot_url,
                "type": "bridge",
            },
            timeout=10,
        )
        if resp.status_code == 201:
            bridge_id = resp.json()["bot"]["id"]
            config["bridge_id"] = bridge_id
            save_config(config)
            display.log("ok", log_tag, f"Registriert! Bridge-ID: {bridge_id}")
            return True
        display.log("error", log_tag, f"Registrierung fehlgeschlagen: {resp.status_code}")
        return False
    except requests.RequestException as e:
        display.log("error", log_tag, f"AlphaTrack nicht erreichbar: {e}")
        return False


def auto_register(config: dict, display) -> dict:
    """Registriert die Bridge bei AlphaTrack falls noch keine bridge_id vorhanden."""
    if config.get("bridge_id"):
        return config

    local_ip = get_local_ip()
    bot_url = f"http://{local_ip}:{config['command_server_port']}"
    display.log("info", "SETUP", f"Bridge-ID fehlt - registriere bei AlphaTrack ({bot_url}) ...")

    if not _register_bridge(config, display, log_tag="SETUP"):
        sys.exit(1)

    return config


def attempt_mt5_restart(config: dict, mt5: MT5Connector, display: BridgeDisplay) -> bool:
    """
    Versucht MT5 neu zu starten und die Verbindung wiederherzustellen.
    Gibt True zurück wenn erfolgreich, False nach allen Fehlversuchen.
    """
    exe_path = config.get("mt5_exe_path", "")
    wait_sec = config.get("mt5_restart_wait_sec", 10)
    max_attempts = config.get("mt5_restart_max_attempts", 3)
    startup_wait = config.get("mt5_startup_wait_sec", 15)

    for attempt in range(1, max_attempts + 1):
        display.log("warn", "MT5", f"Neustart-Versuch {attempt}/{max_attempts} in {wait_sec}s ...")
        time.sleep(wait_sec)

        # Laufenden MT5-Prozess beenden
        try:
            subprocess.run(
                ["taskkill", "/F", "/IM", "terminal64.exe"],
                capture_output=True, timeout=5,
            )
            time.sleep(2)
        except Exception:
            pass

        # MT5 neu starten
        if exe_path and os.path.exists(exe_path):
            try:
                subprocess.Popen([exe_path], close_fds=True)
                display.log("info", "MT5", f"MetaTrader gestartet - warte {startup_wait}s auf Initialisierung ...")
                time.sleep(startup_wait)
            except Exception as e:
                display.log("error", "MT5", f"Konnte MT5 nicht starten: {e}")
        else:
            display.log("warn", "MT5", f"mt5_exe_path nicht gefunden ({exe_path}) - versuche Reconnect ohne Neustart")
            time.sleep(3)

        # Verbindung neu aufbauen
        mt5.disconnect()
        if mt5.connect():
            display.log("ok", "MT5", f"Verbindung nach Versuch {attempt} wiederhergestellt")
            return True

        display.log("error", "MT5", f"Versuch {attempt}/{max_attempts} fehlgeschlagen")

    return False


def ping_alphatrack(url: str) -> int | None:
    """Misst die Antwortzeit von AlphaTrack in ms. None bei Fehler."""
    try:
        t0 = time.time()
        requests.get(f"{url}/api/bots", timeout=3)
        return int((time.time() - t0) * 1000)
    except Exception:
        return None


_restart_requested = False
_emergency_shutdown = False


def main():
    global _restart_requested
    config = load_config()

    # Pflichtfelder prüfen (vor Display-Start, damit Fehler sichtbar sind)
    if config.get("profile_id") == "HIER_PROFIL_ID_EINTRAGEN":
        print("[FEHLER] profile_id in config.json noch nicht gesetzt!")
        sys.exit(1)
    if config.get("mt5_password") == "DEIN_PASSWORT":
        print("[FEHLER] mt5_password in config.json noch nicht gesetzt!")
        sys.exit(1)

    display = BridgeDisplay(bridge_name=config.get("bridge_name", "AlphaTrack Bridge"))
    display.log("info", "BRIDGE", f"Starte {config.get('bridge_name', 'AlphaTrack Bridge')} ...")

    # ── Auto-Discovery: AlphaTrack im Netzwerk finden ────────────────
    if not config.get("alphatrack_url"):
        display.log("info", "DISC", "Keine AlphaTrack-URL konfiguriert — starte Auto-Discovery ...")
        found = discover(last_known_url=None, display=display)
        if not found:
            display.log("error", "DISC", "AlphaTrack nicht gefunden! Bitte setup.bat ausfuehren.")
            sys.exit(1)
        info = fetch_setup_info(found)
        if info:
            config["alphatrack_url"] = found
            config["api_key"] = info.get("apiKey", config.get("api_key", ""))
            if not config.get("profile_id") and info.get("profiles"):
                config["profile_id"] = info["profiles"][0]["id"]
                display.log("info", "DISC", f"Profil automatisch gesetzt: {info['profiles'][0]['name']}")
            save_config(config)
            display.log("ok", "DISC", f"AlphaTrack verbunden: {found}")
        else:
            display.log("error", "DISC", "Setup-Info konnte nicht geladen werden.")
            sys.exit(1)
    else:
        # Prüfen ob bekannte URL noch erreichbar, sonst neu suchen
        try:
            resp = requests.get(f"{config['alphatrack_url']}/api/bridge/info", timeout=4)
            if not resp.ok:
                raise ConnectionError
        except Exception:
            display.log("warn", "DISC", "AlphaTrack nicht erreichbar — suche neu im Netzwerk ...")
            found = discover(last_known_url=config.get("alphatrack_url"), display=display)
            if found and found != config.get("alphatrack_url"):
                info = fetch_setup_info(found)
                if info:
                    config["alphatrack_url"] = found
                    config["api_key"] = info.get("apiKey", config.get("api_key", ""))
                    save_config(config)
                    display.log("ok", "DISC", f"Neue AlphaTrack-URL gespeichert: {found}")

    # Populate bridge identity fields at startup
    local_ip = get_local_ip()
    config["bridge_ip"] = local_ip
    if not config.get("bridge_type"):
        config["bridge_type"] = "bridge"

    # Auto-Registrierung bei AlphaTrack
    config = auto_register(config, display)

    # Set bridge identity in terminal display after registration (so bridge_id is available)
    display.set_identity(
        bridge_id=config.get("bridge_id", ""),
        bridge_ip=local_ip,
        bridge_port=config.get("command_server_port", 8765),
    )

    # Lokales Log initialisieren, Live-Push konfigurieren, mit AlphaTrack synchronisieren
    local_log = LocalLog(bridge_id=config["bridge_id"], bridge_name=config.get("bridge_name", "Bridge"))
    local_log.configure_push(config["alphatrack_url"], config.get("api_key", ""))
    set_log_callback(local_log.add)
    set_display_callback(display.log)
    local_log.add("info", "Bridge gestartet", f"AlphaTrack: {config['alphatrack_url']}")
    sync_to_alphatrack(config, local_log, display)

    # MT5 verbinden
    display.log("info", "MT5", "Verbinde mit MetaTrader 5 ...")
    mt5 = MT5Connector(
        login=config["mt5_login"],
        password=config["mt5_password"],
        server=config["mt5_server"],
    )

    if not mt5.connect():
        display.log("error", "MT5", "Verbindung fehlgeschlagen - Abbruch")
        sys.exit(1)

    display.log("ok", "MT5", "Verbunden")

    # Fetcher injizieren (nach MT5-Init)
    configure(config["alphatrack_url"], config["profile_id"], config.get("api_key", ""), get_local_ip())
    set_candles_fetcher(mt5.copy_rates)
    set_history_fetcher(mt5.get_closed_deals)
    set_account_fetcher(mt5.get_account_info)
    set_calendar_fetcher(mt5.get_calendar)

    # FastAPI Gateway starten
    start_server(config["command_server_port"])
    display.log("ok", "CMD", f"Gateway gestartet auf Port {config['command_server_port']}")

    # Shared State
    state = {
        "state": "running",
        "mt5_connected": True,
        "active_symbols": [],
        "open_positions": 0,
        "trades_sync": 0,
        "start_time": time.time(),
        "balance": None,
        "currency": None,
    }

    cmd_queue: queue.Queue = get_command_queue()
    running = True
    last_heartbeat = 0.0
    last_sync = 0.0
    last_ping = 0.0
    at_ping_ms: int | None = None
    at_ok = False

    def shutdown(sig, frame):
        nonlocal running
        display.log("info", "BRIDGE", "Shutdown ...")
        running = False

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    display.log("ok", "BRIDGE", f"Laeuft | AlphaTrack: {config['alphatrack_url']}")
    display.log("info", "BRIDGE", f"Heartbeat {config['heartbeat_interval_sec']}s | Sync {config['trade_sync_interval_sec']}s | Strg+C zum Beenden")
    display.start()

    while running:
        now = time.time()

        # MT5-Verbindung prüfen
        mt5_ok = mt5.is_connected()
        if mt5_ok != state["mt5_connected"]:
            state["mt5_connected"] = mt5_ok
            if not mt5_ok:
                display.log("error", "MT5", "Verbindung verloren - starte Neustart-Sequenz ...")
                local_log.add("error", "MT5-Verbindung verloren", "Neustart-Sequenz gestartet")
                state["state"] = "error"
                # MT5 getrennt — Positionsliste leer, positions=0 pro Bot
                bots_info = get_connected_bots_info()
                for bot in bots_info:
                    bot["positions"] = 0
                display.update_status(
                    mt5_ok=False, at_ok=at_ok, at_ping_ms=at_ping_ms,
                    balance=state.get("balance"), currency=state.get("currency") or "USD",
                    open_positions=0, bridge_state="error",
                )
                display.update_bots(bots_info)
                recovered = attempt_mt5_restart(config, mt5, display)
                if recovered:
                    state["mt5_connected"] = True
                    state["state"] = "running"
                    set_candles_fetcher(mt5.copy_rates)
                    set_history_fetcher(mt5.get_closed_deals)
                    set_account_fetcher(mt5.get_account_info)
                else:
                    display.log("error", "MT5", "*** CRITICAL ERROR *** MT5 konnte nicht neu gestartet werden!")
                    display.log("error", "MT5", "Alle Neustart-Versuche fehlgeschlagen - Bridge wird gestoppt.")
                    local_log.add("error", "MT5-Neustart fehlgeschlagen", "Alle Versuche erschöpft - Bridge wird gestoppt")
                    state["state"] = "error"
                    global _emergency_shutdown
                    _emergency_shutdown = True
                    running = False
            else:
                display.log("ok", "MT5", "Verbindung wiederhergestellt")
                local_log.add("info", "MT5-Verbindung wiederhergestellt")
                if state["state"] == "error":
                    state["state"] = "running"

        if mt5_ok:
            state["active_symbols"] = mt5.get_active_symbols()
            state["open_positions"] = mt5.get_open_positions_count()
            update_positions_cache(mt5.get_open_positions())
            account = mt5.get_account_info()
            if account:
                state["balance"] = account["balance"]
                state["currency"] = account["currency"]

        # Commands verarbeiten
        while not cmd_queue.empty():
            cmd = cmd_queue.get_nowait()
            command = cmd["command"]
            if command == "stop":
                state["state"] = "stopped"
                display.log("warn", "CMD", "Bridge gestoppt via Command")
                local_log.add("warn", "Bridge gestoppt via Command")
            elif command == "pause":
                state["state"] = "paused"
                display.log("warn", "CMD", "Bridge pausiert via Command")
                local_log.add("warn", "Bridge pausiert via Command")
            elif command in ("start", "resume"):
                state["state"] = "running"
                display.log("ok", "CMD", "Bridge gestartet/fortgesetzt via Command")
                local_log.add("info", "Bridge gestartet/fortgesetzt via Command")
            elif command == "restart":
                display.log("warn", "CMD", "Bridge-Neustart angefordert - beende Bridge ...")
                local_log.add("warn", "Bridge-Neustart angefordert")
                _restart_requested = True
                running = False
            elif command == "close_position":
                payload = cmd.get("payload", {})
                cmd_id = cmd.get("id", "")
                ticket = payload.get("ticket", 0)
                if mt5_ok:
                    result = close_position(ticket=int(ticket))
                    if result.get("success"):
                        msg = f"Position geschlossen: Ticket #{ticket}"
                        display.log("ok", "CMD", msg)
                        local_log.add("info", msg)
                    else:
                        err = result.get("error", "?")
                        msg = f"Position #{ticket} schliessen fehlgeschlagen"
                        display.log("error", "CMD", f"{msg}: {err}")
                        local_log.add("error", msg, err)
                else:
                    result = {"success": False, "error": "MT5 nicht verbunden"}
                    display.log("error", "CMD", "close_position: MT5 nicht verbunden")
                    local_log.add("error", "close_position fehlgeschlagen", "MT5 nicht verbunden")
                set_trade_result(cmd_id, result)
            elif command == "execute_trade":
                payload = cmd.get("payload", {})
                cmd_id = cmd.get("id", "")
                sym = payload.get("symbol", "?")
                direction = payload.get("direction", "?").upper()
                lots = payload.get("lots", "?")
                if mt5_ok:
                    result = execute_trade(
                        symbol=payload.get("symbol", ""),
                        direction=payload.get("direction", "buy"),
                        lots=float(payload.get("lots", 0.01)),
                        sl=float(payload.get("sl", 0) or 0),
                        tp=float(payload.get("tp", 0) or 0),
                        sl_pips=float(payload.get("slPips", 0) or 0),
                        tp_pips=float(payload.get("tpPips", 0) or 0),
                    )
                    if result.get("success"):
                        ticket = result.get("ticket", "?")
                        price = result.get("price", "?")
                        msg = f"Trade ausgeführt: {direction} {lots} {sym} @ {price} | Ticket #{ticket}"
                        display.log("ok", "CMD", msg)
                        local_log.add("info", msg)
                        if result.get("sltp_warning"):
                            display.log("warn", "CMD", f"SL/TP-Warnung Ticket #{ticket}: {result['sltp_warning']}")
                            local_log.add("warn", f"SL/TP-Warnung Ticket #{ticket}", result["sltp_warning"])
                    else:
                        err = result.get("error", "?")
                        msg = f"Trade fehlgeschlagen: {direction} {lots} {sym}"
                        display.log("error", "CMD", f"{msg}: {err}")
                        local_log.add("error", msg, err)
                else:
                    result = {"success": False, "error": "MT5 nicht verbunden"}
                    display.log("error", "CMD", "execute_trade: MT5 nicht verbunden")
                    local_log.add("error", f"Trade fehlgeschlagen: {direction} {lots} {sym}", "MT5 nicht verbunden")
                set_trade_result(cmd_id, result)

        # AlphaTrack-Ping (alle 15s) + Verbindungsstatus-Logging
        if now - last_ping >= 15:
            new_ping = ping_alphatrack(config["alphatrack_url"])
            new_at_ok = new_ping is not None
            if new_at_ok != at_ok:
                if new_at_ok:
                    local_log.add("info", "AlphaTrack-Verbindung wiederhergestellt")
                else:
                    local_log.add("warn", "AlphaTrack nicht erreichbar", config["alphatrack_url"])
            at_ping_ms = new_ping
            at_ok = new_at_ok
            last_ping = now

        # Heartbeat
        if now - last_heartbeat >= config["heartbeat_interval_sec"]:
            ok, needs_reregister = send_heartbeat(config, state, display)
            at_ok = ok
            last_heartbeat = now
            if needs_reregister:
                config["bridge_id"] = ""
                save_config(config)
                display.log("info", "HB", "Neu-Registrierung wird durchgeführt ...")
                if _register_bridge(config, display, log_tag="HB"):
                    local_log.add("info", f"Bridge neu registriert: {config['bridge_id']}")

        # Trade-Sync (nur wenn running)
        if state["state"] == "running" and now - last_sync >= config["trade_sync_interval_sec"]:
            if mt5_ok:
                ok, last_sync = sync_trades(config, mt5, last_sync, display, local_log)
                if ok:
                    state["trades_sync"] += state["open_positions"]
            else:
                last_sync = now

        # Display-Status aktualisieren inkl. Bots-Panel mit Positionszuordnung
        bots_info = get_connected_bots_info()
        open_pos = mt5.get_open_positions()
        for bot in bots_info:
            if bot.get("at_id"):
                # Positionen zaehlen, deren AT-ID mit der Bot-AT-ID uebereinstimmt
                bot["positions"] = sum(
                    1 for p in open_pos
                    if get_at_bot_id_for_ticket(p["ticket"]) == bot["at_id"]
                )
            else:
                # at_id noch nicht bekannt (AlphaTrack-Registrierung ausstehend)
                bot["positions"] = 0
        display.update_status(
            mt5_ok=state["mt5_connected"],
            at_ok=at_ok,
            at_ping_ms=at_ping_ms,
            balance=state.get("balance"),
            currency=state.get("currency") or "USD",
            open_positions=state["open_positions"],
            bridge_state=state["state"],
        )
        display.update_bots(bots_info)

        time.sleep(1)

    # Beenden — bei Notabschaltung (MT5-Fehler) Error-State an AlphaTrack senden
    if _emergency_shutdown:
        local_log.add("error", "KRITISCH: Bridge-Notabschaltung", "MT5-Verbindung konnte nicht wiederhergestellt werden")
        state["state"] = "error"
    else:
        local_log.add("info", "Bridge beendet")
        state["state"] = "stopped"
    send_heartbeat(config, state, display)
    mt5.disconnect()
    display.stop()
    display.log("info", "BRIDGE", "Beendet")


if __name__ == "__main__":
    main()
    # Exit code 75: wrapper scripts (.bat/service) detect this to restart the bridge.
    # Any other code (including emergency shutdown) means do NOT auto-restart.
    sys.exit(75 if _restart_requested else 0)
