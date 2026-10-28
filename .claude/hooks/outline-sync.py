#!/usr/bin/env python3
"""Outline persistence hooks — push pipeline .md artifacts to a self-hosted Outline wiki.

Pattern adapted from the myorder dev-workflow plugin (share-skills-poc): one collection
per repo, marker-tagged documents, a local hash manifest for incremental sync. Unlike the
plugin (where the agent syncs via MCP and a Stop hook only nags), these hooks PERFORM the
sync deterministically against the Outline REST API — no agent turns spent.

Outline hierarchy (Outline is canonical; local files are the working copies):

    Collection: {repo-name}                      # fixed: basename of the repo root
    └── long-horizon-agent                       # everything lives under this doc
        ├── epic                                 # epic-driven work (plan-epic → vibe / develop)
        │   └── epic-{epic_name}                 # one per epic (from epic.md H1)
        │       ├── epic                         # epic.md  — user-provided or agent-written
        │       ├── checklist                    # checklist.md
        │       └── F-{n}-{feature-name}         # meaningful feature dir name
        │           ├── 01-requirements          # artifacts/{feature}/*.md, no wrapper level
        │           └── …
        ├── non-epic                             # direct task-kind work (/project:task) — flat
        │   └── {task-name}
        │       ├── 01-root-cause-analysis
        │       └── …
        └── tech-stack-profile                   # repo-level docs beside epic/non-epic

Modes (registered in .claude/settings.json):
    session-start   SessionStart  — pull tech-stack-profile from Outline (canonical);
                                    push it if only the local copy exists. Also restores
                                    MISSING epic.md / checklist.md / artifacts/ from
                                    Outline (fresh clone: all synced .md are gitignored —
                                    Outline is canonical, git carries only code).
    post-write      PostToolUse   — Write|Edit|MultiEdit; when .claude/tech-stack-profile.md
                                    (or epic.md / checklist.md) is written, push immediately.
    sync-finished   Stop+SubagentStop — scan epic.md, checklist.md, artifacts/**/*.md and
                                    push everything whose hash changed since the last sync.
                                    Fires when a track agent or an inline task-kind pipeline
                                    (feature / bugfix / chore / research) finishes.

Opt-in: requires OUTLINE_BASE_URL + OUTLINE_API_KEY in the environment (set them in
.claude/settings.local.json `env`; if the session runs sandboxed — native or `npm run
claude` — the Outline host must also be in the sandbox allowedDomains of BOTH
.claude/settings.json and .claude/srt-settings.json). Absent env, or OUTLINE_SYNC_OFF=1,
every mode is a silent no-op.

Private CA: if the wiki is served with an internal CA, place that certificate at
.claude/certs/outline-ca.crt (gitignored) and it is trusted automatically, in addition
to the system roots. Nothing is searched for — that exact path or nothing. Needed
because this hook runs under whatever python3 is on PATH, and a conda/pyenv interpreter
verifies against its own bundle and ignores the macOS keychain: curl reaches the wiki
while this hook fails CERTIFICATE_VERIFY_FAILED, silently. Defensive: any unexpected error exits 0 — a wiki must never
break a session. A failed push leaves the hash stale in the manifest, so the next Stop
retries; a doc deleted/archived in Outline is re-found or re-created on that retry.

Manifest: .outline-sync.json at the repo root (git-tracked, so clones share the
Outline doc-id map; commit it with pipeline work). Doc entries are keyed by
scope/epic/item/relpath so re-classification (a new epic, a feature leaving the epic)
creates docs in the new location instead of updating the old one in place.
Marker (first line of every Outline doc body, never in local files):
    <!-- lha-artifact: scope=<repo|epic|non-epic> epic=<epic-key|-> item=<item|-> artifact=<id> -->
"""

import hashlib
import json
import os
import re
import ssl
import sys
import time
import unicodedata
import urllib.error
import urllib.request

