/* SI Mothership · student browser companion.
   A deliberate user click opens a small separate Chrome/Edge window beside Zoom.
   No student state is changed and nothing is stored to the classroom server. */
(function(){
 "use strict";
 if(new URLSearchParams(location.search).get("role")!=="student")return;
 const DEVICE_WIDTH=440, DEVICE_HEIGHT=780;
 const POPOUT_NAME="si_mothership_student_sidecar";
 const params=new URLSearchParams(location.search);
 const isPopout=window.name===POPOUT_NAME || params.get("compact")==="1";
 function desktopWindow(){
   // Touch-enabled Windows PCs may report pointer:coarse although Chrome
   // is running as a desktop browser. Do not treat them as phones.
   const agent=navigator.userAgent||"";
   if(innerWidth<760 || /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(agent))return false;
   return matchMedia("(pointer:fine)").matches
      ||matchMedia("(hover:hover)").matches || innerWidth>=900;
 }
 let deviceLaunched=false;
 let activeWindow=null;
 function blockedNotice(){
   const device=document.querySelector("body.role-student #student .device");
   if(!device||document.querySelector("#siStudentPopupBlocked"))return;
   const notice=document.createElement("div");
   notice.id="siStudentPopupBlocked";
   notice.setAttribute("role","alert");
   notice.innerHTML='<span><b>Compact window blocked by Chrome.</b> '
     +'Allow pop-ups for this site, or continue joining here.</span>'
     +'<button type="button" aria-label="Dismiss popup warning">✕</button>';
   notice.querySelector("button").addEventListener("click",()=>notice.remove());
   device.querySelector(".device-head")?.insertAdjacentElement("afterend",notice);
 }
 function endHandoff(){
   deviceLaunched=false;
   activeWindow=null;
   document.body.classList.remove("si-student-window-handed-off");
   document.querySelector("#siStudentWindowHandoff")?.remove();
 }
 function showHandoff(popup){
   activeWindow=popup;
   if(document.querySelector("#siStudentWindowHandoff"))return;
   const handoff=document.createElement("div");
   handoff.id="siStudentWindowHandoff";
   handoff.setAttribute("role","status");
   handoff.setAttribute("aria-live","polite");
   handoff.innerHTML='<div class="si-student-handoff-card">'
     +'<span class="si-handoff-symbol" aria-hidden="true">↗</span>'
     +'<span class="si-handoff-eyebrow">STUDENT DEVICE CONNECTED</span>'
     +'<h1>Continue in your classroom device</h1>'
     +'<p>SI Mothership opened in a compact browser window beside Zoom.</p>'
     +'<small>This is the extra browser tab. You can close it and continue in your device window.</small>'
     +'</div>';
   handoff.addEventListener("click",()=>{
     if(activeWindow?.closed){endHandoff();return}
     try{activeWindow?.focus()}catch(e){}
   });
   document.body.appendChild(handoff);
   document.body.classList.add("si-student-window-handed-off");
   // Some browsers keep the original tab backgrounded and never emit its
   // focus event when the popup closes. Restore the original login promptly
   // regardless, so students are never stranded on the handoff screen.
   const closedCheck=setInterval(()=>{
     if(!deviceLaunched || !activeWindow || activeWindow.closed){
       clearInterval(closedCheck);
       if(deviceLaunched)endHandoff();
     }
   },500);
 }
 window.addEventListener("focus",()=>{
   if(deviceLaunched && activeWindow?.closed)endHandoff();
 });
 function openDeviceWindow(options={}){
   if(deviceLaunched || isPopout || !desktopWindow())return null;
   const {code,avatarKey}=options;
   // Only invoke this from a real user click: browsers prohibit resizing an existing tab.
   const url=new URL(location.href);
   url.searchParams.set("compact","1");
   if(code)url.searchParams.set("code",code);
   if(typeof STUDENT_SESSION_ID!=="undefined" && STUDENT_SESSION_ID)
      url.searchParams.set("sid",STUDENT_SESSION_ID);
   if(avatarKey)url.searchParams.set("pickAvatar",avatarKey);
   else url.searchParams.delete("pickAvatar");
   const maxWidth=screen.availWidth||DEVICE_WIDTH;
   const maxHeight=screen.availHeight||DEVICE_HEIGHT;
   const desiredWidth=Math.min(DEVICE_WIDTH,maxWidth);
   const desiredHeight=Math.min(DEVICE_HEIGHT,Math.max(420,maxHeight-65));
   const left=Math.max(0,(screen.availLeft||0)+Math.round((maxWidth-desiredWidth)/2));
   const top=Math.max(0,(screen.availTop||0)+Math.round((maxHeight-desiredHeight)/2));
   const features="popup=yes,width="+desiredWidth+",height="+desiredHeight
     +",left="+left+",top="+top+",resizable=yes,scrollbars=yes,toolbar=no,menubar=no,status=no";
   const popup=window.open(url.toString(),POPOUT_NAME,features);
   if(popup){
     deviceLaunched=true;
     showHandoff(popup);
     try{popup.focus()}catch(e){}
     return popup;
   }
   // If a browser disallows this user-initiated popup, keep the normal
   // classroom join fully functional instead of showing an extra option.
   blockedNotice();
   return null;
 }
 // Browser chrome takes up part of a popup's outer height. The window is
 // script-created, so it can be adjusted to make the actual viewport match
 // the 440 × 780 controller while keeping the popup resizable beside Zoom.
 function fitPopupViewport(){
   if(window.name!==POPOUT_NAME || typeof window.resizeTo!=="function")return;
   requestAnimationFrame(()=>{
     const chromeW=Math.max(0,outerWidth-innerWidth);
     const chromeH=Math.max(0,outerHeight-innerHeight);
     const usableW=(screen.availWidth||DEVICE_WIDTH)-chromeW;
     const usableH=(screen.availHeight||DEVICE_HEIGHT)-chromeH;
     const w=Math.max(320,Math.min(DEVICE_WIDTH,usableW));
     const h=Math.max(440,Math.min(DEVICE_HEIGHT,usableH));
     if(Math.abs(innerWidth-w)>5||Math.abs(innerHeight-h)>5){
       try{resizeTo(Math.round(w+chromeW),Math.round(h+chromeH))}catch(e){}
     }
   });
 }
 // When a classroom QR link already contains the session code, the first
 // avatar tap opens the sized window and selects that same avatar there.
 // This uses the existing join controls, not a second pop-out choice.
 function selectAvatarInDevice(){
   const requested=params.get("pickAvatar");
   if(!isPopout||!requested)return;
   let observer=null,timer=null,done=false,attempts=0;
   const finish=()=>{
     done=true;
     if(observer)observer.disconnect();
     if(timer)clearInterval(timer);
     const u=new URL(location.href);
     u.searchParams.delete("pickAvatar");
     history.replaceState(null,"",u.pathname+u.search);
   };
   const choose=()=>{
     if(done)return true;
     if(typeof studentNeedsJoin==="function" && !studentNeedsJoin()){
       finish();return true;
     }
     if(typeof networkHydrated==="undefined" || !networkHydrated)return false;
     // A newly opened companion can hydrate after its initial render.
     // Align the first join stage before applying the original avatar click.
     if(typeof joinStep!=="undefined" && joinStep==="code"
       && typeof joinCodeDraft!=="undefined" && joinCodeDraft===STUDENT_JOIN_CODE){
       joinStep="avatar";
       if(typeof renderPublic==="function")renderPublic();
     }
     const avatar=[...document.querySelectorAll("#studentContent [data-join-avatar]")]
       .find(btn=>btn.dataset.joinAvatar===requested);
     if(!avatar)return false;
     finish(); // Prevent a second click during the synchronous render.
     avatar.click();
     return true;
   };
   if(choose())return;
   const content=document.querySelector("#studentContent");
   if(!content)return;
   observer=new MutationObserver(choose);
   observer.observe(content,{childList:true,subtree:true});
   // Network hydration may finish without mutating #studentContent at
   // exactly the same instant, so keep a bounded retry in addition.
   timer=setInterval(()=>{
     if(++attempts>120)finish();
     else choose();
   },100);
 }
 function install(){
  const head=document.querySelector("body.role-student #student .device-head");
  if(!head||head.querySelector(".si-student-header-tools"))return;
  const status=head.querySelector("#studentConnectionLabel");
  if(!status)return;
  const tools=document.createElement("span");
  tools.className="si-student-header-tools";
  head.appendChild(tools);
  tools.appendChild(status);
  if(isPopout){
    document.body.classList.add("si-student-is-popout");
    fitPopupViewport();
    selectAvatarInDevice();
    return;
  }
  // Only actual join actions (or in-class game controls) launch a popup.
  // Selecting/searching an avatar and entering a code remain functional in
  // the original tab until the student has made a meaningful choice.
  function validCode(){
    const supplied=String(document.querySelector("#joinCodeInput")?.value||"").trim().toUpperCase();
    return typeof STUDENT_JOIN_CODE!=="undefined" && supplied===STUDENT_JOIN_CODE;
  }
  function launchFromKey(event){
    if(event.key!=="Enter" || !event.isTrusted || deviceLaunched
       ||isPopout ||!desktopWindow())return;
    const search=event.target.matches("#studentContent .si-avatar-search input");
    const codeInput=event.target.matches("#joinCodeInput");
    if(!search && !codeInput)return;
    if(codeInput&&!validCode())return; // Let the existing invalid-code UI work.
    let avatarKey="";
    if(search){
      const avatar=[...document.querySelectorAll("#studentContent [data-join-avatar]")].find(el=>!el.hidden);
      if(!avatar)return;
      avatarKey=avatar.dataset.joinAvatar;
    }
    const popup=openDeviceWindow({
      code:(validCode()||search)?STUDENT_JOIN_CODE:"",
      avatarKey
    });
    if(popup){event.preventDefault();event.stopImmediatePropagation()}
  }
  document.addEventListener("keydown",launchFromKey,true);
  document.addEventListener("click",event=>{
    if(deviceLaunched || !desktopWindow() || isPopout || !event.isTrusted)return;
    // The first search-field click can start the compact window too.
    const avatarSearch=event.target.closest("#studentContent .si-avatar-search input");
    const joinCode=event.target.closest("#joinCodeBtn");
    const avatar=event.target.closest("#studentContent [data-join-avatar]");
    const confirm=event.target.closest("#joinClassBtn");
    const joined=typeof studentNeedsJoin==="function"&&!studentNeedsJoin();
    const gameAction=joined && event.target.closest(
      "#studentContent button, #studentContent [role=button], #studentControls button");
    if(!avatarSearch&&!joinCode&&!avatar&&!confirm&&!gameAction)return;
    if(joinCode && !validCode())return;
    let code="";
    if(typeof STUDENT_JOIN_CODE!=="undefined" &&
       (joinCode || avatar || validCode()))code=STUDENT_JOIN_CODE;
    const popup=openDeviceWindow({code,avatarKey:avatar?.dataset.joinAvatar});
    if(!popup)return; // Fall back to the unmodified join click if blocked.
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);
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
      +'<div class="si-avatar-page-buttons"><button type="button" data-si-avatar-prev aria-label="Previous avatars">‹</button><output class="si-avatar-page-count" aria-live="polite" aria-label="Avatar page">1 / 1</output><button type="button" data-si-avatar-next aria-label="Next avatars">›</button></div>';
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
      const scroller=document.querySelector("body.role-student #studentContent");
      if(scroller)scroller.scrollTop=0;
    });
    search.addEventListener("keydown",event=>{
      if(event.key!=="Enter")return;
      const first=activeGrid?.querySelector("[data-join-avatar]:not([hidden])");
      if(first&&!first.disabled){event.preventDefault();first.click();}
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
