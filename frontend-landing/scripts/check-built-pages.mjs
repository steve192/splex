import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const site = "https://splex.sterul.com";

const pagePairs = [
  ["/splitwise-alternative/", "/de/splitwise-alternative/"],
  ["/self-hosting/", "/de/selbst-hosten/"],
  ["/use-cases/travel-expenses/", "/de/anwendungsfaelle/reiseausgaben/"],
  ["/use-cases/shared-household-expenses/", "/de/anwendungsfaelle/haushaltsausgaben/"],
  ["/glossary/", "/de/glossar/"],
];

const documentationPagePairs = [
  ["/docs/friends-and-groups/", "/de/dokumentation/freunde-und-gruppen/"],
  ["/docs/currency-calculator/", "/de/dokumentation/waehrungsrechner/"],
  ["/docs/balances-and-settlements/", "/de/dokumentation/offene-betraege-und-ausgleich/"],
  ["/docs/adding-expenses/", "/de/dokumentation/ausgaben-erfassen/"],
];

const removedGuidePaths = [
  "/features/split-methods/",
  "/de/funktionen/aufteilungen/",
  "/features/multi-currency-expenses/",
  "/de/funktionen/mehrwaehrungs-ausgaben/",
  "/features/offline-expense-tracking/",
  "/de/funktionen/offline-ausgaben/",
];

function fileForPath(path) {
  return join(dist, path, "index.html");
}

function readBuiltPage(path) {
  const file = fileForPath(path);
  if (!existsSync(file)) {
    throw new Error(`Missing built page for ${path}: ${file}`);
  }
  return readFileSync(file, "utf8");
}

function expectIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label} is missing ${needle}`);
  }
}

function expectExcludes(haystack, needle, label) {
  if (haystack.includes(needle)) {
    throw new Error(`${label} still includes ${needle}`);
  }
}

const home = readBuiltPage("/");
const deHome = readBuiltPage("/de/");
const sitemap = readFileSync(join(dist, "sitemap-0.xml"), "utf8");

for (const [enPath, dePath] of [...pagePairs, ...documentationPagePairs]) {
  const enHtml = readBuiltPage(enPath);
  const deHtml = readBuiltPage(dePath);

  expectIncludes(home, `href="${enPath}"`, `English homepage link to ${enPath}`);
  expectIncludes(deHome, `href="${dePath}"`, `German homepage link to ${dePath}`);

  expectIncludes(enHtml, `rel="canonical" href="${site}${enPath}"`, `English canonical for ${enPath}`);
  expectIncludes(deHtml, `rel="canonical" href="${site}${dePath}"`, `German canonical for ${dePath}`);

  expectIncludes(enHtml, `hreflang="en" href="${site}${enPath}"`, `English hreflang for ${enPath}`);
  expectIncludes(enHtml, `hreflang="de" href="${site}${dePath}"`, `German alternate on ${enPath}`);
  expectIncludes(deHtml, `hreflang="en" href="${site}${enPath}"`, `English alternate on ${dePath}`);
  expectIncludes(deHtml, `hreflang="de" href="${site}${dePath}"`, `German hreflang for ${dePath}`);
  expectIncludes(enHtml, `hreflang="x-default" href="${site}${enPath}"`, `x-default for ${enPath}`);
  expectIncludes(deHtml, `hreflang="x-default" href="${site}${enPath}"`, `x-default for ${dePath}`);

  expectIncludes(sitemap, `${site}${enPath}`, `Sitemap entry for ${enPath}`);
  expectIncludes(sitemap, `${site}${dePath}`, `Sitemap entry for ${dePath}`);
  expectIncludes(sitemap, `hreflang="en" href="${site}${enPath}"`, `Sitemap English alternate for ${enPath}`);
  expectIncludes(sitemap, `hreflang="de" href="${site}${dePath}"`, `Sitemap German alternate for ${enPath}`);
  expectIncludes(sitemap, `hreflang="x-default" href="${site}${enPath}"`, `Sitemap x-default alternate for ${enPath}`);
}

for (const path of removedGuidePaths) {
  const file = fileForPath(path);
  if (existsSync(file)) {
    throw new Error(`Removed guide page was still built for ${path}: ${file}`);
  }
  if (home.includes(`href="${path}"`) || deHome.includes(`href="${path}"`) || sitemap.includes(`${site}${path}`)) {
    throw new Error(`Removed guide page is still linked or listed: ${path}`);
  }
}

expectIncludes(home, 'id="guides"', "Homepage guides section");
expectIncludes(home, 'id="documentation"', "Homepage documentation section");
expectIncludes(home, 'href="/docs/friends-and-groups/"', "English homepage friends and groups doc link");
expectIncludes(deHome, 'href="/de/dokumentation/freunde-und-gruppen/"', "German homepage friends and groups doc link");
expectIncludes(home, 'href="/docs/balances-and-settlements/"', "English homepage balances doc link");
expectIncludes(deHome, 'href="/de/dokumentation/offene-betraege-und-ausgleich/"', "German homepage balances doc link");
expectExcludes(sitemap, "/de/dokumentation/salden-und-ausgleich/", "Sitemap old German balances doc URL");
expectIncludes(
  readBuiltPage("/de/dokumentation/salden-und-ausgleich/"),
  'content="0;url=/de/dokumentation/offene-betraege-und-ausgleich/"',
  "Old German balances doc redirect"
);
expectIncludes(home, 'href="/docs/adding-expenses/"', "English homepage adding expenses doc link");
expectIncludes(deHome, 'href="/de/dokumentation/ausgaben-erfassen/"', "German homepage adding expenses doc link");
expectIncludes(home, "offline expense entry", "English homepage precise offline claim");
expectIncludes(deHome, "Ausgaben offline vormerken", "German homepage precise offline claim");
expectIncludes(home, "Description suggestions from your own nearby expense history", "English homepage nearby suggestions wording");
expectIncludes(deHome, "Beschreibungsvorschläge aus deinen eigenen Ausgaben in der Nähe", "German homepage nearby suggestions wording");
expectIncludes(home, "Self-hosting guide", "English self-host section guide link");
expectIncludes(deHome, "Anleitung ansehen", "German self-host section guide link");
expectIncludes(home, 'href="/glossary/"', "English footer glossary link");
expectIncludes(deHome, 'href="/de/glossar/"', "German footer glossary link");
expectIncludes(readBuiltPage("/glossary/"), "Open amount", "English glossary open amount term");
expectIncludes(readBuiltPage("/glossary/"), "Balance", "English glossary balance synonym");
expectIncludes(readBuiltPage("/de/glossar/"), "Offener Betrag", "German glossary open amount term");
expectIncludes(readBuiltPage("/de/glossar/"), "Saldo", "German glossary saldo synonym");
expectIncludes(readBuiltPage("/de/glossar/"), 'href="/de/dokumentation/offene-betraege-und-ausgleich/"', "German glossary balances doc link");
expectIncludes(readBuiltPage("/splitwise-alternative/"), "Where Splitwise may still be the better fit", "Comparison caveat section");
expectIncludes(readBuiltPage("/de/splitwise-alternative/"), "Wo Splitwise wahrscheinlich besser passt", "German comparison caveat section");
expectIncludes(readBuiltPage("/self-hosting/"), "docker-compose.yml", "Self-hosting setup section");
expectIncludes(readBuiltPage("/de/selbst-hosten/"), "docker-compose.yml", "German self-hosting setup section");
expectIncludes(
  readBuiltPage("/self-hosting/"),
  "https://raw.githubusercontent.com/steve192/splex/main/.env.example",
  "Self-hosting env template link"
);
expectIncludes(readBuiltPage("/self-hosting/"), "data-copy-code", "Self-hosting copy button");
expectIncludes(readBuiltPage("/de/selbst-hosten/"), "Kopieren", "German self-hosting copy button");
expectIncludes(readBuiltPage("/docs/friends-and-groups/"), "data-article-toc", "English article table of contents");
expectIncludes(readBuiltPage("/docs/friends-and-groups/"), "data-article-toc-link", "English article active table of contents links");
expectIncludes(readBuiltPage("/docs/friends-and-groups/"), "data-article-section", "English article section markers");
expectIncludes(
  readBuiltPage("/docs/friends-and-groups/"),
  "A group balance never changes a direct balance between two friends",
  "English friends and groups separation text"
);
expectIncludes(
  readBuiltPage("/de/dokumentation/freunde-und-gruppen/"),
  "Was in einer Gruppe offen ist, verändert nicht, was direkt zwischen zwei Freunden offen ist",
  "German friends and groups separation text"
);
expectIncludes(
  readBuiltPage("/docs/friends-and-groups/"),
  "There are no separate permissions inside a group",
  "English group permission text"
);
expectIncludes(
  readBuiltPage("/de/dokumentation/freunde-und-gruppen/"),
  "Innerhalb einer Gruppe gibt es keine eigenen Berechtigungen",
  "German group permission text"
);
expectIncludes(
  readBuiltPage("/docs/currency-calculator/"),
  "older than 24 hours",
  "English currency calculator rate freshness text"
);
expectIncludes(
  readBuiltPage("/de/dokumentation/waehrungsrechner/"),
  "älter als 24 Stunden",
  "German currency calculator rate freshness text"
);
expectIncludes(
  readBuiltPage("/docs/balances-and-settlements/"),
  "A 10.00 expense split equally between three people becomes 3.34, 3.33, and 3.33",
  "English balances cent rounding text"
);
expectIncludes(
  readBuiltPage("/docs/balances-and-settlements/"),
  "Balances and settlements",
  "English balances page heading"
);
expectIncludes(
  readBuiltPage("/de/dokumentation/offene-betraege-und-ausgleich/"),
  "Eine Ausgabe über 10,00, gleichmäßig auf drei Personen verteilt",
  "German balances cent rounding text"
);
expectIncludes(
  readBuiltPage("/docs/balances-and-settlements/"),
  "Bea pays Chris 5",
  "English simplified debt example"
);
expectIncludes(
  readBuiltPage("/docs/adding-expenses/"),
  "It is not a public place search",
  "English nearby suggestions explanation"
);
expectIncludes(
  readBuiltPage("/de/dokumentation/ausgaben-erfassen/"),
  "keine öffentliche Ortssuche",
  "German nearby suggestions explanation"
);
expectIncludes(
  readBuiltPage("/docs/adding-expenses/"),
  "Pending expenses are not part of the balance yet",
  "English pending sync balance warning"
);
expectIncludes(
  readBuiltPage("/docs/adding-expenses/"),
  "every member has the same access to the shared expense ledger",
  "English adding expense group permission text"
);

console.log(
  `Checked ${(pagePairs.length + documentationPagePairs.length) * 2} content pages, homepage links, canonicals, page hreflang, and sitemap hreflang.`
);
