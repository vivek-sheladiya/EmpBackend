const {
    ProjectModel
} = require("../Models/ProjectModel");
const {
    handleError, generateRandomId,
} = require("../utils/utils");
const environment = require("../../apiEndpoints");
const {
    Blob
} = require("buffer");

const projectList = async (req, res) => {
    try {
        const projectData = await ProjectModel.find();

        return res.status(200).json({
            success: true,
            message: "Data fetched successfully",
            data: projectData,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

const updateProject = async (req, res) => {
    try {
        const {id} = req.params;

        if (id) {
            const updateData = req.body;

            if (updateData.attachFiles && typeof updateData.attachFiles === 'string') {
                try {
                    updateData.attachFiles = JSON.parse(updateData.attachFiles);
                } catch (error) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid JSON format in attachFiles",
                    });
                }
            }

            const existingProject = await ProjectModel.findById(id);
            if (!existingProject) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found",
                });
            }

            await ProjectModel.findByIdAndUpdate(id, updateData, {new: true});

            const projects = await ProjectModel.find();

            return res.status(200).json({
                success: true,
                message: "Project updated successfully",
                data: projects,
            });
        } else {
            const {
                projectName,
                projectDescription,
                clientName,
                projectType,
                startDate,
                endDate,
                projectStatus,
                isActive,
                projectPriority,
                teamMembers,
                attachFiles,
                teamLeader,
                teamManager,
                tags,
            } = req.body;
            const newTask = new ProjectModel({
                projectId: generateRandomId(),
                projectName: projectName || '',
                projectDescription: projectDescription || '',
                clientName: clientName || '',
                projectType: projectType || '',
                projectStatus: projectStatus || '',
                projectPriority: projectPriority || '',
                teamMembers: Array.isArray(teamMembers)
                    ? teamMembers.map(user => ({userId: user.userId}))
                    : [],
                teamLeader: Array.isArray(teamLeader)
                    ? teamLeader.map(user => ({userId: user.userId}))
                    : [],
                teamManager: Array.isArray(teamManager)
                    ? teamManager.map(user => ({userId: user.userId}))
                    : [],
                isActive: isActive || false,
                tags: tags || '',
                startDate: startDate || null,
                endDate: endDate || null,
                attachFiles: Array.isArray(attachFiles) ? attachFiles : [],
            });

            await newTask.save();

            const projects = await ProjectModel.find();

            return res.status(201).json({
                success: true,
                message: "Project Added Successfully",
                data: projects,
            });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

const deleteProject = async (req, res) => {
    const {
        id
    } = req.params;

    try {
        const deletedProject = await ProjectModel.findByIdAndDelete(id);

        if (!deletedProject) {
            return handleError(res, "Leave not found", 400);
        }

        return res.status(200).json({
            success: true,
            message: "Project deleted successfully",
            data: deletedProject,
        });
    } catch (err) {
        return handleError(res, err.message);
    }
};

module.exports = {
    projectList,
    updateProject,
    deleteProject
};