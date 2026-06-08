"""
Automatische Erkennung von AlphaTrack im Heimnetz.

Suchreihenfolge:
  0. UDP-Broadcast  (3s lauschen auf Port 8766, AGPv2 Bridge-Announce)
  1. localhost:3002  (Bridge und AlphaTrack auf selber Maschine)
  2. last_known_url  (zuletzt erfolgreiche URL aus Config)
  3. LAN-Scan        (192.168.178.x zuerst, dann restliches /24)
"""

import ipaddress
import json
import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

UDP_DISCOVERY_PORT = 8766

ALPHATRACK_PORT = 3002
PROBE_TIMEOUT   = 3   # Sekunden pro Versuch
SCAN_TIMEOUT    = 2   # Kürzeres Timeout beim Massenscann
SCAN_WORKERS    = 30  # Parallele Threads beim LAN-Scan


def discover_via_udp(timeout: float = 3.0) -> str | None:
    """Lauscht auf UDP-Port 8766 auf AGPv2 Bridge-Announcements."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("", UDP_DISCOVERY_PORT))
        sock.settimeout(timeout)
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                data, _ = sock.recvfrom(1024)
                msg = json.loads(data.decode("utf-8"))
                if msg.get("type") == "bridge_announce" and msg.get("agp") == "2.0":
                    ip = msg.get("ip", "")
                    port = msg.get("port", 8765)
                    if ip:
                        return f"http://{ip}:{port}"
            except socket.timeout:
                break
            except Exception:
                continue
    except Exception:
        pass
    finally:
        try:
            sock.close()
        except Exception:
            pass
    return None


def _probe(url: str, timeout: float = PROBE_TIMEOUT) -> str | None:
    """Prüft ob AlphaTrack unter dieser URL läuft. Gibt URL zurück oder None."""
    try:
        # Neuer Endpunkt (AlphaTrack nach aktuellem Stand)
        r = requests.get(f"{url}/api/bridge/info", timeout=timeout)
        if r.ok:
            return url
        # Fallback für ältere AlphaTrack-Versionen ohne /api/bridge/info
        r2 = requests.get(f"{url}/api/profiles", timeout=timeout)
        if r2.ok:
            return url
    except Exception:
        pass
    return None


def _local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def _lan_candidates() -> list[str]:
    """Generiert alle IPs im lokalen /24-Subnet — 192.168.178.X zuerst."""
    local = _local_ip()
    try:
        net = ipaddress.IPv4Network(f"{local}/24", strict=False)
        hosts = [str(h) for h in net.hosts()]
        preferred = [h for h in hosts if h.startswith("192.168.178.")]
        others = [h for h in hosts if not h.startswith("192.168.178.")]
        ordered = preferred + others
        return [f"http://{h}:{ALPHATRACK_PORT}" for h in ordered]
    except Exception:
        return []


def _lan_scan(display=None) -> str | None:
    """Paralleler Scan des lokalen Subnetzes. Gibt erste gefundene URL zurück."""
    candidates = _lan_candidates()
    if not candidates:
        return None

    if display:
        display.log("info", "DISC", f"LAN-Scan: {len(candidates)} Adressen werden geprüft ...")

    with ThreadPoolExecutor(max_workers=SCAN_WORKERS) as ex:
        futures = {ex.submit(_probe, url, SCAN_TIMEOUT): url for url in candidates}
        for future in as_completed(futures):
            result = future.result()
            if result:
                # Restliche Futures abbrechen
                for f in futures:
                    f.cancel()
                return result
    return None


def fetch_setup_info(alphatrack_url: str) -> dict | None:
    """Holt API-Key und Profile von AlphaTrack. Gibt dict oder None zurück."""
    try:
        r = requests.get(f"{alphatrack_url}/api/bridge/info", timeout=PROBE_TIMEOUT)
        if r.ok:
            return r.json()
    except Exception:
        pass
    return None


def discover(last_known_url: str | None = None, display=None) -> str | None:
    """
    Findet AlphaTrack im Netzwerk.
    Gibt die gefundene URL zurück, oder None wenn nichts gefunden.
    """
    # Schritt 0: UDP-Discovery (3s)
    if display:
        display.log("info", "DISC", "Lausche auf UDP-Broadcast (3s) ...")
    udp_result = discover_via_udp(timeout=3.0)
    if udp_result:
        if display:
            display.log("ok", "DISC", f"Bridge via UDP gefunden: {udp_result}")
        return udp_result

    candidates = ["http://localhost:3002", "http://127.0.0.1:3002"]
    if last_known_url and last_known_url not in candidates:
        candidates.append(last_known_url)

    for url in candidates:
        if display:
            display.log("info", "DISC", f"Prüfe {url} ...")
        result = _probe(url)
        if result:
            if display:
                display.log("ok", "DISC", f"AlphaTrack gefunden: {result}")
            return result

    if display:
        display.log("info", "DISC", "Nicht lokal gefunden — starte LAN-Scan ...")

    result = _lan_scan(display)
    if result and display:
        display.log("ok", "DISC", f"AlphaTrack gefunden: {result}")

    return result
