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
run("student team assignment, teacher player and private letter hint",()=>{
 const g=W.make(["Crew Alpha","Crew Beta","Teacher"],{assignments:{"Alex":0,"Sam":1},teacherSeat:2});
 assert.deepEqual(g.assignments,{Alex:0,Sam:1});
 assert.deepEqual(W.teamMembers(g,2),["Teacher"]);
 const rackTile=g.players[0].rack[0];
 assert.equal(W.setHint(g,rackTile.id),true);
 const alpha=W.studentHTML(g,{n:"Alex"}),beta=W.studentHTML(g,{n:"Sam"}),screen=W.sharedHTML(g,true);
 assert.match(alpha,/wg-student-rack/);
 assert.match(alpha,/wg-highlight/);
 assert.match(alpha,/TEACHER HINT/);
 assert.doesNotMatch(beta,/wg-student-rack/);
 assert.doesNotMatch(beta,/TEACHER HINT/);
 assert.doesNotMatch(screen,/wg-student-rack/);
 assert.equal(W.setHint(g,rackTile.id),true);
 assert.equal(g.hint,null);
 assert.equal(W.assignStudent(g,"Alex",1),true);
 assert.doesNotMatch(W.studentHTML(g,{n:"Alex"}),/wg-student-rack/);
 assert.equal(W.assignStudent(g,"Alex",""),true);
 assert.equal(g.assignments.Alex,undefined);
});
run("match setup includes student team dropdowns and teacher participation",()=>{
 const html=W.setupHTML(["Alex","Sam"]);
 assert.match(html,/data-wg-setup-student="Alex"/);
 assert.match(html,/data-wg-setup-student="Sam"/);
 assert.match(html,/wgTeacherMode/);
 assert.match(html,/Teacher plays as own player/);
 assert.match(html,/START WORD GRID/);
 assert.equal(typeof W.wireSetup,"function");
});
run("polished shared-screen carries turn spotlight, bonus key, arcade emblem and recent tiles",()=>{
 const g=W.make(["Crew Alpha","Crew Beta"]);
 const shared=W.sharedHTML(g,true);
 const mirror=W.sharedHTML(g,false);
 assert.match(shared,/wg-emblem/);
 assert.match(shared,/wg-turn-spotlight/);
 assert.match(shared,/NOW PLAYING/);
 assert.match(shared,/TRIPLE WORD/);
 assert.match(shared,/DOUBLE LETTER/);
 assert.match(shared,/wg-premium-legend/);
 assert.match(mirror,/wg-mirror/);
 assert.equal((shared.match(/data-wg-bonus=/g)||[]).length,225);
 assert.equal((mirror.match(/data-wg-cell=/g)||[]).length,225);
 assert.match(shared,/data-wg-bonus="center"/);
 g.lastMove={words:[{tiles:[112],text:"A",points:2}],score:2,at:Date.now()};
 g.board[112]={id:"demo",letter:"A",value:1,blank:false};
 assert.match(W.sharedHTML(g,true),/locked recent center/);
});
run("projection and student view render tiles, not a private teacher rack",()=>{
 const g=W.make(["Alpha","Bravo"]);const shared=W.sharedHTML(g,true),student=W.studentHTML(g);
 assert.equal((shared.match(/data-wg-cell=/g)||[]).length,225);
 assert.equal((student.match(/data-wg-cell=/g)||[]).length,225);
 assert.doesNotMatch(student,/data-wg-action/);
 assert.match(W.setupHTML([]),/START WORD GRID/);
});


