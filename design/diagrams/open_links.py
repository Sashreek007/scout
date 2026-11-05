"""Write one small HTML page per diagram that opens it in draw.io.

gen.py and the *_diag.py scripts save each diagram's draw.io link in urls/.
The links are too long to paste comfortably, so serve this folder locally and
open go_<name>.html instead:

    python3 open_links.py && python3 -m http.server 8765 --bind 127.0.0.1
    # then open http://127.0.0.1:8765/go_harness.html
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
URLS = os.path.join(HERE, "urls")
for f in sorted(os.listdir(URLS)):
    name = f[:-4]
    url = open(os.path.join(URLS, f)).read().strip()
    open(os.path.join(HERE, f"go_{name}.html"), "w").write(
        f"<!doctype html><script>location.replace({json.dumps(url)})</script>")
    print("go_" + name + ".html")
