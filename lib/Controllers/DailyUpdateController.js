const { DailyUpdateModel } = require("../models/DailyUpdateModel");
const { handleError, generateRandomId, UserRole } = require("../utils/utils");

const getDailyUpdateList = async (loginUser) => {
    let dailyUpdates;

    if (loginUser.role === UserRole.Admin) {
        dailyUpdates = await DailyUpdateModel.find()
            .populate('user', 'fullName emailAddress profilePhoto');
    } else {
        dailyUpdates = await DailyUpdateModel.find(
            { createdBy: loginUser._id },
            {
                updateId: 1,
                user: 1,
                todayWorkUpdate: 1,
                tomorrowPlanning: 1,
                createdBy: 1,
                createdAt: 1,
                updatedAt: 1,
            }
        )
            .populate('user', 'fullName emailAddress profilePhoto');
    }

    return dailyUpdates;
};

const addDailyUpdate = async (req, res) => {
    try {
        const { todayWorkUpdate, tomorrowPlanning } = req.body;

        if (!todayWorkUpdate || !tomorrowPlanning) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
            });
        }

        console.log("req.user._id", req.user._id);

        const newDailyUpdate = new DailyUpdateModel({
            updateId: generateRandomId(),
            user: req.user._id,
            todayWorkUpdate,
            tomorrowPlanning,
            createdBy: req.user._id,
        });

        await newDailyUpdate.save();

        const dailyUpdates = await getDailyUpdateList(req.user);

        return res.status(201).json({
            success: true,
            message: "Daily update added successfully",
            data: dailyUpdates,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const updateDailyUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Update ID is required",
            });
        }

        const existingUpdate = await DailyUpdateModel.findById(id);
        if (!existingUpdate) {
            return res.status(404).json({
                success: false,
                message: "Daily update not found",
            });
        }

        // Restrict updates to the creator or admins
        if (existingUpdate.createdBy.toString() !== req.user._id.toString() && req.user.role !== UserRole.Admin) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to update this daily update",
            });
        }

        await DailyUpdateModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        const dailyUpdates = await getDailyUpdateList(req.user);

        return res.status(200).json({
            success: true,
            message: "Daily update updated successfully",
            data: dailyUpdates,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const getDailyUpdate = async (req, res) => {
    try {
        const { id } = req.params;

        if (id) {
            const dailyUpdate = await DailyUpdateModel.findById(id)
                .populate('user', 'fullName emailAddress profilePhoto');

            if (!dailyUpdate) {
                return res.status(404).json({
                    success: false,
                    message: "Daily update not found",
                });
            }

            // Restrict access to the creator or admins
            if (dailyUpdate.createdBy.toString() !== req.user._id.toString() && req.user.role !== UserRole.Admin) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized to view this daily update",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Daily update retrieved successfully",
                data: dailyUpdate,
            });
        }

        const dailyUpdates = await getDailyUpdateList(req.user);

        return res.status(200).json({
            success: true,
            message: "Daily updates retrieved successfully",
            data: dailyUpdates,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const getAllDailyUpdate = async (req, res) => {
    try {
        const dailyUpdate = await DailyUpdateModel.find()
            .populate('user', 'fullName emailAddress profilePhoto');

        if (!dailyUpdate) {
            return res.status(404).json({
                success: false,
                message: "Daily update not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Daily updates retrieved successfully",
            data: dailyUpdate,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

module.exports = {
    addDailyUpdate,
    updateDailyUpdate,
    getDailyUpdate,
    getAllDailyUpdate,
};