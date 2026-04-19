import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const handoffDir = path.join(rootDir, "handoff");
const sourceDir = path.join(handoffDir, "source");
const runnableDir = path.join(handoffDir, "runnable");
const distDir = path.join(rootDir, "dist");
const dataDbPath = path.join(rootDir, ".data", "qless.sqlite");

const sourceDirectories = ["client", "server", "shared", "public", "netlify", "scripts"];
const sourceFiles = [
  ".dockerignore",
  ".env.example",
  ".gitignore",
  ".npmrc",
  ".prettierrc",
  "AGENTS.md",
  "HANDOFF.md",
  "README.md",
  "components.json",
  "index.html",
  "netlify.toml",
  "package.json",
  "pnpm-lock.yaml",
  "postcss.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
  "vite.config.server.ts",
  "vite.config.ts",
  "vitest.config.ts",
];
const forbiddenSourceEntries = ["node_modules", "dist", "handoff", ".data"];
const forbiddenSourceFilePatterns = [/\.sqlite-(shm|wal)$/i];

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function pruneForbiddenArtifacts(rootPath, entryNames) {
  for (const entryName of entryNames) {
    removePath(path.join(rootPath, entryName));
  }
}

function pruneForbiddenFiles(rootPath, patterns) {
  if (!fs.existsSync(rootPath)) {
    return;
  }

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      pruneForbiddenFiles(entryPath, patterns);
      continue;
    }

    if (patterns.some((pattern) => pattern.test(entry.name))) {
      removePath(entryPath);
    }
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyPath(relativePath, destinationRoot) {
  const sourcePath = path.join(rootDir, relativePath);
  const destinationPath = path.join(destinationRoot, relativePath);

  if (!fs.existsSync(sourcePath)) {
    return;
  }

  ensureDir(path.dirname(destinationPath));
  fs.cpSync(sourcePath, destinationPath, { recursive: true });
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function createRunnablePackageJson(rootPackage) {
  const dependencies = {
    bcryptjs: rootPackage.dependencies.bcryptjs,
    "better-sqlite3": rootPackage.dependencies["better-sqlite3"],
    cors: rootPackage.devDependencies.cors,
    dotenv: rootPackage.dependencies.dotenv,
    "drizzle-orm": rootPackage.dependencies["drizzle-orm"],
    express: rootPackage.dependencies.express,
    zod: rootPackage.dependencies.zod,
  };

  return {
    name: "qtech-runnable",
    private: true,
    type: "module",
    engines: rootPackage.engines,
    pnpm: rootPackage.pnpm,
    packageManager: rootPackage.packageManager,
    scripts: {
      start: "node dist/server/node-build.mjs",
    },
    dependencies,
  };
}

function createSourceHandoffNotes() {
  return `# Source Package

This folder is the maintenance-friendly source handoff.

## Included
- app source code
- pnpm lockfile
- environment template
- build, test, and handoff scripts

## Excluded
- node_modules
- dist output
- local runtime databases
- temporary WAL/SHM files
- machine-specific secrets

## First Run
1. Install Node.js 22 or newer.
2. Run \`corepack pnpm install --frozen-lockfile\`.
3. Copy \`.env.example\` to \`.env\` if you need optional integrations.
4. Run \`corepack pnpm dev\` or \`corepack pnpm build\`.

## Open in VS Code
Open this \`source\` folder itself in VS Code if you will maintain or extend the application.

## Recommended USB Use
Copy this \`source\` folder and the sibling \`runnable\` folder to USB. Do not prioritize the raw working repo, local \`node_modules\`, local \`dist\`, or temporary database files for transfer.
`;
}

function createRunnableHandoffNotes() {
  return `# Runnable Package

This folder is the smaller demo/run handoff.

## First Run
1. Install Node.js 22 or newer.
2. Run \`corepack pnpm install --prod\`.
3. Copy \`.env.example\` to \`.env\` only if you want optional external integrations.
4. Run \`corepack pnpm start\`.

The packaged SQLite database is sanitized demo data. The app also supports a fresh local database by setting \`QTECH_DATA_DIR\` or deleting the packaged \`.data\` folder before first launch.

## Open in VS Code
Open this \`runnable\` folder itself in VS Code if you mainly want to install and run the prepared package.

## Recommended USB Use
Copy this \`runnable\` folder and the sibling \`source\` folder to USB. Do not prioritize the raw working repo, local \`node_modules\`, local \`dist\`, or temporary database files for transfer.
`;
}

if (!fs.existsSync(distDir)) {
  throw new Error("Missing dist/ output. Run `pnpm build` before creating the handoff packages.");
}

const rootPackage = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

fs.rmSync(handoffDir, { recursive: true, force: true });
ensureDir(sourceDir);
ensureDir(runnableDir);

for (const relativePath of sourceDirectories) {
  copyPath(relativePath, sourceDir);
}

for (const relativePath of sourceFiles) {
  copyPath(relativePath, sourceDir);
}

pruneForbiddenArtifacts(sourceDir, forbiddenSourceEntries);
pruneForbiddenFiles(sourceDir, forbiddenSourceFilePatterns);
writeText(path.join(sourceDir, "HANDOFF.md"), createSourceHandoffNotes());

copyPath("dist", runnableDir);
copyPath(".env.example", runnableDir);
copyPath("README.md", runnableDir);

if (fs.existsSync(dataDbPath)) {
  const runnableDbPath = path.join(runnableDir, ".data", "qless.sqlite");
  ensureDir(path.dirname(runnableDbPath));
  fs.copyFileSync(dataDbPath, runnableDbPath);
  execFileSync(process.execPath, [path.join(rootDir, "scripts", "sanitize-db.mjs"), runnableDbPath], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

writeText(
  path.join(runnableDir, "package.json"),
  `${JSON.stringify(createRunnablePackageJson(rootPackage), null, 2)}\n`,
);
pruneForbiddenFiles(runnableDir, forbiddenSourceFilePatterns);
writeText(path.join(runnableDir, "HANDOFF.md"), createRunnableHandoffNotes());

console.log(`Created handoff packages in ${handoffDir}`);
