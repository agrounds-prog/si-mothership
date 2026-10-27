"""Phase 4T extended multiplayer stress: live, isolated WebSocket classrooms.

12 simultaneously connected mock students plus teacher and projector exercise
MILLION, Crew Survey, Dominoes, Cosmic Cards, and Signal Sequence. Browser UI
tests live in the separate five-view Chromium workflow; these tests verify the
actual server transport, accepted actions, privacy projections and SQLite state.
No network request goes to production and no Railway volume is accessed.
"""
import asyncio
import copy
import json
import tempfile
import unittest
from pathlib import Path

from aiohttp.test_utils import TestClient, TestServer
import server as app

CREW = [
    {"n": f"Crew{i:02d}", "studentToken": f"phase4t-extended-token-{i:02d}",
     "c": "#50cdee", "offline": False}
    for i in range(12)
]
TOKENS = {name: "extended-" + name.lower() for name in (
    "million", "crew-survey", "dominoes", "cosmic", "signal")}
ACTIVITY_IDS = {
    "million": "million-game", "crew-survey": "crew-survey-game",
    "dominoes": "dominoes-game", "cosmic": "cosmic-cards-game",
    "signal": "signal-sequence-game",
}


def classroom(kind, verbal=False):
    run = {"activityId": ACTIVITY_IDS[kind], "runToken": TOKENS[kind],
           "phase": "running"}
    if kind == "million":
        run["millionConfig"] = {
            "questions": [{
                "prompt": "Find the kind answer",
                "choices": [{"key": k, "text": "Answer " + k} for k in "ABCD"],
                "correct": "B", "mothershipClue": "Second choice",
                "explanation": "Only teachers see this",
            }, {"prompt": "Future private question", "correct": "C",
                "choices": [{"key": k, "text": k} for k in "ABCD"]}],
            "ladder": [100, 250], "answerMode": "verbal" if verbal else "type",
        }
        run["million"] = {
            "questionIndex": 0, "pilot": "Crew00", "pilotIndex": 0,
            "ladderLevel": 0, "inventory": {
                "poll": 1, "reduce": 1, "clue": 1, "tryAgain": 1},
            "selectedAnswer": "", "lockedAnswer": "",
            "crewPredictions": {}, "eliminated": [], "publicClue": "",
            "pollOpen": False, "pollVisible": False, "revealed": False,
            "result": "", "complete": False, "over": False, "message": "Ready",
        }
    elif kind == "crew-survey":
        run["crewSurveyConfig"] = {
            "answerMode": "verbal" if verbal else "type",
            "answers": [{"text": "Private answer", "value": 75}],
        }
        run["crewSurvey"] = {
            "stage": "faceoff", "teams": [["Crew00", "Crew02"], ["Crew01", "Crew03"]],
            "activeIndexes": [0, 0], "controlTeam": None,
            "buzzer": {"armed": True, "eligible": ["Crew00", "Crew01"],
                       "winner": None, "lockedAt": None},
            "privateResponses": {}, "lastResponse": None, "revealed": [],
        }
    elif kind == "dominoes":
        run["dominoes"] = {
            "version": 1, "players": ["Crew00", "Crew01"],
            "hands": {
                "Crew00": [{"id": "a", "a": 1, "b": 6},
                           {"id": "x", "a": 3, "b": 5}],
                "Crew01": [{"id": "b", "a": 2, "b": 6},
                           {"id": "q", "a": 4, "b": 4}],
            },
            "bag": [{"id": "d", "a": 1, "b": 3}],
            "chain": [], "turn": 0, "status": "playing",
            "scores": {"Crew00": 0, "Crew01": 0},
            "consecutivePasses": 0, "lastRequestIds": [], "round": 1,
        }
    elif kind == "cosmic":
        card = lambda ident, color, value: {
            "id": ident, "color": color, "value": value}
        run["cosmic"] = {
            "players": ["Crew00", "Crew01", "Crew02"],
            "hands": {
                "Crew00": [card("a1", "red", "2"), card("a2", "red", "6")],
                "Crew01": [card("b1", "red", "4"), card("b2", "green", "8")],
                "Crew02": [card("c1", "red", "5"), card("c2", "yellow", "1")],
            },
            "deck": [card("d1", "blue", "7"), card("d2", "yellow", "3")],
            "discard": [card("top", "red", "9")],
            "color": "red", "turn": 0, "direction": 1,
            "drawnId": "", "chainOpen": False, "turnRule": "next",
            "called": {}, "status": "playing", "winner": None, "message": "",
        }
    else:
        run["signalSequence"] = {
            "id": "signal-phase4t", "pilot": "Crew00",
            "phase": "input", "sequence": [0, 2, 1], "round": 3,
            "progress": 0, "best": 0, "message": "Repeat",
            "signals": 4, "mode": "classic",
        }
    return {
        "screen": "activity", "ended": False,
        "students": copy.deepcopy(CREW),
        "activityRun": run, "buzz": [], "helpMessages": [], "photos": [],
    }


