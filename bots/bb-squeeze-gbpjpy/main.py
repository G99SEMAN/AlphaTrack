"""
BB Squeeze GBP/JPY — AlphaTrack Trading Bot
Basiert auf BaseBot (bots/scaffold/base_bot.py).
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot
from strategy import BBSqueezeStrategy


CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

_restart_requested = False


def main():
    global _restart_requested
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)

    bot = BBSqueezeStrategy(
        bot_id=config["bot_id"],
        name=config["bot_name"],
        port=config["bot_port"],
    )
    bot.run()
    if bot._restart_requested:
        _restart_requested = True


if __name__ == "__main__":
    main()
    sys.exit(75 if _restart_requested else 0)
