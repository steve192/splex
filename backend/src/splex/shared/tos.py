import os
from dataclasses import dataclass
from html import escape
from pathlib import Path

from django.conf import settings

FULL_DOCUMENT_MARKERS = ("<!doctype html", "<html")

LEGAL_SHELL = """<!DOCTYPE html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <base target=\"_top\" />
    <title>Splex | __TITLE__</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe6;
        --surface: rgba(255, 251, 245, 0.94);
        --surface-strong: #fffdf8;
        --text: #1e2420;
        --muted: #5f685f;
        --line: rgba(66, 78, 66, 0.16);
        --accent: #1f7a5c;
        --accent-2: #d18a2c;
        --shadow: 0 28px 60px rgba(31, 41, 35, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(209, 138, 44, 0.16), transparent 30%),
          radial-gradient(circle at top right, rgba(31, 122, 92, 0.18), transparent 34%),
          linear-gradient(180deg, #f9f3e8 0%, var(--bg) 100%);
        color: var(--text);
        font-family: Georgia, "Times New Roman", serif;
        line-height: 1.7;
      }

      .shell {
        max-width: 920px;
        margin: 0 auto;
        padding: 32px 18px 60px;
      }

      .hero {
        display: grid;
        gap: 12px;
        margin-bottom: 24px;
      }

      .eyebrow {
        margin: 0;
        color: var(--accent);
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .hero h1 {
        margin: 0;
        font-size: clamp(2.2rem, 4vw, 3.5rem);
        line-height: 1.05;
      }

      .hero p {
        margin: 0;
        max-width: 48rem;
        color: var(--muted);
        font-size: 1.05rem;
      }

      .doc-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 14px;
        margin-bottom: 18px;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        font-size: 0.95rem;
      }

      .doc-nav a {
        color: var(--accent);
        text-decoration: none;
      }

      .doc-nav a:hover {
        text-decoration: underline;
      }

      .doc-nav .sep {
        color: var(--muted);
      }

      article {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: var(--shadow);
        padding: clamp(22px, 4vw, 42px);
      }

      article > :first-child {
        margin-top: 0;
      }

      article > :last-child {
        margin-bottom: 0;
      }

      h1, h2, h3, h4 {
        color: #163428;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        line-height: 1.18;
        margin: 1.6em 0 0.65em;
      }

      h1 {
        font-size: clamp(2rem, 3vw, 2.8rem);
      }

      h2 {
        font-size: clamp(1.35rem, 2vw, 1.8rem);
      }

      h3 {
        font-size: 1.15rem;
      }

      p, ul, ol, blockquote, table, pre {
        margin: 0 0 1rem;
      }

      ul, ol {
        padding-left: 1.35rem;
      }

      li + li {
        margin-top: 0.45rem;
      }

      a {
        color: var(--accent);
      }

      strong {
        color: #163428;
      }

      code {
        background: rgba(31, 122, 92, 0.08);
        border-radius: 0.45rem;
        color: #0f5b43;
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        font-size: 0.94em;
        padding: 0.14rem 0.38rem;
      }

      pre {
        background: #16201c;
        border-radius: 18px;
        color: #eef6f1;
        overflow-x: auto;
        padding: 18px;
      }

      pre code {
        background: transparent;
        color: inherit;
        padding: 0;
      }

      blockquote {
        border-left: 4px solid var(--accent-2);
        color: var(--muted);
        margin-left: 0;
        padding-left: 1rem;
      }

      table {
        border-collapse: collapse;
        width: 100%;
      }

      th, td {
        border: 1px solid var(--line);
        padding: 0.7rem 0.8rem;
        text-align: left;
        vertical-align: top;
      }

      th {
        background: rgba(31, 122, 92, 0.08);
        color: #163428;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      }

      hr {
        border: 0;
        border-top: 1px solid var(--line);
        margin: 1.6rem 0;
      }

      @media (max-width: 720px) {
        .shell {
          padding-top: 20px;
        }

        article {
          border-radius: 22px;
        }
      }
    </style>
  </head>
  <body>
    <main class=\"shell\">
      <header class=\"hero\">
        <p class=\"eyebrow\">Splex</p>
        <h1>__TITLE__</h1>
        <p>__SUBTITLE__</p>
      </header>
      <nav class=\"doc-nav\">
        <a href=\"/tos\">Terms of Service</a>
        <span class=\"sep\">·</span>
        <a href=\"/privacy\">Privacy Policy</a>
        <span class=\"sep\">·</span>
        <a href=\"/imprint\">Legal Notice</a>
      </nav>
      <article>
        __CONTENT__
      </article>
    </main>
  </body>
</html>
"""


