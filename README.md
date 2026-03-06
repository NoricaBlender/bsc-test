# Warship Craft (Web Prototype)

A lightweight browser prototype inspired by classic block-based ship builders like **Battleship Craft / Warship Craft**:
build a ship from blocks, then test it in a physics-y naval fight.

## Run locally

Because this uses ES Modules + CDN imports, you must serve it over HTTP:

```bash
python -m http.server 8000
```

Open: http://localhost:8000

## Host on GitHub Pages

1. Create a new GitHub repo
2. Upload all files (index.html at repo root)
3. Repo → Settings → Pages → Deploy from branch → main / root
4. Open the GitHub Pages URL

## Controls

- **Builder**: click/tap to place blocks. Hold **Shift** to remove.
- **Battle (desktop)**: WASD to move, mouse to aim, **Space** to fire.
- **Battle (mobile)**: joystick to move, **Fire** button to shoot.

## Tech

- Three.js (rendering)
- cannon-es (physics)

## Notes / limitations

- Buoyancy is simplified (per-block sampling against a flat water plane).
- Collision/hits are simplified for speed.
- Part list is minimal: Hull, Armour, Engine, Cannon.
