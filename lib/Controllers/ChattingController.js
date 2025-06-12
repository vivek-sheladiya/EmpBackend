const {handleError, UserRole, ApprovalStatus} = require("../utils/utils");
const {UserModel} = require("../Models/UserModel");
const {ChatRoomModel, UserChatMetaModel, MessageModel} = require("../Models/ChatRoom");
const mongoose = require("mongoose");

const getRoomsList = async (req, res) => {
    try {
        const userId = req.user._id;

        const result = await getRooms(userId);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("Error in getRoomsList:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const createChatRoom = async (req, res) => {
    try {
        const userId = req.user._id;
        const { userIds, isGroup = false, groupName, groupPhoto } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one user ID is required to create a chat room",
            });
        }

        const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID(s) provided",
            });
        }

        const users = await UserModel.find({
            _id: { $in: userIds },
            approvalStatus: ApprovalStatus.Approved,
            isActive: true,
        });

        if (users.length !== userIds.length) {
            return res.status(400).json({
                success: false,
                message: "One or more users are not approved or active",
            });
        }

        if (!isGroup && userIds.length === 1) {
            const otherUserId = userIds[0];
            const existingRoom = await ChatRoomModel.findOne({
                isGroup: false,
                members: { $all: [userId, otherUserId], $size: 2 },
            });

            if (existingRoom) {
                return res.status(200).json({
                    success: true,
                    message: "Chat room already exists",
                    data: {
                        _id: existingRoom._id,
                        isGroup: existingRoom.isGroup,
                        members: [userId, otherUserId],
                        createdBy: existingRoom.createdBy,
                        createdAt: existingRoom.createdAt,
                        updatedAt: existingRoom.updatedAt,
                    },
                });
            }
        }

        if (isGroup && userIds.length < 2) {
            return res.status(400).json({
                success: false,
                message: "A group chat must have at least 3 members (including the creator)",
            });
        }

        const members = [...new Set([...userIds, userId])]; // Remove duplicates

        const newRoom = await ChatRoomModel.create({
            isGroup,
            groupName: isGroup ? groupName || "Group Chat" : null,
            groupPhoto: isGroup ? groupPhoto || null : null,
            members,
            createdBy: userId,
        });

        const metaEntries = members.map(memberId => ({
            roomId: newRoom._id,
            userId: memberId,
            status: (users.find(u => u._id.toString() === memberId.toString())?.status || "deactive"),
        }));
        await UserChatMetaModel.create(metaEntries);

        const populatedRoom = await ChatRoomModel.findById(newRoom._id)
            .populate({
                path: "members",
                select: "fullName emailAddress profilePhoto status",
            })
            .lean();

        res.status(201).json({
            success: true,
            message: "Chat room created successfully",
            data: {
                ...populatedRoom,
                userMeta: {
                    isPinned: false,
                    isBlocked: false,
                    lastSeen: null,
                },
            },
        });
    } catch (error) {
        console.error("Error in createChatRoom:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const sendMessage = async (req, res) => {
    try {
        const { roomId, sender, text, messageType = "text" } = req.body;

        if (!mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(sender)) {
            return res.status(400).json({
                success: false,
                message: "Invalid room ID or sender ID",
            });
        }

        if (sender !== req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "Sender ID does not match authenticated user",
            });
        }

        const room = await ChatRoomModel.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Chat room not found",
            });
        }

        if (!room.members.map(m => m.toString()).includes(sender)) {
            return res.status(400).json({
                success: false,
                message: "Sender is not a member of this chat room",
            });
        }

        const newMessage = new MessageModel({
            roomId,
            sender,
            message: text?.trim(),
            messageType,
        });

        newMessage.isReadBy.set(sender, true);

        await newMessage.save();

        await newMessage.populate("sender", "fullName");

        room.lastMessage = {
            message: messageType === "text" ? text : `[${messageType}]`,
            messageTime: newMessage.createdAt,
            sender,
        };
        await room.save();

        const messages = await MessageModel.find({ roomId })
            .sort({ createdAt: -1 })
            .populate("sender", "fullName");

        return res.status(200).json({
            success: true,
            message: "Message Sent Successfully",
            data: {
                messages: messages.reverse(),
            },
        });
    } catch (error) {
        console.error("Error in sendMessage:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const getMessages = async (req, res) => {
    try {
        const { roomId } = req.query;

        if (!mongoose.Types.ObjectId.isValid(roomId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid room ID",
            });
        }

        const room = await ChatRoomModel.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Chat room not found",
            });
        }

        const userId = req.user._id.toString();
        if (!room.members.map(m => m.toString()).includes(userId)) {
            return res.status(400).json({
                success: false,
                message: "User is not a member of this chat room",
            });
        }

        const { messages, totalMessages, unreadMessages, lastSeen } = await getRoomMessagesWithExtraData(roomId, userId);

        res.status(200).json({
            success: true,
            data: {
                messages,
                totalMessages,
                unreadMessages,
                lastSeen,
            },
        });

    } catch (error) {
        console.error("Error in getMessages:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const getRooms = async (userId) => {
    const rooms = await ChatRoomModel.find({
        members: userId
    })
        .populate({
            path: "members",
            select: "fullName emailAddress profilePhoto status"
        })
        .populate({
            path: "lastMessage.sender",
            select: "fullName"
        })
        .sort({
            "lastMessage.messageTime": -1,
            createdAt: -1
        })
        .lean();

    const userChatMeta = await getUserChatMeta(userId);

    return rooms.map(room => ({
        ...room,
        userMeta: userChatMeta[room._id.toString()] || {
            isPinned: false,
            isBlocked: false,
            lastSeen: null,
        }
    }));
};

const getUserChatMeta = async (userId) => {
    const meta = await UserChatMetaModel.find({ userId }).lean();
    const metaMap = {};
    meta.forEach(m => {
        metaMap[m.roomId.toString()] = {
            isPinned: m.isPinned,
            isBlocked: m.isBlocked,
            lastSeen: m.lastSeen,
        };
    });
    return metaMap;
};

const getUnreadMessagesCount = async (roomId, userId) => {
    return MessageModel.countDocuments({
        roomId,
        isRead: false,
        "sender": {$ne: userId}
    });
};

const getRoomMessagesWithExtraData = async (roomId, userId) => {
    const messages = await MessageModel.find({ roomId })
        .sort({ createdAt: -1 })
        .populate("sender", "fullName");

    const totalMessages = await MessageModel.countDocuments({ roomId });
    const unreadCount = await getUnreadMessagesCount(roomId, userId);

    await UserChatMetaModel.findOneAndUpdate(
        { roomId, userId },
        { lastSeen: new Date() },
        { upsert: true }
    );

    const userMeta = await UserChatMetaModel.findOne({ roomId, userId }).lean();
    const lastSeen = userMeta ? userMeta.lastSeen : null;

    return {
        messages: messages.reverse(),
        totalMessages,
        unreadMessages: unreadCount,
        lastSeen
    };
};

module.exports = { getRoomsList, createChatRoom, sendMessage, getMessages };

// const getRoomsList = async (req, res) => {
//     try {
//         const userId = req.user._id;
//
//         const allUsers = await UserModel.find({
//             approvalStatus: ApprovalStatus.Approved,
//             isActive: true,
//             _id: { $ne: userId }
//         }).select("_id");
//
//         const userIds = allUsers.map(user => user._id);
//
//         const existingRooms = await ChatRoomModel.find({
//             members: userId
//         }).lean();
//
//         const existingRoomMembers = new Set();
//         existingRooms.forEach(room => {
//             room.members.forEach(member => existingRoomMembers.add(member.toString()));
//         });
//
//         const newRooms = [];
//         for (const otherUserId of userIds) {
//             if (!existingRoomMembers.has(otherUserId.toString())) {
//                 const newRoom = await ChatRoomModel.create({
//                     isGroup: false,
//                     members: [userId, otherUserId],
//                     createdBy: userId
//                 });
//
//                 await UserChatMetaModel.create([
//                     { roomId: newRoom._id, userId: userId },
//                     { roomId: newRoom._id, userId: otherUserId }
//                 ]);
//
//                 newRooms.push(newRoom);
//             }
//         }
//
//         const rooms = await ChatRoomModel.find({
//             members: userId
//         })
//             .populate({
//                 path: "members",
//                 select: "fullName emailAddress profilePhoto status"
//             })
//             .populate({
//                 path: "lastMessage.sender",
//                 select: "fullName"
//             })
//             .sort({
//                 "lastMessage.messageTime": -1,
//                 createdAt: -1
//             })
//             .lean();
//
//         const userChatMeta = await UserChatMetaModel.find({ userId })
//             .lean()
//             .then(meta => {
//                 const metaMap = {};
//                 meta.forEach(m => {
//                     metaMap[m.roomId.toString()] = {
//                         isPinned: m.isPinned,
//                         isBlocked: m.isBlocked,
//                         lastSeen: m.lastSeen,
//                     };
//                 });
//                 return metaMap;
//             });
//
//         const result = rooms.map(room => ({
//             ...room,
//             userMeta: userChatMeta[room._id.toString()] || {
//                 isPinned: false,
//                 isBlocked: false,
//                 lastSeen: null,
//             }
//         }));
//
//         res.status(200).json({
//             success: true,
//             data: result
//         });
//     } catch (error) {
//         console.error("Error in getRoomsList:", error);
//         res.status(500).json({
//             success: false,
//             message: "Internal server error"
//         });
//     }
// };
//
// module.exports = {
//     getRoomsList,
// };
