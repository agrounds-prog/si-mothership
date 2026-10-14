"""Teacher-only Bingo visual call alerts may not alter gameplay or claims."""
import copy
import unittest

from server import _bingo_apply_request, _bingo_claim_valid


def fixture():
    config = {
        "size": 3, "pattern": "line", "free": False,
        "items": [
            {"id": str(i), "call": {"label": "Item " + str(i)}} for i in range(1, 10)
        ],
    }
    bingo = {
        "called": ["1"], "callOrder": [str(i) for i in range(1, 10)],
        "current": "1", "callNonce": 1,
        "cards": {"Alex": [str(i) for i in range(1, 10)]},
        "marks": {"Alex": []}, "claims": [], "claimResults": {},
        "message": "Called Item 1.",
    }
    run = {"activityId": "bingo-game", "phase": "running",
           "bingoConfig": config, "bingo": bingo}
    return {"activityRun": run}, run, bingo


class BingoStudentCallAlertsTests(unittest.TestCase):
    def test_teacher_can_switch_hints_off_and_back_on(self):
        state, run, bingo = fixture()
        original = copy.deepcopy(bingo)
        self.assertNotIn("studentCallAlerts", bingo)  # legacy games default on
        _bingo_apply_request(state, run, "Teacher",
                             {"type": "student_call_alerts", "value": "off"}, teacher=True)
        self.assertIs(bingo["studentCallAlerts"], False)
        self.assertEqual({key: bingo[key] for key in original}, original)
        _bingo_apply_request(state, run, "Teacher",
                             {"type": "student_call_alerts", "value": "on"}, teacher=True)
        self.assertIs(bingo["studentCallAlerts"], True)
        self.assertEqual({key: bingo[key] for key in original}, original)

    def test_student_cannot_toggle_teacher_setting(self):
        state, run, bingo = fixture()
        _bingo_apply_request(state, run, "Alex",
                             {"type": "student_call_alerts", "value": "off"}, teacher=False)
        self.assertNotIn("studentCallAlerts", bingo)
        _bingo_apply_request(state, run, "Teacher",
                             {"type": "student_call_alerts", "value": "unexpected"}, teacher=True)
        self.assertNotIn("studentCallAlerts", bingo)

    def test_quiet_mode_keeps_calling_marking_and_winner_rules(self):
        state, run, bingo = fixture()
        _bingo_apply_request(state, run, "Teacher",
                             {"type": "student_call_alerts", "value": "off"}, teacher=True)
        _bingo_apply_request(state, run, "Alex",
                             {"type": "mark", "value": "2"}, teacher=False)
        self.assertEqual(bingo["marks"]["Alex"], [])  # uncalled stays ineligible
        _bingo_apply_request(state, run, "Teacher", {"type": "call_next"}, teacher=True)
        self.assertEqual(bingo["called"], ["1", "2"])
        self.assertEqual(bingo["current"], "2")
        _bingo_apply_request(state, run, "Alex",
                             {"type": "mark", "value": "2"}, teacher=False)
        self.assertEqual(set(bingo["marks"]["Alex"]), {"2"})
        self.assertFalse(_bingo_claim_valid(run, "Alex"))
        for i in ("1", "3"):
            if i == "3":
                _bingo_apply_request(state, run, "Teacher", {"type": "call_next"}, teacher=True)
            _bingo_apply_request(state, run, "Alex",
                                 {"type": "mark", "value": i}, teacher=False)
        self.assertTrue(_bingo_claim_valid(run, "Alex"))
        self.assertIs(bingo["studentCallAlerts"], False)


if __name__ == "__main__":
    unittest.main()
