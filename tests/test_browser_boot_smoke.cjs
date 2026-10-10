/* Real Chromium boot regression: don't let the generic "Prototype error" hide the stack.
   Probe local and public deployments without voting or modifying live classroom data. */
const {chromium}=require("playwright");
const roles=["teacher","student","shared"];
const hosts=[
  ["local",process.env.LOCAL_URL||"http://127.0.0.1:8877"],
  ["production",process.env.PUBLIC_URL||"https://mothership-web-production.up.railway.app"]
];
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage","--no-sandbox"]});
 let failures=0;
 try{
 for(const [label,url] of hosts){
   for(const role of roles){
    const ctx=await browser.newContext({ignoreHTTPSErrors:false,viewport:{width:1440,height:900}});
    const page=await ctx.newPage(),errors=[];
    page.on("pageerror",error=>errors.push(String(error.stack||error.message||error).slice(0,1900)));
    const target=url+(url.includes("?")?"&":"?")+"role="+role;
    try{
      const response=await page.goto(target,{waitUntil:"domcontentloaded",timeout:45000});
      await page.waitForTimeout(1600);
      const info=await page.evaluate(()=>{
       const overlay=document.getElementById("bootError");
       const text=document.getElementById("bootErrorText");
       const style=overlay?getComputedStyle(overlay):null;
       const visible=!!overlay&&style.display!=="none"&&style.visibility!=="hidden";
       return {
        title:document.title,
        bootVisible:visible,
        bootText:visible?String(text?.textContent||"").slice(0,4000):"",
        quickPollScript:!!document.querySelector('script[src^="/quick-poll.js"]'),
        quickPollCSS:!!document.querySelector('link[href^="/quick-poll.css"]'),
        quickPollLauncher:!!document.getElementById("qpLauncher"),
        quickPollOverlay:!!document.getElementById("qpPublicOverlay")
       };
      });
      console.log(JSON.stringify({label,role,http:response?.status(),...info,pageErrors:errors.slice(0,5)}));
      if(!response||response.status()>=400||info.bootVisible||errors.length)failures++;
      if(!info.quickPollScript||!info.quickPollCSS)failures++;
      if(role==="teacher"){
        // Inspect the Quick Poll studio without changing classroom state.
        // Do not submit questions or vote on the live deployment.
        await page.evaluate(()=>document.getElementById("qpLauncher")?.click());
        await page.waitForTimeout(320);
        const studio=await page.evaluate(()=>({
          visible:!!document.querySelector("#qpDialog:not([hidden])"),
          editor:!!document.querySelector("#qpQuestion"),
          boot:document.getElementById("bootErrorText")?.textContent||""
        }));
        console.log(JSON.stringify({label,role:"studio",...studio,pageErrors:errors.slice(0,5)}));
        if(!studio.visible||!studio.editor||studio.boot||errors.length)failures++;
      }
    }catch(e){failures++;console.log(JSON.stringify({label,role,error:String(e.stack||e)}));}
    await ctx.close();
   }
 }
 }finally{await browser.close();}
 if(failures){console.error("Browser startup failures:",failures);process.exitCode=1;}
 else console.log("Browser startup passed for teacher, student, shared roles on both hosts.");
})().catch(e=>{console.error(e);process.exitCode=1;});
