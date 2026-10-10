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
      let response=null;
      for(let attempt=0;attempt<4;attempt++){
        response=await page.goto(target,{waitUntil:"domcontentloaded",timeout:45000});
        if(response&&response.status()<500)break;
        if(label!=="production"||attempt===3)break;
        console.log(JSON.stringify({label,role,retryingHttp:response?.status(),attempt:attempt+1}));
        await page.waitForTimeout(2000+attempt*1000);
      }
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
        if(label==="local"){
          // Browser-only game simulation on the isolated local server.
          // No network write, no change to production classroom state.
          await page.evaluate(()=>{
            if(typeof state==="undefined")throw new Error("Classroom state unavailable");
            state.activityRun={activityId:"scope-probe",runToken:"scope-probe",phase:"lobby"};
            state.ended=false;
          });
          await page.waitForTimeout(1050); // > 3 iterations of the 320ms dock tick
          const game=await page.evaluate(()=>({
            dock:!!document.getElementById("siLiveControlDock"),
            caption:document.querySelector("#siControlName")?.textContent||"",
            boot:document.getElementById("bootErrorText")?.textContent||""
          }));
          console.log(JSON.stringify({label,role:"teacher-active-game",...game,
            pageErrors:errors.slice(-5)}));
          if(!game.dock||game.boot||errors.length)failures++;
          const dashboard=await page.evaluate(()=>{
            const nav=[...document.querySelectorAll('#teacherControlBar .single-mission-controls .control')];
            const shown=nav.filter(b=>getComputedStyle(b).display!=='none');
            const end=document.getElementById('endBtn'),reset=document.getElementById('resetBtn');
            const top=document.querySelector('.topbar .top-actions');
            const iconCount=shown.filter(b=>b.querySelector('.si-v80-icon svg')).length;
            return {installed:document.body.classList.contains('si-v80-dashboard'),
              status:!!document.getElementById('siV80Information'),
              visible:shown.map(b=>b.querySelector('.copy b')?.textContent?.trim()),
              endInTop:!!end&&top?.contains(end),
              resetInTop:!!reset&&top?.contains(reset),
              pollOnlyInRow:!!document.getElementById('siQuickPollHomeBtn')&&
                getComputedStyle(document.getElementById('qpLauncher')).display==='none',
              icons:iconCount,
              heroHidden:getComputedStyle(document.querySelector('#teacher .deck-header')).display==='none'};
          });
          console.log(JSON.stringify({label,role:'dashboard-layout',...dashboard}));
          const expected=['Lobby','Activities','Agenda','Ready Check','Raise Hand','Buzz','Ask for Help','Picture Prompt','Quick Poll'];
          if(!dashboard.installed||!dashboard.status||!dashboard.endInTop||
            !dashboard.resetInTop||!dashboard.pollOnlyInRow||!dashboard.heroHidden||
            dashboard.icons!==9||JSON.stringify(dashboard.visible)!==JSON.stringify(expected))failures++;
          // Dashboard layout and icon integration must not regress at desktop sizes.
          // The production class is never modified: geometry checks run local only.
          for(const width of [1920,1440,1280,768]){
            await page.setViewportSize({width,height:960});
            await page.waitForTimeout(120);
            const geometry=await page.evaluate(()=>{
              const home=document.getElementById('teacherControlBar');
              const alerts=document.getElementById('attentionSummary');
              const buzz=document.getElementById('buzzPanel');
              const shortcuts=[...document.querySelectorAll('#homeAppGrid .app-shortcut:not(.empty)')];
              const rect=node=>{const r=node.getBoundingClientRect();return {
                top:Math.round(r.top),bottom:Math.round(r.bottom),
                left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)};};
              const homeRect=rect(home),alertRect=rect(alerts),buzzRect=rect(buzz);
              return {home:homeRect,alerts:alertRect,buzz:buzzRect,
                gap:alertRect.top-homeRect.bottom,queueGap:buzzRect.top-alertRect.bottom,
                clearance:alerts.dataset.siAlertClearance||null,
                vectorIcons:shortcuts.filter(b=>!!b.querySelector('svg.si-v82-activity-glyph')).length,
                shortcuts:shortcuts.length,alertVisible:getComputedStyle(alerts).display!=='none'};
            });
            console.log(JSON.stringify({label,role:'teacher-geometry',viewport:width,...geometry}));
            if(!geometry.alertVisible||geometry.shortcuts&&geometry.vectorIcons!==geometry.shortcuts||
               (width>=1220&&(geometry.gap<9||geometry.queueGap<9||geometry.alerts.right>width+3||
                 geometry.home.right>width+3)))failures++;
          }
          await page.setViewportSize({width:1440,height:900});
          await page.evaluate(()=>document.getElementById('siQuickPollHomeBtn')?.click());
          const opened=await page.evaluate(()=>!!document.querySelector('#qpDialog:not([hidden])'));
          console.log(JSON.stringify({label,role:'dashboard-quick-poll-launch',opened}));
          if(!opened||errors.length)failures++;
          const polish=await page.evaluate(()=>{
            const info=document.getElementById('siV80Information');
            const visibleInfo=[...info.children].filter(node=>getComputedStyle(node).display!=='none');
            const shortcutEls=[...document.querySelectorAll('#homeAppGrid .app-shortcut')];
            const sample=shortcutEls.find(node=>!node.classList.contains('empty'));
            const home=document.querySelector('#teacherControlBar .single-mission-controls .control:not(.si-v80-secondary)');
            const end=document.getElementById('endBtn'),reset=document.getElementById('resetBtn');
            const visual=(node)=>({display:getComputedStyle(node).display,
              width:Math.round(node.getBoundingClientRect().width),
              height:Math.round(node.getBoundingClientRect().height)});
            return {
              headerInfo:visibleInfo.map(node=>node.className),
              missionTimer:!!document.getElementById('siV80MissionTime'),
              classVisible:!!document.querySelector('#siV80Information .class-context')&&
                getComputedStyle(document.querySelector('#siV80Information .si-v80-info-class')).display!=='none',
              shortcuts:shortcutEls.length,
              home:visual(home),
              shortcut:sample?visual(sample):null,
              shortcutIcon:sample?visual(sample.querySelector('.app-shortcut-icon')):null,
              shortcutLabel:sample?getComputedStyle(sample.querySelector('.app-shortcut-label')).fontSize:null,
              endIcon:!!end.querySelector('.si-v80-icon svg'),
              resetIcon:!!reset.querySelector('.si-v80-icon svg'),
              end:visual(end),reset:visual(reset)
            };
          });
          console.log(JSON.stringify({label,role:'dashboard-polish-v81',...polish}));
          if(JSON.stringify(polish.headerInfo)!==JSON.stringify(['si-v80-info-status','si-v80-info-code'])||
             polish.missionTimer||polish.classVisible||polish.shortcuts!==9||
             !polish.endIcon||!polish.resetIcon||
             !polish.shortcut||!polish.shortcutIcon||polish.shortcut.height<100||
             polish.shortcutIcon.height<65||parseFloat(polish.shortcutLabel)<10||
             polish.end.height<58||polish.reset.height<58||errors.length)failures++;
        }
      }
    }catch(e){failures++;console.log(JSON.stringify({label,role,error:String(e.stack||e)}));}
    await ctx.close();
   }
 }
 }finally{await browser.close();}
 if(failures){console.error("Browser startup failures:",failures);process.exitCode=1;}
 else console.log("Browser startup passed for teacher, student, shared roles on both hosts.");
})().catch(e=>{console.error(e);process.exitCode=1;});
