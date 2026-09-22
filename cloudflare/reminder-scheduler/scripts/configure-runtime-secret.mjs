import { spawnSync } from "node:child_process";

const secret = process.env.CRON_SECRET;

if (!secret) {
  console.log("CRON_SECRET is not present; skipping Cloudflare runtime secret setup.");
  process.exit(0);
}

console.log("Connecting the saved CRON_SECRET to the Cloudflare Worker.");

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  command,
  ["wrangler", "secret", "put", "CRON_SECRET"],
  {
    input: `${secret}\n`,
    stdio: ["pipe", "inherit", "inherit"],
    shell: false,
  },
);

if (result.error) {
  console.error("Unable to start Wrangler:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Cloudflare runtime secret is configured.");
