const fs = require("fs");
const { execSync } = require("child_process");

const prodEnv = fs.readFileSync(".env.production.local", "utf8");
const lines = prodEnv.split("\n");
const envVars = {};

for (const line of lines) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    envVars[match[1]] = val;
  }
}

const dbUrl = envVars.POSTGRES_PRISMA_URL || envVars.DATABASE_URL || envVars.POSTGRES_URL;

console.log("Found database connection URL. Pushing schema to remote PostgreSQL...");
try {
  execSync("npx prisma db push", {
    env: { ...process.env, ...envVars, DATABASE_URL: dbUrl },
    stdio: "inherit",
  });
  console.log("\n✔ Remote database schema is successfully synchronized!");
} catch (e) {
  console.error("DB push error:", e.message);
}
