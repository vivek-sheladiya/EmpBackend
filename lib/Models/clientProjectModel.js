const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const clientProjectSchema = new Schema(
    {
        projects: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'projects',
        },
        clientName: {
            type: String
        },
        addedBy: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

const clientProjectModel = mongoose.model("clientProject", clientProjectSchema);

module.exports = { clientProjectModel };