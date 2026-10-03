from __future__ import annotations

import asyncio
import base64
import copy
import io
import gzip
import json
import re
import secrets
import os
import hmac
import hashlib
import socket
import sqlite3
import sys
import time
import webbrowser
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

from aiohttp import WSMsgType, web
import qrcode

ROOT = Path(__file__).resolve().parent
INDEX_PATH = ROOT / "index.html"
CALCULATOR_DIR = ROOT / "scientific-calculator"
CALCULATOR_INDEX_GZ = CALCULATOR_DIR / "index.html.gz"
CALCULATOR_ENGINE_GZ = CALCULATOR_DIR / "engine.js.gz"
DATA_DIR = Path(os.getenv("MOTHERSHIP_DATA_DIR", str(ROOT))).expanduser().resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "mothership_data.sqlite3"
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8877"))
TEACHER_KEY = "5030"  # Pilot teacher login key; intentionally fixed for this build.
_EXPLICIT_PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")
_RAILWAY_PUBLIC_DOMAIN = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip().strip("/")
PUBLIC_BASE_URL = _EXPLICIT_PUBLIC_BASE_URL or (f"https://{_RAILWAY_PUBLIC_DOMAIN}" if _RAILWAY_PUBLIC_DOMAIN else "")
NO_BROWSER = os.getenv("MOTHERSHIP_NO_BROWSER", "").strip().lower() in {"1", "true", "yes", "on"}
JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
APP_VERSION = "55.17"

