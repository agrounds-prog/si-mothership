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
              const stack=document.getElementById('siV85AlertStack');
              const railOrder=['attentionSummary','buzzPanel','photoInboxPanel','helpInboxPanel'];
              const stackReady=!!stack&&railOrder.every((id,i)=>stack.children[i]?.id===id);
              const shortcuts=[...document.querySelectorAll('#homeAppGrid .app-shortcut:not(.empty)')];
              const rect=node=>{const r=node.getBoundingClientRect();return {
                top:Math.round(r.top),bottom:Math.round(r.bottom),
                left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)};};
              const homeRect=rect(home),alertRect=rect(alerts),buzzRect=rect(buzz);
              return {home:homeRect,alerts:alertRect,buzz:buzzRect,stackReady,
                gap:alertRect.top-homeRect.bottom,queueGap:buzzRect.top-alertRect.bottom,
                homeTrack:getComputedStyle(document.querySelector('#teacher .mission-grid')).gridTemplateRows.split(' ')[0],
                panelTranslate:getComputedStyle(alerts).translate,
                shortcutsTop:Math.round(document.getElementById('appShortcutsPanel').getBoundingClientRect().top),
                helpBottom:Math.round(document.getElementById('helpInboxPanel').getBoundingClientRect().bottom),
                vectorIcons:shortcuts.filter(b=>!!b.querySelector('svg.si-v82-activity-glyph')).length,
                shortcuts:shortcuts.length,alertVisible:getComputedStyle(alerts).display!=='none'};
            });
            console.log(JSON.stringify({label,role:'teacher-geometry',viewport:width,...geometry}));
            const gridAudit=await page.evaluate(()=>{
              const css=id=>{const el=document.querySelector(id),r=el.getBoundingClientRect(),c=getComputedStyle(el);
                return {top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height),
                  display:c.display,position:c.position,topStyle:c.top,transform:c.transform,translate:c.translate,
                  marginTop:c.marginTop,alignSelf:c.alignSelf,gridRow:c.gridRow,gridColumn:c.gridColumn};
              };
              return {grid:css('#teacher .mission-grid'),home:css('#teacherControlBar'),
                roster:css('#lobbyPanel'),mirror:css('#teacher .screen-dock'),
                stack:css('#siV85AlertStack'),alerts:css('#attentionSummary'),
                shortcuts:css('#dashboardToolsRow'),
                tracks:getComputedStyle(document.querySelector('#teacher .mission-grid')).gridTemplateRows};
            });
            console.log(JSON.stringify({label,role:'grid-audit',viewport:width,...gridAudit}));
            if(!geometry.stackReady||!geometry.alertVisible||geometry.shortcuts&&geometry.vectorIcons!==geometry.shortcuts||
               (width>=1220&&(geometry.gap<9||geometry.queueGap<9||geometry.shortcutsTop-geometry.helpBottom<6||geometry.panelTranslate!=='none'||geometry.alerts.right>width+3||
                 geometry.home.right>width+3)))failures++;
          }
          // Reproduce the populated alert rail shown in classrooms without
          // modifying the actual class: DOM-only fixture on isolated localhost.
          await page.setViewportSize({width:1440,height:960});
          const populated=await page.evaluate(async()=>{
            const ids=['buzzRows','photoRows','helpRows'];
            const nodes=ids.map(id=>document.getElementById(id));
            const saved=nodes.map(node=>node.innerHTML);
            const panels=['buzzPanel','photoInboxPanel','helpInboxPanel'].map(id=>document.getElementById(id));
            const wasEmpty=panels.map(el=>el.classList.contains('is-empty'));
            panels.forEach(el=>el.classList.remove('is-empty'));
            const avatar='<span style="display:inline-block;width:32px;height:32px;border-radius:8px;background:#145075"></span>';
            nodes[0].innerHTML='<div class="student-row inbox-student-row"><span class="queue-num">1</span>'+avatar+'<span class="inbox-copy"><b>Test Student</b><small>Ready to answer</small></span></div>';
            nodes[1].innerHTML='<div class="help-row photo-row">'+avatar+'<span><b>Test Student</b><small>NEW PHOTO</small></span></div>';
            nodes[2].innerHTML='<div class="help-message-row unread">'+avatar+'<span class="preview"><b>Test Student</b><small>Needs support</small></span><button>Read</button></div>';
            await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
            const box=id=>document.getElementById(id).getBoundingClientRect();
            const home=box('teacherControlBar'),alerts=box('attentionSummary');
            const buzz=box('buzzPanel'),photo=box('photoInboxPanel'),help=box('helpInboxPanel'),shortcuts=box('appShortcutsPanel');
            const stack=document.getElementById('siV85AlertStack');
            const result={stackReady:!!stack&&['attentionSummary','buzzPanel','photoInboxPanel','helpInboxPanel'].every(id=>document.getElementById(id).parentElement===stack),
              homeGap:alerts.top-home.bottom,summaryGap:buzz.top-alerts.bottom,
              buzzGap:photo.top-buzz.bottom,photoGap:help.top-photo.bottom,
              shortcutsGap:shortcuts.top-help.bottom,
              allUntranslated:['attentionSummary','buzzPanel','photoInboxPanel','helpInboxPanel'].every(id=>getComputedStyle(document.getElementById(id)).translate==='none')};
            nodes.forEach((node,i)=>{node.innerHTML=saved[i]});
            panels.forEach((panel,i)=>panel.classList.toggle('is-empty',wasEmpty[i]));
            return result;
          });
          console.log(JSON.stringify({label,role:'populated-alert-layout',...populated}));
          if(!populated.stackReady||populated.homeGap<9||populated.summaryGap<9||populated.buzzGap<9||
             populated.photoGap<9||populated.shortcutsGap<6||!populated.allUntranslated)failures++;
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
          // Quick Poll interaction test against isolated browser-mocked routes.
          // The production class and persistent database are never mutated.
          try{
            let simulated=null;
            await page.route('**/api/quick-poll/**',async route=>{
              const path=new URL(route.request().url()).pathname;
              const verb=route.request().method();
              const data=verb==='POST'?route.request().postDataJSON():{};
              let result={ok:true};
              if(path.endsWith('/state'))result={active:!!simulated,poll:simulated};
              else if(path.endsWith('/templates'))result={templates:[]};
              else if(path.endsWith('/launch')){
                simulated={...data,id:'ui-regression-poll',phase:'open',round:1,
                  choices:data.choices.map((c,i)=>({...c,id:String(i)})),
                  counts:Object.fromEntries(data.choices.map((_,i)=>[String(i),0])),
                  voters:0,eligible:0,ownVote:null,endAt:null};
              }else if(path.endsWith('/control')){
                if(data.action==='dismiss')simulated=null;
                else if(simulated)simulated.phase=data.action==='close'?'closed':'open';
              }
              await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
            });
            await page.reload({waitUntil:'domcontentloaded'});
            await page.waitForTimeout(450);
            // The isolated UI fixture mocks all poll API routes. Dismiss the
            // teacher login overlay visually so Playwright can exercise real
            // pointer interactions; no real API permissions are changed.
            await page.evaluate(()=>{
              document.getElementById('teacherLoginOverlay')?.classList.add('hidden');
              document.getElementById('teacher')?.classList.add('active');
            });
            await page.evaluate(()=>{
              const button=document.getElementById('siQuickPollHomeBtn');
              if(!button)throw Error('Quick Poll Home Row button missing');
              button.click();
            });
            await page.locator('#qpDialog [data-qp-launch]').click();
            const warning=await page.locator('#qpTopError').textContent();
            const visible=await page.locator('#qpTopError').isVisible();
            console.log(JSON.stringify({label,role:'poll-form-validation',visible,warning}));
            if(!visible||!warning.includes('Enter your question'))failures++;
            await page.locator('#qpQuestion').fill('Choose our next classroom activity');
            await page.locator('[data-qp-label="0"]').fill('Bingo');
            await page.locator('[data-qp-label="1"]').fill('Starwheel');
            await page.locator('#qpDialog [data-qp-launch]').click();
            await page.waitForFunction(()=>document.querySelector('#qpTeacherLive')?.textContent?.includes('VOTING OPEN'),null,{timeout:8500});
            console.log(JSON.stringify({label,role:'poll-launch-ui',
              active:!!simulated,question:simulated?.question,choices:simulated?.choices?.map(x=>x.label)}));
            if(!simulated||simulated.question!=='Choose our next classroom activity')failures++;
            await page.locator('#qpDialog [data-qp-control="close"]').click();
            await page.waitForFunction(()=>document.querySelector('#qpTeacherLive')?.textContent?.includes('POLL CLOSED'),null,{timeout:8500});
            page.once('dialog',dialog=>dialog.accept());
            await page.locator('#qpDialog [data-qp-control="dismiss"]').click();
            await page.waitForFunction(()=>document.querySelector('#qpTeacherLive')?.textContent?.includes('Create and send'),null,{timeout:8500});
            console.log(JSON.stringify({label,role:'poll-dismiss-ui',cleaned:!simulated,pageErrors:errors.slice(-3)}));
            if(simulated||errors.length)failures++;
          }catch(e){failures++;console.log(JSON.stringify({label,role:'quick-poll-ui-e2e',error:String(e.stack||e)}));}

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
