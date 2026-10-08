#!/usr/bin/env bash
# The bots' greeting videos: films each role's sign-up on the local stand, plays stage.html frame
# by frame, adds its own music and writes packages/app/public/welcome/{biznes,kuryer,zumda}.mp4
# with their covers. Run from anywhere after `bun install`; about 20 minutes.
#   WORK=dir  keep the work files there (default: a new temp dir)
#   OUT=dir   write the videos there instead of the app (to look before replacing them)
#   ALL=1     also the reel of all three roles in a row ($WORK/out/zumda-royxatdan-otish.mp4)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
WORK="${WORK:-$(mktemp -d)}"
OUT="${OUT:-$ROOT/packages/app/public/welcome}"
PORT=8899
SPEC="$ROOT/packages/e2e/specs/zz-reel.spec.ts"
echo "work: $WORK"
mkdir -p "$WORK/assets" "$WORK/shots2" "$WORK/preview" "$WORK/out" "$OUT"

cleanup() {
    rm -f "$SPEC"
    if [ -n "${SERVER:-}" ]; then kill "$SERVER" 2>/dev/null || true; fi
}
trap cleanup EXIT

# Tools: ffmpeg and numpy from pip, nothing installed system-wide.
python3 -m venv "$WORK/venv"
"$WORK/venv/bin/pip" install -q numpy imageio-ffmpeg
FFMPEG="$("$WORK/venv/bin/python" -I -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')"
export FFMPEG

# Assets: the brand, the welcome pictures, the stand shop's logo, the Rubik font of the word.
cp "$ROOT"/brand/zumda-{business,kuryer,bot}-avatar.png "$ROOT/brand/zumda-mark.svg" "$WORK/assets/"
cp "$ROOT"/packages/app/public/welcome/{biznes,kuryer,zumda}.jpg "$WORK/assets/"
cp "$ROOT/packages/app/public/demo/food.png" "$WORK/assets/"
sed 's#<rect width="1029" height="320" rx="48" fill="\#15803D"/>##' \
    "$ROOT/brand/zumda-logo-on-green.svg" >"$WORK/assets/logo-white.svg"
# A full browser user agent: Google Fonts answers it with woff2 split by alphabet.
BROWSER="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
RUBIK="$(curl -s -A "$BROWSER" \
    "https://fonts.googleapis.com/css2?family=Rubik:wght@400..800&display=swap" |
    awk '/\/\* latin \*\//{f=1} f && /url\(/{match($0, /https:[^)]*/); print substr($0, RSTART, RLENGTH); exit}')"
if [ -z "$RUBIK" ]; then
    echo "Rubik not found on Google Fonts: check the network" >&2
    exit 1
fi
curl -s -o "$WORK/assets/rubik.woff2" "$RUBIK"

# Film: the capture runs once as an e2e spec on the stand (Playwright starts the stand).
cp "$HERE/capture.spec.ts" "$SPEC"
(cd "$ROOT/packages/e2e" && REEL_DIR="$WORK" bunx playwright test specs/zz-reel.spec.ts --reporter=line)
rm -f "$SPEC"
for shot in "$WORK"/shots/*.png; do
    "$FFMPEG" -y -loglevel error -i "$shot" -vf "scale=1108:-1:flags=lanczos" "$WORK/shots2/$(basename "$shot")"
done

# Play: the stage served locally, one role at a time.
cp "$HERE/stage.html" "$WORK/"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$WORK" >/dev/null 2>&1 &
SERVER=$!
sleep 1

render() { # role, file stem
    local role="$1" stem="$2" url="http://127.0.0.1:$PORT/stage.html"
    if [ "$role" != "all" ]; then url="$url?role=$role"; fi
    STAGE_URL="$url" TIMELINE="timeline-$role.json" REEL_DIR="$WORK" \
        node "$HERE/render.mjs" video "$WORK/silent-$role.mp4"
    "$WORK/venv/bin/python" -I "$HERE/music.py" "$WORK/timeline-$role.json" "$WORK/music-$role.wav"
    "$FFMPEG" -y -loglevel error -i "$WORK/silent-$role.mp4" -i "$WORK/music-$role.wav" \
        -filter_complex "[1:a]highpass=f=32,loudnorm=I=-14:TP=-1.5:LRA=7[a]" \
        -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart \
        "$WORK/out/$stem-1080.mp4"
}

for pair in owner:biznes courier:kuryer customer:zumda; do
    role="${pair%%:*}"
    name="${pair##*:}"
    render "$role" "$name"
    # The bots send 720p: about 3 MB, quick on regional mobile internet.
    "$FFMPEG" -y -loglevel error -i "$WORK/out/$name-1080.mp4" \
        -vf "scale=720:1280:flags=lanczos" -c:v libx264 -preset slow -crf 25 -profile:v high \
        -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart "$OUT/$name.mp4"
    # The cover: the intro with every step listed.
    STAGE_URL="http://127.0.0.1:$PORT/stage.html?role=$role" TIMELINE="timeline-$role.json" \
        PREFIX="cover-$role" REEL_DIR="$WORK" node "$HERE/render.mjs" preview 4.0
    "$FFMPEG" -y -loglevel error -i "$WORK/preview/cover-$role-4.00.png" \
        -vf "scale=720:1280:flags=lanczos" -q:v 3 "$OUT/$name-cover.jpg"
    seconds="$(node -e "console.log(Math.round(require('$WORK/timeline-$role.json').duration))")"
    echo "$name.mp4: ${seconds} s (WELCOME_VIDEO in packages/worker/src/telegram/welcome.ts)"
done

if [ "${ALL:-0}" = "1" ]; then
    render all zumda-royxatdan-otish
    echo "reel: $WORK/out/zumda-royxatdan-otish-1080.mp4"
fi
echo "done: $OUT"