class Phase4TExtendedStress(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="mothership-4t-extended-")
        self.orig = (app.DB_PATH, app.LATEST_STATE,
                     app.CURRENT_SESSION_ID, app.CURRENT_JOIN_CODE)
        app.DB_PATH = Path(self.tmp.name) / "classroom.sqlite3"
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        app.init_db()
        app.save_runtime_state(classroom("million"))
        self.client = TestClient(TestServer(app.create_app()))
        await self.client.start_server()
        login = await self.client.post(
            "/api/teacher/login", json={"key": app.TEACHER_KEY})
        self.assertEqual(login.status, 200)
        self.sockets = []
        self.initial_views = {}

    async def asyncTearDown(self):
        for socket in self.sockets:
            if not socket.closed:
                await socket.close()
        await self.client.close()
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        (app.DB_PATH, app.LATEST_STATE,
         app.CURRENT_SESSION_ID, app.CURRENT_JOIN_CODE) = self.orig
        self.tmp.cleanup()

    async def connect(self, role="student", student=None):
        params = {"role": role, "sid": app.CURRENT_SESSION_ID}
        if role == "student":
            params["code"] = app.CURRENT_JOIN_CODE
        ws = await self.client.ws_connect("/ws", params=params)
        self.sockets.append(ws)
        if student is not None:
            await ws.send_json({
                "type": "hello", "student_name": student["n"],
                "student_token": student["studentToken"]})
            # The client and server have DIFFERENT WebSocket objects. Read
            # until this exact connection receives the post-hello private
            # snapshot, rather than consulting server CLIENT_META by client
            # object identity or accidentally using the unauthenticated frame.
            for _ in range(8):
                packet = await ws.receive_json(timeout=8)
                state = packet.get("state") if packet.get("type") == "state" else None
                if isinstance(state, dict) and any(
                    st.get("studentToken") == student["studentToken"]
                    for st in state.get("students", [])):
                    self.initial_views[ws] = state
                    break
            else:
                self.fail("Missing authenticated student state for " + student["n"])
        return ws

    async def room(self):
        teacher = await self.connect("teacher")
        shared = await self.connect("shared")
        sockets = await asyncio.gather(
            *(self.connect(student=student) for student in CREW))
        # Ensure every hello is bound server-side before a stress burst.
        await self.until(lambda: sum(
            bool(meta.get("student_token"))
            for meta in app.CLIENT_META.values()) == len(CREW),
            "all student identities authenticated")
        return teacher, shared, sockets

    async def until(self, test, label, timeout=12):
        async def check():
            while not test():
                await asyncio.sleep(.02)
        try:
            await asyncio.wait_for(check(), timeout)
        except asyncio.TimeoutError:
            self.fail("Timed out waiting for " + label)

    async def action(self, socket, kind, index, ident, typ, value="",
                     extra=None, token=None):
        request = {"id": ident, "type": typ, "value": value,
                   "runToken": token or TOKENS[kind]}
        if kind in ("million", "crew-survey"):
            request["game"] = kind
        if extra:
            request.update(extra)
        student = CREW[index]
        channel = "game_show_action" if kind in ("million", "crew-survey") else (
            {"dominoes": "dominoes_action", "cosmic": "cosmic_action",
             "signal": "signal_sequence_action"}[kind])
        await socket.send_json({
            "type": channel, "student_name": student["n"],
            "student_token": student["studentToken"], "request": request,
        })

    def current_run(self):
        return app.LATEST_STATE["activityRun"]

    def disk(self):
        with app.db() as connection:
            record = connection.execute(
                "SELECT state_json FROM runtime WHERE id=1").fetchone()
        return json.loads(record["state_json"])["activityRun"]

    async def view(self, socket, matches, description):
        # A late private observer may not receive another broadcast.
        # Preserve its first authenticated frame for the next assertion.
        cached = self.initial_views.pop(socket, None)
        if cached is not None and matches(cached):
            return cached
        async def read():
            while True:
                packet = await socket.receive_json(timeout=10)
                if packet.get("type") == "state" and matches(packet["state"]):
                    return packet["state"]
        try:
            return await asyncio.wait_for(read(), 14)
        except asyncio.TimeoutError:
            self.fail("Missing projected " + description)

    async def test_million_prediction_burst_single_lifeline_lock_and_rejoin(self):
        app.save_runtime_state(classroom("million"))
        teacher, shared, users = await self.room()
        # Eleven crew members predict simultaneously; only the current pilot
        # can select, spend a lifeline or lock. Server deduplicates retries.
        await asyncio.gather(*[
            self.action(users[i], "million", i, f"vote-{i}", "predict", "C")
            for i in range(1, 12) for _ in range(2)])
        await self.until(lambda: len(self.current_run()["million"]["crewPredictions"]) == 11,
                         "eleven private audience predictions")
        await asyncio.gather(*[
            self.action(users[i], "million", i, f"crew-lock-{i}", "lock")
            for i in range(1, 12)])
        await asyncio.gather(*[
            self.action(users[0], "million", 0, "reduce-once", "lifeline", "reduce")
            for _ in range(5)])
        await self.until(lambda: len(self.current_run()["million"]["eliminated"]) == 2,
                         "one 50/50 lifeline")
        self.assertEqual(self.current_run()["million"]["inventory"]["reduce"], 0)
        self.assertEqual(self.current_run()["million"]["lockedAnswer"], "")
        self.assertEqual(self.disk()["million"]["inventory"]["reduce"], 0)
        spectator = await self.connect("shared")
        projected = await self.view(spectator, lambda s:
            len(s["activityRun"]["million"]["eliminated"]) == 2,
            "MILLION lifeline")
        self.assertEqual(projected["activityRun"]["million"]["crewPredictions"], {})
        self.assertNotIn("correct",
                         projected["activityRun"]["millionConfig"]["questions"][0])
        self.assertEqual(
            projected["activityRun"]["millionConfig"]["questions"][1]["prompt"], "")
        own = await self.connect(student=CREW[3])
        own_state = await self.view(own, lambda s:
            s["activityRun"]["million"]["crewPredictions"].get("Crew03") == "C",
            "MILLION private prediction")
        self.assertEqual(
            own_state["activityRun"]["million"]["crewPredictions"], {"Crew03": "C"})
        await users[0].close()
        pilot = await self.connect(student=CREW[0])
        await asyncio.gather(*[
            self.action(pilot, "million", 0, "select-once", "select", "B")
            for _ in range(4)])
        await self.until(lambda: self.current_run()["million"]["selectedAnswer"] == "B",
                         "pilot selected answer after reconnect")
        await asyncio.gather(*[
            self.action(pilot, "million", 0, "lock-once", "lock")
            for _ in range(4)])
        await self.until(lambda: self.current_run()["million"]["lockedAnswer"] == "B",
                         "pilot final lock")
        self.assertEqual(self.disk()["million"]["lockedAnswer"], "B")
        self.assertEqual(self.disk()["million"]["ladderLevel"], 0,
                         "student input cannot silently award teacher points")
        self.assertEqual(len(self.current_run()["million"]["crewPredictions"]), 11)

    async def test_crew_survey_faceoff_verbal_mode_and_private_answers(self):
        app.save_runtime_state(classroom("crew-survey"))
        teacher, shared, users = await self.room()
        # Establish a deterministic first valid buzz, then flood with both
        # eligible competitor and invalid audience requests.
        await self.action(users[0], "crew-survey", 0, "first-buzz", "buzz")
        await self.until(lambda: self.current_run()["crewSurvey"]["buzzer"]["winner"]
                         == "Crew00", "first buzzer")
        await asyncio.gather(*[
            self.action(users[i], "crew-survey", i, f"other-{i}", "buzz")
            for i in range(1, 12) for _ in range(3)])
        cs = self.current_run()["crewSurvey"]
        self.assertEqual(cs["buzzer"]["winner"], "Crew00")
        self.assertFalse(cs["buzzer"]["armed"])
        await asyncio.gather(*[
            self.action(users[i], "crew-survey", i, f"answer-{i}",
                        "answer", "Hidden from projector")
            for i in range(1, 12)])
        await self.action(users[0], "crew-survey", 0, "winner-answer",
                          "answer", "Pencil")
        await self.until(lambda: "Crew00" in
                         self.current_run()["crewSurvey"]["privateResponses"],
                         "winner typed answer")
        self.assertEqual(self.current_run()["crewSurvey"]["privateResponses"],
                         {"Crew00": self.current_run()["crewSurvey"]["privateResponses"]["Crew00"]})
        self.assertEqual(self.disk()["crewSurvey"]["buzzer"]["winner"], "Crew00")
        refreshed = await self.connect(student=CREW[0])
        await users[0].close()
        await asyncio.sleep(.08)
        self.assertEqual(self.current_run()["crewSurvey"]["buzzer"]["winner"], "Crew00")
        own = await self.view(refreshed, lambda s:
            "Crew00" in s["activityRun"]["crewSurvey"]["privateResponses"],
            "winner private answer")
        self.assertEqual(
            own["activityRun"]["crewSurvey"]["privateResponses"]["Crew00"]["text"], "Pencil")
        projection = await self.connect("shared")
        public = await self.view(projection, lambda s:
            s["activityRun"]["crewSurvey"]["buzzer"]["winner"] == "Crew00",
            "survey projector")
        self.assertEqual(public["activityRun"]["crewSurvey"]["privateResponses"], {})
        self.assertEqual(public["activityRun"]["crewSurveyConfig"]["answers"][0]["text"], "")
        # Teacher changes an existing board to buzzer-only, say-it-aloud mode.
        # All typed answers must be refused while the same buzzer rules apply.
        current = copy.deepcopy(app.LATEST_STATE)
        current["activityRun"]["crewSurveyConfig"]["answerMode"] = "verbal"
        current["activityRun"]["crewSurvey"]["privateResponses"] = {}
        current["activityRun"]["crewSurvey"]["lastResponse"] = None
        app.save_runtime_state(current)
        await asyncio.gather(*[
            self.action(refreshed, "crew-survey", 0, f"spoken-{i}", "answer", "Invalid")
            for i in range(6)])
        await asyncio.sleep(.14)
        self.assertEqual(self.current_run()["crewSurvey"]["privateResponses"], {})
        self.assertIsNone(self.disk()["crewSurvey"]["lastResponse"])

    async def test_dominoes_turn_pressure_duplicate_tiles_and_private_hands(self):
        app.save_runtime_state(classroom("dominoes"))
        teacher, shared, users = await self.room()
        await asyncio.gather(*[
            self.action(users[i], "dominoes", i, f"illegal-{i}", "play",
                        extra={"tileId": "a", "side": "first"})
            for i in range(1, 12)])
        await asyncio.sleep(.09)
        self.assertEqual(self.current_run()["dominoes"]["chain"], [])
        await asyncio.gather(*[
            self.action(users[0], "dominoes", 0, "first-tile", "play",
                        extra={"tileId": "a", "side": "first"})
            for _ in range(5)])
        await self.until(lambda: len(self.current_run()["dominoes"]["chain"]) == 1,
                         "Dominoes first tile")
        self.assertEqual(self.current_run()["dominoes"]["turn"], 1)
        self.assertEqual(len(self.current_run()["dominoes"]["hands"]["Crew00"]), 1)
        await users[1].close()
        bob = await self.connect(student=CREW[1])
        await asyncio.gather(*[
            self.action(bob, "dominoes", 1, "second-tile", "play",
                        extra={"tileId": "b", "side": "right"})
            for _ in range(5)])
        await self.until(lambda: len(self.current_run()["dominoes"]["chain"]) == 2,
                         "Dominoes second tile")
        self.assertEqual(self.current_run()["dominoes"]["turn"], 0)
        self.assertEqual(self.disk()["dominoes"]["chain"],
                         self.current_run()["dominoes"]["chain"])
        self.assertEqual(
            [x["id"] for x in self.current_run()["dominoes"]["chain"]], ["a", "b"])
        projector = await self.connect("shared")
        public = await self.view(projector, lambda s:
            len(s["activityRun"]["dominoes"]["chain"]) == 2,
            "Dominoes projector")
        game = public["activityRun"]["dominoes"]
        self.assertEqual(game["hands"], {})
        self.assertTrue(all(x is None for x in game["bag"]))
        player = await self.connect(student=CREW[0])
        own = await self.view(player, lambda s:
            len(s["activityRun"]["dominoes"]["chain"]) == 2 and any(
                st.get("studentToken") == CREW[0]["studentToken"]
                for st in s["students"]),
            "Dominoes student privacy")
        self.assertEqual(set(own["activityRun"]["dominoes"]["hands"]), {"Crew00"})
        self.assertEqual(len(own["activityRun"]["dominoes"]["hands"]["Crew00"]), 1)
        self.assertEqual(len(self.current_run()["dominoes"]["chain"]), 2)

    async def test_cosmic_cards_discards_stay_once_private_and_turn_ordered(self):
        app.save_runtime_state(classroom("cosmic"))
        teacher, shared, users = await self.room()
        await asyncio.gather(*[
            self.action(users[i], "cosmic", i, f"spectator-{i}", "play", "a1")
            for i in range(1, 12)])
        await asyncio.sleep(.07)
        self.assertEqual(len(self.current_run()["cosmic"]["discard"]), 1)
        await asyncio.gather(*[
            self.action(users[0], "cosmic", 0, "one-red", "play", "a1")
            for _ in range(6)])
        await self.until(lambda: self.current_run()["cosmic"]["turn"] == 1,
                         "Cosmic Cards player rotation")
        self.assertEqual(len(self.current_run()["cosmic"]["discard"]), 2)
        await users[1].close()
        replacement = await self.connect(student=CREW[1])
        await asyncio.gather(*[
            self.action(replacement, "cosmic", 1, "two-red", "play", "b1")
            for _ in range(6)])
        await self.until(lambda: self.current_run()["cosmic"]["turn"] == 2,
                         "Cosmic Cards next player")
        await asyncio.gather(*[
            self.action(users[2], "cosmic", 2, "three-red", "play", "c1")
            for _ in range(6)])
        await self.until(lambda: len(self.current_run()["cosmic"]["discard"]) == 4,
                         "three legitimate card plays")
        self.assertEqual(self.current_run()["cosmic"]["turn"], 0)
        self.assertEqual(
            [card["id"] for card in self.current_run()["cosmic"]["discard"]],
            ["top", "a1", "b1", "c1"])
        self.assertEqual(self.current_run()["cosmic"]["status"], "playing")
        self.assertEqual(self.disk()["cosmic"]["turn"], 0)
        shared2 = await self.connect("shared")
        screen = await self.view(shared2, lambda s:
            len(s["activityRun"]["cosmic"]["discard"]) == 4,
            "Cosmic Cards projector")
        self.assertEqual(screen["activityRun"]["cosmic"]["hands"], {})
        self.assertTrue(all(card is None
                            for card in screen["activityRun"]["cosmic"]["deck"]))
        spectator = await self.connect(student=CREW[8])
        projected = await self.view(spectator, lambda s:
            len(s["activityRun"]["cosmic"]["discard"]) == 4,
            "Cosmic Cards spectator")
        self.assertEqual(projected["activityRun"]["cosmic"]["hands"], {})
        player = await self.connect(student=CREW[0])
        own = await self.view(player, lambda s:
            len(s["activityRun"]["cosmic"]["discard"]) == 4 and any(
                st.get("studentToken") == CREW[0]["studentToken"]
                for st in s["students"]),
            "Cosmic Cards private hand")
        self.assertEqual(set(own["activityRun"]["cosmic"]["hands"]), {"Crew00"})

    async def receipt(self, socket, request_id):
        for _ in range(100):
            packet = await socket.receive_json(timeout=10)
            if packet.get("type") == "signal_sequence_ack" and packet.get("id") == request_id:
                return packet
        self.fail("Signal Sequence ACK not received for " + request_id)

    async def test_signal_sequence_rapid_press_ack_and_refresh_without_replay(self):
        app.save_runtime_state(classroom("signal"))
        teacher, shared, users = await self.room()
        await asyncio.gather(*[
            self.action(users[i], "signal", i, f"outsider-{i}",
                        "tap", extra={"signal": 0})
            for i in range(1, 12)])
        await self.action(users[0], "signal", 0, "first-note", "tap",
                          extra={"signal": 0})
        await self.until(lambda: self.current_run()["signalSequence"]["progress"] == 1,
                         "first valid signal press")
        accepted = await self.receipt(users[0], "first-note")
        self.assertTrue(accepted["ok"])
        await asyncio.gather(*[
            self.action(users[0], "signal", 0, "first-note", "tap",
                        extra={"signal": 0})
            for _ in range(5)])
        repeat = await self.receipt(users[0], "first-note")
        self.assertFalse(repeat["ok"])
        self.assertEqual(self.current_run()["signalSequence"]["progress"], 1)
        await users[0].close()
        pilot = await self.connect(student=CREW[0])
        await self.action(pilot, "signal", 0, "second-note", "tap",
                          extra={"signal": 2})
        self.assertTrue((await self.receipt(pilot, "second-note"))["ok"])
        await self.until(lambda: self.current_run()["signalSequence"]["progress"] == 2,
                         "second valid signal")
        await self.action(pilot, "signal", 0, "final-note", "tap",
                          extra={"signal": 1})
        self.assertTrue((await self.receipt(pilot, "final-note"))["ok"])
        await self.until(lambda: self.current_run()["signalSequence"]["phase"] == "success",
                         "Signal Sequence completed")
        self.assertEqual(self.current_run()["signalSequence"]["best"], 3)
        self.assertEqual(self.disk()["signalSequence"]["phase"], "success")
        await self.action(pilot, "signal", 0, "final-note", "tap",
                          extra={"signal": 1})
        self.assertFalse((await self.receipt(pilot, "final-note"))["ok"])
        projector = await self.connect("shared")
        public = await self.view(projector, lambda s:
            s["activityRun"]["signalSequence"]["phase"] == "success",
            "Signal Sequence shared victory")
        self.assertEqual(public["activityRun"]["signalSequence"]["sequence"], [])
        self.assertNotIn("lastIds",
                         public["activityRun"]["signalSequence"])
        self.assertTrue(all("studentToken" not in s for s in public["students"]))


if __name__ == "__main__":
    unittest.main()
