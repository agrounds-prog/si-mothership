"""SIGNAL SEQUENCE: actual student WebSocket, responses, identity and ACK."""
import tempfile
import unittest
from pathlib import Path
from aiohttp.test_utils import TestClient, TestServer
import server as app

class SignalSequenceLiveSocket(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.db,self.prev=app.DB_PATH,app.LATEST_STATE
  self.sid,self.code=app.CURRENT_SESSION_ID,app.CURRENT_JOIN_CODE
  app.DB_PATH=Path(self.tmp.name)/"signal_multiplayer.sqlite3"
  app.CLIENTS.clear()
  app.CLIENT_META.clear()
  app.init_db()
  app.save_runtime_state({
   "screen":"activity","students":[
    {"n":"Pilot","studentToken":"signal-pilot-abcdef","offline":False},
    {"n":"Other","studentToken":"signal-other-abcdef","offline":False}],
   "activityRun":{"activityId":"signal-sequence-game","phase":"running","runToken":"signal-live-123",
    "signalSequence":{"id":"signal-demo","pilot":"Pilot","phase":"input","sequence":[0,2],
     "round":2,"progress":0,"best":0,"message":"Repeat"}},
   "ended":False})
  self.client=TestClient(TestServer(app.create_app()))
  await self.client.start_server()
  resp=await self.client.post("/api/teacher/login",json={"key":app.TEACHER_KEY})
  self.assertEqual(resp.status,200)
 async def asyncTearDown(self):
  await self.client.close()
  app.CLIENTS.clear();app.CLIENT_META.clear()
  app.DB_PATH,self.prev_db= self.db,app.DB_PATH
  app.LATEST_STATE=self.prev
  app.CURRENT_SESSION_ID,self.sid =self.sid,app.CURRENT_SESSION_ID
  app.CURRENT_JOIN_CODE,self.code=self.code,app.CURRENT_JOIN_CODE
  self.tmp.cleanup()
 async def connect(self,name,token):
  ws=await self.client.ws_connect("/ws",params={"role":"student","sid":app.CURRENT_SESSION_ID,"code":app.CURRENT_JOIN_CODE})
  await ws.send_json({"type":"hello","student_name":name,"student_token":token})
  return ws
 async def receipt(self,ws,req_id):
  for _ in range(25):
   packet=await ws.receive_json(timeout=5)
   if packet.get("type")=="signal_sequence_ack" and packet.get("id")==req_id:
    return packet
  self.fail("Missing student press acknowledgement")
 async def tap(self,ws,signal,req_id,name,token):
  await ws.send_json({"type":"signal_sequence_action","student_name":name,"student_token":token,
                      "request":{"signal":signal,"id":req_id,"runToken":"signal-live-123"}})
  return await self.receipt(ws,req_id)
 async def test_pilot_receives_each_press_and_rejections_are_visible(self):
  pilot=await self.connect("Pilot","signal-pilot-abcdef")
  other=await self.connect("Other","signal-other-abcdef")
  self.assertFalse((await self.tap(other,0,"other1","Other","signal-other-abcdef"))["ok"])
  self.assertEqual(app.LATEST_STATE["activityRun"]["signalSequence"]["progress"],0)
  self.assertTrue((await self.tap(pilot,0,"pilot1","Pilot","signal-pilot-abcdef"))["ok"])
  self.assertEqual(app.LATEST_STATE["activityRun"]["signalSequence"]["progress"],1)
  self.assertFalse((await self.tap(pilot,0,"pilot1","Pilot","signal-pilot-abcdef"))["ok"])
  self.assertEqual(app.LATEST_STATE["activityRun"]["signalSequence"]["progress"],1)
  self.assertTrue((await self.tap(pilot,2,"pilot2","Pilot","signal-pilot-abcdef"))["ok"])
  self.assertEqual(app.LATEST_STATE["activityRun"]["signalSequence"]["phase"],"success")
  self.assertFalse((await self.tap(pilot,1,"pilot3","Pilot","signal-pilot-abcdef"))["ok"])
  await other.close();await pilot.close()
 async def test_identity_is_verified_and_answers_are_not_exposed(self):
  pilot=await self.connect("Pilot","signal-pilot-abcdef")
  for _ in range(5):
   msg=await pilot.receive_json(timeout=5)
   if msg.get("type")=="state":
    game=msg["state"]["activityRun"]["signalSequence"]
    self.assertEqual(game["sequence"],[]);break
  else:self.fail("No student state")
  # A forged request cannot impersonate the assigned pilot from the other socket.
  other=await self.connect("Other","signal-other-abcdef")
  await other.send_json({"type":"signal_sequence_action","student_name":"Pilot","student_token":"signal-pilot-abcdef",
                         "request":{"signal":0,"id":"forged","runToken":"signal-live-123"}})
  # Socket identity is pinned by hello and no progress is made.
  await other.receive_json(timeout=5)
  self.assertEqual(app.LATEST_STATE["activityRun"]["signalSequence"]["progress"],0)
  await pilot.close();await other.close()

if __name__=="__main__":unittest.main()
