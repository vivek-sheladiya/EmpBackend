const {
    handleError, UserRole,
} = require("../utils/utils");
const { ClientModel } = require('../Models/ClientModel')
const { ProjectModel } = require('../Models/ProjectModel')

const clientListGenerate = async (loginUser) => {
    const clients = await ClientModel.find(undefined, undefined, undefined);
    const filteredData = loginUser.role === UserRole.Admin ? clients : clients.filter((data) => data.addedBy.toString() === loginUser._id.toString());
    const populatedClients = await Promise.all(filteredData.map(async (client) => {
        const matchedProjects = await ProjectModel.find({clientName: client._id}, undefined, undefined);
        return {
            ...client.toObject(),
            projects: matchedProjects
        };
    }));

    return populatedClients ? populatedClients : [];
}

const clientProjectList = async (req, res) => {
    try {
        const loginUser = req.user;
        const clientList = await clientListGenerate(loginUser);
        return res.status(201).json({ success: true, message: "Client List Get Successfully.", data: clientList });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const addClient = async (req, res) => {
    try {
        const body = req.body;
        const loginUser = req.user;
        await ClientModel.create(body);
        const clientList = await clientListGenerate(loginUser);

        return res.status(201).json({ success: true, message: "Client Added Successfully.", data: clientList });
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
        const loginUser = req.user;
        const client = await ClientModel.findById(id, undefined, undefined);
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }
        const existingProjects = await ProjectModel.find({ clientName: client._id }, undefined, undefined);
        if (existingProjects.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete this client. Client is linked to many projects"
            });
        }
        await ClientModel.findByIdAndDelete(id, undefined);
        const clientList = await clientListGenerate(loginUser);
        return res.status(200).json({
            success: true,
            message: "Client Deleted Successfully.",
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
        const loginUser = req.user;
        const id = req.params._id;
        const body = req.body;
        const clientDelete = await ClientModel.findByIdAndUpdate({ _id: id }, body, { new: true });
        const clientList = await clientListGenerate(loginUser);
        return res.status(201).json({ success: true, message: "Client Updated Successfully.", data: clientList });
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
    updateClientProject,
    clientListGenerate
}