import requests
import time
from mt5_connector import MT5Connector
from gateway import get_at_bot_id_for_ticket

# Mindest-Lookback für abgeschlossene Trades: Trades die kürzer als dieses
# Fenster her geschlossen wurden werden immer erneut geprüft — verhindert, dass
# Trades, die knapp vor einem Sync-Intervall geschlossen wurden, dauerhaft als
# 'open' hängenbleiben.
_MIN_LOOKBACK_SEC = 7200  # 2 Stunden
_sync_diag_logged = False


def sync_trades(config: dict, mt5: MT5Connector, last_sync_ts: float, display=None, local_log=None) -> tuple[bool, float]:
    """
    Synchronisiert offene Positionen + abgeschlossene Trades seit last_sync_ts.
    Gibt (success, new_last_sync_ts) zurück.
    """
    url = f"{config['alphatrack_url']}/api/bridge/trades"
    headers = {"x-bot-api-key": config["api_key"]}

    sync_mode = config.get("sync_mode", "full")
    sync_cutoff = config.get("sync_cutoff_timestamp", 0) if sync_mode == "new_only" else 0

    open_trades = mt5.get_open_positions(min_open_utc=sync_cutoff)
    # Lookback-Fenster: immer mindestens _MIN_LOOKBACK_SEC zurückgehen damit
    # Trades die kurz vor dem letzten Sync geschlossen wurden nicht dauerhaft
    # als 'open' hängenbleiben.
    effective_ts = min(last_sync_ts, time.time() - _MIN_LOOKBACK_SEC) if last_sync_ts > 0 else last_sync_ts
    if sync_cutoff > 0:
        server_cutoff = sync_cutoff + mt5.server_offset_sec()
        effective_ts = max(effective_ts, server_cutoff)
    closed_trades = mt5.get_closed_deals(from_timestamp=effective_ts)

    all_trades = open_trades + closed_trades

    global _sync_diag_logged
    if not _sync_diag_logged and display:
        display.log("info", "SYNC",
                    f"Mode={sync_mode} cutoff={sync_cutoff} offset={mt5.server_offset_sec():.0f} "
                    f"open={len(open_trades)} closed={len(closed_trades)}")
        _sync_diag_logged = True

    if not all_trades:
        return True, last_sync_ts

    # Geschlossene Trades für Log vormerken
    closed_count = len(closed_trades)

    # C4: bot_id aus Ticket-Registry (gateway) aufloesen, Fallback auf Trade-Feld.
    # Closed-Deals haben kein 'ticket'-Feld; Ticket wird aus externalId extrahiert.
    tagged_trades = []
    for t in all_trades:
        ticket = t.get("ticket")
        if not ticket:
            ext_id = t.get("externalId", "")
            if isinstance(ext_id, str) and ext_id.startswith("pos_"):
                try:
                    ticket = int(ext_id[4:])
                except ValueError:
                    pass
        resolved = (get_at_bot_id_for_ticket(int(ticket)) if ticket else None) or t.get("bot_id", None)
        tagged_trades.append({**t, "bot_id": resolved})

    payload = {
        "bridgeId": config["bridge_id"],
        "profileId": config["profile_id"],
        "trades": tagged_trades,
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            synced = data.get("synced", 0)
            if synced > 0 and display:
                display.log("ok", "SYNC", f"{synced} neue Trade(s) an AlphaTrack uebertragen")

            # Zusammenfassung der geschlossenen Trades ins Log schreiben
            if closed_count > 0 and local_log:
                total_pnl = sum(t.get("pnl") or 0 for t in closed_trades)
                summary = f"{closed_count} Trade(s) synchronisiert | PnL gesamt: {total_pnl:+.2f}"
                local_log.add("info", summary)
                if display:
                    for t in closed_trades:
                        ticket = t.get("ticket") or t.get("externalId", "?")
                        symbol = t.get("instrument") or t.get("symbol", "?")
                        pnl = t.get("pnl")
                        pnl_str = f" | PnL: {pnl:+.2f}" if pnl is not None else ""
                        display.log("ok", "SYNC", f"CLOSED Trade: {symbol} | Ticket #{ticket}{pnl_str}")

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
