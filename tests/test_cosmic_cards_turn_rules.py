"""Regressions for server-authoritative Cosmic Cards classroom turns and privacy."""
import copy
import unittest

from cosmic_cards_server import apply_cosmic_action, redact_cosmic_state


def card(cid, color, value):
    return {"id": cid, "color": color, "value": value}


def game(rule="next", alex=None, blair=None, casey=None):
    players = ["Alex", "Blair", "Casey"]
    hands = {
        "Alex": alex if alex is not None else [card("a1", "red", "2"), card("a2", "red", "5")],
        "Blair": blair if blair is not None else [card("b1", "green", "8")],
        "Casey": casey if casey is not None else [card("c1", "yellow", "4")],
    }
    g = {
        "players": players, "hands": hands,
        "deck": [card("d1", "blue", "7"), card("d2", "yellow", "3")],
        "discard": [card("top", "red", "9")],
        "color": "red", "turn": 0, "direction": 1,
        "drawnId": "", "chainOpen": False,
        "turnRule": rule, "called": {},
        "status": "playing", "winner": None, "message": "",
    }
    run = {"activityId": "cosmic-cards-game", "phase": "running",
           "runToken": "test-token", "cosmic": g}
    state = {"activityRun": run}
    return state, run, g


class CosmicCardsTurnTests(unittest.TestCase):
    def act(self, state, run, kind, name="Alex", value="", color="", rid="req1", token="test-token"):
        return apply_cosmic_action(state, run, name, {
            "type": kind, "value": value, "color": color,
            "id": rid, "runToken": token,
        })

    def test_next_is_default(self):
        state, run, g = game("next")
        self.assertTrue(self.act(state, run, "play", value="a1"))
        self.assertEqual(g["turn"], 1)
        self.assertFalse(g["chainOpen"])

    def test_continue_keeps_player_when_another_card_matches(self):
        state, run, g = game("continue")
        self.assertTrue(self.act(state, run, "play", value="a1"))
        self.assertEqual(g["turn"], 0)
        self.assertTrue(g["chainOpen"])
        self.assertTrue(self.act(state, run, "play", value="a2", rid="req2"))
        self.assertEqual(g["winner"], "Alex")

    def test_end_turn_only_after_play(self):
        state, run, g = game("continue")
        self.assertFalse(self.act(state, run, "pass"))
        self.assertTrue(self.act(state, run, "play", value="a1", rid="req2"))
        self.assertTrue(self.act(state, run, "pass", rid="req3"))
        self.assertEqual(g["turn"], 1)
        self.assertFalse(g["chainOpen"])

    def test_automatic_pass_without_second_match(self):
        state, run, g = game("continue", alex=[
            card("a1", "red", "2"), card("a2", "blue", "6")
        ])
        self.assertTrue(self.act(state, run, "play", value="a1"))
        self.assertEqual(g["turn"], 1)
        self.assertFalse(g["chainOpen"])

    def test_skip_remains_effective(self):
        state, run, g = game("continue", alex=[
            card("a1", "red", "skip"), card("a2", "red", "6")
        ])
        self.assertTrue(self.act(state, run, "play", value="a1"))
        self.assertEqual(g["turn"], 2)
        self.assertFalse(g["chainOpen"])

    def test_reverse_remains_effective(self):
        state, run, g = game("continue", alex=[
            card("a1", "red", "reverse"), card("a2", "red", "6")
        ])
        self.assertTrue(self.act(state, run, "play", value="a1"))
        self.assertEqual(g["direction"], -1)
        self.assertEqual(g["turn"], 2)

    def test_wild_can_chain_in_chosen_color(self):
        state, run, g = game("continue", alex=[
            card("w1", "wild", "wild"), card("a2", "blue", "7")
        ])
        self.assertTrue(self.act(state, run, "play", value="w1", color="blue"))
        self.assertEqual(g["turn"], 0)
        self.assertTrue(g["chainOpen"])
        self.assertEqual(g["color"], "blue")

    def test_invalid_card_and_turn_rejected(self):
        state, run, g = game("continue")
        self.assertFalse(self.act(state, run, "play", name="Blair", value="b1"))
        self.assertFalse(self.act(state, run, "play", value="a1", token="wrong-token"))
        self.assertFalse(self.act(state, run, "play", value="b1"))
        self.assertEqual(g["turn"], 0)
        self.assertEqual(len(g["discard"]), 1)

    def test_duplicate_request_is_idempotent(self):
        state, run, g = game("continue")
        self.assertTrue(self.act(state, run, "play", value="a1"))
        self.assertFalse(self.act(state, run, "play", value="a1"))
        self.assertEqual(len(g["discard"]), 2)

    def test_draw_reuses_existing_turn_handling(self):
        state, run, g = game("continue")
        self.assertTrue(self.act(state, run, "draw"))
        self.assertEqual(g["turn"], 1)
        self.assertFalse(g["chainOpen"])

    def test_announcement_after_turn_rotation(self):
        state, run, g = game("next")
        self.assertTrue(self.act(state, run, "play", value="a1"))
        self.assertTrue(self.act(state, run, "cosmic", name="Alex", rid="req2"))
        self.assertTrue(g["called"]["Alex"])

    def test_student_cannot_change_rule_with_action_payload(self):
        state, run, g = game("next")
        req = {"id": "req1", "type": "play", "value": "a1",
               "runToken": "test-token", "turnRule": "continue"}
        self.assertTrue(apply_cosmic_action(state, run, "Alex", req))
        self.assertEqual(g["turnRule"], "next")

    def test_role_redaction_keeps_other_hands_private(self):
        state, run, g = game("continue")
        out = copy.deepcopy(state)
        redact_cosmic_state(out, "student", "Alex")
        sanitized = out["activityRun"]["cosmic"]
        self.assertEqual(set(sanitized["hands"]), {"Alex"})
        self.assertEqual(sanitized["counts"], {"Alex": 2, "Blair": 1, "Casey": 1})
        self.assertEqual(len(sanitized["deck"]), len(g["deck"]))
        self.assertTrue(all(x is None for x in sanitized["deck"]))

        public = copy.deepcopy(state)
        redact_cosmic_state(public, "shared", "")
        self.assertFalse(public["activityRun"]["cosmic"]["hands"])
        self.assertEqual(len(public["activityRun"]["cosmic"]["deck"]), len(g["deck"]))


if __name__ == "__main__":
    unittest.main()
