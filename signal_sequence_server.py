"""SIGNAL SEQUENCE Phase 2: authenticated Classic, Survival and Relay actions.

Teacher alone chooses patterns, timing, mode, participants and restart.
Students can only submit the next signal on their own assigned input step.
"""
from __future__ import annotations
import time

def apply_signal_sequence_action(state: dict, run: dict, name: str, request: dict) -> bool:
    if not isinstance(run,dict) or run.get("activityId")!="signal-sequence-game" or run.get("phase")!="running":
        return False
    if not isinstance(request,dict) or str(request.get("runToken") or "")!=str(run.get("runToken") or ""):
        return False
    game=run.get("signalSequence")
    if not isinstance(game,dict) or game.get("phase")!="input" or name=="Teacher":
        return False
    mode=game.get("mode") if game.get("mode") in ("classic","survival","relay") else "classic"
    signals=game.get("signals",4)
    if type(signals) is not int or signals not in (4,6,8):
        return False
    seq=game.get("sequence")
    if not isinstance(seq,list) or not 1<=len(seq)<=200 or any(type(v) is not int or v not in range(signals) for v in seq):
        return False
    chosen=request.get("signal")
    if type(chosen) is not int or not 0<=chosen<signals:
        return False
    request_id=request.get("id")
    if not isinstance(request_id,str) or not 1<=len(request_id)<=100:
        return False
    seen=game.get("lastIds") if isinstance(game.get("lastIds"),list) else []
    if request_id in seen:
        return False
    members=game.get("participants") if isinstance(game.get("participants"),list) else []
    if mode=="survival":
        if name not in members or not all(isinstance(v,str) for v in members):
            return False
        entries=game.get("entries")
        if not isinstance(entries,dict):
            return False
        entry=entries.get(name)
        if not isinstance(entry,dict) or entry.get("status")!="playing":
            return False
        progress=entry.get("progress")
    else:
        if str(game.get("pilot") or "")!=name:
            return False
        if mode=="relay" and (name not in members or len(members)<2):
            return False
        progress=game.get("progress")
    if type(progress) is not int or progress<0 or progress>=len(seq):
        return False
    correct=chosen==seq[progress]
    game["lastIds"]=(seen+[request_id])[-70:]
    game["lastInput"]={"name":name,"signal":chosen,"correct":correct,"at":int(time.time()*1000)}
    if mode=="survival":
        if not correct:
            entry["status"]="out"
        else:
            entry["progress"]=progress+1
            if entry["progress"]==len(seq):
                entry["status"]="cleared"
                entry["roundsSurvived"]=len(seq)
        remaining=[n for n in members if isinstance(entries.get(n),dict) and entries[n].get("status")!="out"]
        awaiting=[n for n in members if isinstance(entries.get(n),dict) and entries[n].get("status")=="playing"]
        if not awaiting:
            if remaining:
                game["phase"]="success"
                game["best"]=max(int(game.get("best") or 0),len(seq))
                game["message"]="CREW SURVIVED ROUND "+str(len(seq))+" · "+str(len(remaining))+" remain."
            else:
                game["phase"]="failed"
                game["message"]="CREW SURVIVAL COMPLETE · All pilots eliminated. Select Retry."
        else:
            game["message"]=name+(" matched the signal." if correct else " lost the signal.")+" "+str(len(remaining))+" remain."
        return True
    if not correct:
        game["phase"]="failed"
        game["best"]=max(int(game.get("best") or 0),len(seq)-1)
        game["message"]="SIGNAL LOST · Reached round "+str(len(seq))+". Select Retry Run to start again."
        return True
    game["progress"]=progress+1
    if game["progress"]==len(seq):
        game["phase"]="success"
        game["best"]=max(int(game.get("best") or 0),len(seq))
        game["message"]=("RELAY COMPLETE" if mode=="relay" else "PERFECT REPEAT")+" · Round "+str(len(seq))+" complete!"
    elif mode=="relay":
        game["pilot"]=members[game["progress"] % len(members)]
        game["message"]="PASS CONTROL · "+game["pilot"]+" plays signal "+str(game["progress"]+1)+"."
    else:
        game["message"]="GREAT SIGNAL · "+str(game["progress"])+" / "+str(len(seq))+" matched."
    return True

def redact_signal_sequence_state(state: dict,role: str,own_name: str=""):
    """WATCH may display currently playing notes; input never exposes answers.

    Survival displays public status for teammates, but not other students'
    progress, guesses, request IDs, or unvalidated input history.
    """
    run=state.get("activityRun")
    game=run.get("signalSequence") if isinstance(run,dict) else None
    if not isinstance(game,dict):
        return
    if game.get("phase")!="watch":
        game["sequence"]=[]
    game.pop("lastInput",None)
    game.pop("lastIds",None)
    entries=game.get("entries")
    if isinstance(entries,dict):
        for name,entry in entries.items():
            if isinstance(entry,dict) and not (role=="student" and name==own_name):
                entry.pop("progress",None)
                entry.pop("lastInput",None)
