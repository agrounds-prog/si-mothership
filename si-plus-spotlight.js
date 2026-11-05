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
 const highlight=(zones,visible)=>{
  const selected=zones.filter(z=>visible.includes(z.id));
  const dims=selected.filter(z=>z.effect==="dim");
  let html='<defs><filter id="siSpotGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>';
  if(dims.length)html+='<mask id="siSpotMask"><rect width="1000" height="562.5" fill="white"/>'+dims.map(z=>shape(z,{fill:"black"})).join("")+'</mask>';
  html+='</defs>';
  if(dims.length)html+='<rect width="1000" height="562.5" fill="#020a14" opacity=".65" mask="url(#siSpotMask)"/>';
  for(const z of selected){
   const c=colors[z.color]||colors.red;
   html+=shape(z,{fill:"none",stroke:c,"stroke-width":18,opacity:.8,filter:"url(#siSpotGlow)"});
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
 function fitOverlay(svg,img){
  const rect=img.getBoundingClientRect();
  const screen=img.ownerDocument.defaultView;
  if(!rect.width||!rect.height||!svg.isConnected){svg.style.display="none";return}
  svg.style.display="block";
  const nw=img.naturalWidth||16,nh=img.naturalHeight||9;
  let dw=rect.width,dh=rect.height;
  const fit=screen.getComputedStyle(img).objectFit;
  if(fit==="contain"||fit==="scale-down"){
   const scale=Math.min(rect.width/nw,rect.height/nh);
   dw=nw*scale;dh=nh*scale;
  }
  svg.style.left=(rect.left+(rect.width-dw)/2)+"px";
  svg.style.top=(rect.top+(rect.height-dh)/2)+"px";
  svg.style.width=dw+"px";svg.style.height=dh+"px";
 }
 const overlays=new Map();
 function clearOverlays(){
  for(const [key,rec] of overlays){rec.svg.remove();overlays.delete(key)}
 }
 function liveVisibility(info){
  const values=info.run.siSpotlightVisible;
  if(values&&values.slideId===info.slide.id&&Array.isArray(values.ids))return values.ids;
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
   const markup=highlight(zones,ids);
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
 let dialog=null,mode="rect",selection="",drawing=null,zones=[];
 function fitEditorImage(){
  if(!dialog||dialog.hidden)return;
  const image=dialog.querySelector(".si-plus-spot-image");
  const svg=dialog.querySelector(".si-plus-spot-drawing");
  const stage=dialog.querySelector(".si-plus-spot-stage");
  if(!image||!svg||!stage)return;
  const sw=stage.clientWidth,sh=stage.clientHeight;
  const iw=image.naturalWidth,ih=image.naturalHeight;
  if(!sw||!sh||!iw||!ih)return;
  const scale=Math.min(sw/iw,sh/ih);
  const dw=iw*scale,dh=ih*scale;
  svg.style.left=(sw-dw)/2+"px";
  svg.style.top=(sh-dh)/2+"px";
  svg.style.width=dw+"px";
  svg.style.height=dh+"px";
 }
 function openEditor(){
  const slide=activeSlide();
  if(!slide){return}
  if(!validImage(slide.image)){if(typeof toast==="function")toast("Add an image to this SI+ slide before using Spotlight.");return}
  zones=JSON.parse(JSON.stringify(data(slide)?.zones||[]));selection="";mode="rect";
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
   '<p>Draw circles or rectangles over the slide. Save to include these highlights in the SI+ presentation.</p>'+
   '<div class="si-plus-spot-layout"><div class="si-plus-spot-stage"><img class="si-plus-spot-image" alt="Spotlight slide image"><svg class="si-plus-spot-drawing" viewBox="0 0 1000 562.5" preserveAspectRatio="none"></svg></div>'+
   '<aside><div class="si-plus-spot-buttons"><button type="button" data-mode="rect">▱ Rectangle</button><button type="button" data-mode="circle">◯ Circle</button></div>'+
   '<label>Highlight name<input id="siPlusSpotName" maxlength="50" placeholder="What to highlight"></label>'+
   '<label>Effect<select id="siPlusSpotEffect"><option value="outline">Outline Glow</option><option value="dim">Dim Background</option></select></label>'+
   '<label>Color<select id="siPlusSpotColor"><option value="red">Red</option><option value="green">Green</option><option value="blue">Blue</option><option value="yellow">Yellow</option><option value="black">White</option></select></label>'+
   '<div class="si-plus-spot-list"></div><button type="button" class="si-plus-spot-delete">Delete Selected</button>'+
   '<button type="button" class="si-plus-spot-save">✓ Save Spotlight Slide</button><button type="button" class="si-plus-spot-remove">Remove Spotlight Mode</button></aside></div></div>';
  document.body.append(dialog);
  const svg=dialog.querySelector("svg");
  dialog.querySelector(".si-plus-spot-image").addEventListener("load",fitEditorImage);
  if(typeof ResizeObserver==="function")new ResizeObserver(fitEditorImage).observe(dialog.querySelector(".si-plus-spot-stage"));
  svg.addEventListener("pointerdown",e=>{
   if(e.target.dataset.zone){selection=e.target.dataset.zone;updateEditor();return}
   const bounds=svg.getBoundingClientRect();
   const x=clamp((e.clientX-bounds.left)/bounds.width*1000,0,1000);
   const y=clamp((e.clientY-bounds.top)/bounds.height*562.5,0,562.5);
   drawing={x,y,id:e.pointerId};svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointerup",e=>{
   if(!drawing)return;
   const box=svg.getBoundingClientRect();
   const endX=clamp((e.clientX-box.left)/box.width*1000,0,1000);
   const endY=clamp((e.clientY-box.top)/box.height*562.5,0,562.5);
   const x=Math.min(endX,drawing.x),y=Math.min(endY,drawing.y),w=Math.abs(endX-drawing.x),h=Math.abs(endY-drawing.y);
   drawing=null;
   if(w<10||h<10)return;
   const z={id:uid(),name:"Highlight "+(zones.length+1),shape:mode,x,y,w,h,color:"red",effect:"outline"};
   zones.push(z);selection=z.id;updateEditor()
  });
  svg.addEventListener("pointercancel",()=>{drawing=null});
  dialog.querySelector(".si-plus-spot-close").onclick=()=>{dialog.hidden=true};
  dialog.addEventListener("keydown",e=>{if(e.key==="Escape"){dialog.hidden=true;e.preventDefault()}});
  dialog.querySelectorAll("[data-mode]").forEach(btn=>btn.onclick=()=>{mode=btn.dataset.mode;updateEditor()});
  for(const [id,key] of [["siPlusSpotName","name"],["siPlusSpotEffect","effect"],["siPlusSpotColor","color"]]){
   dialog.querySelector("#"+id).addEventListener("change",e=>{
    const z=zones.find(z=>z.id===selection);if(z){z[key]=e.target.value;updateEditor()}
   })
  }
  dialog.querySelector(".si-plus-spot-delete").onclick=()=>{
   zones=zones.filter(z=>z.id!==selection);selection="";updateEditor()
  };
  dialog.querySelector(".si-plus-spot-save").onclick=()=>{
   const slide=activeSlide();if(!slide)return;
   slide.siSpotlight={enabled:true,zones:JSON.parse(JSON.stringify(zones))};
   slide.type="instruction";
   dialog.hidden=true;
   if(typeof render==="function")render();
   if(typeof toast==="function")toast("Spotlight slide saved in draft. Save Presentation to keep it.");
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
  const svg=dialog.querySelector("svg");
  svg.innerHTML=zones.map(z=>{
   const c=colors[z.color]||colors.red;
   const markup=shape(z,{fill:c,"fill-opacity":.1,stroke:c,"stroke-width":z.id===selection?8:5});
   return '<g data-zone="'+escape(z.id)+'">'+markup+'</g>';
  }).join("");
  // Set hit target on child shapes as well as its group.
  svg.querySelectorAll("g").forEach(g=>{g.querySelector("*").dataset.zone=g.dataset.zone});
  const list=dialog.querySelector(".si-plus-spot-list");list.replaceChildren();
  for(const z of zones){
   const b=document.createElement("button");b.type="button";b.textContent=z.name;
   b.classList.toggle("active",z.id===selection);b.onclick=()=>{selection=z.id;updateEditor()};
   list.append(b)
  }
  const chosen=zones.find(z=>z.id===selection);
  for(const [id,key] of [["siPlusSpotName","name"],["siPlusSpotEffect","effect"],["siPlusSpotColor","color"]]){
   const input=dialog.querySelector("#"+id);
   input.disabled=!chosen;input.value=chosen?chosen[key]:"";
  }
  dialog.querySelector(".si-plus-spot-delete").disabled=!chosen;
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
  button.textContent=enabled?"◎ Edit Spotlight Slide":"◎ Make Spotlight Slide";
  button.title=enabled?"Edit the spotlight highlights on this slide":"Use this slide image as an interactive Spotlight slide";
 }
 function tick(){try{editorSync();controlSync();overlaySync()}catch(e){console.warn("SI+ Spotlight integration",e)}}
 window.SIPlusSpotlightSlide={open:openEditor,refresh:tick,renderOverlay:highlight};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{setInterval(tick,350)},{once:true});
 else setInterval(tick,350);
})();