@dataclass(frozen=True)
class LegalDocumentSpec:
    key: str
    title: str
    subtitle: str
    settings_attr: str
    env_var: str
    default_path: str
    placeholder_heading: str


LEGAL_DOCUMENTS: dict[str, LegalDocumentSpec] = {
    "tos": LegalDocumentSpec(
        key="tos",
        title="Terms of Service",
        subtitle="The following terms apply when using this Splex instance.",
        settings_attr="TOS_FILE_PATH",
        env_var="TOS_FILE_PATH",
        default_path="/app/data/tos.html",
        placeholder_heading="Terms of Service",
    ),
    "privacy": LegalDocumentSpec(
        key="privacy",
        title="Privacy Policy",
        subtitle="How this Splex instance handles personal data.",
        settings_attr="PRIVACY_FILE_PATH",
        env_var="PRIVACY_FILE_PATH",
        default_path="/app/data/privacy.html",
        placeholder_heading="Privacy Policy",
    ),
    "imprint": LegalDocumentSpec(
        key="imprint",
        title="Legal Notice",
        subtitle="Provider information for this Splex instance.",
        settings_attr="IMPRINT_FILE_PATH",
        env_var="IMPRINT_FILE_PATH",
        default_path="/app/data/imprint.html",
        placeholder_heading="Legal Notice",
    ),
}


def get_legal_document_spec(kind: str) -> LegalDocumentSpec:
    try:
        return LEGAL_DOCUMENTS[kind]
    except KeyError as exc:
        raise ValueError(f"Unknown legal document kind: {kind!r}") from exc


def get_legal_file_path(kind: str) -> Path:
    spec = get_legal_document_spec(kind)
    if settings.configured:
        return Path(getattr(settings, spec.settings_attr))
    return Path(os.getenv(spec.env_var, spec.default_path))


def ensure_legal_file(kind: str) -> None:
    spec = get_legal_document_spec(kind)
    path = get_legal_file_path(kind)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return
    path.write_text(build_placeholder_fragment(spec, str(path)), encoding="utf-8")


def render_legal_document(kind: str) -> str:
    spec = get_legal_document_spec(kind)
    ensure_legal_file(kind)
    content = get_legal_file_path(kind).read_text(encoding="utf-8")
    if looks_like_full_document(content):
        return content
    return (
        LEGAL_SHELL
        .replace("__TITLE__", spec.title)
        .replace("__SUBTITLE__", spec.subtitle)
        .replace("__CONTENT__", content)
    )


def looks_like_full_document(content: str) -> bool:
    normalized = content.lstrip().lower()
    return normalized.startswith(FULL_DOCUMENT_MARKERS)


def build_placeholder_fragment(spec: LegalDocumentSpec, configured_path: str) -> str:
    escaped_path = escape(configured_path)
    escaped_env = escape(spec.env_var)
    escaped_heading = escape(spec.placeholder_heading)
    return f"""
<h1>{escaped_heading}</h1>
<p>This Splex instance does not have a custom {escaped_heading} file yet.</p>
<p>
  Splex is currently reading the {escaped_heading} from <code>{escaped_path}</code>.
  Replace that file with your own HTML content, or point <code>{escaped_env}</code>
  at a different mounted file in your <code>.env</code>.
</p>

<h2>How to replace this placeholder</h2>
<ol>
  <li>Create an HTML file on the host, for example <code>./deploy/{spec.key}.html</code>.</li>
  <li>Mount it into the container at <code>{escaped_path}</code>.</li>
  <li>Restart the container after updating the file or changing <code>{escaped_env}</code>.</li>
</ol>

<h2>Docker compose example</h2>
<pre><code>services:
  app:
    volumes:
      - ./deploy/{spec.key}.html:{escaped_path}:ro</code></pre>

<h2>Authoring tips</h2>
<p>
  You can keep the file simple. Add headings, paragraphs, lists, links, tables,
  and code blocks directly. This page shell already styles standard HTML elements
  automatically.
</p>
<blockquote>
  Replace this placeholder with your real legal text before offering the service to users.
</blockquote>
""".strip()


# Backwards-compatible aliases (kept for callers that imported the older names).
def get_tos_file_path() -> Path:
    return get_legal_file_path("tos")


def ensure_terms_of_service_file() -> None:
    ensure_legal_file("tos")


def render_terms_of_service_document() -> str:
    return render_legal_document("tos")
