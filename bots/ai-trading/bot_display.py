"""
Terminal-UI fuer den AI-Trading Bot.
Zeigt statischen Header (ID, Name, IP:Port, Latenz, Status-Felder, offene Trades)
und scrollendes Bot-Log darunter.
Schreibt ausschliesslich bot-relevante Informationen — keine Bridge-internen Daten.
Verwendet 'rich' fuer die Darstellung.
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
from rich import box


MAX_LOG_LINES = 200
_REFRESH_RATE = 2  # Hz


class BotDisplay:
    """Statischer Header + scrollendes Log fuer das Bot-Terminal."""

    def __init__(self, bot_name: str = "AI-Trading Bot"):
        self._bot_name = bot_name
        self._start_time = time.time()
        self._lock = threading.Lock()
        self._log_lines: deque[tuple[str, str, str]] = deque(maxlen=MAX_LOG_LINES)
        self._console = Console()
        self._live: Live | None = None

        # Identitaets-Felder (statischer Header, Spec 3.1 Bot-Terminal)
        self._bot_id: str = ""
        self._bot_ip: str = ""
        self._bot_port: int = 0
        self._latency_ms: float | None = None

        # Verbindungs-Status
        self._at_ok: bool = False
        self._bridge_ok: bool = False
        self._at_ping_ms: int | None = None
        self._bridge_ping_ms: int | None = None
        self._bot_state: str = "starting"

        # Bot-spezifische Daten
        self._open_trades: int = 0

    # ── Oeffentliche Update-Methoden ─────────────────────────────────────

    def set_identity(
        self,
        bot_id: str,
        bot_ip: str,
        bot_port: int,
        latency_ms: float | None = None,
    ) -> None:
        """Setzt die statischen Identitaets-Felder des Bots (nach Registrierung)."""
        with self._lock:
            self._bot_id = bot_id
            self._bot_ip = bot_ip
            self._bot_port = bot_port
            if latency_ms is not None:
                self._latency_ms = latency_ms

    def update_status(
        self,
        at_ok: bool,
        bridge_ok: bool,
        bot_state: str,
        open_trades: int,
        at_ping_ms: int | None = None,
        bridge_ping_ms: int | None = None,
    ) -> None:
        with self._lock:
            self._at_ok = at_ok
            self._bridge_ok = bridge_ok
            self._bot_state = bot_state
            self._open_trades = open_trades
            if at_ping_ms is not None:
                self._at_ping_ms = at_ping_ms
            if bridge_ping_ms is not None:
                self._bridge_ping_ms = bridge_ping_ms

    def log(self, level: str, tag: str, message: str) -> None:
        """Fuegt eine Bot-Log-Zeile hinzu. Nur bot-relevante Ereignisse."""
        ts = datetime.now().strftime("%H:%M:%S")
        with self._lock:
            self._log_lines.append((ts, f"[{tag}]", message))
        if self._live is None:
            color = {"info": "cyan", "warn": "yellow", "error": "red", "ok": "green"}.get(level, "white")
            self._console.print(f"[dim]{ts}[/dim] [{color}][{tag}][/{color}] {message}")

    # ── Render-Methoden ─────────────────────────────────────────────────

    def _render_identity_row(self) -> Table:
        """Erste Header-Zeile: ID | Name | IP:Port | Latenz"""
        table = Table(box=box.SIMPLE_HEAD, show_header=False, padding=(0, 2), expand=True)
        table.add_column(justify="left", ratio=2)
        table.add_column(justify="left", ratio=2)
        table.add_column(justify="left", ratio=2)
        table.add_column(justify="left", ratio=2)

        id_text = Text()
        id_text.append("ID  ", style="dim")
        id_text.append(self._bot_id or "—", style="bold cyan")

        name_text = Text()
        name_text.append("Name  ", style="dim")
        name_text.append(self._bot_name, style="bold white")

        addr_text = Text()
        addr_text.append("IP:Port  ", style="dim")
        addr = f"{self._bot_ip}:{self._bot_port}" if self._bot_ip else "—"
        addr_text.append(addr, style="white")

        lat_text = Text()
        lat_text.append("Latenz  ", style="dim")
        lat_str = f"{self._latency_ms}ms" if self._latency_ms is not None else "—"
        lat_text.append(lat_str, style="white")

        table.add_row(id_text, name_text, addr_text, lat_text)
        return table

    def _render_status_row(self) -> Table:
        """Zweite Header-Zeile: AlphaTrack-Status | Bridge-Status | Offene Trades"""
        table = Table(box=box.SIMPLE_HEAD, show_header=False, padding=(0, 2), expand=True)
        table.add_column(justify="center", ratio=1)
        table.add_column(justify="center", ratio=1)
        table.add_column(justify="center", ratio=1)

        # AlphaTrack-Verbindungsstatus
        ping_str = f" ({self._at_ping_ms}ms)" if self._at_ping_ms is not None else ""
        at_text = Text()
        if self._at_ok:
            at_text.append("● ", style="bold green")
            at_text.append(f"AlphaTrack{ping_str}\n", style="green")
            at_text.append("Verbunden", style="dim")
        else:
            at_text.append("● ", style="bold red")
            at_text.append("AlphaTrack\n", style="red")
            at_text.append("Nicht erreichbar", style="dim")

        # Bridge-Verbindungsstatus
        bridge_ping_str = f" ({self._bridge_ping_ms}ms)" if self._bridge_ping_ms is not None else ""
        bridge_text = Text()
        if self._bridge_ok:
            bridge_text.append("● ", style="bold green")
            bridge_text.append(f"Bridge{bridge_ping_str}\n", style="green")
            bridge_text.append("Verbunden", style="dim")
        else:
            bridge_text.append("● ", style="bold red")
            bridge_text.append("Bridge\n", style="red")
            bridge_text.append("Nicht erreichbar", style="dim")

        # Offene Trades dieses Bots
        state_colors = {
            "running": "bold green",
            "paused": "yellow",
            "stopped": "red",
            "error": "bold red",
            "starting": "dim",
        }
        state_style = state_colors.get(self._bot_state, "white")
        trades_text = Text()
        trades_text.append(f"{self._open_trades} offene Trades\n", style="bold white")
        trades_text.append(f"Status: {self._bot_state}", style=state_style)

        table.add_row(at_text, bridge_text, trades_text)
        return table

    def _render_log_panel(self, height: int) -> Panel:
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
            elif "OK" in tag:
                tag_color = "green"
            text.append(f"{tag:<10}", style=tag_color)
            text.append(f"  {msg}\n")

        return Panel(
            text,
            title="[dim]Bot-Log[/dim]",
            border_style="dim",
            padding=(0, 1),
        )

    def _build_layout(self) -> Layout:
        layout = Layout()
        layout.split_column(
            Layout(name="id_row", size=3),
            Layout(name="status_row", size=4),
            Layout(name="log"),
        )
        return layout

    # ── Start / Stop ─────────────────────────────────────────────────────

    def start(self) -> None:
        """Startet den Live-Render-Loop in einem Hintergrund-Thread."""
        layout = self._build_layout()

        self._live = Live(
            layout,
            console=self._console,
            refresh_per_second=_REFRESH_RATE,
            screen=False,
            transient=False,
        )
        self._live.start()

        def _render_loop():
            while self._live and self._live.is_started:
                try:
                    terminal_height = self._console.height or 40
                    log_height = max(5, terminal_height - 9)

                    layout["id_row"].update(
                        Panel(
                            self._render_identity_row(),
                            title=f"[bold green] {self._bot_name} [/bold green] [dim]Bot[/dim]",
                            subtitle=f"[dim]Uptime: {self._uptime_str()} | Status: {self._bot_state}[/dim]",
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
                    layout["log"].update(self._render_log_panel(log_height))
                    self._live.refresh()
                except Exception:
                    pass
                time.sleep(1.0 / _REFRESH_RATE)

        t = threading.Thread(target=_render_loop, daemon=True, name="BotDisplayRenderer")
        t.start()

    def stop(self) -> None:
        if self._live:
            self._live.stop()
            self._live = None

    def _uptime_str(self) -> str:
        sec = int(time.time() - self._start_time)
        h, rem = divmod(sec, 3600)
        m, s = divmod(rem, 60)
        return f"{h}h {m:02d}m {s:02d}s" if h else f"{m}m {s:02d}s"
