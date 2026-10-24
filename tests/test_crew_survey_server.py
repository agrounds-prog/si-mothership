"""Crew Survey server authority across face-offs, turn-taking and completed rounds."""
import copy
import unittest

from server import _crew_survey_apply_request


def fixture():
    survey = {
        "stage": "faceoff", "teams": [["Alex", "Casey"], ["Blair"]],
        "activeIndexes": [1, 0], "controlTeam": None,
        "buzzer": {"armed": True, "eligible": ["Casey", "Blair"],
                   "winner": None, "lockedAt": None},
        "privateResponses": {}, "lastResponse": None,
    }
    run = {"activityId": "crew-survey-game", "phase": "running",
           "crewSurvey": survey}
    return {"activityRun": run}, run, survey


def req(name, rid, action, value=""):
    return {"id": rid, "name": name, "type": action, "value": value, "at": 1234}


class CrewSurveyServerRules(unittest.TestCase):
    def test_first_valid_buzzer_wins_and_locks_out_others(self):
        state, run, cs = fixture()
        _crew_survey_apply_request(state, run, "Alex", req("Alex", "one", "buzz"))
        self.assertIsNone(cs["buzzer"]["winner"])
        _crew_survey_apply_request(state, run, "Casey", req("Casey", "two", "buzz"))
        self.assertEqual(cs["buzzer"]["winner"], "Casey")
        self.assertFalse(cs["buzzer"]["armed"])
        _crew_survey_apply_request(state, run, "Blair", req("Blair", "three", "buzz"))
        self.assertEqual(cs["buzzer"]["winner"], "Casey")

    def test_verbal_mode_accepts_buzz_but_rejects_all_student_answer_submissions(self):
        state, run, cs = fixture()
        run["crewSurveyConfig"] = {"answerMode": "verbal"}
        _crew_survey_apply_request(state, run, "Casey", req("Casey", "vb1", "buzz"))
        self.assertEqual(cs["buzzer"]["winner"], "Casey")
        _crew_survey_apply_request(state, run, "Casey", req("Casey", "vb2", "answer", "Pencil"))
        self.assertEqual(cs["privateResponses"], {})
        self.assertIsNone(cs["lastResponse"])
        cs["stage"] = "play"
        cs["controlTeam"] = 0
        _crew_survey_apply_request(state, run, "Casey", req("Casey", "vb3", "answer", "Notebook"))
        self.assertEqual(cs["privateResponses"], {})
        cs["stage"] = "steal"
        cs["controlTeam"] = 1
        _crew_survey_apply_request(state, run, "Blair", req("Blair", "vb4", "answer", "Folder"))
        self.assertEqual(cs["privateResponses"], {})

    def test_older_boards_remain_in_typing_mode(self):
        state, run, cs = fixture()
        run["crewSurveyConfig"] = {}  # legacy saved board
        _crew_survey_apply_request(state, run, "Casey", req("Casey", "old-buzz", "buzz"))
        _crew_survey_apply_request(state, run, "Casey", req("Casey", "old-answer", "answer", "Pencil"))
        self.assertEqual(cs["privateResponses"]["Casey"]["text"], "Pencil")

    def test_late_buzzer_is_not_accepted_in_play_steal_or_completed_round(self):
        for stage in ("play", "steal", "roundwon"):
            state, run, cs = fixture()
            cs["stage"] = stage
            _crew_survey_apply_request(state, run, "Casey", req("Casey", stage, "buzz"))
            self.assertIsNone(cs["buzzer"]["winner"], stage)

    def test_only_winner_or_current_student_can_submit_privately(self):
        state, run, cs = fixture()
        _crew_survey_apply_request(state, run, "Casey", req("Casey", "b1", "buzz"))
        _crew_survey_apply_request(state, run, "Alex", req("Alex", "a1", "answer", "wrong"))
        self.assertEqual(cs["privateResponses"], {})
        _crew_survey_apply_request(state, run, "Casey", req("Casey", "a2", "answer", "Pencil"))
        self.assertEqual(cs["privateResponses"]["Casey"]["text"], "Pencil")
        cs["stage"] = "play"
        cs["controlTeam"] = 0
        _crew_survey_apply_request(state, run, "Alex", req("Alex", "a3", "answer", "wrong"))
        self.assertNotIn("Alex", cs["privateResponses"])
        _crew_survey_apply_request(state, run, "Casey", req("Casey", "a4", "answer", "Notebook"))
        self.assertEqual(cs["privateResponses"]["Casey"]["text"], "Notebook")
        cs["stage"] = "steal"
        cs["controlTeam"] = 1
        _crew_survey_apply_request(state, run, "Blair", req("Blair", "a5", "answer", "Folder"))
        self.assertEqual(cs["privateResponses"]["Blair"]["text"], "Folder")
        cs["stage"] = "roundwon"
        saved = copy.deepcopy(cs["privateResponses"])
        _crew_survey_apply_request(state, run, "Casey", req("Casey", "a6", "answer", "late"))
        _crew_survey_apply_request(state, run, "Blair", req("Blair", "a7", "answer", "late"))
        self.assertEqual(cs["privateResponses"], saved)


if __name__ == "__main__":
    unittest.main()
