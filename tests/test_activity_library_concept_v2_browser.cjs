/* Chromium regression for approved Activity Library concept V2.
   Inspect actual DOM geometry, artwork, paging and live app actions. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const base=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
 fs.mkdirSync('/tmp/activity-library-v2-screens',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const login=await page.request.post(base+'/api/teacher/login',{data:{key:'5030',remember:true}});
  assert.equal(login.status(),200,'Teacher login');
  const response=await page.goto(base+'/?role=teacher',{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>typeof render==='function'&&typeof state!=='undefined'&&document.body.classList.contains('si-v80-dashboard'),{timeout:16000});
  const activate=()=>page.evaluate(()=>{state.activeApp=null;state.screen='activities';render()});
  await activate();
  const root=page.locator('#activitiesPanel.si-v2-library');
  await root.waitFor({state:'visible',timeout:14000});
  await page.waitForFunction(()=>!!document.querySelector('#activitiesPanel.si-v2-library .si-v2-pagination'),{timeout:12000});
  const get=()=>page.evaluate(()=>{
    const root=document.querySelector('#activitiesPanel.si-v2-library');
    const cards=[...root.querySelectorAll('.activity-catalog-grid .real-app-card')];
    const visible=cards.filter(c=>!c.classList.contains('si-v2-page-hidden'));
    const wells=visible.map(c=>{const rect=c.querySelector('.act-icon')?.getBoundingClientRect();return {name:c.querySelector('h3')?.textContent.trim(),w:rect?.width,h:rect?.height};});
    const first=visible[0],card=first?.getBoundingClientRect();
    const board=cards.find(c=>c.querySelector('[data-open-app="board"]'));
    const sample=first?.querySelector('button[data-open-app]');
    return {cards:cards.length,visible:visible.length,
      label:root.querySelector('.si-v2-page-label')?.textContent,
      icons:wells,cardHeight:card?.height,
      frame:getComputedStyle(first).backgroundImage,
      button:getComputedStyle(sample).backgroundImage,
      boardArt:board?.querySelector('.si-v2-board-image')?.getAttribute('src'),
      boardDecoded:board?.querySelector('.si-v2-board-image')?.naturalWidth>0,
      shortcutCount:visible.filter(c=>!!c.querySelector('[data-add-app],[data-manage-shortcut],[data-assign-app]')).length,
      labelOverlaps:visible.map(c=>{
        const icon=c.querySelector('.act-icon')?.getBoundingClientRect();
        const title=c.querySelector('h3')?.getBoundingClientRect();
        const subtitle=c.querySelector('.app-meta')?.getBoundingClientRect();
        return {name:c.querySelector('h3')?.textContent.trim(),titleHeight:title?.height||0,
          titleAfterIcon:!!title&&!!icon&&title.top>=icon.bottom-2,
          metaAfterTitle:!!subtitle&&!!title&&subtitle.top>=title.bottom-2};
      }),
      xOverflow:root.scrollWidth-root.clientWidth,
      pagerNextDisabled:root.querySelector('.si-v2-next')?.disabled,
      pagerPrevDisabled:root.querySelector('.si-v2-prev')?.disabled};
  });
  // Every existing app receives its own standalone cinematic SVG image.
  await page.waitForFunction(()=>{
    const cards=[...document.querySelectorAll('#activitiesPanel.si-v2-library .activity-catalog-grid .real-app-card')];
    return cards.length>=20&&cards.every(c=>{
      const well=c.querySelector('.act-icon'),art=well?.querySelector('img.si-v3-illustration');
      return !!art&&art.complete&&art.naturalWidth>0&&well.classList.contains('si-v3-art-ready');
    });
  },{timeout:20000});
  // Let the short illustration opacity transition finish before asserting
  // computed styles; SVG decoding alone completes before the fade reaches 1.
  await page.waitForFunction(()=>{
    const images=[...document.querySelectorAll('#activitiesPanel.si-v2-library .si-v3-illustration')];
    return images.length>=21&&images.every(img=>Number(getComputedStyle(img).opacity)>.99);
  },{timeout:5000});
  const renderAssets=await page.evaluate(()=>{
    return [...document.querySelectorAll('#activitiesPanel.si-v2-library .activity-catalog-grid .real-app-card')].map(c=>{
      const name=c.querySelector('h3')?.textContent.trim();
      const frame=c.querySelector('.act-icon'),img=frame?.querySelector('.si-v3-illustration');
      return {name,src:img?.getAttribute('src'),decoded:img?.naturalWidth>0,
        visible:img?getComputedStyle(img).opacity:'0',
        fitting:img?getComputedStyle(img).objectFit:'none',count:frame?.querySelectorAll('.si-v3-illustration').length};
    });
  });
  console.log('21 cinematic visual assets:',JSON.stringify(renderAssets));
  assert.equal(renderAssets.length,21,'All activity illustrations present');
  assert.ok(renderAssets.every(x=>x.decoded&&Number(x.visible)>=.95&&x.fitting==='cover'&&x.count===1),'Missing/hidden new illustration');
  assert.ok(renderAssets.find(x=>x.name==='BOARD')?.src.endsWith('/board.svg'),'BOARD writing illustration preserved');
  assert.ok(renderAssets.find(x=>x.name==='SIGNAL SEQUENCE')?.src.endsWith('/signal-sequence.svg'),'Memory-wheel artwork preserved');
  // Copy-only polish: no native full-description hover tooltip, no clipped
  // subtitles, and all original text is available as an accessible description.
  const textAudit=await page.evaluate(()=>{
    return [...document.querySelectorAll('#activitiesPanel.si-v2-library .activity-catalog-grid .real-app-card')].map(card=>{
      const meta=card.querySelector('.app-meta');
      const open=card.querySelector('button[data-open-app]');
      return {
        app:open?.dataset.openApp,name:card.querySelector('h3')?.textContent.trim(),
        subtitle:meta?.textContent.trim(),subtitleWidth:meta?.clientWidth,
        subtitleScrollWidth:meta?.scrollWidth,
        tooltip:card.getAttribute('title'),
        description:card.getAttribute('aria-description'),
        buttonDescription:open?.getAttribute('aria-description'),
        cardHeight:card.getBoundingClientRect().height
      };
    });
  });
  console.log('Activity Library copy audit:',JSON.stringify(textAudit));
  assert.equal(textAudit.length,21);
  assert.ok(textAudit.every(x=>x.subtitle&&x.tooltip===null&&x.description&&x.buttonDescription),
    'No oversized native browser tooltip; preserve accessible full descriptions');
  assert.ok(textAudit.every(x=>x.subtitleScrollWidth<=x.subtitleWidth+2),
    'Some activity subtitles still truncate: '+JSON.stringify(textAudit.filter(x=>x.subtitleScrollWidth>x.subtitleWidth+2)));
  assert.ok(textAudit.every(x=>Math.abs(x.cardHeight-204)<2),
    'Card sizing must not change for text-only polish');
  assert.equal(textAudit.find(x=>x.app==='board').subtitle,'Write • Draw • Share');
  assert.equal(textAudit.find(x=>x.app==='signal-sequence').subtitle,'Watch • Repeat • Remember');
  const a=await get();
  console.log('Library V2 page one:',JSON.stringify(a));
  assert.ok(a.cards>=20,'Expected full existing activity registry');
  assert.equal(a.visible,15,'Desktop page one shows 15 cards');
  assert.equal(a.label,'Page 1 of 2');
  assert.ok(a.frame.includes('card-frame.svg'),'Card artwork not applied');
  assert.ok(a.button.includes('open-button.svg'),'Graphical Open button not applied');
  assert.ok(a.boardArt?.includes('board-whiteboard.svg')&&a.boardDecoded,'BOARD must show shared whiteboard art');
  assert.ok(a.shortcutCount===15,'Shortcut controls preserved');
  assert.ok(Math.max(...a.icons.map(x=>x.h))-Math.min(...a.icons.map(x=>x.h))<=2,'Artwork frame heights inconsistent');
  assert.ok(a.xOverflow<=14,'Horizontal overflow on desktop');
  assert.ok(a.labelOverlaps.every(x=>x.titleHeight>=18&&x.titleAfterIcon&&x.metaAfterTitle),'Card title clipping: '+JSON.stringify(a.labelOverlaps));
  await root.screenshot({path:'/tmp/activity-library-v2-screens/1440-page-1.png',animations:'disabled'});
  await root.locator('.si-v2-next').click();
  const b=await get();
  console.log('Library V2 page two:',JSON.stringify(b));
  assert.equal(b.visible,a.cards-15,'Remaining activities should appear on page two');
  assert.equal(b.label,'Page 2 of 2');
  assert.ok(b.icons.some(x=>x.name==='SIGNAL SEQUENCE'),'Signal Sequence must remain available');
  assert.ok(Math.max(...b.icons.map(x=>x.h))-Math.min(...b.icons.map(x=>x.h))<=2,'Page two thumbnails differ in height');
  assert.ok(b.labelOverlaps.every(x=>x.titleHeight>=18&&x.titleAfterIcon&&x.metaAfterTitle),'Page-two title clipping: '+JSON.stringify(b.labelOverlaps));
  await root.screenshot({path:'/tmp/activity-library-v2-screens/1440-page-2.png',animations:'disabled'});
  await root.locator('.si-v2-prev').click();
  const more=root.locator('.si-v2-extras-toggle');
  await more.click();
  assert.equal(await more.getAttribute('aria-expanded'),'true','Recent & Saved toggle');
  assert.ok(await root.locator('.activity-library-shelves').isVisible(),'Recent/saved groups remain accessible');
  await more.click();
  assert.equal(await more.getAttribute('aria-expanded'),'false');
  await root.locator('#activityLibrarySearch').fill('bingo');
  await page.waitForFunction(()=>{
    const cards=[...document.querySelectorAll('#activitiesPanel .activity-catalog-grid .real-app-card')];
    return cards.length===1&&cards[0].querySelector('h3')?.textContent.trim()==='BINGO';
  },{timeout:10000});
  const searchResult=await get();
  assert.equal(searchResult.visible,1,'Search must retain original filtering');
  assert.ok(await root.locator('[data-open-app="bingo"]').count(),'Original Bingo open action retained');
  await root.locator('#activityLibrarySearch').fill('');
  await page.waitForFunction(()=>document.querySelectorAll('#activitiesPanel .activity-catalog-grid .real-app-card').length>=20,{timeout:12000});
  await page.setViewportSize({width:900,height:850});
  await page.waitForTimeout(250);
  const narrow=await get();
  assert.equal(narrow.visible,9,'Narrow library should show 9 per page');
  assert.ok(narrow.xOverflow<=14,'Horizontal overflow at 900px');
  await root.screenshot({path:'/tmp/activity-library-v2-screens/900-page-1.png',animations:'disabled'});
  assert.deepEqual(errors,[],'No JavaScript errors');
  console.log('PASS approved Activity Library concept V2: thumbnails, two pages, search, shortcuts, recent/presets, responsive');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
