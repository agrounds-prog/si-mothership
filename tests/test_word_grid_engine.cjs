/* WORD GRID pure engine tests — no browser/network/live classroom writes. */
const assert=require("node:assert/strict");
const W=require("../word-grid.js");
const tile=(letter,id)=>({id,letter,value:W.POINTS[letter],blank:letter==="?"});
const given=(letters)=>letters.split("").map((c,i)=>tile(c,"fixture-"+i+"-"+c));
const run=(name,fn)=>{fn();console.log("PASS "+name)};
run("100-tile English distribution, four player cap, seven-tile racks",()=>{
 const g=W.make(["Alpha","Bravo","Charlie","Delta","Extra"]);
 assert.equal(g.players.length,4);
 assert.equal(g.bag.length+g.players.reduce((v,p)=>v+p.rack.length,0),100);
 assert.equal(g.players.every(p=>p.rack.length===7),true);
 assert.equal(g.board.length,225);
 assert.equal(W.premium(112),"center");
 assert.equal(W.premium(0),"tw");
 assert.equal(W.premium(20),"tl");
});
run("first word must cross center and be straight with no gaps",()=>{
 const g=W.make(["A","B"]);g.players[0].rack=given("CATDOGS");
 assert.match(W.isNewMapValid(g,{0:g.players[0].rack[0],1:g.players[0].rack[1]}).error,/center/i);
 assert.match(W.isNewMapValid(g,{111:g.players[0].rack[0],113:g.players[0].rack[1]}).error,/gaps/i);
 assert.match(W.isNewMapValid(g,{111:g.players[0].rack[0],112:g.players[0].rack[1],128:g.players[0].rack[2]}).error,/row or column/i);
});
run("opening CAT gets 2x center word score and advances the turn",()=>{
 const g=W.make(["Alpha","Bravo"]);g.players[0].rack=given("CATDOGS");
 const p={111:g.players[0].rack[0],112:g.players[0].rack[1],113:g.players[0].rack[2]};
 const preview=W.isNewMapValid(g,p);
 assert.equal(preview.words[0].text,"CAT");assert.equal(preview.score,10);
 const result=W.commit(g,p);assert.equal(result.score,10);assert.equal(g.players[0].score,10);
 assert.equal(g.turn,1);assert.equal(g.board[112].letter,"A");assert.equal(g.lastMove.words[0].text,"CAT");
 assert.equal(g.players[0].rack.length,7);
 assert.equal(W.undo(g),true);assert.equal(g.turn,0);assert.equal(g.board[112],null);
 assert.equal(g.players[0].score,0);
});
run("connected cross word scores only newly placed premiums",()=>{
 const g=W.make(["Alpha","Bravo"]);g.players[0].rack=given("CATDOGS");W.commit(g,{111:g.players[0].rack[0],112:g.players[0].rack[1],113:g.players[0].rack[2]});
 g.players[1].rack=given("BEELKRS");
 const check=W.isNewMapValid(g,{97:g.players[1].rack[0]});
 assert.equal(check.words[0].text,"BA");assert.equal(check.score,4);
 assert.equal(W.commit(g,{97:g.players[1].rack[0]}).score,4);
 assert.equal(g.players[1].score,4);
});
run("invalid disconnected turns and duplicate rack tiles are rejected",()=>{
 const g=W.make(["Alpha","Bravo"]);g.players[0].rack=given("CATDOGS");W.commit(g,{111:g.players[0].rack[0],112:g.players[0].rack[1],113:g.players[0].rack[2]});
 g.players[1].rack=given("BEELKRS");
 assert.match(W.isNewMapValid(g,{0:g.players[1].rack[0],1:g.players[1].rack[1]}).error,/touch/i);
 assert.match(W.isNewMapValid(g,{97:g.players[1].rack[0],98:g.players[1].rack[0]}).error,/same|rack|each tile/i);
});
run("seven placed tiles earn 50 points bonus",()=>{
 const g=W.make(["Alpha","Bravo"]);g.players[0].rack=given("READING");
 const p=Object.fromEntries(g.players[0].rack.map((t,i)=>[109+i,t]));
 const check=W.isNewMapValid(g,p);assert.equal(check.bonus,50);
 assert.equal(check.words[0].text,"READING");assert.equal(check.score>=50,true);
});
run("blank tile can stand for a letter with zero points",()=>{
 const g=W.make(["Alpha","Bravo"]);g.players[0].rack=given("?ATDOGS");
 const blank={...g.players[0].rack[0],as:"C"},p={111:blank,112:g.players[0].rack[1],113:g.players[0].rack[2]};
 assert.equal(W.isNewMapValid(g,p).score,4);
});
run("pass/exchange and game-end logic maintain scores",()=>{
 const g=W.make(["Alpha","Bravo"]),first=g.players[0].rack[0].id;
 assert.equal(W.exchange(g,[first]).ok,true);assert.equal(g.turn,1);assert.equal(g.players[0].rack.length,7);
 W.pass(g);W.pass(g);W.pass(g);assert.equal(g.finished,true);
 assert.match(g.message,/game complete/i);
});
run("a single connected learner defaults to a valid two-team setup",()=>{
 const html=W.setupHTML(["Solo Student"]);
 assert.match(html,/Crew Alpha\nCrew Beta/);
 assert.match(html,/id="wgSetupStatus"/);
 assert.equal(W.make(["Crew Alpha","Crew Beta"]).players.length,2);
});
run("projection and student view render tiles, not a private teacher rack",()=>{
 const g=W.make(["Alpha","Bravo"]);const shared=W.sharedHTML(g,true),student=W.studentHTML(g);
 assert.equal((shared.match(/data-wg-cell=/g)||[]).length,225);
 assert.equal((student.match(/data-wg-cell=/g)||[]).length,225);
 assert.doesNotMatch(student,/data-wg-action/);
 assert.match(W.setupHTML([]),/CREATE WORD GRID/);
});
console.log("WORD GRID engine regression complete");
