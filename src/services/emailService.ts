import nodemailer from 'nodemailer'

export class EmailService {
  private static transporter = process.env.SMTP_USER && process.env.SMTP_PASS
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

  // Welcome email template
  static async sendWelcomeEmail(email: string, firstName: string) {
    try {
      if (!this.transporter) {
        console.warn('SMTP not configured, skipping welcome email')
        return { success: false, message: 'SMTP not configured' }
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3B82F6; margin: 0;">SalonX</h1>
            <p style="color: #6b7280; margin: 5px 0;">Your Beauty Management Platform</p>
          </div>
          
          <h2 style="color: #1f2937; margin-bottom: 20px;">Welcome to SalonX, ${firstName}! 🎉</h2>
          
          <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
            Thank you for joining our beauty management platform. We're excited to help you streamline your salon operations!
          </p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">Get Started:</h3>
            <ul style="color: #374151; margin: 0;">
              <li>Create your first brand</li>
              <li>Add your services and staff</li>
              <li>Start managing appointments</li>
              <li>Track your business analytics</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
               style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
            If you have any questions, feel free to reach out to our support team.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This email was sent to ${email}. If you didn't create an account, please ignore this email.
          </p>
        </div>
      `
      
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL,
        to: email,
        subject: 'Welcome to SalonX! 🎉',
        html
      })
      
      console.log(`✅ Welcome email sent to ${email}`)
      return { success: true, message: 'Welcome email sent successfully' }
    } catch (error) {
      console.error('❌ Error sending welcome email:', error)
      throw error
    }
  }

  // Invitation email template
  static async sendInvitationEmail(email: string, inviterName: string, brandName: string, role: string, invitationLink: string) {
    try {
      if (!this.transporter) {
        console.warn('SMTP not configured, skipping invitation email')
        return { success: false, message: 'SMTP not configured' }
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3B82F6; margin: 0;">SalonX</h1>
            <p style="color: #6b7280; margin: 5px 0;">Your Beauty Management Platform</p>
          </div>
          
          <h2 style="color: #1f2937; margin-bottom: 20px;">You're Invited! 🎉</h2>
          
          <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
            <strong>${inviterName}</strong> has invited you to join <strong>${brandName}</strong> as a <strong>${role}</strong>.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              <strong>Brand:</strong> ${brandName}<br>
              <strong>Your Role:</strong> ${role}<br>
              <strong>Invited by:</strong> ${inviterName}
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              ⏰ <strong>This invitation expires in 7 days.</strong><br>
              If you don't have a SalonX account, you'll be prompted to create one when you accept the invitation.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${invitationLink}" style="color: #3B82F6; word-break: break-all;">${invitationLink}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This invitation was sent by ${inviterName}.<br>
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `
      
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL,
        to: email,
        subject: `You're invited to join ${brandName} on SalonX`,
        html
      })
      
      console.log(`✅ Invitation email sent to ${email}`)
      return { success: true, message: 'Invitation email sent successfully' }
    } catch (error) {
      console.error('❌ Error sending invitation email:', error)
      throw error
    }
  }

  // Password reset email template
  static async sendPasswordResetEmail(email: string, firstName: string, resetLink: string) {
    try {
      if (!this.transporter) {
        console.warn('SMTP not configured, skipping password reset email')
        return { success: false, message: 'SMTP not configured' }
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3B82F6; margin: 0;">SalonX</h1>
            <p style="color: #6b7280; margin: 5px 0;">Your Beauty Management Platform</p>
          </div>
          
          <h2 style="color: #1f2937; margin-bottom: 20px;">Password Reset Request</h2>
          
          <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
            Hello ${firstName},<br><br>
            We received a request to reset your password for your SalonX account.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              ⏰ <strong>This link expires in 1 hour.</strong><br>
              If you didn't request a password reset, please ignore this email.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetLink}" style="color: #3B82F6; word-break: break-all;">${resetLink}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This email was sent to ${email}. If you didn't request this, please ignore this email.
          </p>
        </div>
      `
      
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL,
        to: email,
        subject: 'SalonX - Password Reset Request',
        html
      })
      
      console.log(`✅ Password reset email sent to ${email}`)
      return { success: true, message: 'Password reset email sent successfully' }
    } catch (error) {
      console.error('❌ Error sending password reset email:', error)
      throw error
    }
  }
}
