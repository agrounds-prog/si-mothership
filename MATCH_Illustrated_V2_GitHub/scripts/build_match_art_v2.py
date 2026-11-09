#!/usr/bin/env python3
"""Deterministic high-resolution raster UI skins for the SI Mothership MATCH teacher studio.
These are real, text-free PNG illustrations. The existing HTML remains interactive.
Dependencies: Pillow only. Run: python scripts/build_match_art_v2.py
"""
from __future__ import annotations
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets' / 'match-illustrated-v2'
DEST.mkdir(parents=True, exist_ok=True)
RNG = random.Random(240911)
SCALE=2

PALETTE = {
    'blue': (37,166,252), 'cyan': (31,224,255), 'green': (34,240,133),
    'orange':(255,171,37), 'red':(255,77,110), 'purple':(159,104,255),
    'navy':(74,140,200), 'disabled':(103,137,154), 'teal':(28,234,214)
}

def mix(a,b,t): return tuple(int(a[i]*(1-t)+b[i]*t) for i in range(3))
def clamp(x): return int(max(0,min(255,x)))
def bright(c,f): return tuple(clamp(x*f) for x in c)
def col(c,a=255): return (*c,a)
def lerp_color(top,bot,t):return mix(top,bot,t)
def line_poly(draw, pts, color, width=1, joint='curve'):
    draw.line(pts+[pts[0]],fill=color,width=width,joint=joint)
def chamfer_rect(box,c=18):
    x0,y0,x1,y1=box
    return [(x0+c,y0),(x1-c,y0),(x1,y0+c),(x1,y1-c),(x1-c,y1),(x0+c,y1),(x0,y1-c),(x0,y0+c)]

