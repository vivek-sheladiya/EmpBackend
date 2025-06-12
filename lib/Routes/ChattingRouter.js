// const { ChatRoomModel } = require("../Models/ChatRoom");
// const { MessageModel } = require("../Models/MessageModel");
// const { processSingleFile } = require("../Controllers/TaskController");
// const upload = require("../../imageUploader");
const {getRoomsList, createChatRoom, sendMessage, getMessages} = require("../Controllers/ChattingController");
const {chatHandler} = require("../Controllers/ChatControllerNew");
const router = require("express").Router();


router.post('/createChatRoom', createChatRoom);
router.get('/getRoomsList', getRoomsList);
router.post('/sendMessage', sendMessage);
router.get('/getMessages', getMessages);
router.all('/chat', chatHandler);

// Create or get existing room
// router.post("/chat/room", async (req, res) => {
//     try {
//         const { userIds, isGroup, groupName, groupPhoto, createdBy } = req.body;
//
//         if (!Array.isArray(userIds) || userIds.length < 2) {
//             return res.status(400).json({ message: "At least two userIds required" });
//         }
//
//         // Check if room with these users exists (only for 1-1)
//         if (!isGroup) {
//             const existing = await ChatRoomModel.findOne({
//                 isGroup: false,
//                 userIds: { $all: userIds, $size: userIds.length },
//             });
//             if (existing) return res.json({ room: existing });
//         }
//
//         const newRoom = new ChatRoomModel({
//             userIds,
//             isGroup,
//             name: isGroup ? groupName : null,
//             groupPhoto: groupPhoto || null,
//             createdBy,
//             lastMessage: null,
//         });
//         await newRoom.save();
//         res.json({ room: newRoom });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// });
//
// // Get rooms for a user
// router.post("/chat/rooms", async (req, res) => {
//     try {
//         const { userIds, isGroup, createdBy } = req.body;
//         if (!userIds || !Array.isArray(userIds) || userIds.length < 2) {
//             return res.status(400).json({ message: "userIds must be an array with at least 2 users" });
//         }
//         if (!createdBy) {
//             return res.status(400).json({ message: "createdBy is required" });
//         }
//
//         // Check if room already exists for exactly the same users (for 1-1 chat)
//         let room = await ChatRoomModel.findOne({
//             userIds: { $all: userIds, $size: userIds.length },
//             isGroup: isGroup || false,
//         });
//
//         if (!room) {
//             room = new ChatRoomModel({
//                 userIds,
//                 isGroup: isGroup || false,
//                 createdBy,
//                 name: isGroup ? req.body.name || "Group Chat" : null,
//                 createdAt: new Date(),
//             });
//             await room.save();
//         }
//
//         res.status(201).json({ room });
//     } catch (err) {
//         res.status(500).json({ message: err.message });
//     }
// });
//
//
// // Get messages for a room
// router.get("/chat/messages", async (req, res) => {
//     const { roomId } = req.query;
//     if (!roomId) return res.status(400).json({ message: "roomId required" });
//     try {
//         const messages = await MessageModel.find({ roomId }).sort({ createdAt: -1 });
//         res.json({ messages });
//     } catch (err) {
//         res.status(500).json({ message: err.message });
//     }
// });
//
// // Send message with optional attachments
// router.post(
//     "/chat/message",
//     upload.array("attachments"),
//     async (req, res) => {
//         try {
//             const { roomId, sender, text } = req.body;
//             if (!roomId || !sender) {
//                 return res.status(400).json({ message: "roomId and sender required" });
//             }
//             // Save attachments
//             const attachments = [];
//             if (req.files && req.files.length > 0) {
//                 for (const file of req.files) {
//                     const processed = await processSingleFile(file);
//                     attachments.push(processed);
//                 }
//             }
//
//             const newMsg = new MessageModel({
//                 roomId,
//                 sender,
//                 text,
//                 attachments,
//             });
//             await newMsg.save();
//
//             // Update last message on room
//             await ChatRoomModel.findByIdAndUpdate(roomId, { lastMessage: newMsg });
//
//             res.json({ message: newMsg });
//         } catch (error) {
//             res.status(500).json({ message: error.message });
//         }
//     }
// );

module.exports = router;
