"""Surgical, SHA-guarded MILLION 50/50 display and teacher/player parity fix."""
from pathlib import Path
import hashlib
p=Path("index.html")
raw=p.read_bytes()
blob=hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()
if blob!="128bcc7f2c3b7898ee16ff27279c756be24117eb":
 raise SystemExit("ABORT index.html changed: "+blob)
s=raw.decode("utf-8")
n=0
def patch(start,end,old,new):
 global s,n
 a=s.find(start)
 if a<0:raise SystemExit("ABORT region start "+start)
 b=s.find(end,a+len(start))
 if b<0:raise SystemExit("ABORT region end "+end)
 fragment=s[a:b]
 if fragment.count(old)!=1:raise SystemExit("ABORT expected one occurrence, got "+str(fragment.count(old))+" of "+old[:140])
 s=s[:a]+fragment.replace(old,new,1)+s[b:]
 n+=1

# All lifeline code paths produce the same two eliminated choices.
patch("function millionUseLifeline(","function millionResolve(",
 "if(m.complete||(m.revealed&&m.result==='correct'))return toast('This question has already been scored');",
 "if(m.complete||(m.revealed&&m.result==='correct'))return toast('This question has already been scored');if(k==='reduce'&&(m.lockedAnswer||m.revealed||m.over||(m.eliminated||[]).length>=2))return toast('50/50 can only be used once, before an answer is locked');")
patch("function millionUseLifeline(","function millionResolve(",
 "const wrong=(q.choices||[]).map(c=>c.key).filter(key=>key!==q.correct&&!(m.eliminated||[]).includes(key));m.eliminated=wrong.slice(0,2);m.message='REDUCE SIGNAL removed two incorrect choices.'",
 "const wrong=(q.choices||[]).map(c=>c.key).filter(key=>key!==q.correct&&key!==m.selectedAnswer);if(wrong.length<2)return toast('50/50 is unavailable for this question');m.eliminated=wrong.slice(0,2);m.message='50/50 ACTIVATED — two incorrect answers removed. Choose from the two remaining signals.'")

# Teacher/projector main display: replace the removed answer text with a
# clearly labelled disabled-looking placeholder; do not collapse grid slots.
patch("function millionSharedMarkup(","function millionStudentMarkup(",
 "<span>${esc(c.text||'')}</span></div>",
 "<span>${eliminated?'SIGNAL REMOVED':esc(c.text||'')}</span></div>")
patch("function millionSharedMarkup(","function millionStudentMarkup(",
 "<div class=\"million-choices\">${choices}</div>",
 "${(m.eliminated||[]).length>=2?'<div class=\"million-5050-banner\" role=\"status\">50/50 ACTIVATED · TWO CHOICES REMOVED · TWO SIGNALS REMAIN</div>':''}<div class=\"million-choices\">${choices}</div>")

# Student devices need explicit eliminated class AND a visual explanation,
# not merely disabled buttons (which previously looked unchanged).
patch("function millionStudentMarkup(","function wireMillionStudent(",
 "class=\"million-student-choice ${sel?'selected':''} ${correct?'correct':''} ${wrong?'wrong':''}\"",
 "class=\"million-student-choice ${sel?'selected':''} ${correct?'correct':''} ${wrong?'wrong':''} ${eliminated?'eliminated':''}\"")
patch("function millionStudentMarkup(","function wireMillionStudent(",
 "<span>${esc(c.text||'')}</span></button>",
 "<span>${eliminated?'SIGNAL REMOVED':esc(c.text||'')}</span></button>")
patch("function millionStudentMarkup(","function wireMillionStudent(",
 "<div class=\"million-student-choices\">${choices}</div>",
 "${(m.eliminated||[]).length>=2?'<div class=\"million-5050-banner\" role=\"status\">50/50 ACTIVE · TWO ANSWERS REMOVED</div>':''}<div class=\"million-student-choices\">${choices}</div>")
patch("function millionStudentMarkup(","function wireMillionStudent(",
 "[['poll','Poll Crew'],['reduce','50/50'],['clue','Clue'],['tryAgain','Try Again']]",
 "[['poll','Poll Crew'],['reduce','50/50 · Remove Two'],['clue','Clue'],['tryAgain','Try Again']]")
patch("function millionStudentMarkup(","function wireMillionStudent(",
 "Number(m.inventory?.[k]||0)<=0||m.revealed?'disabled':''",
 "Number(m.inventory?.[k]||0)<=0||m.revealed||(k==='reduce'&&(!!m.lockedAnswer||(m.eliminated||[]).length>=2))?'disabled':''")

# Teacher's Command Seat must reflect elimination. Disable duplicate 50/50
# rather than silently consume remaining inventory on the same question.
patch("  } else if(a.type==='million'){","  } else if(a.type==='starwheel'){",
 "class=\"${c.key===q.correct?'correct-key':''} ${m?.lockedAnswer===c.key?'locked':''}\"",
 "class=\"${c.key===q.correct?'correct-key':''} ${m?.lockedAnswer===c.key?'locked':''} ${(m?.eliminated||[]).includes(c.key)?'eliminated':''}\"")
patch("  } else if(a.type==='million'){","  } else if(a.type==='starwheel'){",
 "</div><div class=\"million-teacher-status\">",
 "</div>${(m?.eliminated||[]).length>=2?'<div class=\"million-teacher-5050-banner\" role=\"status\"><strong>50/50 ACTIVE</strong> · eliminated: '+m.eliminated.join(', ')+' · two answers remain</div>':''}<div class=\"million-teacher-status\">")
patch("  } else if(a.type==='million'){","  } else if(a.type==='starwheel'){",
 "['reduce','Reduce Signal']","['reduce','50/50 · Remove Two']")
patch("  } else if(a.type==='million'){","  } else if(a.type==='starwheel'){",
 "Number(m?.inventory?.[k]||0)<=0?'disabled':''",
 "Number(m?.inventory?.[k]||0)<=0||(k==='reduce'&&((m?.eliminated||[]).length>=2||m?.lockedAnswer||m?.revealed||m?.over||m?.complete))?'disabled':''")

p.write_text(s,encoding="utf-8")
print("MILLION 50/50 guarded index patch",n,"changes,",len(raw),"->",p.stat().st_size)
