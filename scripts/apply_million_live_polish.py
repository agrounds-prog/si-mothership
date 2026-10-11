"""Targeted MILLION stage & safe next-question guard. Pinned index only."""
from pathlib import Path
import hashlib
p=Path('index.html');raw=p.read_bytes()
blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
if blob!='de1aaaaa56b6e8f74d013432f64b81ebd4b75f2e':raise SystemExit(f'ABORT: unexpected index {blob}')
s=raw.decode('utf8')
def sub(old,new):
 global s
 if s.count(old)!=1:raise SystemExit(f'ABORT: anchor count {s.count(old)}: {old[:130]}')
 s=s.replace(old,new,1)
sub(
 "if(m.complete)return toast('Mission complete');if(!m.revealed&&!m.over)return toast('Reveal the answer before moving on');",
 "if(m.complete)return toast('Mission complete');if(m.over)return toast('Run complete — finish or load another game');if(!m.revealed)return toast('Reveal the answer before moving on');"
)
sub(
 """const ladderHtml=ladder.map((v,i)=>`<div class="million-rung ${i===Number(m.ladderLevel||0)?'active':''} ${(cfg.checkpoints||[]).includes(i+1)?'checkpoint':''}"><span>${i+1}</span><b>${Number(v).toLocaleString()}</b></div>`).reverse().join('');""",
 """const level=Math.max(0,Math.min(ladder.length,Number(m.ladderLevel||0))),shownLevel=Math.max(0,Math.min(ladder.length-1,level-(m.revealed&&m.result==='correct'?1:0)));
  const ladderHtml=ladder.map((v,i)=>`<div class="million-rung ${i===shownLevel?'active':''} ${i<level?'earned':''} ${(cfg.checkpoints||[]).includes(i+1)?'checkpoint':''}"><span>${i+1}</span><b>${'$'+Number(v).toLocaleString()}</b></div>`).reverse().join('');
  const prize=Number(ladder[shownLevel]||0),prizeLabel=m.revealed?(m.result==='correct'?'MILESTONE EARNED':'MILESTONE MISSED'):'NEXT MILESTONE';"""
)
sub(
 """<span class="eyebrow">MILLION · QUESTION ${Number(m.questionIndex||0)+1}</span><h3>${esc(q.prompt||'')}</h3>""",
 """<span class="eyebrow">MILLION · QUESTION ${Number(m.questionIndex||0)+1} OF ${(cfg.questions||[]).length}</span><div class="million-stakes ${m.revealed&&m.result==='correct'?'million-stakes-earned':''}"><span class="million-stakes-label">${prizeLabel}</span><b class="million-stakes-amount">${'$'+prize.toLocaleString()}</b></div><h3>${esc(q.prompt||'')}</h3>"""
)
sub(
 """const choices=(q.choices||[]).map(c=>{const eliminated=(m.eliminated||[]).includes(c.key),sel=selected===c.key,reveal=m.revealed,correct=reveal&&m.publicCorrect===c.key;return `<button class="million-student-choice ${sel?'selected':''} ${correct?'correct':''}" data-million-choice="${c.key}" ${eliminated||m.revealed||m.over||m.complete?'disabled':''}><b>${c.key}</b><span>${esc(c.text||'')}</span></button>`}).join('');""",
 """const choices=(q.choices||[]).map(c=>{const eliminated=(m.eliminated||[]).includes(c.key),sel=selected===c.key,reveal=m.revealed,correct=reveal&&m.publicCorrect===c.key,wrong=reveal&&sel&&!correct;return `<button class="million-student-choice ${sel?'selected':''} ${correct?'correct':''} ${wrong?'wrong':''}" data-million-choice="${c.key}" ${eliminated||(pilot&&m.lockedAnswer)||m.revealed||m.over||m.complete?'disabled':''}><b>${c.key}</b><span>${esc(c.text||'')}</span></button>`}).join('');"""
)
sub(
 """<button id="millionNextBtn" ${!m?.revealed&&!m?.over&&!m?.complete?'disabled':''}>Next Question →</button>""",
 """<button id="millionNextBtn" ${!m?.revealed||m?.over||m?.complete?'disabled':''}>${m?.over?'Run Complete':m?.complete?'Mission Complete':'Next Question →'}</button>"""
)
sub(
 "const k=String(type||''),left=Number(m.inventory?.[k]||0);if(left<=0)return toast('That lifeline is not available');",
 "const k=String(type||''),left=Number(m.inventory?.[k]||0);if(left<=0)return toast('That lifeline is not available');if(m.complete||(m.revealed&&m.result==='correct'))return toast('This question has already been scored');"
)
assert "million-stakes" in s
p.write_text(s,encoding='utf8')
print("MILLION gameplay index source patch OK",len(raw),"->",p.stat().st_size)
