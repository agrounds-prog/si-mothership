/* SI+ Spotlight slide: editor regions, persisted slide metadata, live controls.
 * Isolated CI classroom; never modifies production saved presentations.
 */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1450,height:960}});
 const errors=[];
 page.on("pageerror",error=>errors.push(String(error)));
 try{
  assert.equal((await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIPlusSpotlightSlide&&networkHydrated===true,null,{timeout:25000});
  await page.evaluate(()=>{state.activityRun=null;state.screen="classroom";openNewPresentation()});
  const image=await page.evaluate(()=>{
   const cv=document.createElement("canvas");cv.width=960;cv.height=720;
   const ctx=cv.getContext("2d");ctx.fillStyle="#146aa7";ctx.fillRect(0,0,960,540);
   return cv.toDataURL("image/png").split(",")[1];
  });
  await page.locator("#siPlusBatchImages").setInputFiles([{
   name:"Spotlight Slide.png",mimeType:"image/png",buffer:Buffer.from(image,"base64")
  }]);
  await page.waitForFunction(()=>state.presentationEditor?.draft.slides.length===1,null,{timeout:15000});
  await page.waitForFunction(()=>!!document.querySelector('#siPlusSlideType option[value="spotlight"]'),null,{timeout:12000});
  assert.equal(await page.locator("#siPlusSpotlightEditButton").isVisible(),false,
    "Legacy Spotlight creation button should be hidden on ordinary slides");
  await page.locator("#siPlusSlideType").selectOption("spotlight");
  await page.waitForSelector("#siPlusSpotlightEditor:not([hidden])");
  assert.equal(await page.locator("#siPlusSlideType").inputValue(),"spotlight");
  assert.equal(await page.locator('#siPlusSpotlightEditor [data-new-effect="outline"]').isVisible(),true,
    "Add Highlight must be visible in the active Spotlight Studio bundle");
  assert.equal(await page.locator('#siPlusSpotlightEditor [data-new-effect="dim"]').isVisible(),true,
    "Add Dim Area must be visible in the active Spotlight Studio bundle");
  const svg=page.locator("#siPlusSpotlightEditor .si-plus-spot-drawing");
  const box=await svg.boundingBox();assert.ok(box);
  const stageBox=await page.locator("#siPlusSpotlightEditor .si-plus-spot-stage").boundingBox();
  assert.ok(Math.abs(stageBox.width-box.width)<3,"Overlay must reach visible image right edge");
  const imageFit=await page.evaluate(()=>{
   const root=document.querySelector("#siPlusSpotlightEditor .si-plus-spot-stage");
   const image=root.querySelector("img"),drawing=root.querySelector("svg");
   const stageBox=root.getBoundingClientRect(),imageBox=image.getBoundingClientRect(),drawBox=drawing.getBoundingClientRect();
   return {natural:image.naturalWidth/image.naturalHeight,stage:stageBox.width/stageBox.height,
    picture:imageBox.width/imageBox.height,atBottom:Math.abs(imageBox.bottom-stageBox.bottom),
    overlayBottom:Math.abs(drawBox.bottom-imageBox.bottom)};
  });
  assert.ok(Math.abs(imageFit.stage-4/3)<.02,"4:3 image must be fully shown "+JSON.stringify(imageFit));
  assert.ok(Math.abs(imageFit.picture-imageFit.natural)<.02,"Image proportions must be preserved");
  assert.ok(imageFit.atBottom<3&&imageFit.overlayBottom<3,"Drawing surface must reach image bottom");

  assert.ok(Math.abs(stageBox.x-box.x)<3,"Overlay must begin at left edge");
  const hitCoverage=await page.evaluate(()=>{
   const svg=document.querySelector("#siPlusSpotlightEditor .si-plus-spot-drawing");
   const bounds=svg.getBoundingClientRect();
   const target=document.elementFromPoint(bounds.right-4,bounds.top+bounds.height*.4);
   return {hit:target?.classList?.contains("si-plus-spot-hit-area"),width:svg.querySelector(".si-plus-spot-hit-area")?.getAttribute("width")};
  });
  assert.equal(hitCoverage.hit,true,"Rightmost empty area must hit the drawing surface: "+JSON.stringify(hitCoverage));
  assert.equal(hitCoverage.width,"1000");
  await page.mouse.move(box.x+box.width*.25,box.y+box.height*.25);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.65,box.y+box.height*.66,{steps:7});
  assert.equal(await page.locator("#siPlusSpotlightEditor .si-plus-spot-preview").count(),1,"Drag preview should be visible before release");
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelectorAll("#siPlusSpotlightEditor .si-plus-spot-list button").length===1);
  assert.equal(await page.locator('[data-interaction="move"]').getAttribute("class").then(s=>s?.includes("active")),true,"Newly drawn highlight should immediately be movable");
  await page.locator('[data-new-effect="dim"]').click();
  // A single Add click must commit an independent region immediately,
  // without requiring a second drawing gesture or overwriting the first.
  await page.waitForFunction(()=>document.querySelectorAll("#siPlusSpotlightEditor .si-plus-spot-list button").length===2);
  assert.equal(await page.locator(".si-plus-spot-list button").count(),2);
  assert.equal(await page.locator(".si-plus-spot-list button").nth(1).innerText(),"Dim Area 2");
  // Ensure a region can reach the actual far-right edge of the image.
  await page.locator(".si-plus-spot-align-right").click();
  const rightEdge=await page.locator("#siPlusSpotlightEditor .si-plus-spot-drawing g[data-zone] > rect").nth(1).evaluate(el=>{
   const stage=el.ownerSVGElement;
   const shape=el.getBoundingClientRect(),canvas=stage.getBoundingClientRect();
   return {gap:canvas.right-shape.right,ratio:shape.width/canvas.width};
  });
  assert.ok(Math.abs(rightEdge.gap)<3,"Right edge must align with the image: "+JSON.stringify(rightEdge));
  assert.equal(await page.locator(".si-plus-spot-list button").count(),2,"Edge alignment must preserve every region");
  await page.locator(".si-plus-spot-full-image").click();
  const full=await page.locator("#siPlusSpotlightEditor .si-plus-spot-drawing g[data-zone] > rect").nth(1).evaluate(el=>[
   Number(el.getAttribute("x")),Number(el.getAttribute("y")),
   Number(el.getAttribute("width")),Number(el.getAttribute("height"))
  ]);
  assert.deepEqual(full,[0,0,1000,562.5],"Full Image must use all pixels");
  await page.locator('[data-bound="w"]').fill("65");
  await page.locator('[data-bound="w"]').dispatchEvent("change");
  await page.locator('[data-bound="x"]').fill("35");
  await page.locator('[data-bound="x"]').dispatchEvent("change");
  const atRight=await page.locator("#siPlusSpotlightEditor .si-plus-spot-drawing g[data-zone] > rect").nth(1).evaluate(el=>
   Number(el.getAttribute("x"))+Number(el.getAttribute("width")));
  assert.ok(Math.abs(atRight-1000)<0.01,"Bounds inputs must reach far-right image edge");
  await page.locator('[data-bound="x"]').fill("0");
  await page.locator('[data-bound="x"]').dispatchEvent("change");
  await page.locator('[data-bound="w"]').fill("100");
  await page.locator('[data-bound="w"]').dispatchEvent("change");
  const coverage=await page.locator("#siPlusSpotlightEditor .si-plus-spot-drawing g[data-zone] > rect").nth(1).evaluate(el=>
   [Number(el.getAttribute("x")),Number(el.getAttribute("width"))]);
  assert.deepEqual(coverage,[0,1000],"Numeric bounds must cover full image width");
  await page.locator(".si-plus-spot-undo").click();
  // The selected region's gold corner handles must change its dimensions.
  const beforeResize=Number(await page.locator("#siPlusSpotlightEditor .si-plus-spot-drawing g[data-zone] > rect").nth(1).getAttribute("width"));
  const corner=await page.locator('#siPlusSpotlightEditor [data-resize="ne"]').boundingBox();
  assert.ok(corner,"Selected region must expose a resize handle");
  await page.mouse.move(corner.x+corner.width/2,corner.y+corner.height/2);
  await page.mouse.down();
  // At x=0 a north-west drag cannot expand farther left. Resize from
  // the free right edge instead to test the actual resize gesture.
  await page.mouse.move(corner.x+corner.width/2+35,corner.y+corner.height/2-12,{steps:6});
  await page.mouse.up();
  const afterResize=Number(await page.locator("#siPlusSpotlightEditor .si-plus-spot-drawing g[data-zone] > rect").nth(1).getAttribute("width"));
  assert.ok(afterResize>beforeResize,"Corner dragging must expand the selected region");
  await page.locator(".si-plus-spot-undo").click();
  const targetRect=page.locator("#siPlusSpotlightEditor .si-plus-spot-drawing g[data-zone] > rect").nth(1);
  const targetBox=await targetRect.boundingBox();
  const canvasBox=await svg.boundingBox();
  await page.mouse.move(targetBox.x+targetBox.width/2,targetBox.y+targetBox.height/2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x+targetBox.width/2-50,targetBox.y+targetBox.height/2,{steps:5});
  await page.mouse.move(canvasBox.x+canvasBox.width+targetBox.width/2+12,targetBox.y+targetBox.height/2,{steps:8});
  await page.mouse.up();
  const edgeGap=await targetRect.evaluate(el=>el.ownerSVGElement.getBoundingClientRect().right-el.getBoundingClientRect().right);
  assert.ok(Math.abs(edgeGap)<3,"Region must reach right edge when dragged from its center, gap="+edgeGap);
  // Moving from within the image must also reach its right edge: no need
  // to move the pointer over the inspector panel or beyond the viewport.
  const nearEdgeBox=await targetRect.boundingBox();
  const nearCanvas=await svg.boundingBox();
  await page.mouse.move(nearEdgeBox.x+nearEdgeBox.width/2,nearEdgeBox.y+nearEdgeBox.height/2);
  await page.mouse.down();
  await page.mouse.move(nearCanvas.x+nearCanvas.width*.65,nearEdgeBox.y+nearEdgeBox.height/2,{steps:5});
  await page.mouse.move(nearCanvas.x+nearCanvas.width-3,nearEdgeBox.y+nearEdgeBox.height/2,{steps:8});
  await page.mouse.up();
  const snappedGap=await targetRect.evaluate(el=>el.ownerSVGElement.getBoundingClientRect().right-el.getBoundingClientRect().right);
  assert.ok(Math.abs(snappedGap)<3,"Dragging near the canvas edge should snap the region flush right: "+snappedGap);
  assert.equal(await page.locator('[data-interaction="move"]').getAttribute("class").then(s=>s?.includes("active")),true,"Second region should immediately be movable");
  // Put the explicitly selected highlight above any overlapping dim area
  // before dragging it, as the real editor now does.
  await page.locator(".si-plus-spot-list button").first().click();
  const region=page.locator("#siPlusSpotlightEditor .si-plus-spot-drawing g[data-zone] > rect").last();
  const before=Number(await region.getAttribute("x"));
  const box2=await region.boundingBox();
  assert.ok(box2);
  await page.mouse.move(box2.x+box2.width/2,box2.y+box2.height/2);
  await page.mouse.down();
  await page.mouse.move(box2.x+box2.width/2+20,box2.y+box2.height/2+10,{steps:5});
  await page.mouse.up();
  assert.equal(await page.locator(".si-plus-spot-list button").count(),2);
  assert.ok(Number(await region.getAttribute("x"))>before);
  // Undo must restore a repositioned region, not delete it.
  await page.locator(".si-plus-spot-undo").click();
  assert.equal(await page.locator(".si-plus-spot-list button").count(),2,"Undoing a move must preserve both regions");
  assert.ok(Math.abs(Number(await region.getAttribute("x"))-before)<0.5);

  assert.equal(await page.locator(".si-plus-spot-undo").isEnabled(),true);
  assert.match(await page.locator(".si-plus-spot-state").innerText(),/2 regions/);

  await page.locator(".si-plus-spot-list button").first().click();
  await page.locator("#siPlusSpotName").fill("Safe Area");
  await page.locator("#siPlusSpotName").dispatchEvent("change");
  await page.locator("#siPlusSpotEffect").selectOption("dim");
  await page.locator("#siPlusSpotColor").selectOption("green");
  await page.locator(".si-plus-spot-save").click();
  await page.locator("#siPlusSpotlightEditButton").click();
  await page.waitForSelector("#siPlusSpotlightEditor:not([hidden])");
  assert.equal(await page.locator(".si-plus-spot-list button").count(),2,"Both regions must survive closing and reopening editor");
  assert.equal(await page.locator(".si-plus-spot-list button").nth(1).innerText(),"Dim Area 2");
  await page.locator('[data-new-effect="outline"]').click();
  await page.waitForFunction(()=>document.querySelectorAll("#siPlusSpotlightEditor .si-plus-spot-list button").length===3);
  // "Draw More" allows new regions even where large dim regions overlap.
  // The entire image stays drawable, including the bottom and far-right edge.
  await page.locator('[data-interaction="add"]').click();
  await svg.scrollIntoViewIfNeeded();
  const fullCanvas=await svg.boundingBox();
  await page.mouse.move(fullCanvas.x+fullCanvas.width*.87,fullCanvas.y+fullCanvas.height*.06);
  await page.mouse.down();
  await page.mouse.move(fullCanvas.x+fullCanvas.width*.98,fullCanvas.y+fullCanvas.height*.18,{steps:6});
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelectorAll("#siPlusSpotlightEditor .si-plus-spot-list button").length===4);
  const newestX=Number(await page.locator("#siPlusSpotlightEditor .si-plus-spot-drawing g[data-zone] > rect").last().getAttribute("x"));
  assert.ok(newestX>=850,"The far-right image must accept newly drawn regions");
  await page.locator(".si-plus-spot-undo").click();
  assert.equal(await page.locator(".si-plus-spot-list button").count(),3);
  await page.locator(".si-plus-spot-save").click();
  const draft=await page.evaluate(()=>state.presentationEditor.draft.slides[0]);
  assert.equal(draft.type,"instruction");
  assert.equal(draft.siSpotlight.enabled,true);
  assert.equal(draft.siSpotlight.zones[0].name,"Safe Area");
  assert.equal(draft.siSpotlight.zones[0].effect,"dim");
  assert.equal(draft.siSpotlight.zones.length,3,"All three regions must be retained after reopening and saving");
  assert.equal(draft.siSpotlight.zones[1].effect,"dim","New dim region must retain its effect");
  await page.locator("#presentationTitleInput").fill("Integrated Spotlight Regression");
  await page.locator("#savePresentationBtn").click();
  await page.waitForFunction(()=>state.presentationEditor===null,null,{timeout:20000});
  const storage=(await (await page.request.get(BASE+"/api/storage")).json()).items["siMothership.presentations.v1"];
  const persisted=JSON.parse(storage).find(x=>x.deckTitle==="Integrated Spotlight Regression");
  assert.ok(persisted,"Saved presentation missing");
  assert.equal(persisted.slides[0].siSpotlight.zones[0].name,"Safe Area");
  assert.equal(persisted.slides[0].siSpotlight.zones.length,3,"All three regions must survive presentation save");
  assert.equal(persisted.slides[0].siSpotlight.zones[1].effect,"dim");
  // Exercise teacher live controls and keep the native shared-screen content.
  await page.evaluate(id=>{
   const deck=state.activities.find(a=>a.id===id);
   state.activityRun={activityId:id,phase:"running",slideIndex:0,runToken:"si-spotlight-regression",responses:{}};
   state.screen="activity";render();
  },persisted.id);
  await page.waitForSelector("#siPlusSpotlightLiveControls",{timeout:15000});
  // Each deliberate Spotlight reveal starts hidden and uses the saved geometry.
  const finalRegions=await page.evaluate(()=>{
   const deck=state.activities.find(a=>a.id===state.activityRun.activityId);
   return deck.slides[0].siSpotlight.zones.map(z=>({id:z.id,x:z.x,y:z.y,w:z.w,h:z.h}));
  });
  assert.equal(finalRegions.length,3);
  assert.equal(await page.locator('#siPlusSpotlightLiveControls .si-plus-spotlight-target[aria-pressed="true"]').count(),0);
  await page.evaluate(()=>{
   window.__spotlightImageBeforeReveal=document.querySelector("#mirrorContent .si-plus-viewport-image > img");
  });
  await page.locator("#siPlusSpotlightLiveControls .si-plus-spotlight-target").first().click();
  assert.equal(await page.evaluate(()=>
   window.__spotlightImageBeforeReveal===document.querySelector("#mirrorContent .si-plus-viewport-image > img")),
   true,"Region reveal must not rebuild the slide image and resize overlays");
  await page.waitForFunction(()=>state.activityRun?.siSpotlightVisible?.ids?.length===1);
  const savedRect=await page.evaluate(()=>{
   const markup=sharedMarkup("big");
   const shape=markup.match(/<rect[^>]*stroke-width="5"[^>]*>/);
   return shape?.[0]||"";
  });
  assert.ok(savedRect.includes('width="'+finalRegions[0].w+'"'));
  assert.ok(savedRect.includes('height="'+finalRegions[0].h+'"'));
  await page.waitForTimeout(1100);
  const afterRefresh=await page.evaluate(()=>{
   const shape=sharedMarkup("big").match(/<rect[^>]*stroke-width="5"[^>]*>/);
   return shape?.[0]||"";
  });
  assert.equal(afterRefresh,savedRect,"Saved Spotlight square must not resize across refreshes");
  const live=await page.evaluate(()=>({ids:state.activityRun.siSpotlightVisible.ids,markup:sharedMarkup("big")}));
  assert.equal(live.ids.length,1);
  assert.match(live.markup,/si-plus-viewport-image/);
  await page.waitForFunction(()=>sharedMarkup("big").includes("si-plus-spotlight-inline"),null,{timeout:7000});
  const actual=await page.evaluate(()=>sharedMarkup("big"));
  assert.ok(actual.includes("si-plus-spotlight-inline"),"Projected slide must carry its Spotlight graphics");
  const plain=await page.evaluate(()=>{const deck=state.activities.find(a=>a.id===state.activityRun.activityId);deck.slides.push({...deck.slides[0],id:"plain",siSpotlight:undefined});state.activityRun.slideIndex=1;const text=sharedMarkup("big");state.activityRun.slideIndex=0;deck.slides.pop();return text});
  assert.ok(!plain.includes("si-plus-spotlight-inline"),"Ordinary slides should not show Spotlight");

  const probe=await page.evaluate(()=>{
   const image=document.querySelector("#sharedContent .si-plus-viewport-image");
   const mirror=document.querySelector("#mirrorContent .si-plus-viewport-image");
   const shared=sharedMarkup("big");
   const preview=activitySharedMarkup(true);
   return {
    sharedLength:shared.length,sharedImageCount:(shared.match(/si-plus-viewport-image/g)||[]).length,
    previewLength:preview.length,previewImageCount:(preview.match(/si-plus-viewport-image/g)||[]).length,
    sharedFirst:shared.slice(0,450),sharedLast:shared.slice(-500),
    imageTag:image?.tagName,mirrorTag:mirror?.tagName,
    overlayCount:document.querySelectorAll(".si-plus-spotlight-inline").length,
    parent:image?.parentElement?.className||"",screen:state.screen,
    rendererType:typeof sharedMarkup,
   };
  });
  console.log("SPOTLIGHT RENDER PROBE",JSON.stringify(probe));
  // Verify actual projector overlay and image fit, rather than merely
  // checking that the native shared-screen markup still contains an image.
  await page.evaluate(()=>{
   document.querySelector("#teacher").classList.remove("active");
   document.querySelector("#shared").classList.add("active");
   document.body.classList.add("role-shared");
   renderPublic();
  });
  await page.waitForFunction(()=>{
   const image=document.querySelector("#sharedContent .si-plus-viewport-image > img");
   const overlay=document.querySelector("#sharedContent .si-plus-spotlight-inline");
   const floating=document.querySelector(".si-plus-spotlight-overlay");
   return !!image&&(
      !!overlay?.querySelector("rect[stroke],ellipse[stroke]")||
      !!floating?.querySelector("rect[stroke],ellipse[stroke]"));
  },null,{timeout:12000});
  await page.waitForFunction(()=>{
   const img=document.querySelector("#sharedContent .si-plus-viewport-image > img");
   const svg=document.querySelector("#sharedContent .si-plus-spotlight-inline");
   if(!img||!svg||!img.naturalWidth)return false;
   const rect=img.getBoundingClientRect(),layer=svg.getBoundingClientRect();
   const scale=Math.min(rect.width/img.naturalWidth,rect.height/img.naturalHeight);
   const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
   return Math.abs(layer.width-w)<3&&Math.abs(layer.height-h)<3&&
    Math.abs(layer.x-(rect.x+(rect.width-w)/2))<3&&
    Math.abs(layer.y-(rect.y+(rect.height-h)/2))<3;
  },null,{timeout:9000});
  const projector=await page.evaluate(()=>{
   const img=document.querySelector("#sharedContent .si-plus-viewport-image > img");
   const inline=document.querySelector("#sharedContent .si-plus-spotlight-inline");
   const floating=document.querySelector(".si-plus-spotlight-overlay");
   const ov=inline||floating;
   const bounds=img.getBoundingClientRect(),layer=ov.getBoundingClientRect();
   const fit=getComputedStyle(img).objectFit;
   const factor=fit==="cover"?Math.max(bounds.width/img.naturalWidth,bounds.height/img.naturalHeight):Math.min(bounds.width/img.naturalWidth,bounds.height/img.naturalHeight);
   const width=["contain","scale-down","cover"].includes(fit)?img.naturalWidth*factor:bounds.width;
   const height=["contain","scale-down","cover"].includes(fit)?img.naturalHeight*factor:bounds.height;
   return {mode:inline?"inline":"floating",image:{x:bounds.x+(bounds.width-width)/2,y:bounds.y+(bounds.height-height)/2,w:width,h:height},
     overlay:{x:layer.x,y:layer.y,w:layer.width,h:layer.height}};
  });
  assert.ok(Math.abs(projector.image.w-projector.overlay.w)<3,JSON.stringify(projector));
  assert.ok(Math.abs(projector.image.h-projector.overlay.h)<3,JSON.stringify(projector));
  assert.ok(Math.abs(projector.image.x-projector.overlay.x)<3,JSON.stringify(projector));
  assert.ok(Math.abs(projector.image.y-projector.overlay.y)<3,JSON.stringify(projector));
  // Recreate the projector image with an unfitted SVG, as a remote teacher
  // toggle does. The overlay must be aligned *before the next paint*,
  // not 350ms later when Spotlight's fallback timer runs.
  const firstPaint=await page.evaluate(async()=>{
   const old=document.querySelector("#sharedContent .si-plus-viewport-image");
   const replacement=old.cloneNode(true);
   const image=replacement.querySelector(":scope > img");
   const svg=replacement.querySelector(".si-plus-spotlight-inline");
   if(!image||!svg)throw Error("Missing inline projector overlay");
   await image.decode();
   svg.removeAttribute("data-fit-ready");
   svg.style.cssText="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible";
   // The classroom may repaint while the replacement image decodes;
   // swap the currently connected stage, not an earlier detached node.
   const mounted=document.querySelector("#sharedContent .si-plus-viewport-image");
   if(!mounted?.isConnected)throw Error("Projector stage disconnected before test swap");
   mounted.replaceWith(replacement);
   await new Promise(resolve=>requestAnimationFrame(resolve));
   const bounds=image.getBoundingClientRect(),overlay=svg.getBoundingClientRect();
   const scale=Math.min(bounds.width/image.naturalWidth,bounds.height/image.naturalHeight);
   const expected={x:bounds.x+(bounds.width-image.naturalWidth*scale)/2,
    y:bounds.y+(bounds.height-image.naturalHeight*scale)/2,
    w:image.naturalWidth*scale,h:image.naturalHeight*scale};
   return {expected,actual:{x:overlay.x,y:overlay.y,w:overlay.width,h:overlay.height},
    ready:svg.dataset.fitReady,visibility:getComputedStyle(svg).visibility,
    connected:replacement.isConnected,current:document.querySelector("#sharedContent .si-plus-viewport-image")===replacement};
  });
  assert.equal(firstPaint.ready,"true","Projector SVG must be positioned by the first frame: "+JSON.stringify(firstPaint));
  assert.equal(firstPaint.visibility,"visible","Only fitted projector overlays may be painted");
  for(const key of ["x","y","w","h"]){
   assert.ok(Math.abs(firstPaint.expected[key]-firstPaint.actual[key])<3,
    "Projector overlay moved after first paint: "+JSON.stringify(firstPaint));
  }
  assert.deepEqual(errors,[]);
  console.log("PASS: Spotlight zones save to SI+ slides and live teacher controls toggle them");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