TIMEOUT_S = 10          # per API call
DEADLINE_S = 45         # global budget per hook invocation; leftovers sync next time
MANIFEST = ".outline-sync.json"
TECH_STACK = os.path.join(".claude", "tech-stack-profile.md")
REPO_LEVEL = {TECH_STACK: "tech-stack-profile"}  # local relpath -> Outline title
MARKER_RE = re.compile(r"^<!-- lha-artifact:.*?-->\s*\n?", re.S)
PLACEHOLDER_KEY = "ol_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # settings.local.example.json

_started = time.monotonic()


def _deadline_hit():
    return time.monotonic() - _started > DEADLINE_S


def _read_payload():
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def _project_dir(payload):
    return payload.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


def _env():
    if os.environ.get("OUTLINE_SYNC_OFF", "").strip() not in ("", "0", "false", "False"):
        return None, None
    base = (os.environ.get("OUTLINE_BASE_URL") or "").strip().rstrip("/")
    key = (os.environ.get("OUTLINE_API_KEY") or "").strip()
    if not base or not key or "example.com" in base or key == PLACEHOLDER_KEY:
        return None, None
    return base, key


def _sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def _read_file(path):
    try:
        with open(path, "rb") as fh:
            return fh.read()
    except Exception:
        return None


def _kebab(text):
    """Unicode-aware kebab: keep letters/digits of any script (including combining
    marks, which plain \\w drops for Thai etc.), join everything else with '-'.
    Names with no word characters at all get a stable hash key, never a shared constant."""
    original = text
    out = []
    for ch in text.strip().lower():
        if ch.isalnum() or unicodedata.category(ch).startswith("M"):
            out.append(ch)
        else:
            out.append("-")
    text = re.sub(r"-{2,}", "-", "".join(out)).strip("-")
    if text:
        return text
    return "unnamed-" + _sha256_bytes(original.encode("utf-8"))[:8]


# Fixed location for a private CA certificate, relative to the repo root. Nothing is
# searched for and nothing is guessed: the file is either at this exact path or the
# hook uses the system roots alone.
CA_FILE = os.path.join(".claude", "certs", "outline-ca.crt")


def _ssl_context(proj):
    """System roots, plus the private CA at CA_FILE when the user has placed one there.

    A self-hosted wiki is often served with an internal CA. The hook runs under whatever
    python3 is on PATH, and a conda/pyenv interpreter verifies against its own bundle and
    ignores the macOS keychain — so curl reaches the wiki while this hook fails
    CERTIFICATE_VERIFY_FAILED, silently, because every error here exits 0.

    Returns None when there is no such file, so the default context is used unchanged.
    """
    path = os.path.join(proj, CA_FILE)
    if not os.path.isfile(path):
        return None
    try:
        ctx = ssl.create_default_context()  # keeps every public root working
        ctx.load_verify_locations(cafile=path)
        return ctx
    except Exception:
        return None  # an unreadable or malformed file must not break the session


