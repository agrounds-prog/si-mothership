/* SI Mothership Dashboard v80 — progressive teacher-only presentation layer.
   Preserve original button nodes and ID handlers; never change classroom state. */
(()=>{
"use strict";
if(window.__siV80DashboardInstalled)return;
window.__siV80DashboardInstalled=true;
const $=s=>document.querySelector(s);
const ICONS={"lobby":"<circle cx=\"24\" cy=\"16\" r=\"6\"/><circle cx=\"12\" cy=\"21\" r=\"4\"/><circle cx=\"36\" cy=\"21\" r=\"4\"/><path d=\"M13 40v-4c0-6 5-9 11-9s11 3 11 9v4z\" fill=\"currentColor\" opacity=\".24\"/><path d=\"M13 40v-4c0-6 5-9 11-9s11 3 11 9v4z\"/><path d=\"M8 29c-3 1-5 4-5 8v2h7M40 29c3 1 5 4 5 8v2h-7\"/>","activities":"<path d=\"m24 4 10 6-10 6-10-6z\" fill=\"currentColor\" opacity=\".5\"/><path d=\"m24 4 10 6-10 6-10-6z\"/><path d=\"m10 17 10 6-10 6L0 23z\" fill=\"currentColor\" opacity=\".3\" transform=\"translate(4 2)\"/><path d=\"m38 19 8 5-8 5-8-5z\" fill=\"currentColor\" opacity=\".55\"/><path d=\"m10 26 10 6-10 6-10-6z\" fill=\"currentColor\" opacity=\".3\"/><path d=\"m24 31 10-6 10 6-10 6z\" fill=\"currentColor\" opacity=\".5\"/><path d=\"m10 26 10 6v8l-10-6zM20 32l-10 6v-4M38 29v9M30 24v7M24 16v9\"/>","agenda":"<rect x=\"11\" y=\"9\" width=\"26\" height=\"34\" rx=\"4\" fill=\"currentColor\" opacity=\".18\"/><rect x=\"11\" y=\"9\" width=\"26\" height=\"34\" rx=\"4\"/><rect x=\"19\" y=\"4\" width=\"10\" height=\"10\" rx=\"2\" fill=\"currentColor\" opacity=\".48\"/><path d=\"M18 23h12M18 29h12M18 35h8\"/>","ready":"<circle cx=\"24\" cy=\"24\" r=\"19\" fill=\"currentColor\" opacity=\".13\"/><circle cx=\"24\" cy=\"24\" r=\"19\"/><path d=\"m14 24 7 7 14-15\" stroke-width=\"5\"/>","hand":"<path d=\"M15 28V15c0-4 6-4 6 0v8-14c0-4 6-4 6 0v14-11c0-4 6-4 6 0v12-6c0-4 6-4 6 0v11c0 12-7 17-18 17-5 0-9-3-12-7L3 30c-2-4 3-7 6-4l6 7z\" fill=\"currentColor\" opacity=\".22\"/><path d=\"M15 28V15c0-4 6-4 6 0v8-14c0-4 6-4 6 0v14-11c0-4 6-4 6 0v12-6c0-4 6-4 6 0v11c0 12-7 17-18 17-5 0-9-3-12-7L3 30c-2-4 3-7 6-4l6 7z\"/>","buzz":"<path d=\"M24 6c-7 0-12 5-12 13v7l-4 7h32l-4-7v-7c0-8-5-13-12-13z\" fill=\"currentColor\" opacity=\".33\"/><path d=\"M24 6c-7 0-12 5-12 13v7l-4 7h32l-4-7v-7c0-8-5-13-12-13zM20 40a4 4 0 0 0 8 0M24 2v4\"/>","help":"<circle cx=\"24\" cy=\"24\" r=\"19\" fill=\"currentColor\" opacity=\".16\"/><circle cx=\"24\" cy=\"24\" r=\"19\"/><circle cx=\"24\" cy=\"24\" r=\"9\"/><path d=\"m10.5 10.5 7 7M30.5 30.5l7 7M37.5 10.5l-7 7M17.5 30.5l-7 7\" stroke-width=\"5\"/>","picture":"<rect x=\"5\" y=\"13\" width=\"38\" height=\"29\" rx=\"6\" fill=\"currentColor\" opacity=\".18\"/><rect x=\"5\" y=\"13\" width=\"38\" height=\"29\" rx=\"6\"/><path d=\"M13 13l4-6h15l4 6\"/><circle cx=\"24\" cy=\"27\" r=\"8\" fill=\"currentColor\" opacity=\".4\"/><circle cx=\"24\" cy=\"27\" r=\"8\"/><path d=\"M38 19h1\"/>","poll":"<rect x=\"6\" y=\"25\" width=\"8\" height=\"16\" rx=\"2\" fill=\"currentColor\" opacity=\".52\"/><rect x=\"20\" y=\"17\" width=\"8\" height=\"24\" rx=\"2\" fill=\"currentColor\" opacity=\".7\"/><rect x=\"34\" y=\"8\" width=\"8\" height=\"33\" rx=\"2\" fill=\"currentColor\" opacity=\".4\"/><path d=\"M4 44h40\" stroke-width=\"2\"/>","end":"<circle cx=\"24\" cy=\"24\" r=\"19\" fill=\"currentColor\" opacity=\".13\"/><path d=\"M24 5v20\" stroke-width=\"5\"/><path d=\"M14 11a18 18 0 1 0 20 0\" stroke-width=\"4.5\"/><path d=\"m18 41 6 3 6-3\" stroke-width=\"1.8\" opacity=\".6\"/>","reset":"<path d=\"M41 21a17 17 0 1 0-3 14\" stroke-width=\"4\"/><path d=\"M40 6v16H24\" stroke-width=\"4\"/><path d=\"M18 23l6 6 9-11\" stroke-width=\"3\" opacity=\".45\"/>"};
const icons=[
 ['[data-control="lobby"]','lobby','NAVIGATE'],
 ['[data-control="activities"]','activities','NAVIGATE'],
 ['[data-control="agenda"]','agenda','NAVIGATE'],
 ['[data-control="ready"]','ready','NAVIGATE'],
 ['[data-toggle="hand"]','hand','TOGGLE'],
 ['[data-toggle="buzz"]','buzz','TOGGLE'],
 ['[data-toggle="help"]','help','TOGGLE'],
 ['[data-toggle="picture"]','picture','TOGGLE']
];
function svg(key){
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round" focusable="false" aria-hidden="true">'+ICONS[key]+'</svg>';
}
function setIcon(button,name){
 if(!button)return;
 const surface=button.querySelector('.ico');
 if(!surface)return;
 surface.className='ico si-v80-icon si-v80-'+name;
 surface.innerHTML=svg(name);
 button.dataset.siV80Action=name;
 button.title=(button.querySelector('.copy b')?.textContent||'').trim()||
   (button.querySelector('b')?.textContent||'').trim();
}
function addTheme(){
 const bar=$('#teacherControlBar .single-mission-controls');
 if(!bar)return;
 icons.forEach(([selector,key])=>setIcon(bar.querySelector(selector),key));
 const poll=document.createElement('button');
 poll.type='button';poll.id='siQuickPollHomeBtn';poll.className='control si-v80-poll-control';
 poll.innerHTML='<span class="ico si-v80-icon si-v80-poll" aria-hidden="true">'+svg('poll')+'</span><span class="copy"><b>Quick Poll</b></span>';
 poll.dataset.siV80Action='poll';
 poll.title='Create or manage a Quick Poll';
 poll.addEventListener('click',()=>{
   if(window.SIQuickPoll?.open)window.SIQuickPoll.open();
   else if(typeof toast==='function')toast('Quick Poll is loading. Please try again.');
 });
 bar.appendChild(poll);
 // The original checks remain available in the source and class logic.
 // They are no longer listed as primary classroom navigation shortcuts.
 for(const selector of ['[data-send="emotion"]','[data-send="understanding"]'])
   bar.querySelector(selector)?.classList.add('si-v80-secondary');
}
function installHeader(){
 const top=$('header.topbar'),actions=top?.querySelector('.top-actions');
 const end=$('#endBtn'),reset=$('#resetBtn'),status=top?.querySelector('.session-pill');
 const classroom=actions?.querySelector('.class-context');
 const code=actions?.querySelector('.class-code');
 if(!top||!actions||!end||!reset||!status||!classroom||!code)return false;
 const information=document.createElement('div');
 information.className='si-v80-information';information.id='siV80Information';
 top.insertBefore(information,actions);
 const statusBox=document.createElement('div');statusBox.className='si-v80-info-status';
 statusBox.appendChild(status);information.appendChild(statusBox);
 // Preserve the class context node for other renderers, but remove it from
 // the visible command header by keeping its wrapper hidden.
 const classBox=document.createElement('div');classBox.className='si-v80-info-class';
 classBox.hidden=true;classBox.setAttribute('aria-hidden','true');
 classBox.appendChild(classroom);information.appendChild(classBox);
 const codeBox=document.createElement('div');codeBox.className='si-v80-info-code';
 codeBox.appendChild(code);information.appendChild(codeBox);
 // Move the same buttons: existing onclick handlers remain bound to these nodes.
 actions.appendChild(end);actions.appendChild(reset);
 end.classList.add('si-v80-end-session');reset.classList.add('si-v80-reset-session');
 end.setAttribute('title','End this classroom session and review its summary');
 reset.setAttribute('title','Start a fresh classroom session (saved libraries stay intact)');
 reset.querySelector('b')?.replaceChildren(document.createTextNode('Reset Session'));
 // Use the same SVG icon artwork and tile structure as the nine home controls,
 // but keep the original action button nodes and their existing handlers.
 setIcon(end,'end');
 const oldResetIcon=reset.querySelector('span');
 if(oldResetIcon){
   oldResetIcon.className='ico si-v80-icon si-v80-reset';
   oldResetIcon.setAttribute('aria-hidden','true');
   oldResetIcon.innerHTML=svg('reset');
 }
 reset.dataset.siV80Action='reset';
 top.classList.add('si-v80-topbar');
 return true;
}

/* v82: Home-matched, large neon glyphs for every Activity Shortcut.
   The source app registry, artwork, saved slots, and click handlers are unchanged.
   The main app re-renders the shortcuts: repaint *only* the image surfaces after
   each re-render. Watch grid direct children to avoid self-triggering mutations. */
const SHORTCUT_GLYPHS={
 "SI+":'<path d="M8 13 36 6l5 31-28 6z" fill="currentColor" opacity=".15"/><path d="M8 13 36 6l5 31-28 6z"/><path d="m15 17 18-4M16 23l11-3"/><path d="m16 32 5-3-2 7 5-4M30 28l5 6-7-1z" fill="currentColor" opacity=".5"/>',
 "STARWHEEL":'<circle cx="24" cy="24" r="20"/><circle cx="24" cy="24" r="6" fill="currentColor" opacity=".5"/><path d="M24 4v14M24 30v14M4 24h14M30 24h14M10 10l10 10m8 8 10 10M38 10 28 20m-8 8L10 38"/><path d="m24 4 5 9-5 5-5-5z" fill="currentColor" opacity=".3"/>',
 "BINGO":'<rect x="7" y="6" width="34" height="36" rx="5" fill="currentColor" opacity=".12"/><rect x="7" y="6" width="34" height="36" rx="5"/><path d="M7 16h34M18 16v26M30 16v26M7 29h34"/><circle cx="13" cy="23" r="2" fill="currentColor"/><path d="m22 35 3 3 4-6" stroke-width="3.5"/>',
 "BOARD":'<rect x="5" y="7" width="38" height="30" rx="4" fill="currentColor" opacity=".15"/><rect x="5" y="7" width="38" height="30" rx="4"/><path d="M24 37v6m-11 0h22M11 15h13m-13 6h8"/><path d="m25 26 11-11 4 4-11 11-6 2z" fill="currentColor" opacity=".35"/>',
 "MATCH":'<rect x="5" y="10" width="18" height="27" rx="4" fill="currentColor" opacity=".18"/><rect x="25" y="10" width="18" height="27" rx="4" fill="currentColor" opacity=".18"/><rect x="5" y="10" width="18" height="27" rx="4"/><rect x="25" y="10" width="18" height="27" rx="4"/><circle cx="14" cy="23" r="5"/><circle cx="34" cy="23" r="5"/><path d="m17 41 7 4 7-4"/>',
 "COSMIC CARDS":'<rect x="7" y="10" width="24" height="32" rx="4" transform="rotate(-12 19 26)" fill="currentColor" opacity=".18"/><rect x="7" y="10" width="24" height="32" rx="4" transform="rotate(-12 19 26)"/><rect x="20" y="7" width="23" height="32" rx="4" transform="rotate(10 31 23)" fill="currentColor" opacity=".18"/><rect x="20" y="7" width="23" height="32" rx="4" transform="rotate(10 31 23)"/><path d="m31 13 2 7 7 2-7 2-2 7-2-7-7-2 7-2z" fill="currentColor" opacity=".5"/>',
 "SKETCH SIGNAL":'<rect x="6" y="7" width="36" height="32" rx="4" fill="currentColor" opacity=".14"/><rect x="6" y="7" width="36" height="32" rx="4"/><path d="M13 31c5-8 9-3 13-13"/><path d="m22 34 13-13 5 5-13 13-7 2z" fill="currentColor" opacity=".36"/><path d="M14 44h21"/>',
 "MINEFIELD":'<rect x="6" y="6" width="36" height="36" rx="5" fill="currentColor" opacity=".13"/><rect x="6" y="6" width="36" height="36" rx="5"/><path d="M18 6v36M30 6v36M6 18h36M6 30h36" opacity=".65"/><path d="m24 14 2.5 6 6 1-4.5 4 1 7-5-3-5 3 1-7-4.5-4 6-1z" fill="currentColor" opacity=".68"/>',
 "SCIENTIFIC CALCULATOR":'<rect x="11" y="4" width="26" height="40" rx="5" fill="currentColor" opacity=".15"/><rect x="11" y="4" width="26" height="40" rx="5"/><rect x="16" y="10" width="16" height="10" rx="1"/><path d="M17 26h3m8 0h3m-14 7h3m8 0h3m-14 7h3m8 0h3"/><path d="m20 14 3 3 5-5" stroke-width="2"/>',
 "CREW SURVEY":'<rect x="6" y="7" width="36" height="33" rx="4" fill="currentColor" opacity=".12"/><rect x="6" y="7" width="36" height="33" rx="4"/><path d="M12 16h24M12 25h24M12 34h24"/><circle cx="16" cy="12" r="3" fill="currentColor"/><path d="m28 19 3 3 4-6" stroke-width="3"/>',
 "DOMINOES":'<rect x="3" y="14" width="42" height="24" rx="6" fill="currentColor" opacity=".15"/><rect x="3" y="14" width="42" height="24" rx="6"/><path d="M24 14v24" stroke-width="2.2"/><circle cx="13" cy="22" r="2.7" fill="currentColor"/><circle cx="13" cy="31" r="2.7" fill="currentColor"/><circle cx="34" cy="20" r="2.7" fill="currentColor"/><circle cx="34" cy="30" r="2.7" fill="currentColor"/>',
 "WORD GRID":'<rect x="6" y="6" width="36" height="36" rx="6" fill="currentColor" opacity=".12"/><rect x="6" y="6" width="36" height="36" rx="6"/><path d="M18 6v36M30 6v36M6 18h36M6 30h36" opacity=".43"/><rect x="19" y="19" width="10" height="10" rx="2" fill="currentColor" opacity=".5"/><path d="m22 23 2 3 3-5" stroke-width="2.6"/>',
 "MILLION":'<path d="m24 4 18 14-7 23H13L6 18z" fill="currentColor" opacity=".13"/><path d="m24 4 18 14-7 23H13L6 18z"/><path d="m17 18 6-5 5 6-4 5 6 7-8 2-7-7z" fill="currentColor" opacity=".35"/><path d="M12 44h24"/>',
 "VECTOR":'<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="7" fill="currentColor" opacity=".25"/><path d="M24 3v12m0 18v12M3 24h12m18 0h12"/><circle cx="24" cy="24" r="2" fill="currentColor"/>',
 "ORBIT":'<ellipse cx="24" cy="24" rx="20" ry="9" transform="rotate(-25 24 24)"/><ellipse cx="24" cy="24" rx="20" ry="9" transform="rotate(55 24 24)"/><circle cx="24" cy="24" r="6" fill="currentColor" opacity=".4"/><circle cx="40" cy="16" r="3" fill="currentColor"/>',
 "PIXEL REVEAL":'<rect x="6" y="6" width="36" height="36" rx="4"/><path d="M18 6v36M30 6v36M6 18h36M6 30h36"/><path d="M19 19h10v10H19z" fill="currentColor" opacity=".6"/><path d="m33 11 3 3-3 3-3-3z" fill="currentColor"/>'
};

/* v90 · Fully illustrated activity controls for apps without approved raster art.
   The same SVG asset works in the Library, saved presets and home shortcuts.
   No game state, click handlers or stored shortcut slots are touched. */
const SI90_SCENES={
 "DOMINOES":{color:"#6eefff",dark:"#0e5883",art:'<g transform="translate(79 14) rotate(-15 40 39)"><rect x="1" y="5" width="65" height="77" rx="11" fill="#031d34" stroke="#a4f5ff" stroke-width="4"/><rect x="7" y="10" width="53" height="66" rx="8" fill="url(#si90DOMINOESglass)"/><path d="M7 43h53" stroke="#d7fcff" stroke-width="3"/><g fill="#f8ffff"><circle cx="21" cy="25" r="6"/><circle cx="45" cy="25" r="6"/><circle cx="21" cy="59" r="6"/><circle cx="45" cy="59" r="6"/></g></g><g transform="translate(127 18) rotate(15 35 40)"><rect x="0" y="0" width="63" height="77" rx="10" fill="#173c62" stroke="#9dffff" stroke-width="4"/><path d="M4 38h55" stroke="#b5faff" stroke-width="3"/><g fill="#8ceeff"><circle cx="18" cy="17" r="6"/><circle cx="44" cy="17" r="6"/><circle cx="31" cy="57" r="6"/></g></g>'},
 "WORD GRID":{color:"#ffd07b",dark:"#805321",art:'<g transform="translate(53 15) rotate(-7 70 44)"><rect x="0" y="0" width="134" height="86" rx="11" fill="#533c2d" stroke="#ffe0a0" stroke-width="4"/><rect x="6" y="6" width="122" height="74" rx="7" fill="#17364c"/><g fill="#f9d28a" stroke="#fff0c9" stroke-width="2"><rect x="12" y="13" width="26" height="26" rx="5"/><rect x="43" y="13" width="26" height="26" rx="5"/><rect x="74" y="13" width="26" height="26" rx="5"/><rect x="105" y="13" width="18" height="26" rx="4"/><rect x="27" y="44" width="26" height="25" rx="5" fill="#9d93ff"/><rect x="58" y="44" width="26" height="25" rx="5"/><rect x="89" y="44" width="26" height="25" rx="5" fill="#8af0ec"/></g><g fill="#243f50" font-size="18" font-family="Arial" font-weight="900"><text x="16" y="33">W</text><text x="47" y="33">O</text><text x="78" y="33">R</text><text x="107" y="33">D</text></g></g>'},
 "MINEFIELD":{color:"#ff94c3",dark:"#95355e",art:'<g transform="translate(72 9) rotate(-8 54 48)"><rect x="0" y="0" width="114" height="96" rx="13" fill="#102844" stroke="#f58caf" stroke-width="4"/><g fill="#1d5274" stroke="#71d7f1" stroke-width="2"><rect x="9" y="9" width="28" height="23" rx="5"/><rect x="43" y="9" width="28" height="23" rx="5"/><rect x="77" y="9" width="28" height="23" rx="5"/><rect x="9" y="38" width="28" height="23" rx="5"/><rect x="43" y="38" width="28" height="23" rx="5" fill="#a72f57" stroke="#ffe2b4"/><rect x="77" y="38" width="28" height="23" rx="5"/><rect x="9" y="67" width="28" height="20" rx="5"/><rect x="43" y="67" width="28" height="20" rx="5"/><rect x="77" y="67" width="28" height="20" rx="5"/></g><g fill="#ffe1aa"><circle cx="57" cy="49" r="7"/><path d="M57 38v22M46 49h22M49 41l16 16M65 41L49 57" stroke="#ffe1aa" stroke-width="3"/></g><path d="m15 21 7 7 12-15" fill="none" stroke="#9bffdd" stroke-width="4"/></g>'},
 "VECTOR":{color:"#80bdff",dark:"#2858a1",art:'<g transform="translate(119 54)"><circle r="45" fill="#0a2b4e" stroke="#74c6ff" stroke-width="4"/><circle r="31" fill="none" stroke="#53d6ff" stroke-width="3" stroke-dasharray="7 7"/><circle r="17" fill="#2c74ac" stroke="#d9f8ff" stroke-width="3"/><path d="M-62 0h42M20 0h42M0-56v36M0 20v36" stroke="#92e8ff" stroke-width="3"/><circle r="5" fill="#fff0ab"/><path d="m-4-39 6-10 4 10M-4 39l6 10 4-10" fill="#b5faff"/></g>'},
 "ORBIT":{color:"#d1a0ff",dark:"#7542a3",art:'<g transform="translate(120 52)"><circle r="34" fill="#a94fe0" stroke="#e8bbff" stroke-width="4"/><path d="M-26-11Q4-23 28-9M-28 10Q0 24 28 13" fill="none" stroke="#ffc8fa" stroke-width="5" opacity=".7"/><ellipse rx="86" ry="25" transform="rotate(-24)" fill="none" stroke="#81e7ff" stroke-width="7"/><ellipse rx="86" ry="25" transform="rotate(-24)" fill="none" stroke="#f7e1ff" stroke-width="2"/><circle cx="67" cy="-38" r="10" fill="#ffc68d" stroke="#fff2c1" stroke-width="2"/><circle cx="-76" cy="24" r="6" fill="#8ae4ff"/><path d="M-82-43l5 11 11 5-11 5-5 11-5-11-11-5 11-5z" fill="#e0faff"/></g>'},
 "MILLION":{color:"#ffd184",dark:"#9e6019",art:'<g transform="translate(70 7)"><path d="M23 90h105l-13-16H35z" fill="#8e5228" stroke="#ffdf90" stroke-width="3"/><path d="M34 73h83l-13-14H48z" fill="#bd7c2c" stroke="#ffe6a7" stroke-width="3"/><path d="M48 58h58l-11-13H59z" fill="#c4923b" stroke="#fff0bf" stroke-width="3"/><path d="m76 3 37 27-14 41H53L39 30z" fill="#795021" stroke="#ffd37c" stroke-width="5"/><path d="m76 10 29 22-10 31H57L47 32z" fill="#cc962b"/><text x="76" y="54" text-anchor="middle" fill="#fff3c5" font-family="Arial" font-size="44" font-weight="900">?</text><path d="M32 6l3 8 9 3-9 3-3 8-3-8-9-3 9-3zM121 16l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff3b1"/></g>'},
 "SPOTLIGHT":{color:"#84f4e9",dark:"#1b7b8c",art:'<g transform="translate(59 13) rotate(-4 72 40)"><rect x="0" y="0" width="142" height="84" rx="9" fill="#0c3554" stroke="#98f5ed" stroke-width="4"/><rect x="8" y="8" width="126" height="68" rx="4" fill="#244e68"/><path d="m10 62 35-36 23 23 19-23 42 36" fill="#66b6c5" stroke="#b4f8fc" stroke-width="2"/><circle cx="104" cy="22" r="9" fill="#ffdf84"/><rect x="8" y="8" width="126" height="68" rx="4" fill="#05192c" opacity=".54"/><circle cx="77" cy="42" r="28" fill="#fff7b4" opacity=".16" stroke="#fff1a6" stroke-width="6"/><circle cx="77" cy="42" r="18" fill="none" stroke="#ffe287" stroke-width="3" stroke-dasharray="7 3"/><path d="M77 4v19M77 62v15M40 42h18M96 42h35" stroke="#ffe99f" stroke-width="3"/></g>'},
 "SCIENTIFIC CALCULATOR":{color:"#caa7ff",dark:"#6944a6",art:'<g transform="translate(87 4) rotate(7 37 49)"><rect x="0" y="0" width="76" height="99" rx="12" fill="#262859" stroke="#c9a9ff" stroke-width="5"/><rect x="8" y="11" width="60" height="23" rx="4" fill="#b8eada" stroke="#ffffff" stroke-width="2"/><text x="61" y="29" text-anchor="end" fill="#183951" font-family="monospace" font-size="17" font-weight="900">7×8</text><g fill="#7666b9" stroke="#eed9ff" stroke-width="1"><rect x="9" y="42" width="15" height="13" rx="3"/><rect x="30" y="42" width="15" height="13" rx="3"/><rect x="51" y="42" width="15" height="13" rx="3"/><rect x="9" y="60" width="15" height="13" rx="3"/><rect x="30" y="60" width="15" height="13" rx="3"/><rect x="51" y="60" width="15" height="13" rx="3"/><rect x="9" y="78" width="15" height="13" rx="3"/><rect x="30" y="78" width="15" height="13" rx="3"/><rect x="51" y="78" width="15" height="13" rx="3" fill="#63baf3"/></g></g><path d="m53 38 4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#d9d0ff" opacity=".8"/>'},
 "AAC+":{color:"#c89eff",dark:"#7551ab",art:'<g transform="translate(56 13) rotate(-5 65 43)"><rect x="0" y="0" width="124" height="88" rx="12" fill="#242c62" stroke="#c9abff" stroke-width="4"/><rect x="9" y="10" width="106" height="68" rx="6" fill="#e2e9fd"/><g stroke="#998fd4" stroke-width="2"><path d="M44 10v68M80 10v68M9 44h106"/></g><g fill="#4a5595"><circle cx="27" cy="25" r="8"/><path d="M19 39q8-12 16 0M59 22l7-5v20l-7-5h-9V22zM93 20h12v15H93zM94 53h12v15H94z"/></g><g fill="#51bca6"><path d="m19 58 7 7 10-15" fill="none" stroke="#51bca6" stroke-width="4"/><circle cx="63" cy="60" r="11"/></g><path d="M124 30q15 12 0 25M131 21q24 21 0 43" fill="none" stroke="#f2d5ff" stroke-width="5" stroke-linecap="round"/></g>'},
 "RANDOMIZER":{color:"#8ceaff",dark:"#2269a6",art:'<g transform="translate(118 55)"><circle r="48" fill="#1c416b" stroke="#9efaff" stroke-width="5"/><path d="M0 0V-43A43 43 0 0 1 38 20Z" fill="#fbb65f"/><path d="M0 0 38 20A43 43 0 0 1-18 39Z" fill="#a47dff"/><path d="M0 0-18 39A43 43 0 0 1-42-10Z" fill="#61d4c8"/><path d="M0 0-42-10A43 43 0 0 1 0-43Z" fill="#ed6c9f"/><path d="M0-45V45M-45 0h90M-31-31l62 62M31-31l-62 62" stroke="#fff5dc" stroke-width="2"/><circle r="12" fill="#ffe5a7" stroke="#ffffff" stroke-width="3"/><circle r="4" fill="#865d29"/><path d="m0-56-10-14h20z" fill="#ffe5a7" stroke="#fff7dc" stroke-width="2"/></g>'},
 "FOUR IN LINE":{color:"#6cf3d2",dark:"#207c85",art:'<g transform="translate(55 9) rotate(-4 70 46)"><rect x="0" y="0" width="142" height="96" rx="11" fill="#16558b" stroke="#9ef7e9" stroke-width="5"/><g fill="#092b48" stroke="#7fd3fc" stroke-width="2"><circle cx="24" cy="19" r="11"/><circle cx="55" cy="19" r="11"/><circle cx="86" cy="19" r="11"/><circle cx="117" cy="19" r="11"/><circle cx="24" cy="48" r="11"/><circle cx="55" cy="48" r="11"/><circle cx="86" cy="48" r="11"/><circle cx="117" cy="48" r="11"/><circle cx="24" cy="77" r="11"/><circle cx="55" cy="77" r="11"/><circle cx="86" cy="77" r="11"/><circle cx="117" cy="77" r="11"/></g><g stroke="#fff6d9" stroke-width="2"><circle cx="24" cy="77" r="9" fill="#f5b74d"/><circle cx="55" cy="77" r="9" fill="#fe7496"/><circle cx="86" cy="77" r="9" fill="#f5b74d"/><circle cx="117" cy="77" r="9" fill="#fe7496"/><circle cx="55" cy="48" r="9" fill="#fe7496"/><circle cx="86" cy="48" r="9" fill="#f5b74d"/><circle cx="86" cy="19" r="9" fill="#f5b74d"/></g></g>'},
 "SIGNAL SEQUENCE":{color:"#8ad7ff",dark:"#3655a4",art:'<g class="si-signal-edge-pulses" fill="none" stroke-linecap="round" stroke-width="4" opacity=".92"><path d="M13 26h35l24 20" stroke="#ff89ac"/><path d="M13 84h35l24-20" stroke="#8effc7"/><path d="M227 26h-35l-24 20" stroke="#83dfff"/><path d="M227 84h-35l-24-20" stroke="#ffe188"/><path d="M19 48h31M19 62h31" stroke="#7ee3fa" stroke-width="2.4"/><path d="M221 48h-31M221 62h-31" stroke="#d1b3ff" stroke-width="2.4"/></g><g transform="translate(120 55) scale(1.10)"><circle r="49" fill="#132b56" stroke="#c4e3ff" stroke-width="5"/><path d="M-3-42A43 43 0 0 0-42-3H-3Z" fill="#ed527a" stroke="#ffb3cb" stroke-width="3"/><path d="M3-42A43 43 0 0 1 42-3H3Z" fill="#46b4ff" stroke="#b8eeff" stroke-width="3"/><path d="M-42 3A43 43 0 0 0-3 42V3Z" fill="#6de6a4" stroke="#b4ffcf" stroke-width="3"/><path d="M42 3A43 43 0 0 1 3 42V3Z" fill="#f8d369" stroke="#fff4b0" stroke-width="3"/><circle r="14" fill="#061f3e" stroke="#a9e5ff" stroke-width="4"/><path d="m0-10 5 7-5 7-5-7z" fill="#e6faff"/></g><g fill="#a2eaff"><circle cx="36" cy="29" r="4"/><circle cx="45" cy="29" r="4"/><circle cx="54" cy="29" r="4"/></g>'}
};
function si90PremiumArt(name){
 if(name==="RANDOMIZER")return '<img class="si-v90-graphic si-randomizer-uploaded-icon" src="/randomizer-art/components/randomizer_app_icon.png?v=3" alt="" loading="lazy" decoding="async">';
 const spec=SI90_SCENES[name];
 if(!spec)return null;
 const id="si90"+name.replace(/[^A-Za-z0-9]/g,"");
 const bg=id+"bg",light=id+"light",glass=id+"glass";
 return '<svg class="si-v90-graphic" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">'+
 '<defs><linearGradient id="'+bg+'" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#174768"/><stop offset=".44" stop-color="'+spec.dark+'"/><stop offset="1" stop-color="#06182c"/></linearGradient>'+
 '<radialGradient id="'+light+'"><stop stop-color="'+spec.color+'" stop-opacity=".53"/><stop offset="1" stop-color="'+spec.color+'" stop-opacity="0"/></radialGradient>'+
 '<linearGradient id="'+glass+'" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#b1f7ff" stop-opacity=".85"/><stop offset=".45" stop-color="#2a91ba" stop-opacity=".85"/><stop offset="1" stop-color="#0e3b65"/></linearGradient></defs>'+
 '<rect width="240" height="110" fill="url(#'+bg+')"/>'+
 '<ellipse cx="120" cy="55" rx="104" ry="65" fill="url(#'+light+')"/>'+
 '<path d="M0 100 54 89H186L240 100M5 17h28M207 17h28M5 92h22M213 92h22" stroke="'+spec.color+'" stroke-width="1.5" opacity=".45" fill="none"/>'+
 '<circle cx="26" cy="35" r="2" fill="#dcf9ff" opacity=".6"/><circle cx="213" cy="70" r="2" fill="#dcf9ff" opacity=".6"/>'+
 '<ellipse cx="120" cy="97" rx="83" ry="10" fill="#010e1f" opacity=".55"/>'+
 spec.art+'<rect x="1.5" y="1.5" width="237" height="107" rx="10" fill="none" stroke="'+spec.color+'" stroke-opacity=".3" stroke-width="2"/></svg>';
}

function installShortcutArtwork(){
 const grid=$('#homeAppGrid');if(!grid)return;
 const renderIcons=()=>{
   for(const tile of grid.querySelectorAll('.app-shortcut:not(.empty)')){
     const slot=tile.querySelector('.app-shortcut-icon');
     const name=tile.querySelector('.app-shortcut-label')?.textContent?.trim()?.toUpperCase();
     if(!slot||!name||(!SHORTCUT_GLYPHS[name]&&!SI90_SCENES[name])||slot.dataset.siV82Art===name)continue;
     const premium=si90PremiumArt(name);
     slot.innerHTML=premium||svgShortcut(name);
     if(premium)tile.classList.add('si-v90-illustrated-shortcut');
     slot.dataset.siV82Art=name;
     tile.classList.add('si-v82-vector-shortcut');
   }
 };
 function svgShortcut(name){
   return '<svg class="si-v82-activity-glyph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round" focusable="false" aria-hidden="true">'+SHORTCUT_GLYPHS[name]+'</svg>';
 }
 renderIcons();
 new MutationObserver(renderIcons).observe(grid,{childList:true});
}



/* v86 Activity Library — share the Mission Control icon language without
   replacing existing cards or touching their click handlers and data. */
function installLibraryArtwork(){
 const root=$('#activitiesPanel'),grid=$('#activityGrid'),favorites=$('#favoriteGrid');
 if(!root||!grid||!favorites)return;
 const colors={
  "SI+":"cyan","COSMIC CARDS":"green","MINEFIELD":"pink",
  "VECTOR":"blue","BOARD":"blue","SKETCH SIGNAL":"cyan",
  "ORBIT":"purple","PIXEL REVEAL":"pink","STARWHEEL":"amber",
  "CREW SURVEY":"purple","MILLION":"amber","MATCH":"purple",
  "BINGO":"cyan","WORD GRID":"amber","DOMINOES":"cyan","SCIENTIFIC CALCULATOR":"purple",
  "MINEFIELD":"pink","VECTOR":"blue","ORBIT":"purple","MILLION":"amber",
  "SPOTLIGHT":"green","AAC+":"purple","RANDOMIZER":"cyan",
  "FOUR IN LINE":"green","SIGNAL SEQUENCE":"blue"
 };
 const aliases={
  "PRESENTATION":"SI+","SI+ INTERACTIVE PRESENTATION":"SI+",
  "SKETCH":"SKETCH SIGNAL","PIXEL":"PIXEL REVEAL",
  "CREW SURVEY GAME":"CREW SURVEY","SCIENTIFIC":"SCIENTIFIC CALCULATOR",
  "INTERACTIVE PRESENTATION":"SI+"
 };
 function normalized(value){
   const n=String(value||"").replace(/\s*·.*$/,"").trim().toUpperCase();
   return aliases[n]||n;
 }
 function appGlyph(name){
   const glyph=SHORTCUT_GLYPHS[name];
   return glyph?'<svg class="si-v86-library-glyph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">'+glyph+'</svg>':null;
 }
 function paintCard(card,iconSelector,name,scheme){
   const icon=card.querySelector(iconSelector);
   const key=normalized(name);
   const svg=appGlyph(key),premium=si90PremiumArt(key);
   if(!icon||(!svg&&!premium)||icon.dataset.siV86Name===key)return;
   icon.innerHTML=premium||svg;
   if(premium)icon.classList.add("si-v90-graphic-ready");
   icon.classList.toggle("si-signal-sequence-thumbnail",key==="SIGNAL SEQUENCE");
   icon.dataset.siV86Name=key;
   card.dataset.siV86Accent=colors[key]||scheme||"cyan";
   card.classList.add("si-v86-icon-ready");
   // Add approved cinematic game illustration without replacing the card or its actions.
   // Load failure preserves the original vector artwork and remains non-disruptive.
   const artName={
     "SI+":"si_plus","STARWHEEL":"star_wheel","BINGO":"bingo",
     "BOARD":"board","CREW SURVEY":"crew_survey",
     "COSMIC CARDS":"cosmic_cards","SKETCH SIGNAL":"signal",
     "MATCH":"match","PIXEL REVEAL":"pixel_reveal"
   }[key];
   if(artName){
     const photo=new Image();
     photo.alt="";photo.decoding="async";photo.className="si-v88-library-photo";
     photo.onload=()=>{
       if(!icon.isConnected||icon.dataset.siV86Name!==key)return;
       icon.appendChild(photo);icon.classList.add("si-v88-library-photo-ready");
     };
     photo.onerror=()=>{}; // the SVG remains visible
     photo.src="/dashboard-art/activity_icons/"+artName+".png";
   }
 }
 const render=()=>{
   // The class is limited to the browsing view so SI+ editors and games
   // retain their own established presentation behavior.
   const browsing=!!grid.querySelector(".activity-library-toolbar");
   root.classList.toggle("si-v86-library",browsing);
   if(!browsing&&!root.classList.contains('shortcut-manager-view'))return;
   for(const card of grid.querySelectorAll(".activity-catalog-grid .real-app-card")){
     paintCard(card,'.act-icon',card.querySelector('h3')?.textContent);
   }
   for(const card of grid.querySelectorAll(".preset-recent-card")){
     paintCard(card,'.recent-app-icon',card.querySelector('.recent-card-top small')?.textContent);
   }
   for(const card of grid.querySelectorAll(".preset-card")){
     paintCard(card,'.preset-card-icon',card.querySelector('.preset-app')?.textContent);
   }
   for(const card of favorites.querySelectorAll('.shortcut-manage-card:not(.empty)')){
     paintCard(card,'.shortcut-manage-icon',card.querySelector('.shortcut-manage-copy b')?.textContent);
   }
 };
 let scheduled=false;
 const schedule=()=>{
   if(scheduled)return;
   scheduled=true;
   requestAnimationFrame(()=>{scheduled=false;render()});
 };
 render();
 new MutationObserver(schedule).observe(grid,{childList:true});
 new MutationObserver(schedule).observe(favorites,{childList:true});
}

/* v85: Put alert panels into one actual grid item, not four independently
   positioned grid cells. Existing elements, IDs, events and their state stay
   intact. This structural container makes the alert rail a single flowing
   column that cannot overlap the Home Row or Activity Shortcuts. */
function installAlertStack(){
 const rail=$('#teacher .right-rail');
 if(!rail)return;
 const ids=['attentionSummary','buzzPanel','photoInboxPanel','helpInboxPanel'];
 const panels=ids.map(id=>document.getElementById(id));
 if(panels.some(node=>!node))return;
 let stack=document.getElementById('siV85AlertStack');
 if(!stack){
   stack=document.createElement('div');
   stack.id='siV85AlertStack';
   stack.className='si-v85-alert-stack';
   const dock=rail.querySelector('.screen-dock');
   if(dock)rail.insertBefore(stack,dock);
   else rail.appendChild(stack);
 }
 panels.forEach(panel=>stack.appendChild(panel));
}

function tunePanels(){
 const header=$('#teacher #appShortcutsPanel .app-shortcuts-head');
 const label=header?.querySelector('.hint');
 if(label)label.textContent='Quick access to your favorite activities';
 const last=header?.querySelectorAll('.hint')[1];
 if(last){
   last.textContent='';
   const button=document.createElement('button');button.type='button';button.className='si-v80-manage';
   button.textContent='⚙ Manage Activities';
   button.title='Edit your activity shortcuts';
   button.onclick=()=>$('#teacherControlBar [data-control="activities"]')?.click();
   last.appendChild(button);
 }
 const attention=$('#attentionSummary');
 if(attention){
   const caption=attention.querySelector('.attention-summary-copy .v564-panel-label span:last-child');
   if(caption)caption.textContent='CLASS ALERTS';
 }
 // Keep all dynamically rendered roster, inbox and queue nodes untouched.
}
/* Approved image assets: display only after browser confirms each file loaded.
   Never hide SVG/native fallbacks when the image is missing or unsupported. */
function installApprovedArtwork(){
 const root='/dashboard-art/';
 const nav={lobby:'lobby',activities:'activities',agenda:'agenda',ready:'ready_check',hand:'raise_hand',buzz:'buzz',help:'ask_for_help',picture:'picture_prompt',poll:'quick_poll'};
 const activity={'SI+':'si_plus','STARWHEEL':'star_wheel','BINGO':'bingo','BOARD':'board','CREW SURVEY':'crew_survey','COSMIC CARDS':'cosmic_cards','SKETCH SIGNAL':'signal','MATCH':'match','PIXEL REVEAL':'pixel_reveal'};
 function apply(surface,folder,filename){
  if(!surface||surface.dataset.siApprovedArt===filename)return;
  if(surface.dataset.siApprovedArtPending===filename)return;
  surface.dataset.siApprovedArtPending=filename;
  const img=new Image();img.alt='';img.decoding='async';img.className='si-approved-dashboard-art';
  img.onload=()=>{
   // Ignore stale loads after the classroom rerenders a shortcut tile.
   if(!surface.isConnected||surface.dataset.siApprovedArtPending!==filename)return;
   surface.querySelectorAll('img.si-approved-dashboard-art').forEach(old=>old.remove());
   surface.appendChild(img);surface.dataset.siApprovedArt=filename;
   surface.classList.add('si-approved-art-loaded');
  };
  img.onerror=()=>{if(surface.dataset.siApprovedArtPending===filename)delete surface.dataset.siApprovedArtPending;};
  img.src=root+folder+'/'+filename+'.png';
 }
 function render(){
  for(const [action,file] of Object.entries(nav)){
   apply(document.querySelector('#teacher #teacherControlBar [data-si-v80-action="'+action+'"] .ico.si-v80-icon'),'navigation_icons',file);
  }
  for(const tile of document.querySelectorAll('#teacher #homeAppGrid .app-shortcut:not(.empty)')){
   const label=tile.querySelector('.app-shortcut-label')?.textContent?.trim().toUpperCase();
   const file=activity[label];if(!file)continue;
   apply(tile.querySelector('.app-shortcut-icon'),'activity_icons',file);
  }
 }
 render();
 const grid=document.getElementById('homeAppGrid');
 if(grid){let scheduled=false;new MutationObserver(()=>{
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;render()});
 }).observe(grid,{childList:true});}
}

