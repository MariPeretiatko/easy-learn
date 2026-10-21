import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const root = process.cwd();
const config = ts.readConfigFile(
  path.join(root, "tsconfig.json"),
  ts.sys.readFile,
).config;
const options = ts.parseJsonConfigFileContent(config, ts.sys, root).options;
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((item) =>
      item.isDirectory()
        ? files(path.join(dir, item.name))
        : [path.join(dir, item.name)],
    );
}
const sources = files(path.join(root, "src")).filter(
  (file) =>
    /\.tsx?$/.test(file) && !/(?:\.(?:test|spec)\.tsx?$|\.d\.ts$)/.test(file),
);
const visited = new Set();
function visit(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function walk(node) {
    let spec;
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      spec = node.moduleSpecifier.text;
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    )
      spec = node.arguments[0].text;
    if (spec?.startsWith(".")) {
      const resolved = ts.resolveModuleName(spec, file, options, ts.sys)
        .resolvedModule?.resolvedFileName;
      if (resolved && /\.tsx?$/.test(resolved) && !resolved.endsWith(".d.ts"))
        visit(resolved);
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
}
visit(path.join(root, "src/main.tsx"));
const unused = sources
  .filter((file) => !visited.has(file))
  .map((file) => path.relative(root, file));
if (unused.length) {
  console.error("Unreachable application modules:\n" + unused.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Application dependency graph: ${sources.length} modules reachable from src/main.tsx.`,
  );

// Include test references so supported, tested APIs are not mistaken for dead code.
const program = ts.createProgram(
    ts.parseJsonConfigFileContent(config, ts.sys, root).fileNames,
    options,
  ),
  checker = program.getTypeChecker();
const refs = new Map();
const exports = [];
const canonical = (s) =>
  s && s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s;
for (const sf of program
  .getSourceFiles()
  .filter((sf) =>
    path.resolve(sf.fileName).startsWith(path.join(root, "src") + path.sep),
  )) {
  function visit(node) {
    if (ts.isIdentifier(node)) {
      let symbol = ts.isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : checker.getSymbolAtLocation(node);
      symbol = canonical(symbol);
      if (
        symbol &&
        !symbol.declarations?.some((declaration) => declaration.name === node)
      )
        refs.set(symbol, (refs.get(symbol) ?? 0) + 1);
    }
    if (
      ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      const symbol = canonical(checker.getSymbolAtLocation(node.name));
      if (symbol)
        exports.push({ symbol, file: sf.fileName, name: node.name.text });
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

const unusedExports = exports.filter((item) => !refs.get(item.symbol));
if (unusedExports.length) {
  console.error(
    "Unused exports:\n" +
      unusedExports
        .map(({ file, name }) => `${path.relative(root, file)}: ${name}`)
        .join("\n"),
  );
  process.exitCode = 1;
} else console.log("No unused named exports found in application modules.");
