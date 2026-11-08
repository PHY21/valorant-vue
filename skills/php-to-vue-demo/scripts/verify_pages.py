"""Compare a deployed Vite entry module with a local build (Python 3.9+)."""

import argparse
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import sys
from time import time_ns
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen


class ModuleScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "script" and values.get("type") == "module" and values.get("src"):
            self.sources.append(values["src"])


def modules(html, site):
    parser = ModuleScripts()
    parser.feed(html)
    root = urlsplit(site)
    result = set()
    for source in parser.sources:
        url = urlsplit(urljoin(site, source))
        if (url.scheme, url.netloc) != (root.scheme, root.netloc):
            raise ValueError(f"External module outside this check: {url.netloc}")
        if not url.path.startswith(root.path):
            raise ValueError(f"Module outside deployment base: {url.path}")
        result.add(url.geturl())
    if not result:
        raise ValueError("No external module entry found in index.html")
    return result


def fetch(url):
    separator = "&" if "?" in url else "?"
    req = Request(f"{url}{separator}verify_build={time_ns()}", headers={"Cache-Control": "no-cache"})
    with urlopen(req, timeout=15) as response:
        return response.read()


def verify(dist, site):
    root = urlsplit(site)
    if root.scheme not in {"https", "http"} or not root.hostname or root.query or root.fragment or root.username or root.password:
        raise ValueError("Provide the site's HTTP(S) directory URL without credentials, query or fragment")
    site = site.rstrip("/") + "/"
    local = modules((dist / "index.html").read_text(encoding="utf-8-sig"), site)
    remote = modules(fetch(site).decode("utf-8-sig"), site)
    if local != remote:
        raise ValueError(f"Entry list differs. Local: {sorted(local)}. Online: {sorted(remote)}")
    for url in sorted(local):
        relative = unquote(urlsplit(url).path[len(urlsplit(site).path):])
        asset = (dist / relative).resolve()
        asset.relative_to(dist.resolve())
        digest = sha256(asset.read_bytes()).hexdigest()
        if digest != sha256(fetch(url)).hexdigest():
            raise ValueError(f"Module content differs: {relative}")
        print(f"OK  {relative}  sha256={digest}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", required=True, type=Path)
    parser.add_argument("--url", required=True)
    args = parser.parse_args()
    try:
        verify(args.dist, args.url)
    except (OSError, ValueError) as exc:
        print(f"Verification failed: {exc}", file=sys.stderr)
        sys.exit(1)
