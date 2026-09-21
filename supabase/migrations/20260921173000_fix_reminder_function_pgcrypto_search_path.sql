-- Allow reminder SECURITY DEFINER functions to resolve pgcrypto.digest.
-- pgcrypto is installed in the extensions schema in hosted Supabase.

alter function public.claim_due_family_reminders(text, integer)
  set search_path = public, extensions;

alter function public.claim_due_obligation_reminders(text, integer)
  set search_path = public, extensions;

alter function public.complete_family_reminder_send(text, uuid, timestamptz, timestamptz, boolean)
  set search_path = public, extensions;

alter function public.fail_family_reminder_send(text, uuid, text)
  set search_path = public, extensions;

alter function public.complete_obligation_reminder_send(text, uuid, timestamptz)
  set search_path = public, extensions;

alter function public.fail_obligation_reminder_send(text, uuid, text)
  set search_path = public, extensions;
