"""Signal Sequence Phase 2 server-authoritative Survival/Relay and privacy."""
import copy
import unittest
from signal_sequence_server import apply_signal_sequence_action as apply, redact_signal_sequence_state as redact

def run(mode):
    people=["Ada","Beck","Cal"]
    return {"activityId":"signal-sequence-game","phase":"running","runToken":"mode-run",
      "signalSequence":{"mode":mode,"signals":8,"participants":people,"pilot":"THE CREW" if mode=="survival" else "Ada",
        "phase":"input","sequence":[7,4],"progress":0,"round":2,"best":0,"lastIds":[],
        "entries":{p:{"progress":0,"status":"playing","roundsSurvived":0} for p in people}}}

def action(signal,id):
    return {"signal":signal,"id":id,"runToken":"mode-run"}

class Phase2Tests(unittest.TestCase):
 def test_survival_personal_progress_and_rejections(self):
    r=run("survival")
    self.assertFalse(apply({},r,"Other",action(7,"bad")))
    self.assertFalse(apply({},r,"Ada",action(9,"invalid")))
    self.assertFalse(apply({},r,"Ada",dict(action(7,"wrongrun"),runToken="old")))
    self.assertTrue(apply({},r,"Ada",action(7,"a1")))
    self.assertFalse(apply({},r,"Ada",action(7,"a1")))
    self.assertEqual(r["signalSequence"]["entries"]["Ada"]["progress"],1)
    self.assertEqual(r["signalSequence"]["entries"]["Beck"]["progress"],0)
    self.assertTrue(apply({},r,"Beck",action(0,"b1")))
    self.assertEqual(r["signalSequence"]["entries"]["Beck"]["status"],"out")
    self.assertFalse(apply({},r,"Beck",action(7,"b2")))
    self.assertTrue(apply({},r,"Ada",action(4,"a2")))
    self.assertEqual(r["signalSequence"]["entries"]["Ada"]["status"],"cleared")
    self.assertEqual(r["signalSequence"]["phase"],"input")
    self.assertTrue(apply({},r,"Cal",action(7,"c1")))
    self.assertTrue(apply({},r,"Cal",action(4,"c2")))
    self.assertEqual(r["signalSequence"]["phase"],"success")
    self.assertEqual(r["signalSequence"]["best"],2)
 def test_relay_passes_to_next_student_and_checks_symbols(self):
    r=run("relay")
    self.assertFalse(apply({},r,"Beck",action(7,"notturn")))
    self.assertTrue(apply({},r,"Ada",action(7,"a1")))
    self.assertEqual(r["signalSequence"]["pilot"],"Beck")
    self.assertFalse(apply({},r,"Ada",action(4,"double")))
    self.assertTrue(apply({},r,"Beck",action(4,"b1")))
    self.assertEqual(r["signalSequence"]["phase"],"success")
    r=run("relay")
    self.assertTrue(apply({},r,"Ada",action(0,"bad")))
    self.assertEqual(r["signalSequence"]["phase"],"failed")
 def test_redaction_keeps_only_own_progress_and_watch_notes(self):
    base={"activityRun":run("survival")}
    public=copy.deepcopy(base)
    redact(public,"shared","")
    g=public["activityRun"]["signalSequence"]
    self.assertEqual(g["sequence"],[])
    self.assertNotIn("lastIds",g)
    self.assertNotIn("progress",g["entries"]["Ada"])
    private=copy.deepcopy(base)
    redact(private,"student","Ada")
    g=private["activityRun"]["signalSequence"]
    self.assertEqual(g["entries"]["Ada"]["progress"],0)
    self.assertNotIn("progress",g["entries"]["Beck"])
    watch=copy.deepcopy(base);watch["activityRun"]["signalSequence"]["phase"]="watch"
    redact(watch,"student","Ada")
    self.assertEqual(watch["activityRun"]["signalSequence"]["sequence"],[7,4])
 def test_existing_classic_defaults_remain_valid(self):
    r=run("classic");r["signalSequence"].update({"pilot":"Ada","signals":4,"sequence":[0,2]})
    self.assertTrue(apply({},r,"Ada",action(0,"a1")))
    self.assertTrue(apply({},r,"Ada",action(2,"a2")))
    self.assertEqual(r["signalSequence"]["phase"],"success")

if __name__=="__main__":unittest.main()
