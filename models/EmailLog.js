const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema(
  {
    recipients: [
      {
        email: {
          type: String,
          required: true,
        },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["sent", "failed", "bounced", "delivered", "opened", "clicked"],
          default: "sent",
        },
        errorMessage: String,
        sentAt: Date,
        deliveredAt: Date,
        openedAt: Date,
        clickedAt: Date,
      },
    ],
    subject: {
      type: String,
      required: true,
    },
    htmlContent: String,
    textContent: String,
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
    },
    templateData: {
      type: Map,
      of: String,
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    campaign: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    totalRecipients: {
      type: Number,
      required: true,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    openRate: {
      type: Number,
      default: 0,
    },
    clickRate: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for analytics and queries
emailLogSchema.index({ sentBy: 1 });
emailLogSchema.index({ templateId: 1 });
emailLogSchema.index({ createdAt: -1 });
emailLogSchema.index({ campaign: 1 });
emailLogSchema.index({ "recipients.status": 1 });

module.exports = mongoose.model("EmailLog", emailLogSchema);
