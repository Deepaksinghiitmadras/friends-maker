import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD,
  },
});

// AUTH_URL is already set to https://truefriend.vercel.app on Vercel.
// NEXT_PUBLIC_BASE_URL is an optional override for custom domains.
// Fallback to localhost for local dev only.
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.NODEMAILER_EMAIL || 'deepak.909sgh@gmail.com';

export async function sendVerificationEmail(email: string, otp: string) {
  return transporter.sendMail({
    from: `"TrueFriends" <${process.env.NODEMAILER_EMAIL}>`,
    to: email,
    subject: 'Your TrueFriends verification code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eaeaea; border-radius: 12px;">
        <h2 style="color: #ec4899; margin-top: 0;">Verify your email address</h2>
        <p style="color: #374151; font-size: 15px;">Enter the code below on the TrueFriends registration page to verify your email address.</p>
        <div style="background: linear-gradient(135deg, #fdf2f8, #f5f3ff); border: 2px solid #f9a8d4; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
          <p style="margin: 0; font-size: 42px; font-weight: bold; letter-spacing: 10px; color: #be185d; font-family: monospace;">${otp}</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">Expires in 10 minutes</p>
        </div>
        <p style="font-size: 13px; color: #6b7280;">If you did not create an account on TrueFriends, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${baseUrl}/reset-password?token=${token}`;

  return transporter.sendMail({
    from: `"TrueFriends" <${process.env.NODEMAILER_EMAIL}>`,
    to: email,
    subject: 'Reset your password',
    html: `
      <h1>You have requested to reset your password</h1>
      <p>Click the link below to reset password</p>
      <a href="${link}">Reset password</a>
    `,
  });
}

/**
 * 🔔 Notify Admin when a user uploads/creates a new virtual companion.
 */
export async function sendAdminNewCompanionNotificationEmail(params: {
  userName: string;
  userEmail: string;
  companionName: string;
  companionGender: string;
  companionAge: number;
  companionTitle: string;
  companionPersonality: string;
  companionId: string;
}) {
  try {
    const adminStudioUrl = `${baseUrl}/admin/virtual-companions`;

    return await transporter.sendMail({
      from: `"TrueFriends Studio" <${process.env.NODEMAILER_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: `🔔 New Companion Request: "${params.companionName}" by ${params.userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; rounded-lg: 10px;">
          <h2 style="color: #9333ea; margin-top: 0;">New Virtual Companion Creation Request</h2>
          <p style="color: #4b5563; font-size: 14px;">A user has submitted details and photo for a custom virtual companion.</p>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827; font-size: 16px;">👤 User Details</h3>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Name:</strong> ${params.userName}</p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Email:</strong> <a href="mailto:${params.userEmail}">${params.userEmail}</a></p>
            
            <h3 style="margin-top: 15px; color: #111827; font-size: 16px;">🤖 Companion Details</h3>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Name:</strong> ${params.companionName} (${params.companionGender}, ${params.companionAge} yrs)</p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Title:</strong> ${params.companionTitle}</p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Personality:</strong> ${params.companionPersonality}</p>
          </div>

          <p style="font-size: 13px; color: #6b7280;">Please open the Companion Studio to download reference photos, generate video actions, and make the companion live.</p>
          
          <a href="${adminStudioUrl}" style="display: inline-block; background: linear-gradient(to right, #ec4899, #8b5cf6); color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; font-size: 14px; margin-top: 10px;">
            Open Admin Companion Studio →
          </a>
        </div>
      `,
    });
  } catch (err) {
    console.error('[📧 MAIL] Failed to send admin notification email:', err);
  }
}

/**
 * ✨ Notify User when Admin approves and publishes their custom companion.
 */
