const { UserRole } = require("../utils/utils");
const { AppVersionModel } = require("../Models/AppVersionModel");
const semver = require("semver");

const appVersionListGenerate = async (loginUser) => {
    const versions = await AppVersionModel.find(undefined, undefined, undefined);
    const filteredData =
        loginUser.role === UserRole.Admin
            ? versions
            : versions.filter(
                (version) => version.createdBy.toString() === loginUser._id.toString()
            );
    return filteredData ? filteredData : [];
};

const addSoftApp = async (req, res) => {
    try {
        const body = req.body;
        const loginUser = req.user;

        if (!body.version || !semver.valid(body.version)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid version format." });
        }

        const existingVersion = await AppVersionModel.findOne({
            version: body.version,
        });
        if (existingVersion) {
            return res
                .status(400)
                .json({ success: false, message: "Version already exists." });
        }

        await AppVersionModel.create({
            ...body,
            createdBy: loginUser._id.toString(),
        });

        const versionList = await appVersionListGenerate(loginUser);
        return res.status(201).json({
            success: true,
            message: "App version added successfully.",
            data: versionList,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

const updateSoftApp = async (req, res) => {
    try {
        const id = req.params._id;
        const body = req.body;
        const loginUser = req.user;

        if (body.version && !semver.valid(body.version)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid version format." });
        }

        const version = await AppVersionModel.findById(id);
        if (!version) {
            return res
                .status(404)
                .json({ success: false, message: "App version not found." });
        }

        if (
            loginUser.role !== UserRole.Admin &&
            version.createdBy.toString() !== loginUser._id.toString()
        ) {
            return res
                .status(403)
                .json({ success: false, message: "Unauthorized to update this version." });
        }

        const updatedVersion = await AppVersionModel.findByIdAndUpdate(
            id,
            { ...body, createdBy: version.createdBy }, // Preserve original createdBy
            { new: true }
        );

        const versionList = await appVersionListGenerate(loginUser);
        return res.status(201).json({
            success: true,
            message: "App version updated successfully.",
            data: versionList,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

const deleteSoftApp = async (req, res) => {
    try {
        const id = req.params._id;
        const loginUser = req.user;

        const version = await AppVersionModel.findById(id);
        if (!version) {
            return res
                .status(404)
                .json({ success: false, message: "App version not found." });
        }

        if (
            loginUser.role !== UserRole.Admin &&
            version.createdBy.toString() !== loginUser._id.toString()
        ) {
            return res
                .status(403)
                .json({ success: false, message: "Unauthorized to delete this version." });
        }

        await AppVersionModel.findByIdAndDelete(id);
        const versionList = await appVersionListGenerate(loginUser);
        return res.status(200).json({
            success: true,
            message: "App version deleted successfully.",
            data: versionList,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

const getAllSoftApps = async (req, res) => {
    try {
        const loginUser = req.user;
        const versionList = await appVersionListGenerate(loginUser);
        return res.status(200).json({
            success: true,
            message: "App versions retrieved successfully.",
            data: versionList,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

const getSingleSoftApp = async (req, res) => {
    try {
        const id = req.params._id;
        const loginUser = req.user;

        const version = await AppVersionModel.findById(id);
        if (!version) {
            return res
                .status(404)
                .json({ success: false, message: "App version not found." });
        }

        if (
            loginUser.role !== UserRole.Admin &&
            version.createdBy.toString() !== loginUser._id.toString()
        ) {
            return res
                .status(403)
                .json({ success: false, message: "Unauthorized to view this version." });
        }

        return res.status(200).json({
            success: true,
            message: "App version retrieved successfully.",
            data: version,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

const isUpdateAvailable = async (req, res) => {
    try {
        const { currentVersion } = req.query;
        const loginUser = req.user;

        if (!currentVersion || !semver.valid(currentVersion)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid current version format." });
        }

        const versions = await appVersionListGenerate(loginUser);
        const latestVersion = versions.reduce((latest, version) => {
            return semver.gt(version.version, latest.version) ? version : latest;
        }, versions[0] || { version: "0.0.0" });

        if (!latestVersion || semver.lte(latestVersion.version, currentVersion)) {
            return res.status(200).json({
                success: true,
                message: "No updates available.",
                data: null,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Update available.",
            data: {
                latestVersion: latestVersion.version,
                releaseNotes: latestVersion.releaseNotes,
                forceUpdate: latestVersion.forceUpdate,
                platforms: {
                    windows: latestVersion.windows,
                    macOs: latestVersion.macOs,
                    linux: latestVersion.linux,
                },
            },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

module.exports = {
    addSoftApp,
    updateSoftApp,
    deleteSoftApp,
    getAllSoftApps,
    getSingleSoftApp,
    isUpdateAvailable,
    appVersionListGenerate,
};