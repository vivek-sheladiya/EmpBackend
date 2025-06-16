const { handleError, UserRole, ApprovalStatus } = require("../utils/utils");
const { UserModel } = require("../Models/UserModel");
const { ChatRoomModel, UserChatMetaModel, MessageModel } = require("../Models/ChatRoom");
const mongoose = require("mongoose");
const {HolidayEventModel} = require("../Models/HolidayEventModel");
const {getMessaging} = require("firebase-admin/messaging");

const chatHandler = async (req, res) => {
    const { action } = req.method === 'GET' ? req.query : req.body;
    try {
        const userId = req.user._id;

        if (!action) {
            return res.status(400).json({
                success: false,
                message: "Action parameter is required",
            });
        }

        switch (action) {
            case 'createRoom': {
                const { otherUserId } = req.body;
                if (!otherUserId) {
                    return res.status(400).json({
                        success: false,
                        message: "otherUserId is required for creating a one-on-one chat",
                    });
                }
                return await createChatRoomHandler(req, res, [otherUserId], false);
            }

            case 'createGroup': {
                const { userIds, groupName, groupPhoto } = req.body;
                if (!userIds || !Array.isArray(userIds) || userIds.length < 2) {
                    return res.status(400).json({
                        success: false,
                        message: "A group chat must have at least 3 members (including the creator)",
                    });
                }
                return await createChatRoomHandler(req, res, userIds, true, groupName, groupPhoto);
            }

            case 'sendMessage': {
                const { messageId, roomId, message, attachments, replyMessageId, replyMessageValue, messageType = "text" } = req.body;
                return await sendMessageHandler(req, res, messageId, roomId, userId, message, attachments, replyMessageId, replyMessageValue, messageType);
            }

            case 'getMessages': {
                const { roomId } = req.query;
                if (!roomId) {
                    return res.status(400).json({
                        success: false,
                        message: "roomId is required for fetching messages",
                    });
                }
                return await getMessagesHandler(req, res, roomId, userId);
            }

            case 'getRooms': {
                return await getRoomsHandler(req, res, userId);
            }

            case 'markMessagesAsRead': {
                const { roomId } = req.body;
                if (!roomId) {
                    return res.status(400).json({
                        success: false,
                        message: "roomId is required for marking messages as read",
                    });
                }
                return await markMessagesAsReadHandler(req, res, roomId, userId);
            }

            case 'getRoomWithMessages': {
                const getRoomWithMessagesData = await getRoomWithMessages(userId);

                return res.status(200).json({
                    success: true,
                    message: "Data fetched successfully",
                    data: getRoomWithMessagesData,
                });
            }

            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid action",
                });
        }
    } catch (error) {
        console.error(`Error in chatHandler (${action}):`, error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const createChatRoomHandler = async (req, res, userIds, isGroup, groupName, groupPhoto) => {
    const userId = req.user._id;

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

    const members = [...new Set([...userIds, userId])];

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

    return res.status(201).json({
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
};

const sendMessageHandler = async (req, res, messageId, roomId, sender, message, attachments, replyMessageId, replyMessageValue, messageType) => {
    if(messageId) {
        if (!messageId) {
            return res.status(400).json({ success: false, message: "MessageId is required" });
        }

        await MessageModel.findByIdAndUpdate(messageId, {
            message: message?.trim(),
            attachments: attachments,
            replyMessageId: replyMessageId,
            replyMessageValue: replyMessageValue,
            messageType,
        }, { new: true });

        return res.status(200).json({
            success: true,
            message: "Message Update Successfully",
        });

    } else {
        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: "roomId is required for sending a message",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(sender)) {
            return res.status(400).json({
                success: false,
                message: "Invalid room ID or sender ID",
            });
        }

        if (sender.toString() !== req.user._id.toString()) {
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

        if (!room.members.map(m => m.toString()).includes(sender.toString())) {
            return res.status(400).json({
                success: false,
                message: "Sender is not a member of this chat room",
            });
        }

        const newMessage = new MessageModel({
            roomId,
            sender,
            message: message?.trim(),
            attachments: attachments,
            replyMessageId: replyMessageId,
            replyMessageValue: replyMessageValue,
            messageType,
        });

        room.members.forEach(member => {
            const memberId = member.toString();
            newMessage.isReadBy.set(memberId, memberId === sender.toString());
        });

        await newMessage.save();

        await newMessage.populate("sender", "fullName");

        room.lastMessage = {
            message: messageType === "text" ? message : messageType,
            messageTime: newMessage.createdAt,
            sender,
        };
        await room.save();

        const messages = await MessageModel.find({ roomId })
            .sort({ createdAt: -1 })
            .populate("sender", "fullName");

        await sendNotificationToRoomMembers(roomId, sender, messageType === "text" ? message : messageType);

        return res.status(200).json({
            success: true,
            message: "Message Sent Successfully",
            data: {
                messages: messages.reverse(),
            },
        });
    }
};

const getMessagesHandler = async (req, res, roomId, userId) => {
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

    const userIdStr = userId.toString();
    if (!room.members.map(m => m.toString()).includes(userIdStr)) {
        return res.status(400).json({
            success: false,
            message: "User is not a member of this chat room",
        });
    }

    await MessageModel.updateMany(
        {
            roomId,
            // $or: [
            //     { isReadBy: { $exists: false } },
            //     { isReadBy: { $eq: {} } },
            //     { [`isReadBy.${userId}`]: { $ne: true } }
            // ],
            [`isReadBy.${userId}`]: { $ne: true },
            sender: { $ne: userId }
        },
        { $set: { [`isReadBy.${userId}`]: true } }
    );

    const { messages, totalMessages, unreadMessages, lastSeen } = await getRoomMessagesWithExtraData(roomId, userId);

    return res.status(200).json({
        success: true,
        data: {
            messages,
            totalMessages,
            unreadMessages,
            lastSeen,
        },
    });
};

const getRoomsHandler = async (req, res, userId) => {
    const result = await getRooms(userId);
    return res.status(200).json({
        success: true,
        data: result,
    });
};

const getRoomWithMessages = async (userId) => {
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

    const roomsWithMessages = await Promise.all(
        rooms.map(async (room) => {
            const roomId = room._id.toString();
            const { messages, totalMessages, unreadMessages, lastSeen } = await getRoomMessagesWithExtraData(roomId, userId);

            return {
                ...room,
                userMeta: userChatMeta[roomId] || {
                    isPinned: false,
                    isBlocked: false,
                    lastSeen: null,
                },
                messagesData: {
                    messages,
                    totalMessages,
                    unreadMessages,
                    lastSeen
                }
            };
        })
    );

    return roomsWithMessages;
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

    //const { messages, totalMessages, unreadMessages, lastSeen } = await getRoomMessagesWithExtraData(roomId, userId);

    return rooms.map(room => ({
        ...room,
        userMeta: userChatMeta[room._id.toString()] || {
            isPinned: false,
            isBlocked: false,
            lastSeen: null,
        },
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
        $or: [
            { [`isReadBy.${userId}`]: { $ne: true } },
            { [`isReadBy.${userId}`]: { $exists: false } }
        ],
        sender: { $ne: userId }
    });
};

const markMessagesAsReadHandler = async (req, res, roomId, userId) => {
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

    const userIdStr = userId.toString();
    if (!room.members.map(m => m.toString()).includes(userIdStr)) {
        return res.status(400).json({
            success: false,
            message: "User is not a member of this chat room",
        });
    }

    // Mark all unread messages in this room as read by the user
    await MessageModel.updateMany(
        { roomId, "isReadBy": { $ne: { [userId]: true } }, sender: { $ne: userId } },
        { $set: { [`isReadBy.${userId}`]: true } }
    );

    // Fetch updated messages
    const { messages, totalMessages, unreadMessages, lastSeen } = await getRoomMessagesWithExtraData(roomId, userId);

    return res.status(200).json({
        success: true,
        message: "Messages marked as read",
        data: {
            messages,
            totalMessages,
            unreadMessages,
            lastSeen,
        },
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

const chatUpdates = (expressApp) => {
    expressApp.get('/chatUpdates', async (req, res) => {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).send('Invalid userId');
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        let isAnyChange = false;
        let affectedRoomIds = new Set();

        // Watch for changes in ChatRoomModel (new rooms, updates to lastMessage, etc.)
        const roomChangeStream = ChatRoomModel.watch();
        roomChangeStream.on('change', async (change) => {
            const roomId = change.documentKey?._id?.toString();
            const room = await ChatRoomModel.findById(roomId).lean();

            if (room && room.members.map(m => m.toString()).includes(userId)) {
                isAnyChange = true;
                affectedRoomIds.add(roomId);
            }
        });

        // Watch for changes in MessageModel (new messages, updates to isReadBy, etc.)
        const messageChangeStream = MessageModel.watch();
        messageChangeStream.on('change', async (change) => {
            const message = change.fullDocument || (await MessageModel.findById(change.documentKey?._id).lean());
            if (message) {
                const roomId = message.roomId.toString();
                const room = await ChatRoomModel.findById(roomId).lean();

                if (room && room.members.map(m => m.toString()).includes(userId.toString())) {
                    isAnyChange = true;
                    affectedRoomIds.add(roomId);
                }
            }
        });

        // Periodically send updates to the client
        const interval = setInterval(async () => {
            if (isAnyChange) {
                try {
                    const updatedData = {};

                    // Fetch updated rooms
                    const rooms = await getRooms(userId);
                    updatedData.rooms = rooms;

                    // Fetch updated messages for affected rooms
                    const updatedMessages = {};
                    let updatedMessagesData = [];
                    for (const roomId of affectedRoomIds) {
                        const messagesData2 = await getRoomWithMessages(userId);
                        const messagesData = await getRoomMessagesWithExtraData(roomId, userId);
                        updatedMessages[roomId] = messagesData;
                        updatedMessagesData = messagesData2;
                    }
                    updatedData.messages = updatedMessages;
                    updatedData.messagesData = updatedMessagesData;

                    isAnyChange = false;
                    affectedRoomIds.clear();

                    res.write(`data: ${JSON.stringify(updatedData)}\n\n`);
                } catch (err) {
                    console.error("Error in chatUpdates:", err);
                }
            }
        }, 1000);

        req.on('close', () => {
            clearInterval(interval);
            roomChangeStream.close();
            messageChangeStream.close();
            res.end();
            console.log(`SSE connection closed for user ${userId}`);
        });
    });
};

const sendNotificationToRoomMembers = async (roomId, senderId, messageText) => {
    try {
        const room = await ChatRoomModel.findById(roomId).populate("members", "fullName emailAddress profilePhoto status fcmToken");

        if (!room) {
            console.error("Room not found");
            return;
        }

        const recipients = room.members.filter(m => m._id.toString() !== senderId && m.fcmToken);

        const sender = room.members.find(m => m._id.toString() === senderId.toString());

        if (!sender) {
            console.error("Sender not found in the room");
            return;
        }

        const notificationPromises = recipients.map((recipient) => {
            const message = {
                token: recipient.fcmToken,
                notification: {
                    title: `${sender.fullName}`,
                    body: messageText,
                },
                data: {
                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                    senderId: senderId.toString(),
                    roomId: roomId.toString(),
                },
            };

            return getMessaging().send(message);
        });

        const results = await Promise.allSettled(notificationPromises);

        results.forEach((result, index) => {
            const recipient = recipients[index];
            if (result.status === "fulfilled") {
                console.log(`✅ Notification sent to ${recipient.fullName}`);
            } else {
                console.error(`❌ Failed to send to ${recipient.fullName}:`, result.reason);
            }
        });
    } catch (error) {
        console.error("❌ Error sending notifications:", error);
    }
};

module.exports = { chatHandler, getRooms, getRoomMessagesWithExtraData, chatUpdates, markMessagesAsReadHandler, getRoomWithMessages, sendNotificationToRoomMembers };