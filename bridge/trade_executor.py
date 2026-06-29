"""
Trade-Executor: Führt Orders direkt in MetaTrader 5 aus.
Wird vom Command-Handler aufgerufen wenn execute_trade eintrifft.
"""

import time
import MetaTrader5 as mt5


def pips_to_price(pips: float, symbol_info) -> float:
    """Rechnet Pips in Preis-Differenz um. Bei 5/3-stelligen Brokern: 1 pip = 10 points."""
    if symbol_info.digits in (3, 5):
        return pips * 10 * symbol_info.point
    return pips * symbol_info.point


def execute_trade(symbol: str, direction: str, lots: float,
                  sl: float = 0.0, tp: float = 0.0,
                  sl_pips: float = 0.0, tp_pips: float = 0.0) -> dict:
    """
    Platziert eine Market-Order in MT5.

    Returns dict mit: success, ticket (bei Erfolg), error (bei Fehler),
    symbol, direction, lots, timestamp
    """
    import datetime
    timestamp = datetime.datetime.utcnow().isoformat() + "Z"

    direction = direction.lower().strip()
    if direction not in ("buy", "sell"):
        return _err(f"Ungültige Richtung: {direction!r} (erwartet 'buy' oder 'sell')", symbol, direction, lots, timestamp)

    # Symbol-Info holen
    symbol_info = mt5.symbol_info(symbol)
    if symbol_info is None:
        return _err(f"Symbol {symbol} nicht gefunden", symbol, direction, lots, timestamp)

    if not symbol_info.visible:
        if not mt5.symbol_select(symbol, True):
            return _err(f"Symbol {symbol} konnte nicht aktiviert werden", symbol, direction, lots, timestamp)

    # Aktuellen Preis holen
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return _err(f"Kein Tick-Preis für {symbol}", symbol, direction, lots, timestamp)

    order_type = mt5.ORDER_TYPE_BUY if direction == "buy" else mt5.ORDER_TYPE_SELL
    price = tick.ask if direction == "buy" else tick.bid
    if not price or price <= 0:
        return _err(f"Ungültiger Tick-Preis für {symbol}: {price}", symbol, direction, lots, timestamp)
    deviation = 20

    # Filling-Mode vom Broker/Symbol ermitteln
    filling_mode = _get_filling_mode(symbol_info)

    # SL/TP: Pips haben Vorrang wenn angegeben, sonst absoluter Preis
    pip_size = pips_to_price(1, symbol_info)
    is_buy = direction == "buy"

    sl_price = 0.0
    if sl_pips and sl_pips > 0:
        sl_price = round(price - sl_pips * pip_size if is_buy else price + sl_pips * pip_size, symbol_info.digits)
    elif sl and sl > 0:
        sl_price = float(sl)

    tp_price = 0.0
    if tp_pips and tp_pips > 0:
        tp_price = round(price + tp_pips * pip_size if is_buy else price - tp_pips * pip_size, symbol_info.digits)
    elif tp and tp > 0:
        tp_price = float(tp)

    # SL/TP validieren: falsche Seite und Stops-Level prüfen
    min_dist = (symbol_info.trade_stops_level + 5) * symbol_info.point
    sl_price, tp_price, removed_stops = _validate_stops(sl_price, tp_price, price, is_buy, min_dist, symbol_info.digits)

    # SL wurde entfernt obwohl mitgegeben → Trade abbrechen (Risiko)
    sl_intended = sl > 0 or sl_pips > 0
    tp_intended = tp > 0 or tp_pips > 0
    if sl_intended and sl_price == 0:
        msg = f"Trade abgebrochen: SL ungültig nach Preisvalidierung (SL={sl}, Preis={price:.{symbol_info.digits}f})"
        if removed_stops:
            msg += f" — {'; '.join(removed_stops)}"
        print(f"[EXECUTOR] {msg}")
        return _err(msg, symbol, direction, lots, timestamp)

    sltp_warning: str | None = None
    if tp_intended and tp_price == 0:
        sltp_warning = f"TP entfernt: {'; '.join(removed_stops)}" if removed_stops else "TP durch Preisvalidierung entfernt"
        print(f"[EXECUTOR] WARNUNG: {sltp_warning}")

    print(f"[EXECUTOR] {direction.upper()} {lots} {symbol} @ {price:.{symbol_info.digits}f}"
          f"  SL={sl_price if sl_price else 'none'}  TP={tp_price if tp_price else 'none'}"
          f"  StopsLevel={symbol_info.trade_stops_level}")

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": float(lots),
        "type": order_type,
        "price": price,
        "deviation": deviation,
        "magic": 20250101,
        "comment": "/bridge/tradeexecuter",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": filling_mode,
    }

    if sl_price > 0:
        request["sl"] = sl_price
    if tp_price > 0:
        request["tp"] = tp_price

    result = mt5.order_send(request)

    if result is None:
        return _err("order_send returned None", symbol, direction, lots, timestamp)

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return _err(
            f"MT5 Fehler {result.retcode}: {result.comment}"
            f" (price={price} sl={sl_price} tp={tp_price})",
            symbol, direction, lots, timestamp
        )

    ticket = result.order
    print(f"[EXECUTOR] Order OK: {direction.upper()} {lots} {symbol} @ {price} Ticket={ticket}")

    # SL/TP nachträglich setzen falls Broker sie in der Market-Order ignoriert hat
    if sl_price > 0 or tp_price > 0:
        time.sleep(0.5)
        positions = mt5.positions_get(ticket=ticket)
        if positions:
            pos = positions[0]
            sl_missing = sl_price > 0 and pos.sl == 0
            tp_missing = tp_price > 0 and pos.tp == 0
            if sl_missing or tp_missing:
                modify_req = {
                    "action": mt5.TRADE_ACTION_SLTP,
                    "symbol": symbol,
                    "position": ticket,
                    "sl": sl_price if sl_price > 0 else pos.sl,
                    "tp": tp_price if tp_price > 0 else pos.tp,
                }
                mod = mt5.order_send(modify_req)
                if mod and mod.retcode == mt5.TRADE_RETCODE_DONE:
                    print(f"[EXECUTOR] SL/TP gesetzt: SL={modify_req['sl']} TP={modify_req['tp']}")
                else:
                    err_code = mod.retcode if mod else "None"
                    print(f"[EXECUTOR] SL/TP setzen fehlgeschlagen: {err_code}")
                    sltp_warning = f"SL/TP konnte nicht gesetzt werden (retcode: {err_code})"

    result: dict = {
        "success": True,
        "ticket": ticket,
        "symbol": symbol,
        "direction": direction,
        "lots": lots,
        "price": price,
        "timestamp": timestamp,
    }
    if sltp_warning:
        result["sltp_warning"] = sltp_warning
    return result


