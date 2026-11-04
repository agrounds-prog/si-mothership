(function(){
function init(){
 const form=document.getElementById('teacherLoginForm'), input=document.getElementById('teacherLoginKey');
 if(!form||!input||form.querySelector('.si-pin-pad'))return;
 form.classList.add('si-pin-mode');
 input.setAttribute('readonly','');input.setAttribute('aria-label','Four digit teacher access PIN');
 const pad=document.createElement('div');pad.className='si-pin-pad';
 const title=document.createElement('div');title.className='si-pin-title';title.textContent='ENTER ACCESS CODE';pad.append(title);
 const dots=document.createElement('div');dots.className='si-pin-dots';dots.setAttribute('aria-label','PIN entry progress');
 for(let i=0;i<4;i++){const dot=document.createElement('span');dot.className='si-pin-dot';dots.append(dot)}pad.append(dots);
 const grid=document.createElement('div');grid.className='si-pin-grid';
 function sync(){[...dots.children].forEach((dot,i)=>dot.classList.toggle('filled',i<input.value.length))}
 function addDigit(d){if(input.value.length>=4)return;input.value+=d;sync()}
 function erase(){input.value=input.value.slice(0,-1);sync()}
 for(const val of ['1','2','3','4','5','6','7','8','9','Clear','0','⌫']){
  const b=document.createElement('button');b.type='button';b.className='si-pin-key';b.textContent=val;b.setAttribute('aria-label',val==='⌫'?'Delete last digit':val);
  b.addEventListener('click',()=>{if(val==='Clear'){input.value='';sync()}else if(val==='⌫')erase();else addDigit(val)});grid.append(b);
 }pad.append(grid);
 const enter=document.createElement('button');enter.type='submit';enter.className='si-pin-launch';enter.textContent='LAUNCH COMMAND DECK';pad.append(enter);
 form.append(pad);
 // Move the existing real checkbox and error message AFTER the keypad,
 // rather than relying on visual CSS ordering of the legacy form.
 const remember=form.querySelector('.teacher-login-remember');
 const error=form.querySelector('.teacher-login-error');
 if(remember)form.append(remember);
 if(error)form.append(error);
 sync();
 document.addEventListener('keydown',e=>{
  const overlay=document.getElementById('teacherLoginOverlay');if(!overlay||overlay.classList.contains('hidden'))return;
  if(e.altKey||e.ctrlKey||e.metaKey||e.target?.closest?.('.si-pin-key'))return;
  if(/^[0-9]$/.test(e.key)){e.preventDefault();addDigit(e.key)}
  else if(e.key==='Backspace'){e.preventDefault();erase()}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();