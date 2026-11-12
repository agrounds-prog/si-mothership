/* Minefield · revealed-only Risk Scanner
   This script reads public DOM clues only. It never examines state.activityRun,
   the underlying board model, unrevealed tiles, or network payloads. */
(()=>{
  'use strict';
  if(window.__siMinefieldIntelV1)return;
  window.__siMinefieldIntelV1=true;
  const views=['#sharedContent','#mirrorContent','#activityControllerPanel','#studentContent'];
  const previous=new Map();
  const lastSafe=new Map();

  function evidence(root){
    const log=(root.querySelector('.minefield-narrator-latest')?.textContent||'').replace(/\s+/g,' ');
    const hit=log.match(/\b([A-Z][1-9])\s+earned\s+([1-5])\s+points?\s*[·:—–-]\s*(\d+)\s+nearby\s+mines?/i);
    if(!hit)return null;
    const sector=hit[1].toUpperCase(),points=Number(hit[2]),near=Number(hit[3]);
    // Verify against a publicly revealed safe square: never derive a clue from
    // hidden attributes, hidden CSS, title text on unknown squares or game state.
    const cells=root.querySelectorAll('.minefield-board .minefield-cell.simple.revealed.empty');
    for(const cell of cells){
      const label=cell.getAttribute('aria-label')||'';
      if(label.startsWith('Sector '+sector+' ·')&&
          cell.classList.contains('mf-value-'+points)&&
          label.includes(near+' adjacent mine')){
        return {sector,points,near,cell};
      }
    }
    return null;
  }

  function update(view){
    const host=document.querySelector(view);
    if(!host)return;
    const root=host.querySelector('.minefield-public.mf-v2:has(> .minefield-narrator)')||
      host.querySelector('.minefield-controller-body.mf-v2')||
      host.querySelector('.student-prompt:has(.minefield-board)');
    if(!root){previous.delete(view);lastSafe.delete(view);return;}
    const board=root.querySelector('.minefield-board');
    const panel=root.querySelector('.minefield-narrator')||
      root.querySelector('.minefield-status-card');
    if(!board||!panel)return;

    let intel=panel.querySelector(':scope > .mf-reveal-intel');
    if(!intel){
      intel=document.createElement('div');
      intel.className='mf-reveal-intel';
      intel.setAttribute('role','group');
      intel.setAttribute('aria-label','Revealed Minefield risk and reward clues');
      intel.innerHTML='<div class="mf-intel-title">REVEALED INTEL <span>RISK + REWARD</span></div>'+
        '<div class="mf-intel-row"><b class="mf-intel-sector">AWAITING REVEAL</b>'+
        '<strong class="mf-intel-points">1–5 PTS</strong></div>'+
        '<div class="mf-intel-detail">Safe squares earn more points near mines. Hidden squares stay unknown.</div>'+
        '<div class="mf-intel-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>';
      panel.insertBefore(intel,panel.querySelector('.minefield-narrator-latest')||null);
    }
    let safe=evidence(root);
    if(!safe){
      const saved=lastSafe.get(view);
      if(saved){
        const match=Array.from(board.querySelectorAll('.minefield-cell.revealed.empty'))
          .find(cell=>cell.getAttribute('aria-label')?.startsWith('Sector '+saved.sector+' ·')&&
                      cell.classList.contains('mf-value-'+saved.points));
        if(match)safe={...saved,cell:match};
      }
    }
    const old=board.querySelector('.minefield-cell.mf-last-safe');
    if(old&&old!==safe?.cell)old.classList.remove('mf-last-safe');
    if(safe){
      safe.cell.classList.add('mf-last-safe');
      lastSafe.set(view,{sector:safe.sector,points:safe.points,near:safe.near});
      intel.dataset.mfSector=safe.sector;
      intel.dataset.mfPoints=String(safe.points);
      const sector='LAST SAFE · '+safe.sector;
      const points='+'+safe.points+' '+(safe.points===1?'POINT':'POINTS');
      const detail=safe.near+' '+(safe.near===1?'mine':'mines')+
        ' adjacent to '+safe.sector+' · Clue from an already revealed square';
      const name=intel.querySelector('.mf-intel-sector');
      const reward=intel.querySelector('.mf-intel-points');
      const desc=intel.querySelector('.mf-intel-detail');
      if(name.textContent!==sector)name.textContent=sector;
      if(reward.textContent!==points)reward.textContent=points;
      if(desc.textContent!==detail)desc.textContent=detail;
      intel.querySelectorAll('.mf-intel-meter i').forEach((seg,i)=>
        seg.classList.toggle('earned',i<safe.points));
    }else{
      delete intel.dataset.mfSector;
      delete intel.dataset.mfPoints;
      if(intel.querySelector('.mf-intel-sector').textContent!=='AWAITING REVEAL'){
        intel.querySelector('.mf-intel-sector').textContent='AWAITING REVEAL';
        intel.querySelector('.mf-intel-points').textContent='1–5 PTS';
        intel.querySelector('.mf-intel-detail').textContent=
          'Safe squares earn more points near mines. Hidden squares stay unknown.';
        intel.querySelectorAll('.mf-intel-meter i').forEach(i=>i.classList.remove('earned'));
      }
    }

    const counter=root.querySelector('.mf-score-chip b,.mf-controller-score strong');
    if(counter){
      const score=Number((counter.textContent||'').trim());
      if(Number.isFinite(score)){
        const prior=previous.get(view);
        if(prior!==undefined&&score>prior){
          counter.closest('.mf-score-chip,.mf-controller-score')?.classList.add('mf-score-pop');
        }
        previous.set(view,score);
      }
    }
  }

  function refresh(){
    for(const view of views){
      try{update(view)}catch(e){ /* Noncritical read-only HUD; gameplay remains untouched. */ }
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',refresh,{once:true});
  }else refresh();
  window.setInterval(refresh,450);
})();
