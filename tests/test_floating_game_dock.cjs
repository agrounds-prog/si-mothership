/* Floating Mission Control must keep keepVisible in the same lexical
   scope as tick. The old nested declaration caused a runtime prototype error
   only after a game had been opened by the teacher. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("bingo-board-studio.js","utf8");
const start=source.indexOf("/* Universal teacher controls:");
const end=source.indexOf("/* CREW SURVEY STUDIO v2",start);
assert.ok(start>=0&&end>start,"Dock script present");
const dock=source.slice(start,end);
const declaration=dock.indexOf("function keepVisible(){");
const init=dock.indexOf("function init(){");
const tick=dock.indexOf("function tick(){");
assert.ok(declaration>=0 && declaration<init && init<tick,
  "keepVisible must be outside init() so tick() can reach it");
assert.equal(dock.split("function keepVisible(){").length-1,1,
  "Only one shared helper exists");
assert.match(dock.slice(tick),/keepVisible\(\);/,
  "Game tick keeps the floating controls inside the viewport");
// Run the exact production helper in isolation and verify it bounds the dock.
const declarationEnd=dock.indexOf("\nfunction init(){",declaration);
assert.ok(declarationEnd>declaration);
const rect={left:980,top:770,width:250,height:150};
const mocked={
  dock:{
    classList:{contains:()=>false},
    getBoundingClientRect:()=>({...rect}),
    style:{}
  },
  innerWidth:1000,innerHeight:800,Math
};
vm.runInNewContext(dock.slice(declaration,declarationEnd)+"\nkeepVisible();",mocked);
assert.equal(mocked.dock.style.left,"746px");
assert.equal(mocked.dock.style.top,"646px");
console.log("Mission Control keepVisible scope + viewport regression PASS");
