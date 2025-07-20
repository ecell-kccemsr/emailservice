const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import models
const Admin = require("./models/Admin");
const Template = require("./models/Template");
const User = require("./models/User");

// Sample data
const seedData = {
  admins: [
    {
      email: "admin@kccoe.edu.in",
      password: "ECell@123",
      name: "E-Cell Admin",
      role: "super_admin",
    },
    {
      email: "coordinator@kccoe.edu.in",
      password: "ECell@123",
      name: "E-Cell Coordinator",
      role: "admin",
    },
  ],

  templates: [
    {
      name: "Welcome Email",
      type: "welcome",
      subject: "Welcome to E-Cell KCCOE - {{firstName}}!",
      htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to E-Cell KCCOE</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1>Welcome to E-Cell KCCOE!</h1>
            <p>Empowering Innovation & Entrepreneurship</p>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2>Hello {{firstName}}!</h2>
            <p>We're thrilled to welcome you to the Entrepreneurship Cell of K.C. College of Engineering!</p>
            <p>You've just joined a community of innovative minds, aspiring entrepreneurs, and future leaders.</p>
            <p>Best regards,<br><strong>E-Cell Team</strong><br>K.C. College of Engineering</p>
        </div>
        <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
            <p>© 2024 E-Cell, K.C. College of Engineering. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
      placeholders: [
        {
          key: "firstName",
          description: "User's first name",
          defaultValue: "Student",
        },
        {
          key: "lastName",
          description: "User's last name",
          defaultValue: "",
        },
        {
          key: "website_link",
          description: "E-Cell website link",
          defaultValue: "https://kccoe.edu.in",
        },
      ],
      isActive: true,
    },

    {
      name: "Event Invitation Template",
      type: "event_invitation",
      subject: "You're Invited - {{event_name}}",
      htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Invitation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1>🎉 You're Invited!</h1>
            <h2>{{event_name}}</h2>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2>Hello {{firstName}}!</h2>
            <p>We're excited to invite you to {{event_name}}!</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff6b6b;">
                <h3>📅 Event Details</h3>
                <p><strong>Date:</strong> {{event_date}}</p>
                <p><strong>Time:</strong> {{event_time}}</p>
                <p><strong>Venue:</strong> {{event_venue}}</p>
            </div>
            <p>Best regards,<br><strong>E-Cell Team</strong><br>K.C. College of Engineering</p>
        </div>
    </div>
</body>
</html>`,
      placeholders: [
        {
          key: "firstName",
          description: "User's first name",
          defaultValue: "Student",
        },
        {
          key: "event_name",
          description: "Name of the event",
          defaultValue: "E-Cell Event",
        },
        {
          key: "event_date",
          description: "Event date",
          defaultValue: "TBD",
        },
        {
          key: "event_time",
          description: "Event time",
          defaultValue: "TBD",
        },
        {
          key: "event_venue",
          description: "Event venue",
          defaultValue: "KCCOE Campus",
        },
        {
          key: "registration_link",
          description: "Registration link",
          defaultValue: "#",
        },
      ],
      isActive: true,
    },
  ],

  users: [
    {
      email: "student1@kccoe.edu.in",
      firstName: "Raj",
      lastName: "Patkar",
      department: "Computer Engineering",
      year: "TE",
      interests: ["Web Development", "Startups"],
      tags: ["developer", "entrepreneur"],
      source: "manual",
    },
    {
      email: "student2@kccoe.edu.in",
      firstName: "Priya",
      lastName: "Sharma",
      department: "Information Technology",
      year: "BE",
      interests: ["AI/ML", "Data Science"],
      tags: ["data-scientist", "ai-enthusiast"],
      source: "event_registration",
    },
  ],
};

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/ecell-email-service"
    );
    console.log("Connected to MongoDB");

    // Clear existing data
    await Admin.deleteMany({});
    await Template.deleteMany({});
    await User.deleteMany({});
    console.log("Cleared existing data");

    // Create admin users
    const admins = [];
    for (const adminData of seedData.admins) {
      const admin = new Admin(adminData);
      await admin.save();
      admins.push(admin);
    }
    console.log(`Created ${admins.length} admin users`);

    // Create templates
    const templates = [];
    for (const templateData of seedData.templates) {
      const template = new Template({
        ...templateData,
        createdBy: admins[0]._id, // Use first admin as creator
      });
      await template.save();
      templates.push(template);
    }
    console.log(`Created ${templates.length} email templates`);

    // Create users
    const users = [];
    for (const userData of seedData.users) {
      const user = new User(userData);
      await user.save();
      users.push(user);
    }
    console.log(`Created ${users.length} users`);

    console.log("\\n🎉 Database seeded successfully!");
    console.log("\\n📧 Admin Login Credentials:");
    console.log("Email: admin@kccoe.edu.in");
    console.log("Password: ECell@123");
    console.log("\\nEmail: coordinator@kccoe.edu.in");
    console.log("Password: ECell@123");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\\nDisconnected from MongoDB");
    process.exit(0);
  }
}

// Run seeding
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, seedData };
