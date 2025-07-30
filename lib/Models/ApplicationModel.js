const mongoose = require("mongoose");

const FieldSchema = new mongoose.Schema({
    key: { type: String, required: true },
    type: { type: String, required: true, enum: ["string", "number", "boolean", "array", "object"] },
    defaultValue: { type: mongoose.Mixed, required: true },
}, { _id: false });

const VersionSchema = new mongoose.Schema({
    versionName: { type: String, required: true },
    versionCode: { type: Number, required: true },
    versionConfig: { type: Map, of: mongoose.Mixed, required: true },
}, { _id: false });

const AppSchema = new mongoose.Schema({
    appName: { type: String, required: true },
    description: { type: String },
    packageName: { type: String, required: true, unique: true },
    icon: { type: String },
    fields: [FieldSchema], // Store dynamic fields
    versions: [VersionSchema],
});

const ApplicationModel = mongoose.model("applicationData", AppSchema);

module.exports = { ApplicationModel };