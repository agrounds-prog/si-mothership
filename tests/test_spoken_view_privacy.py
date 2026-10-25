"""Classroom socket privacy for spoken (and legacy typed) game-show modes.

Uses synthetic state only; never contacts Railway or persistent /data.
"""
import copy
import unittest

from server import _state_for_role


def pixel_fixture(mode="verbal"):
    return {
        "students": [
            {"n": "Alex", "studentToken": "alex-token"},
            {"n": "Blair", "studentToken": "blair-token"},
        ],
        "activityRun": {
            "activityId": "pixel-game", "phase": "running",
            "pixelConfig": {
                "name": "Mystery QA", "answer": "Orangutan",
                "acceptedAnswers": ["Orangutan", "Primate"],
                "answerMode": mode,
            },
            "pixelRevealAll": False, "pixelShowResults": False,
            "pixelGuesses": {
                "Alex": {"guess": "Orangutan", "source": mode,
                         "teacherCorrect": True, "at": 1234},
                "Blair": {"guess": "Banana", "source": mode,
                          "teacherCorrect": False, "at": 1235},
            },
        },
    }


class PixelAndSpokenPrivacy(unittest.TestCase):
    def test_unrevealed_verbal_answer_hidden_from_shared_and_student_payloads(self):
        state = pixel_fixture()
        before = copy.deepcopy(state)
        teacher = _state_for_role(state, "teacher")["activityRun"]
        self.assertEqual(teacher["pixelConfig"]["answer"], "Orangutan")
        shared = _state_for_role(state, "shared")["activityRun"]
        self.assertNotIn("answer", shared["pixelConfig"])
        self.assertNotIn("acceptedAnswers", shared["pixelConfig"])
        self.assertEqual(set(shared["pixelGuesses"]), {"Alex", "Blair"})
        self.assertEqual(shared["pixelGuesses"]["Alex"], {"at": 1234})
        self.assertNotIn("Orangutan", repr(shared))
        student = _state_for_role(state, "student", token="alex-token")["activityRun"]
        self.assertNotIn("answer", student["pixelConfig"])
        self.assertEqual(set(student["pixelGuesses"]), {"Alex"})
        self.assertEqual(student["pixelGuesses"]["Alex"]["guess"], "Spoken answer")
        self.assertTrue(student["pixelGuesses"]["Alex"]["teacherCorrect"])
        self.assertNotIn("Orangutan", repr(student))
        self.assertEqual(state, before, "view filtering cannot mutate canonical classroom state")

    def test_legacy_typed_guesses_private_and_unrevealed_key_hidden(self):
        state = pixel_fixture("type")
        shared = _state_for_role(state, "shared")["activityRun"]
        self.assertNotIn("answer", shared["pixelConfig"])
        self.assertEqual(len(shared["pixelGuesses"]), 2, "projector progress count preserved")
        self.assertNotIn("Banana", repr(shared))
        alex = _state_for_role(state, "student", token="alex-token")["activityRun"]
        self.assertEqual(set(alex["pixelGuesses"]), {"Alex"})
        self.assertNotIn("acceptedAnswers", alex["pixelConfig"])
        self.assertEqual(alex["pixelGuesses"]["Alex"]["guess"], "Orangutan",
                         "a student keeps their own typed answer only")
        blair = _state_for_role(state, "student", token="blair-token")["activityRun"]
        self.assertEqual(blair["pixelGuesses"]["Blair"]["guess"], "Banana")
        unknown = _state_for_role(state, "student", token="wrong-token")["activityRun"]
        self.assertEqual(unknown["pixelGuesses"], {})

    def test_correct_answer_published_only_after_results_and_full_reveal(self):
        state = pixel_fixture()
        state["activityRun"]["pixelRevealAll"] = True
        hidden = _state_for_role(state, "shared")["activityRun"]
        self.assertNotIn("answer", hidden["pixelConfig"],
                         "removing tiles alone is not publishing the answer")
        state["activityRun"]["pixelRevealAll"] = False
        state["activityRun"]["pixelShowResults"] = True
        hidden = _state_for_role(state, "shared")["activityRun"]
        self.assertNotIn("answer", hidden["pixelConfig"])
        state["activityRun"]["pixelRevealAll"] = True
        revealed = _state_for_role(state, "shared")["activityRun"]
        self.assertEqual(revealed["pixelConfig"]["answer"], "Orangutan")
        self.assertIn("acceptedAnswers", revealed["pixelConfig"])
        self.assertEqual(revealed["pixelGuesses"]["Alex"]["guess"], "Orangutan")

    def test_crew_survey_and_million_keys_stay_teacher_only(self):
        state = {
            "students": [{"n": "Alex", "studentToken": "alex-token"}],
            "activityRun": {
                "activityId": "crew-survey-game", "phase": "running",
                "crewSurveyConfig": {
                    "answerMode": "verbal",
                    "answers": [{"text": "Pencils", "value": 30},
                                {"text": "Notebooks", "value": 20}]},
                "crewSurvey": {"revealed": [], "privateResponses": {},
                               "stage": "faceoff"},
            },
        }
        for role, token in (("shared", ""), ("student", "alex-token")):
            run = _state_for_role(state, role, token=token)["activityRun"]
            self.assertEqual(run["crewSurveyConfig"]["answers"][0]["text"], "")
            self.assertEqual(run["crewSurveyConfig"]["answers"][0]["value"], 0)
        state["activityRun"] = {
            "activityId": "million-game", "phase": "running",
            "millionConfig": {"answerMode": "verbal", "questions": [
                {"prompt": "Q1", "correct": "B", "choices": [
                    {"key": k, "text": k} for k in "ABCD"]},
                {"prompt": "Q2 hidden", "correct": "D"}]},
            "million": {"questionIndex": 0, "crewPredictions": {}, "pilot": "Alex"},
        }
        for role, token in (("shared", ""), ("student", "alex-token")):
            run = _state_for_role(state, role, token=token)["activityRun"]
            self.assertNotIn("correct", run["millionConfig"]["questions"][0])
            self.assertEqual(run["millionConfig"]["questions"][1]["prompt"], "")
        self.assertEqual(_state_for_role(state, "teacher")["activityRun"]
                         ["millionConfig"]["questions"][0]["correct"], "B")


if __name__ == "__main__":
    unittest.main()
