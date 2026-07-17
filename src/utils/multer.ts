/* eslint-disable no-undef */
import multer from "multer";

const uploadFile = () => {
  // Define memory storage configuration
  const storage = multer.memoryStorage();

  // File filter to only allow image files
  const fileFilter = (req: any, file: any, cb: any) => {
    console.log(`Checking file type: ${file.mimetype}`);

    // List of allowed image MIME types
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      console.log(`File ${file.originalname} accepted as valid image`);
      cb(null, true);
    } else {
      console.log(
        `File ${file.originalname} rejected - not an allowed image type`
      );
      cb(
        new Error("Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed!"),
        false
      );
    }
  };

  // Create multer instance
  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB file size limit
    },
    fileFilter: fileFilter,
  });

  return upload;
};

export default uploadFile;