CALCULATOR_MODELING_STYLE = r"""
<style id="v53-6-calculator-classroom-modeling">
/* SI-branded classroom modeling skin.
   Visual only: keypad actions and scientific engine behavior are unchanged. */
html{background:#11181d!important}
body.si-classroom-model{
  min-height:100vh;
  background:
    radial-gradient(circle at 50% 12%,rgba(83,125,148,.18),transparent 34%),
    linear-gradient(180deg,#19232a 0,#0d1419 100%)!important
}
body.si-classroom-model .si-model-calculator{
  position:relative;
  max-width:400px!important;
  margin-left:auto!important;
  margin-right:auto!important;
  padding:15px 17px 25px!important;
  border:1px solid #60747e!important;
  border-radius:21px 21px 34px 34px!important;
  background:
    linear-gradient(92deg,rgba(255,255,255,.035),transparent 9% 91%,rgba(255,255,255,.025)),
    linear-gradient(165deg,#334d5b 0,#233b48 37%,#172b36 72%,#13232c 100%)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.16),
    inset 8px 0 18px rgba(255,255,255,.02),
    inset -8px 0 18px rgba(0,0,0,.2),
    0 26px 58px rgba(0,0,0,.48)!important
}
body.si-classroom-model .si-model-calculator:before,
body.si-classroom-model .si-model-calculator:after{
  content:"";
  position:absolute;
  left:13px;
  right:13px;
  height:1px;
  pointer-events:none
}
body.si-classroom-model .si-model-calculator:before{
  top:8px;
  background:linear-gradient(90deg,transparent,#8ba0aa66,transparent)
}
body.si-classroom-model .si-model-calculator:after{
  bottom:12px;
  background:linear-gradient(90deg,transparent,#061016bb,transparent)
}
body.si-classroom-model .si-model-plate{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:12px;
  min-height:42px;
  margin:2px 3px 8px;
  padding:2px 2px 5px;
  border-bottom:1px solid rgba(203,222,231,.18);
  color:#eef4f5;
  text-transform:uppercase
}
body.si-classroom-model .si-model-plate>div{min-width:0}
body.si-classroom-model .si-model-plate b{
  display:block;
  font:900 14px/1.05 Arial,Helvetica,sans-serif;
  letter-spacing:.045em
}
body.si-classroom-model .si-model-plate span{
  display:block;
  margin-top:3px;
  color:#b3c2c9;
  font:800 7px/1.1 Arial,Helvetica,sans-serif;
  letter-spacing:.12em
}
body.si-classroom-model .si-model-plate strong{
  flex:0 0 auto;
  color:#a8d9ee;
  font:900 8px/1 Arial,Helvetica,sans-serif;
  letter-spacing:.1em
}
body.si-classroom-model .si-model-lcd{
  min-height:126px!important;
  margin:0 1px 14px!important;
  padding:10px 12px!important;
  border:5px solid #1d2b31!important;
  border-radius:5px!important;
  background:linear-gradient(180deg,#dde6c6 0,#ced9b8 100%)!important;
  color:#16231f!important;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.5),
    inset 0 8px 14px rgba(104,124,91,.1),
    0 2px 0 rgba(255,255,255,.08),
    0 5px 11px rgba(0,0,0,.22)!important;
  font-family:"Courier New",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;
  letter-spacing:.01em
}
body.si-classroom-model .si-model-keypad{
  gap:7px!important;
  padding:2px 1px 0!important
}
body.si-classroom-model .si-model-key{
  min-height:45px!important;
  padding:5px 4px!important;
  border:1px solid #71818a!important;
  border-radius:6px!important;
  background:linear-gradient(180deg,#52616a 0,#38474e 100%)!important;
  color:#f5f7f7!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.22),
    0 3px 0 #101a1f,
    0 4px 7px rgba(0,0,0,.3)!important;
  font-family:Arial,Helvetica,sans-serif!important;
  font-weight:850!important;
  text-shadow:0 1px 0 rgba(0,0,0,.32);
  transform:translateY(0);
  transition:transform .06s ease,filter .08s ease,box-shadow .08s ease!important
}
body.si-classroom-model .si-model-key:active{
  transform:translateY(2px)!important;
  box-shadow:inset 0 1px 2px rgba(0,0,0,.22),0 1px 0 #101a1f!important;
  filter:brightness(.98)
}
body.si-classroom-model .si-model-key[data-model-group="number"]{
  border-color:#e7ece9!important;
  background:linear-gradient(180deg,#f4f5f2 0,#d1d7d4 100%)!important;
  color:#172027!important;
  text-shadow:none
}
body.si-classroom-model .si-model-key[data-model-group="operator"]{
  border-color:#7893a0!important;
  background:linear-gradient(180deg,#607f8e 0,#405e6d 100%)!important;
  color:#fff!important
}
body.si-classroom-model .si-model-key[data-model-group="utility"]{
  border-color:#506975!important;
  background:linear-gradient(180deg,#364f5b 0,#263d48 100%)!important;
  color:#f2f7f9!important
}
body.si-classroom-model .si-model-key[data-action="second"]{
  border-color:#55b5d7!important;
  background:linear-gradient(180deg,#278fb8,#176a92)!important;
  color:#fff!important
}
body.si-classroom-model .si-model-key[data-action="enter"],
body.si-classroom-model .si-model-key[data-action="equals"]{
  border-color:#d9e0de!important;
  background:linear-gradient(180deg,#f1f3ef,#cbd2cf)!important;
  color:#172027!important;
  text-shadow:none
}
body.si-classroom-model .si-model-key small,
body.si-classroom-model .si-model-key .secondary,
body.si-classroom-model .si-model-key .alt,
body.si-classroom-model .si-model-key [class*="second"]{
  color:#9bdcf2!important;
  font-size:8px!important;
  font-weight:850!important;
  letter-spacing:.02em;
  text-shadow:none
}
body.si-classroom-model .si-model-key[data-model-group="number"] small,
body.si-classroom-model .si-model-key[data-model-group="number"] .secondary,
body.si-classroom-model .si-model-key[data-model-group="number"] .alt{
  color:#43616f!important
}
body.si-classroom-model .si-model-keypad:before{
  content:"";
  display:block;
  grid-column:2 / -2;
  height:17px;
  margin:1px 16px 4px;
  border:1px solid #87979e;
  border-radius:999px;
  background:
    radial-gradient(circle at 50% 50%,#21333c 0 23%,transparent 25%),
    linear-gradient(90deg,#687982,#3d515b 28%,#31464f 50%,#3d515b 72%,#687982);
  box-shadow:inset 0 1px 1px rgba(255,255,255,.2),0 2px 2px rgba(0,0,0,.35);
  pointer-events:none
}
@media(max-width:520px){
  body.si-classroom-model .si-model-calculator{
    max-width:calc(100vw - 18px)!important;
    padding:12px 12px 20px!important;
    border-radius:18px 18px 28px 28px!important
  }
  body.si-classroom-model .si-model-lcd{min-height:112px!important}
  body.si-classroom-model .si-model-key{min-height:42px!important}
}
</style>
<script id="v53-6-calculator-classroom-modeling-script">
(function(){
  function applyClassroomModel(){
    if(!document.body)return;
    document.body.classList.add('si-classroom-model');
    const keys=Array.from(document.querySelectorAll('[data-action]'));
    keys.forEach(function(key){
      key.classList.add('si-model-key');
      const action=String(key.dataset.action||'').toLowerCase();
      const label=String(key.textContent||'').replace(/\s+/g,' ').trim();
      let group='function';
      if(/^[0-9]$/.test(label)||['decimal','negate','sign'].includes(action))group='number';
      if(key.classList.contains('operator')||['add','subtract','multiply','divide','enter','equals'].includes(action))group='operator';
      if(['second','clear','delete','del','mode'].includes(action))group='utility';
      if(/^(left|right|up|down|nav|cursor)/.test(action))group='nav';
      key.dataset.modelGroup=group;
    });
    const lcd=document.querySelector('.lcd');
    if(lcd){
      lcd.classList.add('si-model-lcd');
      let root=lcd.closest('.calculator,.calculator-shell,.calculator-body,.calc,.device');
      if(!root){
        let node=lcd.parentElement;
        while(node&&node!==document.body){
          if(node.querySelectorAll('[data-action]').length>=20){root=node;break}
          node=node.parentElement;
        }
      }
      if(root)root.classList.add('si-model-calculator');
      const host=lcd.parentElement;
      if(host&& !host.querySelector(':scope > .si-model-plate')){
        const plate=document.createElement('div');
        plate.className='si-model-plate';
        plate.innerHTML='<div><b>SI Scientific</b><span>Classroom Modeling Calculator</span></div><strong>4-LINE</strong>';
        host.insertBefore(plate,lcd);
      }
    }
    const keypad=document.querySelector('.keypad')||(keys.length?keys[0].parentElement:null);
    if(keypad)keypad.classList.add('si-model-keypad');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyClassroomModel,{once:true});
  else applyClassroomModel();
})();
</script>
<style id="v53-7-high-fidelity-calculator-modeling">
/* v53.7 — reference-inspired classroom modeling fidelity.
   SI-branded and intentionally distinct from third-party marks. */
body.si-classroom-model.si-hifi-model{
  display:flex!important;
  align-items:flex-start!important;
  justify-content:center!important;
  padding:18px 10px 32px!important;
  background:
    radial-gradient(circle at 50% 9%,rgba(87,127,145,.18),transparent 30%),
    linear-gradient(180deg,#1b252b 0,#0e1519 100%)!important
}
body.si-classroom-model.si-hifi-model .si-model-calculator{
  width:min(332px,calc(100vw - 24px))!important;
  max-width:332px!important;
  margin:0 auto!important;
  padding:13px 31px 31px!important;
  border:1px solid #aeb8bc!important;
  border-radius:29px 29px 54px 54px!important;
  background:
    linear-gradient(90deg,
      #cfd5d7 0 7.5%,
      #315a69 7.5% 92.5%,
      #cfd5d7 92.5% 100%)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.75),
    inset 0 -12px 22px rgba(56,74,82,.18),
    0 28px 62px rgba(0,0,0,.52)!important;
  overflow:hidden!important
}
body.si-classroom-model.si-hifi-model .si-model-calculator>*{
  position:relative;
  z-index:1
}
body.si-classroom-model.si-hifi-model .si-model-calculator:before{
  content:"";
  position:absolute;
  z-index:0;
  left:23px;
  right:23px;
  top:8px;
  bottom:20px;
  height:auto;
  border-radius:21px 21px 39px 39px;
  background:
    linear-gradient(180deg,#3b6979 0,#345f6f 46%,#2d5665 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.1),
    inset 0 -10px 18px rgba(0,0,0,.13);
  pointer-events:none
}
body.si-classroom-model.si-hifi-model .si-model-calculator:after{display:none!important}

body.si-classroom-model.si-hifi-model .si-model-plate{
  min-height:53px!important;
  margin:1px 0 4px!important;
  padding:1px 5px 6px!important;
  border-bottom:0!important;
  align-items:flex-start!important;
  justify-content:center!important;
  text-align:center!important
}
body.si-classroom-model.si-hifi-model .si-model-plate>div{width:100%}
body.si-classroom-model.si-hifi-model .si-model-plate b{
  font-size:16px!important;
  line-height:1!important;
  letter-spacing:.035em!important
}
body.si-classroom-model.si-hifi-model .si-model-plate span{
  margin-top:2px!important;
  color:#d8e2e6!important;
  font-size:7px!important;
  letter-spacing:.11em!important
}
body.si-classroom-model.si-hifi-model .si-model-plate strong{
  display:none!important
}
body.si-classroom-model.si-hifi-model .si-model-brandbar{
  height:18px;
  margin:-10px 10px 7px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:3px;
  background:linear-gradient(180deg,#3a4c55,#263841);
  color:#e7eff1;
  font:800 7px/1 Arial,Helvetica,sans-serif;
  letter-spacing:.08em;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08)
}
body.si-classroom-model.si-hifi-model .si-model-lcd{
  min-height:104px!important;
  margin:0 6px 9px!important;
  padding:8px 9px!important;
  border:5px solid #263840!important;
  border-radius:4px!important;
  background:linear-gradient(180deg,#dce4c6 0,#cbd6b3 100%)!important;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.46),
    inset 0 7px 12px rgba(92,111,78,.08),
    0 2px 0 rgba(255,255,255,.08),
    0 4px 8px rgba(0,0,0,.24)!important;
  font-size:clamp(11px,3.3vw,14px)!important;
  line-height:1.16!important
}
body.si-classroom-model.si-hifi-model .si-model-navpad{
  position:relative;
  width:78px;
  height:43px;
  margin:1px 8px 8px auto;
  border:1px solid #7f8d93;
  border-radius:50%;
  background:
    radial-gradient(circle at 50% 50%,#26373f 0 20%,transparent 22%),
    conic-gradient(from 45deg,#69747a,#3a484f,#778187,#3d4a51,#69747a);
  box-shadow:
    inset 0 1px 2px rgba(255,255,255,.25),
    inset 0 -2px 4px rgba(0,0,0,.26),
    0 2px 3px rgba(0,0,0,.42);
  pointer-events:none
}
body.si-classroom-model.si-hifi-model .si-model-navpad:before{
  content:"";
  position:absolute;
  inset:7px 19px;
  border:1px solid rgba(222,228,230,.26);
  border-radius:50%
}
body.si-classroom-model.si-hifi-model .si-model-navpad:after{
  content:"";
  position:absolute;
  left:50%;
  top:50%;
  width:13px;
  height:13px;
  border-radius:50%;
  transform:translate(-50%,-50%);
  background:#25343b;
  box-shadow:inset 0 1px 1px rgba(255,255,255,.18)
}
body.si-classroom-model.si-hifi-model .si-model-navpad span{
  position:absolute;
  z-index:2;
  color:#d8e0e3;
  font:900 6px/1 Arial,Helvetica,sans-serif;
  opacity:.82
}
body.si-classroom-model.si-hifi-model .si-model-navpad .up{left:50%;top:3px;transform:translateX(-50%)}
body.si-classroom-model.si-hifi-model .si-model-navpad .down{left:50%;bottom:3px;transform:translateX(-50%)}
body.si-classroom-model.si-hifi-model .si-model-navpad .left{left:6px;top:50%;transform:translateY(-50%)}
body.si-classroom-model.si-hifi-model .si-model-navpad .right{right:6px;top:50%;transform:translateY(-50%)}

body.si-classroom-model.si-hifi-model .si-model-keypad{
  gap:5px!important;
  padding:0 3px 2px!important
}
body.si-classroom-model.si-hifi-model .si-model-keypad:before{display:none!important}
body.si-classroom-model.si-hifi-model .si-model-key{
  min-height:34px!important;
  padding:3px 3px!important;
  border-radius:9px!important;
  border-width:1px!important;
  font-size:11px!important;
  line-height:1!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.2),
    0 2px 0 #15242a,
    0 3px 4px rgba(0,0,0,.28)!important
}
body.si-classroom-model.si-hifi-model .si-model-key[data-model-group="function"]{
  border-color:#6c8089!important;
  background:linear-gradient(180deg,#526b76,#344c57)!important
}
body.si-classroom-model.si-hifi-model .si-model-key[data-model-group="number"]{
  border-color:#e6e9e7!important;
  background:linear-gradient(180deg,#f4f4f0 0,#d4d9d6 100%)!important;
  color:#172127!important;
  font-weight:900!important
}
body.si-classroom-model.si-hifi-model .si-model-key[data-model-group="operator"]{
  border-color:#74828d!important;
  background:linear-gradient(180deg,#6c7480,#4b555f)!important;
  color:#fff!important
}
body.si-classroom-model.si-hifi-model .si-model-key[data-model-group="utility"]{
  border-color:#63747c!important;
  background:linear-gradient(180deg,#455b65,#2d4651)!important
}
body.si-classroom-model.si-hifi-model .si-model-key[data-model-group="nav"]{
  border-radius:999px!important;
  background:linear-gradient(180deg,#59676e,#35454c)!important
}
body.si-classroom-model.si-hifi-model .si-model-key[data-action="second"]{
  border-color:#c0df78!important;
  background:linear-gradient(180deg,#cce987,#8fb950)!important;
  color:#18311e!important;
  text-shadow:none!important
}
body.si-classroom-model.si-hifi-model .si-model-key[data-action="clear"],
body.si-classroom-model.si-hifi-model .si-model-key[data-action="delete"],
body.si-classroom-model.si-hifi-model .si-model-key[data-action="del"]{
  border-color:#7e8f98!important;
  background:linear-gradient(180deg,#65727b,#46525b)!important
}
body.si-classroom-model.si-hifi-model .si-model-key[data-action="enter"],
body.si-classroom-model.si-hifi-model .si-model-key[data-action="equals"]{
  border-color:#e5e8e6!important;
  background:linear-gradient(180deg,#f4f4f0,#d2d7d4)!important;
  color:#172127!important;
  text-shadow:none!important
}
body.si-classroom-model.si-hifi-model .si-model-key small,
body.si-classroom-model.si-hifi-model .si-model-key .secondary,
body.si-classroom-model.si-hifi-model .si-model-key .alt,
body.si-classroom-model.si-hifi-model .si-model-key [class*="second"]{
  font-size:7px!important;
  line-height:1!important
}
@media(max-width:430px){
  body.si-classroom-model.si-hifi-model{padding:8px 4px 18px!important}
  body.si-classroom-model.si-hifi-model .si-model-calculator{
    width:min(318px,calc(100vw - 8px))!important;
    padding:10px 27px 25px!important
  }
  body.si-classroom-model.si-hifi-model .si-model-lcd{min-height:96px!important}
  body.si-classroom-model.si-hifi-model .si-model-key{min-height:32px!important}
}
</style>
<script id="v53-7-high-fidelity-calculator-modeling-script">
(function(){
  function applyHighFidelityModel(){
    if(!document.body)return;
    document.body.classList.add('si-hifi-model');
    const plate=document.querySelector('.si-model-plate');
    if(plate){
      plate.innerHTML='<div><b>SI Scientific</b><span>Multi-View · 4-Line</span></div><strong>Classroom</strong>';
      if(!plate.parentElement.querySelector(':scope > .si-model-brandbar')){
        const brand=document.createElement('div');
        brand.className='si-model-brandbar';
        brand.textContent='SI CLASSROOM SCIENTIFIC';
        plate.insertAdjacentElement('afterend',brand);
      }
    }
    const keys=Array.from(document.querySelectorAll('[data-action]'));
    keys.forEach(function(key){
      const action=String(key.dataset.action||'').toLowerCase();
      const label=String(key.textContent||'').replace(/\s+/g,' ').trim();
      let group=key.dataset.modelGroup||'function';
      if((/^[0-9](?:\s|$)/.test(label)||['decimal','negate','sign'].includes(action))&&!/[A-Za-z]/.test(label))group='number';
      if(key.classList.contains('operator')||['add','subtract','multiply','divide','enter','equals'].includes(action))group='operator';
      if(['second','clear','delete','del','mode'].includes(action))group='utility';
      if(/^(left|right|up|down|nav|cursor)/.test(action))group='nav';
      key.dataset.modelGroup=group;
    });
    const keypad=document.querySelector('.si-model-keypad')||document.querySelector('.keypad');
    if(keypad&&keypad.parentElement&&!keypad.parentElement.querySelector(':scope > .si-model-navpad')){
      const nav=document.createElement('div');
      nav.className='si-model-navpad';
      nav.setAttribute('aria-hidden','true');
      nav.innerHTML='<span class="up">▲</span><span class="right">▶</span><span class="down">▼</span><span class="left">◀</span>';
      keypad.insertAdjacentElement('beforebegin',nav);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyHighFidelityModel,{once:true});
  else applyHighFidelityModel();
})();
</script>
<style id="v55-14-reference-calculator-layout">
/* v55.14 — reference-driven physical layout.
   Keeps SI branding while matching the real classroom calculator's proportions,
   control deck, 5-column keypad, key hierarchy, and silver-rail silhouette. */
body.si-classroom-model.si-hifi-model .si-model-calculator{
  width:min(318px,calc(100vw - 20px))!important;
  max-width:300px!important;
  padding:10px 27px 24px!important;
  border:1px solid #c2c8ca!important;
  border-radius:24px 24px 62px 62px / 20px 20px 48px 48px!important;
  background:
    linear-gradient(90deg,
      #e0e3e4 0 8%,
      #bcc5c8 8% 10.2%,
      #3b6675 10.2% 89.8%,
      #bcc5c8 89.8% 92%,
      #e0e3e4 92% 100%)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.9),
    inset 7px 0 9px rgba(255,255,255,.24),
    inset -7px 0 9px rgba(0,0,0,.08),
    0 20px 44px rgba(0,0,0,.38)!important
}
body.si-classroom-model.si-hifi-model .si-model-calculator:before{
  left:25px!important;
  right:25px!important;
  top:4px!important;
  bottom:17px!important;
  border-radius:15px 15px 47px 47px / 12px 12px 37px 37px!important;
  background:
    linear-gradient(180deg,#496f7d 0,#406b79 31%,#3a6674 66%,#345e6d 100%)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.11),
    inset 0 -8px 16px rgba(0,0,0,.11)!important
}

/* Model name → solar panel → maker line → LCD, matching the physical vertical rhythm. */
body.si-classroom-model.si-hifi-model .si-model-plate{
  min-height:31px!important;
  margin:0 7px!important;
  padding:0!important;
  display:flex!important;
  align-items:flex-start!important;
  justify-content:center!important;
  border:0!important
}
body.si-classroom-model.si-hifi-model .si-model-plate b{
  font-size:13px!important;
  line-height:1!important;
  letter-spacing:.025em!important
}
body.si-classroom-model.si-hifi-model .si-model-plate span{
  margin-top:1px!important;
  font-size:6px!important;
  font-style:italic;
  letter-spacing:.16em!important
}
body.si-classroom-model.si-hifi-model .si-ref-solar{
  width:88px;
  height:24px;
  margin:-1px auto 4px;
  border:1px solid #29414b;
  border-radius:5px;
  background:
    repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0 1px,transparent 1px 22px),
    linear-gradient(180deg,#403a3c,#28282b);
  box-shadow:inset 0 1px 3px rgba(0,0,0,.65),0 1px 0 rgba(255,255,255,.08)
}
body.si-classroom-model.si-hifi-model .si-model-brandbar{
  height:15px!important;
  margin:0 12px 5px!important;
  padding:0!important;
  gap:5px;
  background:transparent!important;
  border:0!important;
  color:#eef3f4!important;
  font-size:6px!important;
  font-weight:800!important;
  letter-spacing:.045em!important;
  box-shadow:none!important
}
body.si-classroom-model.si-hifi-model .si-model-brandbar:before{
  content:"SI";
  width:13px;
  height:13px;
  display:grid;
  place-items:center;
  border-radius:50%;
  background:#267ca0;
  color:#fff;
  font:900 5px/1 Arial,Helvetica,sans-serif
}
body.si-classroom-model.si-hifi-model .si-model-lcd{
  min-height:88px!important;
  margin:0 8px 7px!important;
  padding:7px 8px!important;
  border:5px solid #31515b!important;
  border-radius:3px 3px 10px 10px!important;
  background:linear-gradient(180deg,#d9decf,#c9d0c1)!important;
  color:#1c2825!important;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.5),
    inset 0 5px 9px rgba(74,85,70,.08),
    0 2px 0 rgba(255,255,255,.08),
    0 3px 5px rgba(0,0,0,.19)!important
}

/* Exact physical organization: three top controls on the left, navigation pad on the right. */
body.si-classroom-model.si-hifi-model .si-ref-control-deck{
  position:relative;
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr)) 31px 31px;
  grid-template-rows:33px 15px;
  column-gap:5px;
  row-gap:2px;
  align-items:center;
  margin:2px 5px 4px;
  padding:0 1px
}
body.si-classroom-model.si-hifi-model .si-ref-control-deck>.si-model-key{
  min-height:29px!important;
  height:29px!important;
  padding:2px 3px!important;
  border-radius:13px!important;
  font-size:9px!important
}
body.si-classroom-model.si-hifi-model .si-ref-control-deck>[data-action="second"]{
  grid-column:1;grid-row:1
}
body.si-classroom-model.si-hifi-model .si-ref-control-deck>[data-action="mode"]{
  grid-column:2;grid-row:1
}
body.si-classroom-model.si-hifi-model .si-ref-control-deck>[data-ref-delete="1"]{
  grid-column:3;grid-row:1
}
body.si-classroom-model.si-hifi-model .si-ref-clear-legend{
  grid-column:3;
  grid-row:2;
  align-self:start;
  justify-self:center;
  margin:-1px 0 0;
  padding:0 2px;
  border:0;
  background:transparent;
  color:#a9c96b;
  font:900 6px/1 Arial,Helvetica,sans-serif;
  letter-spacing:.02em;
  cursor:pointer
}
body.si-classroom-model.si-hifi-model .si-ref-clear-legend:hover{
  color:#c5e580;
  text-decoration:underline
}
body.si-classroom-model.si-hifi-model .si-ref-control-deck .si-model-navpad{
  grid-column:4 / 6;
  grid-row:1 / 3;
  width:65px!important;
  height:48px!important;
  margin:0!important;
  align-self:center;
  justify-self:center;
  border:4px solid #e3e5e5!important;
  background:
    radial-gradient(circle at 50% 50%,#443f45 0 19%,transparent 21%),
    conic-gradient(from 45deg,#575158,#332f35,#615a62,#373239,#575158)!important;
  box-shadow:
    inset 0 1px 2px rgba(255,255,255,.2),
    inset 0 -2px 4px rgba(0,0,0,.28),
    0 2px 2px rgba(0,0,0,.3)!important
}
body.si-classroom-model.si-hifi-model .si-ref-control-deck .si-model-navpad:before{
  inset:7px 15px!important
}
body.si-classroom-model.si-hifi-model .si-ref-control-deck .si-model-navpad:after{
  width:11px!important;height:11px!important;background:#3b373d!important
}

/* The remaining real controls form the physical calculator's 7 x 5 key matrix. */
body.si-classroom-model.si-hifi-model .si-model-keypad{
  display:grid!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  grid-auto-flow:row!important;
  gap:5px 6px!important;
  margin:0 5px!important;
  padding:0!important
}
body.si-classroom-model.si-hifi-model .si-model-keypad>.si-model-key{
  min-width:0!important;
  min-height:27px!important;
  height:27px!important;
  padding:2px 2px!important;
  border-radius:11px!important;
  font-size:9px!important;
  line-height:.95!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.18),
    0 2px 0 #183039,
    0 3px 3px rgba(0,0,0,.26)!important
}
body.si-classroom-model.si-hifi-model .si-model-keypad>.si-model-key[data-model-group="function"],
body.si-classroom-model.si-hifi-model .si-model-keypad>.si-model-key[data-model-group="utility"]{
  border-color:#54717d!important;
  background:linear-gradient(180deg,#456a78,#315562)!important;
  color:#f4f7f8!important
}
body.si-classroom-model.si-hifi-model .si-model-keypad>.si-model-key[data-model-group="number"]{
  border-color:#e3e6e4!important;
  background:linear-gradient(180deg,#f5f4f1,#d9dcda)!important;
  color:#1d2529!important;
  font-size:11px!important
}
body.si-classroom-model.si-hifi-model .si-model-keypad>.si-model-key[data-model-group="operator"]{
  border-color:#79737c!important;
  background:linear-gradient(180deg,#716a73,#514b54)!important;
  color:#fff!important;
  font-size:12px!important
}
body.si-classroom-model.si-hifi-model .si-model-keypad>.si-model-key[data-action="enter"],
body.si-classroom-model.si-hifi-model .si-model-keypad>.si-model-key[data-action="equals"]{
  border-color:#e1dfe1!important;
  background:linear-gradient(180deg,#f2edf1,#d6d1d5)!important;
  color:#27232a!important;
  font-size:8px!important
}
body.si-classroom-model.si-hifi-model .si-model-key small,
body.si-classroom-model.si-hifi-model .si-model-key .secondary,
body.si-classroom-model.si-hifi-model .si-model-key .alt,
body.si-classroom-model.si-hifi-model .si-model-key [class*="second"]{
  color:#b3d46d!important;
  font-size:5.5px!important;
  line-height:.9!important
}
body.si-classroom-model.si-hifi-model .si-model-keypad>.si-model-key[data-model-group="number"] small,
body.si-classroom-model.si-hifi-model .si-model-keypad>.si-model-key[data-model-group="number"] .secondary,
body.si-classroom-model.si-hifi-model .si-model-keypad>.si-model-key[data-model-group="number"] .alt{
  color:#7b9a40!important
}
body.si-classroom-model.si-hifi-model .si-ref-hidden-clear{
  display:none!important
}
@media(max-width:430px){
  body.si-classroom-model.si-hifi-model .si-model-calculator{
    width:min(310px,calc(100vw - 6px))!important;
    padding:9px 25px 22px!important
  }
}
</style>
<script id="v55-14-reference-calculator-layout-script">
(function(){
  function actionOf(key){return String(key&&key.dataset&&key.dataset.action||'').toLowerCase()}
  function findKey(keys,names){
    return keys.find(function(k){return names.includes(actionOf(k))})||null
  }
  function applyReferenceLayout(){
    if(!document.body)return;
    document.body.classList.add('si-reference-layout');
    const calc=document.querySelector('.si-model-calculator');
    const keypad=document.querySelector('.si-model-keypad')||document.querySelector('.keypad');
    if(!calc||!keypad)return;
    const plate=calc.querySelector('.si-model-plate');
    if(plate){
      plate.innerHTML='<div><b>SI SCIENTIFIC</b><span>MULTI-VIEW · 4-LINE</span></div>';
      if(!calc.querySelector('.si-ref-solar')){
        const solar=document.createElement('div');
        solar.className='si-ref-solar';
        plate.insertAdjacentElement('afterend',solar);
      }
    }
    const brand=calc.querySelector('.si-model-brandbar');
    if(brand)brand.textContent='SI MOTHERSHIP';

    const keys=Array.from(keypad.querySelectorAll(':scope > [data-action]'));
    const second=findKey(keys,['second']);
    const mode=findKey(keys,['mode']);
    const del=findKey(keys,['delete','del']);
    const clear=findKey(keys,['clear']);
    const top=[second,mode,del].filter(Boolean);

    let nav=calc.querySelector('.si-model-navpad');
    let deck=calc.querySelector('.si-ref-control-deck');
    if(!deck){
      deck=document.createElement('div');
      deck.className='si-ref-control-deck';
      keypad.insertAdjacentElement('beforebegin',deck);
    }
    top.forEach(function(key){deck.appendChild(key)});
    if(del)del.dataset.refDelete='1';
    if(nav)deck.appendChild(nav);

    if(clear){
      clear.classList.add('si-ref-hidden-clear');
      clear.hidden=true;
      let clearLegend=deck.querySelector('.si-ref-clear-legend');
      if(!clearLegend){
        clearLegend=document.createElement('button');
        clearLegend.type='button';
        clearLegend.className='si-ref-clear-legend';
        clearLegend.textContent='clear';
        clearLegend.setAttribute('aria-label','Clear calculator');
        clearLegend.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();clear.click()});
        deck.appendChild(clearLegend);
      }
    }
    const remaining=Array.from(keypad.querySelectorAll(':scope > [data-action]')).filter(function(k){return !k.hidden});
    remaining.forEach(function(key,index){key.dataset.refMatrixIndex=String(index)});
    keypad.dataset.refMatrixCount=String(remaining.length);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyReferenceLayout,{once:true});
  else applyReferenceLayout();
})();
</script>
<style id="v55-15-physical-calculator-layout">
/* v55.15 — physical reference pass.
   Explicit key slots and proportions follow the classroom reference calculator,
   while all branding remains SI Mothership. */
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-calculator{
  width:min(300px,calc(100vw - 14px))!important;
  max-width:300px!important;
  padding:9px 28px 23px!important;
  border-radius:22px 22px 58px 58px / 18px 18px 45px 45px!important;
  background:
    linear-gradient(90deg,
      #e5e7e7 0 7.2%,
      #c9cfd1 7.2% 9.4%,
      #3f6977 9.4% 90.6%,
      #c9cfd1 90.6% 92.8%,
      #e5e7e7 92.8% 100%)!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-calculator:before{
  left:25px!important;
  right:25px!important;
  top:4px!important;
  bottom:15px!important;
  border-radius:14px 14px 44px 44px / 11px 11px 34px 34px!important;
  background:linear-gradient(180deg,#4a7280 0,#416d7b 35%,#3a6674 72%,#355f6d 100%)!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-plate{
  min-height:26px!important;
  margin:0 9px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-plate b{
  font-size:12px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-solar{
  width:84px!important;
  height:22px!important;
  margin:-1px auto 3px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-brandbar{
  height:13px!important;
  margin:0 13px 4px!important;
  font-size:5.5px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-lcd{
  min-height:82px!important;
  height:82px!important;
  margin:0 9px 7px!important;
  padding:6px 7px!important;
  border-width:4px!important;
  border-radius:3px 3px 8px 8px!important
}

/* Top physical control deck: 2nd, mode, delete, then the oval/circular nav cluster. */
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-control-deck{
  grid-template-columns:40px 40px 40px 29px 29px!important;
  grid-template-rows:29px 13px!important;
  column-gap:5px!important;
  row-gap:1px!important;
  margin:1px 7px 4px!important;
  padding:0!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-control-deck>.si-model-key{
  min-height:26px!important;
  height:26px!important;
  padding:2px!important;
  border-radius:7px!important;
  font-size:8px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-control-deck>[data-action="second"]{
  border-color:#a9ce55!important;
  background:linear-gradient(180deg,#b8df64,#93bc43)!important;
  color:#132015!important;
  text-shadow:none!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-control-deck .si-model-navpad{
  width:58px!important;
  height:45px!important;
  border-width:3px!important;
  border-color:#d6d8d9!important;
  border-radius:50%!important;
  background:
    radial-gradient(circle at 50% 50%,#4c474d 0 18%,transparent 20%),
    conic-gradient(from 45deg,#6b656c,#403b41,#6e676f,#403a40,#6b656c)!important
}

/* Exact physical 7 x 5 matrix. JS sets row/column explicitly per key identity. */
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad{
  display:grid!important;
  grid-template-columns:repeat(5,1fr)!important;
  grid-template-rows:repeat(7,25px)!important;
  grid-auto-flow:row!important;
  gap:4px 5px!important;
  margin:0 7px!important;
  padding:0!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key{
  min-height:25px!important;
  height:25px!important;
  padding:1px 2px!important;
  border-radius:8px!important;
  font-size:8px!important;
  line-height:.9!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="1"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="3"]{
  background:linear-gradient(180deg,#476d7b,#315865)!important;
  border-color:#577782!important;
  color:#f6f8f8!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-col="5"]{
  background:linear-gradient(180deg,#635e65,#474249)!important;
  border-color:#777179!important;
  color:#fff!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="7"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="7"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="7"][data-ref-col="4"]{
  background:linear-gradient(180deg,#f5f4f1,#d9dcda)!important;
  border-color:#e4e7e5!important;
  color:#182125!important;
  font-size:10px!important;
  text-shadow:none!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-role="enter"]{
  background:linear-gradient(180deg,#efedf0,#d5d2d5)!important;
  border-color:#dedcdf!important;
  color:#27232a!important;
  font-size:7px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key small,
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key .secondary,
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key .alt,
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key [class*="second"]{
  font-size:5px!important;
  color:#bedb72!important
}
@media(max-width:430px){
  body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-calculator{
    width:min(296px,calc(100vw - 4px))!important;
    padding:8px 27px 21px!important
  }
}
</style>
<script id="v55-15-physical-calculator-layout-script">
(function(){
  function actionOf(k){return String(k&&k.dataset&&k.dataset.action||'').toLowerCase()}
  function textOf(k){return String(k&&k.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
  function keyBlob(k){return actionOf(k)+' '+textOf(k)}
  function matches(k,tests){const blob=keyBlob(k);return tests.some(function(t){return t.test(blob)})}
  function applyPhysicalKeyMap(){
    const keypad=document.querySelector('.si-model-keypad');
    if(!keypad)return;
    let pool=Array.from(keypad.querySelectorAll(':scope > [data-action]')).filter(function(k){return !k.hidden});
    function take(tests){
      const idx=pool.findIndex(function(k){return matches(k,tests)});
      if(idx<0)return null;
      return pool.splice(idx,1)[0];
    }
    function digit(n){return take([new RegExp('(?:^|\\s)(?:digit[-_ ]?)?'+n+'(?:\\s|$)')])}
    const slots=[
      [[/\blog\b/],[/\bln\b|natural.?log/],[/fraction|frac|n\/?d/],[/\bee\b|exponent|sci.?notation/],[/f.?[↔<>].?d|toggle.?frac|decimal.?fraction/]],
      [[/\bpi\b|π/],[/\bsin\b/],[/\bcos\b/],[/\btan\b/],[/divide|÷/]],
      [[/power|x\^|\^/],[/reciprocal|1\s*\/\s*x/],[/lparen|left.?paren|\(/],[/rparen|right.?paren|\)/],[/multiply|×|\*/]],
      [[/square|x²|x2/],null,null,null,[/subtract|minus|−/]],
      [[/sqrt|root|√/],null,null,null,[/\badd\b|plus|\+/]],
      [[/\bsto\b|store/],null,null,null,[/^e$|\beuler\b|constant.?e/]],
      [[/\bon\b|power.?on/],null,[/decimal|\./],[/negate|sign|\(−\)|\(-\)/],[/enter|equals|=/]]
    ];
    const placed=[];
    for(let r=0;r<7;r++){
      for(let c=0;c<5;c++){
        let key=null;
        if(r===3&&c>=1&&c<=3)key=digit(10-c);      /* 7 8 9 */
        else if(r===4&&c>=1&&c<=3)key=digit(7-c);  /* 4 5 6 */
        else if(r===5&&c>=1&&c<=3)key=digit(4-c);  /* 1 2 3 */
        else if(r===6&&c===1)key=digit(0);
        else if(slots[r][c])key=take(slots[r][c]);
        if(!key&&pool.length)key=pool.shift();
        if(!key)continue;
        key.dataset.refRow=String(r+1);
        key.dataset.refCol=String(c+1);
        key.style.gridRow=String(r+1);
        key.style.gridColumn=String(c+1);
        if(r===6&&c===4)key.dataset.refRole='enter';
        placed.push(key);
      }
    }
    pool.forEach(function(key,index){
      const slot=placed.length+index;
      const r=Math.min(7,Math.floor(slot/5)+1),c=(slot%5)+1;
      key.dataset.refRow=String(r);
      key.dataset.refCol=String(c);
      key.style.gridRow=String(r);
      key.style.gridColumn=String(c);
      placed.push(key);
    });
    placed.forEach(function(key){keypad.appendChild(key)});
    keypad.dataset.refPhysicalMapped='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyPhysicalKeyMap,{once:true});
  else applyPhysicalKeyMap();
})();
</script>
<style id="v55-16-calculator-visual-fidelity">
/* v55.16 — closer physical-reference proportions while preserving SI branding. */
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-calculator{
  width:min(294px,calc(100vw - 10px))!important;
  max-width:294px!important;
  padding:8px 27px 22px!important;
  border:1px solid #d4d8d9!important;
  border-radius:18px 18px 58px 58px / 15px 15px 46px 46px!important;
  background:
    linear-gradient(90deg,
      #eef0ef 0 6.8%,
      #d0d5d6 6.8% 9.1%,
      #416b79 9.1% 90.9%,
      #d0d5d6 90.9% 93.2%,
      #eef0ef 93.2% 100%)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.95),
    inset 6px 0 9px rgba(255,255,255,.32),
    inset -6px 0 9px rgba(0,0,0,.08),
    0 16px 34px rgba(0,0,0,.31)!important;
  clip-path:polygon(7% 0,93% 0,97% 2%,99% 9%,100% 82%,98% 91%,92% 97%,79% 100%,21% 100%,8% 97%,2% 91%,0 82%,1% 9%,3% 2%)
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-calculator:before{
  left:23px!important;
  right:23px!important;
  top:3px!important;
  bottom:14px!important;
  border-radius:11px 11px 44px 44px / 9px 9px 34px 34px!important;
  background:
    linear-gradient(180deg,#4b7482 0,#426f7e 32%,#3b6877 67%,#345f6e 100%)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.11),
    inset 0 -10px 16px rgba(0,0,0,.12)!important
}

/* Compact model / solar / maker / LCD stack. */
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-plate{
  min-height:24px!important;
  margin:0 12px!important;
  padding:0!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-plate b{
  font-size:11px!important;
  letter-spacing:.02em!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-plate span{
  margin-top:0!important;
  font-size:5.4px!important;
  letter-spacing:.13em!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-solar{
  width:82px!important;
  height:17px!important;
  margin:0 auto 2px!important;
  border-radius:2px!important;
  background:
    repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0 1px,transparent 1px 20px),
    linear-gradient(180deg,#37383a,#252628)!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-brandbar{
  height:11px!important;
  margin:0 15px 3px!important;
  font-size:5px!important;
  letter-spacing:.035em!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-brandbar:before{
  width:10px!important;
  height:10px!important;
  font-size:4px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-lcd{
  min-height:74px!important;
  height:74px!important;
  margin:0 8px 8px!important;
  padding:5px 7px!important;
  border:4px solid #31505a!important;
  border-radius:3px 3px 8px 8px!important;
  background:linear-gradient(180deg,#d9dfd0,#c8d0bf)!important;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.48),
    inset 0 4px 8px rgba(75,86,70,.08),
    0 2px 0 rgba(255,255,255,.07),
    0 3px 4px rgba(0,0,0,.18)!important
}

/* Upper controls are compact pills; nav sits in a bright physical bezel. */
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-control-deck{
  grid-template-columns:37px 37px 37px 27px 27px!important;
  grid-template-rows:24px 12px!important;
  column-gap:5px!important;
  row-gap:1px!important;
  margin:0 8px 6px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-control-deck>.si-model-key{
  min-height:22px!important;
  height:22px!important;
  border-radius:999px!important;
  padding:1px 2px!important;
  font-size:7px!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.18),
    0 2px 0 #17303a,
    0 3px 4px rgba(0,0,0,.22)!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-control-deck>[data-action="second"]{
  background:linear-gradient(180deg,#b8df5c,#91bd3c)!important;
  border-color:#b8dc67!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-clear-legend{
  margin:-2px 0 0!important;
  color:#b7d45d!important;
  font-size:5.3px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-control-deck .si-model-navpad{
  width:54px!important;
  height:40px!important;
  border:2px solid #575259!important;
  border-radius:50%!important;
  outline:6px solid #eef0ef!important;
  outline-offset:0!important;
  background:
    radial-gradient(circle at 50% 50%,#443f45 0 18%,transparent 20%),
    conic-gradient(from 45deg,#6b646c,#38343a,#746c74,#39343a,#6b646c)!important;
  box-shadow:
    inset 0 1px 2px rgba(255,255,255,.18),
    inset 0 -2px 4px rgba(0,0,0,.3),
    0 2px 3px rgba(0,0,0,.28)!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-control-deck .si-model-navpad:before{
  inset:6px 13px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-ref-control-deck .si-model-navpad:after{
  width:9px!important;
  height:9px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-navpad span{
  font-size:5px!important
}

/* Reference keypad rhythm: three small function rows, then larger lower keys. */
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad{
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  grid-template-rows:22px 22px 22px 25px 25px 25px 25px!important;
  gap:7px 5px!important;
  margin:0 8px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key{
  min-height:0!important;
  height:100%!important;
  padding:1px 2px!important;
  border-radius:9px!important;
  font-size:7px!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.17),
    0 2px 0 #18313a,
    0 3px 3px rgba(0,0,0,.24)!important;
  position:relative!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="1"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="3"]{
  border-radius:999px!important;
  background:linear-gradient(180deg,#4c7381,#315966)!important;
  border-color:#597987!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-col="5"]{
  border-radius:999px!important;
  background:linear-gradient(180deg,#645d65,#484149)!important;
  border-color:#746e75!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="7"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="7"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-row="7"][data-ref-col="4"]{
  border-radius:7px 5px 7px 5px!important;
  background:linear-gradient(180deg,#faf9f6,#dfe2df)!important;
  border-color:#e5e8e6!important;
  color:#1b2226!important;
  font-size:9px!important;
  text-shadow:none!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-col="1"][data-ref-row="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-col="1"][data-ref-row="5"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-col="1"][data-ref-row="6"],
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-col="1"][data-ref-row="7"]{
  border-radius:999px!important;
  background:linear-gradient(180deg,#426b79,#2e5663)!important;
  border-color:#537783!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key[data-ref-role="enter"]{
  border-radius:999px!important;
  background:linear-gradient(180deg,#f7f2f5,#dcd7db)!important;
  color:#27232a!important
}

/* Secondary legends sit visually above their primary key like the physical device. */
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key small,
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key .secondary,
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key .alt,
body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-keypad>.si-model-key [class*="second"]{
  position:absolute!important;
  left:2px!important;
  top:-6px!important;
  width:max-content!important;
  max-width:calc(100% + 6px)!important;
  overflow:hidden!important;
  color:#b8d75f!important;
  font-size:4.6px!important;
  line-height:1!important;
  text-shadow:none!important;
  pointer-events:none!important
}

@media(max-width:430px){
  body.si-classroom-model.si-hifi-model.si-reference-layout .si-model-calculator{
    width:min(290px,calc(100vw - 4px))!important;
    padding:8px 26px 21px!important
  }
}
</style>

<style id="v55-17-reference-calculator-layout">
/* v55.17 — final reference-layout correction.
   Structure follows the classroom reference: 3-row upper control area around
   the nav pad, then a 6 x 5 lower keypad. SI branding is retained. */
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-calculator{
  width:min(286px,calc(100vw - 8px))!important;
  max-width:286px!important;
  padding:7px 26px 23px!important;
  border:1px solid #d9dcdd!important;
  border-radius:17px 17px 61px 61px / 14px 14px 48px 48px!important;
  background:
    linear-gradient(90deg,
      #f2f3f2 0 6.4%,
      #d5dadb 6.4% 9%,
      #456d7b 9% 91%,
      #d5dadb 91% 93.6%,
      #f2f3f2 93.6% 100%)!important;
  clip-path:polygon(7% 0,93% 0,97.5% 1.8%,99.3% 8%,100% 82%,98.5% 91%,93% 97%,80% 100%,20% 100%,7% 97%,1.5% 91%,0 82%,.7% 8%,2.5% 1.8%)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.98),
    inset 7px 0 10px rgba(255,255,255,.34),
    inset -7px 0 10px rgba(0,0,0,.075),
    0 16px 32px rgba(0,0,0,.3)!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-calculator:before{
  left:22px!important;
  right:22px!important;
  top:3px!important;
  bottom:13px!important;
  border-radius:10px 10px 47px 47px / 8px 8px 37px 37px!important;
  background:
    linear-gradient(180deg,#4c7482 0,#456f7d 31%,#3f6977 65%,#376271 100%)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.11),
    inset 0 -12px 17px rgba(0,0,0,.12)!important
}

/* Reference-like model name / solar / maker / LCD stack. */
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-plate{
  min-height:27px!important;
  margin:0 10px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-plate b{
  font-size:12px!important;
  letter-spacing:.015em!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-plate span{
  margin-top:1px!important;
  font-size:5.7px!important;
  font-style:italic!important;
  letter-spacing:.17em!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-solar{
  width:88px!important;
  height:22px!important;
  margin:-1px auto 3px!important;
  border:1px solid #2c424b!important;
  border-radius:4px!important;
  background:
    repeating-linear-gradient(90deg,rgba(255,255,255,.022) 0 1px,transparent 1px 22px),
    linear-gradient(180deg,#454043,#2c2b2e)!important;
  box-shadow:
    inset 0 1px 3px rgba(0,0,0,.62),
    0 1px 0 rgba(255,255,255,.07)!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-brandbar{
  height:13px!important;
  margin:0 13px 4px!important;
  font-size:5.3px!important;
  letter-spacing:.04em!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-brandbar:before{
  width:11px!important;
  height:11px!important;
  font-size:4.2px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-lcd{
  min-height:80px!important;
  height:80px!important;
  margin:0 7px 7px!important;
  padding:6px 8px!important;
  border:4px solid #2f4d57!important;
  border-radius:3px 3px 9px 9px!important;
  background:linear-gradient(180deg,#d9ded1,#c8d0c1)!important;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.5),
    inset 0 5px 9px rgba(78,88,73,.08),
    0 2px 0 rgba(255,255,255,.07),
    0 3px 5px rgba(0,0,0,.2)!important
}

/* Three physical upper rows. Nav occupies columns 4-5 across rows 1-2. */
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-control-deck{
  position:relative!important;
  display:grid!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  grid-template-rows:22px 22px 22px!important;
  column-gap:5px!important;
  row-gap:7px!important;
  margin:0 7px 10px!important;
  padding:0!important;
  align-items:center!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-control-deck:after{
  content:"";
  position:absolute;
  z-index:0;
  right:-18px;
  top:-3px;
  width:96px;
  height:57px;
  border-radius:32px 0 0 32px;
  background:
    linear-gradient(90deg,#f3f4f3 0,#e2e5e5 73%,#d3d8d9 100%);
  box-shadow:
    inset 1px 0 0 rgba(255,255,255,.9),
    inset 0 -1px 0 rgba(0,0,0,.045);
  pointer-events:none
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-control-deck>*{
  position:relative;
  z-index:1
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-control-deck>.si-model-key,
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-control-deck>.si-ref-placeholder{
  min-width:0!important;
  min-height:21px!important;
  height:21px!important;
  padding:1px 2px!important;
  border:1px solid #56717c!important;
  border-radius:999px!important;
  background:linear-gradient(180deg,#50717e,#345762)!important;
  color:#f3f6f7!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.18),
    0 2px 0 #173039,
    0 3px 3px rgba(0,0,0,.22)!important;
  font:800 6.8px/.95 Arial,Helvetica,sans-serif!important;
  text-shadow:0 1px 0 rgba(0,0,0,.28)!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-control-deck>[data-action="second"]{
  background:linear-gradient(180deg,#b9df5b,#91bd3d)!important;
  border-color:#bfe16e!important;
  color:#152314!important;
  text-shadow:none!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-placeholder{
  opacity:.82;
  cursor:not-allowed
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-control-deck .si-model-navpad{
  grid-column:4 / 6!important;
  grid-row:1 / 3!important;
  width:72px!important;
  height:48px!important;
  margin:0!important;
  align-self:center!important;
  justify-self:center!important;
  border:2px solid #4d484f!important;
  border-radius:50%!important;
  outline:0!important;
  background:
    radial-gradient(circle at 50% 50%,#4b464c 0 18%,transparent 20%),
    conic-gradient(from 45deg,#716a71,#3d383e,#746d74,#3d383f,#716a71)!important;
  box-shadow:
    inset 0 1px 2px rgba(255,255,255,.18),
    inset 0 -2px 4px rgba(0,0,0,.3),
    0 2px 3px rgba(0,0,0,.3)!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-control-deck .si-model-navpad:before{
  inset:7px 17px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-control-deck .si-model-navpad:after{
  width:10px!important;
  height:10px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-navpad span{
  font-size:5px!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-ref-clear-legend{
  display:none!important
}

/* Actual lower face is six rows by five columns. */
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad{
  display:grid!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  grid-template-rows:22px 22px 25px 25px 25px 26px!important;
  grid-auto-flow:row!important;
  gap:7px 5px!important;
  margin:0 7px!important;
  padding:0!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key{
  min-width:0!important;
  min-height:0!important;
  height:100%!important;
  padding:1px 2px!important;
  border-radius:999px!important;
  font-size:7px!important;
  line-height:.9!important;
  position:relative!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.17),
    0 2px 0 #18313a,
    0 3px 3px rgba(0,0,0,.24)!important
}

/* Function keys are teal; arithmetic operators are plum/charcoal. */
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="1"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-col="1"]{
  background:linear-gradient(180deg,#4d7481,#335b67)!important;
  border-color:#5b7b87!important;
  color:#f6f8f8!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="1"][data-ref-col="5"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="2"][data-ref-col="5"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="3"][data-ref-col="5"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="5"]{
  background:linear-gradient(180deg,#675f67,#49434b)!important;
  border-color:#777079!important;
  color:#fff!important;
  font-size:10px!important
}

/* White numeric block and white lower-right answer/enter caps. */
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="3"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="3"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="3"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="5"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="5"]{
  border-radius:8px 5px 8px 5px!important;
  background:linear-gradient(180deg,#faf9f7,#dfe2df)!important;
  border-color:#e7e9e7!important;
  color:#1b2226!important;
  text-shadow:none!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="3"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="3"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="3"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="4"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="4"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="2"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="3"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="4"]{
  font-size:9.5px!important;
  font-weight:900!important
}
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="5"][data-ref-col="5"],
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-keypad>.si-model-key[data-ref-row="6"][data-ref-col="5"]{
  border-radius:999px!important;
  font-size:7px!important
}

/* Physical second-function legends live in the gap above each key. */
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-key small,
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-key .secondary,
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-key .alt,
body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-key [class*="second"]{
  position:absolute!important;
  left:2px!important;
  top:-6px!important;
  color:#b9d663!important;
  font-size:4.5px!important;
  line-height:1!important;
  text-shadow:none!important;
  pointer-events:none!important
}

@media(max-width:430px){
  body.si-classroom-model.si-hifi-model.si-reference-layout.si-reference-accurate .si-model-calculator{
    width:min(282px,calc(100vw - 4px))!important;
    padding:7px 25px 22px!important
  }
}
</style>
<script id="v55-17-reference-calculator-layout-script">
(function(){
  function actionOf(k){return String(k&&k.dataset&&k.dataset.action||'').toLowerCase()}
  function textOf(k){return String(k&&k.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
  function blobOf(k){return actionOf(k)+' '+textOf(k)}
  function applyReferenceAccurateLayout(){
    if(!document.body)return;
    const calc=document.querySelector('.si-model-calculator');
    const keypad=document.querySelector('.si-model-keypad');
    const deck=document.querySelector('.si-ref-control-deck');
    if(!calc||!keypad||!deck)return;
    document.body.classList.add('si-reference-accurate');

    const legend=deck.querySelector('.si-ref-clear-legend');
    if(legend)legend.remove();
    deck.querySelectorAll('.si-ref-placeholder').forEach(function(p){p.remove()});

    const all=Array.from(new Set([
      ...deck.querySelectorAll('[data-action]'),
      ...keypad.querySelectorAll('[data-action]')
    ]));
    all.forEach(function(k){
      k.hidden=false;
      k.classList.remove('si-ref-hidden-clear');
      delete k.dataset.refRow;
      delete k.dataset.refCol;
      delete k.dataset.refRole;
      k.style.gridRow='';
      k.style.gridColumn='';
    });
    const used=new Set();
    function take(tests){
      const key=all.find(function(k){
        if(used.has(k))return false;
        const blob=blobOf(k);
        return tests.some(function(t){return t.test(blob)});
      })||null;
      if(key)used.add(key);
      return key;
    }
    function takeDigit(n){
      return take([new RegExp('(?:^|\\s)(?:digit[-_ ]?)?'+n+'(?:\\s|$)')]);
    }
    function place(el,parent,row,col,rowSpan=1,colSpan=1){
      if(!el)return;
      parent.appendChild(el);
      el.style.gridRow=rowSpan>1?row+' / span '+rowSpan:String(row);
      el.style.gridColumn=colSpan>1?col+' / span '+colSpan:String(col);
      el.dataset.refRow=String(row);
      el.dataset.refCol=String(col);
    }
    function placeholder(label,row,col){
      const p=document.createElement('button');
      p.type='button';
      p.disabled=true;
      p.className='si-ref-placeholder';
      p.textContent=label;
      p.title=label+' position from the physical reference; not available in this SI build';
      p.setAttribute('aria-label',p.title);
      place(p,deck,row,col);
      return p;
    }

    const second=take([/\bsecond\b|\b2nd\b/]);
    const mode=take([/\bmode\b/]);
    const del=take([/delete|\bdel\b/]);
    const log=take([/\blog\b/]);
    const prb=take([/\bprb\b|probab/]);
    const data=take([/\bdata\b/]);
    const ln=take([/\bln\b|natural.?log/]);
    const frac=take([/fraction|frac|n\/?d/]);
    const ee=take([/\bee\b|exponent|sci.?notation|x10/]);
    const table=take([/\btable\b/]);
    const clear=take([/\bclear\b/]);
    const eKey=take([/\be\b|euler|constant.?e/]);

    place(second,deck,1,1);
    place(mode,deck,1,2);
    place(del,deck,1,3);
    place(log,deck,2,1);
    if(prb)place(prb,deck,2,2);else placeholder('prb',2,2);
    if(data)place(data,deck,2,3);else placeholder('data',2,3);
    place(ln,deck,3,1);
    place(frac,deck,3,2);
    place(ee,deck,3,3);
    place(table||eKey,deck,3,4);
    place(clear,deck,3,5);

    const nav=calc.querySelector('.si-model-navpad');
    if(nav){
      deck.appendChild(nav);
      nav.style.gridRow='1 / span 2';
      nav.style.gridColumn='4 / span 2';
    }

    const rows=[
      [
        take([/\bpi\b|π/]),
        take([/\bsin\b/]),
        take([/\bcos\b/]),
        take([/\btan\b/]),
        take([/divide|÷/])
      ],
      [
        take([/power|x\^|\^/]),
        take([/reciprocal|1\s*\/\s*x/]),
        take([/lparen|left.?paren|\(/]),
        take([/rparen|right.?paren|\)/]),
        take([/multiply|×|\*/])
      ],
      [
        take([/square|x²|x2/]),
        takeDigit(7),takeDigit(8),takeDigit(9),
        take([/subtract|minus|−/])
      ],
      [
        take([/variables?|xyz|abc/])||take([/sqrt|root|√/]),
        takeDigit(4),takeDigit(5),takeDigit(6),
        take([/\badd\b|plus|\+/])
      ],
      [
        take([/\bsto\b|store/]),
        takeDigit(1),takeDigit(2),takeDigit(3),
        take([/f.?[↔<>].?d|toggle.?frac|decimal.?fraction|answer.?toggle/])
      ],
      [
        take([/\bon\b|power.?on/])||take([/\bans\b|answer/]),
        takeDigit(0),
        take([/decimal|\./]),
        take([/negate|sign|\(−\)|\(-\)/]),
        take([/enter|equals|=/])
      ]
    ];

    rows.forEach(function(rowKeys,r){
      rowKeys.forEach(function(key,c){
        if(!key)return;
        place(key,keypad,r+1,c+1);
        if(r===5&&c===4)key.dataset.refRole='enter';
      });
    });

    /* Keep any genuinely extra SI functions accessible without breaking the face map. */
    const leftovers=all.filter(function(k){return !used.has(k)});
    leftovers.forEach(function(key,index){
      const fallbackRow=6;
      const fallbackCol=Math.min(5,index+1);
      key.classList.add('si-ref-extra-key');
      place(key,keypad,fallbackRow,fallbackCol);
    });

    const plate=calc.querySelector('.si-model-plate');
    if(plate)plate.innerHTML='<div><b>SI-30XS</b><span>MULTIVIEW</span></div>';
    const brand=calc.querySelector('.si-model-brandbar');
    if(brand)brand.textContent='SI MOTHERSHIP';
    keypad.dataset.refPhysicalMapped='2';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyReferenceAccurateLayout,{once:true});
  else applyReferenceAccurateLayout();
})();
</script>

"""

