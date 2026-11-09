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
let sym=document.createElement("span");sym.className="aac-symbol";if(t.image){let img=document.createElement("img");img.src=media("image",t.image,token);img.alt="";sym.append(img)}else sym.textContent=t.symbol||(editable&&!t.label?"＋":"");
let label=document.createElement("span");label.className="aac-tile-label";label.textContent=t.label||(!t.image&&!t.symbol&&editable?"Add content":"");
if(t.label&&!t.image&&!t.symbol){b.classList.add("aac-text-only");sym.hidden=true;}
b.append(sym,label);
let filled=!!(t.label||t.symbol||t.image||t.audio);
if(!filled)b.classList.add("aac-blank");
if(!editable&&!filled)b.disabled=true;
b.setAttribute("aria-label",editable?"Edit tile "+(i+1)+(t.label?": "+t.label:""):t.label||"Communication button "+(i+1));
if(editable)b.setAttribute("aria-pressed",i===selected?"true":"false");
if(editable)b.onclick=()=>{syncSelected();selected=i;renderTeacherGrid();readSelected()};
else b.onclick=()=>playTile(t,token,b);
return b}
function renderGrid(target,tiles,layout,editable,token){target.style.setProperty("--cols",layouts[layout][1]);target.dataset.layout=layout;target.replaceChildren(...tiles.map((t,i)=>makeTile(t,i,editable,token)))}
// Voice preferences live on each device because available speech voices differ by browser.
// Prefer an enhanced/natural English voice automatically, but never assume it exists.
const voicePreferenceKey="si-aac-voice-v1";
const ratePreferenceKey="si-aac-rate-v1";
function localPreference(key,defaultValue){try{return localStorage.getItem(key)||defaultValue}catch{return defaultValue}}
function savePreference(key,value){try{localStorage.setItem(key,value)}catch{}}
let voiceChoice=localPreference(voicePreferenceKey,"auto");
let voiceRate=Math.max(.7,Math.min(1.1,Number(localPreference(ratePreferenceKey,"0.92"))||.92));
function availableVoices(){
 if(!("speechSynthesis" in window))return [];
 try{return window.speechSynthesis.getVoices().slice().sort((a,b)=>a.name.localeCompare(b.name))}catch{return []}
}
function voiceScore(v){
 const name=v.name.toLowerCase(),lang=v.lang.toLowerCase();
 let score=0;
 if(lang.startsWith("en"))score+=100;
 else score-=100;
 if(/natural|neural|enhanced|premium|online/i.test(name))score+=65;
 if(/google|microsoft|siri|samantha|ava|aria|jenny|guy|allison/i.test(name))score+=22;
 if(/compact|robot|espeak/i.test(name))score-=40;
 if(v.default)score+=6;
 return score;
}
// Cap the list at ten real English voices; only categorize names where the
// installed voice name is a known masculine/feminine voice. A browser does not
// expose reliable gender or age metadata, so don't fabricate those qualities.
const feminineNames=/\b(ava|aria|jenny|samantha|victoria|allison|susan|zira|hazel|sonia|libby|michelle|sara|ana|natasha|clara|karen|moira|tessa|fiona|emma|olivia|amy|joanna|kendra|kimberly|ivy|salli|nicole|nicky|siri female)\b/i;
const masculineNames=/\b(guy|davis|brandon|christopher|eric|jacob|tony|ryan|brian|roger|stefan|steffan|andrew|mark|david|james|daniel|alex|fred|aaron|tom|oliver|arthur|george|matthew|justin|joey|rishi|siri male)\b/i;
function curatedVoices(){
 const pool=availableVoices().filter(v=>/^en(?:-|$)/i.test(v.lang));
 pool.sort((a,b)=>voiceScore(b)-voiceScore(a));
 const used=new Set();
 function pick(re){const found=[];for(const v of pool){if(found.length===5)break;if(re.test(v.name)&&!used.has(v.voiceURI)){used.add(v.voiceURI);found.push(v)}}return found}
 const feminine=pick(feminineNames),masculine=pick(masculineNames);
 const other=[];
 // Fill to ten with additional actual voices, marked unclassified.
 for(const v of pool){if(feminine.length+masculine.length+other.length>=10)break;if(!used.has(v.voiceURI)){used.add(v.voiceURI);other.push(v)}}
 return {feminine,masculine,other};
}
function preferredVoice(){
 const voices=availableVoices();
 if(voiceChoice!=="auto"){
  const picked=voices.find(v=>v.voiceURI===voiceChoice);
  if(picked)return picked;
 }
 return voices.sort((a,b)=>voiceScore(b)-voiceScore(a))[0]||null;
}
function speakText(text,node){
 if(!("speechSynthesis" in window)||!window.SpeechSynthesisUtterance){notify("Speech is not available on this device.");return}
 const u=new SpeechSynthesisUtterance(text);
 const v=preferredVoice();
 if(v){u.voice=v;u.lang=v.lang}
 u.rate=voiceRate;
 u.pitch=1;
 u.onend=()=>{if(audioNode===node){node?.classList.remove("aac-playing");audioNode=null}};
 u.onerror=()=>{if(audioNode===node){node?.classList.remove("aac-playing");audioNode=null}};
 window.speechSynthesis.speak(u);
}
function createVoiceControls(){
 const box=document.createElement("div");box.className="aac-voice-controls";
 const voiceLabel=document.createElement("label");voiceLabel.textContent="Speaking voice";
 const select=document.createElement("select");select.setAttribute("aria-label","Speaking voice");voiceLabel.append(select);
 const rateLabel=document.createElement("label");rateLabel.textContent="Speaking speed";
 const speed=document.createElement("select");speed.setAttribute("aria-label","Speaking speed");
 for(const [value,label] of [["0.75","Slow"],["0.92","Natural"],["1","Normal"],["1.1","Fast"]]){
  const opt=document.createElement("option");opt.value=value;opt.textContent=label;speed.append(opt)
 }
 speed.value=String(voiceRate);
 const test=document.createElement("button");test.type="button";test.textContent="▶ Test Voice";
 test.title="Hear a sample phrase using this device's selected voice";
 const note=document.createElement("small");note.textContent="Voices vary by device. Recorded audio always takes priority.";
 function populate(){
  const previous=select.value||voiceChoice;
  select.replaceChildren();
  const automatic=document.createElement("option");automatic.value="auto";automatic.textContent="Best available (automatic)";select.append(automatic);
  const groups=curatedVoices();
  for(const [title,voices] of [["Feminine-sounding",groups.feminine],["Masculine-sounding",groups.masculine],["Other available",groups.other]]){
    if(!voices.length)continue;
    const group=document.createElement("optgroup");group.label=title;
    for(const voice of voices){const opt=document.createElement("option");opt.value=voice.voiceURI;opt.textContent=voice.name;group.append(opt)}
    select.append(group);
  }
  select.value=Array.from(select.options).some(o=>o.value===previous)?previous:"auto";
  note.textContent="Up to 10 voices from this device. Voice age and gender cannot be verified; recordings override speech.";
 }
 populate();
 if("speechSynthesis" in window){
  window.speechSynthesis.addEventListener?.("voiceschanged",populate);
 }
 select.onchange=()=>{voiceChoice=select.value;savePreference(voicePreferenceKey,voiceChoice);stopSound()};
 speed.onchange=()=>{voiceRate=Number(speed.value);savePreference(ratePreferenceKey,String(voiceRate));stopSound()};
 test.onclick=()=>{stopSound();speakText("Hello! I am ready to communicate.",null)};
 box.append(voiceLabel,rateLabel,test,note);
 return box;
}
function stopSound(){if(activeAudio){activeAudio.pause();activeAudio.src="";activeAudio=null}if("speechSynthesis" in window)window.speechSynthesis.cancel();if(audioNode){audioNode.classList.remove("aac-playing");audioNode=null}}
function playTile(t,token,element){stopSound();if(!t.audio&&!t.label)return;if(element){audioNode=element;element.classList.add("aac-playing")}if(t.audio){let audio=new Audio(media("audio",t.audio,token));activeAudio=audio;audio.onended=()=>stopSound();audio.onerror=()=>{stopSound();notify("Audio could not play. Check device volume or connection.")};audio.play().catch(()=>{stopSound();notify("Touch the picture again to allow audio.")})}else if(t.label){speakText(t.label,element||null)}}
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
function preview(){syncSelected();const wrap=document.createElement("div");wrap.style.cssText="position:fixed;inset:0;z-index:100;background:#030d20f5;overflow:auto;padding:15px;display:grid;place-items:center";const card=document.createElement("div");card.className="aac-card";card.style.cssText="width:min(900px,100%);max-height:96vh;overflow:auto";const hd=document.createElement("div");hd.className="aac-titlebar";const h=document.createElement("h2");h.textContent=clean($("boardTitle").value)||"Student Preview";const close=document.createElement("button");close.textContent="✕ Close Preview";close.onclick=()=>{stopSound();wrap.remove()};hd.append(h,close);const grid=document.createElement("div");grid.className="aac-grid aac-student-grid";renderGrid(grid,editing.tiles,editing.layout,false,"");card.append(hd,createVoiceControls(),grid);wrap.append(card);document.body.append(wrap)}
// WAV recording: browser microphone PCM is encoded to mono 16-bit WAV so the server
// can independently validate the duration and never trust media metadata alone.
async function recordStart(){if(recording)return;let stream,ctx;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});const AC=window.AudioContext||window.webkitAudioContext;ctx=new AC();const src=ctx.createMediaStreamSource(stream);const proc=ctx.createScriptProcessor(4096,1,1);let chunks=[],frames=0;const gain=ctx.createGain();gain.gain.value=0;src.connect(proc);proc.connect(gain);gain.connect(ctx.destination);proc.onaudioprocess=e=>{let chan=e.inputBuffer.getChannelData(0);chunks.push(new Float32Array(chan));frames+=chan.length};const t=Date.now();$("recordAudio").disabled=true;$("stopRecording").disabled=false;const timer=setInterval(()=>{let sec=Math.min(30,Math.floor((Date.now()-t)/1000));$("recordTimer").textContent="00:"+String(sec).padStart(2,"0")+" / 00:30";if(Date.now()-t>=30000)recordStop().catch(err)},200);recording={stream,ctx,src,proc,gain,chunks,framesRef:()=>frames,timer,slot:selected};
notify("Microphone recording started");}catch(e){stream?.getTracks().forEach(x=>x.stop());ctx?.close();throw Error("Microphone unavailable or permission denied: "+(e.message||""))}}
function wavBlob(chunks,frames,rate){const wav=new ArrayBuffer(44+frames*2);const view=new DataView(wav);function put(off,val){for(let i=0;i<val.length;i++)view.setUint8(off+i,val.charCodeAt(i))}put(0,"RIFF");view.setUint32(4,36+frames*2,true);put(8,"WAVEfmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);put(36,"data");view.setUint32(40,frames*2,true);let at=44;for(let chunk of chunks)for(let sample of chunk){sample=Math.max(-1,Math.min(1,sample));view.setInt16(at,sample<0?sample*32768:sample*32767,true);at+=2}return new Blob([wav],{type:"audio/wav"})}
async function recordStop(){if(!recording)return;const rec=recording;recording=null;clearInterval(rec.timer);rec.proc.disconnect();rec.src.disconnect();rec.gain.disconnect();rec.stream.getTracks().forEach(x=>x.stop());$("stopRecording").disabled=true;$("recordAudio").disabled=false;const frames=rec.framesRef();const rate=rec.ctx.sampleRate;await rec.ctx.close();if(frames<rate*.2){notify("Recording was too short");return}const file=wavBlob(rec.chunks,frames,rate);const data=await readFile(file);const result=await api("/api/aac/media","POST",{kind:"audio",data});editing.tiles[rec.slot].audio=result.id;readSelected();notify("Recorded audio saved to button")}

async function kokoroRefresh(){
 try{
  const data=await api("/api/aac/kokoro/status");
  $("kokoroPrepare").disabled=data.ready||data.busy;
  $("kokoroGenerate").disabled=!data.ready||data.busy;
  $("kokoroStatus").textContent=data.ready?"Kokoro ready — choose a voice and generate audio.":data.busy?"Kokoro is currently preparing or generating.":"Kokoro model not prepared yet. Prepare once before generating.";
 }catch(e){
  $("kokoroGenerate").disabled=true;
  $("kokoroStatus").textContent="Kokoro not available; browser voices and recordings still work.";
 }
}
async function kokoroPrepare(){
 $("kokoroPrepare").disabled=true;$("kokoroGenerate").disabled=true;
 $("kokoroStatus").textContent="Downloading the free Kokoro model to persistent storage. This initial setup may take a few minutes.";
 try{
  await api("/api/aac/kokoro/prepare","POST");
  notify("Kokoro voice files are ready");
 }catch(e){err(e)}
 await kokoroRefresh();
}
async function kokoroGenerate(){
 if(!editing)return;
 syncSelected();
 const index=selected;
 const phrase=(editing.tiles[index].label||"").trim();
 if(!phrase){notify("Enter text in the selected button label first.");return}
 if(phrase.length>120){notify("Kokoro pilot supports up to 120 characters.");return}
 if(editing.tiles[index].audio&&!confirm("Replace this button's existing audio with the selected Kokoro voice?"))return;
 $("kokoroGenerate").disabled=true;$("kokoroPrepare").disabled=true;
 $("kokoroStatus").textContent="Generating "+$("kokoroVoice").selectedOptions[0].text+" for this button…";
 try{
  const result=await api("/api/aac/kokoro/generate","POST",{text:phrase,voice:$("kokoroVoice").value});
  editing.tiles[index].audio=result.id;
  readSelected();
  notify("Generated Kokoro audio. Save the board to keep it.");
  $("kokoroStatus").textContent="Generated! Preview the audio, then Save to Library.";
 }catch(e){err(e);$("kokoroStatus").textContent="Generation unavailable. Existing audio is unchanged."}
 finally{$("kokoroGenerate").disabled=false;await kokoroRefresh()}
}
// A quarter-screen, user-initiated pop-out for Zoom classes.
 // Browsers may prevent programmatic popups/resizing from pasted links; the
 // student page always remains fully usable and offers the explicit action.
function aacCompactStudentWindow(rawUrl){
 const url=new URL(rawUrl,location.href);
 if(url.origin!==location.origin||!/^\/aac\/s\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)){
  notify("This is not an AAC+ student board link.");return false;
 }
 url.searchParams.set("compact","1");
 const area=window.screen;
 const availableWidth=Math.max(340,Number(area.availWidth)||innerWidth);
 const availableHeight=Math.max(480,Number(area.availHeight)||innerHeight);
 const width=Math.min(availableWidth,Math.max(340,Math.round(availableWidth*.25)));
 const height=Math.min(availableHeight,Math.max(440,Math.round(availableHeight*.87)));
 const left=(Number(area.availLeft)||0)+Math.max(0,availableWidth-width-16);
 const top=(Number(area.availTop)||0)+Math.max(0,Math.round((availableHeight-height)/2));
 const features="popup=yes,width="+width+",height="+height+",left="+left+",top="+top+",resizable=yes,scrollbars=yes";
 const child=window.open(url.href,"aacPlusStudentCompact",features);
 if(!child){notify("Pop-up blocked. Allow pop-ups for Mothership, or use this AAC+ page directly.");return false}
 try{child.opener=null;child.focus()}catch(e){}
 return true;
}
function closeAACStudio(){
 // The main Mothership browser remains open when AAC+ was launched as a popup.
 // Direct /aac navigation falls back to the Command Deck when close is blocked.
 try{window.close()}catch(e){}
 window.setTimeout(()=>{if(!window.closed)location.assign('/teacher')},150);
}
async function initTeacher(){
const close=$("aacCloseWindow");if(close)close.onclick=closeAACStudio;
try{await loadLibrary()}catch(e){err(e);if(e.message.includes("sign-in"))$("boardList").textContent="Teacher sign-in required. Return to Command Deck, unlock it, then open AAC+ again."}
$("newBoard").onclick=newBoard;$("boardSearch").oninput=displayLibrary;$("backLibrary").onclick=()=>{if(recording){notify("Stop recording first");return}show("library")};$("cancelEdit").onclick=()=>show("library");$("boardLayout").onchange=e=>changeLayout(e.target.value);$("tileLabel").oninput=()=>{syncSelected();renderTeacherGrid()};$("tileSymbol").oninput=()=>{syncSelected();renderTeacherGrid()};$("tileColor").onchange=()=>{syncSelected();renderTeacherGrid()};
$("tileImage").onchange=e=>uploadImage(e.target.files[0]).catch(err).finally(()=>e.target.value="");$("tileAudio").onchange=e=>uploadAudio(e.target.files[0]).catch(err).finally(()=>e.target.value="");$("removeImage").onclick=()=>{editing.tiles[selected].image=null;readSelected()};$("recordAudio").onclick=()=>recordStart().catch(err);$("stopRecording").onclick=()=>recordStop().catch(err);$("previewAudio").onclick=()=>playTile(editing.tiles[selected],"",null);$("deleteAudio").onclick=()=>{editing.tiles[selected].audio=null;stopSound();readSelected()};$("moveLeft").onclick=()=>swap(-1);$("moveRight").onclick=()=>swap(1);$("previewBoard").onclick=preview;$("saveBoard").onclick=()=>saveBoard().catch(err);$("shareBack").onclick=()=>loadLibrary().then(()=>show("library")).catch(err);$("copyShare").onclick=()=>navigator.clipboard.writeText($("shareLink").value).then(()=>notify("Link copied")).catch(err);$("openShare").onclick=()=>aacCompactStudentWindow($("shareLink").value);$("revokeShare").onclick=()=>revokeShare().catch(err);$("kokoroPrepare").onclick=()=>kokoroPrepare().catch(err);$("kokoroGenerate").onclick=()=>kokoroGenerate().catch(err);kokoroRefresh();}
async function initStudent(){
 const compact=new URLSearchParams(location.search).get("compact")==="1";
 document.body.classList.toggle("aac-compact-window",compact);
 const popout=$("aacPopoutBoard");
 if(popout){
  popout.hidden=compact;
  popout.onclick=()=>aacCompactStudentWindow(location.href);
 }
 const controls=createVoiceControls();$("studentHint").after(controls);try{const token=location.pathname.split("/").pop();const b=await api("/api/aac/public/"+encodeURIComponent(token));$("studentTitle").textContent=b.title;renderGrid($("studentTiles"),b.tiles,b.layout,false,token)}catch(e){$("studentHint").textContent="This board link is unavailable or revoked.";err(e)}$("fullscreenBoard").onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()}}
if(teacher)initTeacher();else initStudent();
})();