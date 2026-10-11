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
  if(isPopout){document.body.classList.add("si-student-popout");return;}
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