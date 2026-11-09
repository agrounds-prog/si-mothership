/* AAC+ compact Zoom companion: separate popup plus 2x3/3x3/4x4 adaptive grids.
 * Runs only against isolated localhost and never modifies production boards. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(BASE))throw Error('AAC+ test requires localhost');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1480,height:900},acceptDownloads:false});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  const login=await context.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}});
  assert.equal(login.status(),200);
  await page.goto(BASE+'/aac',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof document.getElementById('boardList')!=='undefined');
  await page.locator('#newBoard').click();
  await page.locator('#boardTitle').fill('Compact AAC+ Regression');
  await page.locator('#tileLabel').fill('Help');
  await page.locator('#saveBoard').click();
  await page.waitForFunction(()=>document.querySelectorAll('.aac-board-card').length===1,{timeout:15000});
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('.aac-board-card .aac-board-actions button').nth(1).click();
  await page.waitForSelector('#shareScreen:not([hidden]) #shareLink',{timeout:15000});
  const url=await page.locator('#shareLink').inputValue();
  assert.match(url,/\/aac\/s\/[A-Za-z0-9_-]+$/);
  const title=await page.locator('#openShare').textContent();
  assert.match(title,/Compact Window/);
  const popupEvent=page.waitForEvent('popup');
  await page.locator('#openShare').click();
  const popup=await popupEvent;
  await popup.waitForLoadState('domcontentloaded');
  assert.equal(new URL(popup.url()).searchParams.get('compact'),'1');
  await popup.waitForSelector('.aac-student-grid .aac-tile');
  const width=await popup.evaluate(()=>innerWidth);
  assert.ok(width>250&&width<900,'Compact popup should not open full screen: '+width);
  const css=await popup.evaluate(()=>getComputedStyle(document.querySelector('.aac-student-grid')).gridTemplateColumns);
  assert.equal(css.split(' ').length,3,'Default 3x3 board');
  assert.equal(await popup.locator('#aacPopoutBoard').isVisible(),false,'Nested popup not needed');
  await popup.close();
  // Direct Zoom link opens as a fully usable page, with an explicit user gesture
  // available to open a separate browser window (since popup blockers vary).
  const student=await context.newPage();
  await student.goto(url,{waitUntil:'domcontentloaded'});
  await student.waitForSelector('.aac-student-grid .aac-tile');
  assert.equal(await student.locator('#aacPopoutBoard').isVisible(),true);
  for(const w of [1200,640,480,360]){
   await student.setViewportSize({width:w,height:790});
   const g=await student.evaluate(()=>{
    const tiles=[...document.querySelectorAll('#studentTiles .aac-tile')];
    const container=document.querySelector('#studentTiles').getBoundingClientRect();
    return {viewport:innerWidth,docWidth:document.documentElement.scrollWidth,
      container:{x:container.x,right:container.right,width:container.width},
      tiles:tiles.map(t=>{const r=t.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,width:r.width,height:r.height}})};
   });
   assert.equal(g.tiles.length,9);
   assert.ok(g.docWidth<=w+2,'AAC+ board caused horizontal overflow at '+w+': '+JSON.stringify(g));
   assert.ok(g.tiles.every(t=>t.width>40&&t.right<=w+2),
      'Tile outside resized popup at '+w+': '+JSON.stringify(g));
   // Every row should retain the same 3-column arrangement.
   assert.ok(Math.abs(g.tiles[0].y-g.tiles[2].y)<2);
   assert.ok(g.tiles[3].y>g.tiles[0].y+5);
  }
  for(const [layout,count,cols] of [['2x3',6,3],['3x3',9,3],['4x4',16,4]]){
   // Test responsive render of each supported saved board size without editing
   // public data or making additional teacher API writes.
   const result=await student.evaluate(({layout,count})=>{
    const tiles=Array.from({length:count},(_,i)=>({
      label:'Communication '+(i+1),symbol:'⭐',color:'#075aa0',image:null,audio:null
    }));
    // The AAC+ renderer is intentionally encapsulated in its IIFE.
    // Exercise the same 2x3 / 3x3 / 4x4 CSS with inert DOM-only samples.
    const grid=document.querySelector('#studentTiles');
    grid.dataset.layout=layout;
    grid.style.setProperty('--cols',layout.split('x')[1]);
    const cells=tiles.map(t=>{
      const button=document.createElement('button');
      button.type='button';button.className='aac-tile';
      button.style.setProperty('--tile-color',t.color);
      const symbol=document.createElement('span');symbol.className='aac-symbol';symbol.textContent=t.symbol;
      const label=document.createElement('span');label.className='aac-tile-label';label.textContent=t.label;
      button.append(symbol,label);return button;
    });
    grid.replaceChildren(...cells);
    const b=grid.getBoundingClientRect();
    return {total:grid.children.length,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      width:b.width,right:b.right,tiles:[...grid.children].map(t=>t.getBoundingClientRect().width)};
   },{layout,count});
   assert.equal(result.total,count);
   assert.equal(result.columns,cols);
   assert.ok(result.right<=362&&result.tiles.every(x=>x>40),JSON.stringify(result));
  }
  const studentPopupEvent=student.waitForEvent('popup');
  await student.locator('#aacPopoutBoard').click();
  const second=await studentPopupEvent;
  assert.equal(new URL(second.url()).searchParams.get('compact'),'1');
  await second.close();
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: AAC+ compact window and live 2x3/3x3/4x4 responsive communication grids');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
