const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      // Create SMTP transporter
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD, // App password for Gmail
        },
      });

      // Verify connection
      await this.transporter.verify();
      console.log('SMTP transporter initialized successfully');
    } catch (error) {
      console.error('Error initializing SMTP transporter:', error);
      // Don't throw error to allow app to start even if email is not configured
    }
  }

  async sendEmail(options) {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      const mailOptions = {
        from: `${process.env.FROM_NAME || "E-Cell KCCOE"} <${
          process.env.SMTP_USER
        }>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments || [],
        headers: {
          "X-Campaign": options.campaign || "general",
          "X-Template": options.templateId || "custom",
        },
      };

      const result = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
      };
    } catch (error) {
      console.error("Error sending email:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendBulkEmails(emails) {
    const results = [];
    const batchSize = 10; // Process in batches to avoid rate limits

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map((email) => this.sendEmail(email));

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Add delay between batches to respect rate limits
        if (i + batchSize < emails.length) {
          await this.delay(1000); // 1 second delay
        }
      } catch (error) {
        console.error("Error in batch sending:", error);
        results.push({ status: "rejected", reason: error.message });
      }
    }

    return results;
  }

  async testConnection() {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      await this.transporter.verify();
      return { success: true, message: "Gmail connection successful" };
    } catch (error) {
      console.error("Gmail connection test failed:", error);
      return { success: false, error: error.message };
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  processTemplate(template, data) {
    let processedContent = template;

    // Replace placeholders in the format {{key}}
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      processedContent = processedContent.replace(regex, value || "");
    }

    return processedContent;
  }

  generateUnsubscribeLink(userId) {
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return `${baseUrl}/unsubscribe?token=${this.generateUnsubscribeToken(
      userId
    )}`;
  }

  generateUnsubscribeToken(userId) {
    // Simple token generation - in production, use proper JWT or similar
    return Buffer.from(`${userId}:${Date.now()}`).toString("base64");
  }

  addUnsubscribeFooter(htmlContent, userId) {
    const unsubscribeLink = this.generateUnsubscribeLink(userId);
    const footer = `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
        <p>
          This email was sent to you by E-Cell, K.C. College of Engineering.<br>
          If you no longer wish to receive these emails, you can <a href="${unsubscribeLink}" style="color: #007bff;">unsubscribe here</a>.
        </p>
        <p>E-Cell KCCOE, Thane, Maharashtra, India</p>
      </div>
    `;

    return htmlContent + footer;
  }
}

module.exports = new EmailService();
