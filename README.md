# Babylon Ship Builder

A browser prototype made with Babylon.js.

## What it does

- Grid-based ship editor with **0.5 m snapping**
- Placeable parts:
  - Hull blocks
  - Guns
  - Boilers
  - Propellers
  - Rudders
- Flat-sea test mode
- Runtime ship physics based on the actual build
  - Weight from placed parts
  - Buoyancy from displaced volume
  - Per-part underwater drag
  - Propeller thrust only when submerged
  - Rudder steering from water flow over the rudder

## Run

Because Babylon.js is loaded from the official Babylon CDN in `index.html`, run this project with an internet connection.

You can open `index.html` directly in a browser, but using a simple local server is better.

Examples:

### Python

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/
```

## Controls

### Build mode

- Left click: place selected part on the current layer
- Right drag: orbit camera
- Mouse wheel: zoom
- `[` / `]`: lower / raise build layer
- `Erase` tool: remove a part from the current layer

### Sea trial

- `W` / `S`: throttle up / down
- `A` / `D`: rudder left / right
- `X`: neutral throttle
- `R`: reset the test

## Notes

- This is a prototype, not a CFD simulator.
- The ship behaviour is still dynamic and depends on the build layout.
- Top-heavy ships can roll over.
- Ships without enough displaced volume will sink.
- Rudders work best when mounted aft and kept underwater.
- Propellers need boilers to become effective.

## Files

- `index.html` - app shell
- `css/styles.css` - UI styles
- `js/app.js` - scene setup, UI, mode switching
- `js/editor.js` - build mode logic
- `js/shipSimulator.js` - buoyancy and ship motion solver
- `js/renderShip.js` - procedural part visuals
- `js/shipBlueprint.js` - blueprint data model
- `js/parts.js` - part definitions and balancing values
- `js/constants.js` - shared constants

## Third-party dependency

- Babylon.js via the official Babylon CDN in `index.html`