run("scoring animation marks only newly placed tiles and never animates old intersections",()=>{
 const g=W.make(["Alpha","Bravo"]);
 g.players[0].rack=given("CATDOGS");
 W.commit(g,{111:g.players[0].rack[0],112:g.players[0].rack[1],113:g.players[0].rack[2]});
 assert.deepEqual(g.lastMove.newTiles.sort((a,b)=>a-b),[111,112,113]);
 g.players[1].rack=given("BEELKRS");
 W.commit(g,{97:g.players[1].rack[0]});
 assert.deepEqual(g.lastMove.newTiles,[97]);
 const publicScreen=W.sharedHTML(g,true);
 assert.match(publicScreen,/data-wg-cell="97"[^>]*wg-play-reveal/);
 assert.doesNotMatch(publicScreen,/data-wg-cell="112"[^>]*wg-play-reveal/);
 assert.equal((publicScreen.match(/class="wg-spark"/g)||[]).length,8);
 assert.doesNotMatch(W.sharedHTML(g,false),/wg-spark-burst|wg-play-reveal/);
});
run("replay celebration does not award points or alter the turn, rack or bag",()=>{
 const g=W.make(["Alpha","Bravo"]);g.players[0].rack=given("CATDOGS");
 assert.equal(W.replayLastScore(g),false,"cannot replay before a word was scored");
 W.commit(g,{111:g.players[0].rack[0],112:g.players[0].rack[1],113:g.players[0].rack[2]});
 const before={scores:g.players.map(p=>p.score),turn:g.turn,bag:g.bag.length,board:g.board.filter(Boolean).length,history:g.history.length};
 g.lastMove.at-=11000;g.publicCue.at-=11000;
 assert.doesNotMatch(W.sharedHTML(g,true),/wg-score-celebration/);
 assert.equal(W.replayLastScore(g),true);
 assert.match(W.sharedHTML(g,true),/wg-score-celebration/);
 assert.match(W.sharedHTML(g,true),/wg-spark-burst/);
 assert.match(W.sharedHTML(g,true),/wg-play-reveal/);
 assert.deepEqual({scores:g.players.map(p=>p.score),turn:g.turn,bag:g.bag.length,board:g.board.filter(Boolean).length,history:g.history.length},before);
 assert.doesNotMatch(W.sharedHTML(g,false),/wg-score-celebration|wg-spark-burst/);
});
run("game-ending scoring play can still celebrate without extending the match",()=>{
 const g=W.make(["Alpha","Bravo"]);g.players[0].rack=given("CATDOGS");
 W.commit(g,{111:g.players[0].rack[0],112:g.players[0].rack[1],113:g.players[0].rack[2]});
 g.finished=true;
 assert.match(W.sharedHTML(g,true),/wg-score-celebration/);
});
run("projector celebrations are temporary, preserve privacy, and respect turn actions",()=>{
 const g=W.make(["Team Aurora","Team Comet"]);g.players[0].rack=given("CATDOGS");
 assert.equal(W.commit(g,{111:g.players[0].rack[0],112:g.players[0].rack[1],113:g.players[0].rack[2]}).score,10);
 assert.equal(g.publicCue.kind,"score");
 let broadcast=W.sharedHTML(g,true);
 assert.match(broadcast,/wg-score-celebration/);
 assert.match(broadcast,/wg-play-reveal/);
 assert.match(broadcast,/wg-turn-coming/);
 assert.match(broadcast,/\+10 <small>POINTS<\/small>/);
 assert.doesNotMatch(broadcast,/wg-student-rack|data-wg-tile=/);
 assert.doesNotMatch(W.sharedHTML(g,false),/wg-score-celebration|wg-play-reveal/);
 g.publicCue.at-=4000;g.lastMove.at-=4000;
 broadcast=W.sharedHTML(g,true);
 assert.doesNotMatch(broadcast,/wg-score-celebration|wg-play-reveal|wg-fx-live/);
 g.lastMove.at-=4000;
 assert.doesNotMatch(W.sharedHTML(g,true),/locked recent center/);
 W.pass(g);assert.equal(g.publicCue.kind,"pass");
 assert.match(W.sharedHTML(g,true),/TURN PASSED/);
 W.undo(g);assert.equal(g.publicCue.kind,"undo");
 assert.match(W.sharedHTML(g,true),/TURN REWOUND/);
});
console.log("WORD GRID engine regression complete");
