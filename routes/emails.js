const express = require("express");
const User = require("../models/User");
const Template = require("../models/Template");
const EmailLog = require("../models/EmailLog");
const { auth } = require("../middleware/auth");
const gmailService = require("../services/gmailService");

const router = express.Router();

// Send email to single user
router.post("/send", auth, async (req, res) => {
  try {
    const {
      recipientEmail,
      subject,
      htmlContent,
      textContent,
      templateId,
      templateData = {},
      campaign = "manual",
    } = req.body;

    if (!recipientEmail || !subject) {
      return res
        .status(400)
        .json({ error: "Recipient email and subject are required." });
    }

    let finalSubject = subject;
    let finalHtmlContent = htmlContent;
    let finalTextContent = textContent;
    let template = null;

    // If using template, process it
    if (templateId) {
      template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found." });
      }

      finalSubject = gmailService.processTemplate(
        template.subject,
        templateData
      );
      finalHtmlContent = gmailService.processTemplate(
        template.htmlContent,
        templateData
      );
      finalTextContent = template.textContent
        ? gmailService.processTemplate(template.textContent, templateData)
        : "";

      // Increment template usage count
      template.usageCount += 1;
      await template.save();
    }

    // Find user for unsubscribe link
    const user = await User.findOne({ email: recipientEmail });
    if (user && finalHtmlContent) {
      finalHtmlContent = gmailService.addUnsubscribeFooter(
        finalHtmlContent,
        user._id
      );
    }

    // Send email
    const emailResult = await gmailService.sendEmail({
      to: recipientEmail,
      subject: finalSubject,
      html: finalHtmlContent,
      text: finalTextContent,
      templateId: templateId,
      campaign: campaign,
    });

    // Log email
    const emailLog = new EmailLog({
      recipients: [
        {
          email: recipientEmail,
          userId: user?._id,
          status: emailResult.success ? "sent" : "failed",
          errorMessage: emailResult.success ? undefined : emailResult.error,
          sentAt: emailResult.success ? new Date() : undefined,
        },
      ],
      subject: finalSubject,
      htmlContent: finalHtmlContent,
      textContent: finalTextContent,
      templateId: templateId,
      templateData: templateData,
      sentBy: req.admin._id,
      campaign: campaign,
      totalRecipients: 1,
      successCount: emailResult.success ? 1 : 0,
      failureCount: emailResult.success ? 0 : 1,
    });

    await emailLog.save();

    if (emailResult.success) {
      res.json({
        message: "Email sent successfully",
        emailLogId: emailLog._id,
        messageId: emailResult.messageId,
      });
    } else {
      res.status(500).json({
        error: "Failed to send email",
        details: emailResult.error,
        emailLogId: emailLog._id,
      });
    }
  } catch (error) {
    console.error("Send email error:", error);
    res.status(500).json({ error: "Server error sending email." });
  }
});

