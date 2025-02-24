const RequestModel = require("../Models/Request");
const { UserModel } = require("../Models/User");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ftp = require('basic-ftp');
const { ftpConfig } = require("../utils/ValidationUtils");
const { notifyUsers } = require("./NotificationController");
const { setDefaultRequestData, handleError } = require("../utils/utils");
const { boolean } = require("joi");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require('../Database/cloudinaryConfig');

const addComplaint = async (req, res) => {
    try {
        const requestData = setDefaultRequestData(req.body);

        await RequestModel.create(
            {
                ...requestData,
            });

        return res.status(201).json({ success: true, message: 'Complaint Added Successfully' });
    } catch (err) {
        console.log(err);
        return handleError(res, 'Internal Server Error');
    }
};

const updateComplaint = async (req, res) => {
    try {
        const { complaintId } = req.params;
        const updateData = req.body;

        const complaint = await RequestModel.findById(complaintId);
        if (!complaint) {
            return handleError(res, 'Complaint not found', 404);
        }

        const updatedUser = await RequestModel.findByIdAndUpdate(complaintId, updateData);

        return res.status(200).json({ success: true, message: 'Complaint updated successfully', user: updatedUser });
    } catch (err) {
        console.log(err);
        return handleError(res, 'Internal Server Error');
    }
};

