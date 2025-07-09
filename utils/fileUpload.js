const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Supported file types
const FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
  DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  AUDIO: ['audio/mpeg', 'audio/wav'],
  VIDEO: ['video/mp4', 'video/quicktime']
};

// Create uploads directory if it doesn't exist
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

// Main upload configuration function
const createUploader = (options = {}) => {
  const {
    destination = 'uploads',
    allowedTypes = FILE_TYPES.IMAGE,
    maxFileSize = 5 * 1024 * 1024, // 5MB default
    fieldName = 'file',
    useOriginalName = false
  } = options;

  const uploadPath = path.join(__dirname, '../../public', destination);
  ensureDirectoryExists(uploadPath);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = useOriginalName 
        ? file.originalname.replace(ext, '') + ext 
        : `${uuidv4()}${ext}`;
      cb(null, filename);
    }
  });

  const fileFilter = (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} are allowed`), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxFileSize
    }
  }).single(fieldName);
};

// Pre-configured uploaders for common use cases
module.exports = {
  // Image upload (default)
  imageUpload: (options = {}) => createUploader({
    ...options,
    allowedTypes: FILE_TYPES.IMAGE,
    destination: options.destination || 'uploads/images'
  }),

  // Document upload
  documentUpload: (options = {}) => createUploader({
    ...options,
    allowedTypes: FILE_TYPES.DOCUMENT,
    destination: options.destination || 'uploads/documents'
  }),

  // Custom upload
  createCustomUpload: createUploader,

  // File type constants
  FILE_TYPES
};