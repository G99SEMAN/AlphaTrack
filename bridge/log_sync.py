"""
Synchronisiert den lokalen Bridge-Log mit AlphaTrack beim Start.
Schiebt alle lokalen Einträge rüber wenn AlphaTrack keine Logs hat (z.B. nach Server-Neustart).
"""

import requests


def sync_to_alphatrack(config: dict, local_log, display=None) -> bool:
    """
    Prüft ob AlphaTrack Logs für diesen Bot hat.
    Falls nicht: pusht alle lokalen Einträge gebündelt.
    """
    bridge_id = config.get("bridge_id")
    if not bridge_id:
        return False

    base_url = config["alphatrack_url"]
    headers = {"x-bot-api-key": config.get("api_key", "")}

    try:
        resp = requests.get(
            f"{base_url}/api/bridge/logs/count",
            params={"bridgeId": bridge_id},
            headers=headers,
            timeout=5,
        )
        if not resp.ok:
            if display:
                display.log("warn", "LOG", f"Log-Count-Abfrage fehlgeschlagen: {resp.status_code}")
            return False

        count = resp.json().get("count", 0)
        if count > 0:
            return True  # AlphaTrack hat bereits Logs

        entries = local_log.get_all()
        if not entries:
            return True

        if display:
            display.log("info", "LOG", f"AlphaTrack-Log leer - übertrage {len(entries)} lokale Einträge ...")

        resp = requests.post(
            f"{base_url}/api/bridge/logs/bulk",
            json={"bridgeId": bridge_id, "entries": entries},
            headers={"Content-Type": "application/json", **headers},
            timeout=15,
        )
        if resp.ok:
            if display:
                display.log("ok", "LOG", f"{len(entries)} Einträge erfolgreich übertragen")
            return True

        if display:
            display.log("warn", "LOG", f"Bulk-Log-Upload fehlgeschlagen: {resp.status_code}")
        return False

    except requests.RequestException as e:
        if display:
            display.log("warn", "LOG", f"Log-Sync fehlgeschlagen: {e}")
        return False
