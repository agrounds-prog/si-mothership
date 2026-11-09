/* Run only against an isolated test server; never against the live classroom. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
  fs.mkdirSync('/tmp/match-illustrated-v2-browser',{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    for(const viewport of [{width:1440,height:900},{width:1280,height:800}]){
      const ctx=await browser.newContext({viewport});
      const page=await ctx.newPage();
      const pageErrors=[];
      page.on('pageerror',err=>pageErrors.push(err.message));
      await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded'});
      const login=await ctx.request.post(BASE+'/api/teacher/login',{data:{key:process.env.SI_TEST_PIN||'5030',remember:true}});
      assert.equal(login.status(),200,'isolated teacher authentication failed');
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>typeof openApp==='function'&&typeof state!=='undefined',{timeout:16000});
      await page.evaluate(()=>openApp('match'));
      await page.waitForFunction(()=>document.querySelector('#activitiesPanel.si-mp-match-studio .mcb-shell'),{timeout:10000});
      const match=page.locator('#activitiesPanel.si-mp-match-studio');
      for(const [selector,filename] of [
        ['.mcb-hero','header.svg'],['.mcb-board-tile','board_tile.svg'],
        ['.mcb-modes button.active','mode_active.svg'],
        ['#mcbSaveLaunch','button_green.svg']]){
        const el=match.locator(selector).first();
        assert.ok(await el.count(),`MATCH control missing: ${selector}`);
        const image=await el.evaluate(node=>getComputedStyle(node).backgroundImage);
        assert.ok(image.includes(filename),`Graphic ${filename} not applied to ${selector}: ${image}`);
      }
      const disabled=match.locator('button:disabled').first();
      if(await disabled.count()){
        const skin=await disabled.evaluate(el=>getComputedStyle(el).backgroundImage);
        assert.ok(skin.includes('button_disabled.svg'),'Disabled button not illustrated');
      }
      const viewportInfo=await match.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
      assert.ok(viewportInfo.scroll<=viewportInfo.client+16,`MATCH studio overflows horizontally: ${JSON.stringify(viewportInfo)}`);
      const assets=['header.svg','panel.svg','button_green.svg','button_blue.svg','board_tile.svg','mode_active.svg','gallery.svg'];
      for(const asset of assets){
        const resp=await ctx.request.get(BASE+'/match-v2-art/'+asset);
        assert.equal(resp.status(),200,`${asset} art route unavailable`);
        assert.ok((await resp.text()).includes('<svg'),`${asset} must contain actual SVG graphics`);
      }
      assert.equal(pageErrors.length,0,pageErrors.join(' | '));
      await match.screenshot({path:`/tmp/match-illustrated-v2-browser/match-creator-${viewport.width}.png`,animations:'disabled'});
      console.log('PASS MATCH illustrated graphic skins and native controls',viewport.width);
      await ctx.close();
    }
  }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
