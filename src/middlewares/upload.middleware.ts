import multer from 'multer';
import { cloudinaryStorage } from '../config/cloudinary';

// File size limit: 10MB
const FILE_SIZE_LIMIT = 10 * 1024 * 1024;

// Configure Multer with Cloudinary storage
export const upload = multer({
  storage: cloudinaryStorage,
  limits: {
    fileSize: FILE_SIZE_LIMIT
  },
  fileFilter: (req, file, cb) => {
    // Allowed mime types
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/x-zip-compressed',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, ZIP, JPG, and PNG files are allowed.'));
    }
  }
});
