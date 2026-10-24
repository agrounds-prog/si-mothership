"""MILLION multiplayer request and teacher/shared/student privacy regressions.
Uses synthetic classroom state only; never connects to production or /data.
"""
import copy
import unittest

import server

def fixture():
    questions=[
        {"prompt":"Which is the correct answer?","choices":[{"key":k,"text":"Choice "+k} for k in "ABCD"],
         "correct":"B","mothershipClue":"Think of the second letter","explanation":"B is second"},
        {"prompt":"Private second question","choices":[{"key":k,"text":"Choice "+k} for k in "ABCD"],
         "correct":"D","mothershipClue":"Second clue","explanation":"Second explanation"},
    ]
    m={"questionIndex":0,"pilot":"Pilot","pilotIndex":0,"ladderLevel":0,"inventory":{"poll":1,"reduce":1,"clue":1,"tryAgain":1},
       "selectedAnswer":"","lockedAnswer":"","crewPredictions":{},"eliminated":[],"publicClue":"",
       "pollOpen":False,"pollVisible":False,"revealed":False,"result":"","complete":False,"over":False,"message":"Ready"}
    run={"activityId":"million-game","phase":"playing","millionConfig":{"questions":questions,"ladder":[100,1000000],"checkpoints":[],"gameName":"Social Skills Challenge"},"million":m}
    state={"students":[{"n":"Pilot","studentToken":"pilot-token"},{"n":"Crew","studentToken":"crew-token"}],"activityRun":run}
    return state,run,m

