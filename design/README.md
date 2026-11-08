# design

Generators for scout's mockups and diagrams. The Figma screens and the draw.io diagrams are built from these scripts, so change a script and regenerate instead of editing the output by hand.

| Folder | Makes | Lands in |
|---|---|---|
| `figma/` | HTML for every dashboard, phone and Mac app screen, the Foundations page and the Cover | Figma file `QUIJvqtWUzmOoIWNvGlWzz`, through the Figma MCP's `html_to_figma` |
| `diagrams/` | draw.io files for the architecture diagrams | `docs/diagrams/*.drawio`, exported to `docs/images/*.png` |
| `assets/` | The icons and logos the screens use: a Tabler Icons subset (MIT), a Simple Icons subset (CC0) and company favicons | Read by both |

Everything runs on Python 3 with the standard library.

## Mockups

```bash
cd design/figma
python3 desktop1.py        # writes desktop1.html, plus a single-screen file for some screens
python3 mobile.py
```

| Script | Screens |
|---|---|
| `desktop1.py` | 01 Today, 02 Jobs, 03 Jobs filtered out, 04 Board |
| `desktop2.py` | 05 to 07, one application: review, needs you, after applying |
| `desktop3.py` | 08 Profile, 09 Remembered answers, 10 Runs, 11 Stats, 13 Sign in |
| `desktop4.py` | 14 Application resume, 15 Knowledge |
| `desktop5.py` | 16 Agents, 12 Settings, 20 Watching an agent live |
| `desktop6.py` | 17 Today on first run, 18 Search, 19 Agents when something goes wrong |
| `desktop7.py` | 21 The Mac app's menu bar item and a notification |
| `desktop8.py` | 22 and 23, adding a job by link |
| `desktop9.py` | 24 Reviewing on the filled form, 25 Remember these answers |
| `mobile.py` | Mobile 01 to 07 |
| `foundations.py`, `cover.py` | The Foundations and Cover pages |

`base.py` holds the theme (ChatGPT surfaces, t3code borders, Inter, pill buttons), the sidebar and top bar, and the pass that adds a company logo next to each company name. `logos.py` maps companies and job boards to their logos. `browserview.py` draws the mini browser for the live agent view.

**Importing into Figma.** Call `html_to_figma` with the target page as `nodeId` and `.screen` (or `.mobile` for phones) as `cssSelector`, then POST the HTML to the URL it returns. Each matching element becomes its own frame, named "Container"; rename and place them afterwards.

**Icons after import.** The importer mangles SVG arcs, so every icon and logo carries an `aria-label` like `icon:today:1.75` or `logo:github:#ECECEC`, and arrives as a frame named `Icon - icon:today:1.75`. Generate the swap script for a page and run it with `use_figma`:

```bash
python3 make_swap.py "Desktop" desktop1.html desktop5.html > swap.js
```

Preview a screen locally before importing, with Inter loaded so widths match Figma:

```bash
python3 -m http.server 8765 --bind 127.0.0.1    # then open http://127.0.0.1:8765/desktop1.html
```

## Diagrams

```bash
cd design/diagrams
python3 gen.py              # overview, stages, Firestore layout, daily run, apply
python3 agents_diag.py
python3 harness_diag.py
python3 resume_flow.py
python3 open_links.py       # one go_<name>.html per diagram
```

Each script writes `docs/diagrams/<name>.drawio` and the diagram's draw.io link to `urls/`. To export a PNG, serve this folder, open `go_<name>.html`, which loads the diagram in draw.io, and use File, Export as, PNG at 200% to `docs/images/<name>.png`. Logos sit inside labels as data URIs, so they export with the diagram.
