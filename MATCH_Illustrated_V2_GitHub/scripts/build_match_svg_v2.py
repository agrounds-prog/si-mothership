#!/usr/bin/env python3
"""Generate independent text-free SVG UI skins for the MATCH Illustrated studio."""
from pathlib import Path
D=Path(__file__).resolve().parents[1]/'assets'/'match-illustrated-v2';D.mkdir(parents=True,exist_ok=True)
colors={
 'blue':('#75d8ff','#0871ad','#092750'),
 'cyan':('#8af5ff','#08879c','#092c48'),
 'green':('#b0ffd6','#058956','#073b40'),
 'orange':('#ffe4a0','#bb661b','#4a2d31'),
 'red':('#ff9eba','#a42e54','#441c3f'),
 'purple':('#cab0ff','#734dc0','#282352'),
 'navy':('#a7d7f7','#29638d','#0b2745'),
 'disabled':('#acc1cd','#3f6078','#132a39'),
 'teal':('#83fff2','#087b76','#083e50')
}
def poly(w,h,c=21,m=7):
 return f'{c+m},{m} {w-c-m},{m} {w-m},{c+m} {w-m},{h-c-m} {w-c-m},{h-m} {c+m},{h-m} {m},{h-c-m} {m},{c+m}'
def svg(name,w,h,tone,kind='button'):
    light,mid,dark=colors[tone]
    outer=poly(w,h,20 if kind=='button' else 29,7)
    inner=poly(w-20,h-20,16 if kind=='button' else 25,0)
    # An SVG is an actual reusable graphical skin; no texts or buttons are baked in.
    content=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" aria-hidden="true">
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="0.12" y2="1"><stop offset="0" stop-color="#b1e6ff" stop-opacity=".82"/><stop offset=".09" stop-color="#173e5c"/><stop offset=".47" stop-color="#051529"/><stop offset=".83" stop-color="#0c2b44"/><stop offset="1" stop-color="#c2ebff" stop-opacity=".48"/></linearGradient>
    <linearGradient id="face" x1="0" y1="0" x2=".18" y2="1"><stop offset="0" stop-color="{mid}"/><stop offset=".11" stop-color="{mid}"/><stop offset=".5" stop-color="{dark}"/><stop offset=".9" stop-color="#061529"/><stop offset="1" stop-color="#020c1f"/></linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0.0" y2="1"><stop offset="0" stop-color="white" stop-opacity=".26"/><stop offset=".44" stop-color="white" stop-opacity=".05"/><stop offset=".52" stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
    <filter id="glow" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="grain" width="16" height="10" patternUnits="userSpaceOnUse"><path d="M0 0H16 M0 7H16" stroke="#d7f9ff" stroke-opacity=".035" stroke-width=".65"/><path d="M4 0l4 4" stroke="#7dc5ec" stroke-opacity=".07" stroke-width=".7"/></pattern>
  </defs>
  <polygon points="{outer}" fill="url(#metal)" stroke="{light}" stroke-opacity=".82" stroke-width="3"/>
  <g transform="translate(10 10)"><polygon points="{inner}" fill="url(#face)" stroke="{light}" stroke-width="2" stroke-opacity=".92"/>
  <polygon points="{inner}" fill="url(#gloss)"/><polygon points="{inner}" fill="url(#grain)"/></g>
  <path d="M {36} 16 H {w-36}" stroke="{light}" stroke-opacity=".92" stroke-width="2.6" filter="url(#glow)"/>
  <path d="M 29 {h-17} H {w-31}" stroke="{light}" stroke-opacity=".45" stroke-width="2"/>
  <path d="M 12 44L39 17 M {w-13} 44L{w-40} 17 M 12 {h-46}L39 {h-18} M {w-13} {h-46}L{w-40} {h-18}" fill="none" stroke="{light}" stroke-opacity=".65" stroke-width="2"/>
  <path d="M 36 21H {w-36}" stroke="white" stroke-opacity=".18" stroke-width="1"/>
  <g fill="#031325" stroke="{light}" stroke-opacity=".57" stroke-width="1.5"><circle cx="26" cy="32" r="3"/><circle cx="{w-26}" cy="32" r="3"/><circle cx="26" cy="{h-34}" r="3"/><circle cx="{w-26}" cy="{h-34}" r="3"/></g>
</svg>'''
    (D/name).write_text(content,encoding='utf-8')

def tile():
    svg('board_tile.svg',270,270,'blue','tile')
    p=D/'board_tile.svg';s=p.read_text();s=s.replace('</svg>', '''<path d="M135 38l8 15-8 15-8-15z" fill="#c4faff" fill-opacity=".87" filter="url(#glow)"/>
    <path d="M31 213H239" stroke="#71daff" stroke-opacity=".28" stroke-width="1"/></svg>''');p.write_text(s)

assets=[('button_blue.svg',540,134,'blue','button'),('button_green.svg',630,140,'green','button'),('button_cyan.svg',540,128,'cyan','button'),('button_purple.svg',540,128,'purple','button'),('button_orange.svg',540,128,'orange','button'),('button_red.svg',540,128,'red','button'),('button_navy.svg',540,128,'navy','button'),('button_disabled.svg',540,128,'disabled','button'),('mode_idle.svg',580,225,'blue','panel'),('mode_active.svg',580,225,'teal','panel'),('mode_purple.svg',580,225,'purple','panel'),('panel.svg',1100,700,'navy','panel'),('section.svg',1100,300,'cyan','panel'),('header.svg',1500,250,'cyan','panel'),('gallery.svg',1100,250,'blue','panel'),('stat.svg',270,176,'cyan','panel'),('row.svg',1100,125,'blue','panel'),('tab.svg',370,115,'green','button')]
for name,w,h,tone,kind in assets:svg(name,w,h,tone,kind)
tile()
print(f'Wrote {len(assets)+1} text-free SVGs')
