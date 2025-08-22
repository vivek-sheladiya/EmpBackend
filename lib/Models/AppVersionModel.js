const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const AppVersionSchema = new Schema(
    {
        version: {
            type: String,
            required: true,
            unique: true,
        },
        windows: {
            fileUrl: { type: String, required: false },
            fileName: { type: String, required: false },
            size: { type: Number, required: false },
        },
        macOs: {
            fileUrl: { type: String, required: false },
            fileName: { type: String, required: false },
            size: { type: Number, required: false },
        },
        linux: {
            fileUrl: { type: String, required: false },
            fileName: { type: String, required: false },
            size: { type: Number, required: false },
        },
        forceUpdate: {
            type: Boolean,
            default: false,
        },
        releaseNotes: {
            type: String,
            default: "",
        },
        createdBy: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

const AppVersionModel = mongoose.model("appUpdateVersion", AppVersionSchema);

module.exports = { AppVersionModel };