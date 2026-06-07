import requests
import time


def send_heartbeat(config: dict, state: dict, display=None) -> tuple[bool, bool]:
    """Sendet einen Heartbeat an AlphaTrack. Gibt (success, needs_reregister) zurück.

    Misst die Round-Trip-Latenz zum AlphaTrack-Server und speichert sie in
    config['bridge_latency_ms'] (in-memory; nicht auf Disk geschrieben).
    """
    url = f"{config['alphatrack_url']}/api/bridge/heartbeat"
    status_payload: dict = {
        "state": state["state"],
        "lastHeartbeat": "",
        "bridgeVersion": config.get("bridge_version", "1.0.0"),
        "bridgeType": config.get("bridge_type", "bridge"),
        "bridgeIp": config.get("bridge_ip", ""),
        "bridgePort": config.get("bridge_port", config.get("command_server_port", 8765)),
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
        t0 = time.time()
        resp = requests.post(url, json=payload, headers={"x-bot-api-key": config["api_key"]}, timeout=5)
        latency_ms = round((time.time() - t0) * 1000, 1)
        # Update in-memory latency field (not persisted to disk)
        config["bridge_latency_ms"] = latency_ms
        if resp.status_code == 404:
            if display:
                display.log("warn", "HB", "Bridge nicht in AlphaTrack gefunden - starte Neu-Registrierung...")
            return False, True
        return resp.status_code == 200, False
    except requests.RequestException as e:
        config["bridge_latency_ms"] = None
        if display:
            display.log("warn", "HB", f"Heartbeat fehlgeschlagen: {e}")
        return False, False
