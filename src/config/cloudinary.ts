import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { env } from './env';

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret
});

                                          
export const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
                                              
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
