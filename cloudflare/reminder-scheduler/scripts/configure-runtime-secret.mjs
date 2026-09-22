import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET must be configured in Cloudflare build variables.");
  process.exit(1);
}

function runWrangler(args, options = {}) {
  const result = spawnSync(command, ["wrangler", ...args], {
    stdio: options.input
      ? ["pipe", "inherit", "inherit"]
      : "inherit",
    input: options.input,
    shell: false,
  });

  if (result.error) {
    console.error("Unable to start Wrangler:", result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Connecting the saved scheduler secret to the Worker.");
runWrangler(["secret", "put", "CRON_SECRET"], {
  input: `${secret}\n`,
});

console.log("Deploying the reminder scheduler.");
runWrangler(["deploy"]);

console.log("Reminder scheduler deployment completed.");
