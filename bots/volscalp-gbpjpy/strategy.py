"""
Strategie: Volatility Squeeze Scalping (TTM-Squeeze-Breakout)
Symbol:    GBPJPYp, Timeframe: M1
Idee:      Erkennt Ruhephasen (Bollinger Bands innerhalb Keltner Channel = "Squeeze")
           und handelt viele kleine Trades, sobald sich die Bänder wieder öffnen
           ("Fire" = Volatilitätsausbruch). Solange der Markt im Squeeze verharrt,
           werden keine neuen Einstiege eröffnet. Bereits offene Trades laufen bis
           SL/TP weiter, auch wenn der Squeeze zwischenzeitlich zurückkehrt.
Einstieg:  BUY/SELL wenn der aktuelle Kurs außerhalb des Keltner Channel liegt UND
           kein Squeeze mehr vorliegt (Ausbruchsbestätigung). Edge-getriggert: nur
           EIN Einstiegsversuch pro Squeeze→Fire-Übergang, danach gesperrt bis der
           Markt zurück in den Squeeze fällt.
Ausstieg:  SL = ATR × sl_atr_multiplier | TP = SL-Distanz × rr_ratio (als sl_pips/
           tp_pips gesendet — Bridge verankert sie am tatsächlichen Ausführungspreis)
Risiko:    Dynamische Lotgröße (% Kontorisiko pro Trade)
Schutz:    Spread-Filter (aktueller Spread vs. gleitendem Durchschnitt), Mindest-TP-
           Sicherheitsfaktor über dem aktuellen Spread, Tagesverlustlimit (% Balance),
           Cooldown nach Verlustserie, News-Blackout (Wirtschaftskalender GBP/JPY)
"""
import sys
import os
import time
from collections import deque
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot

PIP_SIZE = 0.01  # GBP/JPY: 1 Pip = 0.01

try:
    from zoneinfo import ZoneInfo
    _BERLIN = ZoneInfo("Europe/Berlin")
except Exception:
    try:
        import pytz
        _BERLIN = pytz.timezone("Europe/Berlin")
    except ImportError:
        _BERLIN = None


