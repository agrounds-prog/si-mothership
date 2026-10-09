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


if __name__=="__main__":
    unittest.main()
