"""Bundle the original source files into one offline, double-clickable HTML page."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
def bundle_module(filename, exports, namespace):
    source = (ROOT / filename).read_text(encoding="utf-8")
    source = re.sub(r"\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)", "", source)
    source = re.sub(r"import\s*\{([^}]+)\}\s*from\s*['\"]\./data\.js['\"];?", r"const {\1} = FateData;", source)
    return f"const {namespace} = (() => {{\n{source}\nreturn {{{', '.join(exports)}}};\n}})();"

html = (ROOT / "index.template.html").read_text(encoding="utf-8")
data = bundle_module("data.js", ["AXES", "STAGES", "QUESTIONS", "SERVANTS", "SOURCES", "STORAGE_KEY", "calculateResult"], "FateData")
art = bundle_module("art.js", ["ritualSVG", "crestSVG", "classIcon"], "FateArt")
fate_art = bundle_module("fate-art.js", ["commandSealSVG", "servantCardBackSVG", "catalystSVG", "playSummoningChime"], "FateRitualArt")
portraits = bundle_module("portraits.js", ["PORTRAITS"], "FatePortraits")
identity = bundle_module("master-code.js", ["generateMasterCode"], "FateIdentity")
reading = bundle_module("reading.js", ["buildAnswerReading"], "FateReading")
app = (ROOT / "app.js").read_text(encoding="utf-8")
app = re.sub(r"import\s*\{([^}]+)\}\s*from\s*['\"]\./data\.js['\"];?", r"const {\1} = FateData;", app)
app = re.sub(r"import\s*\{([^}]+)\}\s*from\s*['\"]\./art\.js['\"];?", r"const {\1} = FateArt;", app)
app = re.sub(r"import\s*\{([^}]+)\}\s*from\s*['\"]\./fate-art\.js['\"];?", r"const {\1} = FateRitualArt;", app)
app = re.sub(r"import\s*\{([^}]+)\}\s*from\s*['\"]\./portraits\.js['\"];?", r"const {\1} = FatePortraits;", app)
app = re.sub(r"import\s*\{([^}]+)\}\s*from\s*['\"]\./master-code\.js['\"];?", r"const {\1} = FateIdentity;", app)
app = re.sub(r"import\s*\{([^}]+)\}\s*from\s*['\"]\./reading\.js['\"];?", r"const {\1} = FateReading;", app)
html = html.replace("/* INLINE_STYLE */", "\n".join((ROOT / name).read_text(encoding="utf-8") for name in ("style.css", "game.css", "motion.css")))
for token, value in [("/* INLINE_DATA */", data), ("/* INLINE_ART */", art), ("/* INLINE_FATE_ART */", fate_art), ("/* INLINE_PORTRAITS */", portraits), ("/* INLINE_IDENTITY */", identity), ("/* INLINE_READING */", reading), ("/* INLINE_APP */", "(()=>{\n" + app + "\n})();")]:
    html = html.replace(token, value.replace("</script", "<\\/script"))
(ROOT / "index.html").write_text(html, encoding="utf-8")
print(f"Built {ROOT / 'index.html'} ({len(html.encode('utf-8')):,} bytes)")
