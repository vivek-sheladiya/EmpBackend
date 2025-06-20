const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ChatRoomSchema = new Schema(
    {
        isGroup: { type: Boolean, default: false },
        groupName: { type: String, default: null },
        groupPhoto: { type: String, default: null },
        members: [{ type: Schema.Types.ObjectId, ref: "employee", required: true }],
        lastMessage: {
            message: { type: String },
            sender: { type: Schema.Types.ObjectId, ref: "employee" },
            messageTime: { type: Date },
        },
        createdBy: { type: Schema.Types.ObjectId, ref: "employee", required: true },
    },
    {
        timestamps: true,
        indexes: [
            { key: { members: 1 } },
            { key: { "lastMessage.messageTime": -1 } }
        ]
    }
);

const UserChatMetaSchema = new Schema(
    {
        roomId: { type: Schema.Types.ObjectId, ref: "chat_rooms", required: true },
        userId: { type: Schema.Types.ObjectId, ref: "employee", required: true },
        isPinned: { type: Boolean, default: false },
        isBlocked: { type: Boolean, default: false },
        lastSeen: { type: Date, default: null },
    },
    {
        timestamps: true,
        indexes: [
            { key: { userId: 1, roomId: 1 }, unique: true }
        ]
    }
);

const MessageSchema = new Schema(
    {
        roomId: { type: Schema.Types.ObjectId, ref: "chat_rooms", required: true },
        sender: { type: Schema.Types.ObjectId, ref: "employee", required: true },
        message: { type: String, default: null },
        attachments: [
            {
                fileType: { type: String, default: null },
                folderType: { type: String, default: null },
                fileName: { type: String, default: null },
                fileUrl: { type: String, default: null },
            }
        ],
        isReadBy: {
            type: Map,
            of: Boolean,
            default: {}
        },
        replyMessageId: { type: String, default: null },
        replyMessageValue: { type: String, default: null },
        replyMessageIsFile: { type: Boolean, default: false },
        messageType: { type: String, default: "text" },
    },
    {
        timestamps: true,
        indexes: [
            { key: { roomId: 1, createdAt: -1 } }
        ]
    }
);

const CallSchema = new mongoose.Schema({
    callerId: String,
    calleeId: String,
    startTime: Date,
    endTime: Date,
    status: { type: String, enum: ['missed', 'answered', 'rejected'], default: 'missed' },
    callType: { type: String, enum: ['audio', 'video'], default: 'video' },
});

module.exports = mongoose.model('CallHistory', CallSchema);

const ChatRoomModel = mongoose.model("chat_rooms", ChatRoomSchema);
const UserChatMetaModel = mongoose.model("user_chat_meta", UserChatMetaSchema);
const MessageModel = mongoose.model("messages", MessageSchema);
const CallHistoryModel = mongoose.model('call_history', CallSchema);

module.exports = { ChatRoomModel, UserChatMetaModel, MessageModel, CallHistoryModel };
