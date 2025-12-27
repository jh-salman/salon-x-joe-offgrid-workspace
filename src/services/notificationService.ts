import nodemailer from 'nodemailer'
import twilio from 'twilio'

// Email transporter (only initialize if credentials are provided)
const emailTransporter = process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null

// Twilio client (only initialize if credentials are provided)
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null

export class NotificationService {
  // Send OTP via Email
  static async sendOTPEmail(email: string, otp: string, purpose: string) {
    try {
      // Always try to send real email first
      if (emailTransporter) {
        const subject = 'SalonX - OTP Verification'
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3B82F6; margin: 0;">SalonX</h1>
              <p style="color: #6b7280; margin: 5px 0;">Your Beauty Management Platform</p>
            </div>
            
            <h2 style="color: #1f2937; margin-bottom: 20px;">OTP Verification</h2>
            
            <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
              Hello! You requested an OTP for ${purpose.replace('_', ' ').toLowerCase()}.
            </p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px;">Your verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 5px; margin: 10px 0;">${otp}</div>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
              ⏰ This code will expire in <strong>5 minutes</strong>.
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
              🔒 If you didn't request this code, please ignore this email and your account will remain secure.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              This is an automated message from SalonX. Please do not reply to this email.
            </p>
          </div>
        `

        await emailTransporter.sendMail({
          from: `"SalonX" <${process.env.SMTP_USER}>`,
          to: email,
          subject,
          html
        })

        console.log(`✅ Real OTP email sent to ${email}`)
        return
      }

      // Fallback: Log OTP if email not configured
      console.log(`📧 Email OTP for ${email}: ${otp} (Email not configured)`)
    } catch (error) {
      console.error('❌ Failed to send OTP email:', error)
      // Fallback: Log OTP if email fails
      console.log(`📧 Email OTP for ${email}: ${otp} (Email failed, using fallback)`)
    }
  }

  // Send OTP via SMS
  static async sendOTPSMS(phone: string, otp: string, purpose: string, country: string) {
    try {
      // Always try to send real SMS first
      if (twilioClient) {
        // Format phone number based on country
        let formattedPhone = phone
        if (country === 'BD' && !phone.startsWith('+880')) {
          formattedPhone = `+880${phone.replace(/^0/, '')}`
        } else if (country === 'USA' && !phone.startsWith('+1')) {
          formattedPhone = `+1${phone}`
        }

        const purposeText = purpose.replace('_', ' ').toLowerCase()
        const message = `SalonX OTP: ${otp}\n\nThis code is for ${purposeText}.\nExpires in 5 minutes.\n\nIf you didn't request this, please ignore.`

        await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: formattedPhone
        })

        console.log(`✅ Real OTP SMS sent to ${formattedPhone}`)
        return
      }

      // Fallback: Log OTP if SMS not configured
      console.log(`📱 SMS OTP: ${otp} (Twilio not configured)`)
    } catch (error) {
      console.error('❌ Failed to send OTP SMS:', error)
      // Fallback: Log OTP if SMS fails
      console.log(`📱 SMS OTP: ${otp} (SMS failed, using fallback)`)
    }
  }

  // Send Password Reset Email
  static async sendPasswordResetEmail(email: string, resetToken: string) {
    try {
      // Always try to send real email first
      if (emailTransporter) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
        
        const subject = 'SalonX - Password Reset Request'
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3B82F6; margin: 0;">SalonX</h1>
              <p style="color: #6b7280; margin: 5px 0;">Your Beauty Management Platform</p>
            </div>
            
            <h2 style="color: #1f2937; margin-bottom: 20px;">Password Reset Request</h2>
            
            <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
              Hello! We received a request to reset your password for your SalonX account.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #3B82F6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                Reset My Password
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
              ⏰ This link will expire in <strong>15 minutes</strong>.
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
              🔒 If you didn't request this password reset, please ignore this email and your account will remain secure.
            </p>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                <strong>Security Tip:</strong> Never share this link with anyone. SalonX will never ask for your password via email.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              This is an automated message from SalonX. Please do not reply to this email.
            </p>
          </div>
        `

        await emailTransporter.sendMail({
          from: `"SalonX" <${process.env.SMTP_USER}>`,
          to: email,
          subject,
          html
        })

        console.log(`✅ Real password reset email sent to ${email}`)
        return
      }

      // Fallback: Log reset token if email not configured
      console.log(`📧 Password reset for ${email}: ${resetToken} (Email not configured)`)
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error)
      // Fallback: Log reset token if email fails
      console.log(`📧 Password reset for ${email}: ${resetToken} (Email failed, using fallback)`)
    }
  }
}