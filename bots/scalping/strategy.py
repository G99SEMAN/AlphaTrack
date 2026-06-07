"""
Strategie: ICT Fair Value Gap + Liquidity Scalping
Beschreibung:
  Multi-Timeframe Scalping auf Basis von ICT/SMC-Konzepten.
  H1/H4 Fair Value Gap gibt Richtung und Bias.
  M5/M15 bestätigt: Liquidity Sweep des letzten Swings + Displacement.
  M1 triggert den Entry: erneuter Sweep + Break of Structure.
  Break-even nach TP1, TP2 = tieferes H1-Struktur-Level.

Parameter (config.json -> strategy):
  symbol            : Handelssymbol (NDAQ.OQ)
  timeframe         : M1 (Entry-Monitoring, wird von BaseBot gefetcht)
  candles_count     : Anzahl M1-Kerzen (100)
  lots              : Lot-Grösse (0.01)
  max_positions     : 1
  session_start_cet : Handelsbeginn CET (08:00)
  session_end_cet   : Handelsende CET (17:00)
  h1_candles        : H1-Kerzen fuer FVG-Suche (50)
  h4_candles        : H4-Kerzen fuer FVG-Suche (30)
  m5_candles        : M5-Kerzen fuer Bestätigung (100)
  m15_candles       : M15-Kerzen fuer Bestätigung (60)
  min_crv           : Minimum CRV (2.0)
"""
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot


def _cet_offset() -> int:
    """Approximate UTC-Offset fuer CET (1h Winter) / CEST (2h Sommer)."""
    month = datetime.now(timezone.utc).month
    return 2 if 4 <= month <= 10 else 1


