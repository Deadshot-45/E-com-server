import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Configure Nodemailer transport.
 * If SMTP settings are missing, it logs the email to the console for development.
 */
let transporter: nodemailer.Transporter | null = null;

const createTransporter = async () => {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    // Use real SMTP credentials if provided
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      // port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465 || true, // true for port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Generate an Ethereal test account for local development if no credentials exist
    // console.warn(
    //   "⚠️ No SMTP credentials found in .env. Using mock email output.",
    // );
    // const testAccount = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
};

export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  try {
    const mailTransporter = await createTransporter();

    const info = await mailTransporter.sendMail({
      from: `"Vault Vogue Lite" <${process.env.SMTP_FROM || "no-reply@vaultvoguelite.com"}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    // Log the preview URL if using Ethereal, or normal message if using real SMTP
    if (process.env.SMTP_HOST) {
      console.log(
        `✉️ Email sent to ${options.to} (Message ID: ${info.messageId})`,
      );
    } else {
      console.log(`✉️ Mock Email sent to ${options.to}`);
      console.log(`✉️ Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};
