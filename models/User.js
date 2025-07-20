const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    year: {
      type: String,
      enum: ["FE", "SE", "TE", "BE", "Alumni", "Faculty"],
    },
    phone: {
      type: String,
      trim: true,
    },
    interests: [
      {
        type: String,
        trim: true,
      },
    ],
    isSubscribed: {
      type: Boolean,
      default: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    source: {
      type: String,
      enum: ["manual", "event_registration", "newsletter_signup", "import"],
      default: "manual",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ department: 1 });
userSchema.index({ year: 1 });
userSchema.index({ isSubscribed: 1 });
userSchema.index({ tags: 1 });

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
userSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
