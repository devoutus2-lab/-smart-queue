import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const corepackCommand = isWindows ? "corepack.cmd" : "corepack";
const nodeCommand = process.execPath;
const electronRebuildCli = "node_modules/.pnpm/@electron+rebuild@4.0.3/node_modules/@electron/rebuild/lib/cli.js";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: isWindows && command.endsWith(".cmd"),
      stdio: "inherit",
      ...options,
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

async function rebuildForElectron() {
  await run(nodeCommand, [electronRebuildCli, "-f", "-w", "better-sqlite3"]);
}

async function rebuildForNode() {
  await run(corepackCommand, ["pnpm", "rebuild", "better-sqlite3"]);
}

async function main() {
  const builderArgs = process.argv.slice(2);

  await run(corepackCommand, ["pnpm", "run", "build"]);
  await rebuildForElectron();

  try {
    await run(corepackCommand, ["pnpm", "exec", "electron-builder", ...builderArgs]);
  } finally {
    await rebuildForNode();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
