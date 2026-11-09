/* SI Mothership • Activity Library V2.
   Presentation-only enhancement: keeps the existing cards and event handlers,
   applies one consistent illustration well, and paginates DOM nodes in place.
   No classroom state, favorite slot, library data, or saved set mutations. */
(()=>{
 "use strict";
 let currentPage=0, priorSignature="", extrasOpen=false, scheduled=false, observer=null;
 const root=()=>document.getElementById("activitiesPanel");
 const activityGrid=()=>document.getElementById("activityGrid");
 const pageSize=()=>window.innerWidth>=1240?15:window.innerWidth>=970?12:window.innerWidth>=680?9:6;
 function schedule(){
   if(scheduled)return;
   scheduled=true;
   requestAnimationFrame(()=>{scheduled=false;apply()});
 }
 function apply(){
   const panel=root(),grid=activityGrid();
   if(!panel||!grid||!document.body.classList.contains("si-v80-dashboard"))return;
   const toolbar=grid.querySelector(".activity-library-toolbar");
   const catalog=grid.querySelector(".activity-catalog");
   const cardGrid=catalog?.querySelector(".activity-catalog-grid");
   const browsing=!!(toolbar&&catalog&&cardGrid);
   panel.classList.toggle("si-v2-library",browsing);
   if(!browsing){
     currentPage=0;priorSignature="";
     return;
   }
   const cards=[...cardGrid.querySelectorAll(".real-app-card")];
   const signature=cards.map(card=>card.querySelector("[data-open-app]")?.getAttribute("data-open-app")||"").join("|");
   if(signature!==priorSignature){currentPage=0;priorSignature=signature;}
   const recent=grid.querySelector(".activity-library-shelves");
   panel.classList.toggle("si-v2-show-extras",extrasOpen);
   if(recent)recent.setAttribute("aria-label","Recent activities and saved presets");
   let extras=toolbar.querySelector(".si-v2-extras-toggle");
   if(!extras){
     extras=document.createElement("button");
     extras.type="button";
     extras.className="si-v2-extras-toggle";
     extras.title="Show or hide recent activities and saved presets";
     extras.addEventListener("click",()=>{
       extrasOpen=!extrasOpen;
       panel.classList.toggle("si-v2-show-extras",extrasOpen);
       extras.setAttribute("aria-expanded",String(extrasOpen));
     });
     toolbar.appendChild(extras);
   }
   extras.textContent="▤ Recent & Saved";
   extras.setAttribute("aria-expanded",String(extrasOpen));
   for(const card of cards){
     const open=card.querySelector("[data-open-app]");
     const app=open?.dataset.openApp;
     // Keep the full accessible app name; shorten only the long visible CTA.
     if(app==="scientific-calculator"&&open?.textContent.trim()!=="Open Calculator"){
       open.setAttribute("aria-label","Open Scientific Calculator");
       open.textContent="Open Calculator";
     }
     const details=card.querySelector("p")?.textContent.trim();
     if(details)card.title=details;
     const shortcut=card.querySelector("[data-add-app],[data-manage-shortcut],[data-assign-app]");
     if(shortcut){
       shortcut.title=shortcut.textContent.trim();
       shortcut.setAttribute("aria-label",shortcut.textContent.trim());
     }
     // Standalone V3 illustrations are real SVG assets. Overlay after the older
     // V2 artwork loads so missing files safely fall back to existing graphics.
     // No card buttons, registry metadata or teacher/game state are replaced.
     const artSlug=({sketch:"sketch-signal",pixel:"pixel-reveal"})[app]||app;
     const well=card.querySelector(".act-icon");
     if(well&&artSlug&&!well.dataset.siV3Artwork){
       well.dataset.siV3Artwork=artSlug;
       const picture=document.createElement("img");
       picture.className="si-v3-illustration";
       picture.alt="";
       picture.decoding="async";
       picture.loading="eager";
       picture.onload=()=>{
         if(picture.isConnected&&picture.naturalWidth>0)well.classList.add("si-v3-art-ready");
       };
       picture.onerror=()=>{
         well.classList.remove("si-v3-art-ready");
         picture.remove();well.dataset.siV3Artwork="";
       };
       picture.src="/activity-library-v3-art/"+artSlug+".svg";
       well.appendChild(picture);
     }
     if(app==="board"&&!card.querySelector(".si-v2-board-image")){
       const well=card.querySelector(".act-icon");
       if(well){
         const img=document.createElement("img");
         img.className="si-v2-board-image";
         img.src="/activity-library-v2-art/board-whiteboard.svg";
         img.alt="Shared whiteboard with drawing and marker";
         img.loading="lazy";
         img.decoding="async";
         well.appendChild(img);
       }
     }
   }
   const perPage=pageSize(),pageCount=Math.max(1,Math.ceil(cards.length/perPage));
   currentPage=Math.max(0,Math.min(currentPage,pageCount-1));
   cards.forEach((card,index)=>{
     const hidden=index<currentPage*perPage||index>=(currentPage+1)*perPage;
     card.classList.toggle("si-v2-page-hidden",hidden);
     card.setAttribute("aria-hidden",String(hidden));
     if("inert" in card)card.inert=hidden;
   });
   const visibleCount=Math.max(0,Math.min(perPage,cards.length-currentPage*perPage));
   cardGrid.classList.toggle("si-v2-second-page",pageCount>1&&visibleCount<=6&&currentPage>0&&window.innerWidth>=970);
   let pager=catalog.querySelector(".si-v2-pagination");
   if(!pager){
     pager=document.createElement("nav");
     pager.className="si-v2-pagination";
     pager.setAttribute("aria-label","Activity Library pages");
     pager.innerHTML='<button type="button" class="si-v2-prev" aria-label="Previous activity page">‹</button><span class="si-v2-page-label"></span><button type="button" class="si-v2-next" aria-label="Next activity page">›</button><span class="si-v2-page-count"></span>';
     pager.querySelector(".si-v2-prev").addEventListener("click",()=>turn(-1));
     pager.querySelector(".si-v2-next").addEventListener("click",()=>turn(1));
     catalog.appendChild(pager);
   }
   pager.hidden=pageCount<2;
   pager.querySelector(".si-v2-prev").disabled=currentPage===0;
   pager.querySelector(".si-v2-next").disabled=currentPage>=pageCount-1;
   pager.querySelector(".si-v2-page-label").textContent="Page "+(currentPage+1)+" of "+pageCount;
   pager.querySelector(".si-v2-page-count").textContent=cards.length+" activities";
   const count=catalog.querySelector(".activity-catalog-head > span");
   if(count)count.textContent=cards.length?("Showing "+(currentPage*perPage+1)+"–"+Math.min((currentPage+1)*perPage,cards.length)+" of "+cards.length):"No activities match";
 }
 function turn(delta){
   const panel=root();
   if(!panel?.classList.contains("si-v2-library"))return;
   currentPage+=delta;
   apply();
   const cat=activityGrid()?.querySelector(".activity-catalog");
   if(cat&&panel.scrollTop>cat.offsetTop-180)panel.scrollTop=Math.max(0,cat.offsetTop-180);
 }
 function start(){
   const grid=activityGrid(),panel=root();
   if(!grid||!panel)return;
   observer=new MutationObserver(schedule);
   observer.observe(grid,{childList:true});
   observer.observe(panel,{attributes:true,attributeFilter:["class"]});
   window.addEventListener("resize",schedule,{passive:true});
   schedule();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();
