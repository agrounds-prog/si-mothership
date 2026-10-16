/* Bingo library upload regression — isolated localhost only.
   Tests real file chooser, multiple images, bad image data, and failed remote saves.
   Never mutates production classroom state. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE))
  throw new Error('Bingo upload regression must run against an isolated localhost server');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:1360,height:900}});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 try{
  const login=await ctx.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}});
  assert.equal(login.status(),200,'Local teacher login');
  const opened=await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  assert.equal(opened.status(),200);
  await page.waitForFunction(()=>typeof bbsWire==='function'&&typeof renderActivities==='function'&&typeof networkHydrated!=='undefined'&&networkHydrated===true,null,{timeout:20000});
  const initial=await page.evaluate(()=>{
    state.screen='activities';
    state.activeApp='bingo';
    state.activityRun=null;
    render();
    return {exists:!!document.querySelector('#bbsUpload'),hasMultiple:document.querySelector('#bbsUploadInput')?.multiple,
      accepts:document.querySelector('#bbsUploadInput')?.accept,original:gameImageLibrary.length};
  });
  assert.equal(initial.exists,true,'Bingo image-library uploader present');
  assert.equal(initial.hasMultiple,true,'Multiple selection enabled');
  assert.match(initial.accepts,/image/);
  const chooser=page.waitForEvent('filechooser');
  await page.locator('#bbsUpload').click();
  const chooserResult=await chooser;
  assert.equal(chooserResult.isMultiple(),true,'Upload button opens a multi-file chooser');

  const sample=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=12;canvas.height=12;
    const g=canvas.getContext('2d');g.fillStyle='#a16ce8';g.fillRect(0,0,12,12);
    return {png:canvas.toDataURL('image/png'),jpg:canvas.toDataURL('image/jpeg',0.9)};
  });
  const data=url=>Buffer.from(url.split(',')[1],'base64');
  await page.locator('#bbsUploadInput').setInputFiles([
    {name:'si-upload-regression-purple.png',mimeType:'image/png',buffer:data(sample.png)},
    {name:'si-upload-regression-purple.jpg',mimeType:'image/jpeg',buffer:data(sample.jpg)}
  ]);
  await page.waitForFunction(n=>gameImageLibrary.length===n+2&&
    document.querySelectorAll('.bbs-library-entry').length>=2,initial.original,{timeout:20000});
  const imported=await page.evaluate(()=>{
    const names=gameImageLibrary.slice(-2).map(x=>x.name);
    return {names,status:document.querySelector('#bbsLibraryStatus')?.textContent,
      count:gameImageLibrary.length,selected:document.querySelector('.bbs-picked strong')?.textContent,
      inputLength:document.querySelector('#bbsUploadInput')?.files.length};
  });
  assert.ok(imported.names.every(n=>n.includes('si upload regression purple')),JSON.stringify(imported));
  assert.match(imported.status,/2 pictures saved to library/);
  assert.equal(imported.inputLength,0,'File picker reset for next upload');
  assert.ok(imported.selected.includes('0 /'),'Existing board selection is unchanged');
  // Confirm server-backed persistence, without ever modifying production.
  const snapshot=await ctx.request.get(BASE+'/api/storage');
  assert.equal(snapshot.status(),200);
  const stored=(await snapshot.json()).items['siMothership.imageLibrary.v1'];
  assert.ok(stored&&JSON.parse(stored).length===initial.original+2,'Pictures persisted to isolated server');

  await page.locator('#bbsUploadInput').setInputFiles([
    {name:'invalid-photo.jpg',mimeType:'image/jpeg',buffer:Buffer.from('not a real image')}
  ]);
  await page.waitForFunction(()=>/No pictures could be opened/.test(document.querySelector('#bbsLibraryStatus')?.textContent||''),null,{timeout:12000});
  assert.equal(await page.evaluate(()=>gameImageLibrary.length),initial.original+2,
    'Bad image cannot erase or corrupt the library');

  await page.route('**/api/storage',async route=>{
    if(route.request().method()==='POST')
      await route.fulfill({status:503,body:'Simulated storage outage'});
    else await route.continue();
  });
  await page.locator('#bbsUploadInput').setInputFiles([
    {name:'should-not-appear.png',mimeType:'image/png',buffer:data(sample.png)}
  ]);
  await page.waitForFunction(()=>/Upload could not be saved to Mothership/.test(
    document.querySelector('#bbsLibraryStatus')?.textContent||''),null,{timeout:15000});
  assert.equal(await page.evaluate(()=>gameImageLibrary.length),initial.original+2,
    'Failed remote save leaves library unchanged');
  await page.unroute('**/api/storage');
  assert.equal(errors.length,0,'No browser runtime errors: '+errors.join('\n'));
  console.log('Bingo image uploads: picker, 2-image batch, server persistence, corrupt file, outage rollback PASS');
 }finally{await ctx.close();await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});