def close_position(ticket: int) -> dict:
    """Schließt eine offene Position anhand des Tickets."""
    import datetime
    timestamp = datetime.datetime.utcnow().isoformat() + "Z"

    positions = mt5.positions_get(ticket=ticket)
    if not positions:
        return {"success": False, "error": f"Position {ticket} nicht gefunden", "ticket": ticket, "timestamp": timestamp}

    pos = positions[0]
    symbol = pos.symbol
    volume = pos.volume
    order_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return {"success": False, "error": f"Kein Tick für {symbol}", "ticket": ticket, "timestamp": timestamp}

    price = tick.bid if order_type == mt5.ORDER_TYPE_SELL else tick.ask
    symbol_info = mt5.symbol_info(symbol)
    filling = _get_filling_mode(symbol_info)

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": order_type,
        "position": ticket,
        "price": price,
        "deviation": 20,
        "magic": 20250101,
        "comment": "AlphaTrack Close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": filling,
    }

    result = mt5.order_send(request)
    if result is None:
        return {"success": False, "error": "order_send returned None", "ticket": ticket, "timestamp": timestamp}
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return {"success": False, "error": f"MT5 Fehler {result.retcode}: {result.comment}", "ticket": ticket, "timestamp": timestamp}

    print(f"[EXECUTOR] Position geschlossen: Ticket={ticket} @ {price}")
    return {"success": True, "ticket": ticket, "price": price, "timestamp": timestamp}


