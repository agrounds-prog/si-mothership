/* FOUR IN LINE — pure game rules / presentation regressions */
const assert=require("node:assert/strict");
const F=require("../four-in-line.js");
const run=(name,fn)=>{fn();console.log("PASS "+name)};
run("supported dimensions and initial 2-player board",()=>{
 for(const [size,dims] of Object.entries(F.SIZES)){const g=F.make(["Blue","Gold"],{size});assert.deepEqual([g.cols,g.rows],dims);assert.equal(g.board.length,dims[0]*dims[1]);assert.equal(g.board.every(x=>x===0),true);}
 assert.throws(()=>F.make(["Same","Same"]),/distinct/);
});
run("gravity, turn validation, full column and undo",()=>{
 const g=F.make(["Blue","Gold"],{size:"mini"});
 assert.equal(F.drop(g,1,0).error,"Not your turn.");
 assert.equal(F.drop(g,0,0).row,3);
 assert.equal(F.drop(g,1,0).row,2);
 assert.equal(F.drop(g,0,0).row,1);
 assert.equal(F.drop(g,1,0).row,0);
 assert.equal(F.drop(g,0,0).error,"That column is full or unavailable.");
 assert.equal(F.undo(g),true);
 assert.equal(F.drop(g,1,0).row,0);
});
run("horizontal four and final game can be undone",()=>{
 const g=F.make(["Blue","Gold"]);
 for(const col of [0,0,1,1,2,2])assert.equal(F.drop(g,g.turn,col).ok,true);
 const r=F.drop(g,g.turn,3);
 assert.equal(r.win,true);assert.equal(g.winner,0);assert.equal(g.status,"won");assert.equal(g.winning.length,4);
 assert.match(F.publicHTML(g,true),/FOUR CONNECTED/);
 assert.equal(F.drop(g,1,4).error,"Not your turn.");
 assert.equal(F.undo(g),true);assert.equal(g.status,"playing");assert.equal(g.winner,null);
});
run("vertical, diagonal wins and no illegal plays",()=>{
 const vertical=F.make(["A","B"]);
 for(const col of [0,1,0,1,0,1,0])F.drop(vertical,vertical.turn,col);
 assert.equal(vertical.winner,0);
 const diagonal=F.make(["A","B"]);
 // An upward diagonal for side A, supported by alternating filler discs.
 for(const col of [0,1,1,2,4,2,2,3,4,3,5,3,3]){
  const result=F.drop(diagonal,diagonal.turn,col);assert.equal(result.ok,true);
 }
 assert.equal(diagonal.winner,0);
 assert.equal(diagonal.winning.length,4);
});
run("team mapping, separate touch controller and projector never expose controls",()=>{
 const g=F.make(["Blue","Gold"],{seats:{Alex:0,Sam:1},mode:"teams"});
 assert.equal(F.seatOf(g,"Alex"),0);assert.equal(F.seatOf(g,"Sam"),1);assert.equal(F.seatOf(g,"Unknown"),-1);
 assert.match(F.studentHTML(g,"Alex"),/data-fil-drop/);
 assert.equal((F.studentHTML(g,"Sam").match(/data-fil-drop="\d+"/g)||[]).length,7);
 assert.doesNotMatch(F.publicHTML(g,true),/data-fil-drop=/);
 assert.equal((F.publicHTML(g,true).match(/role="gridcell"/g)||[]).length,42);
 assert.doesNotMatch(F.publicHTML(g,true),/student_token|private|rack/i);
 assert.match(F.setupHTML(["Alex","Sam"]),/data-fil-seat="Alex"/);
 assert.match(F.setupHTML(["Alex","Sam"]),/data-fil-seat="Sam"/);
});
run("game can be reset while preserving configured team seats",()=>{
 const g=F.make(["A","B"],{size:"mega",mode:"teams",seats:{Alex:1}});
 F.drop(g,0,4);const old=F.snapshot(g);
 assert.equal(g.board.filter(Boolean).length,1);
 F.reset(g);assert.equal(g.board.filter(Boolean).length,0);
 assert.equal(g.cols,9);assert.equal(g.mode,"teams");assert.deepEqual(g.seats,{Alex:1});
 assert.equal(old.board.filter(Boolean).length,1);
});
run("projector champion overlay stays off the miniature mirror",()=>{
 const g=F.make(["Blue","Gold"]);
 for(const col of [0,0,1,1,2,2,3])F.drop(g,g.turn,col);
 assert.equal(g.status,"won");
 assert.match(F.publicHTML(g,true),/fil-victory/);
 assert.match(F.publicHTML(g,true),/Blue WINS/);
 assert.doesNotMatch(F.publicHTML(g,false),/fil-victory/);
});
run("student preview controls are not exposed on projector",()=>{
 const g=F.make(["A","B"],{seats:{Alex:0}});
 assert.doesNotMatch(F.publicHTML(g,true),/data-fil-confirm|data-fil-cancel/);
 assert.doesNotMatch(F.studentHTML(g,"Sam"),/data-fil-confirm/);
 assert.match(F.studentHTML(g,"Alex"),/data-fil-drop="0"/);
 assert.doesNotMatch(F.studentHTML(g,"Alex"),/data-fil-confirm|data-fil-cancel/);
 assert.match(F.studentHTML(g,"Alex"),/Tap a numbered column once/);
});
console.log("FOUR IN LINE engine regression complete");
