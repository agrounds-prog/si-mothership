"""Server-authoritative Cosmic Cards moves and privacy filtering.
This module has no dependency on the Mothership server globals.
"""
from __future__ import annotations

import copy
import secrets

COLORS = {"red", "blue", "green", "yellow"}


def _draw(game: dict, quantity: int) -> list:
    cards = []
    for _ in range(quantity):
        deck = game.get("deck") or []
        if not deck:
            discard = game.get("discard") or []
            if len(discard) > 1:
                top = discard[-1]
                deck = list(discard[:-1])
                secrets.SystemRandom().shuffle(deck)
                game["deck"] = deck
                game["discard"] = [top]
        if not deck:
            break
        cards.append(game["deck"].pop())
    return cards


def _advance(game: dict, steps: int = 1) -> None:
    players = game["players"]
    if not players:
        return
    direction = -1 if game.get("direction") == -1 else 1
    game["turn"] = (int(game.get("turn") or 0) + direction * steps) % len(players)
    game["drawnId"] = ""
    game["chainOpen"] = False


def _valid_card(game: dict, name: str, card: dict) -> bool:
    if game.get("drawnId") and str(game["drawnId"]) != str(card.get("id")):
        return False
    if card.get("color") == "wild":
        if card.get("value") != "wild4":
            return True
        return not any(x.get("color") == game.get("color") for x in game["hands"].get(name, []))
    last = game.get("discard", [])[-1]
    return card.get("color") == game.get("color") or card.get("value") == last.get("value")


def _has_playable_card(game: dict, name: str) -> bool:
    # Called only after resetting drawnId, so every remaining card is eligible.
    return any(
        isinstance(card, dict) and _valid_card(game, name, card)
        for card in game.get("hands", {}).get(name, [])
    )


def apply_cosmic_action(state: dict, run: dict, name: str, request: dict) -> bool:
    """Validate and apply a student action to canonical state. Returns mutation status."""
    if run.get("activityId") != "cosmic-cards-game" or run.get("phase") != "running":
        return False
    if str(request.get("runToken") or "") != str(run.get("runToken") or ""):
        return False
    game = run.get("cosmic")
    if not isinstance(game, dict) or game.get("status") != "playing":
        return False
    players = game.get("players") if isinstance(game.get("players"), list) else []
    hands = game.get("hands") if isinstance(game.get("hands"), dict) else {}
    if not (2 <= len(players) <= 8) or name not in players or name not in hands:
        return False
    own = hands[name]
    if not isinstance(own, list):
        return False
    rid = str(request.get("id") or "")
    if not rid or len(rid) > 120:
        return False
    recent = game.get("lastRequestIds") if isinstance(game.get("lastRequestIds"), list) else []
    if rid in recent:
        return False
    kind = str(request.get("type") or "")
    # COSMIC! is available during another student's turn so a student can
    # announce their final card after playing the penultimate card.
    if kind == "cosmic":
        if len(own) != 1 or (game.get("called") or {}).get(name):
            return False
        game.setdefault("called", {})[name] = True
        game["message"] = name + " called COSMIC! One card left!"
        game["lastRequestIds"] = (recent + [rid])[-32:]
        return True
    active = players[int(game.get("turn") or 0) % len(players)]
    if active != name:
        return False
    if kind == "pass":
        if not game.get("drawnId") and not game.get("chainOpen"):
            return False
        game["message"] = (
            name + " kept the drawn card and passed." if game.get("drawnId")
            else name + " ended their turn."
        )
        _advance(game)
    elif kind == "draw":
        if game.get("drawnId"):
            return False
        cards = _draw(game, 1)
        if not cards:
            game["message"] = "Draw pile empty. Turn passed."
            _advance(game)
        else:
            own.extend(cards)
            game["drawnId"] = cards[0]["id"]
            if not _valid_card(game, name, cards[0]):
                game["message"] = name + " drew a card. Next player."
                _advance(game)
            else:
                game["message"] = name + " drew a playable card. Play it or pass."
    elif kind == "play":
        cid = str(request.get("value") or "")
        matches = [(i, c) for i, c in enumerate(own) if isinstance(c, dict) and str(c.get("id")) == cid]
        if not matches:
            return False
        pos, card = matches[0]
        if not _valid_card(game, name, card):
            return False
        color = str(request.get("color") or "")
        if card.get("color") == "wild" and color not in COLORS:
            return False
        own.pop(pos)
        game["discard"].append(card)
        game["color"] = color if card.get("color") == "wild" else card["color"]
        game.setdefault("called", {})[name] = False
        game["drawnId"] = ""
        game["chainOpen"] = False
        game["lastPlay"] = {
            "name": name,
            "color": game["color"],
            "value": str(card.get("value") or ""),
        }
        value = str(card.get("value") or "")
        game["message"] = name + " played " + str(card.get("color")).upper() + " " + value + "."
        if not own:
            game["status"] = "won"
            game["winner"] = name
            game["message"] = name + " wins COSMIC CARDS!"
        elif value == "reverse":
            game["direction"] = -1 if game.get("direction", 1) == 1 else 1
            _advance(game, 2 if len(players) == 2 else 1)
        elif value == "skip":
            _advance(game, 2)
        elif value in ("draw2", "wild4"):
            _advance(game)
            target = players[int(game.get("turn") or 0) % len(players)]
            hands[target].extend(_draw(game, 2 if value == "draw2" else 4))
            game["message"] += " " + target + " draws " + ("2" if value == "draw2" else "4") + " and misses a turn."
            _advance(game)
        elif game.get("turnRule") == "continue" and _has_playable_card(game, name):
            # Normal number/color cards and Wild may chain; action cards
            # retain their Skip, Reverse and draw-penalty turn behavior.
            game["chainOpen"] = True
            game["message"] += " Play another matching card or END TURN."
        else:
            _advance(game)
    else:
        return False
    game["lastRequestIds"] = (recent + [rid])[-32:]
    return True


def redact_cosmic_state(state: dict, role: str, own_name: str) -> None:
    """Only the teacher receives the full deck and every player's hand."""
    run = state.get("activityRun")
    if not isinstance(run, dict) or run.get("activityId") != "cosmic-cards-game":
        return
    game = run.get("cosmic")
    if not isinstance(game, dict):
        return
    hands = game.get("hands", {})
    if not isinstance(hands, dict):
        return
    game["counts"] = {name: len(cards) for name, cards in hands.items() if isinstance(cards, list)}
    if role == "teacher":
        return
    # Never transmit other participants' cards or draw-pile identities.
    game["hands"] = (
        {own_name: copy.deepcopy(hands[own_name])}
        if role == "student" and own_name in hands else {}
    )
    game["deck"] = [None] * len(game.get("deck", []))
    game.pop("lastRequestIds", None)
    game.pop("drawnId", None) if role != "student" or own_name not in hands else None
