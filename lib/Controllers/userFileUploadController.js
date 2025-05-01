const {
    handleError,
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
            .populate('user', 'fullName')
            .sort({ createdAt: -1 });
        const formattedList = list.map(item => ({
            _id: item._id,
            title: item.title,
            uploadFile: item.uploadFile,
            createdAt: item.createdAt,
            user: {
                userId: item.user._id,
                fullName: item.user.fullName,
            }
        }));
        return res.status(201).json({ success: true, message: "File uploaded successfully.", data: formattedList });
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
