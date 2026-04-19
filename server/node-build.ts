import * as express from "express";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDatabaseHealthSnapshot, verifyDatabaseConnection } from "./db";
import { createServer } from "./index";
import { logRuntimeValidationSummary, runtimeConfig } from "./runtime";

type StartNodeServerOptions = {
  host?: string;
  port?: number;
  quiet?: boolean;
};

type StartedNodeServer = {
  app: express.Express;
  host: string;
  port: number;
  url: string;
  close: () => Promise<void>;
};

function attachStaticSpa(app: express.Express) {
  const __dirname = import.meta.dirname;
  const distPath = path.join(__dirname, "../spa");

  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
      return next();
    }

    res.sendFile(path.join(distPath, "index.html"));
  });
}

export async function startNodeServer(options: StartNodeServerOptions = {}): Promise<StartedNodeServer> {
  const { errors } = logRuntimeValidationSummary();
  if (errors.length > 0) {
    throw new Error(`Invalid runtime configuration: ${errors.join(" ")}`);
  }

  verifyDatabaseConnection();
  const app = createServer();
  const host = options.host ?? runtimeConfig.host;
  const port = options.port ?? runtimeConfig.port;

  attachStaticSpa(app);

  return await new Promise<StartedNodeServer>((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const address = server.address() as AddressInfo | null;
      const resolvedPort = address?.port ?? port;
      const publicUrl = process.env.APP_URL?.trim().replace(/\/+$/, "");
      const url = publicUrl || `http://${host}:${resolvedPort}`;

      if (!options.quiet) {
        const database = getDatabaseHealthSnapshot();
        console.log(`Smart Queue server running on port ${resolvedPort}`);
        console.log(`Frontend: ${url}`);
        console.log(`API: ${url}/api`);
        console.log(`Health: ${url}/api/health`);
        console.log(`Database: ${database.provider} (${database.location})`);
      }

      resolve({
        app,
        host,
        port: resolvedPort,
        url,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
      });
    });

    server.on("error", reject);
  });
}

const isDirectExecution = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isDirectExecution) {
  const startedServer = await startNodeServer();
  const shutdown = () => {
    startedServer
      .close()
      .catch(() => {})
      .finally(() => process.exit(0));
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
