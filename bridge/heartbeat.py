import requests
import time


def send_heartbeat(config: dict, state: dict, display=None) -> tuple[bool, bool]:
    """Sendet einen Heartbeat. Gibt (success, needs_reregister) zurück."""
    url = f"{config['alphatrack_url']}/api/bridge/heartbeat"
    status_payload: dict = {
        "state": state["state"],
        "lastHeartbeat": "",
        "bridgeVersion": config["bridge_version"],
        "mt5Connected": state["mt5_connected"],
        "activeSymbols": state["active_symbols"],
        "openPositions": state["open_positions"],
        "tradesSync": state["trades_sync"],
        "uptime": int(time.time() - state["start_time"]),
    }
    if state.get("balance") is not None:
        status_payload["balance"] = state["balance"]
    if state.get("currency"):
        status_payload["currency"] = state["currency"]

    payload = {"bridgeId": config["bridge_id"], "status": status_payload}
    try:
        resp = requests.post(url, json=payload, headers={"x-bot-api-key": config["api_key"]}, timeout=5)
        if resp.status_code == 404:
            if display:
                display.log("warn", "HB", "Bridge nicht in AlphaTrack gefunden - starte Neu-Registrierung...")
            return False, True
        return resp.status_code == 200, False
    except requests.RequestException as e:
        if display:
            display.log("warn", "HB", f"Heartbeat fehlgeschlagen: {e}")
        return False, False