class Outline:
    def __init__(self, base, key, ssl_context=None):
        self.base = base
        self.key = key
        self.ssl_context = ssl_context

    def call(self, endpoint, payload):
        """POST {base}/api/{endpoint}; None on any failure or once past the deadline."""
        if _deadline_hit():
            return None
        try:
            req = urllib.request.Request(
                f"{self.base}/api/{endpoint}",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {self.key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            kwargs = {"timeout": TIMEOUT_S}
            if self.ssl_context is not None:
                kwargs["context"] = self.ssl_context
            with urllib.request.urlopen(req, **kwargs) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            return None

    # -- collections -----------------------------------------------------
    def ensure_collection(self, name):
        offset = 0
        while True:
            res = self.call("collections.list", {"offset": offset, "limit": 100})
            if not res or not isinstance(res.get("data"), list):
                break
            for col in res["data"]:
                if col.get("name") == name:
                    return col.get("id")
            if len(res["data"]) < 100:
                break
            offset += 100
        res = self.call("collections.create", {"name": name})
        return (res or {}).get("data", {}).get("id")

    # -- documents -------------------------------------------------------
    def list_children_meta(self, collection_id, parent_id):
        """Doc dicts (id/title/updatedAt/parentDocumentId) whose parent is parent_id
        (None = collection root). Returns None when the API failed."""
        out = []
        offset = 0
        while True:
            payload = {"collectionId": collection_id, "limit": 100, "offset": offset}
            if parent_id:
                payload["parentDocumentId"] = parent_id
            res = self.call("documents.list", payload)
            if res is None or not isinstance(res.get("data"), list):
                return None
            for doc in res["data"]:
                if (doc.get("parentDocumentId") or None) == parent_id:
                    out.append(doc)
            if len(res["data"]) < 100:
                return out
            offset += 100

    def list_children(self, collection_id, parent_id):
        """{title: id} of the docs whose parent is parent_id (None = collection root).
        Returns None when the API failed — callers must NOT create on failure."""
        docs = self.list_children_meta(collection_id, parent_id)
        if docs is None:
            return None
        out = {}
        for doc in docs:
            out.setdefault(doc.get("title"), doc.get("id"))
        return out

    def find_child_doc(self, collection_id, parent_id, title):
        """(doc_id_or_None, lookup_ok). lookup_ok False = API failure, unsafe to create."""
        children = self.list_children(collection_id, parent_id)
        if children is None:
            return None, False
        return children.get(title), True

    def create_doc(self, collection_id, parent_id, title, text):
        payload = {
            "title": title,
            "text": text,
            "collectionId": collection_id,
            "publish": True,
        }
        if parent_id:
            payload["parentDocumentId"] = parent_id
        res = self.call("documents.create", payload)
        return (res or {}).get("data", {}).get("id")

    def update_doc(self, doc_id, text):
        res = self.call("documents.update", {"id": doc_id, "text": text})
        return (res or {}).get("data", {}).get("id")

    def read_doc(self, doc_id):
        res = self.call("documents.info", {"id": doc_id})
        return (res or {}).get("data") or None


# -- manifest ---------------------------------------------------------------

def _load_manifest(proj):
    try:
        with open(os.path.join(proj, MANIFEST), "r", encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_manifest(proj, manifest):
    try:
        with open(os.path.join(proj, MANIFEST), "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, indent=2, sort_keys=True)
    except Exception:
        pass


def _doc_key(scope, epic_key, item, relpath):
    """Manifest key that includes the classification, so a re-classified file
    (new epic, feature moved out of the epic) maps to a NEW doc in the new
    location instead of updating the old doc in place."""
    return f"{scope}/{epic_key or '-'}/{item or '-'}/{relpath}"


# -- repo structure parsing ---------------------------------------------------

def _epic_key(proj):
    """epic-{kebab of the H1 in epic.md}; None when no epic.md exists.
    Prefers '# Epic: {name}', falls back to any first H1, then 'default'."""
    data = _read_file(os.path.join(proj, "epic.md"))
    if data is None:
        return None
    text = data.decode("utf-8", "replace")
    m = re.search(r"^#\s*Epic:\s*(.+)$", text, re.M) or re.search(r"^#\s+(.+)$", text, re.M)
    name = m.group(1).strip() if m else "default"
    return "epic-" + _kebab(name)


def _feature_map(proj):
    """kebab(feature-name) -> F-number string, from checklist.md headers
    ('## F-1: {name} · Status') and the epic.md Features table. checklist wins."""
    mapping = {}
    epic = _read_file(os.path.join(proj, "epic.md"))
    if epic is not None:
        for m in re.finditer(r"^\|\s*F-([\d.]+)\s*\|\s*([^|]+?)\s*\|", epic.decode("utf-8", "replace"), re.M):
            mapping[_kebab(m.group(2))] = m.group(1)
    checklist = _read_file(os.path.join(proj, "checklist.md"))
    if checklist is not None:
        for m in re.finditer(r"^##\s*F-([\d.]+):\s*(.+?)\s*·", checklist.decode("utf-8", "replace"), re.M):
            mapping[_kebab(m.group(2))] = m.group(1)
    return mapping


def _classify(proj, relpath):
    """relpath -> (scope, epic_key, item_title, doc_title) or None to skip.

    scope 'repo'     : doc directly under long-horizon-agent (item_title None)
    scope 'epic'     : doc under epic/<epic_key>; item_title None => directly under
                       the epic dir (epic.md / checklist.md), else under F-{n}-{feature}
    scope 'non-epic' : doc under non-epic/<task-name>
    """
    if relpath in REPO_LEVEL:
        return ("repo", None, None, REPO_LEVEL[relpath])
    if relpath in ("epic.md", "checklist.md"):
        key = _epic_key(proj)
        if key is None:
            return None
        return ("epic", key, None, relpath[:-3])
    m = re.match(r"^artifacts/([^/]+)/([^/]+)\.md$", relpath)
    if m:
        item, stem = m.group(1), m.group(2)
        features = _feature_map(proj)
        fnum, fname = features.get(_kebab(item)), _kebab(item)
        if fnum is None:
            # Artifact dirs are keyed by feature ID -- artifacts/F-12/, never the title
            # (a title may contain '/'). _feature_map is keyed by title, so resolve the
            # ID back to its name; without this every feature falls through to non-epic.
            idm = re.match(r"^[Ff]-([\d.]+)$", item)
            if idm:
                by_num = {v: k for k, v in features.items()}
                fname = by_num.get(idm.group(1))
                fnum = idm.group(1) if fname else None
        if fnum is not None:
            key = _epic_key(proj)
            if key is not None:
                return ("epic", key, f"F-{fnum}-{fname}", stem)
        return ("non-epic", None, item, stem)
    return None


def _marker(scope, epic_key, item, artifact):
    return ("<!-- lha-artifact: scope=%s epic=%s item=%s artifact=%s -->\n\n"
            % (scope, epic_key or "-", item or "-", artifact))


# -- hierarchy ensure ---------------------------------------------------------

def _ensure_node(api, manifest, cache_key, collection_id, parent_id, title, marker_text):
    """Ensure a container node exists; manifest['nodes'][cache_key] caches its id.
    Never creates when the existence lookup itself failed (avoids duplicates)."""
    nodes = manifest.setdefault("nodes", {})
    doc_id = nodes.get(cache_key)
    if doc_id:
        return doc_id
    doc_id, ok = api.find_child_doc(collection_id, parent_id, title)
    if not doc_id and ok:
        doc_id = api.create_doc(collection_id, parent_id, title, marker_text)
    if doc_id:
        nodes[cache_key] = doc_id
    return doc_id


def _ensure_parents(api, manifest, proj, scope, epic_key, item):
    """Ensure collection → long-horizon-agent → (epic/epic-{name}/F-… | non-epic/{task})
    and return (collectionId, parentDocumentId) for the artifact doc, or (None, None)."""
    repo_name = os.path.basename(os.path.abspath(proj))
    col = manifest.get("collectionId")
    if not col:
        col = api.ensure_collection(repo_name)
        if not col:
            return None, None
        manifest["collectionId"] = col

    lha = _ensure_node(api, manifest, "long-horizon-agent", col, None,
                       "long-horizon-agent",
                       _marker("repo", None, None, "_dir"))
    if not lha:
        return None, None

    if scope == "repo":
        return col, lha

    branch_title = "epic" if scope == "epic" else "non-epic"
    branch = _ensure_node(api, manifest, branch_title, col, lha, branch_title,
                          _marker(scope, None, None, "_dir"))
    if not branch:
        return None, None

    if scope == "epic":
        epic_dir = _ensure_node(api, manifest, f"epic/{epic_key}", col, branch, epic_key,
                                _marker("epic", epic_key, None, "_dir"))
        if not epic_dir:
            return None, None
        if item is None:                       # epic.md / checklist.md live here
            return col, epic_dir
        parent = _ensure_node(api, manifest, f"epic/{epic_key}/{item}", col, epic_dir, item,
                              _marker("epic", epic_key, item, "_parent"))
        return (col, parent) if parent else (None, None)

    # non-epic: flat — task dirs directly under non-epic
    parent = _ensure_node(api, manifest, f"non-epic/{item}", col, branch, item,
                          _marker("non-epic", None, item, "_parent"))
    return (col, parent) if parent else (None, None)


def _invalidate_path_cache(manifest, scope, epic_key, item):
    """Drop the cached container ids along one classification path so the next
    attempt re-resolves them (heals stale parents deleted/moved in Outline)."""
    nodes = manifest.get("nodes", {})
    keys = ["long-horizon-agent", "epic" if scope == "epic" else "non-epic"]
    if scope == "epic":
        keys += [f"epic/{epic_key}", f"epic/{epic_key}/{item}"]
    elif scope == "non-epic":
        keys += [f"non-epic/{item}"]
    for k in keys:
        nodes.pop(k, None)


# -- push / pull --------------------------------------------------------------

def _push_file(api, manifest, proj, relpath):
    """Push one local file to its Outline doc if its hash changed. True if synced/skipped."""
    spec = _classify(proj, relpath)
    if spec is None:
        return True
    scope, epic_key, item, title = spec
    data = _read_file(os.path.join(proj, relpath))
    if data is None:
        return True
    digest = _sha256_bytes(data)
    docs = manifest.setdefault("docs", {})
    key = _doc_key(scope, epic_key, item, relpath)
    entry = docs.get(key) or {}
    if entry.get("hash") == digest and entry.get("id"):
        return True

    col, parent = _ensure_parents(api, manifest, proj, scope, epic_key, item)
    if not parent:
        return False
    body = _marker(scope, epic_key, item, title) + data.decode("utf-8", "replace")

    doc_id = entry.get("id")
    if doc_id and not api.update_doc(doc_id, body):
        doc_id = None                      # stale id (deleted/archived in Outline)
        entry.pop("id", None)
    if not doc_id:
        found, ok = api.find_child_doc(col, parent, title)
        if found:
            doc_id = api.update_doc(found, body) and found
        elif ok:
            doc_id = api.create_doc(col, parent, title, body)
    if not doc_id:
        _invalidate_path_cache(manifest, scope, epic_key, item)
        return False
    docs[key] = {"id": doc_id, "hash": digest}
    return True


def _pull_doc(api, manifest, proj, relpath, doc_id, key):
    """Write an Outline doc to a MISSING local file (marker stripped). Never overwrites."""
    path = os.path.join(proj, relpath)
    if os.path.exists(path):
        return False
    doc = api.read_doc(doc_id)
    if not doc:
        return False
    remote = MARKER_RE.sub("", doc.get("text") or "", count=1).encode("utf-8")
    try:
        if os.path.dirname(path):
            os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(remote)
    except Exception:
        return False
    manifest.setdefault("docs", {})[key] = {"id": doc.get("id"), "hash": _sha256_bytes(remote)}
    return True


def _restore_missing(api, manifest, proj):
    """Fresh-clone recovery: all synced .md are gitignored, so restore whatever is
    missing locally from Outline — epic.md/checklist.md from the current (or most
    recently updated) epic dir, and the whole artifacts/ tree when it is absent.
    Only ever creates missing files; incomplete restores retry next session start."""
    restored = []
    epic_missing = not os.path.isfile(os.path.join(proj, "epic.md"))
    checklist_missing = not os.path.isfile(os.path.join(proj, "checklist.md"))
    artifacts_missing = not os.path.isdir(os.path.join(proj, "artifacts"))
    if not (epic_missing or checklist_missing or artifacts_missing):
        return restored

    col = manifest.get("collectionId") or api.ensure_collection(
        os.path.basename(os.path.abspath(proj)))
    if not col:
        return restored
    manifest["collectionId"] = col
    lha, _ok = api.find_child_doc(col, None, "long-horizon-agent")
    if not lha:
        return restored

    # -- epic side: resolve the epic dir (local epic.md's key, else newest epic-*)
    epic_branch, _ok = api.find_child_doc(col, lha, "epic")
    epic_dir_id = epic_key = None
    if epic_branch:
        if not epic_missing:
            epic_key = _epic_key(proj)
            epic_dir_id, _ok = api.find_child_doc(col, epic_branch, epic_key)
        else:
            kids = [k for k in api.list_children_meta(col, epic_branch) or []
                    if (k.get("title") or "").startswith("epic-")]
            if kids:
                kids.sort(key=lambda d: d.get("updatedAt") or "", reverse=True)
                epic_dir_id, epic_key = kids[0].get("id"), kids[0].get("title")

    if epic_dir_id:
        children = api.list_children_meta(col, epic_dir_id) or []
        by_title = {c.get("title"): c for c in children}
        if epic_missing and by_title.get("epic"):
            if _pull_doc(api, manifest, proj, "epic.md", by_title["epic"]["id"],
                         _doc_key("epic", epic_key, None, "epic.md")):
                restored.append("epic.md")
        if checklist_missing and by_title.get("checklist"):
            if _pull_doc(api, manifest, proj, "checklist.md", by_title["checklist"]["id"],
                         _doc_key("epic", epic_key, None, "checklist.md")):
                restored.append("checklist.md")
        if artifacts_missing:
            for c in children:
                title = c.get("title") or ""
                if title in ("epic", "checklist") or _deadline_hit():
                    continue
                m = re.match(r"^F-[\d.]+-(.+)$", title)
                item_dir = m.group(1) if m else title
                for doc in api.list_children_meta(col, c.get("id")) or []:
                    rel = os.path.join("artifacts", item_dir, f"{doc.get('title')}.md")
                    if _pull_doc(api, manifest, proj, rel, doc.get("id"),
                                 _doc_key("epic", epic_key, title, rel)):
                        restored.append(rel)

    # -- non-epic side: flat task dirs
    if artifacts_missing and not _deadline_hit():
        non_epic, _ok = api.find_child_doc(col, lha, "non-epic")
        if non_epic:
            for c in api.list_children_meta(col, non_epic) or []:
                if _deadline_hit():
                    break
                item = c.get("title") or ""
                for doc in api.list_children_meta(col, c.get("id")) or []:
                    rel = os.path.join("artifacts", item, f"{doc.get('title')}.md")
                    if _pull_doc(api, manifest, proj, rel, doc.get("id"),
                                 _doc_key("non-epic", None, item, rel)):
                        restored.append(rel)
    return restored


def _candidate_files(proj):
    """Everything sync-finished considers, in a stable order."""
    out = []
    for rel in ("epic.md", "checklist.md"):
        if os.path.isfile(os.path.join(proj, rel)):
            out.append(rel)
    if os.path.isfile(os.path.join(proj, TECH_STACK)):
        out.append(TECH_STACK)
    art = os.path.join(proj, "artifacts")
    if os.path.isdir(art):
        for item in sorted(os.listdir(art)):
            d = os.path.join(art, item)
            if not os.path.isdir(d):
                continue
            for name in sorted(os.listdir(d)):
                if name.endswith(".md"):
                    out.append(os.path.join("artifacts", item, name))
    return out


def mode_sync_finished(payload):
    base, key = _env()
    if not base:
        sys.exit(0)
    proj = _project_dir(payload)
    api = Outline(base, key, _ssl_context(proj))
    manifest = _load_manifest(proj)
    manifest["baseUrl"] = base
    changed = False
    for rel in _candidate_files(proj):
        if _deadline_hit():
            break
        before = json.dumps(
            {k: v for k, v in manifest.get("docs", {}).items() if k.endswith("/" + rel)},
            sort_keys=True)
        _push_file(api, manifest, proj, rel)
        after = json.dumps(
            {k: v for k, v in manifest.get("docs", {}).items() if k.endswith("/" + rel)},
            sort_keys=True)
        changed = changed or (before != after)
    if changed or manifest.get("nodes"):
        _save_manifest(proj, manifest)
    sys.exit(0)


def mode_post_write(payload):
    base, key = _env()
    if not base:
        sys.exit(0)
    proj = _project_dir(payload)
    tool_input = payload.get("tool_input") or {}
    path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
    if not path:
        sys.exit(0)
    try:
        rel = os.path.relpath(os.path.abspath(path), os.path.abspath(proj))
    except Exception:
        sys.exit(0)
    if rel not in list(REPO_LEVEL) + ["epic.md", "checklist.md"]:
        sys.exit(0)
    api = Outline(base, key, _ssl_context(proj))
    manifest = _load_manifest(proj)
    manifest["baseUrl"] = base
    _push_file(api, manifest, proj, rel)
    _save_manifest(proj, manifest)
    sys.exit(0)


def mode_session_start(payload):
    base, key = _env()
    if not base:
        sys.exit(0)
    proj = _project_dir(payload)
    api = Outline(base, key, _ssl_context(proj))
    manifest = _load_manifest(proj)
    manifest["baseUrl"] = base
    local_path = os.path.join(proj, TECH_STACK)
    local = _read_file(local_path)
    ts_key = _doc_key("repo", None, None, TECH_STACK)

    # Locate the Outline copy: manifest id first, else look under long-horizon-agent.
    doc_id = (manifest.get("docs", {}).get(ts_key) or {}).get("id")
    doc = api.read_doc(doc_id) if doc_id else None
    if doc is None:
        col = manifest.get("collectionId") or api.ensure_collection(
            os.path.basename(os.path.abspath(proj)))
        if col:
            manifest["collectionId"] = col
            lha, _ok = api.find_child_doc(col, None, "long-horizon-agent")
            if lha:
                manifest.setdefault("nodes", {})["long-horizon-agent"] = lha
                found, _ok = api.find_child_doc(col, lha, "tech-stack-profile")
                doc = api.read_doc(found) if found else None

    if doc:  # Outline canonical → pull
        remote = MARKER_RE.sub("", doc.get("text") or "", count=1).encode("utf-8")
        if local is None or _sha256_bytes(local) != _sha256_bytes(remote):
            try:
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                with open(local_path, "wb") as fh:
                    fh.write(remote)
                manifest.setdefault("docs", {})[ts_key] = {
                    "id": doc.get("id"), "hash": _sha256_bytes(remote)}
                _save_manifest(proj, manifest)
                print("outline-sync: pulled tech-stack-profile from Outline "
                      "(local copy updated to the canonical version)")
            except Exception:
                pass
        else:
            manifest.setdefault("docs", {})[ts_key] = {
                "id": doc.get("id"), "hash": _sha256_bytes(remote)}
            _save_manifest(proj, manifest)
    elif local is not None:  # only local exists → push it up
        _push_file(api, manifest, proj, TECH_STACK)
        _save_manifest(proj, manifest)

    restored = _restore_missing(api, manifest, proj)
    if restored:
        _save_manifest(proj, manifest)
        shown = ", ".join(restored[:8]) + ("…" if len(restored) > 8 else "")
        print(f"outline-sync: restored {len(restored)} gitignored file(s) from Outline: {shown}")
    sys.exit(0)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "sync-finished"
    payload = _read_payload()
    if mode == "session-start":
        mode_session_start(payload)
    elif mode == "post-write":
        mode_post_write(payload)
    else:
        mode_sync_finished(payload)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        sys.exit(0)
