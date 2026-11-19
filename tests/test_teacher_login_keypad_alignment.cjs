/* Keypad geometry + real click alignment, isolated local teacher login.
   This test never submits a PIN or accesses a production classroom. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/.test(BASE))
  throw Error('Teacher login alignment test is localhost-only');

(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    for(const [width,height] of [[1729,894],[1440,900],[1280,720]]){
      const ctx=await browser.newContext({viewport:{width,height}});
      const page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(String(e)));
      const response=await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded'});
      assert.equal(response.status(),200);
      await page.waitForSelector('#teacherLoginOverlay:not(.hidden) .si-pin-grid .si-pin-key',{timeout:12000});
      const info=await page.evaluate(()=>{
        const ov=document.getElementById('teacherLoginOverlay');
        const pos=el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};};
        const keys=[...ov.querySelectorAll('.si-pin-key')].map(pos);
        const dots=[...ov.querySelectorAll('.si-pin-dot')].map(pos);
        const launch=pos(ov.querySelector('.si-pin-launch'));
        const remember=pos(ov.querySelector('.teacher-login-remember input'));
        const art=getComputedStyle(ov);
        return {keys,dots,launch,remember,background:art.backgroundImage,
          backgroundSize:art.backgroundSize,backgroundPosition:art.backgroundPosition};
      });
      assert.equal(info.keys.length,12);
      assert.equal(info.dots.length,4);
      assert.match(info.background,/d0971a35/);
      assert.match(info.backgroundSize,/105\.5%/);
      const cols=[.362,.498,.634],rows=[.434,.516,.596,.676];
      const near=(actual,want,tol,what)=>assert.ok(Math.abs(actual-want)<=tol,
        what+' expected '+want+' got '+actual+' at '+width+'x'+height);
      for(let i=0;i<12;i++){
        near(info.keys[i].x/width,cols[i%3],.015,'Key '+(i+1)+' x');
        near(info.keys[i].y/height,rows[Math.floor(i/3)],.013,'Key '+(i+1)+' y');
      }
      const dotXs=[.421,.472,.523,.574];
      for(let i=0;i<4;i++){
        near(info.dots[i].x/width,dotXs[i],.013,'PIN ring '+(i+1)+' x');
        near(info.dots[i].y/height,.361,.012,'PIN ring '+(i+1)+' y');
      }
      near(info.launch.x/width,.498,.012,'Launch x');
      near(info.launch.y/height,.779,.012,'Launch y');
      near(info.remember.x/width,.405,.012,'Remember checkbox x');
      near(info.remember.y/height,.853,.014,'Remember checkbox y');

      // Browser hit-testing catches transparent hotspots overlapping a
      // neighboring illustrated button even when click handlers are correct.
      const centerHit=await page.evaluate(()=>{
        const els=[...document.querySelectorAll('#teacherLoginOverlay .si-pin-key')];
        return els.map(el=>{const r=el.getBoundingClientRect();
          const onTop=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
          return onTop===el;});
      });
      assert.ok(centerHit.every(Boolean),'Some visible keys do not own their hit area: '+centerHit);

      const pin=page.locator('#teacherLoginKey');
      await page.locator('.si-pin-key[aria-label="1"]').click();
      await page.locator('.si-pin-key[aria-label="9"]').click();
      assert.equal(await pin.inputValue(),'19');
      assert.equal(await page.locator('.si-pin-dot.filled').count(),2);
      await page.locator('.si-pin-key[aria-label="Delete last digit"]').click();
      assert.equal(await pin.inputValue(),'1');
      await page.locator('.si-pin-key[aria-label="Clear"]').click();
      assert.equal(await pin.inputValue(),'');
      assert.equal(await page.locator('.si-pin-dot.filled').count(),0);
      const remember=page.locator('.teacher-login-remember input');
      await page.mouse.click(info.remember.x,info.remember.y);
      assert.equal(await remember.isChecked(),true,'Checkbox hitbox must match illustrated square');
      assert.deepEqual(errors,[],'No page script errors expected');
      console.log('PASS teacher login alignment and keys at',width,height);
      await ctx.close();
    }
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});