// Send bulk emails
router.post("/send-bulk", auth, async (req, res) => {
  try {
    const {
      recipients, // Array of { email, templateData }
      subject,
      htmlContent,
      textContent,
      templateId,
      defaultTemplateData = {},
      campaign = "bulk",
      filters = {}, // For user filtering
    } = req.body;

    let recipientList = recipients || [];

    // If no recipients provided, use filters to get users
    if (!recipients || recipients.length === 0) {
      const users = await User.find({
        isSubscribed: true,
        ...filters,
      }).select("email firstName lastName");

      recipientList = users.map((user) => ({
        email: user.email,
        templateData: {
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: `${user.firstName} ${user.lastName}`,
          ...defaultTemplateData,
        },
      }));
    }

    if (recipientList.length === 0) {
      return res.status(400).json({ error: "No recipients found." });
    }

    let template = null;
    if (templateId) {
      template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found." });
      }
    }

    // Prepare emails for bulk sending
    const emailsToSend = await Promise.all(
      recipientList.map(async (recipient) => {
        let finalSubject = subject;
        let finalHtmlContent = htmlContent;
        let finalTextContent = textContent;

        const combinedTemplateData = {
          ...defaultTemplateData,
          ...recipient.templateData,
        };

        if (template) {
          finalSubject = gmailService.processTemplate(
            template.subject,
            combinedTemplateData
          );
          finalHtmlContent = gmailService.processTemplate(
            template.htmlContent,
            combinedTemplateData
          );
          finalTextContent = template.textContent
            ? gmailService.processTemplate(
                template.textContent,
                combinedTemplateData
              )
            : "";
        } else if (finalSubject && finalHtmlContent) {
          finalSubject = gmailService.processTemplate(
            finalSubject,
            combinedTemplateData
          );
          finalHtmlContent = gmailService.processTemplate(
            finalHtmlContent,
            combinedTemplateData
          );
          if (finalTextContent) {
            finalTextContent = gmailService.processTemplate(
              finalTextContent,
              combinedTemplateData
            );
          }
        }

        // Add unsubscribe footer
        const user = await User.findOne({ email: recipient.email });
        if (user && finalHtmlContent) {
          finalHtmlContent = gmailService.addUnsubscribeFooter(
            finalHtmlContent,
            user._id
          );
        }

        return {
          to: recipient.email,
          subject: finalSubject,
          html: finalHtmlContent,
          text: finalTextContent,
          templateId: templateId,
          campaign: campaign,
          userId: user?._id,
        };
      })
    );

    // Send emails in batches
    const results = await gmailService.sendBulkEmails(emailsToSend);

    // Process results and create email log
    const emailLogRecipients = results.map((result, index) => {
      const email = emailsToSend[index];
      const isSuccess = result.status === "fulfilled" && result.value.success;

      return {
        email: email.to,
        userId: email.userId,
        status: isSuccess ? "sent" : "failed",
        errorMessage: isSuccess
          ? undefined
          : result.status === "rejected"
          ? result.reason
          : result.value.error,
        sentAt: isSuccess ? new Date() : undefined,
      };
    });

    const successCount = emailLogRecipients.filter(
      (r) => r.status === "sent"
    ).length;
    const failureCount = emailLogRecipients.length - successCount;

    const emailLog = new EmailLog({
      recipients: emailLogRecipients,
      subject: template ? template.subject : subject,
      htmlContent: template ? template.htmlContent : htmlContent,
      textContent: template ? template.textContent : textContent,
      templateId: templateId,
      templateData: defaultTemplateData,
      sentBy: req.admin._id,
      campaign: campaign,
      totalRecipients: recipientList.length,
      successCount: successCount,
      failureCount: failureCount,
    });

    await emailLog.save();

    // Update template usage count
    if (template) {
      template.usageCount += successCount;
      await template.save();
    }

    res.json({
      message: `Bulk email operation completed`,
      emailLogId: emailLog._id,
      totalRecipients: recipientList.length,
      successCount: successCount,
      failureCount: failureCount,
      successRate:
        ((successCount / recipientList.length) * 100).toFixed(2) + "%",
    });
  } catch (error) {
    console.error("Send bulk email error:", error);
    res.status(500).json({ error: "Server error sending bulk emails." });
  }
});

