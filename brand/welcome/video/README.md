# The bots' greeting videos (owner's decision, October 2026)

`/start` in a Zumda bot sends its role's instruction instead of the street picture: the real
screens of the sign-up, step by step, with Uzbek captions and its own music.

| Video | Bot | Role, what it shows |
|-------|-----|---------------------|
| `biznes.mp4` (47 s) | Zumda \| Business | Owner: «Mening bizneslarim» → name and kind → «Bot yaratish» → the place → the application → approved |
| `kuryer.mp4` (35 s) | Zumda \| Kuryer, someone new only | Courier: the owner's invite link → the phone → the owner approves → on shift |
| `zumda.mp4` (40 s) | Zumda \| Shop | Customer: «Qidirish va buyurtma berish» → a shop → the cart → the phone → the address → sent |

The files live in `packages/app/public/welcome/` (720×1280, 2-3 MB, each with a `-cover.jpg`: the
intro with every step). The Worker sends them by URL (`telegram/welcome.ts`, `WELCOME_VIDEO`:
the length in seconds is there too); when Telegram cannot take a video, the picture goes.

## Make them again (after a change in those screens)

```bash
bun install                                   # once
brand/welcome/video/build.sh                  # about 20 minutes, writes packages/app/public/welcome/
OUT=/tmp/look brand/welcome/video/build.sh    # write elsewhere, to look before replacing
ALL=1 brand/welcome/video/build.sh            # also the reel of all three roles in a row
```

It needs `python3` and the network (pip: `numpy`, `imageio-ffmpeg`; Google Fonts: Rubik). When a
video's length changes, the script prints it: put it in `WELCOME_VIDEO`.

## How it works

| File | What it does |
|------|--------------|
| `capture.spec.ts` | Films each role on the local stand as an e2e spec: screenshots, where each tap lands, what the bots wrote (`film.json`). The stand's technical bot names read as real ones (`@dilnoza_somsa_bot`) |
| `stage.html` | The video as a page: a phone with the real screens and the bots' real messages, Telegram's own windows drawn, the finger, captions, intro and ending. `?role=owner\|courier\|customer` plays one role as an instruction («…ni bosing»); without it, the reel of all three |
| `render.mjs` | Plays the page frame by frame at 30 fps (`window.render(t)`) into ffmpeg |
| `music.py` | The music, synthesized: a light groove in G major, the Zumda sound (G5 → D6, as in `lib/sound.ts`) when a role is done and on the logo, soft taps and message pops. No samples, no rights to clear |
| `build.sh` | All of the above, then the 720p copies and the covers |

The people and shops in the videos are the stand's demo data (Dilnoza, Bobur, Malika; Osh Markaz),
never real customers.
