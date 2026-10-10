"use strict";
/* Student-side read-only status smoke. Uses the real production formatter without
   a browser or classroom session. No persistent storage and no network calls. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const js = fs.readFileSync("bingo-board-studio.js", "utf8");
const css = fs.readFileSync("bingo-board-studio.css", "utf8");
const begin = js.indexOf("function modeFromStudentStatus(stage,message)");
const end = js.indexOf("\n function networkHoldAction(", begin);
assert.ok(begin >= 0 && end > begin, "Student status formatter must exist");
const format = vm.runInNewContext("(" + js.slice(begin, end).trim() + ")");
const scenarios = [
  ["disconnected", "Reconnecting — wait before sending another response.", "offline"],
  ["paused", "Paused — your progress is saved.", "paused"],
  ["waiting", "Waiting for your teacher to start the next activity.", "watch"],
  ["live", "Your turn — tap BUZZ!", "turn"],
  ["live", "Your turn — select your answer.", "turn"],
  ["live", "Waiting for your turn — watch the shared table.", "watch"],
  ["live", "Spectator — watch the shared table.", "watch"],
  ["live", "Answer submitted privately — watch Mission Control.", "sent"],
  ["live", "Prediction selected — watch the command seat.", "sent"],
  ["live", "Final answer locked — awaiting reveal.", "sent"],
  ["ready", "Classroom ready — choose a control when your teacher asks.", "ready"]
];
for (const [state, message, desired] of scenarios) {
  assert.equal(format(state, message), desired, `mode for ${state}: ${message}`);
}
for (const app of ["crew-survey", "million", "cosmic-cards", "pixel", "presentation", "binary", "exit"]) {
  assert.ok(js.includes("app?.type==='" + app + "'"), "Student feedback covers " + app);
}
for (const marker of ["siStudentCrewHud", "si-student-hud-avatar", "si-student-hud-phase", "data-si-phase=\"turn\""]) {
  assert.ok(js.includes(marker) || css.includes(marker), "Avatar/status HUD marker " + marker);
}

const fnBegin = js.indexOf("function networkHoldAction(btn,paused,key)");
const fnEnd = js.indexOf("\n function studentNetworkUnavailable(){", fnBegin);
assert.ok(fnBegin >= 0 && fnEnd > fnBegin, "Connection guard must exist");
const hold = vm.runInNewContext("(" + js.slice(fnBegin, fnEnd).trim() + ")");
function fakeButton(disabled = false) {
  return {disabled, dataset: {}, attrs: {},
    setAttribute(key,value) {this.attrs[key]=value;}};
}
const readyButton = fakeButton();
hold(readyButton,true,"siGameConnectionHold");
assert.equal(readyButton.disabled,true);
assert.equal(readyButton.attrs["aria-disabled"],"true");
hold(readyButton,false,"siGameConnectionHold");
assert.equal(readyButton.disabled,false);
assert.equal("siGameConnectionHold" in readyButton.dataset,false);
const teacherLockedButton = fakeButton(true);
hold(teacherLockedButton,true,"siGameConnectionHold");
hold(teacherLockedButton,false,"siGameConnectionHold");
assert.equal(teacherLockedButton.disabled,true,"Reconnect must not unlock a teacher-disabled choice");
for(const marker of ["siStudentOfflineNotice", "studentNetworkUnavailable()", "event.stopImmediatePropagation()", "siGameConnectionHold", "studentCalculatorBackBtn"]){
  assert.ok(js.includes(marker),"Disconnect safety remains: "+marker);
}
assert.ok(css.includes(".si-student-offline-notice"),"Offline game warning is styled");

console.log("Student turn/status UI: " + scenarios.length + " behavior cases + game coverage and visual markers passed.");
