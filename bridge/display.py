"""
Terminal-UI fuer den AlphaTrack Bridge.
Layout:
  - Blauer Header (ID, Name, IP:Port, Latenz, Status, Uptime)
  - Status-Zeile (AlphaTrack | MT5 | Balance + Positionen + Letzter Sync)
  - Verbundene Bots (mit State-Indikator, Positionen, Verbindungsdauer)
  - Scrollendes Bridge-Log
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


class BridgeDisplay:
    """Statischer Header + scrollendes Log fuer das Bridge-Terminal."""

    def __init__(self, bridge_name: str = "AlphaTrack Bridge"):
        self._bridge_name = bridge_name
        self._start_time = time.time()
        self._lock = threading.Lock()
        self._log_lines: deque[tuple[str, str, str]] = deque(maxlen=MAX_LOG_LINES)
        self._console = Console()
        self._live: Live | None = None

        # Identitaets-Felder (statischer Header)
        self._bridge_id: str = ""
        self._bridge_ip: str = ""
        self._bridge_port: int = 0
        self._latency_ms: int | None = None

        # Verbindungs-Status
        self._mt5_ok: bool = False
        self._at_ok: bool = False
        self._at_ping_ms: int | None = None
        self._bridge_state: str = "starting"

        # MT5-Daten
        self._balance: float | None = None
        self._currency: str = "USD"
        self._open_positions: int = 0

        # Letzter Trade-Sync
        self._last_sync_ts: float | None = None

        # Verbundene Bots — erweitertes Info-Dict fuer das Bots-Panel
        self._bots_info: list[dict] = []

    # ── Oeffentliche Update-Methoden ─────────────────────────────────────

    def set_identity(
        self,
        bridge_id: str,
        bridge_ip: str,
        bridge_port: int,
    ) -> None:
        """Setzt die statischen Identitaets-Felder der Bridge (einmalig beim Start)."""
        with self._lock:
            self._bridge_id = bridge_id
            self._bridge_ip = bridge_ip
            self._bridge_port = bridge_port

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
            self._latency_ms = at_ping_ms

    def update_bots(self, bots: list[dict]) -> None:
        """Aktualisiert die Bots-Info-Liste fuer das Verbundene-Bots-Panel."""
        with self._lock:
            self._bots_info = bots

    def update_last_sync(self) -> None:
        """Setzt den Zeitstempel des letzten erfolgreichen Trade-Syncs."""
        with self._lock:
            self._last_sync_ts = time.time()

    def log(self, level: str, tag: str, message: str) -> None:
        """Fuegt eine Bridge-Log-Zeile hinzu. level: 'info'|'warn'|'error'|'ok'"""
        ts = datetime.now().strftime("%d.%m %H:%M:%S")
        with self._lock:
            self._log_lines.append((ts, f"[{tag}]", message))
        if self._live is None:
            color = {"info": "cyan", "warn": "yellow", "error": "red", "ok": "green"}.get(level, "white")
            self._console.print(f"[dim]{ts}[/dim] [{color}][{tag}][/{color}] {message}")

    # ── Render-Methoden ─────────────────────────────────────────────────

    def _render_identity_row(self) -> Table:
        """Header-Zeile: ID | Name | IP:Port | Latenz"""
        table = Table(box=box.SIMPLE_HEAD, show_header=False, padding=(0, 2), expand=True)
        table.add_column(justify="left", ratio=2)
        table.add_column(justify="left", ratio=2)
        table.add_column(justify="left", ratio=2)
        table.add_column(justify="left", ratio=2)

        id_text = Text()
        id_text.append("ID  ", style="dim")
        id_text.append(self._bridge_id or "—", style="bold cyan")

        name_text = Text()
        name_text.append("Name  ", style="dim")
        name_text.append(self._bridge_name, style="bold white")

        addr_text = Text()
        addr_text.append("IP:Port  ", style="dim")
        addr = f"{self._bridge_ip}:{self._bridge_port}" if self._bridge_ip else "—"
        addr_text.append(addr, style="white")

        lat_text = Text()
        lat_text.append("Latenz  ", style="dim")
        lat_str = f"{self._latency_ms}ms" if self._latency_ms is not None else "—"
        lat_text.append(lat_str, style="white")

        table.add_row(id_text, name_text, addr_text, lat_text)
        return table

    def _render_status_row(self) -> Table:
        """Status-Zeile: AlphaTrack | MT5 | Balance + Positionen + Letzter Sync"""
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
            at_text.append("Getrennt", style="dim")

        # MT5-Verbindungsstatus
        mt5_text = Text()
        if self._mt5_ok:
            mt5_text.append("● ", style="bold green")
            mt5_text.append("MetaTrader 5\n", style="green")
            mt5_text.append("Verbunden", style="dim")
        else:
            mt5_text.append("● ", style="bold red")
            mt5_text.append("MetaTrader 5\n", style="red")
            mt5_text.append("Getrennt", style="dim")

        # Rechte Spalte: Balance · Positionen · Letzter Sync
        right_text = Text()
        if self._balance is not None:
            bal_str = f"{self._balance:,.2f} {self._currency}".replace(",", ".")
            right_text.append(bal_str, style="bold white")
        else:
            right_text.append("—", style="dim")

        if self._open_positions > 0:
            right_text.append(f"  ·  {self._open_positions} Pos\n", style="bold yellow")
        else:
            right_text.append(f"  ·  0 Pos\n", style="dim")

        if self._last_sync_ts is not None:
            sec = int(time.time() - self._last_sync_ts)
            if sec < 60:
                sync_str = f"Sync vor {sec}s"
            elif sec < 3600:
                sync_str = f"Sync vor {sec // 60}m"
            else:
                sync_str = f"Sync vor {sec // 3600}h"
            right_text.append(sync_str, style="dim")
        else:
            right_text.append("Kein Sync", style="dim")

        table.add_row(at_text, mt5_text, right_text)
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
            elif "SYNC" in tag or "OK" in tag:
                tag_color = "green"
            elif "CMD" in tag:
                tag_color = "magenta"
            text.append(f"{tag:<8}", style=tag_color)
            text.append(f"  {msg}\n")

        return Panel(
            text,
            title="[dim]Bridge-Log[/dim]",
            border_style="dim",
            padding=(0, 1),
        )

    def _format_duration(self, connected_at) -> str:
        """Formatiert die Verbindungsdauer aus einem Unix-Timestamp."""
        if connected_at is None:
            return "—"
        sec = int(time.time() - connected_at)
        if sec < 60:
            return f"{sec}s"
        minutes = sec // 60
        if minutes < 60:
            return f"{minutes}m"
        hours = minutes // 60
        mins_rem = minutes % 60
        return f"{hours}h {mins_rem:02d}m"

    def _render_bots_panel(self) -> Panel:
        """Rendert das 'Verbundene Bots'-Panel mit State-Indikator und Positionen."""
        with self._lock:
            bots_snapshot = list(self._bots_info)

        text = Text()
        if bots_snapshot:
            for bot in bots_snapshot:
                state = bot.get("state", "running")
                if state == "running":
                    dot_style = "bold green"
                elif state in ("paused", "warning"):
                    dot_style = "bold yellow"
                else:
                    dot_style = "bold red"

                text.append("● ", style=dot_style)
                text.append(bot.get("name", "?"), style="cyan bold")

                pos = bot.get("positions", 0)
                if pos > 0:
                    text.append(f"  {pos} Pos", style="bold yellow")
                else:
                    text.append("  0 Pos", style="dim")

                text.append("  ID ", style="dim")
                text.append(bot.get("at_id") or "—", style="dim")
                text.append("  verbunden seit ", style="dim")
                text.append(self._format_duration(bot.get("connected_at")))

                if state not in ("running", ""):
                    label = {"paused": "pausiert", "stopped": "gestoppt", "error": "fehler"}.get(state, state)
                    text.append(f"  [{label}]", style="dim yellow" if state == "paused" else "dim red")

                text.append("\n")
        else:
            text.append("(keine Bots verbunden)", style="dim")

        return Panel(
            text,
            title="[dim]Verbundene Bots[/dim]",
            border_style="dim",
            padding=(0, 1),
        )

    def _build_layout(self) -> Layout:
        layout = Layout()
        layout.split_column(
            Layout(name="id_row", size=3),
            Layout(name="status_row", size=4),
            Layout(name="bots", size=3),
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
                    n = len(self._bots_info)
                    bots_h = max(3, n + 2)
                    layout["bots"].size = bots_h
                    log_height = max(5, terminal_height - 9 - bots_h)

                    layout["id_row"].update(
                        Panel(
                            self._render_identity_row(),
                            title=f"[bold blue] {self._bridge_name} [/bold blue] [dim]Bridge[/dim]",
                            subtitle=f"[dim]Uptime: {self._uptime_str()} | Status: {self._bridge_state}[/dim]",
                            border_style="blue",
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
                    layout["bots"].update(self._render_bots_panel())
                    layout["log"].update(self._render_log_panel(log_height))
                    self._live.refresh()
                except Exception:
                    pass
                time.sleep(1.0 / _REFRESH_RATE)

        t = threading.Thread(target=_render_loop, daemon=True, name="BridgeDisplayRenderer")
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