CALCULATOR_POPUP_STYLE = r"""
<style id="v55-6-calculator-popup-window">
html.si-calculator-popup{
  margin:0!important;
  padding:0!important;
  background:#10171c!important;
  overflow:hidden!important
}
body.si-classroom-model.si-hifi-model.si-calculator-popup-mode{
  display:block!important;
  align-items:initial!important;
  justify-content:initial!important;
  min-width:0!important;
  width:0!important;
  max-width:none!important;
  min-height:0!important;
  height:0!important;
  margin:0!important;
  padding:0!important;
  overflow:visible!important;
  background:#10171c!important
}
body.si-classroom-model.si-hifi-model.si-calculator-popup-mode .si-model-calculator{
  display:block!important;
  width:286px!important;
  max-width:286px!important;
  margin:0!important;
  padding:7px 26px 23px!important;
  transform:scale(var(--si-popup-scale,.88))!important;
  transform-origin:top left!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.75),
    inset 0 -12px 22px rgba(56,74,82,.18)!important
}
body.si-classroom-model.si-hifi-model.si-calculator-popup-mode .si-model-lcd{min-height:80px!important;height:80px!important}
body.si-classroom-model.si-hifi-model.si-calculator-popup-mode .si-model-lcd,
body.si-classroom-model.si-hifi-model.si-calculator-popup-mode .si-model-lcd *{
  font-size:1.05em!important
}
body.si-classroom-model.si-hifi-model.si-calculator-popup-mode .si-model-key{min-height:0!important}
</style>
<style id="v55-8-calculator-bare-popup">
/* Popup mode contains only the physical calculator; Mothership tool-page chrome is removed. */
html.si-calculator-popup,
html.si-calculator-popup body{
  scrollbar-width:none!important
}
html.si-calculator-popup::-webkit-scrollbar,
html.si-calculator-popup body::-webkit-scrollbar{
  display:none!important
}
</style>
<script id="v55-6-calculator-popup-window-script">
(function(){
  const preferredScale=.88;
  let lastScale=0;
  function isolateCalculator(){
    if(!document.body)return null;
    document.documentElement.classList.add('si-calculator-popup');
    document.body.classList.add('si-calculator-popup-mode');
    const calc=document.querySelector('.si-model-calculator');
    if(!calc)return null;
    if(calc.parentElement!==document.body)document.body.appendChild(calc);
    Array.from(document.body.children).forEach(function(child){
      if(child!==calc)child.hidden=true;
    });
    return calc;
  }
  function visualBounds(calc){
    const base=calc.getBoundingClientRect();
    let left=base.left,top=base.top,right=base.right,bottom=base.bottom;
    Array.from(calc.querySelectorAll('*')).forEach(function(el){
      const style=getComputedStyle(el);
      if(style.display==='none'||style.visibility==='hidden')return;
      const r=el.getBoundingClientRect();
      if(r.width<=0&&r.height<=0)return;
      left=Math.min(left,r.left);top=Math.min(top,r.top);
      right=Math.max(right,r.right);bottom=Math.max(bottom,r.bottom);
    });
    return {width:Math.max(1,right-left),height:Math.max(1,bottom-top)};
  }
  function fitCalculatorInsideWindow(){
    const calc=isolateCalculator();
    if(!calc)return;
    calc.style.setProperty('--si-popup-scale',String(preferredScale));
    const bounds=visualBounds(calc);
    const usableW=Math.max(1,window.innerWidth-4);
    const usableH=Math.max(1,window.innerHeight-4);
    const ratio=Math.min(1,usableW/bounds.width,usableH/bounds.height);
    const scale=Math.max(.48,preferredScale*ratio*.985);
    if(Math.abs(scale-lastScale)<.003)return;
    lastScale=scale;
    calc.style.setProperty('--si-popup-scale',String(scale));
  }
  function boot(){
    try{window.opener=null}catch(e){}
    isolateCalculator();
    fitCalculatorInsideWindow();
    requestAnimationFrame(fitCalculatorInsideWindow);
    window.addEventListener('load',fitCalculatorInsideWindow,{once:true});
    window.addEventListener('resize',fitCalculatorInsideWindow);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
</script>
"""


