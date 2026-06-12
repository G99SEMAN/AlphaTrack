import time

import MetaTrader5 as mt5
from datetime import datetime, timedelta, timezone
from typing import Optional

_IS_CONNECTED_CACHE_TTL = 5.0  # seconds
_SERVER_OFFSET_CACHE_TTL = 3600.0  # seconds
_DEFAULT_SERVER_OFFSET_SEC = 3 * 3600.0  # Fallback: BlackBull läuft auf UTC+3 (Sommer)
_MAX_PLAUSIBLE_OFFSET_SEC = 14 * 3600.0  # Broker-Offsets liegen zwischen UTC-12 und UTC+14

try:
    from zoneinfo import ZoneInfo
    _TZ_BERLIN = ZoneInfo('Europe/Berlin')
except Exception:
    # Windows ohne tzdata-Paket: pip install tzdata
    try:
        import pytz
        _TZ_BERLIN = pytz.timezone('Europe/Berlin')
    except ImportError:
        from datetime import timedelta
        _TZ_BERLIN = timezone(timedelta(hours=1))  # CET-Fallback ohne DST


def _utc_iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

_TIMEFRAME_MAP = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}


class MT5Connector:
    def __init__(self, login: int, password: str, server: str):
        self._login = login
        self._password = password
        self._server = server
        self._conn_cache: bool = False
        self._conn_cache_at: float = 0.0
        self._server_offset_cache: Optional[float] = None
        self._server_offset_at: float = 0.0

    def connect(self) -> bool:
        if not mt5.initialize():
            print(f"[MT5] initialize() fehlgeschlagen: {mt5.last_error()}")
            return False

        authorized = mt5.login(self._login, password=self._password, server=self._server)
        if not authorized:
            print(f"[MT5] Login fehlgeschlagen: {mt5.last_error()}")
            mt5.shutdown()
            return False

        info = mt5.account_info()
        print(f"[MT5] Verbunden: {info.name} | Server: {self._server} | Balance: {info.balance} {info.currency}")
        return True

    def disconnect(self):
        mt5.shutdown()
        self._conn_cache = False
        self._conn_cache_at = 0.0
        print("[MT5] Verbindung getrennt")

    def is_connected(self) -> bool:
        now = time.monotonic()
        if now - self._conn_cache_at < _IS_CONNECTED_CACHE_TTL:
            return self._conn_cache
        try:
            result = mt5.account_info() is not None
        except Exception:
            result = False
        if not result:
            # On failure invalidate immediately so next call re-checks
            self._conn_cache_at = 0.0
        else:
            self._conn_cache_at = now
        self._conn_cache = result
        return result

    def _server_offset_sec(self) -> float:
        """Versatz der Broker-Serverzeit gegenüber UTC in Sekunden.

        MT5 liefert Epochs in Serverzeit (so als wäre sie UTC). Der Versatz wird
        über einen frischen Tick ermittelt (tick.time ist Server-Epoch). Stale
        Ticks (z.B. Wochenende) fallen durch den Plausibilitäts-Clamp, dann
        greift der letzte bekannte Wert bzw. der Default.
        """
        now = time.time()
        if self._server_offset_cache is not None and now - self._server_offset_at < _SERVER_OFFSET_CACHE_TTL:
            return self._server_offset_cache

        candidates = self.get_active_symbols()
        if not candidates:
            symbols = mt5.symbols_get()
            candidates = [s.name for s in symbols if s.visible][:10] if symbols else []
        for sym in candidates:
            tick = mt5.symbol_info_tick(sym)
            if tick is None or not tick.time:
                continue
            diff = tick.time - now
            if abs(diff) <= _MAX_PLAUSIBLE_OFFSET_SEC:
                # Broker-Offsets liegen im 30-Minuten-Raster
                self._server_offset_cache = round(diff / 1800.0) * 1800.0
                self._server_offset_at = now
                return self._server_offset_cache
        return self._server_offset_cache if self._server_offset_cache is not None else _DEFAULT_SERVER_OFFSET_SEC

    def _server_iso(self, ts: float) -> str:
        """Server-Epoch → echte UTC-ISO-Zeit (Frontend zeigt dann Lokalzeit an)."""
        return _utc_iso(ts - self._server_offset_sec())

    def get_open_positions(self) -> list[dict]:
        positions = mt5.positions_get()
        if positions is None:
            return []
        result = []
        for p in positions:
            result.append({
                "ticket": p.ticket,
                "date": self._server_iso(p.time),
                "instrument": p.symbol,
                "type": "long" if p.type == mt5.POSITION_TYPE_BUY else "short",
                "entry": p.price_open,
                "currentPrice": p.price_current,
                "size": p.volume,
                "sl": p.sl if p.sl > 0 else None,
                "tp": p.tp if p.tp > 0 else None,
                "pnl": round(p.profit, 2),
                "commission": 0.0,
                "swap": round(p.swap, 2),
                "status": "open",
                "externalId": f"pos_{p.ticket}",
            })
        return result

    def get_closed_deals(self, from_timestamp: Optional[float] = None) -> list[dict]:
        """Gibt abgeschlossene Trades zurück (IN+OUT-Deal-Paare nach position_id gruppiert).

        Wichtig: Das Abfragefenster beginnt 7 Tage vor from_timestamp, damit auch Trades
        enthalten sind, die VOR dem letzten Sync geöffnet aber NACH dem Sync geschlossen wurden.
        Gefiltert wird dann nach dem Schließzeitpunkt (exit_.time >= close_after).
        """
        close_after = from_timestamp or 0.0
        # 7 Tage Puffer damit IN-Deals älterer offener Positionen immer mitgefetcht werden
        lookback_start = max(0.0, close_after - 7 * 24 * 3600)
        from_date = datetime.fromtimestamp(lookback_start) if lookback_start > 0 else datetime(2000, 1, 1)
        # Broker-Serverzeit (z.B. UTC+3) liegt vor der Lokalzeit — mit datetime.now()
        # als Obergrenze fehlen die juengsten Deals und Trades bleiben dauerhaft 'open'.
        to_date = datetime.now() + timedelta(days=2)

        deals = mt5.history_deals_get(from_date, to_date)
        if deals is None:
            return []

        # Deals nach position_id gruppieren
        by_pos: dict[int, list] = {}
        for d in deals:
            by_pos.setdefault(d.position_id, []).append(d)

        result = []
        for pos_id, pos_deals in by_pos.items():
            entry = next((d for d in pos_deals if d.entry == mt5.DEAL_ENTRY_IN), None)
            exit_deals = [d for d in pos_deals if d.entry == mt5.DEAL_ENTRY_OUT]
            if not entry or not exit_deals:
                continue
            # Letzter Exit-Deal (bei partiellen Closes gibt es mehrere)
            exit_ = max(exit_deals, key=lambda d: d.time)
            # Nur Positionen zurückgeben, die NACH dem letzten Sync geschlossen wurden
            if exit_.time < close_after:
                continue

            pnl = sum(d.profit for d in pos_deals)
            commission = sum(d.commission for d in pos_deals)
            swap = sum(d.swap for d in pos_deals)

            result.append({
                "date": self._server_iso(entry.time),
                "closeTime": self._server_iso(exit_.time),
                "instrument": entry.symbol,
                "type": "long" if entry.type == mt5.DEAL_TYPE_BUY else "short",
                "entry": entry.price,
                "exit": exit_.price,
                "size": entry.volume,
                "pnl": round(pnl, 2),
                "commission": round(commission, 2),
                "swap": round(swap, 2),
                "status": "closed",
                "externalId": f"pos_{pos_id}",
            })
        return result

    def get_account_info(self) -> dict | None:
        info = mt5.account_info()
        if info is None:
            return None
        return {
            "balance": round(info.balance, 2),
            "equity": round(info.equity, 2),
            "currency": info.currency,
        }

    def get_active_symbols(self) -> list[str]:
        positions = mt5.positions_get()
        if not positions:
            return []
        return list({p.symbol for p in positions})

    def get_open_positions_count(self) -> int:
        positions = mt5.positions_get()
        return len(positions) if positions else 0

    def get_calendar(self, from_dt: datetime, to_dt: datetime) -> list[dict]:
        LONG_MIN = -9223372036854775808
        IMPORTANCE_MAP = {1: 'Low', 2: 'Medium', 3: 'High'}
        FOREX_CURRENCIES = {'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'}

        try:
            countries = mt5.calendar_countries()
            if not countries:
                return []
            country_currency = {c.id: c.currency for c in countries}

            all_events = mt5.calendar_events()
            if not all_events:
                return []
            event_map = {e.id: e for e in all_events}

            values = mt5.calendar_event_history_range(from_dt, to_dt)
            if values is None:
                return []

            def fmt(val: int, digits: int):
                if val == LONG_MIN:
                    return None
                n = round(val / (10 ** digits), digits) if digits > 0 else float(val)
                return str(n)

            seen: set = set()
            result = []
            for v in values:
                event = event_map.get(v.event_id)
                if not event:
                    continue
                currency = country_currency.get(event.country_id, '')
                if currency not in FOREX_CURRENCIES:
                    continue
                importance = IMPORTANCE_MAP.get(event.importance)
                if not importance:
                    continue
                key = f"{v.event_id}-{v.time}"
                if key in seen:
                    continue
                seen.add(key)
                release_dt = datetime.fromtimestamp(v.time, tz=_TZ_BERLIN)
                result.append({
                    'id': key,
                    'title': event.name,
                    'country': currency,
                    'date': release_dt.strftime('%Y-%m-%d'),
                    'time': release_dt.strftime('%H:%M'),
                    'impact': importance,
                    'actual': fmt(v.actual_value, event.digits),
                    'forecast': fmt(v.forecast_value, event.digits),
                    'previous': fmt(v.prev_value, event.digits),
                })
            return sorted(result, key=lambda x: x['date'] + x['time'])
        except Exception as e:
            print(f"[MT5] Kalender-Fehler: {e}")
            return []

    def copy_rates(self, symbol: str, interval: str, count: int) -> list[dict]:
        tf = _TIMEFRAME_MAP.get(interval)
        if tf is None:
            return []
        rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
        if rates is None:
            return []
        result = [
            {
                "datetime": datetime.fromtimestamp(r["time"], tz=timezone.utc).astimezone(_TZ_BERLIN).strftime("%Y-%m-%d %H:%M:%S"),
                "open": str(r["open"]),
                "high": str(r["high"]),
                "low": str(r["low"]),
                "close": str(r["close"]),
            }
            for r in rates
        ]
        result.reverse()  # neueste zuerst
        return result
