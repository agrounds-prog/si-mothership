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
 addTheme();tunePanels();
 document.body.classList.add('si-v80-dashboard');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
