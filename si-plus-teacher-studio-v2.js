/* SI+ Teacher Studio V2 — read-only deck overview and DOM art enhancers.
   Never edits slides, intercepts button clicks, starts activities, or saves. */
(()=>{'use strict';
 const thumbs=new WeakMap();
 const railSelections=new WeakMap();
 const typeLabels={
  instruction:'Instruction',question:'Question',poll:'Poll',
  spotlight:'Spotlight',video:'Video',image:'Image'
 };
 function el(tag,className,text){
  const node=document.createElement(tag);node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
 }
 function studioPanel(){
  if(typeof state==='undefined'||!state?.presentationEditor?.draft)return null;
  const panel=document.getElementById('presentationBuilderPanel');
  if(!panel||panel.classList.contains('hidden')||!panel.classList.contains('si-art-builder'))return null;
  return panel;
 }
 function update(){
  const panel=studioPanel();if(!panel)return;
  const draft=state.presentationEditor.draft;
  const slides=Array.isArray(draft.slides)?draft.slides:[];
  const n=slides.length;
  const index=Math.max(0,Math.min(n-1,Number(state.editorSlide)||0));
  const active=slides[index]||{};
  const organizing=panel.classList.contains('si-plus-organizing');
  const visualCount=slides.filter(s=>Boolean(s?.image||s?.youtube)).length;
  const interactiveCount=slides.filter(s=>s?.type==='poll'||s?.type==='question').length;

  const title=panel.querySelector('.builder-top');if(!title)return;
  let pulse=panel.querySelector(':scope > .si-studio-pulse');
  if(!pulse){
    pulse=el('div','si-studio-pulse');
    pulse.setAttribute('aria-label','SI+ editing overview');
    for(const [label,initial] of [['SLIDE POSITION','—'],['CURRENT SLIDE','—'],['WORKSPACE','Editing draft']]){
      const item=el('div','si-studio-pulse-item');
      const small=el('small','',label),strong=el('strong','',initial);
      item.append(small,strong);pulse.append(item);
    }
    const track=el('div','si-studio-pulse-track');
    track.setAttribute('aria-hidden','true');
    track.append(el('span',''));
    pulse.append(track);
    title.insertAdjacentElement('afterend',pulse);
  }
  const values=[
    n?(index+1)+' of '+n:'No slides',
    typeLabels[active.type]||(active.type?String(active.type):'Instruction'),
    organizing?'Slide organizer':'Editing draft'
  ];
  pulse.querySelectorAll('.si-studio-pulse-item strong').forEach((x,i)=>{
    if(x.textContent!==values[i])x.textContent=values[i];
  });
  pulse.style.setProperty('--si-studio-progress',n?Math.round((index+1)*100/n)+'%':'0%');
  let summary=pulse.querySelector('.si-studio-pulse-summary');
  if(!summary){
    summary=el('div','si-studio-pulse-summary');
    summary.setAttribute('aria-label','Lesson content summary');
    pulse.append(summary);
  }
  const summaryText=visualCount+' media slide'+(visualCount===1?'':'s')+
    ' · '+interactiveCount+' question'+(interactiveCount===1?'':'s')+' / polls';
  if(summary.textContent!==summaryText)summary.textContent=summaryText;
  const rail=panel.querySelector('.builder-layout > .builder-box:first-child');
  if(rail){
    let header=rail.querySelector(':scope > .si-studio-rail-header');
    if(!header){
      header=el('div','si-studio-rail-header');
      header.append(el('strong','','SLIDE FILMSTRIP'),el('span','',''));
      rail.prepend(header);
    }
    const countLabel=n+' SLIDE'+(n===1?'':'S');
    const count=header.querySelector('span');
    if(count?.textContent!==countLabel)count.textContent=countLabel;
  }

  // The real slide navigation retains all of its native behavior. Previews
  // are decorative children with pointer-events:none, loaded lazily.
  const nav=panel.querySelectorAll('.builder-layout .slide-nav-item');
  if(nav.length===n){
    nav.forEach((button,i)=>{
      const slide=slides[i]||{},source=typeof slide.image==='string'&&
        /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(slide.image)?slide.image:'';
      const type=String(slide.type||'instruction');
      button.dataset.siStudioType=type;
      if(i===index)button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
      let tag=button.querySelector(':scope > .si-studio-rail-meta');
      if(!tag){
        tag=el('span','si-studio-rail-meta');tag.setAttribute('aria-hidden','true');
        button.append(tag);
      }
      const typeText=(typeLabels[type]||type).toUpperCase();
      if(tag.textContent!==typeText)tag.textContent=typeText;
      const prior=thumbs.get(button);
      if(prior&&prior.source===source&&prior.type===type&&
        button.querySelector('.si-studio-rail-number'))return;
      let thumb=button.querySelector(':scope > .si-studio-rail-thumb');
      if(!thumb){thumb=el('span','si-studio-rail-thumb');thumb.setAttribute('aria-hidden','true');button.prepend(thumb);}
      thumb.replaceChildren();
      if(source){
        const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.alt='';
        img.src=source;thumb.append(img);
      }else{
        thumb.append(el('span','',typeLabels[type]||'SLIDE'));
      }
      thumb.append(el('span','si-studio-rail-number',String(i+1).padStart(2,'0')));
      thumbs.set(button,{source,type});
    });
  }
  // Keep the current slide visible in the rail without moving the entire page.
  // Only scroll when selection changes; ordinary editing does not scroll.
  if(rail&&!organizing&&railSelections.get(rail)!==index){
    const selected=rail.querySelector('.slide-nav-item.active');
    if(selected){
      const outer=rail.getBoundingClientRect(),inner=selected.getBoundingClientRect();
      const topSafe=outer.top+53,bottomSafe=outer.bottom-12;
      if(inner.top<topSafe)rail.scrollTop-=topSafe-inner.top;
      else if(inner.bottom>bottomSafe)rail.scrollTop+=inner.bottom-bottomSafe;
      railSelections.set(rail,index);
    }
  }
  const icons=['instruction','question','poll','spotlight','video','image'];
  panel.querySelectorAll('.add-slide-grid button').forEach(btn=>{
    const value=(btn.textContent||'').trim().toLowerCase();
    for(const cls of icons)btn.classList.toggle('si-studio-icon-'+cls,
      cls==='video'?/video|youtube/.test(value):
      cls==='image'?/image|picture|upload/.test(value):
      value.includes(cls));
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{update();setInterval(update,650)},{once:true});
 else{update();setInterval(update,650);}
})();
