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
 await page.route(/youtube\.com|youtu\.be|ytimg\.com/,r=>r.abort());
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
