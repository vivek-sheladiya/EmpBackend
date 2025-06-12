const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MessageSchema = new Schema(
    {
        roomId: {
            type: Schema.Types.ObjectId,
            ref: "chat_rooms",
            required: true,
        },
        sender: {
            type: Schema.Types.ObjectId,
            ref: "employee",
            required: true,
        },
        text: {
            type: String,
            default: null,
        },
        attachments: [
            {
                url: String,
                type: {
                    type: String,
                    enum: ["image", "video", "audio", "document", "other"],
                },
                name: String,
            },
        ],
        replyTo: {
            type: Schema.Types.ObjectId,
            ref: "messages",
            default: null,
        },
        deletedFor: [
            {
                type: Schema.Types.ObjectId,
                ref: "employee",
            },
        ],
        seenBy: [
            {
                type: Schema.Types.ObjectId,
                ref: "employee",
            },
        ],
    },
    { timestamps: true }
);

const MessageModel = mongoose.model("messages", MessageSchema);
module.exports = { MessageModel };
