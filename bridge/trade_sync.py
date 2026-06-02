import requests
import time
from mt5_connector import MT5Connector


def sync_trades(config: dict, mt5: MT5Connector, last_sync_ts: float, display=None, local_log=None) -> tuple[bool, float]:
    """
    Synchronisiert offene Positionen + abgeschlossene Trades seit last_sync_ts.
    Gibt (success, new_last_sync_ts) zurück.
    """
    url = f"{config['alphatrack_url']}/api/bridge/trades"
    headers = {"x-bot-api-key": config["api_key"]}

    open_trades = mt5.get_open_positions()
    closed_trades = mt5.get_closed_deals(from_timestamp=last_sync_ts)

    all_trades = open_trades + closed_trades
    if not all_trades:
        return True, last_sync_ts

    # Geschlossene Trades für Log vormerken
    closed_count = len(closed_trades)

    payload = {
        "bridgeId": config["bridge_id"],
        "profileId": config["profile_id"],
        "trades": all_trades,
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            synced = data.get("synced", 0)
            if synced > 0 and display:
                display.log("ok", "SYNC", f"{synced} neue Trade(s) an AlphaTrack uebertragen")

            # Geschlossene Trades einzeln ins Log schreiben
            if closed_count > 0 and local_log:
                for t in closed_trades:
                    ticket = t.get("ticket") or t.get("externalId", "?")
                    symbol = t.get("instrument") or t.get("symbol", "?")
                    pnl = t.get("pnl")
                    pnl_str = f" | PnL: {pnl:+.2f}" if pnl is not None else ""
                    msg = f"CLOSED Trade: {symbol} | Ticket #{ticket}{pnl_str}"
                    local_log.add("info", msg)
                    if display:
                        display.log("ok", "SYNC", msg)

            return True, time.time()
        else:
            if display:
                display.log("warn", "SYNC", f"Fehler {resp.status_code}: {resp.text[:80]}")
            return False, last_sync_ts
    except requests.RequestException as e:
        if display:
            display.log("warn", "SYNC", f"Netzwerkfehler: {e}")
        if local_log:
            local_log.add("warn", f"SYNC Netzwerkfehler: {e}")
        return False, last_sync_ts
