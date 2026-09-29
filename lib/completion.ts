export function completionLabel(value: string, email?: string | null) {
  const when = new Date(value).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/Los_Angeles", timeZoneName: "short",
  });
  return `Completed${email ? ` by ${email}` : ""} · ${when}`;
}
