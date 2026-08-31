import { Resend } from "resend";

export async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Traviz <onboarding@resend.dev>",
    to: email,
    subject: "Sign in to Traviz",
    html: `<p>Click the link below to sign in to Traviz:</p><p><a href="${url}">${url}</a></p><p>This link expires shortly and can only be used once.</p>`,
  });
}
