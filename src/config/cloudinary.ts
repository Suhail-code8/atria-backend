import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage for Multer
export const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const originalName = file.originalname.split('.')[0].replace(/\s+/g, '_');
    
    return {
      folder: 'atria-submissions',
      allowed_formats: ['pdf', 'docx', 'doc', 'zip', 'jpg', 'jpeg', 'png'],
      public_id: `${originalName}_${timestamp}`,
      resource_type: 'auto' // Allows any file type
    };
  }
});

// Export cloudinary instance for direct operations (e.g., deletion)
export default cloudinary;
