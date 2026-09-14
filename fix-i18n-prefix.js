const fs = require("fs");
const path = require("path");

const NAMESPACES = [
  "common", "shell", "search", "commands", "voice", "dashboard",
  "accounting", "partners", "invoicing", "inventory", "fixedAssets",
  "reports", "settings", "users", "auth", "validation", "errors", "widgets"
];

// Match: t("namespace.rest.of.key", { namespace: "namespace", ... })
// where the first arg starts with the namespace name + "."
const REDUNDANT_RE = new RegExp(
  `t\\(("(?:${NAMESPACES.join("|")})")\\.(("[a-zA-Z0-9_.]*")|([a-zA-Z0-9_]*))\\s*,\\s*\\{\\s*namespace:\\s*\\1(\\s*,|\\s*\\})`,
  "g"
);

const SRC_ROOT = path.join(__dirname, "apps", "desktop", "src");

function walk(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      results.push(full);
    }
  }
  return results;
}

const files = walk(SRC_ROOT);
let totalChanges = 0;

for (const filePath of files) {
  let content = fs.readFileSync(filePath, "utf8");
  let changes = 0;

  const newContent = content.replace(REDUNDANT_RE, (match, nsQuoted, keyPart, _quoted, _unquoted, nsTrailing) => {
    changes++;
    // keyPart may be quoted or unquoted
    const key = keyPart.replace(/^"|"$/g, "");
    // nsTrailing is either "," or "}" - if "}", we need to remove the namespace line entirely
    if (nsTrailing.trim() === "}") {
      // Pattern: { namespace: "ns" } -> {}
      return `t("${key}", {}${match.slice(match.lastIndexOf(nsTrailing))}`;
    }
    // Pattern: { namespace: "ns", ... } -> { ... }
    return `t("${key}", {${match.slice(match.indexOf(nsTrailing) + nsTrailing.length)}`;
  });

  if (changes > 0) {
    fs.writeFileSync(filePath, newContent, "utf8");
    const rel = path.relative(__dirname, filePath);
    console.log(`${rel}: ${changes} fix(es)`);
    totalChanges += changes;
  }
}

console.log(`\nTotal changes: ${totalChanges}`);
