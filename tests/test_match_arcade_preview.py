"""MATCH Memory Boost classroom regression coverage (no browser required)."""
import copy
import time
import unittest

from server import _match_apply_request


def fresh():
    cards = [
        {"id":"a1","pairId":"a","content":{"type":"text","value":"CAT"}},
        {"id":"a2","pairId":"a","content":{"type":"text","value":"CAT"}},
        {"id":"b1","pairId":"b","content":{"type":"text","value":"DOG"}},
        {"id":"b2","pairId":"b","content":{"type":"text","value":"DOG"}},
    ]
    m = {
        "cards":cards, "selected":[], "matched":[], "scores":{}, "teamScores":{},
        "activeStudentIndex":0, "attempts":0, "locked":False, "teacherLocked":False,
        "pendingResolution":None, "previewUntil":0, "complete":False, "history":[],
        "message":"Board ready"
    }
    r = {"activityId":"match-game","phase":"running",
         "matchConfig":{"mode":"individual","scoring":"pairs","turnRule":"one_each"},
         "match":m}
    s = {"students":[{"n":"Alex","offline":False},{"n":"Bella","offline":False}],
         "activityRun":r}
    return s,r,m


def action(state,run,name,kind,value="",teacher=False):
    _match_apply_request(state,run,name,{"type":kind,"value":value},teacher=teacher)


class MatchMemoryBoostTests(unittest.TestCase):
    def test_only_teacher_can_preview(self):
        s,r,m=fresh()
        action(s,r,"Alex","preview",teacher=False)
        self.assertEqual(m["previewUntil"],0)
        action(s,r,"Teacher","preview",teacher=True)
        self.assertGreater(m["previewUntil"],int(time.time()*1000)+5000)
        self.assertLessEqual(m["previewUntil"],int(time.time()*1000)+8500)

    def test_preview_preserves_cards_scores_and_turn(self):
        s,r,m=fresh()
        old=copy.deepcopy({k:m[k] for k in ("cards","matched","selected","scores","activeStudentIndex","attempts")})
        action(s,r,"Teacher","preview",teacher=True)
        self.assertEqual(old,{k:m[k] for k in old})

    def test_student_cannot_pick_while_preview_active(self):
        s,r,m=fresh()
        action(s,r,"Teacher","preview",teacher=True)
        action(s,r,"Alex","select","a1")
        self.assertEqual(m["selected"],[])
        self.assertEqual(m["attempts"],0)

    def test_another_student_cannot_override_preview(self):
        s,r,m=fresh()
        action(s,r,"Teacher","preview",teacher=True)
        before=m["previewUntil"]
        action(s,r,"Bella","preview_stop",teacher=False)
        action(s,r,"Bella","preview",teacher=False)
        self.assertEqual(m["previewUntil"],before)

    def test_preview_ends_automatically_by_timestamp(self):
        s,r,m=fresh()
        m["previewUntil"]=int(time.time()*1000)-1
        action(s,r,"Alex","select","a1")
        self.assertEqual(m["selected"],["a1"])

    def test_teacher_can_stop_preview_early(self):
        s,r,m=fresh()
        action(s,r,"Teacher","preview",teacher=True)
        action(s,r,"Teacher","preview_stop",teacher=True)
        self.assertEqual(m["previewUntil"],0)
        action(s,r,"Alex","select","a1")
        self.assertEqual(m["selected"],["a1"])

    def test_preview_rejected_mid_turn(self):
        s,r,m=fresh()
        action(s,r,"Alex","select","a1")
        action(s,r,"Teacher","preview",teacher=True)
        self.assertEqual(m["previewUntil"],0)

    def test_preview_rejected_during_pair_resolution(self):
        s,r,m=fresh()
        m["pendingResolution"]={"result":"miss","cards":["a1","b1"]}
        action(s,r,"Teacher","preview",teacher=True)
        self.assertEqual(m["previewUntil"],0)

    def test_mismatches_continue_working(self):
        s,r,m=fresh()
        action(s,r,"Alex","select","a1")
        action(s,r,"Alex","select","b1")
        self.assertEqual(m["pendingResolution"]["result"],"miss")
        self.assertEqual(m["attempts"],1)

    def test_correct_matches_continue_working(self):
        s,r,m=fresh()
        action(s,r,"Alex","select","a1")
        action(s,r,"Alex","select","a2")
        self.assertEqual(m["pendingResolution"]["result"],"match")
        self.assertEqual(len(m["matched"]),2)
        self.assertEqual(m["scores"]["Alex"],1)

    def test_auto_award_once_and_no_manual_double_credit(self):
        s,r,m=fresh()
        action(s,r,"Alex","select","a1")
        action(s,r,"Alex","select","a2")
        self.assertEqual(m["scores"]["Alex"],1)
        self.assertEqual(m["attempts"],1)
        action(s,r,"Teacher","mark_match",teacher=True)
        action(s,r,"Teacher","mark_match",teacher=True)
        self.assertEqual(m["scores"]["Alex"],1)
        self.assertEqual(len(m["matched"]),2)
        action(s,r,"Teacher","resolve",teacher=True)
        self.assertEqual(m["scores"]["Alex"],1)
        self.assertEqual(m["activeStudentIndex"],1)
        action(s,r,"Bella","select","b1")
        action(s,r,"Bella","select","b2")
        self.assertEqual(m["scores"]["Bella"],1)
        self.assertEqual(len(m["matched"]),4)
        action(s,r,"Teacher","resolve",teacher=True)
        self.assertTrue(m["complete"])
        self.assertEqual(sum(m["scores"].values()),2)

    def test_auto_score_team_without_manual_mark(self):
        s,r,m=fresh()
        r["matchConfig"].update(mode="teams",teamCount=2,teamAssignments={"Alex":0,"Bella":1})
        m["activeTeam"]=0
        action(s,r,"Alex","select","a1")
        action(s,r,"Alex","select","a2")
        self.assertEqual(m["scores"]["Alex"],1)
        self.assertEqual(m["teamScores"].get("0"),1)
        action(s,r,"Teacher","mark_match",teacher=True)
        self.assertEqual(m["teamScores"].get("0"),1)

    def test_no_score_mode_still_detects_pairs(self):
        s,r,m=fresh()
        r["matchConfig"]["scoring"]="no_score"
        action(s,r,"Alex","select","a1")
        action(s,r,"Alex","select","a2")
        self.assertEqual(len(m["matched"]),2)
        self.assertEqual(m["scores"],{})
        self.assertEqual(m["teamScores"],{})

    def test_mismatch_never_awards_points(self):
        s,r,m=fresh()
        action(s,r,"Alex","select","a1")
        action(s,r,"Alex","select","b1")
        self.assertEqual(m["pendingResolution"]["result"],"miss")
        self.assertEqual(m["scores"],{})
        self.assertEqual(m["matched"],[])


if __name__=="__main__":
    unittest.main()
