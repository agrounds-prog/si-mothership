#!/usr/bin/env python3
"""Create real, reusable PNG art for existing Mothership teacher controls.
Decorations only: no static student data, fake codes, or simulated controls.
The old PNG assets in this repository are the source imagery.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math

BASE = Path(__file__).resolve().parents[1]
SRC = BASE / "SI_Mothership_Dashboard_Visual_Assets" / "details"
OUT = BASE / "assets" / "command-deck-v3"
OUT.mkdir(parents=True, exist_ok=True)
S = 2

def scene(w,h,rgb):
    im=Image.new("RGB",(w*S,h*S),rgb)
    draw=ImageDraw.Draw(im,"RGBA")
    return im,draw

def ellipse(draw,box,c,width=2):
    draw.ellipse(tuple(int(v*S) for v in box),outline=c,width=width*S)

def line(draw,pts,c,width=1):
    draw.line([(int(x*S),int(y*S)) for x,y in pts],fill=c,width=width*S)

def finish(im,name,size):
    im.resize(size,Image.Resampling.LANCZOS).save(OUT/name,optimize=True)

# Holographic crew scanner, illuminated floor, diagonal perspective lines.
w,h=850,465
im,d=scene(w,h,(3,20,39))
for y in range(h*S):
    t=y/(h*S)
    d.line((0,y,w*S,y),fill=(4+int(4*t),17+int(14*t),35+int(23*t),255))
for r in (70,109,153,197,244):
    ellipse(d,(425-r,194-r*.65,425+r,194+r*.65),(24,159,214,54),1)
for a in range(0,360,30):
    rad=math.radians(a)
    line(d,[(425,194),(425+320*math.cos(rad),194+205*math.sin(rad))],(33,136,189,25),1)
for x in (36,814):
    line(d,[(x,30),(x,92)],(47,207,250,130),3)
# Separate luminous rings, not dark overlapping fake black ovals.
for width,depth,opacity in ((278,44,80),(226,30,105),(174,22,156),(115,12,196)):
    ellipse(d,(425-width,409-depth,425+width,409+depth),(18,225,253,opacity),3)
line(d,[(100,436),(155,436)],(255,155,45,180),4)
line(d,[(695,436),(750,436)],(255,155,45,180),4)
finish(im,"roster-scanner.png",(850,465))

# Calm alerts-monitoring arena with a stronger illuminated platform.
w,h=850,520
im,d=scene(w,h,(4,20,37))
for y in range(h*S):
    t=y/(h*S)
    d.line((0,y,w*S,y),fill=(5+int(2*t),18+int(13*t),36+int(18*t),255))
for x,side in ((35,1),(815,-1)):
    line(d,[(x,75),(x+side*35,45),(x+side*95,45)],(46,152,209,110),3)
    line(d,[(x,391),(x+side*35,428)],(46,152,209,110),3)
for r,opacity in ((300,70),(246,100),(180,145),(120,190)):
    ellipse(d,(425-r,448-r*.15,425+r,448+r*.15),(20,213,248,opacity),3)
for x in (88,762):
    line(d,[(x-40,506),(x+40,506)],(249,140,52,185),5)
finish(im,"alerts-platform.png",(850,520))

# Capture the photographic glass rim of an actual approved button image,
# remove its text center, keep source photo chrome so real button labels overlay it.
src=Image.open(SRC/"shared_screen_panel_reference.png").convert("RGB")
im=src.crop((35,49,598,89)).resize((900,100),Image.Resampling.LANCZOS)
d=ImageDraw.Draw(im)
for y in range(20,82):
    t=(y-20)/62
    d.line((86,y,815,y),fill=(3+int(6*t),42+int(14*t),80+int(13*t)))
for y in range(21,29):
    d.line((91,y,810,y),fill=(10,72+int((29-y)*4),130+int((29-y)*2)))
im.save(OUT/"action-face.png",optimize=True)

# Reuse the original illustrated command-console lighting, without activity labels.
src=Image.open(SRC/"activity_shortcuts_panel_reference.png").convert("RGB")
im=src.crop((0,0,src.width,26)).resize((1400,72),Image.Resampling.LANCZOS)
d=ImageDraw.Draw(im)
for x in range(65,1400,250):
    d.rounded_rectangle((x,62,x+78,68),radius=3,fill=(36,192,240))
    d.rounded_rectangle((x+123,63,x+165,69),radius=3,fill=(248,136,46))
im.save(OUT/"deck-trim.png",optimize=True)
print("Generated:",[(p.name,p.stat().st_size) for p in sorted(OUT.glob("*.png"))])
