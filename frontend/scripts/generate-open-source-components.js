const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const lockFilePath = path.join(rootDir, "package-lock.json");
const outputPath = path.join(rootDir, "src", "shared", "legal", "openSourceComponents.generated.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeLicense(value) {
  if (!value) return "UNKNOWN";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeLicense(entry)).filter(Boolean).join(" OR ");
  }
  if (typeof value === "object") {
    if (typeof value.type === "string") return value.type;
    if (typeof value.name === "string") return value.name;
  }
  return "UNKNOWN";
}

function normalizeAuthor(author) {
  if (!author) return "";
  if (typeof author === "string") return author;
  if (typeof author === "object") {
    const parts = [author.name, author.email, author.url].filter(Boolean);
    return parts.join(" ");
  }
  return "";
}

function normalizeRepository(repository) {
  if (!repository) return "";
  if (typeof repository === "string") return repository;
  if (typeof repository === "object" && typeof repository.url === "string") return repository.url;
  return "";
}

function candidateFiles(dirPath, prefixes) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter((name) => prefixes.some((prefix) => name.toUpperCase().startsWith(prefix)))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => path.join(dirPath, name));
}

function readTextFiles(dirPath, prefixes) {
  const chunks = [];
  for (const filePath of candidateFiles(dirPath, prefixes)) {
    try {
      const content = fs.readFileSync(filePath, "utf8").trim();
      if (!content) continue;
      chunks.push(`===== ${path.basename(filePath)} =====\n${content}`);
    } catch {
      // Ignore unreadable files.
    }
  }
  return chunks.join("\n\n");
}

function buildComponent(pkgPath, meta) {
  const packageDir = path.join(rootDir, pkgPath);
  const packageJsonPath = path.join(packageDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) return null;

  const packageJson = readJson(packageJsonPath);
  const name = packageJson.name || meta.name;
  const version = packageJson.version || meta.version || "UNKNOWN";
  if (!name) return null;

  return {
    source: "frontend",
    name,
    license: normalizeLicense(packageJson.license || meta.license),
    homepage: packageJson.homepage || normalizeRepository(packageJson.repository),
    author: normalizeAuthor(packageJson.author),
    noticeText: readTextFiles(packageDir, ["NOTICE", "AUTHORS"]),
    licenseText: readTextFiles(packageDir, ["LICENSE", "LICENCE", "COPYING"])
  };
}

function main() {
  const lockFile = readJson(lockFilePath);
  const packages = Object.entries(lockFile.packages || {});
  const deduped = new Map();

  for (const [pkgPath, meta] of packages) {
    if (!pkgPath || !pkgPath.startsWith("node_modules/")) continue;
    if (meta && meta.dev) continue;
    const component = buildComponent(pkgPath, meta || {});
    if (!component) continue;
    const componentVersion = (meta && meta.version) || "UNKNOWN";
    const key = `${component.name}@${componentVersion}`;
    if (!deduped.has(key)) {
      deduped.set(key, component);
    }
  }

  const components = Array.from(deduped.values()).sort((left, right) => {
    return left.name.localeCompare(right.name);
  });

  ensureDirectory(outputPath);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        components
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(`Wrote ${components.length} frontend open-source components to ${outputPath}`);
}

main();