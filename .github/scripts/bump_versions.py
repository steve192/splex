#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path


SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def parse_semver(value: str) -> tuple[int, int, int]:
    match = SEMVER_RE.match(value.strip())
    if not match:
        raise ValueError(f"Invalid semver: {value}")
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def bump(version: str, bump_type: str) -> str:
    major, minor, patch = parse_semver(version)
    if bump_type == "major":
        return f"{major + 1}.0.0"
    if bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    if bump_type == "patch":
        return f"{major}.{minor}.{patch + 1}"
    raise ValueError(f"Unsupported bump type: {bump_type}")


def update_frontend_package_json(version: str) -> None:
    path = Path("frontend/package.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    data["version"] = version
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def update_frontend_app_json(version: str) -> None:
    path = Path("frontend/app.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    data.setdefault("expo", {})
    data["expo"]["version"] = version
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def update_backend_pyproject(version: str) -> None:
    path = Path("backend/pyproject.toml")
    source = path.read_text(encoding="utf-8")
    updated = re.sub(
        r'(?m)^version = "[^"]+"$',
        f'version = "{version}"',
        source,
        count=1,
    )
    if updated == source:
        raise ValueError("Could not find backend version in backend/pyproject.toml")
    path.write_text(updated, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set-version", default="", help="Explicit version to set, e.g. 1.2.3")
    parser.add_argument("--bump", choices=["patch", "minor", "major"], default="patch")
    parser.add_argument("--base-version", default="", help="Base semver to bump, e.g. 1.2.3")
    args = parser.parse_args()

    if args.set_version:
        version = args.set_version
        parse_semver(version)
    else:
        base = args.base_version
        if not base:
            raise ValueError("--base-version is required when --set-version is not provided")
        version = bump(base, args.bump)

    update_frontend_package_json(version)
    update_frontend_app_json(version)
    update_backend_pyproject(version)
    print(version)


if __name__ == "__main__":
    main()
