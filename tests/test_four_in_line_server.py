"""FOUR IN LINE server-authoritative student action regressions."""
import copy
import unittest
from four_in_line_server import apply_four_in_line_action

def fixture():
    return {
        "activityId":"four-in-line-game","phase":"running","runToken":"session-ABC",
        "fourInLine":{"cols":7,"rows":6,"board":[0]*42,"players":["Blue","Gold"],
             "turn":0,"status":"playing","winner":None,"winning":[],"moves":0,"history":[],
             "seats":{"Alex":0,"Sam":1},"message":"Blue starts"}
    }

class FourLineServer(unittest.TestCase):
    def test_rejects_spoofed_turn_bad_seat_token_and_duplicate(self):
        r=fixture();state={}
        req={"column":0,"runToken":"session-ABC","id":"first"}
        self.assertFalse(apply_four_in_line_action(state,r,"Sam",req))
        self.assertFalse(apply_four_in_line_action(state,r,"Spectator",req))
        self.assertFalse(apply_four_in_line_action(state,r,"Alex",dict(req,runToken="old")))
        self.assertFalse(apply_four_in_line_action(state,r,"Alex",dict(req,column=7)))
        self.assertFalse(apply_four_in_line_action(state,r,"Alex",dict(req,column=True)))
        self.assertTrue(apply_four_in_line_action(state,r,"Alex",req))
        self.assertEqual(r["fourInLine"]["board"][35],1)
        self.assertFalse(apply_four_in_line_action(state,r,"Alex",req))
        self.assertFalse(apply_four_in_line_action(state,r,"Sam",dict(req,id="first",column=1)))
        self.assertTrue(apply_four_in_line_action(state,r,"Sam",dict(req,id="second",column=1)))
        self.assertEqual(r["fourInLine"]["board"][36],2)

    def test_gravity_and_win(self):
        r=fixture();state={}
        for i,col in enumerate([0,0,1,1,2,2,3]):
            name="Alex" if i%2==0 else "Sam"
            self.assertTrue(apply_four_in_line_action(state,r,name,{"column":col,"runToken":"session-ABC","id":str(i)}))
        g=r["fourInLine"]
        self.assertEqual(g["status"],"won")
        self.assertEqual(g["winner"],0)
        self.assertEqual(g["winning"],[35,36,37,38])
        self.assertEqual(len(g["history"]),7)
        self.assertFalse(apply_four_in_line_action(state,r,"Sam",{"column":4,"runToken":"session-ABC","id":"8"}))

    def test_full_column_invalid_and_old_run(self):
        r=fixture();state={}
        for i in range(6):
            who="Alex" if i%2==0 else "Sam"
            self.assertTrue(apply_four_in_line_action(state,r,who,{"column":0,"runToken":"session-ABC","id":str(i)}))
        self.assertFalse(apply_four_in_line_action(state,r,"Alex",{"column":0,"runToken":"session-ABC","id":"full"}))
        assert r["fourInLine"]["status"]=="playing"
        r["runToken"]="new-game"
        self.assertFalse(apply_four_in_line_action(state,r,"Alex",{"column":1,"runToken":"session-ABC","id":"stale"}))

if __name__=="__main__":unittest.main()