def _validate_stops(sl: float, tp: float, price: float, is_buy: bool,
                    min_dist: float, digits: int) -> tuple[float, float, list[str]]:
    """
    Prüft SL/TP auf Gültigkeit und passt sie an.
    Returns (sl_price, tp_price, removed_reasons).
    removed_reasons enthält Meldungen für jeden Stop der auf der falschen Seite lag.
    """
    removed: list[str] = []

    if is_buy:
        # SL muss unter Preis
        if sl > 0:
            if sl >= price:
                removed.append(f"SL {sl:.{digits}f} >= Ask {price:.{digits}f} (BUY)")
                print(f"[EXECUTOR] SL {sl:.{digits}f} >= Preis {price:.{digits}f} (BUY) - wird entfernt")
                sl = 0.0
            elif price - sl < min_dist:
                adjusted = round(price - min_dist, digits)
                print(f"[EXECUTOR] SL zu nah, angepasst: {sl:.{digits}f} → {adjusted:.{digits}f}")
                sl = adjusted
        # TP muss über Preis
        if tp > 0:
            if tp <= price:
                removed.append(f"TP {tp:.{digits}f} <= Ask {price:.{digits}f} (BUY)")
                print(f"[EXECUTOR] TP {tp:.{digits}f} <= Preis {price:.{digits}f} (BUY) - wird entfernt")
                tp = 0.0
            elif tp - price < min_dist:
                adjusted = round(price + min_dist, digits)
                print(f"[EXECUTOR] TP zu nah, angepasst: {tp:.{digits}f} → {adjusted:.{digits}f}")
                tp = adjusted
    else:
        # SELL: SL muss über Preis, TP muss unter Preis
        if sl > 0:
            if sl <= price:
                removed.append(f"SL {sl:.{digits}f} <= Bid {price:.{digits}f} (SELL)")
                print(f"[EXECUTOR] SL {sl:.{digits}f} <= Preis {price:.{digits}f} (SELL) - wird entfernt")
                sl = 0.0
            elif sl - price < min_dist:
                adjusted = round(price + min_dist, digits)
                print(f"[EXECUTOR] SL zu nah, angepasst: {sl:.{digits}f} → {adjusted:.{digits}f}")
                sl = adjusted
        if tp > 0:
            if tp >= price:
                removed.append(f"TP {tp:.{digits}f} >= Bid {price:.{digits}f} (SELL)")
                print(f"[EXECUTOR] TP {tp:.{digits}f} >= Preis {price:.{digits}f} (SELL) - wird entfernt")
                tp = 0.0
            elif price - tp < min_dist:
                adjusted = round(price - min_dist, digits)
                print(f"[EXECUTOR] TP zu nah, angepasst: {tp:.{digits}f} → {adjusted:.{digits}f}")
                tp = adjusted

    return sl, tp, removed


def _get_filling_mode(symbol_info) -> int:
    """Ermittelt den vom Broker unterstützten Filling-Mode für das Symbol.
    filling_mode Bitmask: Bit 0 = FOK erlaubt, Bit 1 = IOC erlaubt."""
    filling = symbol_info.filling_mode
    if filling & 1:  # FOK
        return mt5.ORDER_FILLING_FOK
    if filling & 2:  # IOC
        return mt5.ORDER_FILLING_IOC
    return mt5.ORDER_FILLING_RETURN


def _err(msg: str, symbol: str, direction: str, lots: float, timestamp: str) -> dict:
    print(f"[EXECUTOR] Fehler: {msg}")
    return {
        "success": False,
        "error": msg,
        "symbol": symbol,
        "direction": direction,
        "lots": lots,
        "timestamp": timestamp,
    }
