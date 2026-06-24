"""
Terminal-UI fuer AlphaTrack Trading Bots.
Layout:
  - Grüner Header (ID, Name, IP:Port, Latenz, Uptime, Status)
  - Status-Zeile (Bridge-Verbindung | Symbol/TF | Offene Positionen)
  - Hauptbereich: Log (links, 60%) | Strategie-Panel (rechts, 40%)
    Das Strategie-Panel zeigt: Live-Preis, Letzter Entscheid, alle Parameter aus
    get_parameters(), offene Ticket-Nummern.
Verwendet 'rich' — identischer Stil wie bridge/display.py, grüner Header.
"""

import time
import threading
from collections import deque
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.live import Live
from rich.layout import Layout
from rich.rule import Rule
from rich import box


MAX_LOG_LINES = 200
_REFRESH_RATE = 2  # Hz


class BotDisplay:
    """Grüner Header + Status-Zeile + split Log/Strategie-Panel."""

    def __init__(self, bot_name: str):
        self._bot_name = bot_name
        self._start_time = time.time()
        self._lock = threading.Lock()
        self._log_lines: deque[tuple[str, str, str]] = deque(maxlen=MAX_LOG_LINES)
        self._console = Console()
        self._live: Live | None = None
        self._bot = None  # Referenz auf die Bot-Instanz (via attach())

        # Cache-Felder fuer die Bridge-Erreichbarkeit (5s-Drossel)
        self._bridge_ok: bool = False
        self._bridge_check_ts: float = 0.0

        # Live-Preis-Ticker (Hintergrund-Thread, alle 5s)
        self._live_price: float | None = None
        self._prev_price: float | None = None
        self._price_fetch_active: bool = False

    # ── Oeffentliche Methoden ───────────────────────────────────────────

    def attach(self, bot) -> None:
        """Bindet den Bot an das Display. Muss vor start() aufgerufen werden."""
        self._bot = bot

    def log(self, level: str, tag: str, message: str) -> None:
        """Fuegt eine Bot-Log-Zeile hinzu. level: 'info'|'warn'|'error'|'ok'"""
        ts = datetime.now().strftime("%d.%m %H:%M:%S")
        with self._lock:
            self._log_lines.append((ts, f"[{tag}]", message))
        if self._live is None:
            color = {"info": "cyan", "warn": "yellow", "error": "red", "ok": "green"}.get(level, "white")
            self._console.print(f"[dim]{ts}[/dim] [{color}][{tag}][/{color}] {message}")

    # ── Bridge-Erreichbarkeit (gecacht, 5s-Drossel) ─────────────────────

    def _bridge_connected(self) -> bool:
        if self._bot is None:
            return False
        bridge = getattr(self._bot, "_bridge", None)
        if bridge is None:
            return False
        now = time.time()
        if now - self._bridge_check_ts >= 5.0:
            try:
                self._bridge_ok = bridge.is_connected()
            except Exception:
                self._bridge_ok = False
            self._bridge_check_ts = now
        return self._bridge_ok

    # ── Live-Preis (Hintergrund-Thread, alle 5s) ─────────────────────────

    def _price_fetch_loop(self) -> None:
        """Holt alle 5s den aktuellen M1-Close-Kurs vom gehandelten Symbol."""
        while self._price_fetch_active:
            try:
                bot = self._bot
                bridge = getattr(bot, "_bridge", None) if bot else None
                if bridge:
                    config = getattr(bot, "_config", {}) or {}
                    symbol = config.get("strategy", {}).get("symbol", "")
                    if symbol:
                        candles = bridge.get_candles(symbol, "M1", 1)
                        if candles:
                            new_price = float(candles[-1].get("close", 0)) or None
                            if new_price:
                                with self._lock:
                                    if new_price != self._live_price:
                                        self._prev_price = self._live_price
                                        self._live_price = new_price
            except Exception:
                pass
            time.sleep(5.0)

    # ── Render-Methoden ─────────────────────────────────────────────────

    def _render_identity_row(self) -> Table:
        """Header-Zeile: ID | Name | IP:Port | Latenz"""
        table = Table(box=box.SIMPLE_HEAD, show_header=False, padding=(0, 2), expand=True)
        table.add_column(justify="left", ratio=2)
        table.add_column(justify="left", ratio=2)
        table.add_column(justify="left", ratio=2)
        table.add_column(justify="left", ratio=2)

        bot = self._bot

        id_text = Text()
        id_text.append("ID  ", style="dim")
        bot_id = getattr(bot, "bot_id", None) if bot else None
        id_text.append(bot_id or "—", style="bold cyan")

        name_text = Text()
        name_text.append("Name  ", style="dim")
        name_text.append(self._bot_name, style="bold white")

        addr_text = Text()
        addr_text.append("IP:Port  ", style="dim")
        if bot:
            ip = getattr(bot, "ip", None)
            port = getattr(bot, "port", None)
            addr = f"{ip}:{port}" if ip and port else "—"
        else:
            addr = "—"
        addr_text.append(addr, style="white")

        lat_text = Text()
        lat_text.append("Latenz  ", style="dim")
        lat_ms = getattr(bot, "latency_ms", None) if bot else None
        lat_str = f"{lat_ms}ms" if lat_ms is not None else "—"
        lat_text.append(lat_str, style="white")

        table.add_row(id_text, name_text, addr_text, lat_text)
        return table

    def _render_status_row(self) -> Table:
        """Status-Zeile: Bridge-Verbindung | Symbol / Timeframe | Offene Positionen"""
        table = Table(box=box.SIMPLE_HEAD, show_header=False, padding=(0, 2), expand=True)
        table.add_column(justify="center", ratio=1)
        table.add_column(justify="center", ratio=1)
        table.add_column(justify="center", ratio=1)

        bot = self._bot

        # --- Spalte 1: Bridge-Verbindungsstatus ---
        ok = self._bridge_connected()
        lat_ms = getattr(bot, "latency_ms", None) if bot else None
        bridge_text = Text()
        if ok:
            bridge_text.append("● ", style="bold green")
            lat_suffix = f" ({lat_ms}ms)" if lat_ms is not None else ""
            bridge_text.append(f"Bridge{lat_suffix}\n", style="green")
            bridge_text.append("Verbunden", style="dim")
        else:
            bridge_text.append("● ", style="bold red")
            bridge_text.append("Bridge\n", style="red")
            bridge_text.append("Getrennt", style="dim")

        # --- Spalte 2: Symbol / Timeframe ---
        config = getattr(bot, "_config", None) if bot else None
        strat = (config or {}).get("strategy", {})
        symbol = strat.get("symbol", "—")
        timeframe = strat.get("timeframe", "—")

        sym_text = Text()
        sym_text.append(f"{symbol}\n", style="bold white")
        sym_text.append(timeframe, style="dim")

        # --- Spalte 3: Offene Positionen ---
        tickets_raw = getattr(bot, "_my_tickets", None) if bot else None
        tickets = sorted(tickets_raw) if tickets_raw else []
        count = len(tickets)
        pos_text = Text()
        pos_text.append(str(count) + "\n", style="bold yellow" if count > 0 else "bold white")
        pos_text.append("Positionen", style="dim")

        table.add_row(bridge_text, sym_text, pos_text)
        return table

    def _render_log_panel(self, height: int) -> Panel:
        """Scrollendes Log-Panel."""
        with self._lock:
            lines = list(self._log_lines)

        visible = lines[-(height - 2):] if len(lines) > height - 2 else lines
        text = Text()
        for ts, tag, msg in visible:
            text.append(ts, style="dim")
            text.append("  ")
            tag_color = "cyan"
            if "WARN" in tag or "FEHLER" in tag:
                tag_color = "yellow"
            elif "ERR" in tag:
                tag_color = "red"
            elif "SYNC" in tag or "OK" in tag:
                tag_color = "green"
            elif "CMD" in tag:
                tag_color = "magenta"
            text.append(f"{tag:<8}", style=tag_color)
            text.append(f"  {msg}\n")

        return Panel(
            text,
            title="[dim]Bot-Log[/dim]",
            border_style="dim",
            padding=(0, 1),
        )

    def _render_strategy_panel(self) -> Panel:
        """Rechtes Panel: Live-Preis + Letzter Entscheid + alle Parameter + Tickets."""
        bot = self._bot
        text = Text()

        # ── Live-Preis ───────────────────────────────────────────────
        with self._lock:
            price = self._live_price
            prev = self._prev_price

        config = getattr(bot, "_config", None) if bot else None
        strat = (config or {}).get("strategy", {})
        symbol = strat.get("symbol", "—")

        text.append("Live-Preis\n", style="bold dim")
        text.append(f"{symbol}  ", style="dim")
        if price is not None:
            if price >= 1000:
                price_str = f"{price:.2f}"
            elif price >= 10:
                price_str = f"{price:.3f}"
            else:
                price_str = f"{price:.5f}"
            text.append(price_str, style="bold white")
            if prev is not None and price != prev:
                if price > prev:
                    text.append("  ▲\n", style="bold green")
                else:
                    text.append("  ▼\n", style="bold red")
            else:
                text.append("\n")
        else:
            text.append("—\n", style="dim")

        text.append("\n")

        # ── Letzter Entscheid ────────────────────────────────────────
        text.append("Letzter Entscheid\n", style="bold dim")
        reason = getattr(bot, "_last_reason", "") if bot else ""
        if reason:
            # Lange Begründungen umbrechen (max 2 Zeilen lesbar)
            text.append(reason + "\n", style="white")
        else:
            text.append("—\n", style="dim")

        text.append("\n")

        # ── Parameter ───────────────────────────────────────────────
        text.append("Parameter\n", style="bold dim")
        params = None
        if bot and callable(getattr(bot, "get_parameters", None)):
            try:
                params = bot.get_parameters()
            except Exception:
                pass

        if params:
            for key, value in params.items():
                text.append(f"{key:<22}", style="dim")
                text.append(f"{value}\n", style="white")
        else:
            # Fallback: Rohe config-Werte
            config = getattr(bot, "_config", None) if bot else None
            strat = (config or {}).get("strategy", {}) if config else {}
            if strat:
                for key, value in strat.items():
                    text.append(f"{key:<22}", style="dim")
                    text.append(f"{value}\n", style="white")
            else:
                text.append("(keine Parameter)\n", style="dim")

        text.append("\n")

        # ── Offene Positionen ────────────────────────────────────────
        text.append("Offene Positionen\n", style="bold dim")
        tickets_raw = getattr(bot, "_my_tickets", None) if bot else None
        tickets = sorted(tickets_raw) if tickets_raw else []
        if tickets:
            for t in tickets:
                text.append(f"#{t}\n", style="bold white")
        else:
            text.append("(keine)\n", style="dim")

        return Panel(
            text,
            title="[dim]Strategie[/dim]",
            border_style="green",
            padding=(0, 1),
        )

    def _build_layout(self) -> Layout:
        layout = Layout()
        layout.split_column(
            Layout(name="id_row", size=3),
            Layout(name="status_row", size=4),
            Layout(name="main"),
        )
        layout["main"].split_row(
            Layout(name="log", ratio=3),
            Layout(name="strategy", ratio=2),
        )
        return layout

    # ── Start / Stop ─────────────────────────────────────────────────────

    def start(self) -> None:
        """Startet den Live-Render-Loop und den Preis-Fetch-Thread."""
        layout = self._build_layout()

        self._live = Live(
            layout,
            console=self._console,
            refresh_per_second=_REFRESH_RATE,
            screen=False,
            transient=False,
        )
        self._live.start()

        self._price_fetch_active = True
        pt = threading.Thread(target=self._price_fetch_loop, daemon=True, name="BotPriceFetcher")
        pt.start()

        def _render_loop():
            while self._live and self._live.is_started:
                try:
                    terminal_height = self._console.height or 40
                    panel_height = max(5, terminal_height - 9)
                    state = getattr(self._bot, "_state", "—") if self._bot else "—"

                    layout["id_row"].update(
                        Panel(
                            self._render_identity_row(),
                            title=f"[bold green] {self._bot_name} [/bold green] [dim]Bot[/dim]",
                            subtitle=f"[dim]Uptime: {self._uptime_str()} | Status: {state}[/dim]",
                            border_style="green",
                            padding=(0, 1),
                        )
                    )
                    layout["status_row"].update(
                        Panel(
                            self._render_status_row(),
                            border_style="dim",
                            padding=(0, 1),
                        )
                    )
                    layout["log"].update(self._render_log_panel(panel_height))
                    layout["strategy"].update(self._render_strategy_panel())
                    self._live.refresh()
                except Exception:
                    pass
                time.sleep(1.0 / _REFRESH_RATE)

        t = threading.Thread(target=_render_loop, daemon=True, name="BotDisplayRenderer")
        t.start()

    def stop(self) -> None:
        self._price_fetch_active = False
        if self._live:
            self._live.stop()
            self._live = None

    def _uptime_str(self) -> str:
        sec = int(time.time() - self._start_time)
        h, rem = divmod(sec, 3600)
        m, s = divmod(rem, 60)
        return f"{h}h {m:02d}m {s:02d}s" if h else f"{m}m {s:02d}s"
