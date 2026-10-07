import nodemailer from "nodemailer";

const getTransport = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
};

export async function sendEmail(to: string, subject: string, text: string) {
  const transport = getTransport();
  if (!transport) {
    if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
    console.info(`Email preview for ${to}: ${subject}\n${text}`);
    return;
  }
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
}
