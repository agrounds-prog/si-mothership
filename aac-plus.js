(()=>{"use strict";
const teacher=document.body.classList.contains("aac-teacher");
const $=id=>document.getElementById(id);
const layouts={"2x3":[2,3],"3x3":[3,3],"4x4":[4,4]};
const blank=()=>({label:"",symbol:"",color:"#075aa0",image:null,audio:null});
let boards=[],editing=null,selected=0,activeAudio=null,audioNode=null,recording=null,shareInfo=null;
let toastTimeout;
function notify(message){let el=$("aacToast");if(!el){el=$("studentHint");if(el)el.textContent=message;return}el.textContent=message;el.classList.add("show");clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove("show"),4200)}
function err(e){const msg=e.message||"Unexpected error";notify(msg);console.error("AAC+",e)}
async function api(path,method="GET",data){const r=await fetch(path,{method,credentials:"same-origin",headers:data?{"Content-Type":"application/json"}:{},body:data?JSON.stringify(data):undefined,cache:"no-store"});if(!r.ok){let t=await r.text();throw Error(r.status===401?"Teacher sign-in required":t.slice(0,170)||"Request failed")}return r.json()}
function clean(s){return String(s||"").trim()}
function media(kind,key,token){return key?"/api/aac/media/"+kind+"/"+key+(token?"?token="+encodeURIComponent(token):""):""}
function sizeOf(layout){let [rows,cols]=layouts[layout]||layouts["3x3"];return rows*cols}
function makeTile(t,i,editable,token){const b=document.createElement("button");b.type="button";b.className="aac-tile"+(editable&&i===selected?" aac-selected":"");b.style.setProperty("--tile-color",t.color||"#075aa0");
let sym=document.createElement("span");sym.className="aac-symbol";if(t.image){let img=document.createElement("img");img.src=media("image",t.image,token);img.alt="";sym.append(img)}else sym.textContent=t.symbol||"＋";
let label=document.createElement("span");label.className="aac-tile-label";label.textContent=t.label||(!t.image&&!t.symbol&&editable?"Add content":"");
b.append(sym,label);
let filled=!!(t.label||t.symbol||t.image||t.audio);
if(!filled)b.classList.add("aac-blank");
if(!editable&&!filled)b.disabled=true;
b.setAttribute("aria-label",editable?"Edit tile "+(i+1)+(t.label?": "+t.label:""):t.label||"Communication button "+(i+1));
if(editable)b.onclick=()=>{syncSelected();selected=i;renderTeacherGrid();readSelected()};
else b.onclick=()=>playTile(t,token,b);
return b}
function renderGrid(target,tiles,layout,editable,token){target.style.setProperty("--cols",layouts[layout][1]);target.replaceChildren(...tiles.map((t,i)=>makeTile(t,i,editable,token)))}
function stopSound(){if(activeAudio){activeAudio.pause();activeAudio.src="";activeAudio=null}if("speechSynthesis" in window)window.speechSynthesis.cancel();if(audioNode){audioNode.classList.remove("aac-playing");audioNode=null}}
function playTile(t,token,element){stopSound();if(!t.audio&&!t.label)return;if(element){audioNode=element;element.classList.add("aac-playing")}if(t.audio){let audio=new Audio(media("audio",t.audio,token));activeAudio=audio;audio.onended=()=>stopSound();audio.onerror=()=>{stopSound();notify("Audio could not play. Check device volume or connection.")};audio.play().catch(()=>{stopSound();notify("Touch the picture again to allow audio.")})}else if(t.label&&"speechSynthesis" in window){const utterance=new SpeechSynthesisUtterance(t.label);utterance.onend=()=>{if(audioNode)audioNode.classList.remove("aac-playing");audioNode=null};window.speechSynthesis.speak(utterance)}}
function show(name){for(let n of ["library","editor","share"]){const e=$(n+"Screen");e.hidden=(name!==n)}}
async function loadLibrary(){const data=await api("/api/aac/boards");boards=data.boards;displayLibrary()}
function displayLibrary(){let query=clean($("boardSearch").value).toLowerCase();let filtered=boards.filter(b=>b.title.toLowerCase().includes(query));$("boardCount").textContent=boards.length+" saved";let grid=$("boardList");grid.replaceChildren();if(!filtered.length){let e=document.createElement("div");e.className="aac-empty";e.textContent=boards.length?"No soundboards match this search.":"No soundboards yet. Select Create Board to start.";grid.append(e);return}
for(let board of filtered){const card=document.createElement("article");card.className="aac-board-card";const th=document.createElement("div");th.className="aac-board-thumbnail";th.style.gridTemplateColumns="repeat("+layouts[board.layout][1]+",1fr)";for(let i=0;i<sizeOf(board.layout);i++){let d=document.createElement("div");d.textContent="✦";th.append(d)}const h=document.createElement("h2");h.textContent=board.title;const sub=document.createElement("small");sub.textContent=board.layout.replace("x"," × ")+" • "+(board.shared?"Shared":"Private");const actions=document.createElement("div");actions.className="aac-board-actions";for(let [text,fn,cl] of [["Edit",()=>editBoard(board.id),"aac-primary"],["Share",()=>shareBoard(board.id),""]] ){let b=document.createElement("button");b.textContent=text;b.className=cl;b.onclick=()=>fn().catch(err);actions.append(b)}
for(let [text,fn] of [["Duplicate",()=>duplicateBoard(board.id)],["Delete",()=>deleteBoard(board.id)]]){let b=document.createElement("button");b.textContent=text;b.onclick=()=>fn().catch(err);actions.append(b)}
card.append(th,h,sub,actions);grid.append(card)}}
function newBoard(){editing={id:null,title:"",layout:"3x3",tiles:Array.from({length:9},blank)};selected=0;openEditor()}
async function editBoard(id){editing=await api("/api/aac/boards/"+id);selected=0;openEditor()}
function openEditor(){show("editor");$("editorHeading").textContent=editing.id?"Edit Soundboard":"New Soundboard";$("boardTitle").value=editing.title;$("boardLayout").value=editing.layout;renderTeacherGrid();readSelected()}
function renderTeacherGrid(){renderGrid($("teacherTiles"),editing.tiles,editing.layout,true,"")}
function syncSelected(){if(!editing)return;const t=editing.tiles[selected];t.label=$("tileLabel").value.trim().slice(0,70);t.symbol=$("tileSymbol").value.trim().slice(0,4);t.color=$("tileColor").value}
function readSelected(){const t=editing.tiles[selected];$("currentTileNumber").textContent=selected+1;$("tileLabel").value=t.label;$("tileSymbol").value=t.symbol;$("tileColor").value=t.color;$("recordTimer").textContent=t.audio?"✓ Audio attached • max 30 seconds":"00:00 / 00:30";$("previewAudio").disabled=!t.audio;$("deleteAudio").disabled=!t.audio;renderTeacherGrid()}
async function saveBoard(){syncSelected();editing.title=clean($("boardTitle").value)||"Untitled Board";const data={title:editing.title,layout:editing.layout,tiles:editing.tiles};const path=editing.id?"/api/aac/boards/"+editing.id:"/api/aac/boards";const res=await api(path,editing.id?"PUT":"POST",data);if(!editing.id)editing.id=res.id;notify("Soundboard saved");show("library");await loadLibrary()}
function changeLayout(next){syncSelected();const previous=editing.layout;const cnt=sizeOf(next);if(editing.tiles.length>cnt&&editing.tiles.slice(cnt).some(t=>t.label||t.symbol||t.image||t.audio)){if(!confirm("The smaller layout would remove filled positions. Continue and remove those cells?")){$("boardLayout").value=previous;return}}editing.tiles=Array.from({length:cnt},(_,i)=>editing.tiles[i]||blank());editing.layout=next;selected=Math.min(selected,cnt-1);renderTeacherGrid();readSelected()}
function swap(direction){syncSelected();const next=selected+direction;if(next<0||next>=editing.tiles.length)return;[editing.tiles[selected],editing.tiles[next]]=[editing.tiles[next],editing.tiles[selected]];selected=next;readSelected()}
async function readFile(f){return await new Promise((resolve,reject)=>{let reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error("Couldn't read file"));reader.readAsDataURL(f)})}
async function uploadImage(file){if(!file)return;const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext("2d");ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const data=canvas.toDataURL("image/png");const result=await api("/api/aac/media","POST",{kind:"image",data});editing.tiles[selected].image=result.id;notify("Picture attached");readSelected()}finally{bitmap.close()}}
async function uploadAudio(file){
 if(!file)return;
 if(file.size>12e6)throw Error("Audio source file exceeds the upload limit");
 // Normalize browser-decodable WAV/MP3/M4A/WebM to standard mono WAV.
 // This gives the server a trustworthy duration instead of client metadata.
 const AC=window.AudioContext||window.webkitAudioContext;
 if(!AC)throw Error("This browser cannot decode audio files");
 let ctx=new AC();
 try{
  const buffer=await ctx.decodeAudioData(await file.arrayBuffer());
  if(!buffer.duration||buffer.duration>30.01)throw Error("Audio must be 30 seconds or less");
  const rate=Math.min(48000,Math.round(buffer.sampleRate)),frames=Math.round(buffer.duration*rate);
  const mono=new Float32Array(frames);
  const chans=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  for(let i=0;i<frames;i++){
    const index=Math.min(buffer.length-1,Math.round(i*buffer.sampleRate/rate));
    let sum=0;for(let ch of chans)sum+=ch[index];
    mono[i]=sum/chans.length;
  }
  const wav=wavBlob([mono],mono.length,rate);
  const data=await readFile(wav);
  const tileIndex=selected;
  const result=await api("/api/aac/media","POST",{kind:"audio",data});
  editing.tiles[tileIndex].audio=result.id;
  readSelected();notify("Audio attached (duration validated)");
 }catch(e){
  if(e.message?.includes("30 seconds"))throw e;
  throw Error("Could not decode this audio file. Try WAV or MP3 in a supported browser.");
 }finally{await ctx.close()}
}
async function duplicateBoard(id){const res=await api("/api/aac/boards/"+id+"/duplicate","POST");notify("Board duplicated");await loadLibrary();return res.id}
async function deleteBoard(id){if(!confirm("Delete this board and revoke its shared link?"))return;await api("/api/aac/boards/"+id,"DELETE");await loadLibrary();notify("Board deleted")}
async function shareBoard(id){let b=boards.find(b=>b.id===id);if(!confirm("Create a new share link for "+(b?.title||"this board")+"? Any previous link will stop working."))return;let res=await api("/api/aac/boards/"+id+"/share","POST");shareInfo={...res,id};$("shareBoardName").textContent=b?.title||"Soundboard";$("shareQr").src=res.qr;$("shareLink").value=res.url;show("share")}
async function revokeShare(){if(!shareInfo)return;if(!confirm("Revoke this board link? Anyone currently using it will lose access after reload."))return;await api("/api/aac/boards/"+shareInfo.id+"/revoke","POST");shareInfo=null;show("library");await loadLibrary();notify("Link revoked")}
function preview(){syncSelected();const wrap=document.createElement("div");wrap.style.cssText="position:fixed;inset:0;z-index:100;background:#030d20f5;overflow:auto;padding:15px;display:grid;place-items:center";const card=document.createElement("div");card.className="aac-card";card.style.cssText="width:min(900px,100%);max-height:96vh;overflow:auto";const hd=document.createElement("div");hd.className="aac-titlebar";const h=document.createElement("h2");h.textContent=clean($("boardTitle").value)||"Student Preview";const close=document.createElement("button");close.textContent="✕ Close Preview";close.onclick=()=>{stopSound();wrap.remove()};hd.append(h,close);const grid=document.createElement("div");grid.className="aac-grid aac-student-grid";renderGrid(grid,editing.tiles,editing.layout,false,"");card.append(hd,grid);wrap.append(card);document.body.append(wrap)}
// WAV recording: browser microphone PCM is encoded to mono 16-bit WAV so the server
// can independently validate the duration and never trust media metadata alone.
async function recordStart(){if(recording)return;let stream,ctx;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});const AC=window.AudioContext||window.webkitAudioContext;ctx=new AC();const src=ctx.createMediaStreamSource(stream);const proc=ctx.createScriptProcessor(4096,1,1);let chunks=[],frames=0;const gain=ctx.createGain();gain.gain.value=0;src.connect(proc);proc.connect(gain);gain.connect(ctx.destination);proc.onaudioprocess=e=>{let chan=e.inputBuffer.getChannelData(0);chunks.push(new Float32Array(chan));frames+=chan.length};const t=Date.now();$("recordAudio").disabled=true;$("stopRecording").disabled=false;const timer=setInterval(()=>{let sec=Math.min(30,Math.floor((Date.now()-t)/1000));$("recordTimer").textContent="00:"+String(sec).padStart(2,"0")+" / 00:30";if(Date.now()-t>=30000)recordStop().catch(err)},200);recording={stream,ctx,src,proc,gain,chunks,framesRef:()=>frames,timer,slot:selected};
notify("Microphone recording started");}catch(e){stream?.getTracks().forEach(x=>x.stop());ctx?.close();throw Error("Microphone unavailable or permission denied: "+(e.message||""))}}
function wavBlob(chunks,frames,rate){const wav=new ArrayBuffer(44+frames*2);const view=new DataView(wav);function put(off,val){for(let i=0;i<val.length;i++)view.setUint8(off+i,val.charCodeAt(i))}put(0,"RIFF");view.setUint32(4,36+frames*2,true);put(8,"WAVEfmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);put(36,"data");view.setUint32(40,frames*2,true);let at=44;for(let chunk of chunks)for(let sample of chunk){sample=Math.max(-1,Math.min(1,sample));view.setInt16(at,sample<0?sample*32768:sample*32767,true);at+=2}return new Blob([wav],{type:"audio/wav"})}
async function recordStop(){if(!recording)return;const rec=recording;recording=null;clearInterval(rec.timer);rec.proc.disconnect();rec.src.disconnect();rec.gain.disconnect();rec.stream.getTracks().forEach(x=>x.stop());$("stopRecording").disabled=true;$("recordAudio").disabled=false;const frames=rec.framesRef();const rate=rec.ctx.sampleRate;await rec.ctx.close();if(frames<rate*.2){notify("Recording was too short");return}const file=wavBlob(rec.chunks,frames,rate);const data=await readFile(file);const result=await api("/api/aac/media","POST",{kind:"audio",data});editing.tiles[rec.slot].audio=result.id;readSelected();notify("Recorded audio saved to button")}
async function initTeacher(){try{await loadLibrary()}catch(e){err(e);if(e.message.includes("sign-in"))$("boardList").textContent="Teacher sign-in required. Return to Command Deck, unlock it, then open AAC+ again."}
$("newBoard").onclick=newBoard;$("boardSearch").oninput=displayLibrary;$("backLibrary").onclick=()=>{if(recording){notify("Stop recording first");return}show("library")};$("cancelEdit").onclick=()=>show("library");$("boardLayout").onchange=e=>changeLayout(e.target.value);$("tileLabel").oninput=()=>{syncSelected();renderTeacherGrid()};$("tileSymbol").oninput=()=>{syncSelected();renderTeacherGrid()};$("tileColor").onchange=()=>{syncSelected();renderTeacherGrid()};
$("tileImage").onchange=e=>uploadImage(e.target.files[0]).catch(err).finally(()=>e.target.value="");$("tileAudio").onchange=e=>uploadAudio(e.target.files[0]).catch(err).finally(()=>e.target.value="");$("removeImage").onclick=()=>{editing.tiles[selected].image=null;readSelected()};$("recordAudio").onclick=()=>recordStart().catch(err);$("stopRecording").onclick=()=>recordStop().catch(err);$("previewAudio").onclick=()=>playTile(editing.tiles[selected],"",null);$("deleteAudio").onclick=()=>{editing.tiles[selected].audio=null;stopSound();readSelected()};$("moveLeft").onclick=()=>swap(-1);$("moveRight").onclick=()=>swap(1);$("previewBoard").onclick=preview;$("saveBoard").onclick=()=>saveBoard().catch(err);$("shareBack").onclick=()=>loadLibrary().then(()=>show("library")).catch(err);$("copyShare").onclick=()=>navigator.clipboard.writeText($("shareLink").value).then(()=>notify("Link copied")).catch(err);$("openShare").onclick=()=>window.open($("shareLink").value,"_blank","noopener");$("revokeShare").onclick=()=>revokeShare().catch(err);}
async function initStudent(){try{const token=location.pathname.split("/").pop();const b=await api("/api/aac/public/"+encodeURIComponent(token));$("studentTitle").textContent=b.title;renderGrid($("studentTiles"),b.tiles,b.layout,false,token)}catch(e){$("studentHint").textContent="This board link is unavailable or revoked.";err(e)}$("fullscreenBoard").onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()}}
if(teacher)initTeacher();else initStudent();
})();