class MillionPrivacy(unittest.TestCase):
    def test_crew_and_teacher_lock_visibility(self):
        state,run,m=fixture()
        def req(name,action,value="",key=1):
            server._million_apply_request(state,run,name,{"id":str(key)+"-"+action+"-"+name,
                "name":name,"type":action,"value":value})
        req("Crew","predict","A")
        req("Pilot","select","B")
        req("Pilot","lock",key=2)
        self.assertEqual(m["crewPredictions"],{"Crew":"A"})
        self.assertEqual(m["lockedAnswer"],"B")
        self.assertEqual(server._state_for_role(state,"teacher")["activityRun"]["millionConfig"]["questions"][0]["correct"],"B")
        shared=server._state_for_role(state,"shared")["activityRun"]
        student=server._state_for_role(state,"student",token="crew-token")["activityRun"]
        pilot=server._state_for_role(state,"student",token="pilot-token")["activityRun"]
        for view in [shared,student,pilot]:
            self.assertNotIn("correct",view["millionConfig"]["questions"][0])
            self.assertNotIn("mothershipClue",view["millionConfig"]["questions"][0])
            self.assertNotIn("explanation",view["millionConfig"]["questions"][0])
            self.assertEqual(view["millionConfig"]["questions"][1]["prompt"],"")
        self.assertEqual(shared["million"]["crewPredictions"],{})
        self.assertEqual(student["million"]["crewPredictions"],{"Crew":"A"})
        self.assertEqual(student["million"]["selectedAnswer"],"")
        self.assertEqual(pilot["million"]["selectedAnswer"],"B")

    def test_all_lifelines_and_no_spoilers(self):
        state,run,m=fixture()
        def req(action,val,key):
            server._million_apply_request(state,run,"Pilot",{"name":"Pilot","id":str(key),
                "type":action,"value":val})
        req("lifeline","poll",1)
        self.assertTrue(m["pollOpen"])
        req("lifeline","reduce",2)
        self.assertNotIn("B",m["eliminated"])
        self.assertEqual(len(m["eliminated"]),2)
        req("lifeline","clue",3)
        self.assertEqual(m["publicClue"],"Think of the second letter")
        public=server._state_for_role(state,"shared")["activityRun"]
        self.assertNotIn("correct",public["millionConfig"]["questions"][0])
        self.assertEqual(public["million"]["publicClue"],"Think of the second letter")
        req("select","B",4)
        req("lock","",5)
        req("lifeline","tryAgain",6)
        self.assertFalse(m["lockedAnswer"])
        self.assertEqual(m["inventory"]["tryAgain"],0)

    def test_5050_eliminates_exactly_two_wrong_answers_once_and_preserves_selection(self):
        state,run,m=fixture()
        m["inventory"]["reduce"]=2
        # Student has already tentatively chosen A (an incorrect option).
        server._million_apply_request(state,run,"Pilot",
            {"name":"Pilot","id":"choose-wrong","type":"select","value":"A"})
        server._million_apply_request(state,run,"Pilot",
            {"name":"Pilot","id":"first-5050","type":"lifeline","value":"reduce"})
        self.assertEqual(set(m["eliminated"]),{"C","D"})
        self.assertEqual(m["selectedAnswer"],"A")
        self.assertEqual(m["inventory"]["reduce"],1)
        self.assertIn("50/50 ACTIVATED",m["message"])
        for role,token in (("teacher",""),("student","pilot-token"),("shared","")):
            result=server._state_for_role(state,role,token=token)["activityRun"]["million"]
            self.assertEqual(set(result["eliminated"]),{"C","D"})
        server._million_apply_request(state,run,"Pilot",
            {"name":"Pilot","id":"repeat-5050","type":"lifeline","value":"reduce"})
        self.assertEqual(set(m["eliminated"]),{"C","D"})
        self.assertEqual(m["inventory"]["reduce"],1,"duplicate use must not consume another charge")
        server._million_apply_request(state,run,"Pilot",
            {"name":"Pilot","id":"lock-after-5050","type":"lock"})
        self.assertEqual(m["lockedAnswer"],"A")
        # A 50/50 cannot be used after the pilot locks a final answer.
        m["eliminated"]=[]
        server._million_apply_request(state,run,"Pilot",
            {"name":"Pilot","id":"locked-5050","type":"lifeline","value":"reduce"})
        self.assertEqual(m["eliminated"],[])
        self.assertEqual(m["inventory"]["reduce"],1)

    def test_repeat_poll_clue_and_idle_try_again_do_not_spend_charges(self):
        state,run,m=fixture()
        m["inventory"]["poll"]=2
        m["inventory"]["clue"]=2
        m["inventory"]["tryAgain"]=2
        def use(action,ident):
            server._million_apply_request(state,run,"Pilot",{
                "id":ident,"name":"Pilot","type":"lifeline","value":action})
        use("tryAgain","idle")
        self.assertEqual(m["inventory"]["tryAgain"],2)
        use("poll","poll-one")
        self.assertEqual(m["inventory"]["poll"],1)
        use("poll","poll-again")
        self.assertEqual(m["inventory"]["poll"],1)
        use("clue","clue-one")
        self.assertEqual(m["inventory"]["clue"],1)
        use("clue","clue-again")
        self.assertEqual(m["inventory"]["clue"],1)
        m["revealed"]=True
        use("clue","late-clue")
        self.assertEqual(m["inventory"]["clue"],1)
        # Once the teacher moves to the next question, lifelines may be used again.
        m["revealed"]=False
        m["pollOpen"]=False
        m["publicClue"]=""
        use("poll","next-question-poll")
        self.assertEqual(m["inventory"]["poll"],0)

    def test_no_student_action_before_lobby_start(self):
        state,run,m=fixture()
        run["phase"]="lobby"
        server._million_apply_request(state,run,"Pilot",{
            "id":"before-start","name":"Pilot","type":"select","value":"B"})
        self.assertEqual(m["selectedAnswer"],"")
        self.assertEqual(m["lastRequestId"] if "lastRequestId" in m else "", "")

    def test_spoken_million_blocks_all_student_gameplay_requests(self):
        state,run,m=fixture()
        run["millionConfig"]["answerMode"]="verbal"
        inventory=dict(m["inventory"])
        for i,(name,action,value) in enumerate([
            ("Crew","predict","A"),("Pilot","select","B"),
            ("Pilot","lock",""),("Pilot","lifeline","reduce")]):
            server._million_apply_request(state,run,name,{
                "id":"spoken-"+str(i),"name":name,"type":action,"value":value})
        self.assertEqual(m["selectedAnswer"],"")
        self.assertEqual(m["lockedAnswer"],"")
        self.assertEqual(m["crewPredictions"],{})
        self.assertEqual(m["inventory"],inventory)

    def test_crew_cannot_lock_or_use_pilot_lifelines(self):
        state,run,m=fixture()
        server._million_apply_request(state,run,"Crew",{"name":"Crew","id":"p1","type":"select","value":"C"})
        server._million_apply_request(state,run,"Crew",{"name":"Crew","id":"p2","type":"lock"})
        server._million_apply_request(state,run,"Crew",{"name":"Crew","id":"p3","type":"lifeline","value":"reduce"})
        self.assertEqual(m["lockedAnswer"],"")
        self.assertEqual(m["inventory"]["reduce"],1)

if __name__=="__main__":
    unittest.main()
