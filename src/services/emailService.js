import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromAddress = process.env.SMTP_FROM;

console.log(smtpHost,smtpPort,smtpUser,smtpPass)

let transporter = null;

if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

export async function sendRfpEmail({ to, subject, body }) {
  if (!transporter) {
    throw new Error('SMTP is not configured. Please set SMTP_HOST, SMTP_USER, SMTP_PASS.');
  }

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text: body
  });

  return info;
}


