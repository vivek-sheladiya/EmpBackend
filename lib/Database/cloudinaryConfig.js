const cloudinary = require("cloudinary").v2;
const multer = require('multer');
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: "dzkykyugo",
  api_key: "996662845841723",
  api_secret: "uajKzssMPDPo7qDn-ZU_yGbyk1E",
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const userId = req.params.userId || file.originalname.split('.')[0];
    return {
      folder: "profilePhoto",
      format: 'jpg',
      public_id: userId,
    };
  },
});

const upload = multer({ storage });

const uploadSingleFile = async (req, res) => {
    upload.single("file")(req, res, (err) => {
      console.log("req.body", req.body);
      next();
        // if (err) {
        //     return res.status(400).json({ success: false, message: 'Error uploading file' });
        // }
        // if (!req.file) {
        //     return res.status(400).json({ success: false, message: 'No file uploaded' });
        // }
        // return res.status(200).json({ success: true, message: 'File Upload Successfully', data: { fileUrl: req.file.path } });
    });
    
};

const uploadMultipleFiles = async (req, res) => {
  upload.array("files", 10)(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: 'Error uploading files' });
        }
        if (!req.files) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }
        return res.status(200).json({ success: true, message: 'Files Upload Successfully', data: { fileUrl: req.files.map(file => file.path) } });
    });
    next();
};

const deleteSingleFile = async (req, res) => {
  const result = await cloudinary.uploader.destroy(req.params.fileName);
  return res.status(200).json({ success: true, message: 'File deleted successfully', result: result });
};

const deleteMultipleFiles = async (req, res) => {
  const result = await cloudinary.uploader.destroy(req.body.fileNames);
  return res.status(200).json({ success: true, message: 'Files deleted successfully', result: result });
};

module.exports = { cloudinary, upload, uploadSingleFile, uploadMultipleFiles, deleteSingleFile, deleteMultipleFiles };
