import { spawn } from "node:child_process";
import process from "node:process";

const DEV_SERVER_URL = "http://127.0.0.1:8080";
const isWindows = process.platform === "win32";
const corepackCommand = isWindows ? "corepack.cmd" : "corepack";

let shuttingDown = false;
let viteProcess = null;
let electronProcess = null;

function spawnLoggedProcess(command, args, extraEnv = {}) {
  return spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
    },
    shell: isWindows && command.endsWith(".cmd"),
    stdio: "inherit",
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
      lastError = new Error(`Server responded with status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill("SIGTERM");
  }

  if (viteProcess && !viteProcess.killed) {
    viteProcess.kill("SIGTERM");
  }

  setTimeout(() => process.exit(exitCode), 250);
}

async function main() {
  viteProcess = spawnLoggedProcess(corepackCommand, ["pnpm", "dev", "--", "--host", "127.0.0.1", "--port", "8080"]);

  viteProcess.once("exit", (code) => {
    if (shuttingDown) return;
    console.error(`Vite dev server exited early with code ${code ?? 0}.`);
    shutdown(code ?? 1);
  });

  await waitForServer(DEV_SERVER_URL);

  electronProcess = spawnLoggedProcess(
    corepackCommand,
    ["pnpm", "exec", "electron", "."],
    { QTECH_ELECTRON_DEV_SERVER_URL: DEV_SERVER_URL },
  );

  electronProcess.once("exit", (code) => {
    shutdown(code ?? 0);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
});