class FVGScalper(BaseBot):
    """ICT Fair Value Gap + Liquidity Scalping Bot fuer NDAQ.OQ."""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        self._bias: str | None = None
        self._htf: str | None = None
        self._active_fvg: dict | None = None
        self._entry_price: float | None = None
        self._entry_sl: float | None = None
        self._entry_tp1: float | None = None
        self._entry_tp2: float | None = None
        self._tp1_hit: bool = False

    # ── Session ──────────────────────────────────────────────────────────

    def _in_session(self) -> bool:
        cfg = self._config.get("strategy", {})
        s_start = cfg.get("session_start_cet", "08:00")
        s_end = cfg.get("session_end_cet", "17:00")
        now_cet = datetime.now(timezone.utc) + timedelta(hours=_cet_offset())
        cur = now_cet.hour * 60 + now_cet.minute

        def to_min(t: str) -> int:
            h, m = map(int, t.split(":"))
            return h * 60 + m

        return to_min(s_start) <= cur <= to_min(s_end)

    # ── FVG Detection ────────────────────────────────────────────────────

    def _find_fvgs(self, candles: list, direction: str) -> list:
        """
        ICT Fair Value Gaps: 3-Kerzen-Imbalance.
        Bearish FVG: candles[i-2].low > candles[i].high  (Widerstandszone)
        Bullish FVG: candles[i-2].high < candles[i].low  (Supportzone)
        Gibt Liste zurück — neueste zuerst.
        """
        fvgs = []
        for i in range(2, len(candles)):
            c0, c2 = candles[i - 2], candles[i]
            if direction == "bearish" and c0["low"] > c2["high"]:
                fvgs.append({"low": c2["high"], "high": c0["low"], "type": "bearish", "idx": i})
            elif direction == "bullish" and c0["high"] < c2["low"]:
                fvgs.append({"low": c0["high"], "high": c2["low"], "type": "bullish", "idx": i})
        return fvgs[::-1]

    def _price_in_fvg(self, price: float, fvg: dict) -> bool:
        return fvg["low"] <= price <= fvg["high"]

    # ── Market Bias ──────────────────────────────────────────────────────

    def _get_bias(self, candles: list, lookback: int = 20) -> str | None:
        """
        Swing-Struktur-Analyse: Lower Highs + Lower Lows = bärisch, umgekehrt = bullisch.
        """
        if len(candles) < lookback:
            return None
        recent = candles[-lookback:]
        mid = lookback // 2
        fh, sh = recent[:mid], recent[mid:]
        fh_hi = max(c["high"] for c in fh)
        sh_hi = max(c["high"] for c in sh)
        fh_lo = min(c["low"] for c in fh)
        sh_lo = min(c["low"] for c in sh)
        if sh_hi < fh_hi and sh_lo < fh_lo:
            return "bearish"
        if sh_hi > fh_hi and sh_lo > fh_lo:
            return "bullish"
        return None

    # ── Setup Detection (Sweep + Displacement) ───────────────────────────

    def _detect_setup(self, candles: list, direction: str, lookback: int = 8) -> bool:
        """
        Erkennt: Liquidity Sweep eines Swings + starkes Displacement in Handelsrichtung.
        Bärisch: Sweep über Swing-High → starker Bärenclose darunter.
        Bullisch: Sweep unter Swing-Low → starker Bullclose darüber.
        """
        if len(candles) < lookback + 3:
            return False
        ref = candles[-(lookback + 3):-3]
        last3 = candles[-3:]
        if direction == "bearish":
            swing_high = max(c["high"] for c in ref)
            swept = any(c["high"] > swing_high for c in last3[:2])
            if not swept:
                return False
            last = last3[-1]
            return last["close"] < swing_high and last["open"] > last["close"]
        elif direction == "bullish":
            swing_low = min(c["low"] for c in ref)
            swept = any(c["low"] < swing_low for c in last3[:2])
            if not swept:
                return False
            last = last3[-1]
            return last["close"] > swing_low and last["close"] > last["open"]
        return False

    # ── Entry Levels ─────────────────────────────────────────────────────

    def _calc_levels(self, m1: list, h1: list, direction: str) -> tuple | None:
        """
        SL, TP1, TP2 aus M1-Manipulation und H1-Struktur berechnen.
        Returns (entry, sl, tp1, tp2) oder None.
        """
        if len(m1) < 20:
            return None
        entry = m1[-1]["close"]
        if direction == "bearish":
            sl = max(c["high"] for c in m1[-5:]) * 1.0003
            tp1 = min(c["low"] for c in m1[-30:-1])
            tp2 = (min(c["low"] for c in h1[-20:]) if h1 else tp1 - abs(entry - tp1))
            if tp2 >= tp1:
                tp2 = tp1 - abs(entry - tp1) * 1.5
            return entry, sl, tp1, tp2
        elif direction == "bullish":
            sl = min(c["low"] for c in m1[-5:]) * 0.9997
            tp1 = max(c["high"] for c in m1[-30:-1])
            tp2 = (max(c["high"] for c in h1[-20:]) if h1 else tp1 + abs(tp1 - entry))
            if tp2 <= tp1:
                tp2 = tp1 + abs(tp1 - entry) * 1.5
            return entry, sl, tp1, tp2
        return None

    # ── Position Management ──────────────────────────────────────────────

    def _manage_positions(self, positions: list, price: float) -> dict:
        """TP2 Close + Break-even nach TP1."""
        if not positions:
            return {"action": "hold"}
        ticket = positions[0].get("ticket")
        if not ticket:
            return {"action": "hold"}

        if self._bias == "bearish":
            if self._entry_tp2 and price <= self._entry_tp2:
                self.log("info", f"TP2 @ {price:.2f} — Position schliessen")
                self._reset_state()
                return {"action": "close", "ticket": ticket}
            if not self._tp1_hit and self._entry_tp1 and price <= self._entry_tp1:
                self._tp1_hit = True
                self._entry_sl = self._entry_price
                self.log("info", f"TP1 @ {price:.2f} — Break-even gesetzt")
            if self._tp1_hit and self._entry_sl and price >= self._entry_sl:
                self.log("info", f"Break-even Exit @ {price:.2f}")
                self._reset_state()
                return {"action": "close", "ticket": ticket}

        elif self._bias == "bullish":
            if self._entry_tp2 and price >= self._entry_tp2:
                self.log("info", f"TP2 @ {price:.2f} — Position schliessen")
                self._reset_state()
                return {"action": "close", "ticket": ticket}
            if not self._tp1_hit and self._entry_tp1 and price >= self._entry_tp1:
                self._tp1_hit = True
                self._entry_sl = self._entry_price
                self.log("info", f"TP1 @ {price:.2f} — Break-even gesetzt")
            if self._tp1_hit and self._entry_sl and price <= self._entry_sl:
                self.log("info", f"Break-even Exit @ {price:.2f}")
                self._reset_state()
                return {"action": "close", "ticket": ticket}

        return {"action": "hold"}

    def _reset_state(self) -> None:
        self._bias = None
        self._htf = None
        self._active_fvg = None
        self._entry_price = None
        self._entry_sl = None
        self._entry_tp1 = None
        self._entry_tp2 = None
        self._tp1_hit = False

    # ── Main Strategy ────────────────────────────────────────────────────

    def on_tick(self, candles: list, positions: list) -> dict:
        """
        ICT FVG Scalping — 3-Stufen Multi-Timeframe Logik:
        Stufe 1: H1/H4 FVG + Bias
        Stufe 2: M5/M15 Sweep + Displacement
        Stufe 3: M1 Entry-Signal (Sweep + BOS)
        """
        if not self._in_session():
            return {"action": "hold"}

        if not self._bridge:
            return {"action": "hold"}

        cfg = self._config.get("strategy", {})
        symbol = cfg.get("symbol", "NDAQ.OQ")
        lots = float(cfg.get("lots", 0.01))
        min_crv = float(cfg.get("min_crv", 2.0))

        if not candles:
            return {"action": "hold"}

        current_price = candles[-1]["close"]

        # Offene Positionen zuerst verwalten
        if positions:
            return self._manage_positions(positions, current_price)

        if self._tp1_hit:
            self._reset_state()

        # ── Stufe 1: H1/H4 FVG + Bias ────────────────────────────────
        h1 = self._bridge.get_candles(symbol, "H1", int(cfg.get("h1_candles", 50)))
        if not h1:
            self.log("warn", "Keine H1-Kerzen — Bridge erreichbar?")
            return {"action": "hold"}

        bias = self._get_bias(h1)
        if not bias:
            return {"action": "hold"}

        active_fvg: dict | None = None
        htf: str | None = None

        h1_fvgs = self._find_fvgs(h1, bias)
        if h1_fvgs and self._price_in_fvg(current_price, h1_fvgs[0]):
            active_fvg, htf = h1_fvgs[0], "H1"

        if not active_fvg:
            h4 = self._bridge.get_candles(symbol, "H4", int(cfg.get("h4_candles", 30)))
            if h4:
                h4_fvgs = self._find_fvgs(h4, bias)
                if h4_fvgs and self._price_in_fvg(current_price, h4_fvgs[0]):
                    active_fvg, htf = h4_fvgs[0], "H4"

        if not active_fvg:
            return {"action": "hold"}

        self.log("info", f"{htf} {bias} FVG [{active_fvg['low']:.2f}–{active_fvg['high']:.2f}]")

        # ── Stufe 2: M5/M15 Sweep + Displacement ─────────────────────
        conf_tf = "M5" if htf == "H1" else "M15"
        conf_count = int(cfg.get("m5_candles", 100)) if conf_tf == "M5" else int(cfg.get("m15_candles", 60))
        conf = self._bridge.get_candles(symbol, conf_tf, conf_count)

        if not conf or not self._detect_setup(conf, bias):
            return {"action": "hold"}

        self.log("info", f"{conf_tf} Setup bestätigt (Sweep + Displacement)")

        # ── Stufe 3: M1 Entry-Signal ──────────────────────────────────
        if not self._detect_setup(candles, bias, lookback=5):
            return {"action": "hold"}

        levels = self._calc_levels(candles, h1, bias)
        if not levels:
            return {"action": "hold"}

        entry, sl, tp1, tp2 = levels
        risk = abs(entry - sl)
        if risk <= 0:
            return {"action": "hold"}

        crv = abs(entry - tp2) / risk
        if crv < min_crv:
            self.log("info", f"CRV {crv:.2f} < {min_crv} — Entry übersprungen")
            return {"action": "hold"}

        self._bias = bias
        self._htf = htf
        self._active_fvg = active_fvg
        self._entry_price = entry
        self._entry_sl = sl
        self._entry_tp1 = tp1
        self._entry_tp2 = tp2
        self._tp1_hit = False

        action = "sell" if bias == "bearish" else "buy"
        self.log(
            "info",
            f"ENTRY {action.upper()} {symbol}",
            f"E={entry:.2f} SL={sl:.2f} TP1={tp1:.2f} TP2={tp2:.2f} CRV={crv:.1f}x",
        )
        return {"action": action, "lots": lots, "sl": round(sl, 2), "tp": round(tp2, 2)}
