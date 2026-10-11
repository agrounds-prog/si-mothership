import copy
import unittest
from dominoes_server import apply_dominoes_action, redact_dominoes_state


class DominoesPrivacyTest(unittest.TestCase):
    def fixture(self):
        hands = {
            "Alex": [{"id": "a", "a": 1, "b": 6}, {"id": "x", "a": 3, "b": 5}],
            "Sam": [{"id": "b", "a": 2, "b": 6}, {"id": "q", "a": 4, "b": 4}],
        }
        g = {
            "version": 1, "players": ["Alex", "Sam"], "hands": hands,
            "bag": [{"id": "d", "a": 1, "b": 3}],
            "chain": [], "turn": 0, "status": "playing", "scores": {"Alex": 0, "Sam": 0},
            "consecutivePasses": 0, "lastRequestIds": [], "round": 1,
        }
        run = {"activityId": "dominoes-game", "runToken": "test-secret", "phase": "running", "dominoes": g}
        return {"activityRun": run}, run, g

    def req(self, typ, id_, **kwargs):
        return {"id": id_, "runToken": "test-secret", "type": typ, **kwargs}

    def test_student_identity_and_turn_restrictions(self):
        state, run, g = self.fixture()
        req = self.req("play", "m1", tileId="a", side="right")
        self.assertFalse(apply_dominoes_action(state, run, "Sam", req))
        self.assertFalse(apply_dominoes_action(state, run, "Guest", req))
        self.assertFalse(apply_dominoes_action(state, run, "Alex", dict(req, runToken="wrong")))
        self.assertTrue(apply_dominoes_action(state, run, "Alex", req))
        self.assertEqual(len(g["chain"]), 1)
        self.assertEqual(g["turn"], 1)
        self.assertFalse(apply_dominoes_action(state, run, "Sam", req))  # replay request
        self.assertFalse(apply_dominoes_action(state, run, "Sam", self.req("play", "m2", tileId="a", side="right")))

    def test_server_orients_domino_and_requires_matching_end(self):
        state, run, g = self.fixture()
        self.assertTrue(apply_dominoes_action(state, run, "Alex", self.req("play", "m1", tileId="a", side="right")))
        self.assertFalse(apply_dominoes_action(state, run, "Sam", self.req("play", "m2", tileId="q", side="right")))
        self.assertTrue(apply_dominoes_action(state, run, "Sam", self.req("play", "m3", tileId="b", side="right")))
        self.assertEqual((g["chain"][0]["left"], g["chain"][-1]["right"]), (1, 2))

    def test_draw_only_when_no_play_and_pass_only_after_empty_pile(self):
        state, run, g = self.fixture()
        self.assertFalse(apply_dominoes_action(state, run, "Alex", self.req("draw", "d1")))
        self.assertTrue(apply_dominoes_action(state, run, "Alex", self.req("play", "p1", tileId="a", side="right")))
        g["hands"]["Sam"] = [{"id": "q", "a": 4, "b": 4}]
        self.assertFalse(apply_dominoes_action(state, run, "Sam", self.req("pass", "p2")))
        self.assertTrue(apply_dominoes_action(state, run, "Sam", self.req("draw", "d2")))
        self.assertEqual(len(g["bag"]), 0)
        self.assertFalse(apply_dominoes_action(state, run, "Sam", self.req("draw", "d3")))

    def test_student_and_shared_projection_never_receive_other_hands(self):
        state, run, g = self.fixture()
        original = copy.deepcopy(state)
        alex = copy.deepcopy(state)
        redact_dominoes_state(alex, "student", "Alex")
        self.assertEqual(list(alex["activityRun"]["dominoes"]["hands"]), ["Alex"])
        self.assertEqual(alex["activityRun"]["dominoes"]["counts"]["Sam"], 2)
        self.assertEqual(alex["activityRun"]["dominoes"]["bag"], [None])
        self.assertNotIn("lastRequestIds", alex["activityRun"]["dominoes"])
        audience = copy.deepcopy(state)
        redact_dominoes_state(audience, "shared", "")
        self.assertEqual(audience["activityRun"]["dominoes"]["hands"], {})
        self.assertEqual(audience["activityRun"]["dominoes"]["bag"], [None])
        self.assertEqual(state, original)

    def test_blocked_game_picks_least_remaining_pips(self):
        state, run, g = self.fixture()
        g["chain"] = [{"id":"c","a":6,"b":6,"left":6,"right":6}]
        g["bag"] = []
        g["hands"] = {
            "Alex": [{"id":"a","a":0,"b":1}],
            "Sam": [{"id":"b","a":2,"b":3}],
        }
        self.assertTrue(apply_dominoes_action(state, run, "Alex", self.req("pass", "p1")))
        self.assertTrue(apply_dominoes_action(state, run, "Sam", self.req("pass", "p2")))
        self.assertEqual(g["winner"], "Alex")
        self.assertEqual(g["status"], "won")
        self.assertEqual(g["scores"]["Alex"], 5)

if __name__ == "__main__":
    unittest.main()