// Get email logs
router.get("/logs", auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      campaign = "",
      templateId = "",
      startDate = "",
      endDate = "",
      status = "",
    } = req.query;

    const filter = {};

    if (campaign) filter.campaign = campaign;
    if (templateId) filter.templateId = templateId;
    if (status) filter["recipients.status"] = status;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, totalLogs] = await Promise.all([
      EmailLog.find(filter)
        .populate("templateId", "name type")
        .populate("sentBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      EmailLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalLogs / parseInt(limit));

    res.json({
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalLogs,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Get email logs error:", error);
    res.status(500).json({ error: "Server error fetching email logs." });
  }
});

// Get email log details
router.get("/logs/:id", auth, async (req, res) => {
  try {
    const log = await EmailLog.findById(req.params.id)
      .populate("templateId", "name type subject")
      .populate("sentBy", "name email")
      .populate("recipients.userId", "firstName lastName email");

    if (!log) {
      return res.status(404).json({ error: "Email log not found." });
    }

    res.json({ log });
  } catch (error) {
    console.error("Get email log error:", error);
    res.status(500).json({ error: "Server error fetching email log." });
  }
});

// Get email statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [
      totalEmailsSent,
      totalRecipients,
      successfulEmails,
      failedEmails,
      campaignStats,
      templateStats,
      dailyStats,
    ] = await Promise.all([
      EmailLog.countDocuments({ createdAt: { $gte: startDate } }),
      EmailLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: "$totalRecipients" } } },
      ]),
      EmailLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: "$successCount" } } },
      ]),
      EmailLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: "$failureCount" } } },
      ]),
      EmailLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: "$campaign",
            count: { $sum: 1 },
            totalRecipients: { $sum: "$totalRecipients" },
            successCount: { $sum: "$successCount" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      EmailLog.aggregate([
        {
          $match: { createdAt: { $gte: startDate }, templateId: { $ne: null } },
        },
        {
          $lookup: {
            from: "templates",
            localField: "templateId",
            foreignField: "_id",
            as: "template",
          },
        },
        { $unwind: "$template" },
        {
          $group: {
            _id: "$templateId",
            templateName: { $first: "$template.name" },
            count: { $sum: 1 },
            totalRecipients: { $sum: "$totalRecipients" },
            successCount: { $sum: "$successCount" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      EmailLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            emailCount: { $sum: 1 },
            recipientCount: { $sum: "$totalRecipients" },
            successCount: { $sum: "$successCount" },
            failureCount: { $sum: "$failureCount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),
    ]);

    const totalRecipientsCount = totalRecipients[0]?.total || 0;
    const successfulEmailsCount = successfulEmails[0]?.total || 0;
    const failedEmailsCount = failedEmails[0]?.total || 0;
    const successRate =
      totalRecipientsCount > 0
        ? ((successfulEmailsCount / totalRecipientsCount) * 100).toFixed(2)
        : 0;

    res.json({
      overview: {
        totalEmailsSent,
        totalRecipients: totalRecipientsCount,
        successfulEmails: successfulEmailsCount,
        failedEmails: failedEmailsCount,
        successRate: parseFloat(successRate),
      },
      campaignStats,
      templateStats,
      dailyStats: dailyStats.map((stat) => ({
        date: `${stat._id.year}-${String(stat._id.month).padStart(
          2,
          "0"
        )}-${String(stat._id.day).padStart(2, "0")}`,
        emailCount: stat.emailCount,
        recipientCount: stat.recipientCount,
        successCount: stat.successCount,
        failureCount: stat.failureCount,
        successRate:
          stat.recipientCount > 0
            ? ((stat.successCount / stat.recipientCount) * 100).toFixed(2)
            : 0,
      })),
      period,
    });
  } catch (error) {
    console.error("Get email stats error:", error);
    res.status(500).json({ error: "Server error fetching email statistics." });
  }
});

// Test email connection
router.get("/test-connection", auth, async (req, res) => {
  try {
    const result = await gmailService.testConnection();
    res.json(result);
  } catch (error) {
    console.error("Test connection error:", error);
    res.status(500).json({ error: "Server error testing email connection." });
  }
});

// Resend failed emails
router.post("/resend-failed/:logId", auth, async (req, res) => {
  try {
    const emailLog = await EmailLog.findById(req.params.logId);

    if (!emailLog) {
      return res.status(404).json({ error: "Email log not found." });
    }

    const failedRecipients = emailLog.recipients.filter(
      (r) => r.status === "failed"
    );

    if (failedRecipients.length === 0) {
      return res.status(400).json({ error: "No failed emails to resend." });
    }

    // Prepare emails for resending
    const emailsToResend = failedRecipients.map((recipient) => ({
      to: recipient.email,
      subject: emailLog.subject,
      html: emailLog.htmlContent,
      text: emailLog.textContent,
      templateId: emailLog.templateId,
      campaign: emailLog.campaign + "_resend",
    }));

    // Resend emails
    const results = await gmailService.sendBulkEmails(emailsToResend);

    // Update email log with new results
    let successCount = 0;
    results.forEach((result, index) => {
      const recipientIndex = emailLog.recipients.findIndex(
        (r) => r.email === failedRecipients[index].email
      );

      if (recipientIndex !== -1) {
        const isSuccess = result.status === "fulfilled" && result.value.success;
        emailLog.recipients[recipientIndex].status = isSuccess
          ? "sent"
          : "failed";
        emailLog.recipients[recipientIndex].sentAt = isSuccess
          ? new Date()
          : undefined;
        emailLog.recipients[recipientIndex].errorMessage = isSuccess
          ? undefined
          : result.status === "rejected"
          ? result.reason
          : result.value.error;

        if (isSuccess) successCount++;
      }
    });

    // Update counts
    emailLog.successCount += successCount;
    emailLog.failureCount -= successCount;

    await emailLog.save();

    res.json({
      message: "Failed emails resent",
      totalResent: failedRecipients.length,
      newSuccessCount: successCount,
      remainingFailures: failedRecipients.length - successCount,
    });
  } catch (error) {
    console.error("Resend failed emails error:", error);
    res.status(500).json({ error: "Server error resending failed emails." });
  }
});

module.exports = router;
