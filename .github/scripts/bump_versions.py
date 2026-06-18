#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
from pathlib import Path


SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
NATIVE_RUNTIME_VERSION_RE = re.compile(r"^(\d+)\.0\.0$")


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


def parse_native_runtime_version(value: str) -> int:
    match = NATIVE_RUNTIME_VERSION_RE.match(value.strip())
    if not match:
        raise ValueError(
            f"Invalid runtimeVersion: {value}. Expected format '<integer>.0.0'"
        )
    return int(match.group(1))


def update_frontend_package_json(version: str) -> None:
    subprocess.run(
        [
            "npm",
            "version",
            version,
            "--no-git-tag-version",
            "--allow-same-version",
        ],
        cwd="frontend",
        check=True,
    )


def update_frontend_app_json(version: str, bump_native: bool) -> None:
    path = Path("frontend/app.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    data.setdefault("expo", {})
    data["expo"]["version"] = version

    if bump_native:
        android_config = data["expo"].get("android")
        if not isinstance(android_config, dict):
            raise ValueError("Missing expo.android config in frontend/app.json")

        version_code = android_config.get("versionCode")
        if not isinstance(version_code, int):
            raise ValueError("Missing integer expo.android.versionCode in frontend/app.json")

        runtime_version = data["expo"].get("runtimeVersion")
        if not isinstance(runtime_version, str):
            raise ValueError("Missing string expo.runtimeVersion in frontend/app.json")

        next_native_number = max(
            version_code,
            parse_native_runtime_version(runtime_version),
        ) + 1
        android_config["versionCode"] = next_native_number
        data["expo"]["runtimeVersion"] = f"{next_native_number}.0.0"

    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def update_backend_pyproject(version: str) -> None:
    path = Path("backend/pyproject.toml")
    source = path.read_text(encoding="utf-8")
    pattern = re.compile(r'(?m)^version = "[^"]+"$')
    if not pattern.search(source):
        raise ValueError("Could not find backend version in backend/pyproject.toml")
    path.write_text(pattern.sub(f'version = "{version}"', source, count=1), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set-version", default="", help="Explicit version to set, e.g. 1.2.3")
    parser.add_argument("--bump", choices=["patch", "minor", "major"], default="patch")
    parser.add_argument("--base-version", default="", help="Base semver to bump, e.g. 1.2.3")
    parser.add_argument(
        "--bump-native",
        action="store_true",
        help="Increment frontend android.versionCode and runtimeVersion together",
    )
    args = parser.parse_args()

    bump_native = args.bump_native or "true" == os.environ.get("SPLEX_BUMP_NATIVE", "").lower()

    if args.set_version:
        version = args.set_version
        parse_semver(version)
    else:
        base = args.base_version
        if not base:
            raise ValueError("--base-version is required when --set-version is not provided")
        version = bump(base, args.bump)

    update_frontend_package_json(version)
    update_frontend_app_json(version, bump_native)
    update_backend_pyproject(version)
    print(version)


if __name__ == "__main__":
    main()
