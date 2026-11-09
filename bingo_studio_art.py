"""Raster interface skins for Bingo Board Studio, derived from the teacher-approved PNG artwork."""
from pathlib import Path
from threading import Lock
from tempfile import gettempdir
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import math

ROOT = Path(__file__).resolve().parent
OUTPUT = Path(gettempdir()) / "mothership-bingo-studio-art-v1"
NAMES = {
    "hero-header.webp", "bridge-backdrop.webp", "board-panel.webp",
    "library-panel.webp", "saved-panel.webp", "tile-empty.webp",
    "tile-selected.webp", "tile-free.webp", "button-blue.webp",
    "button-green.webp", "button-red.webp", "button-slate.webp",
}
LOCK = Lock()

def _save(im, name, quality=84):
    im.convert("RGB").save(OUTPUT / name, "WEBP", quality=quality, method=6)

def _wipe(im, xy, top, bottom, radius=12):
    x0,y0,x1,y1 = xy
    w,h = x1-x0,y1-y0
    patch = Image.new("RGB",(w,h))
    pix = patch.load()
    for y in range(h):
        t = y/max(h-1,1)
        rgb = tuple(round(top[k]*(1-t)+bottom[k]*t) for k in range(3))
        for x in range(w): pix[x,y]=rgb
    mask=Image.new("L",(w,h))
    ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=radius,fill=255)
    im.paste(patch,(x0,y0),mask)

def _panel(source, width, height, name):
    im=source.resize((width,height)).filter(ImageFilter.GaussianBlur(48))
    im=ImageEnhance.Brightness(im).enhance(.34)
    im=Image.blend(im,Image.new("RGB",(width,height),(3,18,36)),.80).convert("RGBA")
    draw=ImageDraw.Draw(im,"RGBA"); pad=10; cyan=(36,226,252)
    draw.rounded_rectangle((pad,pad,width-pad,height-pad),radius=26,
        fill=(3,29,55,178),outline=(*cyan,192),width=4)
    draw.rounded_rectangle((pad+9,pad+9,width-pad-9,height-pad-9),
        radius=19,outline=(105,207,243,90),width=2)
    for side in (0,1):
        x=pad+8 if side==0 else width-pad-8
        sign=1 if side==0 else -1
        draw.line([(x,84),(x,37),(x+sign*37,19),(x+sign*110,19)],
                  fill=(*cyan,175),width=5)
        draw.line([(x,height-82),(x,height-38),(x+sign*37,height-20),
                  (x+sign*110,height-20)],fill=(*cyan,140),width=4)
    for y in (78,height-78):
        draw.rounded_rectangle((width/2-63,y-4,width/2+63,y+4),
                               radius=4,fill=(*cyan,155))
    _save(im,name)

def _button(name, top, bottom, accent):
    w,h=560,132
    art=Image.new("RGBA",(w,h),(0,0,0,0))
    glow=Image.new("RGBA",(w,h),(0,0,0,0))
    polygon=[(21,20),(w-55,20),(w-20,52),(w-20,h-27),
             (w-52,h-13),(35,h-13),(16,h-43),(16,54)]
    ImageDraw.Draw(glow).polygon(polygon,fill=(*accent,100))
    art=Image.alpha_composite(art,glow.filter(ImageFilter.GaussianBlur(13)))
    mask=Image.new("L",(w,h))
    ImageDraw.Draw(mask).polygon(polygon,fill=255)
    grad=Image.new("RGBA",(w,h))
    pix=grad.load()
    for y in range(h):
        t=y/(h-1)
        shine=max(0,1-abs(t-.24)/.25)*.23
        rgb=tuple(min(255,max(0,int(top[i]*(1-t)+bottom[i]*t+255*shine))) for i in range(3))
        for x in range(w):pix[x,y]=(*rgb,255)
    grad.putalpha(mask)
    art=Image.alpha_composite(art,grad)
    d=ImageDraw.Draw(art,"RGBA")
    d.line(polygon+[polygon[0]],fill=(*accent,255),width=5,joint="curve")
    d.line([(37,38),(w-62,38)],fill=(235,255,255,140),width=2)
    d.line([(40,h-29),(w-69,h-29)],fill=(*accent,205),width=3)
    for j in range(3):
        x=w-103+j*17
        d.polygon([(x,81),(x+14,81),(x+2,102),(x-12,102)],fill=(*accent,160))
    _save(art,name,88)

