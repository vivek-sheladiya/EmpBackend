const {
    handleError,
} = require("../utils/utils");
const { clientProjectModel } = require('../Models/clientProjectModel')
const { ProjectModel } = require('../Models/ProjectModel')

const clientProjectList = async (req, res) => {
    try {
        const clients = await clientProjectModel.find({});
        const populatedClients = await Promise.all(clients.map(async (client) => {
            const matchedProjects = await ProjectModel.find({ clientName: client.clientName });
            return {
                ...client.toObject(),
                projects: matchedProjects
            };
        }));
        return res.status(201).json({ success: true, message: "Client Project List Get Successfully.", data: populatedClients });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const addClient = async (req, res) => {
    try {
        const body = req.body
        const clientAdd = await clientProjectModel.create(body)
        const clients = await clientProjectModel.find();
        const clientList = await Promise.all(clients.map(async (client) => {
            const matchedProjects = await ProjectModel.find({ clientName: client.clientName });
            return {
                ...client.toObject(),
                projects: matchedProjects
            };
        }));
        return res.status(201).json({ success: true, message: "Client Project Added Successfully.", data: clientList });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const deleteClientProject = async (req, res) => {
    try {
        const id = req.params._id;
        const client = await clientProjectModel.findById(id);
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }
        const existingProjects = await ProjectModel.find({ clientName: client.clientName });
        if (existingProjects.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete client. Projects are linked to this client."
            });
        }
        await clientProjectModel.findByIdAndDelete(id);
        const clients = await clientProjectModel.find();
        const clientList = await Promise.all(clients.map(async (client) => {
            const matchedProjects = await ProjectModel.find({ clientName: client.clientName });
            return {
                ...client.toObject(),
                projects: matchedProjects
            };
        }));
        return res.status(200).json({
            success: true,
            message: "Client Project Deleted Successfully.",
            data: clientList
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

const updateClientProject = async (req, res) => {
    try {
        const id = req.params._id
        const body = req.body
        const clientDelete = await clientProjectModel.findByIdAndUpdate({ _id: id }, body, { new: true });
        const clients = await clientProjectModel.find();
        const clientList = await Promise.all(clients.map(async (client) => {
            const matchedProjects = await ProjectModel.find({ clientName: client.clientName });
            return {
                ...client.toObject(),
                projects: matchedProjects
            };
        }));
        return res.status(201).json({ success: true, message: "Client Project Updated Successfully.", data: clientList });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

module.exports = {
    addClient,
    clientProjectList,
    deleteClientProject,
    updateClientProject
}