const getAllRequests = async (req, res) => {
    try {
        const requests = await RequestModel.find();
        

        const complaintPermissions = req.user?.userPermission?.get('complaint') || {};
        const userPermissions = complaintPermissions?.read || {}; 

        const assignedPersonUserIds = requests
            .map(req => req.assignedPersonUserId)
            .filter(id => id);

        const complaintAddPersonUserIds = requests
            .map(req => req.complaintAddPersonUserId)
            .filter(id => id);

        const approvedPersonUserIds = requests
            .map(req => req.approvedPersonUserId)
            .filter(id => id);

        const userPromises = [
            assignedPersonUserIds.length > 0 ?
                UserModel.find({ _id: { $in: assignedPersonUserIds } }).then(users => {
                    const userMap = {};
                    users.forEach(user => {
                        userMap[user._id] = user.fullName;
                    });
                    return userMap;
                }) : Promise.resolve({}),
            complaintAddPersonUserIds.length > 0 ?
                UserModel.find({ _id: { $in: complaintAddPersonUserIds } }).then(users => {
                    const userMap = {};
                    users.forEach(user => {
                        userMap[user._id] = user.fullName;
                    });
                    return userMap;
                }) : Promise.resolve({}),
            approvedPersonUserIds.length > 0 ?
                UserModel.find({ _id: { $in: approvedPersonUserIds } }).then(users => {
                    const userMap = {};
                    users.forEach(user => {
                        userMap[user._id] = user.fullName;
                    });
                    return userMap;
                }) : Promise.resolve({})
        ];

        const [assignedUsers, complaintAddUsers, approvedUsers] = await Promise.all(userPromises);

        const checkReadPermission = (status, complaint) => {
            const permissionKey = status.toLowerCase();
            const permission = userPermissions[permissionKey];
            

            if (permission) {
                const readPermission = permission.all;
                if (readPermission) {
                    return true;
                }

                if (readPermission.mentioned && req.user._id == complaint.assignedPersonUserId || req.user._id == complaint.complaintAddPersonUserId || 
                    req.user._id == complaint.approvedPersonUserId) {
                    return true;
                }
            }
            return false;
        };

        const filteredComplaints = requests.filter(complaint => {
            const { activeStatus, dueDate } = complaint;
            let hasPermission = false;          

            if(activeStatus == 'Active') {
                hasPermission = checkReadPermission('Active', complaint);
            } else if(activeStatus == 'Pending') {
                hasPermission = checkReadPermission('Pending', complaint);
            } else if(activeStatus == 'Rejected') {
                hasPermission = checkReadPermission('Rejected', complaint);
            } else if(activeStatus == 'Closed') {
                hasPermission = checkReadPermission('Closed', complaint);
            } else if(activeStatus == 'Today On Root') {
                if (isTodayOnRoot(dueDate)) {
                    hasPermission = checkReadPermission('Today On Root', complaint);
                }
            }

            // console.log(hasPermission, activeStatus);

            return hasPermission;
        }); 

        const isTodayOnRoot = (dueDate) => {
            const formatDate = (date) => {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}-${month}-${year}`;
            };
        
            const [day, month, year] = dueDate.split('-');
            const createdDate = new Date(year, month - 1, day);
        
            const today = new Date();
        
            return formatDate(createdDate) === formatDate(today);
        };

        const responseData = filteredComplaints.map(req => ({
            ...req.toObject(),
            assignedPersonUserName: assignedUsers[req.assignedPersonUserId] || "",
            complaintAddPersonUserName: complaintAddUsers[req.complaintAddPersonUserId] || "",
            approvedPersonUserName: approvedUsers[req.approvedPersonUserId] || "",
        }));

        return res.status(200).json({
            success: true,
            message: "Data fetched successfully",
            data: responseData,
        });
    } catch (err) {
        console.error(err);
        return handleError(res, 'Internal Server Error');
    }
};

const deleteRequest = async (req, res) => {
    const { id } = req.params;

    try {
        const deletedRequest = await RequestModel.findByIdAndDelete(id);

        if (!deletedRequest) {
            return handleError(res, 'Complaint not found', 400);
        }

        return res.status(200).json({ success: true, message: "Complaint deleted successfully", data: deletedRequest });
    } catch (err) {
        return handleError(res, 'Internal Server Error');
    }
};

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'uploads/');
//     },
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + '-' + file.originalname);
//     },
// });

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'your_folder_name', // Replace with the folder where images should be stored
      format: async (req, file) => 'jpg', // Supports formats like jpg, png, etc.
      public_id: (req, file) => file.originalname.split('.')[0], // File name
    },
  });

const upload = multer({ storage });

const ftpClient = new ftp.Client();
ftpClient.ftp.verbose = true;

const serverFolderName = 'ecomDemo';

const uploadSingleFile = async (req, res) => {
    if (req.file) {
        return res.status(200).json({ success: true, message: 'File Upload Successfully', data: { fileUrl: req.file.path } });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileName = `${Date.now()}${path.extname(req.file.originalname)}`;

    const localFilePath = path.join(__dirname, '../../', req.file.path);
    const remoteFilePath = `/public_html/${serverFolderName}/uploads/${fileName}`;

    try {
        await ftpClient.access(ftpConfig);

        await ftpClient.uploadFrom(localFilePath, remoteFilePath);

        fs.unlinkSync(localFilePath);

        const fileUrl = `${serverFolderName}/uploads/${fileName}`;

        // notifyUsers();

        return res.status(200).json({ success: true, message: 'File Upload Successfully', data: { fileUrl: fileUrl } });

    } catch (error) {
        console.error('FTP upload error:', error);
        return res.status(500).json({ success: false, message: 'Failed to upload file' });
    } finally {
        ftpClient.close();
    }
};

const uploadMultipleFiles = async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const uploadedFiles = [];

    try {
        await ftpClient.access(ftpConfig);

        for (const file of req.files) {
            const fileName = `${Date.now()}${path.extname(file.originalname)}`;
            const localFilePath = path.join(__dirname, '../../', file.path);
            const remoteFilePath = `/public_html/${serverFolderName}/uploads/${fileName}`;

            await ftpClient.uploadFrom(localFilePath, remoteFilePath);

            fs.unlinkSync(localFilePath);

            const fileUrl = `${serverFolderName}/uploads/${fileName}`;
            uploadedFiles.push(fileUrl);
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Files uploaded successfully', 
            data: { fileUrls: uploadedFiles } 
        });

    } catch (error) {
        console.error('FTP upload error:', error);
        return res.status(500).json({ success: false, message: 'Failed to upload files' });
    } finally {
        ftpClient.close();
    }
};

const deleteSingleFile = async (req, res) => {
    const { fileName } = req.params;

    console.log('fileName', fileName);
    

    if (!fileName) {
        return res.status(400).json({ success: false, message: 'No file specified' });
    }

    const remoteFilePath = `/public_html/${serverFolderName}/uploads/${fileName}`;

    try {
        await ftpClient.access(ftpConfig);
        await ftpClient.remove(remoteFilePath);

        return res.status(200).json({ success: true, message: 'File deleted successfully' });

    } catch (error) {
        console.error('FTP delete error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete file' });
    } finally {
        ftpClient.close();
    }
};

const deleteMultipleFiles = async (req, res) => {
    const { fileNames } = req.body;

    const result = await cloudinary.uploader.destroy(fileNames[0]);
    console.log('Delete result:', result);
    return res.status(200).json({ success: true, message: 'File deleted successfully', result: result });

    if (!fileNames || fileNames.length === 0) {
        return res.status(400).json({ success: false, message: 'No files specified' });
    }

    const successFiles = [];
    const errorFiles = [];

    try {
        await ftpClient.access(ftpConfig);

        for (const fileName of fileNames) {
            const remoteFilePath = `/public_html/${serverFolderName}/uploads/${fileName}`;

            try {
                await ftpClient.remove(remoteFilePath);
                successFiles.push(fileName);

            } catch (error) {
                console.error(`FTP delete error for file: ${fileName}`, error);
                errorFiles.push(fileName);
            }
        }

        const response = {
            success: true,
            message: 'File deletion process completed',
            deletedFiles: successFiles,
            failedFiles: errorFiles.length > 0 ? errorFiles : null,
        };

        if (errorFiles.length > 0) {
            return res.status(207).json({ ...response, success: false, message: 'Some files could not be deleted' });
        }

        return res.status(200).json(response);

    } catch (error) {
        console.error('FTP connection error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete files' });
    } finally {
        ftpClient.close();
    }
};

module.exports = {
    addComplaint,
    updateComplaint,
    getAllRequests,
    deleteRequest,
    upload,
    uploadSingleFile,
    uploadMultipleFiles,
    deleteSingleFile,
    deleteMultipleFiles,
}