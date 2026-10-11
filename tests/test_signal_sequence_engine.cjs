/* SIGNAL SEQUENCE v1 — deterministic mechanics and safe screens. */
const assert=require("node:assert/strict");
const S=require("../signal-sequence.js");
const run=(name,fn)=>{fn();console.log("PASS "+name)};
run("four-symbol donut matches student and projector geometry",()=>{
 const g=S.make({pilot:"Ava"}),shared=S.sharedHTML(g,true),student=S.studentHTML(g,"Ava");
 assert.equal((shared.match(/data-ss-pad=/g)||[]).length,4);
 assert.equal((student.match(/data-ss-pad=/g)||[]).length,4);
 assert.equal((shared.match(/data-ss-press=/g)||[]).length,0);
 assert.equal((student.match(/data-ss-press=/g)||[]).length,0);
 assert.match(shared,/RED/);assert.match(shared,/YELLOW/);
});
run("classic round grows, watches first, then checks each input in order",()=>{
 const g=S.make({pilot:"Teacher",speed:"slow"});
 assert.equal(S.startRound(g,{now:1000,random:()=>0}),true);
 assert.deepEqual(g.sequence,[0]);assert.equal(g.phase,"watch");
 assert.equal(S.beginInput(g,1500),false);
 assert.equal(S.cue(g,2000),0);assert.equal(S.beginInput(g,g.playbackEnd+1),true);
 assert.equal((S.teacherHTML(g).match(/data-ss-press=/g)||[]).length,4);
 assert.equal(S.press(g,0,5000).finished,true);assert.equal(g.phase,"success");assert.equal(g.best,1);
 assert.equal(S.startRound(g,{now:6000,random:()=>.9}),true);
 assert.deepEqual(g.sequence,[0,3]);assert.equal(g.round,2);
 assert.equal(S.beginInput(g,g.playbackEnd+1),true);
 assert.equal(S.press(g,0).finished,false);assert.equal(S.press(g,2).correct,false);
 assert.equal(g.phase,"failed");assert.equal(S.press(g,3).error,"Input is locked.");
 S.retry(g);assert.equal(g.round,0);assert.equal(g.best,1);
});
run("only active pilot receives interactive student donut, and saved games round trip",()=>{
 const g=S.make({pilot:"Ava"});S.startRound(g,{now:1000,random:()=>.26});S.beginInput(g,g.playbackEnd+1);
 assert.equal((S.studentHTML(g,"Ava").match(/data-ss-press=/g)||[]).length,4);
 assert.equal((S.studentHTML(g,"Sam").match(/data-ss-press=/g)||[]).length,0);
 assert.equal((S.sharedHTML(g,true).match(/data-ss-press=/g)||[]).length,0);
 assert.doesNotMatch(S.studentHTML(g,"Ava"),/PRIVATE SEQUENCE/);
 assert.match(S.teacherHTML(g),/PRIVATE SEQUENCE/);
 const clone=S.snapshot(g);assert.deepEqual(clone.sequence,[1]);
 assert.equal(S.press(g,1).correct,true);
});
console.log("SIGNAL SEQUENCE engine regression complete");
