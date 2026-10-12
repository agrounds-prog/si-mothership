/* SI Mothership · student browser companion.
   A deliberate user click opens a small separate Chrome/Edge window beside Zoom.
   No student state is changed and nothing is stored to the classroom server. */
(function(){
 "use strict";
 if(new URLSearchParams(location.search).get("role")!=="student")return;
 function install(){
  const head=document.querySelector("body.role-student #student .device-head");
  if(!head||head.querySelector(".si-student-header-tools"))return;
  const status=head.querySelector("#studentConnectionLabel");
  if(!status)return;
  const tools=document.createElement("span");
  tools.className="si-student-header-tools";
  head.appendChild(tools);
  tools.appendChild(status);
  const isPopout=window.name==="si_mothership_student_sidecar" || new URLSearchParams(location.search).get("compact")==="1";
  if(isPopout){document.body.classList.add("si-student-is-popout");return;}
  const button=document.createElement("button");
  button.type="button";
  button.className="si-student-popout";
  button.textContent="↗ Pop out";
  button.setAttribute("aria-label","Open student controller in a small separate window for Zoom");
  button.title="Open this student controller in a resizable 440 × 780 window beside Zoom";
  button.addEventListener("click",()=>{
   // Reuse the complete authenticated, current-session student URL. Because
   // this is a real user gesture, Chrome/Edge can allow the popup.
   const url=new URL(location.href);
   url.searchParams.set("compact","1");
   const w=window.open(url.toString(),"si_mothership_student_sidecar",
     "popup=yes,width=440,height=780,resizable=yes,scrollbars=yes");
   if(w){w.focus();}
   else if(typeof toast==="function")toast("Allow pop-ups for Mothership to open the student window.");
   else button.title="Pop-up blocked. Allow pop-ups for this website.";
  });
  tools.appendChild(button);
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
 else install();
})();


/* Zoom companion v2: enhance the EXISTING avatar choices (no replacement
   of the join workflow, click handlers, student identity or roster data). */
(function(){
  "use strict";
  if(new URLSearchParams(location.search).get("role")!=="student")return;
  const view={query:"",page:0};
  let activeGrid=null;
  function pageSize(){
    return window.innerWidth<360||window.innerHeight<730?6:9;
  }
  function paint(){
    if(!activeGrid||!activeGrid.isConnected)return;
    const nav=activeGrid.previousElementSibling?.classList.contains("si-avatar-no-match")
      ?activeGrid.previousElementSibling.previousElementSibling
      :activeGrid.previousElementSibling;
    if(!nav?.classList.contains("si-avatar-navigator"))return;
    const all=Array.from(activeGrid.querySelectorAll("[data-join-avatar]"));
    const q=view.query.trim().toLocaleLowerCase();
    const matches=all.filter(el=>!q||(el.textContent+" "+(el.dataset.joinAvatar||"")).toLocaleLowerCase().includes(q));
    const size=pageSize();
    const pages=Math.max(1,Math.ceil(matches.length/size));
    view.page=Math.min(Math.max(0,view.page),pages-1);
    const start=view.page*size;
    const visible=new Set(matches.slice(start,start+size));
    for(const tile of all)tile.hidden=!visible.has(tile);
    const count=nav.querySelector(".si-avatar-page-count");
    if(count){
      count.textContent=matches.length?(view.page+1)+" / "+pages:"0 / 0";
      count.title=matches.length?"Showing "+(start+1)+"–"+Math.min(start+size,matches.length)+" of "+matches.length+" avatars":"No matching avatars";
    }
    nav.querySelector("[data-si-avatar-prev]").disabled=view.page===0||!matches.length;
    nav.querySelector("[data-si-avatar-next]").disabled=view.page>=pages-1||!matches.length;
    const empty=nav.nextElementSibling;
    if(empty?.classList.contains("si-avatar-no-match"))empty.hidden=matches.length!==0;
  }
  function mount(){
    const grid=document.querySelector("body.role-student #studentContent .join-avatar-grid");
    if(!grid){activeGrid=null;return;}
    if(grid===activeGrid&&grid.dataset.siAvatarEnhanced==="1")return;
    activeGrid=grid;
    const nav=document.createElement("div");
    nav.className="si-avatar-navigator";
    nav.setAttribute("aria-label","Find or browse classroom avatars");
    nav.innerHTML='<label class="si-avatar-search"><span class="sr-only">Find avatar by name</span><input type="search" autocomplete="off" placeholder="Find an avatar…" aria-label="Find avatar by name"></label>'
      +'<div class="si-avatar-page-buttons"><button type="button" data-si-avatar-prev aria-label="Previous avatars">‹</button><output class="si-avatar-page-count" aria-live="polite">1 / 1</output><button type="button" data-si-avatar-next aria-label="Next avatars">›</button></div>';
    const empty=document.createElement("p");
    empty.className="si-avatar-no-match";
    empty.setAttribute("role","status");
    empty.textContent="No matching avatars. Try another name.";
    empty.hidden=true;
    grid.insertAdjacentElement("beforebegin",nav);
    grid.insertAdjacentElement("beforebegin",empty);
    const search=nav.querySelector("input");
    search.value=view.query;
    search.addEventListener("input",()=>{
      view.query=search.value;
      view.page=0;
      paint();
    });
    for(const [selector,delta] of [["[data-si-avatar-prev]",-1],["[data-si-avatar-next]",1]]){
      nav.querySelector(selector).addEventListener("click",()=>{
        view.page+=delta;
        paint();
        const scroller=document.querySelector("body.role-student #studentContent");
        if(scroller)scroller.scrollTop=0;
      });
    }
    grid.dataset.siAvatarEnhanced="1";
    paint();
  }
  function install(){
    const content=document.querySelector("body.role-student #studentContent");
    if(!content)return;
    new MutationObserver(mount).observe(content,{childList:true});
    window.addEventListener("resize",paint,{passive:true});
    mount();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();


/* Zoom companion v5: student-only Minefield swipe viewport.
   Work strictly with the existing button nodes so click handlers, sector
   coordinates, confirmation and server-side gameplay are unchanged. */
(function(){
  "use strict";
  if(new URLSearchParams(location.search).get("role")!=="student")return;
  function enhance(){
    const root=document.querySelector("body.role-student #studentContent");
    const board=root?.querySelector(".minefield-student-board");
    if(!board||board.closest(".si-mf-scroll"))return;
    const columns=board.querySelectorAll(".minefield-axis.col").length;
    if(!columns)return;
    const viewport=document.createElement("div");
    viewport.className="si-mf-scroll";
    viewport.setAttribute("role","region");
    viewport.setAttribute("aria-label","Minefield map. Swipe horizontally to reach all sectors.");
    viewport.tabIndex=0;
    board.parentNode.insertBefore(viewport,board);
    viewport.appendChild(board);
    board.style.setProperty("grid-template-columns","22px repeat("+columns+", 44px)","important");
  }
  function install(){
    const root=document.querySelector("body.role-student #studentContent");
    if(!root)return;
    new MutationObserver(enhance).observe(root,{childList:true});
    enhance();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();
