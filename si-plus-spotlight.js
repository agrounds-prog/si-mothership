/* SI+ Spotlight Slide — additive integration, preserves legacy Spotlight.
 * Stored on each SI+ slide as siSpotlight={zones}. Native slide remains an
 * instruction slide for backward compatibility and unchanged image rendering.
 */
(()=>{"use strict";
 if(window.SIPlusSpotlightSlide)return;
 const NS="http://www.w3.org/2000/svg";
 const colors={black:"#ffffff",red:"#ef4444",green:"#22c55e",blue:"#3b82f6",yellow:"#facc15"};
 const teacher=()=>typeof SESSION_ROLE!=="undefined"&&SESSION_ROLE==="teacher";
 const editor=()=>teacher()&&typeof state!=="undefined"?state.presentationEditor:null;
 const activeSlide=()=>{const e=editor();return e?.draft?.slides?.[Math.max(0,Number(state.editorSlide)||0)]||null};
 const live=()=>{
  if(typeof state==="undefined"||typeof activeActivity!=="function")return null;
  const run=state.activityRun,deck=activeActivity();
  if(!run||run.phase!=="running"||deck?.type!=="presentation")return null;
  const index=Number(run.slideIndex)||0,slide=deck.slides?.[index];
  return slide?.siSpotlight?.enabled?{run,deck,slide,index}:null;
 };
 const uid=()=> "spot_"+Math.random().toString(36).slice(2,11);
 const data=slide=>slide?.siSpotlight?.enabled?slide.siSpotlight:null;
 const validImage=s=>typeof s==="string"&&/^(data:image\/|https?:\/\/|\/)/i.test(s);
 const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const clamp=(x,min,max)=>Math.min(max,Math.max(min,Number(x)||0));
 let renderId=0;
 const highlight=(zones,visible,prefix)=>{ 
  // Each projected SVG needs unique paint-server IDs. Duplicate filter/mask
  // IDs across teacher mirror and shared view can reference the wrong SVG.
  const token="siSpot"+String(prefix||"layer"+(++renderId)).replace(/[^a-zA-Z0-9_-]/g,"");
  const glowId=token+"Glow",maskId=token+"Mask";
  const selected=zones.filter(z=>visible.includes(z.id));
  const dims=selected.filter(z=>z.effect==="dim");
  let html='<defs><filter id="'+glowId+'" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>';
  if(dims.length)html+='<mask id="'+maskId+'"><rect width="1000" height="562.5" fill="white"/>'+dims.map(z=>shape(z,{fill:"black"})).join("")+'</mask>';
  html+='</defs>';
  if(dims.length)html+='<rect width="1000" height="562.5" fill="#020a14" opacity=".65" mask="url(#'+maskId+')"/>';
  for(const z of selected){
   const c=colors[z.color]||colors.red;
   html+=shape(z,{fill:"none",stroke:c,"stroke-width":18,opacity:.8,filter:"url(#"+glowId+")"});
   html+=shape(z,{fill:"none",stroke:c,"stroke-width":5,opacity:1});
  }
  return html;
 };
 function shape(z,attrs){
  const rect=z.shape==="rect";
  const el=rect?"rect":"ellipse";
  const v=rect?{x:z.x,y:z.y,width:z.w,height:z.h,rx:9}:{cx:z.x+z.w/2,cy:z.y+z.h/2,rx:z.w/2,ry:z.h/2};
  return "<"+el+" "+Object.entries({...v,...attrs}).map(([k,val])=>k+'="'+escape(val)+'"').join(" ")+"/>";
 }
 // Embed highlight markup in SI+'s actual slide output. This works in the
 // teacher mirror, the shared browser window and exported presentation HTML.
 // A body-level overlay alone cannot cross into the separate Zoom projector.
 function inlineSpotlightMarkup(markup){
  if(typeof markup!=="string"||!markup.includes("si-plus-viewport-image"))return markup;
  const info=live();if(!info)return markup;
  const imageMatch=markup.match(/<div class="si-plus-viewport-image"([^>]*)>([\s\S]*?)<\/div>/);
  if(!imageMatch)return markup;
  const zoneMarkup=highlight(info.slide.siSpotlight.zones||[],liveVisibility(info));
  const inner=imageMatch[2];
  const decorate='<svg class="si-plus-spotlight-inline" viewBox="0 0 1000 562.5" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible">'+zoneMarkup+'</svg>';
  let attributes=imageMatch[1];
  if(/\bstyle="/.test(attributes))attributes=attributes.replace(/style="/,'style="position:relative;');
  else attributes+=' style="position:relative"';
  const replacement='<div class="si-plus-viewport-image"'+attributes+'>'+inner+decorate+'</div>';
  return markup.replace(imageMatch[0],replacement);
 }
 function installSharedMarkup(){
  if(typeof sharedMarkup!=="function"||sharedMarkup.__siSpotlightWrapped)return;
  const original=sharedMarkup;
  const wrapper=function(...args){return inlineSpotlightMarkup(original.apply(this,args))};
  wrapper.__siSpotlightWrapped=true;
  try{sharedMarkup=wrapper}
  catch(e){console.warn("Could not attach Spotlight to SI+ slide output",e)}
 }
 // Calculate where the actual image pixels are painted. The img element's
 // box can be wider than its object-fit:contain content in presentation mode.
 // Use the same geometry for inline and fallback SVGs.
 function paintedImageBox(img){
  const rect=img.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  const style=img.ownerDocument.defaultView.getComputedStyle(img);
  const fit=style.objectFit;
  const nw=img.naturalWidth||rect.width,nh=img.naturalHeight||rect.height;
  let width=rect.width,height=rect.height;
  if((fit==="contain"||fit==="scale-down"||fit==="cover")&&nw>0&&nh>0){
   const factor=fit==="cover"?Math.max(rect.width/nw,rect.height/nh):
     Math.min(rect.width/nw,rect.height/nh);
   if(fit!=="scale-down"||factor<1){width=nw*factor;height=nh*factor}
  }
  // object-position defaults to 50% 50% in SI+; keep it centered.
  return {left:rect.left+(rect.width-width)/2,
   top:rect.top+(rect.height-height)/2,width,height};
 }
 function fitOverlay(svg,img,inline=false){
  const painted=paintedImageBox(img);
  if(!painted||!svg.isConnected){svg.style.display="none";return}
  svg.style.display="block";
  const parent=inline?svg.parentElement:null;
  const parentRect=parent?.getBoundingClientRect();
  svg.style.left=(painted.left-(parentRect?.left||0))+"px";
  svg.style.top=(painted.top-(parentRect?.top||0))+"px";
  svg.style.width=painted.width+"px";
  svg.style.height=painted.height+"px";
 }
 const overlays=new Map();
 function clearOverlays(){
  for(const [key,rec] of overlays){rec.svg.remove();overlays.delete(key)}
 }
 function liveVisibility(info){
  const values=info.run.siSpotlightVisible;
  if(values&&values.slideId===info.slide.id&&Array.isArray(values.ids))return values.ids;
  // Regions are deliberately revealed using their individual live controls.
  return [];
 }
 function overlaySync(){
  const info=live();
  if(!info){clearOverlays();return}
  const ids=liveVisibility(info),zones=info.slide.siSpotlight.zones||[];
  const targets=[
   ["shared","#sharedContent .si-plus-viewport-image > img"],
   ["teacher","#mirrorContent .si-plus-viewport-image > img"],
   ["preview","#presentationPreviewOverlay .si-plus-viewport-image > img"]
  ];
  for(const [key,selector] of targets){
   const img=document.querySelector(selector),rec=overlays.get(key);
   const inline=img?.parentElement?.querySelector?.(".si-plus-spotlight-inline");
   if(inline){
    if(rec){rec.svg.remove();overlays.delete(key)}
    fitOverlay(inline,img,true);
    continue;
   }
   if(!img||!img.isConnected){
    if(rec){rec.svg.remove();overlays.delete(key)}
    continue;
   }
   let current=rec;
   if(!rec||rec.img!==img){
    rec?.svg.remove();
    const svg=document.createElementNS(NS,"svg");
    svg.classList.add("si-plus-spotlight-overlay");
    svg.setAttribute("viewBox","0 0 1000 562.5");
    svg.setAttribute("preserveAspectRatio","none");
    document.body.append(svg);current={svg,img};overlays.set(key,current);
   }
   const markup=highlight(zones,ids,"floating"+key);
   if(current.markup!==markup){current.svg.innerHTML=markup;current.markup=markup}
   fitOverlay(current.svg,img);
  }
 }
 function publish(){
  if(typeof publishSyncedState==="function")publishSyncedState();
  if(typeof render==="function")render();
 }
 function setVisibility(ids){
  const info=live();if(!info||!teacher())return;
  info.run.siSpotlightVisible={slideId:info.slide.id,ids};
  publish();
  controlSync();overlaySync();
 }
 function controlSync(){
  if(!teacher())return;
  const row=document.querySelector("#activityControllerPanel .presentation-controls");
  let panel=document.getElementById("siPlusSpotlightLiveControls");
  const info=live();
  if(!row||!info){panel?.remove();return}
  if(!panel||panel.parentElement!==row){
   panel?.remove();panel=document.createElement("section");
   panel.id="siPlusSpotlightLiveControls";panel.className="si-plus-spotlight-live";
   row.append(panel);
  }
  const visible=liveVisibility(info),zones=info.slide.siSpotlight.zones||[];
  const key=info.slide.id+"|"+JSON.stringify(visible)+"|"+JSON.stringify(zones);
  if(panel.dataset.key===key)return;
  panel.dataset.key=key;
  const heading=document.createElement("strong");heading.textContent="◎ SPOTLIGHT SLIDE";
  const buttonRow=document.createElement("div");buttonRow.className="si-plus-spotlight-actions";
  for(const [label,choice] of [["Reveal all","all"],["Hide all","none"]]){
   const btn=document.createElement("button");btn.type="button";btn.textContent=label;
   btn.onclick=()=>setVisibility(choice==="all"?zones.map(z=>z.id):[]);
   buttonRow.append(btn)
  }
  for(const z of zones){
   const btn=document.createElement("button");btn.type="button";
   const on=visible.includes(z.id);
   btn.textContent=(on?"✓ ":"◎ ")+(z.name||"Region");
   btn.style.setProperty("--zone-color",colors[z.color]||colors.red);
   btn.classList.add("si-plus-spotlight-target");btn.setAttribute("aria-pressed",String(on));
   btn.onclick=()=>setVisibility(on?visible.filter(x=>x!==z.id):[...visible,z.id]);
   buttonRow.append(btn);
  }
  panel.replaceChildren(heading,buttonRow);
 }
 // Interactive editor drawing is scoped to the current SI+ slide. It only
 // mutates that draft slide and does not overwrite the rest of the lesson.
 let dialog=null,mode="rect",interaction="add",nextEffect="outline",selection="",drawing=null,zones=[],editorSlideId=null,originalZones="",dirty=false,undoHistory=[];
 function fitEditorImage(){
  if(!dialog||dialog.hidden)return;
  const image=dialog.querySelector(".si-plus-spot-image");
  const svg=dialog.querySelector(".si-plus-spot-drawing");
  const stage=dialog.querySelector(".si-plus-spot-stage");
  if(!image||!svg||!stage)return;
  // Natural-flow image controls canvas height. The image and drawing SVG
  // now share precisely the same complete bounds for any source ratio.
  stage.style.removeProperty("aspect-ratio");
  if(image.naturalWidth>0&&image.naturalHeight>0){
   stage.dataset.imageRatio=(image.naturalWidth/image.naturalHeight).toFixed(5);
  }
  svg.style.left="0px";svg.style.top="0px";
  svg.style.width="100%";svg.style.height="100%";
 }
 function openEditor(){
  const slide=activeSlide();
  if(!slide){return}
  if(!validImage(slide.image)){if(typeof toast==="function")toast("Add an image to this SI+ slide before using Spotlight.");return}
  zones=JSON.parse(JSON.stringify(data(slide)?.zones||[]));selection="";mode="rect";interaction="add";nextEffect="outline";
  editorSlideId=slide.id;originalZones=JSON.stringify(zones);dirty=false;undoHistory=[];
  if(!dialog)buildDialog();
  dialog.hidden=false;
  const image=dialog.querySelector(".si-plus-spot-image");image.src=slide.image;
  image.addEventListener("load",fitEditorImage,{once:true});
  requestAnimationFrame(fitEditorImage);
  updateEditor();dialog.querySelector(".si-plus-spot-close").focus();
 }
 function buildDialog(){
  dialog=document.createElement("div");dialog.id="siPlusSpotlightEditor";dialog.className="si-plus-spot-editor";dialog.hidden=true;
  dialog.innerHTML='<div class="si-plus-spot-dialog" role="dialog" aria-modal="true" aria-label="SI+ Spotlight slide editor">'+
   '<header><strong>◎ SPOTLIGHT SLIDE STUDIO</strong><button class="si-plus-spot-close" type="button">✕ Close</button></header>'+
   '<p>Drag anywhere on the image to add a region; drag inside a region to move it, or use the gold corners to resize. Full Image covers everything.</p>'+  
   '<div class="si-plus-spot-layout"><div class="si-plus-spot-stage"><img class="si-plus-spot-image" alt="Spotlight slide image"><svg class="si-plus-spot-drawing" viewBox="0 0 1000 562.5" preserveAspectRatio="none"></svg></div>'+
   '<aside><div class="si-plus-spot-buttons"><button type="button" data-new-effect="outline">＋ Add Highlight</button><button type="button" data-new-effect="dim">＋ Add Dim Area</button></div><div class="si-plus-spot-buttons"><button type="button" data-interaction="move">↔ Move / Select</button><button type="button" data-interaction="add">✎ Draw More</button></div><div class="si-plus-spot-buttons"><button type="button" data-mode="rect">▱ Rectangle</button><button type="button" data-mode="circle">◯ Circle</button></div>'+ 
   '<label>Highlight name<input id="siPlusSpotName" maxlength="50" placeholder="What to highlight"></label>'+
   '<label>Effect<select id="siPlusSpotEffect"><option value="outline">Outline Glow</option><option value="dim">Dim Background</option></select></label>'+
   '<label>Color<select id="siPlusSpotColor"><option value="red">Red</option><option value="green">Green</option><option value="blue">Blue</option><option value="yellow">Yellow</option><option value="black">White</option></select></label>'+
   '<div class="si-plus-spot-list"></div><fieldset class="si-plus-spot-bounds"><legend>Region size &amp; position (% of image)</legend><label>Left <input type="number" data-bound="x" min="0" max="100" step="1"></label><label>Top <input type="number" data-bound="y" min="0" max="100" step="1"></label><label>Width <input type="number" data-bound="w" min="1" max="100" step="1"></label><label>Height <input type="number" data-bound="h" min="1" max="100" step="1"></label></fieldset><div class="si-plus-spot-buttons"><button type="button" class="si-plus-spot-full-image">⛶ Full Image</button></div><div class="si-plus-spot-buttons"><button type="button" class="si-plus-spot-align-right">⇥ Right Edge</button><button type="button" class="si-plus-spot-align-left">⇤ Left Edge</button></div><div class="si-plus-spot-buttons"><button type="button" class="si-plus-spot-undo">↶ Undo Change</button><button type="button" class="si-plus-spot-delete">Delete Selected</button></div><small class="si-plus-spot-state" aria-live="polite">Draw a region to begin.</small>'+
   '<button type="button" class="si-plus-spot-save">✓ Save Highlights &amp; Return</button><button type="button" class="si-plus-spot-remove">Remove Spotlight Mode</button></aside></div></div>';
  document.body.append(dialog);
  const svg=dialog.querySelector("svg");
  dialog.querySelector(".si-plus-spot-image").addEventListener("load",fitEditorImage);
  if(typeof ResizeObserver==="function")new ResizeObserver(fitEditorImage).observe(dialog.querySelector(".si-plus-spot-stage"));
  const rememberEdit=before=>{undoHistory.push(before||JSON.stringify(zones));if(undoHistory.length>30)undoHistory.shift()};
  const pointerPosition=e=>{
   const bounds=svg.getBoundingClientRect();
   return {
    // Keep pointer coordinates unbounded during moves. A drag started in
    // the middle of a region must travel past the image edge to align its
    // far side with the boundary; the region itself is clamped below.
    x:(e.clientX-bounds.left)/Math.max(1,bounds.width)*1000,
    y:(e.clientY-bounds.top)/Math.max(1,bounds.height)*562.5
   };
  };
  svg.addEventListener("pointerdown",e=>{
   if(e.button!==0&&e.pointerType==="mouse")return;
   const p=pointerPosition(e);
   const hit=e.target.closest?.("[data-zone]");
   if(interaction==="move"&&hit){
    const found=zones.find(z=>z.id===hit.dataset.zone);
    if(!found)return;
    selection=found.id;
    drawing=e.target.dataset.resize?
     {kind:"resize",id:e.pointerId,start:p,origin:{x:found.x,y:found.y,w:found.w,h:found.h},corner:e.target.dataset.resize,zoneId:found.id}:
     {kind:"move",id:e.pointerId,start:p,origin:{x:found.x,y:found.y},zoneId:found.id};
    svg.setPointerCapture(e.pointerId);
    updateEditor();
   }else if(interaction==="add"||interaction==="move"){
    // Empty parts of the image are always drawable. Otherwise Move/Select
    // makes the area outside existing red rectangles appear inaccessible.
    const chosen=zones.find(z=>z.id===selection);
    if(interaction==="move"&&chosen)nextEffect=chosen.effect||nextEffect;
    drawing={kind:"draw",id:e.pointerId,x:clamp(p.x,0,1000),y:clamp(p.y,0,562.5)};
    svg.setPointerCapture(e.pointerId);
   }
   e.preventDefault();
  });
  svg.addEventListener("pointermove",e=>{
   if(!drawing||drawing.id!==e.pointerId)return;
   const p=pointerPosition(e);
   if(drawing.kind==="resize"){
    const z=zones.find(item=>item.id===drawing.zoneId);
    if(!z)return;
    const o=drawing.origin,c=drawing.corner;
    const dx=p.x-drawing.start.x,dy=p.y-drawing.start.y;
    const right=o.x+o.w,bottom=o.y+o.h;
    if(c.includes("w")){z.x=clamp(o.x+dx,0,right-15);z.w=right-z.x}
    else{z.x=o.x;z.w=clamp(o.w+dx,15,1000-o.x)}
    if(c.includes("n")){z.y=clamp(o.y+dy,0,bottom-15);z.h=bottom-z.y}
    else{z.y=o.y;z.h=clamp(o.h+dy,15,562.5-o.y)}
    dirty=true;updateEditor();
   }else if(drawing.kind==="move"){
    const z=zones.find(item=>item.id===drawing.zoneId);
    if(!z)return;
    const rawX=drawing.origin.x+p.x-drawing.start.x;
    const rawY=drawing.origin.y+p.y-drawing.start.y;
    // Snap when the pointer approaches an image edge, regardless of
    // where inside the region the drag began. This avoids requiring a
    // pointer to cross into the side controls to achieve full alignment.
    const edgeX=Math.min(75,Math.max(18,z.w/2));
    const edgeY=Math.min(55,Math.max(14,z.h/2));
    z.x=rawX>=1000-z.w-edgeX?1000-z.w:
      rawX<=edgeX?0:clamp(rawX,0,1000-z.w);
    z.y=rawY>=562.5-z.h-edgeY?562.5-z.h:
      rawY<=edgeY?0:clamp(rawY,0,562.5-z.h);
    if(Math.abs(z.x-drawing.origin.x)+Math.abs(z.y-drawing.origin.y)>1)dirty=true;
    // Redraw the selected shape without replacing the capture target.
    const elem=svg.querySelector('[data-zone="'+z.id+'"] > *');
    if(elem){
     if(z.shape==="rect"){
      elem.setAttribute("x",z.x);elem.setAttribute("y",z.y);
     }else{
      elem.setAttribute("cx",z.x+z.w/2);elem.setAttribute("cy",z.y+z.h/2);
     }
    }
   }else{
    const px=clamp(p.x,0,1000),py=clamp(p.y,0,562.5);
    const left=Math.min(drawing.x,px),top=Math.min(drawing.y,py);
    const preview={shape:mode,x:left,y:top,w:Math.abs(px-drawing.x),h:Math.abs(py-drawing.y)};
    let ghost=svg.querySelector(".si-plus-spot-preview");
    if(!ghost){ghost=document.createElementNS(NS,"g");ghost.classList.add("si-plus-spot-preview");svg.append(ghost)}
    ghost.innerHTML=shape(preview,{fill:"#4de7ff","fill-opacity":.16,stroke:"#4de7ff","stroke-width":5,"stroke-dasharray":"12 8","pointer-events":"none"});
   }
  });
  svg.addEventListener("pointerup",e=>{
   if(!drawing||drawing.id!==e.pointerId)return;
   const current=drawing;drawing=null;
   if(current.kind==="resize"){
    const z=zones.find(z=>z.id===current.zoneId),old=current.origin;
    if(z&&Math.abs(z.x-old.x)+Math.abs(z.y-old.y)+Math.abs(z.w-old.w)+Math.abs(z.h-old.h)>.1){
     rememberEdit(JSON.stringify(zones.map(item=>item.id===current.zoneId?{...item,...old}:item)));
     dirty=true;
    }
    updateEditor();return;
   }
   if(current.kind==="move"){
    const moved=zones.find(z=>z.id===current.zoneId);
    if(moved&&(Math.abs(moved.x-current.origin.x)+Math.abs(moved.y-current.origin.y)>0.1)){
     const previous=zones.map(z=>z.id===current.zoneId?{...z,x:current.origin.x,y:current.origin.y}:z);
     rememberEdit(JSON.stringify(previous));dirty=true;
    }
    updateEditor();return
   }
   const raw=pointerPosition(e);
   const p={x:clamp(raw.x,0,1000),y:clamp(raw.y,0,562.5)};
   const x=Math.min(p.x,current.x),y=Math.min(p.y,current.y);
   const w=Math.abs(p.x-current.x),h=Math.abs(p.y-current.y);
   if(w<10||h<10){updateEditor();return}
   const z={id:uid(),name:(nextEffect==="dim"?"Dim Area ":"Highlight ")+(zones.length+1),shape:mode,x,y,w,h,color:"red",effect:nextEffect};
   rememberEdit();zones.push(z);selection=z.id;interaction="move";dirty=true;updateEditor();
  });
  // Keep editing across the full image even when the pointer crosses its edge.
  // SVG pointer capture normally suffices, but window-level fallback protects
  // browsers that release capture during a child-shape redraw.
  window.addEventListener("pointermove",e=>{
   if(!drawing||drawing.id!==e.pointerId||svg.contains(e.target))return;
   svg.dispatchEvent(new PointerEvent("pointermove",{
    pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY,
    pointerType:e.pointerType,bubbles:false
   }));
  });
  window.addEventListener("pointerup",e=>{
   if(!drawing||drawing.id!==e.pointerId||svg.contains(e.target))return;
   svg.dispatchEvent(new PointerEvent("pointerup",{
    pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY,
    pointerType:e.pointerType,bubbles:false
   }));
  });
  svg.addEventListener("pointercancel",()=>{drawing=null;updateEditor()});
  function closeEditor(){
   if(dirty&&JSON.stringify(zones)!==originalZones&&!window.confirm("Discard unsaved Spotlight edits?"))return;
   dialog.hidden=true;drawing=null;dirty=false;
  }
  dialog.querySelector(".si-plus-spot-close").onclick=closeEditor;
  dialog.addEventListener("keydown",e=>{if(e.key==="Escape"){closeEditor();e.preventDefault()}});

  dialog.querySelectorAll("[data-mode]").forEach(btn=>btn.onclick=()=>{mode=btn.dataset.mode;interaction="add";updateEditor()});
  dialog.querySelectorAll("[data-new-effect]").forEach(btn=>btn.onclick=()=>{
   nextEffect=btn.dataset.newEffect;
   const count=zones.length;
   const offset=(count%6)*48;
   const w=220,h=125;
   const z={id:uid(),name:(nextEffect==="dim"?"Dim Area ":"Highlight ")+(count+1),
    shape:mode,x:clamp(120+offset,0,1000-w),y:clamp(90+offset,0,562.5-h),w,h,
    color:"red",effect:nextEffect};
   rememberEdit();
   zones.push(z);selection=z.id;interaction="move";dirty=true;updateEditor();
  });
  dialog.querySelectorAll("[data-interaction]").forEach(btn=>btn.onclick=()=>{interaction=btn.dataset.interaction;updateEditor()});
  for(const [id,key] of [["siPlusSpotName","name"],["siPlusSpotEffect","effect"],["siPlusSpotColor","color"]]){
   dialog.querySelector("#"+id).addEventListener("change",e=>{
    const z=zones.find(z=>z.id===selection);if(z&&z[key]!==e.target.value){rememberEdit();z[key]=e.target.value;dirty=true;updateEditor()}
   })
  }
  const boundMax={x:1000,y:562.5,w:1000,h:562.5};
  dialog.querySelectorAll("[data-bound]").forEach(input=>{
   input.addEventListener("change",()=>{
    const z=zones.find(item=>item.id===selection),field=input.dataset.bound;
    if(!z||!Number.isFinite(Number(input.value)))return;
    const val=Number(input.value)/100*boundMax[field];
    const next={x:z.x,y:z.y,w:z.w,h:z.h};
    if(field==="x"){next.x=clamp(val,0,1000-15);next.w=Math.min(next.w,1000-next.x)}
    if(field==="y"){next.y=clamp(val,0,562.5-15);next.h=Math.min(next.h,562.5-next.y)}
    if(field==="w")next.w=clamp(val,15,1000-next.x);
    if(field==="h")next.h=clamp(val,15,562.5-next.y);
    if(next[field]!==z[field]){rememberEdit();Object.assign(z,next);dirty=true}
    updateEditor();
   });
  });
  dialog.querySelector(".si-plus-spot-full-image").onclick=()=>{
   const z=zones.find(item=>item.id===selection);
   if(!z||z.x===0&&z.y===0&&z.w===1000&&z.h===562.5)return;
   rememberEdit();Object.assign(z,{x:0,y:0,w:1000,h:562.5});
   dirty=true;interaction="move";updateEditor();
  };
  for(const [selector,edge] of [[".si-plus-spot-align-right","right"],[".si-plus-spot-align-left","left"]]){
   dialog.querySelector(selector).onclick=()=>{
    const chosen=zones.find(z=>z.id===selection);
    if(!chosen)return;
    const x=edge==="right"?Math.max(0,1000-chosen.w):0;
    if(chosen.x===x)return;
    rememberEdit();chosen.x=x;dirty=true;interaction="move";updateEditor();
   };
  }
  dialog.querySelector(".si-plus-spot-delete").onclick=()=>{
   if(!zones.some(z=>z.id===selection))return;
   rememberEdit();zones=zones.filter(z=>z.id!==selection);selection="";dirty=true;updateEditor()
  };
  dialog.querySelector(".si-plus-spot-undo").onclick=()=>{
    if(!undoHistory.length)return;
    zones=JSON.parse(undoHistory.pop());
    if(!zones.some(z=>z.id===selection))selection=zones.at(-1)?.id||"";
    dirty=JSON.stringify(zones)!==originalZones;updateEditor();
   };
  dialog.querySelector(".si-plus-spot-save").onclick=()=>{
   const slide=activeSlide();if(!slide||slide.id!==editorSlideId){if(typeof toast==="function")toast("The active slide changed. Reopen Spotlight to edit the correct slide.");return}
   // Commit the entire collection together. Never replace the slide with the
   // selected region or discard other regions when the editor is reopened.
   const savedZones=JSON.parse(JSON.stringify(zones));
   slide.siSpotlight={enabled:true,zones:savedZones};
   slide.type="instruction";
   const savedCount=slide.siSpotlight.zones.length;
   if(savedCount!==zones.length){
    if(typeof toast==="function")toast("Spotlight save could not retain all regions. Please try again.");
    return;
   }
   dirty=false;undoHistory=[];dialog.hidden=true;
   if(typeof render==="function")render();
   if(typeof toast==="function")toast("Saved "+savedCount+" Spotlight region"+(savedCount===1?"":"s")+" to this slide. Save Presentation to keep them.");
  };
  dialog.querySelector(".si-plus-spot-remove").onclick=()=>{
   const slide=activeSlide();if(!slide)return;
   if(!window.confirm("Remove Spotlight highlights from this slide?"))return;
   delete slide.siSpotlight;dialog.hidden=true;
   if(typeof render==="function")render();
  };
 }
 function updateEditor(){
  if(!dialog)return;
  dialog.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  dialog.querySelectorAll("[data-interaction]").forEach(b=>b.classList.toggle("active",b.dataset.interaction===interaction));
  dialog.querySelectorAll("[data-new-effect]").forEach(b=>b.classList.toggle("active",interaction==="add"&&b.dataset.newEffect===nextEffect));
  dialog.querySelector(".si-plus-spot-drawing").style.cursor=interaction==="add"?"crosshair":"move";
  const svg=dialog.querySelector("svg");
  // A transparent painted target covers the full SVG viewport. Without
  // it, browsers may hit-test only existing shapes, making empty regions
  // near the image edges impossible to draw on.
  svg.innerHTML='<rect class="si-plus-spot-hit-area" x="0" y="0" width="1000" height="562.5" fill="transparent" pointer-events="all"/>'+[...zones].sort((a,b)=>Number(a.id===selection)-Number(b.id===selection)).map(z=>{
   const c=colors[z.color]||colors.red;
   const markup=shape(z,{fill:c,"fill-opacity":.1,stroke:c,"stroke-width":z.id===selection?8:5});
   const handles=z.id===selection&&interaction==="move"?
    [["nw",z.x,z.y],["ne",z.x+z.w,z.y],["sw",z.x,z.y+z.h],["se",z.x+z.w,z.y+z.h]]
    .map(([corner,cx,cy])=>'<circle data-zone="'+escape(z.id)+'" data-resize="'+corner+
    '" cx="'+clamp(cx,12,988)+'" cy="'+clamp(cy,12,550.5)+
    '" r="12" fill="#f9d49b" stroke="#071e33" stroke-width="4" style="cursor:nwse-resize"/>').join(""):"";
   return '<g data-zone="'+escape(z.id)+'">'+markup+handles+'</g>';
  }).join("");
  // Set hit target on child shapes as well as its group.
  svg.querySelectorAll("g").forEach(g=>{g.querySelector("*").dataset.zone=g.dataset.zone});
  const list=dialog.querySelector(".si-plus-spot-list");list.replaceChildren();
  for(const z of zones){
   const b=document.createElement("button");b.type="button";b.textContent=z.name;
   b.classList.toggle("active",z.id===selection);b.onclick=()=>{selection=z.id;interaction="move";updateEditor()};
   list.append(b)
  }
  const chosen=zones.find(z=>z.id===selection);
  for(const [id,key] of [["siPlusSpotName","name"],["siPlusSpotEffect","effect"],["siPlusSpotColor","color"]]){
   const input=dialog.querySelector("#"+id);
   input.disabled=!chosen;input.value=chosen?chosen[key]:"";
  }
  dialog.querySelector(".si-plus-spot-delete").disabled=!chosen;
  dialog.querySelector(".si-plus-spot-full-image").disabled=!chosen;
  for(const input of dialog.querySelectorAll("[data-bound]")){
   const field=input.dataset.bound,scale=field==="x"||field==="w"?1000:562.5;
   input.disabled=!chosen;
   input.value=chosen?String(Math.round(chosen[field]/scale*1000)/10):"";
  }
  dialog.querySelector(".si-plus-spot-align-right").disabled=!chosen;
  dialog.querySelector(".si-plus-spot-align-left").disabled=!chosen;
  dialog.querySelector(".si-plus-spot-undo").disabled=!undoHistory.length;
  const indicator=dialog.querySelector(".si-plus-spot-state");
  if(indicator)indicator.textContent=zones.length?
    zones.length+" region"+(zones.length===1?"":"s")+" · "+(interaction==="add"?"Draw a new "+(nextEffect==="dim"?"dim area":"highlight"):(chosen?"Drag "+chosen.name+" to move it, or choose Add to draw another":"Select a region or choose Add to draw another")):
    "Drag on any empty part of the image to create a region.";

 }
 function slideTypeSync(){
  if(!teacher())return;
  const select=document.getElementById("siPlusSlideType"),slide=activeSlide();
  if(!select||!slide)return;
  if(!select.querySelector('option[value="spotlight"]')){
   const option=document.createElement("option");
   option.value="spotlight";option.textContent="◎ Spotlight";select.append(option);
  }
  if(!select.dataset.spotlightBound){
   select.dataset.spotlightBound="true";
   select.addEventListener("change",event=>{
    const current=activeSlide();if(!current)return;
    if(select.value==="spotlight"){
     event.stopImmediatePropagation();
     current.type="instruction";
     current.siSpotlight=current.siSpotlight?.enabled?current.siSpotlight:{enabled:true,zones:[]};
     if(typeof renderPresentationBuilder==="function")renderPresentationBuilder();
     else if(typeof render==="function")render();
     slideTypeSync();
     if(validImage(current.image))openEditor();
     else if(typeof toast==="function")toast("Upload an image, then select Edit Spotlight to add highlights.");
    }else if(current.siSpotlight?.enabled)delete current.siSpotlight;
   },true);
  }
  const desired=data(slide)?"spotlight":slide.type;
  if([...select.options].some(option=>option.value===desired)&&select.value!==desired)select.value=desired;
 }
 function editorSync(){
  if(!teacher())return;
  const root=document.querySelector("#presentationBuilderPanel"),slide=activeSlide();
  let button=document.getElementById("siPlusSpotlightEditButton");
  if(!root||!slide){
   button?.remove();return
  }
  if(!button||!root.contains(button)){
   button?.remove();button=document.createElement("button");button.type="button";
   button.id="siPlusSpotlightEditButton";button.className="si-plus-spotlight-edit-button";
   button.onclick=openEditor;
   const row=root.querySelector("#siPlusSlideType")?.parentElement;
   (row||root.querySelector("#slideTitle")?.parentElement||root).append(button);
  }
  const enabled=!!data(slide);
  button.style.display=enabled?"inline-flex":"none";
  button.textContent=enabled?"◎ Edit Spotlight Slide":"◎ Make Spotlight Slide";
  button.title=enabled?"Edit the spotlight highlights on this slide":"Use this slide image as an interactive Spotlight slide";
 }

/* A one-click single-image workflow for teachers who want Spotlight without
 * building a lesson. It still uses SI+'s normal draft/save system. */
function quickSpotlightLaunch(file){
 if(!file||!teacher()||editor()||typeof openNewPresentation!=="function")return;
 openNewPresentation();
 const draft=editor()?.draft;
 if(draft){draft.deckTitle="Quick Spotlight";draft.name="Quick Spotlight"}
 let attempts=0;
 const attach=setInterval(()=>{
  const upload=document.getElementById("siPlusBatchImages");
  if(!upload){if(++attempts>35)clearInterval(attach);return}
  clearInterval(attach);
  const transfer=new DataTransfer();transfer.items.add(file);
  const started=Date.now();
  upload.files=transfer.files;
  upload.dispatchEvent(new Event("change",{bubbles:true}));
  const wait=setInterval(()=>{
   const current=editor();
   if(!current||Date.now()-started>30000){clearInterval(wait);return}
   if(typeof siPlusBatchImportBusy!=="undefined"&&siPlusBatchImportBusy)return;
   const i=(current.draft?.slides||[]).findIndex(s=>validImage(s.image));
   if(i<0)return;
   clearInterval(wait);
   state.editorSlide=i;
   if(typeof renderPresentationBuilder==="function")renderPresentationBuilder();
   openEditor();
  },180);
 },100);
}
function quickSpotlightSync(){
 if(!teacher()||typeof state==="undefined")return;
 const visible=state.activeApp==="si-plus"&&!!state.presentationLibraryOpen
   &&!state.presentationEditor&&!state.activityRun&&state.screen==="activities";
 let button=document.getElementById("siPlusQuickSpotlight");
 if(!visible){button?.remove();return}
 if(!button){
  button=document.createElement("label");button.id="siPlusQuickSpotlight";
  button.className="si-plus-spotlight-quick-launch";
  button.textContent="◎ Quick Spotlight";
  button.title="Create a single Spotlight image slide in SI+";
  const input=document.createElement("input");input.type="file";input.accept="image/*";
  input.style.cssText="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden";
  input.setAttribute("aria-label","Choose Quick Spotlight image");
  input.onchange=()=>quickSpotlightLaunch(input.files?.[0]);
  button.append(input);document.body.append(button);
 }
}
 function tick(){try{installSharedMarkup();quickSpotlightSync();slideTypeSync();editorSync();controlSync();overlaySync()}catch(e){console.warn("SI+ Spotlight integration",e)}}
 window.SIPlusSpotlightSlide={open:openEditor,refresh:tick,renderOverlay:highlight};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{setInterval(tick,350)},{once:true});
 else setInterval(tick,350);
})();