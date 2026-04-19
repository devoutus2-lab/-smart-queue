import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const targetArg = process.argv[2] || ".data/qless.sqlite";
const targetPath = path.resolve(process.cwd(), targetArg);

if (!fs.existsSync(targetPath)) {
  console.log(`No database found at ${targetPath}; skipping sanitization.`);
  process.exit(0);
}

const db = new Database(targetPath);

try {
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    // Ignore checkpoint errors so cleanup still continues.
  }

  db.exec(`
    DELETE FROM sessions;
    UPDATE users
    SET password_reset_token_hash = NULL,
        password_reset_expires_at = NULL;
  `);

  db.exec("VACUUM;");
  console.log(`Sanitized database at ${targetPath}`);
} finally {
  db.close();
}
