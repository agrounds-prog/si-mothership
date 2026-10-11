"""SIGNAL SEQUENCE v1: server-authoritative Classic student input.

The teacher owns sequence generation and phase changes; connected students may
submit only one numbered signal for their assigned turn, after watch playback.
"""
from __future__ import annotations
import time

def apply_signal_sequence_action(state: dict, run: dict, name: str, request: dict) -> bool:
    if not isinstance(run, dict) or run.get("activityId") != "signal-sequence-game" or run.get("phase") != "running":
        return False
    if not isinstance(request, dict) or str(request.get("runToken") or "") != str(run.get("runToken") or ""):
        return False
    game=run.get("signalSequence")
    if not isinstance(game, dict) or game.get("phase")!="input" or str(game.get("pilot") or "")!=name or name=="Teacher":
        return False
    seq=game.get("sequence")
    if (not isinstance(seq,list) or not 1<=len(seq)<=200 or any(type(n) is not int or n not in range(4) for n in seq)):
        return False
    if type(request.get("signal")) is not int or not 0<=request["signal"]<4:
        return False
    progress=game.get("progress")
    if type(progress) is not int or progress<0 or progress>=len(seq):
        return False
    request_id=request.get("id")
    if not isinstance(request_id,str) or not 1<=len(request_id)<=100:
        return False
    seen=game.get("lastIds") if isinstance(game.get("lastIds"),list) else []
    if request_id in seen:
        return False
    chosen=request["signal"]
    game["lastIds"]=(seen+[request_id])[-35:]
    game["lastInput"]={"signal":chosen,"correct":chosen==seq[progress],"at":int(time.time()*1000)}
    if chosen!=seq[progress]:
        game["phase"]="failed"
        game["best"]=max(int(game.get("best") or 0),len(seq)-1)
        game["message"]="SIGNAL LOST · Reached round "+str(len(seq))+". Select Retry Run to start again."
        return True
    game["progress"]=progress+1
    if game["progress"]==len(seq):
        game["phase"]="success"
        game["best"]=max(int(game.get("best") or 0),len(seq))
        game["message"]="PERFECT REPEAT · Round "+str(len(seq))+" complete!"
    else:
        game["message"]="GREAT SIGNAL · "+str(game["progress"])+" / "+str(len(seq))+" matched."
    return True

def redact_signal_sequence_state(state: dict, role: str):
    """Remove future answers and input details for students/spectators after WATCH."""
    run=state.get("activityRun")
    game=run.get("signalSequence") if isinstance(run,dict) else None
    if not isinstance(game,dict):
        return
    if game.get("phase")!="watch":
        game["sequence"]=[]
    game.pop("lastInput",None)
    game.pop("lastIds",None)
