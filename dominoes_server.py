"""Server-authoritative double-six Draw Dominoes for SI Mothership.

Only student-owned hands are sent to student devices. Shared screens receive
counts and board state, never private tiles or the boneyard identities.
"""
from __future__ import annotations
import copy

def _pips(tile: dict) -> int:
    return int(tile.get("a", 0)) + int(tile.get("b", 0))

def _endpoints(g: dict) -> tuple[int | None, int | None]:
    chain = g.get("chain") or []
    if not chain:
        return None, None
    return int(chain[0]["left"]), int(chain[-1]["right"])

def _can(g: dict, t: dict, side: str) -> bool:
    left, right = _endpoints(g)
    if left is None:
        return True
    a, b = int(t.get("a", -1)), int(t.get("b", -1))
    if side == "left":
        return a == left or b == left
    if side == "right":
        return a == right or b == right
    return a in (left, right) or b in (left, right)

def _playable(g: dict, name: str) -> bool:
    return any(_can(g, t, "any") for t in g.get("hands", {}).get(name, []))

def _next(g: dict) -> None:
    players = g["players"]
    g["turn"] = (int(g.get("turn", 0)) + 1) % len(players)
    if g["turn"] == 0:
        g["round"] = int(g.get("round") or 1) + 1

def _finish(g: dict, name: str, blocked: bool = False) -> None:
    g["status"], g["winner"] = "won", name
    points = sum(_pips(tile) for p in g["players"] if p != name for tile in g["hands"].get(p, []))
    g.setdefault("scores", {})[name] = int(g.get("scores", {}).get(name) or 0) + points
    g["message"] = f"{name} wins {'the blocked round' if blocked else 'the round'}! +{points} pips."
    g["lastAction"] = {"kind": "win", "player": name}

def apply_dominoes_action(state: dict, run: dict, name: str, req: dict) -> bool:
    if run.get("activityId") != "dominoes-game" or run.get("phase") != "running":
        return False
    if str(req.get("runToken") or "") != str(run.get("runToken") or ""):
        return False
    g = run.get("dominoes")
    if not isinstance(g, dict) or g.get("status") != "playing":
        return False
    players = g.get("players")
    hands = g.get("hands")
    if not isinstance(players, list) or not 2 <= len(players) <= 4 or not isinstance(hands, dict):
        return False
    if name not in players or players[int(g.get("turn") or 0) % len(players)] != name:
        return False
    hand = hands.get(name)
    if not isinstance(hand, list):
        return False
    rid = str(req.get("id") or "")
    if not rid or len(rid) > 120:
        return False
    recent = g.get("lastRequestIds") if isinstance(g.get("lastRequestIds"), list) else []
    if rid in recent:
        return False
    kind = str(req.get("type") or "")
    if kind == "play":
        tile_id = str(req.get("tileId") or "")
        side = str(req.get("side") or "")
        first = not g.get("chain")
        if side not in ("left", "right", "first") or (not first and side == "first"):
            return False
        found = [(i, t) for i, t in enumerate(hand) if isinstance(t, dict) and str(t.get("id") or "") == tile_id]
        if len(found) != 1:
            return False
        i, tile = found[0]
        if not _can(g, tile, side):
            return False
        left, right = _endpoints(g)
        a, b = int(tile["a"]), int(tile["b"])
        if left is None:
            x, y = a, b
        elif side == "left":
            x, y = (b, a) if a == left else (a, b)
        else:
            x, y = (a, b) if a == right else (b, a)
        chain = g.setdefault("chain", [])
        vertical = req.get("vertical", False)
        if type(vertical) is not bool:
            return False
        placed = {"id": tile_id, "a": a, "b": b, "left": x, "right": y, "vertical": a == b and vertical}
        if side == "left":
            chain.insert(0, placed)
        else:
            chain.append(placed)
        hand.pop(i)
        g["consecutivePasses"] = 0
        g["lastPlay"] = {"tileId": tile_id, "player": name, "side": side}
        g["lastAction"] = {"kind": "play", "player": name}
        g["message"] = f"{name} placed {a} · {b} {'to start the chain.' if first else 'on the ' + side + ' end.'}"
        if not hand:
            _finish(g, name)
        else:
            _next(g)
    elif kind == "draw":
        if _playable(g, name):
            return False
        bag = g.get("bag")
        if not isinstance(bag, list) or not bag:
            return False
        hand.append(bag.pop())
        g["lastAction"] = {"kind": "draw", "player": name}
        g["message"] = f"{name} drew a domino."
    elif kind == "pass":
        if _playable(g, name) or g.get("bag"):
            return False
        g["consecutivePasses"] = int(g.get("consecutivePasses") or 0) + 1
        g["lastAction"] = {"kind": "pass", "player": name}
        g["message"] = f"{name} passed. No matching tiles remain."
        if int(g["consecutivePasses"]) >= len(players):
            names = sorted(players, key=lambda p: sum(_pips(t) for t in hands.get(p, [])))
            _finish(g, names[0], blocked=True)
        else:
            _next(g)
    else:
        return False
    g["lastRequestIds"] = (recent + [rid])[-40:]
    return True

def redact_dominoes_state(state: dict, role: str, own_name: str) -> None:
    run = state.get("activityRun")
    if not isinstance(run, dict) or run.get("activityId") != "dominoes-game":
        return
    g = run.get("dominoes")
    if not isinstance(g, dict):
        return
    hands = g.get("hands")
    if not isinstance(hands, dict):
        return
    g["counts"] = {name: len(tiles) for name, tiles in hands.items() if isinstance(tiles, list)}
    if role == "teacher":
        return
    g["hands"] = (
        {own_name: copy.deepcopy(hands[own_name])}
        if role == "student" and own_name in hands else {}
    )
    g["bag"] = [None] * len(g.get("bag") or [])
    g.pop("lastRequestIds", None)
