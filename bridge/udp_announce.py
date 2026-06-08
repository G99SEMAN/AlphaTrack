"""UDP-Broadcast Announcer für AGPv2 Bridge Discovery."""
import asyncio
import json
import socket

UDP_ANNOUNCE_PORT = 8766
UDP_ANNOUNCE_INTERVAL = 10

_local_ip_ref: str = ""
_profile_id_ref: str = ""
_config_loader = None


def configure(local_ip: str, profile_id: str, config_loader) -> None:
    global _local_ip_ref, _profile_id_ref, _config_loader
    _local_ip_ref = local_ip
    _profile_id_ref = profile_id
    _config_loader = config_loader


def _build_announce_payload() -> bytes:
    cfg = {}
    if _config_loader:
        try:
            cfg = _config_loader()
        except Exception:
            pass
    msg = {
        "type": "bridge_announce",
        "agp": "2.0",
        "ip": _local_ip_ref,
        "port": cfg.get("command_server_port", 8765),
        "name": cfg.get("bridge_name", "AlphaTrack Bridge"),
        "version": "2.0",
        "profile_id": _profile_id_ref,
    }
    return json.dumps(msg).encode("utf-8")


async def udp_announce_loop() -> None:
    """Sendet alle 10s einen UDP-Broadcast auf Port 8766."""
    while True:
        try:
            payload = _build_announce_payload()
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.sendto(payload, ("255.255.255.255", UDP_ANNOUNCE_PORT))
            sock.close()
        except Exception:
            pass
        await asyncio.sleep(UDP_ANNOUNCE_INTERVAL)
