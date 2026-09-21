export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runReminderCheck(env));
  },
};

async function runReminderCheck(env) {
  if (!env.REMINDER_ENDPOINT || !env.CRON_SECRET) {
    throw new Error("REMINDER_ENDPOINT and CRON_SECRET must be configured.");
  }

  const response = await fetch(env.REMINDER_ENDPOINT, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      "User-Agent": "vo-family-reminder-scheduler/1.0",
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Reminder check failed (${response.status}): ${body.slice(0, 500)}`);
  }

  console.log(JSON.stringify({
    event: "vo_family_reminder_check_completed",
    status: response.status,
    result: body.slice(0, 1000),
  }));
}