/* Classroom Tools bridge: register AAC+ and Randomizer as normal Activities.
   Existing nine shortcuts, saved layout, lobby and running games are untouched. */
function installClassroomTools(){
 if(window.__siV80ClassroomTools)return;
 if(typeof APP_REGISTRY==='undefined'||typeof openApp!=='function'||typeof renderActivities!=='function')return;
 const tools=[
  {id:'aac-plus',name:'AAC+',icon:'◈',subtitle:'Communication Boards · Voices · Classroom Access',status:'CLASSROOM TOOL',
   description:'Build and present AAC communication boards with custom vocabulary and speech. Opens the separate AAC+ Studio.'},
  {id:'randomizer',name:'RANDOMIZER',icon:'◉',subtitle:'Spin Wheel · Slots · Lottery · Mystery Cards',status:'CLASSROOM TOOL',
   description:'Randomly choose student ideas, names or activities with optional weighted odds, saved sets and a Zoom-friendly display.'}
 ];
 for(const app of tools){
  if(!APP_REGISTRY.some(item=>item.id===app.id))APP_REGISTRY.push(app);
 }
 const originalOpen=openApp;
 // AAC+ is a true floating, reusable teacher studio: the command deck stays
 // open, and launching AAC+ again focuses the same resizable browser window.
 function openAACStudio(){
  const screenLeft=Number.isFinite(screen.availLeft)?screen.availLeft:0;
  const screenTop=Number.isFinite(screen.availTop)?screen.availTop:0;
  const availableWidth=Math.max(500,screen.availWidth||window.innerWidth||1200);
  const availableHeight=Math.max(500,screen.availHeight||window.innerHeight||850);
  const width=Math.min(1120,Math.max(600,availableWidth-100));
  const height=Math.min(830,Math.max(530,availableHeight-90));
  const left=Math.max(screenLeft,Math.round(screenLeft+(availableWidth-width)/2));
  const top=Math.max(screenTop,Math.round(screenTop+(availableHeight-height)/2));
  const features=['popup=yes','resizable=yes','scrollbars=yes','toolbar=no','menubar=no',
   'location=no','status=no','width='+Math.round(width),'height='+Math.round(height),
   'left='+left,'top='+top].join(',');
  const popup=window.open('/aac','siMothershipAACPlusStudio',features);
  if(popup){try{popup.opener=null;popup.focus()}catch(e){};return}
  if(typeof toast==='function')toast('Allow pop-ups for Mothership to open the floating AAC+ Studio.');
 }
 openApp=function(id){
  if(id==='aac-plus'){openAACStudio();return}
  if(id==='randomizer'){
   const popup=window.open('/randomizer','_blank');
   if(popup)popup.opener=null;
   else if(typeof toast==='function')toast('Allow pop-ups to open Randomizer.');
   return;
  }
  return originalOpen.apply(this,arguments);
 };
 // Native artwork matches the other activity cards and 3×3 home shortcuts.
 const originalIcon=appIconMarkup;
 appIconMarkup=function(id){
  const key=String(id||'').toLowerCase();
  const common='viewBox="0 0 64 64" aria-hidden="true" focusable="false"';
  if(key==='randomizer')return '<svg '+common+'><circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="32" r="6" fill="currentColor"/><path d="M32 8v18M32 38v18M8 32h18M38 32h18M15 15l12 12M37 37l12 12M49 15L37 27M27 37L15 49" stroke="currentColor" stroke-width="2.4"/><path d="m32 2 7 11H25z" fill="currentColor"/></svg>';
  if(key==='aac-plus')return '<svg '+common+'><rect x="6" y="8" width="38" height="48" rx="7" fill="none" stroke="currentColor" stroke-width="3"/><path d="M6 24h38M6 40h38M25 8v48" stroke="currentColor" stroke-width="2" opacity=".75"/><path d="M49 23c5 4 5 14 0 18M54 17c9 8 9 22 0 30" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  return originalIcon.apply(this,arguments);
 };
 window.__siV80ClassroomTools=true;
 if(typeof state!=='undefined'&&state.screen==='activities'&&!state.activeApp)renderActivities();
}
function init(){
 if(document.body.classList.contains('role-student')||document.body.classList.contains('role-shared'))return;
 if(!$('#teacherControlBar')||!$('#endBtn')||!$('#resetBtn'))return;
 if(!installHeader())return;
 addTheme();tunePanels();installShortcutArtwork();installLibraryArtwork();installApprovedArtwork();
 document.body.classList.add('si-v80-dashboard');
 installAlertStack();installClassroomTools();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
