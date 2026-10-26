/* Phase 4S student companion: keyboard avatar browsing, truthful WebSocket
 * recovery indicator, and responsive geometry. Uses an isolated test class. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8891";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const teacherContext=await browser.newContext({viewport:{width:1280,height:800}});
 const studentContext=await browser.newContext({
   viewport:{width:440,height:780},
   userAgent:"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
 });
 const teacher=await teacherContext.newPage(),student=await studentContext.newPage(),errors=[];
 teacher.on("pageerror",e=>errors.push("teacher: "+String(e)));
 student.on("pageerror",e=>errors.push("student: "+String(e)));
 try{
   assert.equal((await teacher.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
   await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
   await teacher.waitForFunction(()=>networkHydrated===true&&STUDENT_JOIN_CODE&&STUDENT_SESSION_ID,
     null,{timeout:20000});
   const {code,sid}=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
   await student.goto(BASE+"/?role=student&code="+encodeURIComponent(code)+
     "&sid="+encodeURIComponent(sid),{waitUntil:"domcontentloaded",timeout:40000});
   await student.waitForFunction(()=>networkHydrated===true&&
     window.SIStudentConnection&&document.querySelector("#studentContent .si-avatar-navigator"),
     null,{timeout:20000});
   assert.equal(await student.locator("#siStudentLaunchScreen").count(),0,
     "Phone/student compact experience should not create a desktop popup gate");
   const avatar=student.locator("#studentContent [data-join-avatar]:visible");
   assert.equal(await avatar.count(),9,"Three rows remain available on 440px screens");
   await avatar.first().focus();
   const keys=await student.evaluate(()=>[...document.querySelectorAll(
     "#studentContent [data-join-avatar]:not([hidden])")].map(x=>x.dataset.joinAvatar));
   await student.keyboard.press("ArrowRight");
   assert.equal(await student.evaluate(()=>document.activeElement?.dataset.joinAvatar),keys[1]);
   await student.keyboard.press("ArrowDown");
   assert.equal(await student.evaluate(()=>document.activeElement?.dataset.joinAvatar),keys[4]);
   await student.keyboard.press("End");
   const end=await student.evaluate(()=>({
     focus:document.activeElement?.dataset.joinAvatar,
     page:document.querySelector(".si-avatar-page-count")?.textContent.trim(),
     visible:document.querySelectorAll("#studentContent [data-join-avatar]:not([hidden])").length,
     hidden:document.activeElement?.hidden
   }));
   assert.ok(end.focus&&end.page?.startsWith("3 /"),JSON.stringify(end));
   assert.equal(end.hidden,false,"The last avatar must be visible and focused");
   await student.keyboard.press("Home");
   assert.equal(await student.evaluate(()=>document.activeElement?.dataset.joinAvatar),keys[0]);
   const search=student.locator(".si-avatar-search input");
   await search.fill("no-such-student-4s");
   assert.equal(await student.locator("#studentContent [data-join-avatar]:visible").count(),0);
   await search.press("Escape");
   assert.equal(await search.inputValue(),"","Escape clears an avatar filter");
   assert.equal(await student.locator("#studentContent [data-join-avatar]:visible").count(),9);
   await avatar.first().click();
   await student.locator("#joinStudentName").waitFor({state:"visible",timeout:10000});
   await student.locator("#joinStudentName").fill("Phase 4S Test Student");
   await student.locator("#joinClassBtn").click();
   await student.waitForFunction(()=>!studentNeedsJoin()&&
     document.querySelector("#studentConnectionLabel")?.dataset.siNetwork==="connected",
     null,{timeout:20000});
   const initial=await student.evaluate(()=>({
     name:state.selectedStudent,
     avatar:state.students.find(x=>x.n===state.selectedStudent)?.avatarKey,
     count:state.students.length
   }));
   assert.equal(initial.name,"Phase 4S Test Student");
   assert.equal(await student.locator("#siStudentConnectionNotice").isVisible(),false);
   // Reconnect using the actual client WebSocket close handler, not a
   // fabricated CSS/data-state toggle. The native client reconnects itself.
   await student.evaluate(()=>networkSocket?.close());
   await student.waitForFunction(()=>document.querySelector("#studentConnectionLabel")
     ?.dataset.siNetwork==="reconnecting" &&
     document.querySelector("#siStudentConnectionNotice")?.hidden===false,
     null,{timeout:5000});
   const reconnect=await student.evaluate(()=>({
     status:document.querySelector("#studentConnectionLabel")?.textContent,
     copy:document.querySelector("#siStudentConnectionNotice")?.textContent
   }));
   assert.match(reconnect.status,/Reconnecting/);
   assert.match(reconnect.copy,/Reconnecting to class/);
   for(const [width,height] of [[440,780],[330,620]]){
     await student.setViewportSize({width,height});
     const geometry=await student.evaluate(()=>{
       const root=document.querySelector("#siStudentConnectionNotice").getBoundingClientRect();
       const main=document.querySelector("#studentContent").getBoundingClientRect();
       return {right:root.right,mainHeight:main.height,scroll:document.documentElement.scrollWidth-innerWidth};
     });
     assert.ok(geometry.right<=width+2&&geometry.scroll<=2,
       "Connection notice must fit without horizontal cropping: "+JSON.stringify({width,geometry}));
     assert.ok(geometry.mainHeight>150,"Student content remains scrollable below reconnect banner");
   }
   // An actual socket opening/hydration restores Joined without forcing an
   // avatar re-selection or creating a duplicate student record.
   await student.waitForFunction(()=>networkSocket?.readyState===WebSocket.OPEN&&
     document.querySelector("#studentConnectionLabel")?.dataset.siNetwork==="connected" &&
     document.querySelector("#siStudentConnectionNotice")?.hidden===true,
     null,{timeout:25000});
   const restored=await student.evaluate(()=>({
     name:state.selectedStudent,
     avatar:state.students.find(x=>x.n===state.selectedStudent)?.avatarKey,
     count:state.students.length,
     joined:!studentNeedsJoin()
   }));
   assert.equal(restored.name,initial.name);
   assert.equal(restored.avatar,initial.avatar);
   assert.equal(restored.count,initial.count);
   assert.equal(restored.joined,true);
   assert.deepEqual(errors,[]);
   console.log("PHASE 4S AVATAR KEYBOARD, RECONNECTION BANNER, COMPACT LAYOUT PASSED",
     JSON.stringify({initial,reconnect,restored}));
 }finally{
   await studentContext.close();await teacherContext.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
