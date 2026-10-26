/* Regression for SI+ video flicker: unchanged slide and unrelated classroom
   updates must not tear down/recreate the live YouTube iframe or slide image.
   Runs only against local isolated Mothership, never production saved decks. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on("pageerror",e=>errors.push(String(e.message||e)));
 // Exercise DOM stability, not a real network video player.
 await page.route(/youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com/,r=>r.abort());
 try{
  const auth=await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(auth.status(),200);
  await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>typeof render==="function"&&typeof renderPublic==="function",{timeout:12000});
  await page.waitForFunction(()=>!NETWORK_SYNC||networkHydrated,{timeout:15000});
  const initial=await page.evaluate(()=>{
    const id="si-plus-no-flicker-regression";
    const deck={id,type:"presentation",name:"SI+ stable video test",deckTitle:"SI+ stable video test",
      userCreated:true,slides:[{id:"si-slide-1",type:"instruction",title:"Video Example",
        text:"Keep the video playing",image:"",
        youtube:"https://www.youtube.com/watch?v=dQw4w9WgXcQ",choices:[]}]};
    state.activities.push(deck);
    state.activityRun={activityId:id,phase:"running",slideIndex:0,responses:{},runToken:"si-stability-browser"};
    state.screen="activity";render();
    const player=document.querySelector("#sharedContent iframe");
    const mirror=document.querySelector("#mirrorContent iframe");
    return {player:!!player,mirror:!!mirror,
       slide:document.querySelector("#sharedContent")?.textContent?.slice(0,100)||""};
  });
  assert.equal(initial.player,true,"SI+ YouTube iframe present on shared screen");
  // Phase 4R: a presentation video enables the iframe API and shows a
  // teacher-only playback toolbar; commands must keep the slide in place.
  await page.locator("#siPlusVideoControls").waitFor({state:"visible",timeout:12000});
  const frameBefore=await page.evaluate(()=>{
    const frame=document.querySelector("#sharedContent .si-plus-video-frame iframe");
    const mirror=document.querySelector("#mirrorContent .si-plus-video-frame iframe");
    if(frame)frame.__transportStable=true;
    if(mirror)mirror.__transportStable=true;
    return {api:frame?.src.includes("enablejsapi=1"),
      origin:frame?.src.includes("origin="),
      buttons:document.querySelectorAll("#siPlusVideoControls [data-si-video]").length};
  });
  assert.equal(frameBefore.api,true,"YouTube iframe API enabled on presentation videos");
  assert.equal(frameBefore.origin,true,"Iframe API restricted to this classroom origin");
  assert.equal(frameBefore.buttons,3,"Teacher can play, pause, and restart");
  await page.locator('[data-si-video="play"]').click();
  const play=await page.evaluate(()=>state.activityRun.siPlusVideoControl);
  assert.equal(play.action,"play");
  assert.equal(play.token,"si-stability-browser");
  assert.equal(play.index,0);
  assert.equal(play.videoId,"dQw4w9WgXcQ");
  await page.locator('[data-si-video="pause"]').click();
  const paused=await page.evaluate(()=>state.activityRun.siPlusVideoControl);
  assert.equal(paused.action,"pause");
  assert.notEqual(paused.nonce,play.nonce);
  await page.locator('[data-si-video="restart"]').click();
  const restarted=await page.evaluate(()=>({
    command:state.activityRun.siPlusVideoControl,
    shared:!!document.querySelector("#sharedContent iframe")?.__transportStable,
    mirror:(()=>{const m=document.querySelector("#mirrorContent iframe");return m?!!m.__transportStable:true})()
  }));
  assert.equal(restarted.command.action,"restart");
  assert.equal(restarted.shared,true,"Commands must not recreate the projector iframe");
  assert.equal(restarted.mirror,true,"Commands must not recreate teacher video preview");

  // Mirror may render a compact static preview; only assert if it has an iframe.
  await page.evaluate(()=>{
    const player=document.querySelector("#sharedContent iframe");
    const mirror=document.querySelector("#mirrorContent iframe");
    if(player)player.__siStableTestNode=true;
    if(mirror)mirror.__siStableTestNode=true;
    state.students=[...(state.students||[]),{n:"Flicker Test Student",readyResponse:"",c:"#7fe9ff"}];
    render();
  });
  const repeated=await page.evaluate(()=>{
    const player=document.querySelector("#sharedContent iframe"),
      mirror=document.querySelector("#mirrorContent iframe");
    return {sharedPreserved:!!player?.__siStableTestNode,
      mirrorPreserved:mirror?!!mirror.__siStableTestNode:true,
      sharedCount:document.querySelectorAll("#sharedContent iframe").length};
  });
  assert.equal(repeated.sharedPreserved,true,"Unrelated class update must not recreate SI+ video");
  assert.equal(repeated.mirrorPreserved,true,"Mirror remains stable during class update");
  await page.evaluate(()=>renderPublic());
  const after=await page.evaluate(()=>!!document.querySelector("#sharedContent iframe")?.__siStableTestNode);
  assert.equal(after,true,"Repeated render of same slide must not restart video");
  assert.deepEqual(errors,[],"No page runtime exceptions");
  console.log(JSON.stringify({test:"SI+ iframe DOM stability across render and roster change",initial,repeated,after}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
