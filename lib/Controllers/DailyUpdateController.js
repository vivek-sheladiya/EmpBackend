const { handleError, generateRandomId, UserRole } = require("../utils/utils");
const {DailyUpdateModel} = require("../Models/DailyUpdateModel");
const dayjs = require("dayjs");
const {compareTwoStrings} = require("string-similarity");

const getDailyUpdateList = async (loginUser) => {
    let dailyUpdates;

    dailyUpdates = await DailyUpdateModel.find()
        .populate('user', 'fullName emailAddress profilePhoto');

    return dailyUpdates;
};

const getTodayUpdate = async (req, res) => {
    try {
        const userId = req.user._id;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required",
            });
        }

        const startOfToday = dayjs().startOf("day").toDate();
        const endOfToday = dayjs().endOf("day").toDate();

        const todayUpdate = await DailyUpdateModel.findOne({
            user: userId,
            createdAt: {
                $gte: startOfToday,
                $lte: endOfToday,
            },
        }).populate("user", "fullName emailAddress profilePhoto");

        return res.status(200).json({
            success: true,
            data: todayUpdate || null,
            message: todayUpdate ? "Daily update found" : "No update found for today",
        });
    } catch (err) {
        console.error("getTodayUpdateByUserId error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};

const getFilteredDailyUpdates = async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.query;

        const filter = {};
        const applySimilarity = userId && startDate && endDate;

        if (userId) filter.user = userId;

        if (startDate && endDate) {
            filter.createdAt = {
                $gte: dayjs(startDate).startOf("day").toDate(),
                $lte: dayjs(endDate).endOf("day").toDate(),
            };
        } else if (startDate) {
            filter.createdAt = {
                $gte: dayjs(startDate).startOf("day").toDate(),
                $lte: dayjs(startDate).endOf("day").toDate(),
            };
        } else {
            filter.createdAt = {
                $gte: dayjs().startOf("day").toDate(),
                $lte: dayjs().endOf("day").toDate(),
            };
        }

        let updates = await DailyUpdateModel.find(filter)
            .populate("user", "fullName emailAddress profilePhoto")
            .lean();

        updates = updates.map((item) => ({
            ...item,
            date: dayjs(item.createdAt).format("YYYY-MM-DD"),
            tasks: item.todayWorkUpdate
                ? item.todayWorkUpdate.split("\n").map(str => str.trim()).filter(str =>
                    !!str &&
                    !/(.)\1{3,}/.test(str)
                )
                : [],
            similarTasks: []
        }));

        if (applySimilarity) {
            for (let i = 0; i < updates.length; i++) {
                const updateA = updates[i];

                for (const taskA of updateA.tasks) {
                    for (let j = 0; j < updates.length; j++) {
                        if (i === j) continue;

                        const updateB = updates[j];

                        for (const taskB of updateB.tasks) {
                            const similarity = compareTwoStrings(taskA, taskB);

                            if (similarity >= 0.7) {
                                updateA.similarTasks.push({
                                    task: taskA,
                                    similarWith: taskB,
                                    comparedDate: updateB.date,
                                    similarity: similarity.toFixed(2),
                                });
                            }
                        }
                    }
                }
            }
        }

        return res.status(200).json({
            success: true,
            data: updates.map(({ tasks, ...rest }) => rest),
        });
    } catch (error) {
        console.error("Daily Update API Error:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong",
            error: error.message,
        });
    }
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

        const userId = req.user._id;

        const startOfToday = dayjs().startOf('day').toDate();
        const endOfToday = dayjs().endOf('day').toDate();

        const existingUpdate = await DailyUpdateModel.findOne({
            user: userId,
            createdAt: { $gte: startOfToday, $lte: endOfToday },
        });

        if (existingUpdate) {
            await DailyUpdateModel.findOneAndUpdate(
                { _id: existingUpdate._id },
                {
                    todayWorkUpdate,
                    tomorrowPlanning,
                    updatedAt: new Date(),
                },
                { new: true }
            );
        } else {
            const newDailyUpdate = new DailyUpdateModel({
                user: userId,
                todayWorkUpdate,
                tomorrowPlanning,
                createdBy: userId,
            });

            await newDailyUpdate.save();
        }

        const dailyUpdates = await getDailyUpdateList(userId);

        return res.status(200).json({
            success: true,
            message: existingUpdate ? "Daily update updated successfully" : "Daily update added successfully",
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
    getTodayUpdate,
    addDailyUpdate,
    updateDailyUpdate,
    getDailyUpdate,
    getAllDailyUpdate,
    getFilteredDailyUpdates,
};