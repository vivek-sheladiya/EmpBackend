const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TasksSchema = new Schema(
    {
        taskId: {type: String, default: ""},
        projectName: {type: String, default: ""},
        taskTitle: {type: String, default: ""},
        taskDescription: {type: String, default: ""},
        taskStatus: {type: String, default: ""},
        taskPriority: {type: String, default: ""},
        taskCategory: {type: String, default: ""},
        taskAssignee: [
            {
                userId: {type: String, default: ""},
            },
        ],
        taskLabels: {type: String, default: ""},
        taskStartDate: {type: String, default: ""},
        taskEndDate: {type: String, default: ""},
        taskEstimatedTime: {type: String, default: ""},
        taskAttachments: [
            {
                attachmentType: {type: String, default: ""},
                url: {type: String, default: ""},
            },
        ],
        taskAddedBy: {type: String, default: ""},
        taskHistory: [
            {
                fieldName: {type: String},
                oldValue: {type: Schema.Types.Mixed},
                newValue: {type: Schema.Types.Mixed},
                changedBy: {type: String},
                changeTime: {type: Date, default: Date.now},
            },
        ],
        taskClosedTime: [
            {
                closedAt: {type: Date, default: Date.now},
            },
        ],
        placementIndex: { type: Number, default: 0 },
    },
    {timestamps: true}
);

const TasksModel = mongoose.model("tasks", TasksSchema);

module.exports = {TasksModel};