export async function sendUserCompanionReadyEmail(params: {
  userEmail: string;
  userName: string;
  companionName: string;
  companionId: string;
}) {
  try {
    if (!params.userEmail || params.userEmail.includes('anonymous')) {
      return;
    }

    const callUrl = `${baseUrl}/virtual/call/${params.companionId}`;

    return await transporter.sendMail({
      from: `"TrueFriends" <${process.env.NODEMAILER_EMAIL}>`,
      to: params.userEmail,
      subject: `✨ Your Virtual Companion "${params.companionName}" is Ready for Video Call!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #ec4899; margin-top: 0;">Your Virtual Companion is Ready!</h2>
          <p style="font-size: 15px; color: #374151;">Hello <strong>${params.userName}</strong>,</p>
          <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
            Your request for virtual companion <strong>"${params.companionName}"</strong> has been processed and approved by our team.
          </p>
          
          <div style="background-color: #fdf2f8; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fbcfe8;">
            <p style="margin: 0; font-size: 14px; color: #831843;">
              🎉 You can now start live 1-on-1 interactive video calls with <strong>${params.companionName}</strong> on TrueFriends!
            </p>
          </div>

          <a href="${callUrl}" style="display: inline-block; background: linear-gradient(to right, #ec4899, #8b5cf6); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 15px;">
            Start Video Call Now →
          </a>

          <p style="font-size: 12px; color: #9ca3af; margin-top: 25px;">
            If you have any questions, feel free to reply to this email. Happy connecting!
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[📧 MAIL] Failed to send user companion ready email:', err);
  }
}

/**
 * 💌 Send AI Companion's Daily Selfie & Morning/Night Voice Note to User.
 */
export async function sendCompanionDailySelfieNoteEmail(params: {
  userEmail: string;
  userName: string;
  companionName: string;
  companionId: string;
  noteType: 'morning' | 'night' | 'surprise';
  message: string;
  selfieUrl: string;
  audioUrl?: string;
}) {
  try {
    if (!params.userEmail || params.userEmail.includes('anonymous')) {
      return;
    }

    const callUrl = `${baseUrl}/virtual/call/${params.companionId}`;
    const subjectEmoji = params.noteType === 'morning' ? '☀️' : params.noteType === 'night' ? '🌙' : '✨';
    const timeTitle = params.noteType === 'morning' ? 'Morning Note & Daily Selfie' : params.noteType === 'night' ? 'Night Check-in & Sweet Dreams' : 'Special Note & Selfie';

    return await transporter.sendMail({
      from: `"${params.companionName} from TrueFriends" <${process.env.NODEMAILER_EMAIL}>`,
      to: params.userEmail,
      subject: `${subjectEmoji} ${params.companionName} sent you a ${timeTitle}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
              ${params.companionName}'s Daily Note
            </span>
            <h2 style="color: #111827; margin: 12px 0 4px 0; font-size: 20px;">
              ${subjectEmoji} ${timeTitle}
            </h2>
            <p style="font-size: 13px; color: #6b7280; margin: 0;">For ${params.userName}</p>
          </div>

          <!-- Selfie Image -->
          <div style="text-align: center; margin: 20px 0;">
            <img src="${params.selfieUrl}" alt="${params.companionName}" style="width: 100%; max-width: 420px; height: auto; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border: 2px solid #f3e8ff; object-fit: cover;" />
          </div>

          <!-- Message Card -->
          <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 18px; margin: 20px 0;">
            <p style="margin: 0; font-size: 15px; color: #581c87; line-height: 1.6; font-style: italic;">
              "${params.message}"
            </p>
          </div>

          <!-- Action Buttons -->
          <div style="text-align: center; margin-top: 25px;">
            <a href="${callUrl}" style="display: inline-block; background: linear-gradient(to right, #ec4899, #8b5cf6); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 14px 0 rgba(236, 72, 153, 0.39);">
              Video Call ${params.companionName} Now 🎥
            </a>
          </div>

          <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 30px 0 15px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
            TrueFriends AI Companion Studio · You received this because you are connected with ${params.companionName}.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[📧 MAIL] Failed to send companion daily selfie note email:', err);
  }
}