PUBLIC_STORAGE_KEYS = {
    "siMothership.customAvatars.v1",
    "siMothership.rosterSets.v1",
    "siMothership.activeRosterSet.v1",
}

PERSISTED_STORAGE_KEYS = {
    "siMothership.customAvatars.v1",
    "siMothership.rosterSets.v1",
    "siMothership.activeRosterSet.v1",
    "siMothership.presentations.v1",
    "siMothership.vectorActivities.v1",
    "siMothership.boardSessions.v1",
    "siMothership.orbitActivities.v1",
    "siMothership.pixelRevealActivities.v1",
    "siMothership.sketchWordPacks.v1",
    "siMothership.starwheelPuzzlePacks.v1",
    "siMothership.appShortcuts.v1",
    "siMothership.activityPresets.v1",
    "siMothership.recentActivities.v1",
    "siMothership.sessionHistory.v1",
}

CLIENTS: set[web.WebSocketResponse] = set()
CLIENT_META: dict[web.WebSocketResponse, dict] = {}
LATEST_STATE: Optional[dict] = None
CURRENT_JOIN_CODE = ""
CURRENT_SESSION_ID = ""


def db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    con.execute("PRAGMA busy_timeout=15000")
    return con


def init_db() -> None:
    global LATEST_STATE, CURRENT_JOIN_CODE, CURRENT_SESSION_ID
    with db() as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute(
            """CREATE TABLE IF NOT EXISTS server_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )"""
        )
        con.execute(
            """CREATE TABLE IF NOT EXISTS teacher_kv (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at REAL NOT NULL
            )"""
        )
        con.execute(
            """CREATE TABLE IF NOT EXISTS runtime (
                id INTEGER PRIMARY KEY CHECK(id=1),
                join_code TEXT NOT NULL,
                session_id TEXT,
                state_json TEXT,
                updated_at REAL NOT NULL
            )"""
        )
        cols = {r[1] for r in con.execute("PRAGMA table_info(runtime)").fetchall()}
        if "session_id" not in cols:
            con.execute("ALTER TABLE runtime ADD COLUMN session_id TEXT")
        row = con.execute("SELECT join_code,session_id,state_json FROM runtime WHERE id=1").fetchone()
        if row is None:
            CURRENT_JOIN_CODE = new_join_code()
            CURRENT_SESSION_ID = new_session_id()
            con.execute(
                "INSERT INTO runtime(id,join_code,session_id,state_json,updated_at) VALUES(1,?,?,?,?)",
                (CURRENT_JOIN_CODE, CURRENT_SESSION_ID, None, time.time()),
            )
            LATEST_STATE = None
        else:
            CURRENT_JOIN_CODE = row["join_code"]
            CURRENT_SESSION_ID = row["session_id"] or new_session_id()
            if not row["session_id"]:
                con.execute("UPDATE runtime SET session_id=? WHERE id=1", (CURRENT_SESSION_ID,))
            try:
                LATEST_STATE = json.loads(row["state_json"]) if row["state_json"] else None
            except Exception:
                LATEST_STATE = None


def new_join_code() -> str:
    return "".join(secrets.choice(JOIN_ALPHABET) for _ in range(4))


def new_session_id() -> str:
    return secrets.token_urlsafe(9)


def save_runtime_state(state: Optional[dict]) -> None:
    global LATEST_STATE
    LATEST_STATE = state
    payload = json.dumps(state, separators=(",", ":")) if state is not None else None
    with db() as con:
        con.execute(
            "UPDATE runtime SET state_json=?,updated_at=? WHERE id=1",
            (payload, time.time()),
        )