def setup(w,h):return Image.new('RGBA',(w*SCALE,h*SCALE),(0,0,0,0))
def down(im):return im.resize((im.width//SCALE,im.height//SCALE),Image.Resampling.LANCZOS)
def toS(pts):return [(int(x*SCALE),int(y*SCALE)) for x,y in pts]
def point(v):return int(v*SCALE)
def polygon(d,pts,fill=None,outline=None,width=1):
    pts=toS(pts);d.polygon(pts,fill=fill)
    if outline:line_poly(d,pts,outline,width=point(width))
def rect(d,box,fill=None,outline=None,width=1):
    d.rectangle(tuple(point(n) for n in box),fill=fill,outline=outline,width=point(width))
def ellipse(d,box,fill=None,outline=None,width=1):
    d.ellipse(tuple(point(n) for n in box),fill=fill,outline=outline,width=point(width))
def line(d,pts,color,width=1):d.line(toS(pts),fill=color,width=point(width),joint='curve')

def metallic_skin(w,h,accent='cyan',family='button',selected=False):
    base=PALETTE[accent]
    im=setup(w,h);d=ImageDraw.Draw(im,'RGBA')
    padx=7 if family=='button' else 10
    pady=7 if family=='button' else 9
    border=(padx,pady,w-padx-1,h-pady-1)
    c=min(21 if family=='button' else 29,h//4,w//8)
    # glowing halo behind body
    glow=Image.new('RGBA',im.size,(0,0,0,0));g=ImageDraw.Draw(glow,'RGBA')
    polygon(g,chamfer_rect((padx+3,pady+3,w-padx-4,h-pady-4),c),fill=col(base,125 if selected else 92))
    glow=glow.filter(ImageFilter.GaussianBlur(point(9 if family=='button' else 13)))
    im.alpha_composite(glow)
    d=ImageDraw.Draw(im,'RGBA')
    # machine-like outer shadow and metal lip
    polygon(d,chamfer_rect((padx,pady+5,w-padx-1,h-pady-1),c),fill=(1,5,17,243),outline=(*bright(base,.55),195),width=3)
    polygon(d,chamfer_rect((padx,pady,w-padx-1,h-pady-8),c),fill=(7,31,55,252),outline=(190,225,255,218),width=2)
    polygon(d,chamfer_rect((padx+3,pady+3,w-padx-4,h-pady-12),c-2),fill=col(bright(base,.45),236),outline=col(base,245),width=2)
    polygon(d,chamfer_rect((padx+8,pady+9,w-padx-9,h-pady-17),max(4,c-6)),fill=(6,26,50,240),outline=col(bright(base,1.2),170),width=1)
    # gradient inside mask, with subtle brushed metal horizontal grain
    x0,y0,x1,y1=padx+9,pady+10,w-padx-10,h-pady-18
    inner=Image.new('RGBA',im.size,(0,0,0,0));idraw=ImageDraw.Draw(inner,'RGBA')
    a=bright(mix(base,(5,35,73),.55),.88)
    b=bright(mix(base,(2,12,36),.8),.65)
    for y in range(y0,y1+1):
        t=(y-y0)/max(1,y1-y0)
        level=t*t
        clr=mix(a,b,level)
        if y%3==0:clr=bright(clr,1.035)
        line(idraw,[(x0,y),(x1,y)],col(clr,236),1)
    # constrain inner gradient to polygon
    mask=Image.new('L',im.size,0)
    md=ImageDraw.Draw(mask)
    polygon(md,chamfer_rect((x0,y0,x1,y1),max(3,c-9)),fill=255)
    inner.putalpha(ImageChops_multiply(inner.getchannel('A'),mask))
    im.alpha_composite(inner)
    d=ImageDraw.Draw(im,'RGBA')
    # specular rails and etched circuits
    line(d,[(padx+c+10,pady+7),(w-padx-c-10,pady+7)],col((229,251,255),135),1)
    line(d,[(padx+c+14,pady+11),(w-padx-c-14,pady+11)],col(base,210),2)
    line(d,[(padx+c+12,h-pady-14),(w-padx-c-10,h-pady-14)],col(base,115),2)
    line(d,[(padx+c+6,h-pady-10),(w-padx-c-6,h-pady-10)],col((3,8,24),255),3)
    # corner armatures
    for sy in (-1,1):
        y=pady+13 if sy<0 else h-pady-25
        x=padx+6
        line(d,[(x+9,y),(x+17,y-8*sy)],col(base,250),2)
        x=w-padx-6
        line(d,[(x-9,y),(x-17,y-8*sy)],col(base,230),2)
    # rivets, deliberate low-contrast
    if w>=270 and h>=95:
        for x in [padx+14,w-padx-14]:
            for y in [pady+16,h-pady-23]:
                ellipse(d,(x-2,y-2,x+2,y+2),fill=(0,7,17,255),outline=col(bright(base,.93),170),width=1)
    # controlled in-canvas edge shine
    line(d,[(padx+c+16,pady+4),(w-padx-c-16,pady+4)],col((210,251,255),112),1)
    return down(im)

def ImageChops_multiply(a,b):
    from PIL import ImageChops
    return ImageChops.multiply(a,b)

def board_tile(w=270,h=270):
    im=setup(w,h);d=ImageDraw.Draw(im,'RGBA');base=PALETTE['cyan']
    glow=Image.new('RGBA',im.size,(0,0,0,0));g=ImageDraw.Draw(glow,'RGBA')
    polygon(g,chamfer_rect((12,12,w-12,h-12),23),fill=(22,210,255,150))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(point(9))))
    d=ImageDraw.Draw(im,'RGBA')
    polygon(d,chamfer_rect((12,12,w-12,h-15),23),fill=(7,29,69,252),outline=(156,249,255,255),width=4)
    polygon(d,chamfer_rect((20,20,w-20,h-25),17),fill=(12,60,129,245),outline=(30,196,255,255),width=3)
    inner=(28,29,w-28,h-34)
    for y in range(inner[1],inner[3]):
        t=(y-inner[1])/max(1,inner[3]-inner[1]);rgb=mix((31,141,210),(12,38,113),t)
        line(d,[(inner[0],y),(inner[2],y)],col(rgb,230),1)
    line(d,[(30,34),(w-30,34)],(201,251,255,155),3)
    line(d,[(30,h-37),(w-30,h-37)],(4,9,28,255),5)
    for xx in (32,w-32):
        for yy in (32,h-39):
            line(d,[(xx-8,yy),(xx+8,yy)],(60,239,255,255),3)
    # diamond only, number rendered via HTML on top
    mid=w/2
    polygon(d,[(mid,48),(mid+7,58),(mid,68),(mid-7,58)],fill=(201,252,255,190),outline=(49,190,242,255),width=1)
    # subtle star field flecks
    random.Random(21).seed(21)
    rr=random.Random(21)
    for k in range(25):
        x=rr.randint(48,w-48);y=rr.randint(82,h-56)
        r=rr.choice([.4,.7,1]);ellipse(d,(x,y,x+r,y+r),fill=(132,216,252,rr.randint(20,85)))
    return down(im)

def gallery(w=1100,h=250):
    im=metallic_skin(w,h,'blue',family='panel');d=ImageDraw.Draw(im,'RGBA')
    # inner dotted guides and illuminated empty picture glyph (no text)
    x0,y0,x1,y1=42,49,w-42,h-50
    for x in range(x0,x1-16,19):
        line(d,[(x,y0),(x+9,y0)],(118,222,255,140),1)
        line(d,[(x,y1),(x+9,y1)],(118,222,255,100),1)
    for y in range(y0,y1-10,19):
        line(d,[(x0,y),(x0,y+8)],(118,222,255,100),1)
        line(d,[(x1,y),(x1,y+8)],(118,222,255,100),1)
    return im

def stat_chip(w=270,h=176):return metallic_skin(w,h,'cyan',family='stat')

def palette_bar(w=1100,h=125):return metallic_skin(w,h,'blue',family='panel')

assets={
 'button_primary_blue.png':metallic_skin(540,134,'blue',selected=True),
 'button_primary_green.png':metallic_skin(630,140,'green',selected=True),
 'button_secondary_cyan.png':metallic_skin(540,128,'cyan'),
 'button_secondary_purple.png':metallic_skin(540,128,'purple'),
 'button_secondary_orange.png':metallic_skin(540,128,'orange'),
 'button_secondary_red.png':metallic_skin(540,128,'red'),
 'button_secondary_navy.png':metallic_skin(540,128,'navy'),
 'button_disabled_slate.png':metallic_skin(540,128,'disabled'),
 'mode_idle.png':metallic_skin(580,225,'blue',family='panel'),
 'mode_selected.png':metallic_skin(580,225,'teal',family='panel',selected=True),
 'mode_purple.png':metallic_skin(580,225,'purple',family='panel'),
 'panel_main.png':metallic_skin(1100,700,'cyan',family='panel'),
 'panel_sidebar.png':metallic_skin(940,610,'blue',family='panel'),
 'panel_section.png':metallic_skin(1100,300,'cyan',family='panel'),
 'header_hero.png':metallic_skin(1500,250,'cyan',family='panel'),
 'tile_numbered.png':board_tile(),
 'gallery_empty.png':gallery(),
 'stat_chip.png':stat_chip(),
 'tab_chip.png':metallic_skin(370,115,'green'),
 'saved_row.png':palette_bar(),
}
for name,asset in assets.items():
    file=DEST/name;asset.save(file,optimize=True)
    print(f'{name:31s} {asset.width:4d} × {asset.height:<4d} {file.stat().st_size/1024:7.1f} KB')

# Visual proof: all assets shown together on a dark slate (not an app screenshot)
canvas=Image.new('RGB',(1800,1430),(4,14,29))
from PIL import ImageDraw
D=ImageDraw.Draw(canvas)
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
try:
    from PIL import ImageFont
    font=ImageFont.truetype(fontpath,26);small=ImageFont.truetype(fontpath,20)
except:font=small=None
D.text((42,26),'MATCH ILLUSTRATED V2 • GRAPHICAL SKIN ATLAS',fill=(196,249,255),font=font)
layout=[('header_hero.png',40,85,1050,180),('panel_main.png',40,292,730,440),('panel_sidebar.png',835,292,900,480),
 ('tile_numbered.png',45,770,235,235),('stat_chip.png',322,790,230,155),('mode_selected.png',593,800,360,135),('mode_idle.png',988,800,360,135),('mode_purple.png',1380,800,360,135),
 ('button_primary_green.png',45,1040,400,94),('button_primary_blue.png',475,1040,350,94),('button_secondary_orange.png',855,1040,350,94),('button_secondary_red.png',1235,1040,350,94),
 ('button_secondary_purple.png',45,1170,370,85),('button_secondary_cyan.png',435,1170,370,85),('button_secondary_navy.png',825,1170,370,85),('button_disabled_slate.png',1215,1170,370,85)]
for name,x,y,w,h in layout:
    asset=assets[name].resize((w,h),Image.Resampling.LANCZOS)
    canvas.paste(asset,(x,y),asset)
    D.text((x+8,y+h+2),name,fill=(170,210,232),font=small)
canvas.save(ROOT/'references'/'graphical_skin_atlas.png',optimize=True)
