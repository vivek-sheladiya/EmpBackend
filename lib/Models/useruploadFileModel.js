const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userUploadFileSchema = new Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'employee',
        },
        title: {
            type: String
        },
        uploadFile: {
            type: String
        }
    }
)

const userFileUploadModel = mongoose.model("userFileUpload", userUploadFileSchema);

module.exports = { userFileUploadModel };