def build():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    left=Image.open(ROOT/"03_left_panel_board_setup_concept.png").convert("RGB")
    right=Image.open(ROOT/"04_right_sidebar_concept.png").convert("RGB")
    header=Image.open(ROOT/"02_header_bar_concept.png").convert("RGB")
    full=Image.open(ROOT/"01_full_bingo_board_studio_concept.png").convert("RGB")

    # Preserve actual illustrated bridge/space-station artwork, but remove
    # static title and fake buttons so LIVE HTML controls always read correctly.
    header=header.crop((0,205,2172,474))
    _wipe(header,(650,43,1508,218),(4,21,40),(4,26,51),32)
    _wipe(header,(1614,17,2122,97),(6,22,42),(5,29,54),14)
    _wipe(header,(1798,104,2125,210),(4,27,45),(5,37,61),14)
    d=ImageDraw.Draw(header,"RGBA")
    d.rounded_rectangle((645,36,1512,223),outline=(42,235,250,180),width=3,radius=28)
    d.line([(665,208),(1492,208)],fill=(36,225,238,220),width=5)
    _save(header,"hero-header.webp",89)

    dark=full.resize((1600,1100)).filter(ImageFilter.GaussianBlur(55))
    dark=ImageEnhance.Brightness(dark).enhance(.34)
    dark=Image.blend(dark,Image.new("RGB",dark.size,(4,13,27)),.63)
    _save(dark,"bridge-backdrop.webp",76)
    _panel(left,980,1370,"board-panel.webp")
    _panel(right,820,940,"library-panel.webp")
    _panel(right,820,780,"saved-panel.webp")

    # Actual illuminated tile art from the approved 4x4 board, with baked
    # labels erased so 3x3/4x4/5x5/6x6 tiles display real slot numbers/text.
    tile=left.crop((200,455,393,613)).resize((320,320),Image.Resampling.LANCZOS).convert("RGBA")
    pix=tile.load()
    for y in range(39,289):
        for x in range(38,285):
            opacity=min(1,max(0,min(x-38,284-x,y-39,288-y)/13))
            fx=x/319;fy=y/319
            glow=12*math.cos((fx-.5)*math.pi)+16*math.sin(fy*math.pi)
            rgb=(int(158+glow*.38),int(217+glow*.38),int(236+glow*.38),255)
            old=pix[x,y]
            pix[x,y]=tuple(int(old[i]*(1-opacity)+rgb[i]*opacity) for i in range(4))
    d=ImageDraw.Draw(tile,"RGBA")
    d.polygon([(29,22),(111,22),(111,66),(91,84),(29,84)],fill=(4,24,47,255))
    d.line([(29,22),(111,22),(111,66),(91,84),(29,84),(29,22)],
           fill=(75,225,250,230),width=3)
    _save(tile,"tile-empty.webp",90)
    for name,color in (("tile-selected.webp",(46,255,186)),("tile-free.webp",(247,199,97))):
        art=tile.copy().convert("RGBA")
        glow=Image.new("RGBA",art.size,(0,0,0,0))
        d=ImageDraw.Draw(glow,"RGBA")
        d.rounded_rectangle((8,8,313,313),radius=22,outline=(*color,205),width=9)
        art=Image.alpha_composite(art,glow.filter(ImageFilter.GaussianBlur(4)))
        d=ImageDraw.Draw(art,"RGBA")
        d.rounded_rectangle((8,8,312,312),radius=21,outline=(*color,240),width=4)
        _save(art,name,89)
    _button("button-blue.webp",(18,109,160),(4,32,69),(58,225,255))
    _button("button-green.webp",(8,135,94),(4,45,44),(42,255,159))
    _button("button-red.webp",(109,44,79),(39,15,42),(255,101,153))
    _button("button-slate.webp",(28,76,108),(7,24,46),(91,186,233))

def get_art_path(name):
    if name not in NAMES:
        return None
    path=OUTPUT/name
    if not path.is_file():
        with LOCK:
            if not path.is_file():
                build()
    return path if path.is_file() else None