class VolScalpGBPJPYStrategy(BaseBot):
    """TTM-Squeeze-Breakout-Scalping — GBPJPYp M1."""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        self._squeeze_armed: bool = True             # edge-getriggert: 1 Einstieg pro Squeeze→Fire-Übergang
        self._spread_samples: deque = deque(maxlen=30)
        self._day_start_balance: float | None = None
        self._day_start_date: str = ""
        self._daily_locked: bool = False
        self._prev_position_tickets: set | None = None
        self._consecutive_losses: int = 0
        self._cooldown_until: float = 0.0

    def get_parameters(self) -> dict:
        strat = self._config.get("strategy", {})
        return {
            "bb_period":                         float(strat.get("bb_period", 20)),
            "bb_std":                            float(strat.get("bb_std", 2.0)),
            "kc_multiplier":                     float(strat.get("kc_multiplier", 1.5)),
            "atr_period":                        float(strat.get("atr_period", 14)),
            "sl_atr_multiplier":                 float(strat.get("sl_atr_multiplier", 1.0)),
            "rr_ratio":                          float(strat.get("rr_ratio", 1.2)),
            "risk_percent":                      float(strat.get("risk_percent", 0.5)),
            "pip_value_per_lot":                 float(strat.get("pip_value_per_lot", 7.0)),
            "spread_filter_multiplier":          float(strat.get("spread_filter_multiplier", 1.5)),
            "min_tp_spread_factor":              float(strat.get("min_tp_spread_factor", 2.5)),
            "daily_loss_limit_percent":          float(strat.get("daily_loss_limit_percent", 3.0)),
            "consecutive_loss_cooldown_count":   float(strat.get("consecutive_loss_cooldown_count", 3)),
            "consecutive_loss_cooldown_minutes": float(strat.get("consecutive_loss_cooldown_minutes", 60)),
            "news_blackout_enabled":             float(strat.get("news_blackout_enabled", 1)),
            "news_blackout_minutes":             float(strat.get("news_blackout_minutes", 15)),
        }

    def on_tick(self, candles: list, positions: list) -> dict:
        self._ensure_state()
        cfg = self._config.get("strategy", {})
        symbol = cfg.get("symbol", "GBPJPYp")

        # Verlustserien-Tracking läuft immer, unabhängig vom weiteren Entscheid
        self._check_trade_outcomes(positions)

        candles = self._to_chronological(candles)
        if len(candles) < 30:
            return {"action": "hold", "reason": "Zu wenig Kerzen"}

        # --- Tagesverlustlimit ---
        self._maybe_reset_day()
        if self._daily_locked:
            return {"action": "hold", "reason": "Tagesverlustlimit erreicht — kein weiterer Einstieg heute"}

        # --- Cooldown nach Verlustserie ---
        now_sec = time.time()
        if now_sec < self._cooldown_until:
            remaining = int((self._cooldown_until - now_sec) / 60) + 1
            return {"action": "hold", "reason": f"Cooldown nach Verlustserie — noch ~{remaining} Min."}

        max_pos = int(cfg.get("max_positions", 3))
        if len(positions) >= max_pos:
            return {"action": "hold", "reason": f"Max. {max_pos} Positionen offen"}

        # --- News-Blackout ---
        if bool(int(cfg.get("news_blackout_enabled", 1))):
            blocked, blackout_reason = self._news_blackout(cfg)
            if blocked:
                return {"action": "hold", "reason": blackout_reason}

        # --- Indikatoren auf abgeschlossenen Kerzen (letzte Kerze = evtl. noch offen) ---
        closed = candles[:-1]
        bb_period = int(cfg.get("bb_period", 20))
        bb_std = float(cfg.get("bb_std", 2.0))
        atr_period = int(cfg.get("atr_period", 14))
        kc_mult = float(cfg.get("kc_multiplier", 1.5))

        if len(closed) < max(bb_period, atr_period) + 2:
            return {"action": "hold", "reason": "Zu wenig Kerzen für Indikatoren"}

        closes = [float(c["close"]) for c in closed]
        sma = sum(closes[-bb_period:]) / bb_period
        variance = sum((c - sma) ** 2 for c in closes[-bb_period:]) / bb_period
        std = variance ** 0.5
        bb_upper = sma + bb_std * std
        bb_lower = sma - bb_std * std

        atr = self._calc_atr(closed, atr_period)
        if atr is None:
            return {"action": "hold", "reason": "ATR nicht berechenbar"}

        kc_upper = sma + kc_mult * atr
        kc_lower = sma - kc_mult * atr

        squeeze_on = bb_upper < kc_upper and bb_lower > kc_lower

        if squeeze_on:
            # Squeeze aktiv → für den nächsten Fire-Übergang wieder "scharf" schalten
            self._squeeze_armed = True
            return {
                "action": "hold",
                "reason": f"Squeeze aktiv (Ruhephase) | BB {bb_lower:.3f}-{bb_upper:.3f} innerhalb KC {kc_lower:.3f}-{kc_upper:.3f}",
            }

        # Edge-getriggert: nur EIN Einstiegsversuch pro Squeeze→Fire-Übergang.
        # Solange der Markt in derselben Ausbruchsphase bleibt, kein erneuter Versuch —
        # erst wenn der Squeeze zurückkehrt, wird wieder "scharf" geschaltet (s.o.).
        if not self._squeeze_armed:
            return {"action": "hold", "reason": "Ausbruch bereits in dieser Phase gehandelt — warte auf neuen Squeeze"}
        self._squeeze_armed = False

        # --- Ausbruch: Richtung über aktuellen Kurs (letzte, evtl. noch offene Kerze) ---
        last_close = float(candles[-1]["close"])

        direction = None
        if last_close > kc_upper:
            direction = "buy"
        elif last_close < kc_lower:
            direction = "sell"

        if direction is None:
            return {
                "action": "hold",
                "reason": f"Volatilitätsausbruch erkannt, aber kein Durchbruch der KC-Bänder | Preis {last_close:.3f}",
            }

        # --- Spread ermitteln (live-only — im Backtest ohne Bridge deaktiviert) ---
        current_spread = 0.0
        tick = self._bridge.get_tick(symbol) if self._bridge else None
        if tick is not None:
            current_spread = float(tick.get("spread_pips", 0))
            self._spread_samples.append(current_spread)

        spread_filter_mult = float(cfg.get("spread_filter_multiplier", 1.5))
        if current_spread > 0 and len(self._spread_samples) >= 6:
            avg_spread = sum(list(self._spread_samples)[:-1]) / (len(self._spread_samples) - 1)
            if avg_spread > 0 and current_spread > avg_spread * spread_filter_mult:
                return {
                    "action": "hold",
                    "reason": f"Spread zu breit ({current_spread:.1f}p vs. Ø {avg_spread:.1f}p) — kein Einstieg",
                }

        # --- SL/TP ATR-basiert ---
        sl_atr_mult = float(cfg.get("sl_atr_multiplier", 1.0))
        rr_ratio = float(cfg.get("rr_ratio", 1.2))
        sl_dist = atr * sl_atr_mult
        tp_dist = sl_dist * rr_ratio

        sl_pips = round(sl_dist / PIP_SIZE, 1)
        tp_pips = round(tp_dist / PIP_SIZE, 1)

        # --- Mindest-TP-Sicherheitsfaktor: TP muss Spread + Puffer decken ---
        min_tp_factor = float(cfg.get("min_tp_spread_factor", 2.5))
        if current_spread > 0 and tp_pips < current_spread * min_tp_factor:
            return {
                "action": "hold",
                "reason": f"TP zu klein relativ zum Spread (TP={tp_pips:.1f}p, Spread={current_spread:.1f}p, Faktor {min_tp_factor})",
            }

        sl = round(last_close - sl_dist, 3) if direction == "buy" else round(last_close + sl_dist, 3)
        tp = round(last_close + tp_dist, 3) if direction == "buy" else round(last_close - tp_dist, 3)

        lots = self._calc_lots(sl_pips, cfg)

        arrow = "↑" if direction == "buy" else "↓"
        reason = (
            f"{arrow} Squeeze-Fire | Preis {last_close:.3f} durchbricht KC {kc_upper:.3f}/{kc_lower:.3f} | "
            f"SL {sl_pips}p TP {tp_pips}p | Spread {current_spread:.1f}p"
        )

        return {
            "action":  direction,
            "lots":    lots,
            "sl":      sl,
            "tp":      tp,
            "sl_pips": sl_pips,
            "tp_pips": tp_pips,
            "reason":  reason,
        }

    # -------------------------------------------------------------------------
    # Hilfsmethoden
    # -------------------------------------------------------------------------

    def _ensure_state(self) -> None:
        """Lazy init — der Backtest-Runner nutzt object.__new__() und überspringt __init__."""
        if not hasattr(self, "_squeeze_armed"):
            self._squeeze_armed = True
        if not hasattr(self, "_spread_samples"):
            self._spread_samples = deque(maxlen=30)
        if not hasattr(self, "_day_start_balance"):
            self._day_start_balance = None
        if not hasattr(self, "_day_start_date"):
            self._day_start_date = ""
        if not hasattr(self, "_daily_locked"):
            self._daily_locked = False
        if not hasattr(self, "_prev_position_tickets"):
            self._prev_position_tickets = None
        if not hasattr(self, "_consecutive_losses"):
            self._consecutive_losses = 0
        if not hasattr(self, "_cooldown_until"):
            self._cooldown_until = 0.0

    def _to_chronological(self, candles: list) -> list:
        """Normalisiert auf älteste-zuerst — Bridge liefert live neueste zuerst,
        der Backtest-Runner liefert älteste zuerst."""
        if len(candles) < 2:
            return list(candles)
        first_dt = candles[0].get("datetime", "")
        last_dt = candles[-1].get("datetime", "")
        if first_dt and last_dt and first_dt > last_dt:
            return list(reversed(candles))
        return list(candles)

    def _calc_atr(self, candles: list, period: int) -> float | None:
        if len(candles) < period + 1:
            return None
        true_ranges = []
        for i in range(1, len(candles)):
            high = float(candles[i]["high"])
            low = float(candles[i]["low"])
            prev_close = float(candles[i - 1]["close"])
            tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
            true_ranges.append(tr)
        return sum(true_ranges[-period:]) / period

    def _calc_lots(self, sl_pips: float, cfg: dict) -> float:
        """Lotgröße für eingestelltes Kontorisiko (Standard: 0.5%)."""
        risk_percent = float(cfg.get("risk_percent", 0.5))
        pip_val_per_lot = float(cfg.get("pip_value_per_lot", 7.0))

        account = self._bridge.get_account_info() if self._bridge else None
        balance = float(account.get("balance", 1000.0)) if account else 1000.0

        if sl_pips <= 0 or pip_val_per_lot <= 0:
            return 0.01

        risk_amount = balance * (risk_percent / 100.0)
        lots = risk_amount / (sl_pips * pip_val_per_lot)
        lots = max(0.01, min(10.0, round(lots / 0.01) * 0.01))
        return lots

    def _maybe_reset_day(self) -> None:
        """Setzt das Tagesverlustlimit an jedem neuen UTC-Kalendertag zurück."""
        today = self._now().strftime("%Y-%m-%d")
        if today != self._day_start_date:
            self._day_start_date = today
            self._daily_locked = False
            account = self._bridge.get_account_info() if self._bridge else None
            self._day_start_balance = float(account.get("balance", 0)) if account else None
            return

        if self._daily_locked or self._day_start_balance is None or self._day_start_balance <= 0:
            return

        account = self._bridge.get_account_info() if self._bridge else None
        if account is None:
            return
        balance = float(account.get("balance", 0))
        limit_pct = float(self._config.get("strategy", {}).get("daily_loss_limit_percent", 3.0))
        drawdown_pct = (self._day_start_balance - balance) / self._day_start_balance * 100
        if drawdown_pct >= limit_pct:
            self._daily_locked = True
            self.log("warn", f"Tagesverlustlimit erreicht ({drawdown_pct:.2f}% >= {limit_pct}%)")

    def _check_trade_outcomes(self, positions: list) -> None:
        """Erkennt geschlossene eigene Tickets über die Positions-Differenz und
        wertet deren Ergebnis über die Trade-Historie aus (Verlustserien-Cooldown)."""
        current_tickets = {int(p["ticket"]) for p in positions if p.get("ticket")}
        if self._prev_position_tickets is None:
            self._prev_position_tickets = current_tickets
            return

        closed_tickets = self._prev_position_tickets - current_tickets
        self._prev_position_tickets = current_tickets
        if not closed_tickets or not self._bridge:
            return

        history = self._bridge.get_history()
        for ticket in closed_tickets:
            deal = next((d for d in history if d.get("externalId") == f"pos_{ticket}"), None)
            if deal is None:
                continue
            net = float(deal.get("pnl", 0)) - float(deal.get("commission", 0)) + float(deal.get("swap", 0))
            if net < 0:
                self._consecutive_losses += 1
            else:
                self._consecutive_losses = 0

            cfg = self._config.get("strategy", {})
            loss_threshold = int(cfg.get("consecutive_loss_cooldown_count", 3))
            if self._consecutive_losses >= loss_threshold:
                cooldown_min = float(cfg.get("consecutive_loss_cooldown_minutes", 60))
                self._cooldown_until = time.time() + cooldown_min * 60
                self.log("warn", f"{self._consecutive_losses} Verluste in Folge — Cooldown {cooldown_min} Min.")
                self._consecutive_losses = 0

    def _news_blackout(self, cfg: dict) -> tuple[bool, str]:
        """True + Grund, wenn ein High-Impact GBP/JPY-Event im Blackout-Fenster liegt."""
        if not self._bridge:
            return False, ""

        blackout_min = float(cfg.get("news_blackout_minutes", 15))
        try:
            events = self._bridge.get_calendar(days_back=0, days_ahead=1)
        except Exception:
            events = []

        now_utc = self._now()
        relevant_currencies = {"GBP", "JPY"}

        for ev in events:
            if ev.get("impact") != "High":
                continue
            if ev.get("country") not in relevant_currencies:
                continue
            try:
                naive = datetime.strptime(f"{ev['date']} {ev['time']}", "%Y-%m-%d %H:%M")
            except (KeyError, ValueError, TypeError):
                continue

            if _BERLIN is not None:
                if hasattr(_BERLIN, "localize"):
                    local_dt = _BERLIN.localize(naive)
                else:
                    local_dt = naive.replace(tzinfo=_BERLIN)
                ev_utc = local_dt.astimezone(timezone.utc)
            else:
                ev_utc = naive.replace(tzinfo=timezone.utc)

            delta_min = abs((now_utc - ev_utc).total_seconds()) / 60.0
            if delta_min <= blackout_min:
                return True, f"News-Blackout: {ev.get('title')} ({ev.get('country')}) {ev['time']} Berlin-Zeit"

        return False, ""
