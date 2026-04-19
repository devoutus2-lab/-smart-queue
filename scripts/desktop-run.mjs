import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const isWindows = process.platform === "win32";
const corepackCommand = isWindows ? "corepack.cmd" : "corepack";

function spawnLoggedProcess(command, args, options = {}) {
  return spawn(command, args, {
    cwd: process.cwd(),
    shell: isWindows && command.endsWith(".cmd"),
    stdio: "inherit",
    ...options,
  });
}

function getDesktopExecutablePath() {
  const candidates = process.platform === "win32"
    ? [
        path.join("release-fresh", "win-unpacked", "Smart Queue.exe"),
        path.join("release", "win-unpacked", "Smart Queue.exe"),
        path.join("release", "win-unpacked", "QTech.exe"),
      ]
    : process.platform === "darwin"
      ? [
          path.join("release-fresh", "mac", "Smart Queue.app", "Contents", "MacOS", "Smart Queue"),
          path.join("release", "mac", "Smart Queue.app", "Contents", "MacOS", "Smart Queue"),
        ]
      : [
          path.join("release-fresh", "linux-unpacked", "smart-queue"),
          path.join("release-fresh", "linux-unpacked", "Smart Queue"),
          path.join("release", "linux-unpacked", "smart-queue"),
          path.join("release", "linux-unpacked", "Smart Queue"),
          path.join("release", "linux-unpacked", "qtech"),
          path.join("release", "linux-unpacked", "QTech"),
        ];

  for (const candidate of candidates) {
    const absolutePath = path.resolve(candidate);
    if (existsSync(absolutePath)) return absolutePath;
  }

  throw new Error("Desktop executable was not found after packaging.");
}

async function runPackStep() {
  await new Promise((resolve, reject) => {
    const packProcess = spawnLoggedProcess(corepackCommand, ["pnpm", "run", "desktop:pack"]);
    packProcess.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`desktop:pack exited with code ${code ?? 1}`));
    });
  });
}

async function main() {
  await runPackStep();

  const executablePath = getDesktopExecutablePath();
  const desktopProcess = spawnLoggedProcess(executablePath, [], {
    cwd: path.dirname(executablePath),
  });

  desktopProcess.once("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
