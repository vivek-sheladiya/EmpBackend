// const { ChatRoomModel } = require("../Models/ChatRoom");
// const { MessageModel } = require("../Models/MessageModel");
// const { processSingleFile } = require("../Controllers/TaskController");
// const upload = require("../../imageUploader");
const {getRoomsList, createChatRoom, sendMessage, getMessages} = require("../Controllers/ChattingController");
const {chatHandler} = require("../Controllers/ChatControllerNew");
const {CallHistoryModel} = require("../Models/ChatRoom");
const router = require("express").Router();


router.post('/createChatRoom', createChatRoom);
router.get('/getRoomsList', getRoomsList);
router.post('/sendMessage', sendMessage);
router.get('/getMessages', getMessages);
router.all('/chat/:messageId?', chatHandler);

router.post('/saveCall', async (req, res) => {
    try {
        const { callerId, calleeId, startTime, endTime, status, callType } = req.body;
        const call = new CallHistoryModel({ callerId, calleeId, startTime, endTime, status, callType });
        await call.save();
        res.status(201).json({ message: 'Call saved' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/history/:userId', async (req, res) => {
    try {
        const history = await CallHistoryModel.find({
            $or: [{ callerId: req.params.userId }, { calleeId: req.params.userId }]
        }).sort({ startTime: -1 });
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
