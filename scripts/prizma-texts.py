# Every Uzbek string of the product through the Prizma corpus check (owner's decision, November 2026).
# Local only: the corpus lives in imfozilbek/data-driven-approach next to this repository (or
# PRIZMA_DIR); CI has no corpus. Placeholders get sample values ({n} "3", {sum} "25 000 so'm",
# {shop} "Baraka"), so the check reads a sentence, not a hole. One process, about four minutes.
# Writes prizma-report.md (not in git): the strings with findings, the strongest first.
# A finding is evidence, not a verdict: a variant replaces a string only when the corpus rates it
# no worse and it flags nothing new (CLAUDE.md, «Living Uzbek»).
# Usage: python3 -I scripts/prizma-texts.py
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRIZMA = os.environ.get("PRIZMA_DIR", os.path.join(os.path.dirname(ROOT), "data-driven-approach"))
CHECK = os.path.join(PRIZMA, "tools", "native")
REPORT = os.path.join(ROOT, "prizma-report.md")
SOURCES = ("packages/app/src", "packages/worker/src", "packages/core/src")
UZBEK = re.compile(r"so'm|do'kon|buyurtma|qiling|bo'l|mijoz|kuryer|yetkaz")
STRING = re.compile(r'"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`')
CODE = re.compile(r"SELECT|INSERT|UPDATE |WHERE|https?:|\bpx-|\btext-|\bbg-|\bflex\b|rounded|=>|\(\)|\bimport\b")
SUFFIX = re.compile(
    r"\b(va|uchun|bilan|bo'l|qil|kerak|yo'q|bor|mijoz|buyurtma|do'kon|so'm|ni|ga|da|dan|ingiz|siz|lar)\b"
    r"|[a-z]+(ni|ga|da|dan|ing|siz|lar|gan|di|mi)\b"
)


def sample(name):
    """A value a placeholder stands for, so the corpus reads a whole sentence."""
    n = name.lower()
    if re.search(r"sum|price|total|fee|amount|money|cash|owed|left", n):
        return "25 000 so'm"
    if re.search(r"^n$|count|num|number|min|km|hours|days|limit|max|seconds|at|done|of|qty|order", n):
        return "3"
    if re.search(r"shop|business|bot|channel|group|title", n):
        return "Baraka"
    if re.search(r"tail|card", n):
        return "1234"
    return "Aziz"


def files():
    listed = subprocess.check_output(["git", "ls-files", *SOURCES], cwd=ROOT, text=True).split()
    keep = [f for f in listed if f.endswith((".ts", ".tsx")) and "test" not in f]
    return [f for f in keep if f.startswith("packages/worker/src/telegram/") or UZBEK.search(open(os.path.join(ROOT, f), encoding="utf-8").read())]


def strings():
    seen, out = set(), []
    for f in files():
        src = open(os.path.join(ROOT, f), encoding="utf-8").read()
        src = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), src, flags=re.S)
        src = re.sub(r"(?m)^\s*//.*$", "", src)
        for m in STRING.finditer(src):
            raw = m.group(1) if m.group(1) is not None else m.group(2)
            text = re.sub(r"\$\{([^}]*)\}", lambda p: sample(p.group(1)), raw)
            text = re.sub(r"\{([a-zA-Z]+)\}", lambda p: sample(p.group(1)), text)
            text = " ".join(text.replace("\\n", " ").split())
            if len(re.findall(r"[A-Za-zʻʼ'’]+", text)) < 2 or CODE.search(text) or not SUFFIX.search(text):
                continue
            if re.search(r"\b[a-z]+-[a-z]+-?[a-z]*\b", text) and not re.search(r"[ʻʼ'’]", text):
                continue  # class names and ids, not words
            if text not in seen:
                seen.add(text)
                out.append({"file": f, "line": src.count("\n", 0, m.start()) + 1, "text": text})
    return out


def main():
    if not os.path.isdir(CHECK):
        sys.exit(f"Prizma not found at {PRIZMA}: clone imfozilbek/data-driven-approach there or set PRIZMA_DIR")
    sys.path.insert(0, CHECK)
    argv, sys.argv = sys.argv, ["prizma"]
    import native_check as nc  # noqa: E402

    sys.argv = argv
    texts = strings()
    print(f"{len(texts)} strings, loading the corpus…", flush=True)
    base, examples = nc.load()
    rows = []
    for s in texts:
        r = nc.check(s["text"], base, examples, k_examples=1)
        if r["findings"]:
            strength = max((f.get("expected") or 0) for f in r["findings"])
            rows.append((strength, s, r))
    rows.sort(key=lambda x: -x[0])
    with open(REPORT, "w", encoding="utf-8") as out:
        out.write(f"# Prizma: {len(texts)} strings, {len(rows)} with findings\n\n")
        out.write("Evidence, not a verdict: replace a string only with a variant rated no worse that flags nothing new.\n\n")
        for strength, s, r in rows:
            out.write(f"## {s['file']}:{s['line']} · naturalness {r['naturalness']} · strength {strength}\n\n")
            out.write(f"> {s['text']}\n\n")
            for f in r["findings"]:
                kind = "unknown word" if f["type"] == "unknown_word" else "unattested pair"
                out.write(f"- {kind}: {f['what']}" + (f" (chance ~{f['expected']})" if f.get("expected") else "") + "\n")
                for e in f["real_examples"]:
                    out.write(f"  - «{e['t'][:160]}»\n")
            out.write("\n")
    print(f"{len(rows)} with findings: {os.path.relpath(REPORT, ROOT)}")


if __name__ == "__main__":
    main()
