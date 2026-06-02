"""
Terminal-UI für den AlphaTrack Bot.
Verwendet 'rich' für eine Status-Leiste oben + scrollendes Log darunter.
pip install rich
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
from rich.columns import Columns
from rich import box


MAX_LOG_LINES = 200
_REFRESH_RATE = 2  # Hz


class BridgeDisplay:
    def __init__(self, bridge_name: str = "AlphaTrack Bot"):
        self._bridge_name = bridge_name
        self._start_time = time.time()
        self._lock = threading.Lock()
        self._log_lines: deque[tuple[str, str, str]] = deque(maxlen=MAX_LOG_LINES)
        self._console = Console()
        self._live: Live | None = None

        # Status-Felder
        self._mt5_ok = False
        self._at_ok = False
        self._at_ping_ms: int | None = None
        self._balance: float | None = None
        self._currency: str = "USD"
        self._open_positions: int = 0
        self._bridge_state: str = "starting"

    # ── Öffentliche Update-Methoden ─────────────────────────────────────

    def update_status(
        self,
        mt5_ok: bool,
        at_ok: bool,
        at_ping_ms: int | None,
        balance: float | None,
        currency: str,
        open_positions: int,
        bridge_state: str,
    ) -> None:
        with self._lock:
            self._mt5_ok = mt5_ok
            self._at_ok = at_ok
            self._at_ping_ms = at_ping_ms
            self._balance = balance
            self._currency = currency
            self._open_positions = open_positions
            self._bridge_state = bridge_state

    def log(self, level: str, tag: str, message: str) -> None:
        """Fügt eine Log-Zeile hinzu. level: 'info'|'warn'|'error'|'ok'"""
        ts = datetime.now().strftime("%H:%M:%S")
        with self._lock:
            self._log_lines.append((ts, f"[{tag}]", message))
        # Wenn Live noch nicht läuft, direkt ausgeben
        if self._live is None:
            color = {"info": "cyan", "warn": "yellow", "error": "red", "ok": "green"}.get(level, "white")
            self._console.print(f"[dim]{ts}[/dim] [{color}][{tag}][/{color}] {message}")

    # ── Render-Methoden ─────────────────────────────────────────────────

    def _render_status_bar(self) -> Table:
        uptime_sec = int(time.time() - self._start_time)
        h, rem = divmod(uptime_sec, 3600)
        m, s = divmod(rem, 60)
        uptime_str = f"{h}h {m:02d}m {s:02d}s" if h else f"{m}m {s:02d}s"

        table = Table(
            box=box.SIMPLE_HEAD,
            show_header=False,
            padding=(0, 2),
            expand=True,
            border_style="dim blue",
        )
        table.add_column(justify="center", ratio=1)
        table.add_column(justify="center", ratio=1)
        table.add_column(justify="center", ratio=1)
        table.add_column(justify="center", ratio=1)

        # MT5
        if self._mt5_ok:
            mt5_text = Text()
            mt5_text.append("● ", style="bold green")
            mt5_text.append("Verbunden\n", style="green")
            mt5_text.append("MetaTrader 5", style="dim")
        else:
            mt5_text = Text()
            mt5_text.append("● ", style="bold red")
            mt5_text.append("Getrennt\n", style="red")
            mt5_text.append("MetaTrader 5", style="dim")

        # AlphaTrack
        ping_str = f"  {self._at_ping_ms}ms" if self._at_ping_ms is not None else ""
        if self._at_ok:
            at_text = Text()
            at_text.append("● ", style="bold green")
            at_text.append(f"Verbunden{ping_str}\n", style="green")
            at_text.append("AlphaTrack", style="dim")
        else:
            at_text = Text()
            at_text.append("● ", style="bold red")
            at_text.append("Nicht erreichbar\n", style="red")
            at_text.append("AlphaTrack", style="dim")

        # Balance
        if self._balance is not None:
            bal_str = f"{self._balance:,.2f} {self._currency}".replace(",", ".")
            bal_text = Text()
            bal_text.append(f"{bal_str}\n", style="bold white")
            bal_text.append("Balance", style="dim")
        else:
            bal_text = Text()
            bal_text.append("—\n", style="dim")
            bal_text.append("Balance", style="dim")

        # Bot-Status
        state_colors = {
            "running": ("▶", "bold green"),
            "paused":  ("⏸", "yellow"),
            "stopped": ("■", "red"),
            "error":   ("✗", "bold red"),
            "starting":("…", "dim"),
        }
        icon, color = state_colors.get(self._bridge_state, ("?", "white"))
        pos_str = f"{self._open_positions} offen"
        state_text = Text()
        state_text.append(f"{icon} {self._bridge_state}\n", style=color)
        state_text.append(pos_str, style="dim")

        table.add_row(mt5_text, at_text, bal_text, state_text)
        return table

    def _render_log_panel(self, height: int) -> Panel:
        with self._lock:
            lines = list(self._log_lines)

        visible = lines[-(height - 2):] if len(lines) > height - 2 else lines
        text = Text()
        for ts, tag, msg in visible:
            text.append(ts, style="dim")
            text.append("  ")
            # Tag-Farben
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
            title="[dim]Log[/dim]",
            border_style="dim",
            padding=(0, 1),
        )

    def _build_layout(self) -> Layout:
        layout = Layout()
        layout.split_column(
            Layout(name="header", size=5),
            Layout(name="log"),
        )
        return layout

    # ── Start / Stop ─────────────────────────────────────────────────────

    def start(self) -> None:
        """Startet den Live-Render-Loop in einem Hintergrund-Thread."""
        layout = self._build_layout()

        title = Text()
        title.append(f"  {self._bridge_name}  ", style="bold blue")

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
                    log_height = max(5, terminal_height - 7)

                    layout["header"].update(
                        Panel(
                            self._render_status_bar(),
                            title=f"[bold white] {self._bridge_name} [/bold white]",
                            subtitle=f"[bold bright_white]Uptime: {self._uptime_str()}[/bold bright_white]",
                            border_style="dim",
                            padding=(0, 1),
                        )
                    )
                    layout["log"].update(self._render_log_panel(log_height))
                    self._live.refresh()
                except Exception:
                    pass
                time.sleep(1.0 / _REFRESH_RATE)

        t = threading.Thread(target=_render_loop, daemon=True, name="DisplayRenderer")
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
