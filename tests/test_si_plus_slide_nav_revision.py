"""SI+ navigation sequencing: stale teacher packets cannot overwrite the live slide."""
import copy
import unittest
from server import _stale_si_plus_navigation

def run(revision,index,token="shared-run",phase="running"):
    return {
        "activities":[{"id":"deck","type":"presentation","name":"Class deck"}],
        "activityRun":{"activityId":"deck","runToken":token,"phase":phase,
            "slideIndex":index,"siPlusNavRevision":revision,"responses":{}}
    }

class TestSINavigationRevision(unittest.TestCase):
    def test_reject_previous_slide_sequence(self):
        self.assertTrue(_stale_si_plus_navigation(run(3,1),run(2,2)))
        self.assertTrue(_stale_si_plus_navigation(run(3,1),run(0,0)))
    def test_reject_same_sequence_conflicting_index(self):
        self.assertTrue(_stale_si_plus_navigation(run(3,1),run(3,0)))
    def test_allow_teacher_previous_and_jump(self):
        self.assertFalse(_stale_si_plus_navigation(run(3,3),run(4,1)))
        self.assertFalse(_stale_si_plus_navigation(run(4,1),run(5,4)))
    def test_allow_regular_presentation_updates_and_new_runs(self):
        self.assertFalse(_stale_si_plus_navigation(run(3,2),run(3,2)))
        self.assertFalse(_stale_si_plus_navigation(run(3,2),run(0,0,token="new-run")))
        old=run(4,2);old["activities"][0]["type"]="bingo"
        self.assertFalse(_stale_si_plus_navigation(old,run(3,1)))
    def test_legacy_missing_revision_still_hydrates(self):
        old=run(0,0)
        del old["activityRun"]["siPlusNavRevision"]
        new=copy.deepcopy(old)
        new["activityRun"]["slideIndex"]=1
        self.assertFalse(_stale_si_plus_navigation(old,new))

if __name__=="__main__":unittest.main()
