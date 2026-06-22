/**
 * Transactional email for the editorial workflow.
 *
 * Emails are sent through Resend's HTTP API (no extra npm dependency required).
 * Configure these environment variables on the Netlify site:
 *
 *   RESEND_API_KEY   API key from https://resend.com (required to actually send)
 *   MAIL_FROM        Verified sender, e.g. "ERPI Editorial <no-reply@your-domain>"
 *   EDITORIAL_EMAIL  Address that receives new-submission notifications
 *
 * Sending is best-effort: if RESEND_API_KEY is absent or the provider call
 * fails, we log and continue so a submission is never lost because of email.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export const EDITORIAL_EMAIL = process.env.EDITORIAL_EMAIL || "editors@serpi-journal.org";
const MAIL_FROM = process.env.MAIL_FROM || `ERPI Editorial Office <${EDITORIAL_EMAIL}>`;

/** Build the public-facing submission reference from the database id. */
export function referenceId(id: number): string {
  return "ERPI-" + String(id).padStart(5, "0");
}

interface SendArgs {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
}

async function send({ to, subject, text, replyTo }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email "${subject}" to ${Array.isArray(to) ? to.join(", ") : to}`);
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Provider returned ${res.status}: ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Failed to send:", err);
    return false;
  }
}

interface SubmissionInfo {
  id: number;
  title: string;
  authors: string;
  paperType: string;
  submitterName: string;
  submitterEmail: string;
  institution?: string | null;
}

/**
 * Notify the editorial office of a new submission and send the corresponding
 * author a confirmation that includes their reference id. Runs both sends
 * concurrently and never throws.
 */
export async function notifyNewSubmission(info: SubmissionInfo): Promise<void> {
  const ref = referenceId(info.id);

  const editorText =
    `A new manuscript has been submitted to Economic and Regional Policy Interactions.\n\n` +
    `Reference:        ${ref}\n` +
    `Title:            ${info.title}\n` +
    `Manuscript type:  ${info.paperType}\n` +
    `Authors:          ${info.authors}\n` +
    `Corresponding:    ${info.submitterName} <${info.submitterEmail}>\n` +
    `Institution:      ${info.institution || "—"}\n\n` +
    `Open the editorial console to review the manuscript and update its status.`;

  const authorText =
    `Dear ${info.submitterName},\n\n` +
    `Thank you for submitting your manuscript to Economic and Regional Policy Interactions. ` +
    `We confirm that it has been received by the editorial office.\n\n` +
    `Your submission reference is ${ref}. Please quote this reference in any correspondence.\n\n` +
    `Title: ${info.title}\n\n` +
    `Each submission is first screened editorially and then, if suitable, sent for ` +
    `double-anonymized peer review by at least two independent experts. You can expect an ` +
    `initial editorial decision within 5–10 business days, and you will be notified at every ` +
    `stage of the process.\n\n` +
    `With thanks,\n` +
    `The Editorial Office\n` +
    `Economic and Regional Policy Interactions`;

  await Promise.allSettled([
    send({
      to: EDITORIAL_EMAIL,
      subject: `New submission ${ref}: ${info.title}`,
      text: editorText,
      replyTo: info.submitterEmail,
    }),
    send({
      to: info.submitterEmail,
      subject: `Submission received — reference ${ref}`,
      text: authorText,
      replyTo: EDITORIAL_EMAIL,
    }),
  ]);
}
