import { Resend } from "resend";

export async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      `RESEND_FROM_EMAIL is not set, expected a value like "Traviz <noreply@example.com>"`,
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from,
    to: email,
    subject: "Sign in to Traviz",
    html: `<p>Click the link below to sign in to Traviz:</p><p><a href="${url}">${url}</a></p><p>This link expires shortly and can only be used once.</p>`,
  });
}
