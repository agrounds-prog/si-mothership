const assert=require("node:assert/strict");
const D=require("../dominoes.js");
const run=(label,fn)=>{fn();console.log("PASS: "+label)};
const tile=(id,a,b)=>({id,a,b});
run("double-six deck has 28 unique tiles and expected pips",()=>{
 const bag=D.makeBag();assert.equal(bag.length,28);assert.equal(new Set(bag.map(t=>t.id)).size,28);
 assert.equal(bag.every(t=>t.a<=t.b&&t.a>=0&&t.b<=6),true);assert.equal(D.pips({a:6,b:6}),12);
});
run("two to four players receive seven tiles and retain boneyard",()=>{
 for(let n=2;n<=4;n++){const g=D.make(["A","B","C","D"].slice(0,n));assert.equal(g.players.length,n);assert.equal(g.bag.length,28-7*n);assert.equal(g.players.every(x=>g.hands[x].length===7),true);}
 assert.throws(()=>D.make(["A"]),/two to four/i);
});
run("first tile can be played to either end; turn advances",()=>{
 const g=D.make(["A","B"]);g.hands.A=[tile("x",1,6),tile("y",2,5)];
 assert.equal(D.apply(g,"A","play","x","right").ok,true);
 assert.deepEqual(D.ends(g),{left:1,right:6});assert.equal(g.turn,1);assert.equal(g.chain.length,1);
 assert.equal(D.apply(g,"A","play","y","left").error.includes("turn"),true);
});
run("left and right placement orients ends without changing pip identities",()=>{
 const g=D.make(["A","B"]);g.hands.A=[tile("x",2,6),tile("y",1,2)];D.apply(g,"A","play","x","right");
 g.hands.B=[tile("z",5,6),tile("q",3,3)];
 assert.equal(D.apply(g,"B","play","z","right").ok,true);
 assert.deepEqual(D.ends(g),{left:2,right:5});
 g.hands.A=[tile("l",1,2),tile("m",3,3)];
 assert.equal(D.apply(g,"A","play","l","left").ok,true);
 assert.deepEqual(D.ends(g),{left:1,right:5});
 assert.equal(g.chain[0].a,1);assert.equal(g.chain[0].b,2);
});
run("illegal placement, wrong player, draw and pass are blocked",()=>{
 const g=D.make(["A","B"]);g.hands.A=[tile("x",2,5),tile("y",3,3)];
 assert.match(D.apply(g,"B","play","x","right").error,/turn/i);
 assert.match(D.apply(g,"A","draw").error,/matching/i);
 D.apply(g,"A","play","x","right");
 g.hands.B=[tile("z",0,0)];
 assert.equal(D.canPlay(g,"B",g.hands.B[0]),false);
 assert.match(D.apply(g,"B","pass").error,/draw/i);
 assert.equal(D.apply(g,"B","draw").ok,true);
});
run("last domino wins and scores all opponents remaining pips",()=>{
 const g=D.make(["A","B"]);g.hands.A=[tile("x",6,6)];g.hands.B=[tile("y",1,4),tile("z",0,3)];
 assert.equal(D.apply(g,"A","play","x","right").ok,true);
 assert.equal(g.status,"won");assert.equal(g.winner,"A");assert.equal(g.scores.A,8);
 assert.equal(D.apply(g,"A","draw").error.includes("turn"),true);
});
run("blocked game uses lowest remaining pip total",()=>{
 const g=D.make(["A","B"]);g.chain=[{id:"c",a:6,b:6,left:6,right:6}];
 g.hands.A=[tile("1",0,0),tile("2",1,1)];g.hands.B=[tile("3",2,4)];
 g.bag=[];g.turn=0;
 assert.equal(D.apply(g,"A","pass").ok,true);assert.equal(D.apply(g,"B","pass").ok,true);
 assert.equal(g.status,"won");assert.equal(g.winner,"A");
});
run("projected table shows board and counts but never private hands",()=>{
 const g=D.make(["A","B"]);const shared=D.tableHTML(g,true);assert.match(shared,/dm-public/);
 assert.match(shared,/dm-chain/);assert.doesNotMatch(shared,/data-dm-play=/);
 const student=D.studentHTML(g,{n:"A"});assert.match(student,/YOUR DOMINOES/);assert.match(student,/data-dm-play/);
 const viewer=D.studentHTML(g,{n:"Guest"});assert.doesNotMatch(viewer,/data-dm-play/);
});
run("setup includes Cosmic Cards-style connected student seats, teacher option and save/load controls",()=>{
 const html=D.setupHTML(["Alex","Sam"]);
 assert.match(html,/data-dm-seat="Alex"/);assert.match(html,/data-dm-seat="Sam"/);
 assert.match(html,/data-dm-teacher-seat/);assert.match(html,/id="dmStart"/);
 assert.equal(typeof D.setupWire,"function");assert.equal(typeof D.teacherWire,"function");
});
run("opening controls show one place action and doubles can rotate",()=>{
 const g=D.make(["A","B"]);g.hands.A=[{id:"five",a:5,b:5},{id:"two",a:1,b:2}];
 const html=D.studentHTML(g,{n:"A"});
 assert.match(html,/data-dm-side="first"/);
 assert.doesNotMatch(html,/data-dm-side="left"/);
 assert.match(html,/data-dm-rotate="five"/);
 assert.equal(D.apply(g,"A","play","five","first",true).ok,true);
 assert.equal(g.chain[0].vertical,true);
 assert.deepEqual(D.ends(g),{left:5,right:5});
 assert.match(D.tableHTML(g,true),/double vertical/);
});
run("saved vertical doubles and legacy horizontal doubles render consistently",()=>{
 const g=D.make(["A","B"]);g.hands.A=[tile("double",4,4),tile("other",1,2)];
 assert.equal(D.apply(g,"A","play","double","first",true).ok,true);
 const restored=D.snapshot(g);
 assert.match(D.tableHTML(restored,true),/double vertical/);
 delete restored.chain[0].vertical;
 assert.doesNotMatch(D.tableHTML(restored,true),/double vertical/);
 assert.match(D.studentHTML(restored,{n:"B"}),/data-dm-side="left"/);
 assert.doesNotMatch(D.studentHTML(restored,{n:"B"}),/data-dm-side="first"/);
});
console.log("DOMINOES ENGINE REGRESSION COMPLETE");
