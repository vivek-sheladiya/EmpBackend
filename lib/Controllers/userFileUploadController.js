const {
    handleError, userDataQuery,
} = require("../utils/utils");
const { userFileUploadModel } = require("../Models/useruploadFileModel");

const addFileUpload = async (req, res) => {
    try {
        const { user, title } = req.body;
        if (!user) {
            return res.status(400).json({ success: false, message: "User is required." });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }
        const uploadFile = req.file.filename;
        const fileUpload = await userFileUploadModel.create({
            user,
            title,
            uploadFile,
        });
        const list = await userFileUploadModel.find({})
            .populate('user', userDataQuery)
            .sort({ createdAt: -1 });

        return res.status(201).json({ success: true, message: "File uploaded successfully.", data: list });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

module.exports = {
    addFileUpload
}
