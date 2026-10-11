"""SIGNAL SEQUENCE v1 identity, action and redaction unit tests."""
import copy
import unittest
from signal_sequence_server import apply_signal_sequence_action, redact_signal_sequence_state

def game():
 return {"activityId":"signal-sequence-game","phase":"running","runToken":"run-123",
         "signalSequence":{"pilot":"Ava","phase":"input","sequence":[0,2],"progress":0,
                           "best":0,"round":2,"message":"Repeat","lastIds":[]}}

class SignalServerTest(unittest.TestCase):
 def test_reject_invalid_input_and_duplicate(self):
  run=game()
  req={"signal":0,"id":"a1","runToken":"run-123"}
  self.assertFalse(apply_signal_sequence_action({},run,"Sam",req))
  self.assertFalse(apply_signal_sequence_action({},run,"Ava",dict(req,signal=True)))
  self.assertFalse(apply_signal_sequence_action({},run,"Ava",dict(req,signal=8)))
  self.assertFalse(apply_signal_sequence_action({},run,"Ava",dict(req,runToken="stale")))
  self.assertTrue(apply_signal_sequence_action({},run,"Ava",req))
  self.assertEqual(run["signalSequence"]["progress"],1)
  self.assertFalse(apply_signal_sequence_action({},run,"Ava",req))
  self.assertTrue(apply_signal_sequence_action({},run,"Ava",{"signal":2,"id":"a2","runToken":"run-123"}))
  self.assertEqual(run["signalSequence"]["phase"],"success")
  self.assertEqual(run["signalSequence"]["best"],2)
 def test_wrong_entry_fails_and_locks(self):
  run=game()
  self.assertTrue(apply_signal_sequence_action({},run,"Ava",{"signal":3,"id":"b1","runToken":"run-123"}))
  self.assertEqual(run["signalSequence"]["phase"],"failed")
  self.assertFalse(apply_signal_sequence_action({},run,"Ava",{"signal":0,"id":"b2","runToken":"run-123"}))
 def test_redaction_and_watch_only(self):
  run=game()
  state={"activityRun":run}
  redact_signal_sequence_state(state,"student")
  self.assertEqual(run["signalSequence"]["sequence"],[])
  self.assertNotIn("lastIds",run["signalSequence"])
  watch=game();watch["signalSequence"]["phase"]="watch"
  redact_signal_sequence_state({"activityRun":watch},"shared")
  self.assertEqual(watch["signalSequence"]["sequence"],[0,2])
 def test_canonical_game_is_not_modified_by_role_safe_copy(self):
  r=game();copy_state={"activityRun":copy.deepcopy(r)}
  redact_signal_sequence_state(copy_state,"shared")
  self.assertEqual(r["signalSequence"]["sequence"],[0,2])

if __name__=="__main__":unittest.main()
