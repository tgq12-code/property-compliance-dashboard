type SendEmailInput = {
  to: string[];
  subject: string;
  text: string;
  html: string;
};

type ResendErrorResponse = {
  message?: string;
  name?: string;
};

export async function sendReminderEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM_EMAIL || "Vo Family Operations <hello@pointmanstudy.com>",
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ResendErrorResponse;
    throw new Error(error.message || error.name || `Resend returned ${response.status}.`);
  }

  return response.json() as Promise<{ id: string }>;
}