def rotate_session() -> str:
    global CURRENT_JOIN_CODE, CURRENT_SESSION_ID, LATEST_STATE
    CURRENT_JOIN_CODE = new_join_code()
    CURRENT_SESSION_ID = new_session_id()
    LATEST_STATE = None
    with db() as con:
        con.execute(
            "UPDATE runtime SET join_code=?,session_id=?,state_json=NULL,updated_at=? WHERE id=1",
            (CURRENT_JOIN_CODE, CURRENT_SESSION_ID, time.time()),
        )
    return CURRENT_JOIN_CODE




def _student_by_identity(state: dict, token: str = "", name: str = "") -> Optional[dict]:
    students = state.get("students") if isinstance(state, dict) else None
    if not isinstance(students, list):
        return None
    if token:
        for st in students:
            if isinstance(st, dict) and str(st.get("studentToken", "")) == token:
                return st
    if name:
        for st in students:
            if isinstance(st, dict) and str(st.get("n", "")) == name:
                return st
    return None


def _state_for_role(state: dict, role: str, token: str = "", name: str = "") -> dict:
    """Return the classroom state appropriate for one connected client.

    Teacher sockets receive the canonical state. Shared screens never receive
    teacher-private inbox payloads. Student sockets receive only their own
    private messages/photos/responses while retaining the common classroom and
    activity state needed to render the experience.
    """
    if not isinstance(state, dict):
        return state
    if role == "teacher":
        return state

    out = copy.deepcopy(state)
    role = str(role or "")
    token = str(token or "")
    name = str(name or "")
    own = None
    if role == "student":
        # Student-private state requires the established token. Name-only fallback
        # is allowed only for legacy records that genuinely have no token.
        if token:
            own = _student_by_identity(out, token, "")
        if own is None and name:
            legacy = _student_by_identity(out, "", name)
            if isinstance(legacy, dict) and not str(legacy.get("studentToken") or ""):
                own = legacy
    own_name = str(own.get("n", "")) if isinstance(own, dict) else ""
    own_token = str(own.get("studentToken", "")) if isinstance(own, dict) else ""

    students = out.get("students", [])
    if isinstance(students, list):
        for st in students:
            if not isinstance(st, dict):
                continue
            is_self = role == "student" and (
                (own_token and str(st.get("studentToken", "")) == own_token)
                or (own_name and str(st.get("n", "")) == own_name)
            )
            if not is_self:
                st.pop("studentToken", None)
            if role == "student" and not is_self:
                st.pop("readyResponse", None)
                st.pop("emotion", None)
                st.pop("understanding", None)

    run = out.get("activityRun")
    if isinstance(run, dict) and str(run.get("activityId") or "") == "starwheel-game":
        sw = run.get("starwheel")
        if isinstance(sw, dict):
            sw.pop("pendingSolve", None)
            sw.pop("lastRequestId", None)
        run.pop("starwheelRequest", None)

    # GAME SHOW PACK: non-teacher clients receive only display-safe/current-question state.
    if isinstance(run, dict) and str(run.get("activityId") or "") == "crew-survey-game":
        cfg = run.get("crewSurveyConfig")
        cs = run.get("crewSurvey")
        if isinstance(cfg, dict) and isinstance(cs, dict):
            revealed = set()
            for raw_index in cs.get("revealed", []) if isinstance(cs.get("revealed"), list) else []:
                try:
                    revealed.add(int(raw_index))
                except (TypeError, ValueError):
                    continue
            answers = cfg.get("answers") if isinstance(cfg.get("answers"), list) else []
            safe_answers = []
            for idx, answer in enumerate(answers):
                clean = copy.deepcopy(answer) if isinstance(answer, dict) else {}
                if idx not in revealed:
                    clean["text"] = ""
                    clean["value"] = 0
                safe_answers.append(clean)
            cfg["answers"] = safe_answers
            cs.pop("lastResponse", None)
            cs.pop("lastRequestIds", None)
            private_responses = cs.get("privateResponses") if isinstance(cs.get("privateResponses"), dict) else {}
            if role == "student" and own_name:
                cs["privateResponses"] = (
                    {own_name: copy.deepcopy(private_responses[own_name])}
                    if own_name in private_responses else {}
                )
                aac_students = cfg.get("aacStudents") if isinstance(cfg.get("aacStudents"), list) else []
                is_aac = own_name in aac_students
                cfg["aacStudents"] = [own_name] if is_aac else []
                if not is_aac:
                    cfg["aacVocab"] = []
            else:
                cs["privateResponses"] = {}
                cfg["aacStudents"] = []
                cfg["aacVocab"] = []

    if isinstance(run, dict) and str(run.get("activityId") or "") == "million-game":
        cfg = run.get("millionConfig")
        million = run.get("million")
        if isinstance(cfg, dict) and isinstance(million, dict):
            try:
                current_index = max(0, int(million.get("questionIndex", 0) or 0))
            except (TypeError, ValueError):
                current_index = 0
            questions = cfg.get("questions") if isinstance(cfg.get("questions"), list) else []
            safe_questions = []
            for idx, question in enumerate(questions):
                if idx == current_index and isinstance(question, dict):
                    clean = copy.deepcopy(question)
                    clean.pop("correct", None)
                    clean.pop("mothershipClue", None)
                    clean.pop("explanation", None)
                    safe_questions.append(clean)
                else:
                    safe_questions.append({"prompt": "", "choices": []})
            cfg["questions"] = safe_questions
            million.pop("lastRequestId", None)
            predictions = million.get("crewPredictions") if isinstance(million.get("crewPredictions"), dict) else {}
            poll_counts = {"A": 0, "B": 0, "C": 0, "D": 0}
            for answer in predictions.values():
                key = str(answer or "").upper()
                if key in poll_counts:
                    poll_counts[key] += 1
            if role == "shared" and million.get("pollVisible"):
                million["publicPollCounts"] = poll_counts
            else:
                million.pop("publicPollCounts", None)
            if role == "student" and own_name:
                million["crewPredictions"] = (
                    {own_name: copy.deepcopy(predictions[own_name])}
                    if own_name in predictions else {}
                )
                if str(million.get("pilot") or "") != own_name:
                    million["selectedAnswer"] = ""
            else:
                million["crewPredictions"] = {}
                million["selectedAnswer"] = ""

    if role != "student":
        # Shared/unknown non-teacher clients receive display-safe state only.
        out["buzz"] = []
        out["help"] = []
        out["helpMessages"] = []
        out["helpDeletedIds"] = []
        out["alerts"] = []
        out["photos"] = []
        return out

    out["buzz"] = [x for x in out.get("buzz", []) if x == own_name] if isinstance(out.get("buzz"), list) else []
    out["help"] = [x for x in out.get("help", []) if x == own_name] if isinstance(out.get("help"), list) else []
    out["alerts"] = [
        a for a in out.get("alerts", [])
        if isinstance(a, dict) and str(a.get("name", "")) == own_name
    ] if isinstance(out.get("alerts"), list) else []
    out["helpMessages"] = [
        m for m in out.get("helpMessages", [])
        if isinstance(m, dict) and str(m.get("name", "")) == own_name
    ] if isinstance(out.get("helpMessages"), list) else []
    out["helpDeletedIds"] = []
    out["photos"] = [
        p for p in out.get("photos", [])
        if isinstance(p, dict) and str(p.get("name", "")) == own_name
    ] if isinstance(out.get("photos"), list) else []

    run = out.get("activityRun")
    if isinstance(run, dict):
        if str(run.get("activityId") or "") == "starwheel-game":
            cfg = run.get("starwheelConfig")
            if isinstance(cfg, dict):
                cfg.pop("answer", None)
            run.pop("starwheelRequest", None)
        responses = run.get("responses")
        if isinstance(responses, dict):
            filtered = {}
            for slide_key, response_map in responses.items():
                if isinstance(response_map, dict) and own_name in response_map:
                    filtered[str(slide_key)] = {own_name: copy.deepcopy(response_map[own_name])}
                elif isinstance(response_map, dict):
                    filtered[str(slide_key)] = {}
            run["responses"] = filtered

        for field in ("vectorResponses", "orbitResponses", "pixelGuesses"):
            mapping = run.get(field)
            if isinstance(mapping, dict):
                run[field] = {own_name: copy.deepcopy(mapping[own_name])} if own_name in mapping else {}

        sketch = run.get("sketch")
        if isinstance(sketch, dict) and isinstance(sketch.get("guesses"), dict):
            guesses = sketch["guesses"]
            sketch["guesses"] = {own_name: copy.deepcopy(guesses[own_name])} if own_name in guesses else {}

    return out


async def _send_current_state(ws: web.WebSocketResponse) -> None:
    if LATEST_STATE is None:
        await ws.send_json({"type": "state_absent"})
        return
    meta = CLIENT_META.get(ws, {})
    await ws.send_json({
        "type": "state",
        "state": _state_for_role(
            LATEST_STATE,
            str(meta.get("role") or ""),
            str(meta.get("student_token") or ""),
            str(meta.get("student_name") or ""),
        ),
    })


