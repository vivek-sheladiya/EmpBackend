const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProjectSchema = new Schema({

    projectId: {
        type: String,
        required: true,
    },
    projectName: {
        type: String,
        required: true,
    },
    projectDescription: {
        type: String,
        default: null
    },
    clientName: {
        type: String,
        default: null
    },
    projectType: {
        type: String,
        default: null
    },
    startDate: {
        type: String,
        default: null
    },
    endDate: {
        type: String,
        default: null
    },
    projectStatus: {
        type: String,
        default: null //Active , Inactive
    },
    isActive: {
        type: Boolean,
        default: false
    },
    projectPriority: {
        type: String, // High , medium , low
        default: null
    },
    teamMembers: [
        {
            userId: {type: String, default: ""},
        },
    ],
    attachFiles: [{
        image: {
            type: String,
            default: ""
        },
    },],
    teamLeader: [
        {
            userId: {type: String, default: ""},
        },
    ],
    teamManager: [
        {
            userId: {type: String, default: ""},
        },
    ],
    tags: {
        type: String,
        default: null
    },
    deleted: {
        type: Boolean,
        default: false,
    },
    addedBy: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

const ProjectModel = mongoose.model("projects", ProjectSchema);

module.exports = {
    ProjectModel
};