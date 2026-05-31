import json
import re
import tomllib
from collections.abc import Iterable
from datetime import UTC, datetime
from importlib import metadata
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[4]
BACKEND_DIR = ROOT_DIR / "backend"
PYPROJECT_PATH = BACKEND_DIR / "pyproject.toml"
FRONTEND_SOURCE_JSON_PATH = (
    ROOT_DIR / "frontend" / "src" / "shared" / "legal" / "openSourceComponents.generated.json"
)
BACKEND_BUNDLED_FRONTEND_JSON_PATH = (
    BACKEND_DIR / "src" / "splex" / "shared" / "openSourceComponents.generated.json"
)
APP_LICENSE_PATH = ROOT_DIR / "LICENSE"
_NAME_SPLIT_RE = re.compile(r"[<>=!\[;\s]")
_CANONICAL_RE = re.compile(r"[-_.]+")


def canonical_name(name: str) -> str:
    return _CANONICAL_RE.sub("-", name).lower().strip()


def parse_requirement_name(requirement: str) -> str:
    return _NAME_SPLIT_RE.split(requirement, maxsplit=1)[0].strip()


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8").strip()
    except Exception:
        return ""


def read_license_file_candidates(base_dir: Path, prefixes: Iterable[str]) -> str:
    if not base_dir.exists():
        return ""
    chunks: list[str] = []
    for child in sorted(base_dir.iterdir(), key=lambda item: item.name.lower()):
        if not child.is_file():
            continue
        if not any(child.name.upper().startswith(prefix) for prefix in prefixes):
            continue
        content = read_text(child)
        if content:
            chunks.append(f"===== {child.name} =====\n{content}")
    return "\n\n".join(chunks)


def metadata_value(package_metadata, *keys: str) -> str:
    for key in keys:
        value = package_metadata.get(key)
        if value:
            return value.strip()
    return ""


def infer_license(dist: metadata.Distribution) -> str:
    raw = metadata_value(dist.metadata, "License")
    if raw and raw.upper() != "UNKNOWN":
        return raw
    classifiers = [
        value.rsplit("::", 1)[-1].strip()
        for value in dist.metadata.get_all("Classifier", [])
        if value.startswith("License ::")
    ]
    if classifiers:
        return " OR ".join(sorted(dict.fromkeys(classifiers)))
    return "UNKNOWN"


def discover_backend_direct_dependencies() -> list[str]:
    pyproject = tomllib.loads(PYPROJECT_PATH.read_text(encoding="utf-8"))
    dependencies = pyproject.get("project", {}).get("dependencies", [])
    return [parse_requirement_name(requirement) for requirement in dependencies]


def distributions_by_name() -> dict[str, metadata.Distribution]:
    result: dict[str, metadata.Distribution] = {}
    for dist in metadata.distributions():
        name = dist.metadata.get("Name")
        if not name:
            continue
        result[canonical_name(name)] = dist
    return result


def dependency_closure(root_requirements: Iterable[str]) -> list[metadata.Distribution]:
    available = distributions_by_name()
    queue = [canonical_name(name) for name in root_requirements]
    seen = set()
    resolved: list[metadata.Distribution] = []

    while queue:
        name = queue.pop(0)
        if name in seen:
            continue
        seen.add(name)
        dist = available.get(name)
        if dist is None:
            continue
        resolved.append(dist)
        for requirement in dist.requires or []:
            dep_name = parse_requirement_name(requirement)
            if dep_name:
                queue.append(canonical_name(dep_name))
    return sorted(resolved, key=lambda item: canonical_name(item.metadata.get("Name", "")))


def serialize_backend_distribution(dist: metadata.Distribution) -> dict:
    package_name = dist.metadata.get("Name", "")
    package_root = Path(dist.locate_file("."))
    homepage = metadata_value(dist.metadata, "Home-page")
    project_urls = dist.metadata.get_all("Project-URL", []) or []
    if not homepage and project_urls:
        primary_project_url = project_urls[0]
        homepage = (
            primary_project_url.split(",", 1)[-1].strip()
            if "," in primary_project_url
            else primary_project_url
        )

    return {
        "source": "backend",
        "name": package_name,
        "license": infer_license(dist),
        "homepage": homepage,
        "author": metadata_value(dist.metadata, "Author", "Maintainer"),
        "noticeText": read_license_file_candidates(package_root, ["NOTICE", "AUTHORS"]),
        "licenseText": read_license_file_candidates(
            package_root,
            ["LICENSE", "LICENCE", "COPYING"],
        ),
    }


def load_frontend_components() -> list[dict]:
    for candidate in [FRONTEND_SOURCE_JSON_PATH, BACKEND_BUNDLED_FRONTEND_JSON_PATH]:
        if not candidate.exists():
            continue
        try:
            payload = json.loads(candidate.read_text(encoding="utf-8"))
        except Exception:
            payload = {}
        components = payload.get("components") or []
        if isinstance(components, list):
            return components
    return []


def build_open_source_payload() -> dict:
    backend_components = [
        serialize_backend_distribution(dist)
        for dist in dependency_closure(discover_backend_direct_dependencies())
    ]
    frontend_components = load_frontend_components()
    return {
        "generatedAt": datetime.now(UTC).isoformat(),
        "app": {
            "name": "Splex",
            "license": "Splex Non-Commercial Source License 1.0",
            "licenseText": read_text(APP_LICENSE_PATH),
            "copyright": "Copyright (c) 2026 steve192",
            "thirdPartyNotice": (
                "Third-party components included with Splex remain under their own licenses. "
                "Their copyright notices, license texts, and NOTICE files must be preserved "
                "where required."
            ),
        },
        "sections": [
            {"id": "frontend", "title": "Frontend", "components": frontend_components},
            {"id": "backend", "title": "Backend", "components": backend_components},
        ],
    }