def _sketch_normalize(value: object) -> str:
    text = str(value or "").lower().strip()
    text = re.sub(r"^(a|an|the)\s+", "", text)
    text = re.sub(r"[^a-z0-9 ]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _sketch_auto_match(guess: object, word: object) -> bool:
    g = _sketch_normalize(guess)
    w = _sketch_normalize(word)
    return bool(g) and (g == w or g == w + "s" or g + "s" == w)


def _sketch_award_score(run: dict, name: str) -> None:
    cfg = run.get("sketchConfig") if isinstance(run.get("sketchConfig"), dict) else {}
    if not cfg.get("scoring"):
        return
    scores = run.setdefault("sketchScores", {"students": {}, "teams": {}})
    if not isinstance(scores, dict):
        scores = {"students": {}, "teams": {}}
        run["sketchScores"] = scores
    students = scores.setdefault("students", {})
    teams = scores.setdefault("teams", {})
    if not isinstance(students, dict):
        students = {}
        scores["students"] = students
    if not isinstance(teams, dict):
        teams = {}
        scores["teams"] = teams
    students[name] = max(0, int(students.get(name, 0) or 0)) + 1
    if str(cfg.get("mode") or "free") == "teams":
        assignments = cfg.get("teamAssignments") if isinstance(cfg.get("teamAssignments"), dict) else {}
        try:
            team = int(assignments.get(name, 0) or 0)
        except (TypeError, ValueError):
            team = 0
        if team > 0:
            key = str(team)
            teams[key] = max(0, int(teams.get(key, 0) or 0)) + 1


STARWHEEL_VALUES = (100, 200, 300, 400, 500, 750, 1000, 500)
STARWHEEL_SPECIALS = (
    ("power", "POWER SURGE"),
    ("shield", "SHIELD"),
    ("cargo", "CARGO"),
    ("wormhole", "WORMHOLE"),
    ("tax", "ALIEN TAX"),
)
STARWHEEL_VOWELS = {"A", "E", "I", "O", "U"}
STARWHEEL_CONSONANTS = set("BCDFGHJKLMNPQRSTVWXYZ")


def _starwheel_connected_students(state: dict) -> list[dict]:
    return [
        st for st in state.get("students", [])
        if isinstance(st, dict) and not st.get("offline") and str(st.get("n") or "")
    ]


def _starwheel_team_members(state: dict, run: dict, team_index: int) -> list[dict]:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    assignments = cfg.get("teamAssignments") if isinstance(cfg.get("teamAssignments"), dict) else {}
    team_number = int(team_index) + 1
    return [st for st in _starwheel_connected_students(state) if int(assignments.get(str(st.get("n")), 0) or 0) == team_number]


def _starwheel_active_pilot_name(state: dict, run: dict) -> str:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    sw = run.get("starwheel") if isinstance(run.get("starwheel"), dict) else {}
    students = _starwheel_connected_students(state)
    if not students:
        return ""
    if str(cfg.get("mode") or "teams") != "teams":
        try:
            idx = int(sw.get("freePilotIndex", 0) or 0) % len(students)
        except (TypeError, ValueError):
            idx = 0
        return str(students[idx].get("n") or "")

    try:
        count = max(2, min(4, int(cfg.get("teamCount", 2) or 2)))
        active = int(sw.get("activeTeam", 0) or 0) % count
    except (TypeError, ValueError):
        count, active = 2, 0
    members = _starwheel_team_members(state, run, active)
    if not members:
        for step in range(1, count + 1):
            candidate = (active + step) % count
            candidate_members = _starwheel_team_members(state, run, candidate)
            if candidate_members:
                active, members = candidate, candidate_members
                sw["activeTeam"] = active
                break
    if not members:
        return ""
    indexes = sw.setdefault("pilotIndexes", {})
    try:
        idx = int(indexes.get(str(active), 0) or 0) % len(members)
    except (TypeError, ValueError):
        idx = 0
    return str(members[idx].get("n") or "")


def _starwheel_score_bucket(run: dict, name: str) -> tuple[dict, str]:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    sw = run.setdefault("starwheel", {})
    scores = sw.setdefault("scores", {"students": {}, "teams": {}})
    students = scores.setdefault("students", {})
    teams = scores.setdefault("teams", {})
    if str(cfg.get("mode") or "teams") == "teams":
        try:
            team = int(sw.get("activeTeam", 0) or 0)
        except (TypeError, ValueError):
            team = 0
        return teams, str(team)
    return students, name


def _starwheel_adjust_score(run: dict, name: str, delta: int) -> int:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    if not cfg.get("scoring"):
        return 0
    bucket, key = _starwheel_score_bucket(run, name)
    try:
        current = int(bucket.get(key, 0) or 0)
    except (TypeError, ValueError):
        current = 0
    bucket[key] = max(0, current + int(delta))
    return int(bucket[key])


def _starwheel_status_key(run: dict, name: str) -> str:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    sw = run.get("starwheel") if isinstance(run.get("starwheel"), dict) else {}
    if str(cfg.get("mode") or "teams") == "teams":
        try:
            return str(int(sw.get("activeTeam", 0) or 0))
        except (TypeError, ValueError):
            return "0"
    return str(name or "")


def _starwheel_special_state(run: dict, field: str) -> dict:
    sw = run.setdefault("starwheel", {})
    mapping = sw.setdefault(field, {})
    if not isinstance(mapping, dict):
        mapping = {}
        sw[field] = mapping
    return mapping


def _starwheel_apply_special(state: dict, run: dict, name: str, kind: str, label: str) -> None:
    sw = run.get("starwheel") if isinstance(run.get("starwheel"), dict) else {}
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    key = _starwheel_status_key(run, name)
    power = _starwheel_special_state(run, "powerSurge")
    shields = _starwheel_special_state(run, "shields")
    sw["spinValue"] = None
    sw["spinLabel"] = label
    sw["lastSpecial"] = kind
    sw["stage"] = "ready"

    if kind == "power":
        power[key] = True
        sw["message"] = "POWER SURGE armed — the next correct consonant is worth ×2."
        return
    if kind == "shield":
        shields[key] = 1
        sw["message"] = "SHIELD online — the next Wormhole or Alien Tax is blocked."
        return
    if kind == "cargo":
        if cfg.get("scoring"):
            total = _starwheel_adjust_score(run, name, 500)
            sw["message"] = f"CARGO recovered — +500 Energy. Total: {total}."
        else:
            sw["message"] = "CARGO recovered — crew keeps control."
        return
    if kind in {"wormhole", "tax"}:
        try:
            shield_count = int(shields.get(key, 0) or 0)
        except (TypeError, ValueError):
            shield_count = 0
        if shield_count > 0:
            shields[key] = max(0, shield_count - 1)
            sw["message"] = f"SHIELD absorbed the {label}. Control stays here."
            return
        if kind == "wormhole":
            _starwheel_advance(state, run, False)
            sw["message"] = "WORMHOLE opened — control jumps to the next crew."
            return
        if cfg.get("scoring"):
            total = _starwheel_adjust_score(run, name, -250)
            sw["message"] = f"ALIEN TAX — 250 Energy removed. Total: {total}."
        else:
            sw["message"] = "ALIEN TAX detected — no score is active, so no Energy was lost."


def _starwheel_advance(state: dict, run: dict, keep_team: bool) -> None:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    sw = run.get("starwheel") if isinstance(run.get("starwheel"), dict) else {}
    students = _starwheel_connected_students(state)
    if not students:
        return
    if str(cfg.get("mode") or "teams") != "teams":
        try:
            sw["freePilotIndex"] = (int(sw.get("freePilotIndex", 0) or 0) + 1) % len(students)
        except (TypeError, ValueError):
            sw["freePilotIndex"] = 0
        return
    try:
        count = max(2, min(4, int(cfg.get("teamCount", 2) or 2)))
        team = int(sw.get("activeTeam", 0) or 0) % count
    except (TypeError, ValueError):
        count, team = 2, 0
    members = _starwheel_team_members(state, run, team)
    indexes = sw.setdefault("pilotIndexes", {})
    if members:
        try:
            indexes[str(team)] = (int(indexes.get(str(team), 0) or 0) + 1) % len(members)
        except (TypeError, ValueError):
            indexes[str(team)] = 0
    if not keep_team:
        for step in range(1, count + 1):
            candidate = (team + step) % count
            if _starwheel_team_members(state, run, candidate):
                sw["activeTeam"] = candidate
                break


def _starwheel_apply_request(state: dict, run: dict, name: str, request: dict) -> None:
    sw = run.get("starwheel") if isinstance(run.get("starwheel"), dict) else None
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    if not isinstance(sw, dict) or sw.get("solved"):
        return
    request_id = str(request.get("id") or "")[:120]
    if not request_id or request_id == str(sw.get("lastRequestId") or ""):
        return
    if str(request.get("name") or name) != name:
        return
    if _starwheel_active_pilot_name(state, run) != name:
        return
    sw["lastRequestId"] = request_id
    action = str(request.get("type") or "")
    value = str(request.get("value") or "").strip().upper()
    answer = str(cfg.get("answer") or "").upper()
    used = [str(x).upper() for x in sw.get("usedLetters", []) if str(x)]
    revealed = [str(x).upper() for x in sw.get("revealed", []) if str(x)]
    sw["usedLetters"] = used
    sw["revealed"] = revealed

    if action == "spin":
        if str(sw.get("stage") or "ready") != "ready" or sw.get("pendingSolve"):
            return
        if cfg.get("specialSectors"):
            sectors = [("number", value) for value in STARWHEEL_VALUES[:7]] + list(STARWHEEL_SPECIALS)
        else:
            sectors = [("number", value) for value in STARWHEEL_VALUES]
        index = secrets.randbelow(len(sectors))
        kind, payload = sectors[index]
        sw["spinIndex"] = index
        sw["spinNonce"] = int(sw.get("spinNonce", 0) or 0) + 1
        step = 360.0 / len(sectors)
        target = (360.0 - (index * step + step / 2.0)) % 360.0
        current_deg = float(sw.get("spinDeg", 0) or 0)
        sw["spinFromDeg"] = current_deg
        current_mod = current_deg % 360.0
        delta = (target - current_mod) % 360.0
        sw["spinDeg"] = current_deg + 720.0 + delta
        if kind == "number":
            spin_value = int(payload)
            sw["spinValue"] = spin_value
            sw["spinLabel"] = str(spin_value)
            sw["lastSpecial"] = ""
            sw["stage"] = "letter"
            sw["message"] = f"{name} spun {spin_value}. Choose a consonant."
        else:
            _starwheel_apply_special(state, run, name, str(kind), str(payload))
        return

    if action == "letter":
        if str(sw.get("stage") or "") != "letter" or value not in STARWHEEL_CONSONANTS or value in used:
            return
        used.append(value)
        occurrences = answer.count(value)
        if occurrences > 0 and value not in revealed:
            revealed.append(value)
        base_points = int(sw.get("spinValue", 0) or 0) * occurrences
        key = _starwheel_status_key(run, name)
        power = _starwheel_special_state(run, "powerSurge")
        multiplier = 1
        if occurrences > 0 and power.get(key):
            multiplier *= 2
            power[key] = False
        if occurrences > 0 and cfg.get("finalSignal"):
            multiplier *= 2
        points = base_points * multiplier
        if occurrences > 0 and cfg.get("scoring"):
            _starwheel_adjust_score(run, name, points)
        _starwheel_advance(state, run, occurrences > 0)
        sw["stage"] = "ready"
        sw["spinValue"] = None
        sw["spinLabel"] = ""
        boost = f" ×{multiplier}" if occurrences > 0 and multiplier > 1 else ""
        sw["message"] = (
            f"{value} appears {occurrences} time{'s' if occurrences != 1 else ''}. "
            + (f"{points} points{boost}. Crew keeps control." if occurrences > 0 and cfg.get("scoring")
               else f"Signal boost{boost}. Crew keeps control." if occurrences > 0
               else "No signal match. Control passes.")
        )
        return

    if action == "vowel":
        if str(sw.get("stage") or "ready") != "ready" or value not in STARWHEEL_VOWELS or value in used:
            return
        if cfg.get("scoring"):
            bucket, key = _starwheel_score_bucket(run, name)
            try:
                current_score = int(bucket.get(key, 0) or 0)
            except (TypeError, ValueError):
                current_score = 0
            if current_score < 250:
                sw["message"] = "Not enough Energy to buy a vowel."
                return
            bucket[key] = current_score - 250
        used.append(value)
        occurrences = answer.count(value)
        if occurrences > 0 and value not in revealed:
            revealed.append(value)
        _starwheel_advance(state, run, occurrences > 0)
        sw["stage"] = "ready"
        sw["spinLabel"] = ""
        sw["message"] = (
            f"Vowel {value} restored in {occurrences} position{'s' if occurrences != 1 else ''}. "
            + ("Crew keeps control." if occurrences > 0 else "No signal match. Control passes.")
        )
        return

    if action == "solve":
        if str(sw.get("stage") or "ready") not in {"ready", "letter"} or sw.get("pendingSolve"):
            return
        text = str(request.get("value") or "").strip()[:80]
        if not text:
            return
        try:
            team = int(sw.get("activeTeam", 0) or 0) if str(cfg.get("mode") or "teams") == "teams" else -1
        except (TypeError, ValueError):
            team = -1
        sw["pendingSolve"] = {"name": name, "text": text, "team": team, "at": request.get("at")}
        sw["solvePendingBy"] = name
        sw["stage"] = "solve_pending"
        sw["message"] = f"{name} submitted a Solve Signal. Mission Control is reviewing it."


def _crew_survey_active_name(run: dict, team: int) -> str:
    cs = run.get("crewSurvey") if isinstance(run.get("crewSurvey"), dict) else {}
    teams = cs.get("teams") if isinstance(cs.get("teams"), list) else [[], []]
    if team < 0 or team >= len(teams) or not isinstance(teams[team], list) or not teams[team]:
        return ""
    indexes = cs.get("activeIndexes") if isinstance(cs.get("activeIndexes"), list) else [0, 0]
    try:
        index = int(indexes[team] if team < len(indexes) else 0) % len(teams[team])
    except (TypeError, ValueError):
        index = 0
    return str(teams[team][index] or "")


def _crew_survey_team_for(run: dict, name: str) -> Optional[int]:
    cs = run.get("crewSurvey") if isinstance(run.get("crewSurvey"), dict) else {}
    teams = cs.get("teams") if isinstance(cs.get("teams"), list) else []
    for team_index, members in enumerate(teams[:2]):
        if isinstance(members, list) and name in [str(x) for x in members]:
            return team_index
    return None


def _crew_survey_apply_request(state: dict, run: dict, name: str, request: dict) -> None:
    cs = run.get("crewSurvey") if isinstance(run.get("crewSurvey"), dict) else None
    if not isinstance(cs, dict):
        return
    request_id = str(request.get("id") or "")[:120]
    if not request_id or str(request.get("name") or name) != name:
        return
    seen = cs.setdefault("lastRequestIds", {})
    if not isinstance(seen, dict):
        seen = {}
        cs["lastRequestIds"] = seen
    if str(seen.get(name) or "") == request_id:
        return
    seen[name] = request_id

    action = str(request.get("type") or "")
    if action == "buzz":
        buzzer = cs.get("buzzer") if isinstance(cs.get("buzzer"), dict) else {}
        eligible = [str(x) for x in buzzer.get("eligible", [])] if isinstance(buzzer.get("eligible"), list) else []
        if not buzzer.get("armed") or buzzer.get("winner") or name not in eligible:
            return
        # This handler executes inside one asyncio event loop. The first accepted
        # message clears armed before the next queued message can be accepted.
        buzzer["winner"] = name
        buzzer["armed"] = False
        buzzer["lockedAt"] = request.get("at") or int(time.time() * 1000)
        cs["buzzer"] = buzzer
        cs["message"] = f"{name} buzzed first."
        return

    if action == "answer":
        stage = str(cs.get("stage") or "faceoff")
        winner = str((cs.get("buzzer") or {}).get("winner") or "")
        team = _crew_survey_team_for(run, name)
        control_team = cs.get("controlTeam")
        allowed = stage == "faceoff" and winner == name
        if not allowed and team is not None:
            try:
                controlled = int(control_team) == int(team)
            except (TypeError, ValueError):
                controlled = False
            allowed = controlled and _crew_survey_active_name(run, team) == name and stage in {"play", "steal"}
        if not allowed:
            return
        answer = str(request.get("value") or "").strip()[:160]
        if not answer:
            return
        source = str(request.get("source") or "type").lower()
        if source not in {"aac", "type"}:
            source = "type"
        item = {"text": answer, "source": source, "at": request.get("at")}
        private_responses = cs.setdefault("privateResponses", {})
        if not isinstance(private_responses, dict):
            private_responses = {}
            cs["privateResponses"] = private_responses
        private_responses[name] = item
        cs["lastResponse"] = {"name": name, **item}


def _million_apply_request(state: dict, run: dict, name: str, request: dict) -> None:
    million = run.get("million") if isinstance(run.get("million"), dict) else None
    cfg = run.get("millionConfig") if isinstance(run.get("millionConfig"), dict) else {}
    if not isinstance(million, dict) or million.get("complete") or million.get("over"):
        return
    request_id = str(request.get("id") or "")[:120]
    if not request_id or request_id == str(million.get("lastRequestId") or ""):
        return
    if str(request.get("name") or name) != name:
        return
    million["lastRequestId"] = request_id
    try:
        question_index = max(0, int(million.get("questionIndex", 0) or 0))
    except (TypeError, ValueError):
        question_index = 0
    questions = cfg.get("questions") if isinstance(cfg.get("questions"), list) else []
    if question_index >= len(questions) or not isinstance(questions[question_index], dict):
        return
    question = questions[question_index]
    valid_keys = {"A", "B", "C", "D"}
    eliminated = {str(x) for x in million.get("eliminated", [])} if isinstance(million.get("eliminated"), list) else set()
    action = str(request.get("type") or "")
    value = str(request.get("value") or "").strip()
    key = value.upper()

    if action == "predict":
        if million.get("revealed") or key not in valid_keys or key in eliminated:
            return
        predictions = million.setdefault("crewPredictions", {})
        if isinstance(predictions, dict):
            predictions[name] = key
        return

    if str(million.get("pilot") or "") != name:
        return

    if action == "select":
        if million.get("revealed") or million.get("lockedAnswer") or key not in valid_keys or key in eliminated:
            return
        million["selectedAnswer"] = key
        million["message"] = f"{name} selected {key}. Lock it when ready."
        return

    if action == "lock":
        if million.get("revealed") or million.get("lockedAnswer"):
            return
        selected = str(million.get("selectedAnswer") or "").upper()
        if selected not in valid_keys or selected in eliminated:
            return
        million["lockedAnswer"] = selected
        million["message"] = f"{name} locked answer {selected}. Mission Control will reveal the result."
        return

    if action != "lifeline":
        return
    lifeline = value
    inventory = million.setdefault("inventory", {})
    if not isinstance(inventory, dict):
        return
    try:
        remaining = int(inventory.get(lifeline, 0) or 0)
    except (TypeError, ValueError):
        remaining = 0
    if lifeline not in {"poll", "reduce", "clue", "tryAgain"} or remaining <= 0:
        return
    inventory[lifeline] = remaining - 1

    if lifeline == "poll":
        million["pollOpen"] = True
        million["pollVisible"] = False
        million["message"] = "POLL THE CREW is open. Everyone choose A, B, C, or D."
        return

    if lifeline == "reduce":
        correct = str(question.get("correct") or "").upper()
        wrong = [
            str(choice.get("key") or "").upper()
            for choice in question.get("choices", [])
            if isinstance(choice, dict)
            and str(choice.get("key") or "").upper() in valid_keys
            and str(choice.get("key") or "").upper() != correct
            and str(choice.get("key") or "").upper() not in eliminated
        ]
        million["eliminated"] = wrong[:2]
        million["message"] = "REDUCE SIGNAL removed two incorrect choices."
        return

    if lifeline == "clue":
        million["publicClue"] = str(question.get("mothershipClue") or "Think carefully about what the question is asking.")[:240]
        million["message"] = "MOTHERSHIP CLUE transmitted."
        return

    if lifeline == "tryAgain":
        million["selectedAnswer"] = ""
        million["lockedAnswer"] = ""
        million["revealed"] = False
        million["result"] = ""
        million["publicCorrect"] = ""
        million["over"] = False
        million["message"] = "TRY AGAIN activated. Choose another answer."


def _minefield_current_navigator(state: dict, run: dict) -> Optional[str]:
    students = [st for st in state.get("students", []) if isinstance(st, dict) and not st.get("offline")]
    if not students:
        return None
    mode = str(run.get("minefieldMode") or state.get("minefieldMode") or "crew")
    if mode == "teacher":
        if run.get("activeSide", "class") != "class":
            return None
        mf = run.get("mfClass") or {}
        idx = int(mf.get("navigatorIndex", 0) or 0) % len(students)
        return str(students[idx].get("n", ""))
    if mode == "teams":
        count = max(2, min(3, int(run.get("minefieldTeamCount") or state.get("minefieldTeamCount") or 2)))
        active = int(run.get("activeTeam", 0) or 0) % count
        team = [st for i, st in enumerate(students) if i % count == active]
        if not team:
            return None
        mfs = run.get("mfTeams") or []
        mf = mfs[active] if active < len(mfs) and isinstance(mfs[active], dict) else {}
        idx = int(mf.get("navigatorIndex", 0) or 0) % len(team)
        return str(team[idx].get("n", ""))
    mf = run.get("mf") or {}
    idx = int(mf.get("navigatorIndex", 0) or 0) % len(students)
    return str(students[idx].get("n", ""))


def merge_student_snapshot(canonical: Optional[dict], incoming: dict, token: str = "", name: str = "") -> dict:
    """Merge only the sending student's classroom actions into canonical state.

    This prevents simultaneous student responses from replacing one another when the
    legacy UI sends whole-state snapshots. Teacher snapshots remain authoritative.
    """
    if not isinstance(canonical, dict):
        canonical = copy.deepcopy(incoming)
    out = copy.deepcopy(canonical)
    if out.get("ended"):
        return out
    inc_student = _student_by_identity(incoming, token, name)
    if inc_student is None:
        return out
    token = str(inc_student.get("studentToken", token or ""))
    name = str(inc_student.get("n", name or ""))
    if not name:
        return out

    # Once a student name/token exists in canonical state, another socket cannot
    # claim that identity with a different token or rename an existing token.
    existing_by_name = _student_by_identity(out, "", name)
    if existing_by_name is not None:
        existing_token = str(existing_by_name.get("studentToken") or "")
        if existing_token and existing_token != token:
            return out
    if token:
        existing_by_token = _student_by_identity(out, token, "")
        if existing_by_token is not None and str(existing_by_token.get("n") or "") != name:
            return out

    can_student = _student_by_identity(out, token, name)
    if can_student is None:
        clean = {k: copy.deepcopy(v) for k, v in inc_student.items() if k in {"n", "c", "avatarKey", "studentToken", "readyResponse", "emotion", "understanding"}}
        out.setdefault("students", []).append(clean)
        can_student = clean
    else:
        active_prompt = bool(out.get("promptActive"))
        screen = str(out.get("screen") or "")
        allowed_prompt_fields = {
            "readyResponse": active_prompt and screen == "ready",
            "emotion": active_prompt and screen == "emotion",
            "understanding": active_prompt and screen == "understanding",
        }
        for k, allowed in allowed_prompt_fields.items():
            if allowed and k in inc_student:
                can_student[k] = copy.deepcopy(inc_student[k])

    # Student-owned membership in classroom queues. Teacher enable/disable state wins
    # over delayed student snapshots so closed controls cannot re-open themselves.
    for field, enabled_field in (("buzz", "buzzEnabled"), ("help", "helpEnabled")):
        inc_list = incoming.get(field, []) if isinstance(incoming.get(field), list) else []
        cur = [x for x in out.get(field, []) if x != name]
        if out.get(enabled_field) and name in inc_list:
            cur.append(name)
        out[field] = cur

    inc_alerts = incoming.get("alerts", []) if isinstance(incoming.get("alerts"), list) else []
    cur_alerts = [a for a in out.get("alerts", []) if not (isinstance(a, dict) and a.get("type") == "hand" and a.get("name") == name)]
    if out.get("handEnabled") and any(isinstance(a, dict) and a.get("type") == "hand" and a.get("name") == name for a in inc_alerts):
        cur_alerts.append({"type": "hand", "name": name})
    out["alerts"] = cur_alerts

    # Students may add their own private help messages while Ask for Help is enabled.
    # Teacher-deleted message IDs remain authoritative so stale student snapshots cannot restore them.
    inc_help_messages = incoming.get("helpMessages", []) if isinstance(incoming.get("helpMessages"), list) else []
    cur_help_messages = out.get("helpMessages", []) if isinstance(out.get("helpMessages"), list) else []
    deleted_help_ids = {str(x) for x in (out.get("helpDeletedIds", []) if isinstance(out.get("helpDeletedIds"), list) else [])}
    if out.get("helpEnabled"):
        known_help_ids = {str(m.get("id")) for m in cur_help_messages if isinstance(m, dict)}
        for msg in inc_help_messages:
            if not isinstance(msg, dict) or msg.get("name") != name:
                continue
            mid = str(msg.get("id") or "")
            if not mid or mid in deleted_help_ids or mid in known_help_ids:
                continue
            clean_msg = {
                "id": mid[:120],
                "name": name,
                "text": str(msg.get("text") or "I need help")[:240],
                "at": msg.get("at"),
                "seen": False,
            }
            cur_help_messages.insert(0, clean_msg)
            known_help_ids.add(mid)
    out["helpMessages"] = cur_help_messages

    # Students may send a photo whenever the teacher has Picture enabled.
    # A separate picture prompt is optional; teacher deletion/disable remains authoritative.
    inc_photos = incoming.get("photos", []) if isinstance(incoming.get("photos"), list) else []
    cur_photos = out.get("photos", []) if isinstance(out.get("photos"), list) else []
    if out.get("pictureEnabled"):
        known_ids = {str(p.get("id")) for p in cur_photos if isinstance(p, dict)}
        for photo in inc_photos:
            if isinstance(photo, dict) and photo.get("name") == name and str(photo.get("id")) not in known_ids:
                clean_photo = {
                    "id": photo.get("id"),
                    "name": name,
                    "data": str(photo.get("data") or "")[:2500000],
                    "seen": False,
                }
                if clean_photo["data"].startswith("data:image/"):
                    cur_photos.insert(0, clean_photo)
                    known_ids.add(str(clean_photo["id"]))
    out["photos"] = cur_photos

    can_run = out.get("activityRun")
    inc_run = incoming.get("activityRun")
    if not isinstance(can_run, dict) or not isinstance(inc_run, dict) or can_run.get("activityId") != inc_run.get("activityId"):
        return out
    if str(can_run.get("phase") or "") != "running":
        return out

    # Activity generation tokens invalidate delayed packets after resets, lobby
    # pauses, board authority changes, new Sketch rounds, and ORBIT follow-ups.
    can_token = str(can_run.get("runToken") or "")
    inc_token = str(inc_run.get("runToken") or "")
    if can_token and inc_token != can_token:
        return out

    aid = str(can_run.get("activityId", ""))

    # SI+ / generic response maps: accept only the teacher's current slide.
    # This prevents a delayed answer from landing after the class has moved on.
    inc_responses = inc_run.get("responses") if isinstance(inc_run.get("responses"), dict) else {}
    can_responses = can_run.setdefault("responses", {})
    current_slide = str(can_run.get("slideIndex", 0) or 0)
    response_map = inc_responses.get(current_slide)
    if isinstance(response_map, dict) and name in response_map:
        can_responses.setdefault(current_slide, {})[name] = copy.deepcopy(response_map[name])

    if aid == "starwheel-game":
        request = inc_run.get("starwheelRequest")
        if isinstance(request, dict):
            _starwheel_apply_request(out, can_run, name, request)

    elif aid == "vector-game":
        vr = inc_run.get("vectorResponses") or {}
        if isinstance(vr, dict) and isinstance(vr.get(name), dict):
            can_map = can_run.setdefault("vectorResponses", {})
            current = can_map.get(name) if isinstance(can_map.get(name), dict) else {}
            # Once a Vector is locked, stale packets cannot unlock or alter it.
            if not current.get("locked"):
                raw = vr[name]
                clean_pins = []
                for pin in raw.get("pins", []) if isinstance(raw.get("pins"), list) else []:
                    if not isinstance(pin, dict):
                        continue
                    try:
                        x = max(0.0, min(100.0, float(pin.get("x", 0))))
                        y = max(0.0, min(100.0, float(pin.get("y", 0))))
                    except (TypeError, ValueError):
                        continue
                    clean_pins.append({"x": round(x, 2), "y": round(y, 2)})
                    if len(clean_pins) >= 8:
                        break
                cfg = can_run.get("vectorConfig") if isinstance(can_run.get("vectorConfig"), dict) else {}
                if str(cfg.get("mode") or "single") == "multi":
                    try:
                        need = max(2, min(8, int(cfg.get("pinCount", 3) or 3)))
                    except (TypeError, ValueError):
                        need = 3
                else:
                    need = 1
                can_map[name] = {"pins": clean_pins, "locked": bool(raw.get("locked")) and len(clean_pins) >= need}

    elif aid == "orbit-game":
        rr = inc_run.get("orbitResponses") or {}
        can_round = int(can_run.get("orbitRound", 1) or 1)
        try:
            inc_round = int(inc_run.get("orbitRound", 1) or 1)
        except (TypeError, ValueError):
            inc_round = -1
        can_map = can_run.setdefault("orbitResponses", {})
        if inc_round == can_round and name not in can_map and isinstance(rr, dict) and isinstance(rr.get(name), dict):
            text_value = str(rr[name].get("text") or "").strip()[:500]
            if text_value:
                can_map[name] = {"text": text_value, "at": rr[name].get("at")}

    elif aid == "pixel-game":
        pg = inc_run.get("pixelGuesses") or {}
        if isinstance(pg, dict) and isinstance(pg.get(name), dict):
            can_map = can_run.setdefault("pixelGuesses", {})
            current = can_map.get(name) if isinstance(can_map.get(name), dict) else None
            allow_updates = bool((can_run.get("pixelConfig") or {}).get("allowUpdates"))
            incoming_guess = pg[name]
            try:
                incoming_at = float(incoming_guess.get("at") or 0)
            except (TypeError, ValueError):
                incoming_at = 0
            try:
                current_at = float(current.get("at") or 0) if current else -1
            except (TypeError, ValueError):
                current_at = -1
            if current is None or (allow_updates and incoming_at >= current_at):
                clean = {
                    "guess": str(incoming_guess.get("guess") or "")[:120],
                    "at": incoming_guess.get("at"),
                    "remainingAtSubmit": incoming_guess.get("remainingAtSubmit"),
                    "firstCorrectRemaining": incoming_guess.get("firstCorrectRemaining"),
                }
                # Teacher scoring is authoritative across student updates.
                if current and "teacherCorrect" in current:
                    clean["teacherCorrect"] = current.get("teacherCorrect")
                elif "teacherCorrect" in incoming_guess:
                    clean["teacherCorrect"] = incoming_guess.get("teacherCorrect")
                if current and current.get("firstCorrectRemaining") is not None and clean.get("firstCorrectRemaining") is None:
                    clean["firstCorrectRemaining"] = current.get("firstCorrectRemaining")
                can_map[name] = clean

    elif aid == "board-game":
        can_board = can_run.get("board") or {}
        inc_board = inc_run.get("board") or {}
        if can_board.get("controller") == name and isinstance(can_board.get("pages"), list) and isinstance(inc_board.get("pages"), list):
            inc_pages = {str(pg.get("id")): pg for pg in inc_board.get("pages", []) if isinstance(pg, dict)}
            for page in can_board.get("pages", []):
                if not isinstance(page, dict):
                    continue
                other = inc_pages.get(str(page.get("id")))
                if not other:
                    continue
                kept = [st for st in page.get("strokes", []) if not (isinstance(st, dict) and st.get("owner") == name)]
                own = [copy.deepcopy(st) for st in other.get("strokes", []) if isinstance(st, dict) and st.get("owner") == name]
                page["strokes"] = kept + own

    elif aid == "sketch-game":
        can_sketch = can_run.get("sketch") or {}
        inc_sketch = inc_run.get("sketch") or {}
        try:
            can_round = int(can_sketch.get("round", 0) or 0)
            inc_round = int(inc_sketch.get("round", 0) or 0) if isinstance(inc_sketch, dict) else -1
        except (TypeError, ValueError):
            can_round, inc_round = -1, -2
        same_round = (
            isinstance(inc_sketch, dict)
            and can_round == inc_round
            and str(can_sketch.get("artist") or "") == str(inc_sketch.get("artist") or "")
            and str(can_sketch.get("word") or "") == str(inc_sketch.get("word") or "")
        )
        if same_round:
            inc_guesses = inc_sketch.get("guesses") or {}
            if isinstance(inc_guesses, dict) and isinstance(inc_guesses.get(name), dict):
                can_guesses = can_sketch.setdefault("guesses", {})
                raw_guess = inc_guesses[name]
                guess_text = str(raw_guess.get("text") or "")[:80]
                auto_accepted = _sketch_auto_match(guess_text, can_sketch.get("word"))
                incoming_guess = {
                    "text": guess_text,
                    "status": "accepted" if auto_accepted else "pending",
                    "at": raw_guess.get("at"),
                }
                current = can_guesses.get(name) if isinstance(can_guesses.get(name), dict) else None
                accept_guess = current is None
                current_status = str(current.get("status") or "") if current else ""
                if current:
                    try:
                        incoming_at = float(incoming_guess.get("at") or 0)
                        current_at = float(current.get("at") or 0)
                        reviewed_at = float(current.get("reviewedAt") or 0)
                    except (TypeError, ValueError):
                        incoming_at, current_at, reviewed_at = 0, 0, 0
                    if current_status == "accepted":
                        accept_guess = False
                    elif current_status == "rejected":
                        # A rejected guess may be replaced only by a genuinely new guess.
                        accept_guess = incoming_at > max(current_at, reviewed_at)
                    else:
                        accept_guess = incoming_at >= current_at
                if accept_guess:
                    if incoming_guess["status"] == "accepted":
                        _sketch_award_score(can_run, name)
                        incoming_guess["scored"] = bool((can_run.get("sketchConfig") or {}).get("scoring"))
                    can_guesses[name] = incoming_guess
                    can_run["sketch"] = can_sketch

            can_board = can_run.get("board") or {}
            inc_board = inc_run.get("board") or {}
            if can_sketch.get("artist") == name and can_board.get("controller") == name and isinstance(can_board.get("pages"), list) and isinstance(inc_board.get("pages"), list):
                inc_pages = {str(pg.get("id")): pg for pg in inc_board.get("pages", []) if isinstance(pg, dict)}
                for page in can_board.get("pages", []):
                    if not isinstance(page, dict):
                        continue
                    other = inc_pages.get(str(page.get("id")))
                    if not other:
                        continue
                    kept = [st for st in page.get("strokes", []) if not (isinstance(st, dict) and st.get("owner") == name)]
                    own = [copy.deepcopy(st) for st in other.get("strokes", []) if isinstance(st, dict) and st.get("owner") == name]
                    page["strokes"] = kept + own

    elif aid == "minefield-game":
        # Navigator packets may alter only the active Minefield field and the
        # turn-transition fields it legitimately controls. Teacher configuration,
        # inactive team fields, and unrelated activity state remain authoritative.
        if _minefield_current_navigator(out, can_run) == name:
            mode = str(can_run.get("minefieldMode") or out.get("minefieldMode") or "crew")
            def valid_field_transition(current_field: object, incoming_field: object) -> bool:
                if not isinstance(current_field, dict) or not isinstance(incoming_field, dict):
                    return False
                try:
                    current_turn = int(current_field.get("turn", 1) or 1)
                    incoming_turn = int(incoming_field.get("turn", 1) or 1)
                except (TypeError, ValueError):
                    return False
                return incoming_turn in (current_turn, current_turn + 1)

            if mode == "teams":
                try:
                    active_idx = int(can_run.get("activeTeam", 0) or 0)
                except (TypeError, ValueError):
                    active_idx = 0
                can_fields = can_run.get("mfTeams")
                inc_fields = inc_run.get("mfTeams")
                if isinstance(can_fields, list) and isinstance(inc_fields, list) and 0 <= active_idx < len(can_fields) and active_idx < len(inc_fields) and valid_field_transition(can_fields[active_idx], inc_fields[active_idx]):
                    can_fields[active_idx] = copy.deepcopy(inc_fields[active_idx])
                    winner = inc_run.get("teamWinner")
                    if winner is None or winner == active_idx:
                        can_run["teamWinner"] = winner
                    try:
                        next_idx = int(inc_run.get("activeTeam", active_idx))
                    except (TypeError, ValueError):
                        next_idx = active_idx
                    if 0 <= next_idx < len(can_fields):
                        can_run["activeTeam"] = next_idx
            elif mode == "teacher":
                if str(can_run.get("activeSide") or "class") == "class" and valid_field_transition(can_run.get("mfClass"), inc_run.get("mfClass")):
                    can_run["mfClass"] = copy.deepcopy(inc_run["mfClass"])
                    next_side = str(inc_run.get("activeSide") or "class")
                    if next_side in ("class", "teacher"):
                        can_run["activeSide"] = next_side
                    winner = inc_run.get("teacherVsWinner")
                    if winner is None or winner in ("class", "teacher"):
                        can_run["teacherVsWinner"] = winner
            else:
                if valid_field_transition(can_run.get("mf"), inc_run.get("mf")):
                    can_run["mf"] = copy.deepcopy(inc_run["mf"])
            if isinstance(inc_run.get("narrationLog"), list):
                can_run["narrationLog"] = copy.deepcopy(inc_run["narrationLog"][-6:])
            can_run["latestNarration"] = str(inc_run.get("latestNarration") or can_run.get("latestNarration") or "")[:1200]

    return out


def load_teacher_storage() -> dict[str, str]:
    with db() as con:
        rows = con.execute("SELECT key,value FROM teacher_kv").fetchall()
    return {r["key"]: r["value"] for r in rows if r["key"] in PERSISTED_STORAGE_KEYS}


def save_teacher_storage(key: str, value: str) -> None:
    if key not in PERSISTED_STORAGE_KEYS:
        raise ValueError("unsupported storage key")
    with db() as con:
        con.execute(
            """INSERT INTO teacher_kv(key,value,updated_at) VALUES(?,?,?)
               ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at""",
            (key, value, time.time()),
        )


def get_or_create_auth_secret() -> str:
    with db() as con:
        row = con.execute("SELECT value FROM server_meta WHERE key='auth_secret'").fetchone()
        if row:
            return str(row["value"])
        value = secrets.token_urlsafe(48)
        con.execute("INSERT INTO server_meta(key,value) VALUES('auth_secret',?)", (value,))
        return value


def teacher_cookie_value() -> str:
    secret = get_or_create_auth_secret().encode("utf-8")
    return hmac.new(secret, b"si-mothership-teacher", hashlib.sha256).hexdigest()


def teacher_authorized(request: web.Request, data: Optional[dict] = None) -> bool:
    cookie = request.cookies.get("si_teacher_session", "")
    if cookie and hmac.compare_digest(cookie, teacher_cookie_value()):
        return True
    # Backward-compatible local API access while moving clients to cookie auth.
    if isinstance(data, dict) and str(data.get("teacher_key", "")) == TEACHER_KEY:
        return True
    return False


def set_teacher_cookie(response: web.StreamResponse, remember: bool, secure: bool) -> None:
    kwargs = {
        "httponly": True,
        "samesite": "Lax",
        "secure": secure,
        "path": "/",
    }
    if remember:
        kwargs["max_age"] = 60 * 60 * 24 * 30
    response.set_cookie("si_teacher_session", teacher_cookie_value(), **kwargs)


def get_lan_ip() -> str:
    candidates: list[str] = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_STREAM):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and not ip.startswith("169.254."):
                candidates.append(ip)
    except Exception:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127.") and not ip.startswith("169.254."):
            candidates.insert(0, ip)
    except Exception:
        pass
    seen = set()
    for ip in candidates:
        if ip not in seen:
            seen.add(ip)
            return ip
    return "127.0.0.1"


