import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  rawOtp: string;
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

    const { rawOtp } = options;

    const otpEmailHtml = `
            <div style="margin:0; padding:0; background:#f4f7fb; width:100%;">
              <div style="display:none; overflow:hidden; opacity:0; max-height:0; max-width:0; mso-hide:all;">
                Your Vault Vogue Lite security code is ready.
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb; padding:32px 16px;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 12px 40px rgba(15,23,42,0.12);">
                      <tr>
                        <td style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #4f46e5 100%); padding:32px 36px; text-align:left;">
                          <div style="font-family:Arial, Helvetica, sans-serif; font-size:12px; letter-spacing:2px; text-transform:uppercase; color:#cbd5e1; margin-bottom:10px;">
                            Vault Vogue Lite
                          </div>
                          <h1 style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:30px; line-height:1.2; color:#ffffff; font-weight:700;">
                            Security Code
                          </h1>
                          <p style="margin:12px 0 0; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#e2e8f0;">
                            Use the one-time code below to finish signing in. It expires in 10 minutes.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:36px; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
                          <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">
                            Hi there,
                          </p>
                          <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155;">
                            Enter this code in the Vault Vogue Lite app to verify your request.
                          </p>
                          <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:16px; padding:24px; text-align:center; margin:0 0 24px;">
                            <div style="font-size:12px; letter-spacing:1.8px; text-transform:uppercase; color:#64748b; margin-bottom:14px;">
                              Your OTP
                            </div>
                            <div style="font-family:'Courier New', Courier, monospace; font-size:40px; line-height:1; letter-spacing:10px; font-weight:700; color:#1d4ed8;">
                              ${rawOtp}
                            </div>
                          </div>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                            <tr>
                              <td style="padding:14px 16px; background:#eff6ff; border-radius:12px; font-size:14px; line-height:1.6; color:#1e3a8a;">
                                For your security, never share this code with anyone. Vault Vogue Lite will never ask for it outside the login flow.
                              </td>
                            </tr>
                          </table>
                          <p style="margin:0; font-size:13px; line-height:1.6; color:#64748b;">
                            If you did not request this code, you can safely ignore this email.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 36px 32px; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:1.6; color:#94a3b8;">
                          This message was sent automatically. Please do not reply to this email.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </div>
          `;

    const info = await mailTransporter.sendMail({
      from: `"Vault Vogue Lite" <${process.env.SMTP_FROM || "no-reply@vaultvoguelite.com"}>`,
      to: options.to,
      subject: "Your Vault Vogue Lite Security Code",
      text: `Vault Vogue Lite Security Code\n\nYour one-time code is: ${rawOtp}\n\nThis code expires in 10 minutes.\n\nFor your security, never share this code with anyone.\nIf you did not request this code, you can safely ignore this email.\n`,
      html: otpEmailHtml,
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
