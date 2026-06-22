/**
 * Transactional email for the editorial workflow.
 *
 * Emails are sent through Resend's HTTP API (no extra npm dependency required).
 * Configure these environment variables on the Netlify site:
 *
 *   RESEND_API_KEY   API key from https://resend.com (required to actually send)
 *   MAIL_FROM        Verified sender, e.g. "ERPI Editorial <no-reply@your-domain>"
 *   EDITORIAL_EMAIL  Address that receives notifications (never exposed to clients)
 *
 * Sending is best-effort: if RESEND_API_KEY is absent or the provider call
 * fails, we log and continue so a submission is never lost because of email.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export const EDITORIAL_EMAIL = process.env.EDITORIAL_EMAIL || "editorial@serpi-journals.netlify.app";
const MAIL_FROM = process.env.MAIL_FROM || `ERPI Editorial Office <${EDITORIAL_EMAIL}>`;

interface SendArgs {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
}

/** Low-level send. Returns true on success, false if skipped or failed. */
export async function sendEmail({ to, subject, text, replyTo }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email "${subject}"`);
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
  reference: string;
  title: string;
  authors: string;
  paperType: string;
  submitterName: string;
  submitterEmail: string;
  institution?: string | null;
}

/**
 * Notify the editorial office of a new submission. Reply-to is set to the
 * corresponding author so the editor can contact them manually. No email is
 * sent to the author — confirmation happens only on the submission screen.
 * Never throws.
 */
export async function notifyNewSubmission(info: SubmissionInfo): Promise<void> {
  const editorText =
    `A new manuscript has been submitted to Economic and Regional Policy Interactions.\n\n` +
    `Reference:        ${info.reference}\n` +
    `Title:            ${info.title}\n` +
    `Manuscript type:  ${info.paperType}\n` +
    `Authors:          ${info.authors}\n` +
    `Corresponding:    ${info.submitterName} <${info.submitterEmail}>\n` +
    `Institution:      ${info.institution || "—"}\n\n` +
    `Open the editorial console to review the manuscript and update its status.`;

  await sendEmail({
    to: EDITORIAL_EMAIL,
    subject: `New submission ${info.reference}: ${info.title}`,
    text: editorText,
    replyTo: info.submitterEmail,
  }).catch(() => false);
}

interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Forward a contact-form message to the editorial office, with reply-to set to
 * the sender so the editor can reply directly. The destination address is
 * never returned to the client.
 */
export async function sendContactMessage(msg: ContactMessage): Promise<boolean> {
  const text =
    `New message via the editorial contact form.\n\n` +
    `From:    ${msg.name} <${msg.email}>\n` +
    `Subject: ${msg.subject}\n\n` +
    `${msg.message}\n`;

  return sendEmail({
    to: EDITORIAL_EMAIL,
    subject: `Contact form: ${msg.subject}`,
    text,
    replyTo: msg.email,
  });
}
