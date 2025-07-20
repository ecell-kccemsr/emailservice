const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class CloudinaryService {
  async uploadImage(file, options = {}) {
    try {
      const uploadOptions = {
        folder: options.folder || "ecell-email-service",
        public_id: options.public_id,
        overwrite: options.overwrite || false,
        resource_type: "image",
        quality: options.quality || "auto",
        fetch_format: "auto",
        ...options,
      };

      let result;

      if (typeof file === "string") {
        // File is a base64 string or URL
        result = await cloudinary.uploader.upload(file, uploadOptions);
      } else if (file.path) {
        // File is from multer with local path
        result = await cloudinary.uploader.upload(file.path, uploadOptions);
      } else if (file.buffer) {
        // File is from multer with buffer
        result = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(uploadOptions, (error, result) => {
              if (error) reject(error);
              else resolve(result);
            })
            .end(file.buffer);
        });
      } else {
        throw new Error("Invalid file format");
      }

      return {
        success: true,
        data: {
          public_id: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          resource_type: result.resource_type,
          created_at: result.created_at,
        },
      };
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);

      return {
        success: result.result === "ok",
        result: result.result,
      };
    } catch (error) {
      console.error("Cloudinary delete error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getImageDetails(publicId) {
    try {
      const result = await cloudinary.api.resource(publicId);

      return {
        success: true,
        data: {
          public_id: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          resource_type: result.resource_type,
          bytes: result.bytes,
          created_at: result.created_at,
          updated_at: result.updated_at,
        },
      };
    } catch (error) {
      console.error("Cloudinary get details error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async listImages(options = {}) {
    try {
      const listOptions = {
        type: "upload",
        prefix: options.prefix || "ecell-email-service/",
        max_results: options.max_results || 30,
        next_cursor: options.next_cursor,
        ...options,
      };

      const result = await cloudinary.api.resources(listOptions);

      return {
        success: true,
        data: {
          resources: result.resources.map((resource) => ({
            public_id: resource.public_id,
            url: resource.secure_url,
            width: resource.width,
            height: resource.height,
            format: resource.format,
            bytes: resource.bytes,
            created_at: resource.created_at,
          })),
          next_cursor: result.next_cursor,
          total_count: result.total_count,
        },
      };
    } catch (error) {
      console.error("Cloudinary list images error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  generateImageUrl(publicId, transformations = {}) {
    try {
      const url = cloudinary.url(publicId, {
        secure: true,
        ...transformations,
      });

      return url;
    } catch (error) {
      console.error("Error generating image URL:", error);
      return null;
    }
  }

  generateThumbnail(publicId, width = 300, height = 200) {
    return this.generateImageUrl(publicId, {
      width,
      height,
      crop: "fill",
      gravity: "center",
      quality: "auto",
      fetch_format: "auto",
    });
  }

  async uploadMultipleImages(files, options = {}) {
    try {
      const uploadPromises = files.map((file, index) =>
        this.uploadImage(file, {
          ...options,
          public_id: options.public_id
            ? `${options.public_id}_${index}`
            : undefined,
        })
      );

      const results = await Promise.allSettled(uploadPromises);

      const successful = results
        .filter(
          (result) => result.status === "fulfilled" && result.value.success
        )
        .map((result) => result.value.data);

      const failed = results
        .filter(
          (result) => result.status === "rejected" || !result.value.success
        )
        .map((result, index) => ({
          index,
          error:
            result.status === "rejected" ? result.reason : result.value.error,
        }));

      return {
        success: successful.length > 0,
        successful,
        failed,
        total: files.length,
      };
    } catch (error) {
      console.error("Multiple upload error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new CloudinaryService();
