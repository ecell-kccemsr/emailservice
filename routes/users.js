const express = require("express");
const User = require("../models/User");
const Template = require("../models/Template");
const EmailLog = require("../models/EmailLog");
const { auth } = require("../middleware/auth");
const gmailService = require("../services/gmailService");

const router = express.Router();

// Helper function to send welcome email
const sendWelcomeEmail = async (user) => {
  try {
    // Find welcome template
    const welcomeTemplate = await Template.findOne({ 
      type: 'welcome', 
      isActive: true 
    });

    if (!welcomeTemplate) {
      console.log('No active welcome template found, skipping welcome email');
      return;
    }

    // Prepare template data
    const templateData = {
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      department: user.department || '',
      year: user.year || '',
      unsubscribeLink: gmailService.generateUnsubscribeLink(user._id)
    };

    // Process template content
    const subject = gmailService.processTemplate(welcomeTemplate.subject, templateData);
    const htmlContent = gmailService.processTemplate(welcomeTemplate.htmlContent, templateData);
    const textContent = welcomeTemplate.textContent 
      ? gmailService.processTemplate(welcomeTemplate.textContent, templateData)
      : '';

    // Send email
    await gmailService.sendEmail({
      to: user.email,
      subject: subject,
      html: htmlContent,
      text: textContent,
      campaign: 'welcome',
      templateId: welcomeTemplate._id
    });

    // Log the email
    const emailLog = new EmailLog({
      recipients: [{ email: user.email, status: 'sent' }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: textContent,
      templateId: welcomeTemplate._id,
      campaign: 'welcome',
      sentBy: 'system', // Since it's automated
      totalRecipients: 1,
      successfulDeliveries: 1,
      failedDeliveries: 0
    });

    await emailLog.save();
    console.log(`Welcome email sent to ${user.email}`);

  } catch (error) {
    console.error(`Failed to send welcome email to ${user.email}:`, error);
    // Don't throw error to prevent user creation from failing
  }
};

// Get all users with pagination and filters
router.get("/", auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      department = "",
      year = "",
      isSubscribed = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (department) filter.department = department;
    if (year) filter.year = year;
    if (isSubscribed !== "") filter.isSubscribed = isSubscribed === "true";

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute queries
    const [users, totalUsers] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Server error fetching users." });
  }
});

// Get user by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Server error fetching user." });
  }
});

// Create new user
router.post("/", auth, async (req, res) => {
  try {
    const {
      email,
      firstName,
      lastName,
      department,
      year,
      phone,
      interests = [],
      tags = [],
      notes = "",
      source = "manual",
    } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName) {
      return res
        .status(400)
        .json({ error: "Email, first name, and last name are required." });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email already exists." });
    }

    // Create new user
    const user = new User({
      email,
      firstName,
      lastName,
      department,
      year,
      phone,
      interests,
      tags,
      notes,
      source,
    });

    await user.save();

    // Send welcome email asynchronously (don't wait for it to complete)
    sendWelcomeEmail(user).catch(err => {
      console.error('Welcome email failed:', err);
    });

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Server error creating user." });
  }
});

// Update user
router.put("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Check if email is being changed and if new email exists
    if (req.body.email && req.body.email !== user.email) {
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser) {
        return res
          .status(400)
          .json({ error: "User with this email already exists." });
      }
    }

    // Update user fields
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Server error updating user." });
  }
});

// Delete user
router.delete("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Server error deleting user." });
  }
});

// Bulk operations
router.post("/bulk", auth, async (req, res) => {
  try {
    const { operation, userIds, data } = req.body;

    switch (operation) {
      case "delete":
        await User.deleteMany({ _id: { $in: userIds } });
        res.json({ message: `${userIds.length} users deleted successfully` });
        break;

      case "subscribe":
        await User.updateMany(
          { _id: { $in: userIds } },
          { $set: { isSubscribed: true } }
        );
        res.json({
          message: `${userIds.length} users subscribed successfully`,
        });
        break;

      case "unsubscribe":
        await User.updateMany(
          { _id: { $in: userIds } },
          { $set: { isSubscribed: false } }
        );
        res.json({
          message: `${userIds.length} users unsubscribed successfully`,
        });
        break;

      case "add_tags":
        await User.updateMany(
          { _id: { $in: userIds } },
          { $addToSet: { tags: { $each: data.tags } } }
        );
        res.json({
          message: `Tags added to ${userIds.length} users successfully`,
        });
        break;

      default:
        res.status(400).json({ error: "Invalid bulk operation" });
    }
  } catch (error) {
    console.error("Bulk operation error:", error);
    res.status(500).json({ error: "Server error performing bulk operation." });
  }
});

// Get user statistics
router.get("/stats/overview", auth, async (req, res) => {
  try {
    const [
      totalUsers,
      subscribedUsers,
      departmentStats,
      yearStats,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isSubscribed: true }),
      User.aggregate([
        { $group: { _id: "$department", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      User.aggregate([
        { $group: { _id: "$year", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("firstName lastName email createdAt"),
    ]);

    res.json({
      totalUsers,
      subscribedUsers,
      unsubscribedUsers: totalUsers - subscribedUsers,
      departmentStats,
      yearStats,
      recentUsers,
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ error: "Server error fetching user statistics." });
  }
});

module.exports = router;