LAN_IP = get_lan_ip()
LOCAL_ORIGIN = f"http://{LAN_IP}:{PORT}"
PUBLIC_ORIGIN = PUBLIC_BASE_URL or LOCAL_ORIGIN


def effective_origin(request: web.Request) -> str:
    if PUBLIC_BASE_URL:
        return PUBLIC_BASE_URL
    forwarded_proto = (request.headers.get("X-Forwarded-Proto") or "").split(",", 1)[0].strip()
    forwarded_host = (request.headers.get("X-Forwarded-Host") or "").split(",", 1)[0].strip()
    proto = forwarded_proto or request.scheme
    host = forwarded_host or (request.host or "").strip()
    hostname = host.split(":", 1)[0].strip("[]").lower() if host else ""
    if host and hostname not in {"localhost", "127.0.0.1", "::1"}:
        return f"{proto}://{host}"
    return LOCAL_ORIGIN

def make_qr_data_uri(target: str) -> str:
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
    qr.add_data(target)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def session_urls(origin: str) -> dict:
    student_url = origin + f"/?role=student&code={CURRENT_JOIN_CODE}&sid={CURRENT_SESSION_ID}"
    shared_url = origin + f"/?role=shared&sid={CURRENT_SESSION_ID}"
    return {
        "code": CURRENT_JOIN_CODE,
        "session_id": CURRENT_SESSION_ID,
        "student_url": student_url,
        "shared_url": shared_url,
        "qr_data": make_qr_data_uri(student_url),
    }


