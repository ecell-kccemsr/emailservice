const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["welcome", "event_invitation", "thank_you", "custom"],
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    htmlContent: {
      type: String,
      required: true,
    },
    textContent: {
      type: String,
    },
    placeholders: [
      {
        key: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        defaultValue: {
          type: String,
          default: "",
        },
      },
    ],
    images: [
      {
        cloudinaryId: String,
        url: String,
        alt: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
templateSchema.index({ type: 1 });
templateSchema.index({ isActive: 1 });
templateSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Template", templateSchema);
