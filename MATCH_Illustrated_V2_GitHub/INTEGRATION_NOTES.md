## Repository integration details

Keep all assets at `assets/match-illustrated-v2/` on `main`.

### Add an allowlisted route to `server.py`

Near the existing `/mp-teacher-art/...` routes, add this route:

```python
async def match_v2_art(request):
    filename = request.match_info['filename']
    if not re.fullmatch(r'[a-z0-9_-]+[.](?:svg|png)', filename):
        raise web.HTTPNotFound()
    path = ROOT / 'assets' / 'match-illustrated-v2' / filename
    if not path.is_file():
        raise web.HTTPNotFound()
    content_type = 'image/svg+xml' if filename.endswith('.svg') else 'image/png'
    return web.FileResponse(path, headers={
        'Content-Type': content_type,
        'Cache-Control': 'public,max-age=3600'
    })
app.router.add_get('/match-v2-art/{filename}', match_v2_art)
```

After the existing `match-pixel-teacher-art-v1.css` stylesheet link, add:

```html
<link rel="stylesheet" href="/match-illustrated-v2.css?v=2">
```

Expose that stylesheet using the existing `web.FileResponse` pattern:

```python
app.router.add_get('/match-illustrated-v2.css', lambda request: web.FileResponse(
    ROOT / 'match-illustrated-v2.css',
    headers={'Cache-Control': 'no-store', 'Content-Type': 'text/css'}))
```

### Priority control mapping

| Existing live control | Image skin |
|---|---|
| `.mcb-hero`, activity title | `header.svg` |
| `.mcb-card`, `.mcb-preview` | `panel.svg` |
| `.mcb-hero-stats > span` | `stat.svg` |
| `.mcb-modes button` | `mode_idle.svg` / `mode_active.svg` |
| `.mcb-board-tile` | `board_tile.svg` |
| `.mcb-upload-row button` | `button_blue.svg` |
| `#mcbSaveLaunch`, `#mcbMakePairs` | `button_green.svg` |
| Saved Images tab | `button_orange.svg` |
| Delete controls | `button_red.svg` |
| Disabled controls | `button_disabled.svg` |
| `.mcb-image-library`, empty gallery | `gallery.svg` |

### QA

Run `node tests/test_match_illustrated_v2_browser.cjs` in the normal isolated-Mothership Playwright pipeline after the server has started. Check at widths 1440, 1280, and a compact 900px teacher window. Do not run tests against production classroom data.
