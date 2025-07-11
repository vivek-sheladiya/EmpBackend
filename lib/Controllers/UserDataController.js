const { UserModel } = require("../Models/UserModel");
const jwt = require("jsonwebtoken");
const {
    handleError,
    findEmailAddress,
    findMobileNumber,
    hashPassword, toCamelCase, UserRole,
} = require("../utils/utils");
const environment = require("../../apiEndpoints");
const { Blob } = require("buffer");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

const addUpdateUser = async (req, res) => {
    try {
        const { role } = req.user;
        const { userId } = req.params;
        const userData = req.body;
        const { emailAddress, mobileNumber } = userData;

        if (userData.fullName) {
            userData.fullName = toCamelCase(userData.fullName);
        }

        if (userData.technology) {
            userData.technology = userData.technology.split(",");
        }

        if (req.file) {
            const form = new FormData();
            const blob = new Blob([req.file.buffer], { type: req.file.mimetype });

            form.append("image", blob, `${Date.now()}_${req.file.originalname}`);

            const response = await fetch(`${environment.apiBaseUrl}upload.php`, {
                method: "POST",
                body: form,
            });

            const result = await response.json();

            if (result.status === true) {
                userData.profilePhoto = environment.apiBaseUrl + result.file_url;
            }
        }

        if (userId) {
            const existingUser = await UserModel.findById(userId);
            if (!existingUser) {
                return handleError(res, "User not found", 404);
            }

            if (
                emailAddress &&
                emailAddress !== existingUser.emailAddress
            ) {
                const emailExist = await UserModel.findOne({
                    emailAddress,
                    _id: { $ne: userId },
                });
                if (emailExist) {
                    return handleError(res, "Email Address Already Registered", 400);
                }
            }

            if (
                mobileNumber &&
                mobileNumber !== existingUser.mobileNumber
            ) {
                const mobileExist = await UserModel.findOne({
                    mobileNumber,
                    _id: { $ne: userId },
                });
                if (mobileExist) {
                    return handleError(res, "Mobile Number Already Registered", 400);
                }
            }

            const updatedUser = await UserModel.findByIdAndUpdate(userId, userData, { new: true });
            const usersList = await UserModel.find(undefined, undefined, undefined);

            return res.status(200).json({
                success: true,
                message: "User updated successfully",
                data: role === UserRole.Admin ? usersList : updatedUser,
            });
        }

        const emailExist = await findEmailAddress(emailAddress);
        if (emailExist) {
            return handleError(res, "Email Address Already Registered", 400);
        }

        const mobileExist = await findMobileNumber(mobileNumber);
        if (mobileExist) {
            return handleError(res, "Mobile Number Already Registered", 400);
        }

        const verificationToken = jwt.sign(
            { emailAddress },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        const newUser = await UserModel.create({
            ...userData,
            password: await hashPassword(userData.password),
            googlePassword: userData.googlePassword ? await hashPassword(userData.googlePassword) : null,
            skypePassword: userData.skypePassword ? await hashPassword(userData.skypePassword) : null,
            verificationToken,
        });

        const usersList = await UserModel.find(undefined, undefined, undefined);

        return res.status(200).json({
            success: true,
            message: "User Added successfully",
            data: role === UserRole.Admin ? usersList : newUser,
        });

    } catch (err) {
        console.log(err);
        return handleError(res, err.message || "Something went wrong", 500);
    }
};

const addUsers = async (req, res) => {
    try {
        const { emailAddress, mobileNumber } = req.body;

        const userData = req.body;

        const emailExist = await findEmailAddress(emailAddress);
        if (emailExist) {
            return handleError(res, "Email Address Already Registered", 400);
        }
        const mobileExist = await findMobileNumber(mobileNumber);
        if (mobileExist) {
            return handleError(res, "Mobile Number Already Registered", 400);
        }

        const verificationToken = jwt.sign(
            { emailAddress },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        let fileUrl = "";

        if (req.file) {
            const form = new FormData();
            const blob = new Blob([req.file.buffer], { type: req.file.mimetype });

            form.append("image", blob, `${Date.now()}_${req.file.originalname}`);

            const response = await fetch(`${environment.apiBaseUrl}upload.php`, {
                method: "POST",
                body: form,
            });

            const result = await response.json();

            if (result.status === true) {
                userData.profilePhoto = environment.apiBaseUrl + result.file_url;
            }
        }
        if (userData && userData.fullName) {
            userData.fullName = toCamelCase(userData.fullName);
        }
        if (userData && userData.technology) {
            userData.technology = userData.technology.split(",");
        }
        await UserModel.create({
            ...userData,
            password: await hashPassword(userData.password),
            googlePassword: userData.googlePassword ? await hashPassword(userData.googlePassword) : null,
            skypePassword: userData.skypePassword ? await hashPassword(userData.skypePassword) : null,
            verificationToken,
            // employeeCode: generateEmployeeCode()
        });

        return res
            .status(201)
            .json({ success: true, message: "User Added Successfully" });
    } catch (err) {
        console.log(err);
        return handleError(res, err.message);
    }
};

const updateRecord = async (req, res) => {
    try {
        const { userId } = req.params;
        const updateData = req.body;

        const user = await UserModel.findById(userId);
        if (!user) {
            return handleError(res, "User not found", 404);
        }

        if (req.file) {
            const form = new FormData();
            const blob = new Blob([req.file.buffer], { type: req.file.mimetype });

            form.append("image", blob, `${Date.now()}_${req.file.originalname}`);

            const response = await fetch(`${environment.apiBaseUrl}upload.php`, {
                method: "POST",
                body: form,
            });

            const result = await response.json();

            if (result.status === true) {
                updateData.profilePhoto = environment.apiBaseUrl + result.file_url;
            }

        }

        if (updateData.technology) {
            updateData.technology = updateData.technology.split(",");
        }
        if (updateData && updateData.fullName) {
            updateData.fullName = toCamelCase(updateData.fullName);
        }

        const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, {
            new: true,
        });

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: updatedUser,
        });
    } catch (err) {
        console.log(err);
        return handleError(res, err);
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await UserModel.aggregate([
            {
                $lookup: {
                    from: "attendances",
                    localField: "_id",
                    foreignField: "userId",
                    as: "attendanceData",
                },
            },
        ]);

        return res.status(200).json({
            success: true,
            message: "Data fetched successfully",
            data: users,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const getUsersList = async (req, res) => {
    try {
        const users = await UserModel.find();

        return res.status(200).json({
            success: true,
            message: "Data fetched successfully",
            data: users,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const deletedUser = await UserModel.findByIdAndDelete(id);

        if (!deletedUser) {
            return handleError(res, "User not found", 400);
        }

        const usersList = await UserModel.find(undefined, undefined, undefined);

        return res.status(200).json({
            success: true,
            message: "User deleted successfully",
            data: usersList,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const getUserByEmail = async (req, res) => {
    const { emailAddress } = req.params;

    try {
        const user = await UserModel.findOne({ emailAddress });

        if (!user) {
            return handleError(res, "User not found", 400);
        }

        return res.status(200).json({
            success: true,
            message: "User retrieved successfully",
            data: user,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const getUserById = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await UserModel.findOne({ userId });

        if (!user) {
            return handleError(res, "User not found", 400);
        }

        return res.status(200).json({
            success: true,
            message: "User retrieved successfully",
            data: user,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const getUserByName = async (req, res) => {
    const { name } = req.params;

    try {
        const users = await UserModel.find({ fullName: name });

        if (users.length === 0) {
            return res
                .status(404)
                .json({ success: false, message: "No users found", data: [] });
        }

        return res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            data: users,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const userProfile = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await UserModel.findById(userId);
        if (!user) {
            return handleError(res, "User not found", 404);
        }

        return res.status(200).json({
            success: true,
            message: "Profile fetched successfully",
            data: user,
        });
    } catch (err) {
        console.log(err);
        return handleError(res, err.message);
    }
};

module.exports = {
    addUpdateUser,
    addUsers,
    getAllUsers,
    getUsersList,
    deleteUser,
    getUserByEmail,
    getUserById,
    getUserByName,
    updateRecord,
    userProfile,
};
