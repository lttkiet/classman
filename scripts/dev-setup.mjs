import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import spawn from "cross-spawn";
import { setTimeout as delay } from "node:timers/promises";

const envPath = ".env";
const defaults = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/teach_portal?schema=public",
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  SMTP_HOST: "",
  SMTP_PORT: "587",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  SMTP_FROM: "Classman <hello@example.com>",
  BOOTSTRAP_ADMIN_EMAIL: "admin@classman.test",
  BOOTSTRAP_ADMIN_NAME: "Classman Demo Admin",
  BOOTSTRAP_ADMIN_PASSWORD: "ClassmanDev123!",
  BOOTSTRAP_CENTER_NAME: "Classman Demo Center",
};

function parseValue(value = "") {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  return trimmed;
}

function readValues(lines) {
  const values = new Map();
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) values.set(match[1], parseValue(match[2]));
  }
  return values;
}

function writeValue(lines, key, value) {
  const formatted = `${key}=${JSON.stringify(value)}`;
  const indices = lines.map((line, index) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1] === key ? index : -1).filter((index) => index >= 0);
  if (indices.length) lines[indices.at(-1)] = formatted;
  else lines.push(formatted);
}

function assertDevelopmentEnvironment(values) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL || process.env.VERCEL_ENV || process.env.CI === "true") {
    throw new Error("This helper only runs in a local development environment.");
  }
  if (values.get("NODE_ENV") !== "development") throw new Error("NODE_ENV must be development.");
  if (values.get("VERCEL") || values.get("VERCEL_ENV")) throw new Error("Vercel environments are not supported by this local setup helper.");
  for (const key of ["BETTER_AUTH_URL", "APP_URL", "NEXT_PUBLIC_APP_URL"]) {
    const url = new URL(values.get(key));
    if (!new Set(["localhost", "127.0.0.1", "::1"]).has(url.hostname)) throw new Error(`${key} must point to localhost for development setup.`);
  }
  const databaseUrl = new URL(values.get("DATABASE_URL"));
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(databaseUrl.hostname)) throw new Error("DATABASE_URL must point to a local database for development setup.");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env, ...options });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`)));
  });
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function waitForDatabase() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawn.sync("docker", ["compose", "exec", "-T", "db", "pg_isready", "-U", "postgres", "-d", "teach_portal"], { stdio: "ignore" });
    if (result.status === 0) return;
    await delay(1000);
  }
  throw new Error("PostgreSQL did not become ready within 30 seconds.");
}

async function main() {
  if (!existsSync("package.json") || !existsSync("docker-compose.yml")) throw new Error("Run this command from the Classman project root.");
  const initial = existsSync(envPath) ? readFileSync(envPath, "utf8") : readFileSync(".env.example", "utf8");
  const lines = initial.split(/\r?\n/);
  const values = readValues(lines);

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const current = values.get(key);
    const isSecretPlaceholder = key === "BETTER_AUTH_SECRET" && (!current || current.length < 32 || current.startsWith("replace-with-"));
    if (current === undefined || (current === "" && defaultValue !== "") || isSecretPlaceholder) {
      writeValue(lines, key, defaultValue);
      values.set(key, defaultValue);
    }
  }

  assertDevelopmentEnvironment(values);
  writeFileSync(envPath, `${lines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
  Object.assign(process.env, Object.fromEntries(values));
  console.log("Development environment defaults saved to .env.");

  await run("docker", ["compose", "up", "-d", "db"]);
  await waitForDatabase();
  await run(npmCommand(), ["run", "db:generate"]);
  await run(npmCommand(), ["run", "db:deploy"]);

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  let userCount;
  let centerCount;
  try {
    [userCount, centerCount] = await Promise.all([db.user.count(), db.center.count()]);
  } finally {
    await db.$disconnect();
  }

  if (userCount === 0 && centerCount === 0) {
    await run(npmCommand(), ["run", "db:bootstrap"]);
    await run(npmCommand(), ["run", "db:seed"]);
    console.log("Created a local demo center and sample records.");
    console.log(`Development sign-in: ${values.get("BOOTSTRAP_ADMIN_EMAIL")} / ${values.get("BOOTSTRAP_ADMIN_PASSWORD")}`);
  } else {
    console.log("Existing database accounts or center found; kept them and skipped demo bootstrap and seeding.");
  }

  console.log("Setup complete. Start Classman with npm run dev.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
