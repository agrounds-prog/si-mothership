"""Server-authoritative FOUR IN LINE actions for active classroom students.

Teacher starts/mutates the canonical game via the existing session protocol.
Student socket actions are validated against the enrolled name, run token and
active side. Shared and spectators only receive public board information.
"""
from __future__ import annotations

def _winning(board: list[int], rows: int, cols: int, row: int, col: int, who: int) -> list[int]:
    for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
        line = [(row, col)]
        for direction in (-1, 1):
            r, c = row + dr * direction, col + dc * direction
            while 0 <= r < rows and 0 <= c < cols and board[r * cols + c] == who:
                if direction < 0:
                    line.insert(0, (r, c))
                else:
                    line.append((r, c))
                r += dr * direction
                c += dc * direction
        if len(line) >= 4:
            return [r * cols + c for r, c in line]
    return []


def apply_four_in_line_action(state: dict, run: dict, name: str, request: dict) -> bool:
    if run.get("activityId") != "four-in-line-game" or run.get("phase") != "running":
        return False
    if str(request.get("runToken") or "") != str(run.get("runToken") or ""):
        return False
    game = run.get("fourInLine")
    if not isinstance(game, dict) or game.get("status") != "playing":
        return False
    if not isinstance(name, str) or not name or len(name) > 100:
        return False
    seats = game.get("seats")
    if not isinstance(seats, dict) or name not in seats:
        return False
    seat = seats.get(name)
    turn = game.get("turn")
    if type(seat) is not int or type(turn) is not int or seat not in (0, 1) or seat != turn:
        return False
    players = game.get("players")
    if not isinstance(players, list) or len(players) != 2:
        return False
    if type(request.get("column")) is not int:
        return False
    col = request["column"]
    cols, rows = game.get("cols"), game.get("rows")
    if (type(cols) is not int or type(rows) is not int
        or (cols, rows) not in ((5, 4), (7, 6), (9, 7))
        or not 0 <= col < cols):
        return False
    board = game.get("board")
    if (not isinstance(board, list) or len(board) != cols * rows
        or any(type(v) is not int or v not in (0, 1, 2) for v in board)
        or board[col] != 0):
        return False
    rid = str(request.get("id") or "")
    if not rid or len(rid) > 100:
        return False
    recent = game.get("lastRequestIds") if isinstance(game.get("lastRequestIds"), list) else []
    if rid in recent:
        return False

    row = rows - 1
    while row >= 0 and board[row * cols + col]:
        row -= 1
    if row < 0:
        return False
    import time
    history = game.setdefault("history", [])
    if not isinstance(history, list):
        return False
    history.append({
        "board": board[:],
        "turn": turn,
        "status": game["status"],
        "winner": game.get("winner"),
        "winning": list(game.get("winning") or []),
        "moves": int(game.get("moves") or 0),
        "lastMove": game.get("lastMove"),
        "message": game.get("message", ""),
    })
    if len(history) > 40:
        del history[:-40]
    board[row * cols + col] = seat + 1
    game["moves"] = sum(1 for cell in board if cell)
    game["lastMove"] = {"row": row, "col": col, "seat": seat, "at": int(time.time() * 1000)}
    line = _winning(board, rows, cols, row, col, seat + 1)
    if line:
        game["winner"], game["status"], game["winning"] = seat, "won", line
        game["message"] = str(players[seat]) + " connected FOUR!"
    elif game["moves"] == rows * cols:
        game["status"], game["message"] = "draw", "Grid complete — a draw!"
    else:
        game["turn"] = 1 - seat
        game["message"] = str(players[game["turn"]]) + "'s turn. Drop the next disc."
    game["lastRequestIds"] = (recent + [rid])[-40:]
    return True
