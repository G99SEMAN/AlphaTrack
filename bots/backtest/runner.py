"""
AlphaTrack Generischer Backtest-Runner

Läuft auf jedem Computer im LAN. Daten kommen ausschließlich über die Bridge aus MetaTrader.

Usage:
    python backtest/runner.py --bot scalpingv1 --from 2026-01-01 --to 2026-06-14
    python backtest/runner.py --bot scalpingv1 --from 2026-01-01 --to 2026-06-14 --bridge http://192.168.178.37:8765
"""
import argparse
import importlib.util
import json
import os
import sys
from datetime import datetime, timezone

import requests

BOTS_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, BOTS_DIR)

from scaffold.base_bot import BaseBot


def _load_strategy_class(bot_name: str):
    """Lädt die BaseBot-Subklasse aus bots/<bot_name>/strategy.py."""
    path = os.path.join(BOTS_DIR, bot_name, "strategy.py")
    if not os.path.exists(path):
        print(f"[FEHLER] strategy.py nicht gefunden: {path}")
        sys.exit(1)
    spec = importlib.util.spec_from_file_location("strategy", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for name in dir(mod):
        obj = getattr(mod, name)
        if isinstance(obj, type) and issubclass(obj, BaseBot) and obj is not BaseBot:
            return obj
    print(f"[FEHLER] Keine BaseBot-Subklasse in {path} gefunden")
    sys.exit(1)


def _fetch_candles(bridge_url: str, api_key: str, symbol: str, interval: str,
                   from_date: str, to_date: str) -> list:
    print(f"[Bridge] Lade Kerzen: {symbol} {interval} | {from_date} → {to_date} ...")
    try:
        resp = requests.get(
            f"{bridge_url}/historical_candles",
            params={"symbol": symbol, "interval": interval,
                    "from_date": from_date, "to_date": to_date},
            headers={"X-Bot-Api-Key": api_key},
            timeout=60,
        )
    except requests.ConnectionError:
        print(f"[FEHLER] Bridge nicht erreichbar: {bridge_url}")
        sys.exit(1)
    if not resp.ok:
        print(f"[FEHLER] Bridge {resp.status_code}: {resp.text[:200]}")
        sys.exit(1)
    candles = resp.json()["candles"]
    print(f"[Bridge] {len(candles)} Kerzen geladen")
    return candles


def _pnl(action: str, entry: float, exit_price: float, lots: float) -> float:
    """P&L in USD für 5-stellige Forex-Preise (1 lot = 100.000)."""
    if action == "buy":
        return round((exit_price - entry) * lots * 100000, 2)
    return round((entry - exit_price) * lots * 100000, 2)


def _check_sl_tp(pos: dict, candle: dict):
    """Prüft SL/TP gegen Kerze. Gibt (hit, grund, exit_price) zurück."""
    high = float(candle["high"])
    low = float(candle["low"])
    sl, tp = pos.get("sl"), pos.get("tp")

    if pos["action"] == "buy":
        if sl and low <= sl:
            return True, "SL", sl
        if tp and high >= tp:
            return True, "TP", tp
    else:
        if sl and high >= sl:
            return True, "SL", sl
        if tp and low <= tp:
            return True, "TP", tp
    return False, "", 0.0


def _print_report(trades: list, config: dict, from_date: str, to_date: str):
    strat = config.get("strategy", {})
    print()
    print("=" * 62)
    print(f"  BACKTEST: {config.get('bot_name', '?')}")
    print(f"  Symbol   : {strat.get('symbol')} | TF: {strat.get('timeframe')}")
    print(f"  Zeitraum : {from_date} → {to_date}")
    print("=" * 62)

    if not trades:
        print("  Keine Trades generiert.")
        print("=" * 62)
        return

    total = len(trades)
    wins = [t for t in trades if t["pnl"] > 0]
    losses = [t for t in trades if t["pnl"] <= 0]
    total_pnl = round(sum(t["pnl"] for t in trades), 2)
    win_rate = round(len(wins) / total * 100, 1) if total else 0
    avg_win = round(sum(t["pnl"] for t in wins) / len(wins), 2) if wins else 0
    avg_loss = round(sum(t["pnl"] for t in losses) / len(losses), 2) if losses else 0
    gross_profit = sum(t["pnl"] for t in wins)
    gross_loss = abs(sum(t["pnl"] for t in losses))
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else float("inf")

    equity, peak, max_dd = 0.0, 0.0, 0.0
    for t in trades:
        equity += t["pnl"]
        if equity > peak:
            peak = equity
        dd = peak - equity
        if dd > max_dd:
            max_dd = dd

    print(f"  Trades gesamt    : {total}")
    print(f"  Gewinner / Verlierer : {len(wins)} / {len(losses)}")
    print(f"  Win-Rate         : {win_rate}%")
    print(f"  Gesamt-P&L       : ${total_pnl:+.2f}")
    print(f"  Ø Win / Ø Loss   : ${avg_win:+.2f} / ${avg_loss:+.2f}")
    print(f"  Profit-Faktor    : {profit_factor}")
    print(f"  Max. Drawdown    : ${max_dd:.2f}")
    print()
    print(f"  {'#':<3} {'Eröffnet':<18} {'Dir':<5} {'Entry':>8} {'Exit':>8} {'P&L':>8}  {'Typ'}")
    print("  " + "-" * 57)
    for i, t in enumerate(trades, 1):
        print(
            f"  {i:<3} {t['open_time'][:17]:<18} {t['action'].upper():<5} "
            f"{t['entry']:>8.5f} {t['exit']:>8.5f} ${t['pnl']:>+7.2f}  {t['exit_type']}"
        )
    print("=" * 62)


def main():
    parser = argparse.ArgumentParser(description="AlphaTrack Backtest Runner")
    parser.add_argument("--bot", required=True, help="Bot-Name (Ordner unter bots/)")
    parser.add_argument("--from", dest="from_date", required=True, help="Start-Datum YYYY-MM-DD")
    parser.add_argument("--to", dest="to_date", required=True, help="End-Datum YYYY-MM-DD")
    parser.add_argument("--bridge", default=None, help="Bridge-URL (Standard: aus config.json)")
    args = parser.parse_args()

    config_path = os.path.join(BOTS_DIR, args.bot, "config.json")
    if not os.path.exists(config_path):
        print(f"[FEHLER] config.json nicht gefunden: {config_path}")
        sys.exit(1)
    with open(config_path, encoding="utf-8") as f:
        config = json.load(f)

    bridge_url = args.bridge or config["bridge_url"]
    api_key = config["api_key"]
    strat = config.get("strategy", {})
    symbol = strat["symbol"]
    timeframe = strat["timeframe"]
    candles_count = int(strat.get("candles_count", 50))
    max_positions = int(strat.get("max_positions", 1))
    default_lots = float(strat.get("lots", 0.01))

    strategy_class = _load_strategy_class(args.bot)

    # Aktuell simulierte Kerzenzeit — wird pro Schritt gesetzt
    current_time = [datetime.now(timezone.utc)]

    class BacktestBot(strategy_class):
        def _now(self):
            return current_time[0]

        def log(self, level, message, details=None):
            pass  # Logs im Backtest unterdrückt — Report zeigt alle Trades

    # Instanz ohne Bridge-Verbindung
    bot = object.__new__(BacktestBot)
    bot.bot_id = config["bot_id"]
    bot.name = config["bot_name"]
    bot.port = config.get("bot_port", 0)
    bot.ip = "127.0.0.1"
    bot.latency_ms = None
    bot._config = config
    bot._ws_client = None
    bot._bridge = None
    bot._display = None
    bot._log = None
    bot._running = False
    bot._state = "running"
    bot._open_positions = 0
    bot._restart_requested = False
    bot._my_tickets = set()
    bot._ticket_added_at = {}
    bot._be_tracker = {}

    all_candles = _fetch_candles(bridge_url, api_key, symbol, timeframe, args.from_date, args.to_date)

    if len(all_candles) < candles_count + 1:
        print(f"[FEHLER] Zu wenig Kerzen: {len(all_candles)} (mind. {candles_count + 1} benötigt)")
        sys.exit(1)

    print(f"[Backtest] Warmup: {candles_count} Kerzen | "
          f"Test ab: {all_candles[candles_count]['datetime']}")

    sim_positions = []
    trades = []

    for i in range(candles_count, len(all_candles) - 1):
        window = all_candles[i - candles_count:i]
        next_candle = all_candles[i]

        # Zeit des aktuellen (letzten) Fenster-Balkens für Session-Filter setzen
        ts = window[-1].get("ts")
        if ts:
            current_time[0] = datetime.fromtimestamp(ts, tz=timezone.utc)

        # SL/TP bestehender Positionen mit nächster Kerze prüfen
        still_open = []
        for pos in sim_positions:
            hit, reason, exit_price = _check_sl_tp(pos, next_candle)
            if hit:
                trades.append({
                    **pos,
                    "exit": exit_price,
                    "pnl": _pnl(pos["action"], pos["entry"], exit_price, pos["lots"]),
                    "exit_type": reason,
                    "close_time": next_candle["datetime"],
                })
            else:
                still_open.append(pos)
        sim_positions = still_open

        # Strategie-Signal
        signal = bot.on_tick(window, sim_positions)
        action = signal.get("action", "hold")

        if action in ("buy", "sell") and len(sim_positions) < max_positions:
            entry_price = float(window[-1]["close"])
            sim_positions.append({
                "action": action,
                "entry": entry_price,
                "lots": float(signal.get("lots", default_lots)),
                "sl": signal.get("sl"),
                "tp": signal.get("tp"),
                "open_time": window[-1]["datetime"],
            })

    # Noch offene Positionen am Backtest-Ende zum letzten Close schließen
    if sim_positions:
        last_close = float(all_candles[-1]["close"])
        for pos in sim_positions:
            trades.append({
                **pos,
                "exit": last_close,
                "pnl": _pnl(pos["action"], pos["entry"], last_close, pos["lots"]),
                "exit_type": "END",
                "close_time": all_candles[-1]["datetime"],
            })

    _print_report(trades, config, args.from_date, args.to_date)


if __name__ == "__main__":
    main()
