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
 "WORD GRID":'<rect x="6" y="6" width="36" height="36" rx="6" fill="currentColor" opacity=".12"/><rect x="6" y="6" width="36" height="36" rx="6"/><path d="M18 6v36M30 6v36M6 18h36M6 30h36" opacity=".43"/><rect x="19" y="19" width="10" height="10" rx="2" fill="currentColor" opacity=".5"/><path d="m22 23 2 3 3-5" stroke-width="2.6"/>',
 "MILLION":'<path d="m24 4 18 14-7 23H13L6 18z" fill="currentColor" opacity=".13"/><path d="m24 4 18 14-7 23H13L6 18z"/><path d="m17 18 6-5 5 6-4 5 6 7-8 2-7-7z" fill="currentColor" opacity=".35"/><path d="M12 44h24"/>',
 "VECTOR":'<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="7" fill="currentColor" opacity=".25"/><path d="M24 3v12m0 18v12M3 24h12m18 0h12"/><circle cx="24" cy="24" r="2" fill="currentColor"/>',
 "ORBIT":'<ellipse cx="24" cy="24" rx="20" ry="9" transform="rotate(-25 24 24)"/><ellipse cx="24" cy="24" rx="20" ry="9" transform="rotate(55 24 24)"/><circle cx="24" cy="24" r="6" fill="currentColor" opacity=".4"/><circle cx="40" cy="16" r="3" fill="currentColor"/>',
 "PIXEL REVEAL":'<rect x="6" y="6" width="36" height="36" rx="4"/><path d="M18 6v36M30 6v36M6 18h36M6 30h36"/><path d="M19 19h10v10H19z" fill="currentColor" opacity=".6"/><path d="m33 11 3 3-3 3-3-3z" fill="currentColor"/>'
};
function installShortcutArtwork(){
 const grid=$('#homeAppGrid');if(!grid)return;
 const renderIcons=()=>{
   for(const tile of grid.querySelectorAll('.app-shortcut:not(.empty)')){
     const slot=tile.querySelector('.app-shortcut-icon');
     const name=tile.querySelector('.app-shortcut-label')?.textContent?.trim()?.toUpperCase();
     if(!slot||!name||!SHORTCUT_GLYPHS[name]||slot.dataset.siV82Art===name)continue;
     slot.innerHTML=svgShortcut(name);
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
  "BINGO":"cyan","WORD GRID":"amber","SCIENTIFIC CALCULATOR":"purple"
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
   const svg=appGlyph(key);
   if(!icon||!svg||icon.dataset.siV86Name===key)return;
   icon.innerHTML=svg;
   icon.dataset.siV86Name=key;
   card.dataset.siV86Accent=colors[key]||scheme||"cyan";
   card.classList.add("si-v86-icon-ready");
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
function init(){
 if(document.body.classList.contains('role-student')||document.body.classList.contains('role-shared'))return;
 if(!$('#teacherControlBar')||!$('#endBtn')||!$('#resetBtn'))return;
 if(!installHeader())return;
 addTheme();tunePanels();installShortcutArtwork();installLibraryArtwork();
 document.body.classList.add('si-v80-dashboard');
 installAlertStack();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
