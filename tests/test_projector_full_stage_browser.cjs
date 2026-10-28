/* Read-only isolated shared-screen DOM / layout regression. No /data writes. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8897";
if(!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(BASE))throw Error("Localhost only");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:1709,height:897}});
 const teacherCtx=await browser.newContext({viewport:{width:1280,height:800}});
 const teacher=await teacherCtx.newPage(),shared=await ctx.newPage(),errors=[];
 for(const p of [teacher,shared])p.on("pageerror",e=>errors.push(String(e)));
 try{
  assert.equal((await teacherCtx.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>networkHydrated===true&&STUDENT_SESSION_ID,null,{timeout:18000});
  const sid=await teacher.evaluate(()=>STUDENT_SESSION_ID);
  await shared.goto(BASE+"/?role=shared&sid="+encodeURIComponent(sid),
   {waitUntil:"domcontentloaded",timeout:40000});
  await shared.waitForFunction(()=>!!document.getElementById("sharedContent")&&networkHydrated===true,
   null,{timeout:18000});
  for(const [w,h] of [[1709,897],[1280,720],[1024,768]]){
    await shared.setViewportSize({width:w,height:h});
    const data=await shared.evaluate(()=>{
      const root=document.getElementById("sharedContent");
      function info(el){
        if(!el)return null;
        const c=getComputedStyle(el),r=el.getBoundingClientRect();
        return {tag:el.tagName,id:el.id,cls:String(el.className).slice(0,130),
         display:c.display,position:c.position,gridTemplate:c.gridTemplateColumns,
         gridColumn:c.gridColumn,width:Math.round(r.width),left:Math.round(r.left),
         height:Math.round(r.height),right:Math.round(r.right),text:el.innerText?.slice(0,125)};
      }
      const path=[];for(let el=root,i=0;el&&i<6;el=el.parentElement,i++)path.push(info(el));
      const shared=document.getElementById("shared");
      const descendants=[...(shared?.querySelectorAll("aside,nav,[class*=rail],[class*=side],[class*=hud],[class*=panel]")||[])].slice(0,40).map(info);
      const children=[...(shared?.children||[])].map(info);
      return {body:document.body.className,width:innerWidth,root:info(root),
       path,children,descendants,sharedHead:shared?.outerHTML.slice(0,3000),
       overflow:document.documentElement.scrollWidth-innerWidth};
    });
    console.log("PROJECTOR DIAGNOSTIC "+w+"x"+h,JSON.stringify(data));
    assert.ok(data.root.width>300);
  }
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();await teacherCtx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
