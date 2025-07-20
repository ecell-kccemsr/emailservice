const express = require("express");
const Template = require("../models/Template");
const { auth } = require("../middleware/auth");
const cloudinaryService = require("../services/cloudinaryService");

const router = express.Router();

// Get all templates
router.get("/", auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type = "",
      isActive = "",
      search = "",
    } = req.query;

    // Build filter
    const filter = {};
    if (type) filter.type = type;
    if (isActive !== "") filter.isActive = isActive === "true";
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [templates, totalTemplates] = await Promise.all([
      Template.find(filter)
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Template.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalTemplates / parseInt(limit));

    res.json({
      templates,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalTemplates,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Get templates error:", error);
    res.status(500).json({ error: "Server error fetching templates." });
  }
});

// Get template by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );

    if (!template) {
      return res.status(404).json({ error: "Template not found." });
    }

    res.json({ template });
  } catch (error) {
    console.error("Get template error:", error);
    res.status(500).json({ error: "Server error fetching template." });
  }
});

// Create new template
router.post("/", auth, async (req, res) => {
  try {
    const {
      name,
      type,
      subject,
      htmlContent,
      textContent,
      placeholders = [],
      images = [],
    } = req.body;

    // Validate required fields
    if (!name || !type || !subject || !htmlContent) {
      return res.status(400).json({
        error: "Name, type, subject, and HTML content are required.",
      });
    }

    // Check if template name already exists
    const existingTemplate = await Template.findOne({ name });
    if (existingTemplate) {
      return res
        .status(400)
        .json({ error: "Template with this name already exists." });
    }

    const template = new Template({
      name,
      type,
      subject,
      htmlContent,
      textContent,
      placeholders,
      images,
      createdBy: req.admin._id,
    });

    await template.save();
    await template.populate("createdBy", "name email");

    res.status(201).json({
      message: "Template created successfully",
      template,
    });
  } catch (error) {
    console.error("Create template error:", error);
    res.status(500).json({ error: "Server error creating template." });
  }
});

// Update template
router.put("/:id", auth, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: "Template not found." });
    }

    // Check if name is being changed and if new name exists
    if (req.body.name && req.body.name !== template.name) {
      const existingTemplate = await Template.findOne({ name: req.body.name });
      if (existingTemplate) {
        return res
          .status(400)
          .json({ error: "Template with this name already exists." });
      }
    }

    const updatedTemplate = await Template.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("createdBy", "name email");

    res.json({
      message: "Template updated successfully",
      template: updatedTemplate,
    });
  } catch (error) {
    console.error("Update template error:", error);
    res.status(500).json({ error: "Server error updating template." });
  }
});

// Delete template
router.delete("/:id", auth, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: "Template not found." });
    }

    // Delete associated images from Cloudinary
    if (template.images && template.images.length > 0) {
      const deletePromises = template.images.map((image) =>
        cloudinaryService.deleteImage(image.cloudinaryId)
      );
      await Promise.allSettled(deletePromises);
    }

    await Template.findByIdAndDelete(req.params.id);

    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("Delete template error:", error);
    res.status(500).json({ error: "Server error deleting template." });
  }
});

// Clone template
router.post("/:id/clone", auth, async (req, res) => {
  try {
    const originalTemplate = await Template.findById(req.params.id);

    if (!originalTemplate) {
      return res.status(404).json({ error: "Template not found." });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "New template name is required." });
    }

    // Check if new name already exists
    const existingTemplate = await Template.findOne({ name });
    if (existingTemplate) {
      return res
        .status(400)
        .json({ error: "Template with this name already exists." });
    }

    const clonedTemplate = new Template({
      name,
      type: originalTemplate.type,
      subject: originalTemplate.subject,
      htmlContent: originalTemplate.htmlContent,
      textContent: originalTemplate.textContent,
      placeholders: originalTemplate.placeholders,
      images: originalTemplate.images, // Note: This shares the same images
      createdBy: req.admin._id,
    });

    await clonedTemplate.save();
    await clonedTemplate.populate("createdBy", "name email");

    res.status(201).json({
      message: "Template cloned successfully",
      template: clonedTemplate,
    });
  } catch (error) {
    console.error("Clone template error:", error);
    res.status(500).json({ error: "Server error cloning template." });
  }
});

// Preview template with sample data
router.post("/:id/preview", auth, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: "Template not found." });
    }

    const { sampleData = {} } = req.body;

    // Process placeholders with sample data
    let processedHtml = template.htmlContent;
    let processedSubject = template.subject;

    template.placeholders.forEach((placeholder) => {
      const value =
        sampleData[placeholder.key] ||
        placeholder.defaultValue ||
        `{{${placeholder.key}}}`;
      const regex = new RegExp(`{{${placeholder.key}}}`, "g");
      processedHtml = processedHtml.replace(regex, value);
      processedSubject = processedSubject.replace(regex, value);
    });

    res.json({
      preview: {
        subject: processedSubject,
        htmlContent: processedHtml,
        textContent: template.textContent,
      },
    });
  } catch (error) {
    console.error("Preview template error:", error);
    res
      .status(500)
      .json({ error: "Server error generating template preview." });
  }
});

// Get template types
router.get("/meta/types", auth, async (req, res) => {
  try {
    const types = await Template.distinct("type");
    res.json({ types });
  } catch (error) {
    console.error("Get template types error:", error);
    res.status(500).json({ error: "Server error fetching template types." });
  }
});

// Upload image for template
router.post("/:id/images", auth, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: "Template not found." });
    }

    const { imageData, alt = "" } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: "Image data is required." });
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinaryService.uploadImage(imageData, {
      folder: `ecell-email-service/templates/${template._id}`,
      public_id: `image_${Date.now()}`,
    });

    if (!uploadResult.success) {
      return res.status(500).json({ error: "Failed to upload image." });
    }

    // Add image to template
    const imageInfo = {
      cloudinaryId: uploadResult.data.public_id,
      url: uploadResult.data.url,
      alt,
    };

    template.images.push(imageInfo);
    await template.save();

    res.json({
      message: "Image uploaded successfully",
      image: imageInfo,
    });
  } catch (error) {
    console.error("Upload template image error:", error);
    res.status(500).json({ error: "Server error uploading image." });
  }
});

// Remove image from template
router.delete("/:id/images/:imageId", auth, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: "Template not found." });
    }

    const imageIndex = template.images.findIndex(
      (img) => img._id.toString() === req.params.imageId
    );

    if (imageIndex === -1) {
      return res.status(404).json({ error: "Image not found in template." });
    }

    const image = template.images[imageIndex];

    // Delete from Cloudinary
    await cloudinaryService.deleteImage(image.cloudinaryId);

    // Remove from template
    template.images.splice(imageIndex, 1);
    await template.save();

    res.json({ message: "Image removed successfully" });
  } catch (error) {
    console.error("Remove template image error:", error);
    res.status(500).json({ error: "Server error removing image." });
  }
});

module.exports = router;
