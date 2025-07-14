const { handleError, generateRandomId, UserRole } = require("../utils/utils");
const {OfficeUpdateModel} = require("../Models/OfficeUpdateModel");
const {ChatRoomModel, MessageModel} = require("../Models/ChatRoom");
const {UserModel} = require("../Models/UserModel");

const getOfficeUpdateList = async (loginUser) => {
    let officeUpdates;

    if (loginUser.role === UserRole.Admin) {
        officeUpdates = await OfficeUpdateModel.find()
            .populate('createdBy', 'name email');
    } else {
        officeUpdates = await OfficeUpdateModel.find(
            { createdBy: loginUser._id },
            {
                updateId: 1,
                isDaily: 1,
                showTime: 1,
                isForDailyUpdate: 1,
                title: 1,
                description: 1,
                windowLink: 1,
                createdBy: 1,
                createdAt: 1,
                updatedAt: 1,
            }
        )
            .populate('createdBy', 'name email');
    }

    return officeUpdates;
};

const addOfficeUpdate = async (req, res) => {
    try {
        const {
            isDaily,
            showTime,
            isForDailyUpdate,
            title,
            description,
            windowLink,
        } = req.body;

        if (!showTime || !title || !description) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
            });
        }

        const newOfficeUpdate = new OfficeUpdateModel({
            updateId: generateRandomId(),
            isDaily: isDaily || false,
            showTime,
            isForDailyUpdate: isForDailyUpdate || false,
            title,
            description,
            windowLink,
            createdBy: req.user._id,
        });

        await newOfficeUpdate.save();

        const officeUpdates = await getOfficeUpdateList(req.user);

        return res.status(201).json({
            success: true,
            message: "Office update added successfully",
            data: officeUpdates,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const updateOfficeUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Update ID is required",
            });
        }

        const existingUpdate = await OfficeUpdateModel.findById(id);
        if (!existingUpdate) {
            return res.status(404).json({
                success: false,
                message: "Office update not found",
            });
        }

        // Restrict updates to the creator or admins
        if (existingUpdate.createdBy.toString() !== req.user._id.toString() && req.user.role !== UserRole.Admin) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to update this office update",
            });
        }

        await OfficeUpdateModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        const officeUpdates = await getOfficeUpdateList(req.user);

        return res.status(200).json({
            success: true,
            message: "Office update updated successfully",
            data: officeUpdates,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const getOfficeUpdate = async (req, res) => {
    try {
        const { id } = req.params;

        if (id) {
            const officeUpdate = await OfficeUpdateModel.findById(id)
                .populate('createdBy', 'name email');

            if (!officeUpdate) {
                return res.status(404).json({
                    success: false,
                    message: "Office update not found",
                });
            }

            // Restrict access to the creator or admins
            if (officeUpdate.createdBy.toString() !== req.user._id.toString() && req.user.role !== UserRole.Admin) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized to view this office update",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Office update retrieved successfully",
                data: officeUpdate,
            });
        }

        const officeUpdates = await getOfficeUpdateList(req.user);

        return res.status(200).json({
            success: true,
            message: "Office updates retrieved successfully",
            data: officeUpdates,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const deleteOfficeUpdate = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Update ID is required",
            });
        }

        const existingUpdate = await OfficeUpdateModel.findById(id);
        if (!existingUpdate) {
            return res.status(404).json({
                success: false,
                message: "Office update not found",
            });
        }

        if (existingUpdate.createdBy.toString() !== req.user._id.toString() && req.user.role !== UserRole.Admin) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to delete this office update",
            });
        }

        await OfficeUpdateModel.findByIdAndDelete(id);

        const officeUpdates = await getOfficeUpdateList(req.user);

        return res.status(200).json({
            success: true,
            message: "Office update deleted successfully",
            data: officeUpdates,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const officeUpdates = (expressApp) => {
    expressApp.get('/officeUpdate', async (req, res) => {

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        let isAnyChange = false;

        const officeUpdateStream = OfficeUpdateModel.watch();
        officeUpdateStream.on('change', async (change) => {
            isAnyChange = true;
        });

        const interval = setInterval(async () => {
            if (isAnyChange) {
                try {
                    const currentDate = new Date();
                    const officeUpdateData = await OfficeUpdateModel.find({
                        showTime: { $gt: currentDate },
                    });
                    isAnyChange = false;
                    res.write(`data: ${JSON.stringify(officeUpdateData)}\n\n`);
                } catch (err) {
                    console.log("Error->", err);
                }
            }
        }, 1000);

        req.on('close', () => {
            clearInterval(interval);
            officeUpdateStream.close();
            res.end();
            console.log(`SSE connection closed for user`);
        });
    });
};

module.exports = {
    addOfficeUpdate,
    updateOfficeUpdate,
    getOfficeUpdate,
    deleteOfficeUpdate,
    officeUpdates,
};