async def index(request: web.Request) -> web.Response:
    text = INDEX_PATH.read_text(encoding="utf-8")
    origin = effective_origin(request)
    urls = session_urls(origin)
    role = (request.query.get("role") or "teacher").lower()
    authenticated = role == "teacher" and teacher_authorized(request)
    all_store = load_teacher_storage()
    if authenticated:
        store = all_store
    elif role == "student":
        store = {k: v for k, v in all_store.items() if k in PUBLIC_STORAGE_KEYS}
    else:
        store = {}
    # Hydrate only the storage appropriate for this role before the app script runs.
    storage_boot = (
        "(function(){"
        f"const d={json.dumps(store)};"
        "try{Object.keys(d).forEach(k=>localStorage.setItem(k,d[k]));}catch(e){}"
        "const persistKeys=new Set(Object.keys(d).concat(["
        + ",".join(json.dumps(k) for k in sorted(PERSISTED_STORAGE_KEYS))
        + "]));"
        "const role=new URLSearchParams(location.search).get('role')||'teacher';"
        "const orig=Storage.prototype.setItem;"
        "Storage.prototype.setItem=function(k,v){orig.call(this,k,v);"
        "if(this===localStorage&&role==='teacher'&&persistKeys.has(k)){"
        "fetch('/api/storage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:String(v)})}).catch(()=>{});"
        "}};"
        "if(role==='teacher'){persistKeys.forEach(k=>{if(!(k in d)){const v=localStorage.getItem(k);if(v!==null)fetch('/api/storage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})}).catch(()=>{});}});}"
        "})();"
    )
    injected = (
        "<script>"
        f"window.__SI_PUBLIC_ORIGIN__={json.dumps(origin)};"
        f"window.__SI_JOIN_CODE__={json.dumps(CURRENT_JOIN_CODE)};"
        f"window.__SI_SESSION_ID__={json.dumps(CURRENT_SESSION_ID)};"
        f"window.__SI_STUDENT_URL__={json.dumps(urls['student_url'])};"
        f"window.__SI_SHARED_URL__={json.dumps(urls['shared_url'])};"
        f"window.__SI_QR_DATA_URI__={json.dumps(urls['qr_data'])};"
        f"window.__SI_TEACHER_AUTHENTICATED__={json.dumps(authenticated)};"
        f"window.__SI_SERVER_AUTH_AVAILABLE__=true;"
        + storage_boot
        + "</script>"
    )
    text = text.replace("<head>", "<head>" + injected, 1)
    return web.Response(text=text, content_type="text/html", headers={"Cache-Control": "no-store, no-cache, must-revalidate"})


async def scientific_calculator(request: web.Request) -> web.Response:
    """Serve the SI Scientific Calculator with the classroom-modeling visual skin."""
    if not CALCULATOR_INDEX_GZ.exists():
        raise web.HTTPNotFound(text="Scientific Calculator is unavailable.")
    try:
        text = gzip.decompress(CALCULATOR_INDEX_GZ.read_bytes()).decode("utf-8")
    except (OSError, UnicodeDecodeError):
        raise web.HTTPInternalServerError(text="Scientific Calculator could not be loaded.")
    popup_mode = (request.query.get("popup") or "").strip() == "1"
    calculator_skin = CALCULATOR_MODELING_STYLE + (CALCULATOR_POPUP_STYLE if popup_mode else "")
    text = text.replace("</head>", calculator_skin + "</head>", 1)
    return web.Response(
        text=text,
        content_type="text/html",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


async def scientific_calculator_engine(request: web.Request) -> web.Response:
    if not CALCULATOR_ENGINE_GZ.exists():
        raise web.HTTPNotFound(text="Calculator engine is unavailable.")
    return web.Response(
        body=CALCULATOR_ENGINE_GZ.read_bytes(),
        content_type="application/javascript",
        headers={"Content-Encoding": "gzip", "Cache-Control": "public, max-age=3600"},
    )


async def health(request: web.Request) -> web.Response:
    role_counts = {"teacher": 0, "student": 0, "shared": 0, "other": 0}
    for ws in list(CLIENTS):
        if ws.closed:
            continue
        role = str(CLIENT_META.get(ws, {}).get("role") or "other")
        role_counts[role if role in role_counts else "other"] += 1
    return web.json_response({
        "ok": True,
        "version": APP_VERSION,
        "join_code": CURRENT_JOIN_CODE,
        "session_id": CURRENT_SESSION_ID,
        "public_origin": effective_origin(request),
        "clients": len(CLIENTS),
        "client_roles": role_counts,
        "state_persisted": LATEST_STATE is not None,
        "database": DB_PATH.name,
    }, headers={"Cache-Control": "no-store"})


async def info(request: web.Request) -> web.Response:
    origin = effective_origin(request)
    urls = session_urls(origin)
    return web.json_response({
        "ok": True,
        "join_code": CURRENT_JOIN_CODE,
        "session_id": CURRENT_SESSION_ID,
        "teacher_url": origin + "/",
        "student_url": urls["student_url"],
        "shared_url": urls["shared_url"],
    })


async def join_check(request: web.Request) -> web.Response:
    code = (request.query.get("code") or "").strip().upper()
    sid = (request.query.get("sid") or "").strip()
    ok = code == CURRENT_JOIN_CODE and (not sid or sid == CURRENT_SESSION_ID)
    return web.json_response({"ok": ok, "code": CURRENT_JOIN_CODE if ok else None, "session_id": CURRENT_SESSION_ID if ok else None}, headers={"Cache-Control": "no-store"})


async def session_info(request: web.Request) -> web.Response:
    return web.json_response({"ok": True, **session_urls(effective_origin(request))}, headers={"Cache-Control": "no-store"})


async def qr_png(request: web.Request) -> web.Response:
    target = (request.query.get("url") or "").strip()
    if not target:
        target = session_urls(effective_origin(request))["student_url"]
    try:
        parts = urlsplit(target)
        if parts.scheme not in {"http", "https"}:
            raise ValueError("unsupported QR URL")
    except Exception:
        raise web.HTTPBadRequest(text="Invalid QR URL")
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
    qr.add_data(target)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return web.Response(body=buf.getvalue(), content_type="image/png", headers={"Cache-Control": "no-store"})


async def teacher_login(request: web.Request) -> web.Response:
    data = await request.json()
    if str(data.get("key", "")).strip() != TEACHER_KEY:
        return web.json_response({"ok": False, "error": "invalid_key"}, status=401)
    remember = bool(data.get("remember"))
    response = web.json_response({"ok": True})
    set_teacher_cookie(response, remember, effective_origin(request).startswith("https://"))
    return response


async def teacher_status(request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "authenticated": teacher_authorized(request)})


async def teacher_logout(request: web.Request) -> web.Response:
    response = web.json_response({"ok": True})
    response.del_cookie("si_teacher_session", path="/")
    return response


async def storage_write(request: web.Request) -> web.Response:
    data = await request.json()
    if not teacher_authorized(request, data):
        raise web.HTTPUnauthorized(text="Teacher login required")
    key = str(data.get("key", ""))
    value = str(data.get("value", ""))
    if key not in PERSISTED_STORAGE_KEYS:
        raise web.HTTPBadRequest(text="Unsupported key")
    if len(value.encode("utf-8")) > 24 * 1024 * 1024:
        raise web.HTTPRequestEntityTooLarge(max_size=24 * 1024 * 1024, actual_size=len(value.encode("utf-8")))
    save_teacher_storage(key, value)
    return web.json_response({"ok": True, "key": key})


async def storage_snapshot(request: web.Request) -> web.Response:
    items = load_teacher_storage()
    if teacher_authorized(request):
        return web.json_response({"ok": True, "items": items, "scope": "teacher"})
    public_items = {k: v for k, v in items.items() if k in PUBLIC_STORAGE_KEYS}
    return web.json_response({"ok": True, "items": public_items, "scope": "public"})


async def new_session_handler(request: web.Request) -> web.Response:
    data = await request.json()
    if not teacher_authorized(request, data):
        raise web.HTTPUnauthorized(text="Teacher login required")
    code = rotate_session()
    # Student/shared clients from the prior session are disconnected. Teacher sockets remain.
    stale = []
    for ws in list(CLIENTS):
        meta = CLIENT_META.get(ws, {})
        if meta.get("role") in {"student", "shared"}:
            stale.append(ws)
    for ws in stale:
        try:
            await ws.send_json({"type": "session_reset"})
            await ws.close(code=4001, message=b"New classroom session")
        except Exception:
            pass
        CLIENTS.discard(ws)
        CLIENT_META.pop(ws, None)
    origin = effective_origin(request)
    urls = session_urls(origin)
    await broadcast({"type": "join_code", **urls})
    return web.json_response({"ok": True, **urls})


async def broadcast(payload: dict, exclude: Optional[web.WebSocketResponse] = None) -> None:
    dead = []
    for ws in list(CLIENTS):
        if ws is exclude or ws.closed:
            continue
        try:
            outgoing = payload
            if payload.get("type") == "state" and isinstance(payload.get("state"), dict):
                meta = CLIENT_META.get(ws, {})
                outgoing = dict(payload)
                outgoing["state"] = _state_for_role(
                    payload["state"],
                    str(meta.get("role") or ""),
                    str(meta.get("student_token") or ""),
                    str(meta.get("student_name") or ""),
                )
            await ws.send_str(json.dumps(outgoing, separators=(",", ":")))
        except Exception:
            dead.append(ws)
    for ws in dead:
        CLIENTS.discard(ws)
        CLIENT_META.pop(ws, None)


def student_connection_present(token: str = "", name: str = "") -> bool:
    """Return True when another live student socket represents this student.

    Refreshing a browser can briefly leave the old and new sockets alive at the
    same time. Presence should not flip offline when only the old socket closes.
    """
    token = str(token or "")
    name = str(name or "")
    for candidate in list(CLIENTS):
        if candidate.closed:
            continue
        meta = CLIENT_META.get(candidate, {})
        if meta.get("role") != "student":
            continue
        if token and str(meta.get("student_token") or "") == token:
            return True
        if name and str(meta.get("student_name") or "") == name:
            return True
    return False


async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    role = (request.query.get("role") or "client").lower()
    if role == "teacher" and not teacher_authorized(request):
        raise web.HTTPUnauthorized(text="Teacher login required")
    code = (request.query.get("code") or "").strip().upper()
    sid = (request.query.get("sid") or "").strip()
    if role == "student" and (code != CURRENT_JOIN_CODE or (sid and sid != CURRENT_SESSION_ID)):
        raise web.HTTPForbidden(text="Class code expired or invalid")
    if role == "shared" and sid and sid != CURRENT_SESSION_ID:
        raise web.HTTPForbidden(text="Shared-screen session expired")

    ws = web.WebSocketResponse(heartbeat=20, receive_timeout=None, max_msg_size=32 * 1024 * 1024)
    await ws.prepare(request)
    CLIENTS.add(ws)
    CLIENT_META[ws] = {"role": role, "code": code, "session_id": sid or CURRENT_SESSION_ID, "connected_at": time.time()}

    await _send_current_state(ws)
    await ws.send_json({"type": "join_code", **session_urls(effective_origin(request))})

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                except json.JSONDecodeError:
                    continue
                mtype = data.get("type")
                if mtype == "hello":
                    meta = CLIENT_META.get(ws, {})
                    if data.get("student_token") and not meta.get("student_token"):
                        meta["student_token"] = str(data.get("student_token"))
                    if data.get("student_name") and not meta.get("student_name"):
                        meta["student_name"] = str(data.get("student_name"))
                    CLIENT_META[ws] = meta
                    if role == "student" and meta.get("student_name"):
                        await broadcast({"type": "presence", "student_token": meta.get("student_token", ""), "student_name": meta.get("student_name", ""), "online": True}, exclude=ws)
                    await _send_current_state(ws)
                elif mtype == "starwheel_action" and isinstance(data.get("request"), dict):
                    request_data = copy.deepcopy(data["request"])
                    if role == "student":
                        meta = CLIENT_META.get(ws, {})
                        token = str(meta.get("student_token") or data.get("student_token") or "")
                        name = str(meta.get("student_name") or data.get("student_name") or "")
                        if token and not meta.get("student_token"):
                            meta["student_token"] = token
                        if name and not meta.get("student_name"):
                            meta["student_name"] = name
                        CLIENT_META[ws] = meta
                    elif role == "teacher":
                        name = str(data.get("student_name") or request_data.get("name") or "")
                    else:
                        continue
                    current = copy.deepcopy(LATEST_STATE) if isinstance(LATEST_STATE, dict) else None
                    run = current.get("activityRun") if isinstance(current, dict) else None
                    if isinstance(run, dict) and str(run.get("activityId") or "") == "starwheel-game" and str(run.get("phase") or "") == "running" and name:
                        request_data["name"] = name
                        _starwheel_apply_request(current, run, name, request_data)
                        save_runtime_state(current)
                        await broadcast({"type": "state", "state": LATEST_STATE}, exclude=None)
                elif mtype == "game_show_action" and isinstance(data.get("request"), dict):
                    if role != "student":
                        continue
                    request_data = copy.deepcopy(data["request"])
                    meta = CLIENT_META.get(ws, {})
                    token = str(meta.get("student_token") or data.get("student_token") or "")
                    name = str(meta.get("student_name") or data.get("student_name") or "")
                    if token and not meta.get("student_token"):
                        meta["student_token"] = token
                    if name and not meta.get("student_name"):
                        meta["student_name"] = name
                    CLIENT_META[ws] = meta
                    current = copy.deepcopy(LATEST_STATE) if isinstance(LATEST_STATE, dict) else None
                    run = current.get("activityRun") if isinstance(current, dict) else None
                    if not isinstance(run, dict) or str(run.get("phase") or "") != "running" or not name:
                        continue
                    request_data["name"] = name
                    game = str(request_data.get("game") or "")
                    activity_id = str(run.get("activityId") or "")
                    if game == "crew-survey" and activity_id == "crew-survey-game":
                        _crew_survey_apply_request(current, run, name, request_data)
                    elif game == "million" and activity_id == "million-game":
                        _million_apply_request(current, run, name, request_data)
                    else:
                        continue
                    save_runtime_state(current)
                    await broadcast({"type": "state", "state": LATEST_STATE}, exclude=None)
                elif mtype == "state" and isinstance(data.get("state"), dict):
                    if role == "teacher":
                        save_runtime_state(data["state"])
                    elif role == "student":
                        meta = CLIENT_META.get(ws, {})
                        # Lock the socket to its first established student identity.
                        # Later whole-state messages cannot switch to another student.
                        token = str(meta.get("student_token") or data.get("student_token") or "")
                        name = str(meta.get("student_name") or data.get("student_name") or "")
                        if token and not meta.get("student_token"):
                            meta["student_token"] = token
                        if name and not meta.get("student_name"):
                            meta["student_name"] = name
                        CLIENT_META[ws] = meta
                        merged = merge_student_snapshot(LATEST_STATE, data["state"], token, name)
                        save_runtime_state(merged)
                        if name:
                            await broadcast({"type": "presence", "student_token": token, "student_name": name, "online": True}, exclude=ws)
                    else:
                        # Shared-screen clients are view-only.
                        continue
                    await broadcast({"type": "state", "state": LATEST_STATE}, exclude=ws)
                    if role == "student":
                        await _send_current_state(ws)
                elif mtype == "session_reset" and role == "teacher":
                    save_runtime_state(None)
                    await broadcast({"type": "session_reset"}, exclude=ws)
            elif msg.type in (WSMsgType.ERROR, WSMsgType.CLOSE, WSMsgType.CLOSED):
                break
    finally:
        meta = CLIENT_META.get(ws, {})
        CLIENTS.discard(ws)
        CLIENT_META.pop(ws, None)
        if role == "student" and meta.get("student_name"):
            token = str(meta.get("student_token") or "")
            name = str(meta.get("student_name") or "")
            if not student_connection_present(token, name):
                try:
                    await broadcast({"type": "presence", "student_token": token, "student_name": name, "online": False})
                except Exception:
                    pass
    return ws


def create_app() -> web.Application:
    app = web.Application(client_max_size=32 * 1024 * 1024)
    app.router.add_get("/", index)
    app.router.add_get("/index.html", index)
    app.router.add_get("/tools/scientific-calculator", scientific_calculator)
    app.router.add_get("/tools/scientific-calculator/", scientific_calculator)
    app.router.add_get("/tools/scientific-calculator/engine.js", scientific_calculator_engine)
    app.router.add_get("/api/health", health)
    app.router.add_get("/api/info", info)
    app.router.add_get("/api/join-check", join_check)
    app.router.add_get("/api/session/info", session_info)
    app.router.add_get("/api/qr", qr_png)
    app.router.add_post("/api/teacher/login", teacher_login)
    app.router.add_get("/api/teacher/status", teacher_status)
    app.router.add_post("/api/teacher/logout", teacher_logout)
    app.router.add_get("/api/storage", storage_snapshot)
    app.router.add_post("/api/storage", storage_write)
    app.router.add_post("/api/session/new", new_session_handler)
    app.router.add_get("/ws", websocket_handler)
    return app


async def open_browser_later() -> None:
    if NO_BROWSER or PUBLIC_BASE_URL or os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT"):
        return
    await asyncio.sleep(1.0)
    try:
        webbrowser.open(LOCAL_ORIGIN + "/")
    except Exception:
        pass


async def main() -> None:
    init_db()
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    await site.start()

    urls = session_urls(PUBLIC_ORIGIN)
    print("\n" + "=" * 72)
    print(f" SI MOTHERSHIP v{APP_VERSION} — REFERENCE CALCULATOR LAYOUT")
    print("=" * 72)
    print(f" Teacher:       {PUBLIC_ORIGIN}/")
    print(f" Student:       {urls['student_url']}")
    print(f" 2nd Screen:    {urls['shared_url']}")
    print(f" Teacher key:   {TEACHER_KEY}")
    print(f" Student code:  {CURRENT_JOIN_CODE}")
    print(f" Data file:     {DB_PATH.name}")
    print("\nHosted-ready session server. Use PUBLIC_BASE_URL behind HTTPS if your host does not forward headers.")
    print("Starting a new session creates a fresh join code and clears old runtime state.")
    print("Keep this window open while using Mothership.")
    print("=" * 72 + "\n")
    sys.stdout.flush()

    asyncio.create_task(open_browser_later())
    stop = asyncio.Event()
    try:
        await stop.wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
