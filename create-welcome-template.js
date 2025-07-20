const mongoose = require('mongoose');
const Template = require('./models/Template');
require('dotenv').config();

async function createWelcomeTemplate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Check if welcome template already exists
    const existingTemplate = await Template.findOne({ type: 'welcome' });
    if (existingTemplate) {
      console.log('Welcome template already exists');
      process.exit(0);
    }
    
    // Create welcome template
    const welcomeTemplate = new Template({
      name: 'Welcome Email',
      subject: 'Welcome to E-Cell KCCOE, {{firstName}}!',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0; font-size: 28px;">Welcome to E-Cell KCCOE!</h1>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
              Dear <strong>{{firstName}} {{lastName}}</strong>,
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
              We're excited to welcome you to the Entrepreneurship Cell (E-Cell) of K. C. College of Engineering! 
              You've just joined a vibrant community of innovators, entrepreneurs, and future leaders.
            </p>
            
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #1d4ed8; margin: 0 0 15px 0; font-size: 18px;">Your Details:</h3>
              <p style="margin: 5px 0; color: #374151;"><strong>Email:</strong> {{email}}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Department:</strong> {{department}}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Year:</strong> {{year}}</p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
              As a member of E-Cell, you'll have access to:
            </p>
            
            <ul style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px; padding-left: 20px;">
              <li>Exclusive workshops and seminars</li>
              <li>Networking events with successful entrepreneurs</li>
              <li>Startup incubation programs</li>
              <li>Mentorship opportunities</li>
              <li>Regular updates about entrepreneurship opportunities</li>
            </ul>
            
            <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 30px;">
              Get ready to embark on an exciting journey of innovation and entrepreneurship with us!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="font-size: 18px; color: #1d4ed8; font-weight: bold; margin: 0;">
                Welcome aboard! 🚀
              </p>
            </div>
            
            <hr style="border: none; height: 1px; background-color: #e5e7eb; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #6b7280; text-align: center; margin: 0;">
              Best regards,<br>
              <strong>E-Cell Team</strong><br>
              K. C. College of Engineering<br>
              <a href="mailto:kcecell@kccemsr.edu.in" style="color: #2563eb;">kcecell@kccemsr.edu.in</a>
            </p>
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
              If you no longer wish to receive these emails, you can 
              <a href="{{unsubscribeLink}}" style="color: #6b7280;">unsubscribe here</a>.
            </p>
          </div>
        </div>
      `,
      textContent: `
Welcome to E-Cell KCCOE, {{firstName}}!

Dear {{firstName}} {{lastName}},

We're excited to welcome you to the Entrepreneurship Cell (E-Cell) of K. C. College of Engineering! You've just joined a vibrant community of innovators, entrepreneurs, and future leaders.

Your Details:
- Email: {{email}}
- Department: {{department}}
- Year: {{year}}

As a member of E-Cell, you'll have access to:
- Exclusive workshops and seminars
- Networking events with successful entrepreneurs
- Startup incubation programs
- Mentorship opportunities
- Regular updates about entrepreneurship opportunities

Get ready to embark on an exciting journey of innovation and entrepreneurship with us!

Welcome aboard! 🚀

Best regards,
E-Cell Team
K. C. College of Engineering
kcecell@kccemsr.edu.in

If you no longer wish to receive these emails, you can unsubscribe here: {{unsubscribeLink}}
      `,
      type: 'welcome',
      placeholders: ['firstName', 'lastName', 'fullName', 'email', 'department', 'year', 'unsubscribeLink'],
      isActive: true
    });
    
    await welcomeTemplate.save();
    console.log('Welcome template created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating welcome template:', error);
    process.exit(1);
  }
}

createWelcomeTemplate();
