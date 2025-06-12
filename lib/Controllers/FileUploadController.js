const environment = require("../../apiEndpoints");
const multer = require("multer");
const FormData = require('form-data');
const axios = require("axios");

const uploadFileStorage = multer({ storage: multer.memoryStorage(), limits: { fieldSize: 50 * 1024 * 1024 } });

const uploadFileCommonFun = async (file, type) => {
    if (!file) {
        return { status: false, message: 'No file uploaded.' };
    }

    try {
        const { newFileName, formData } = prepareFileData(file, type);

        const headers = formData.getHeaders();

        const response = await axios.post(`${environment.apiBaseUrl}uploadFile.php`, formData, {
            headers: headers,
        });

        const result = response.data;

        if (result.status === true) {
            return {
                status: true,
                message: result.message || 'File uploaded successfully.',
                data: {
                    fileType: file.mimetype,
                    folderType: type,
                    fileName: newFileName,
                    fileUrl: `${environment.apiBaseUrl}${result.file_url}`,
                }
            };
        } else {
            return { status: false, message: result.message || 'File upload failed.' };
        }
    } catch (error) {
        return { status: false, message: 'Error uploading file to server' };
    }
};

const uploadMultiFilesCommonFun = async (files, type) => {
    if (!files || files.length === 0) {
        return { status: false, message: 'No files uploaded.' };
    }

    try {
        const formData = new FormData();
        files.forEach(file => {
            const { newFileName } = prepareFileData(file, type);
            formData.append("file[]", file.buffer, newFileName);
        });

        formData.append("type", type || 'default');

        const headers = formData.getHeaders();

        const response = await axios.post(`${environment.apiBaseUrl}uploadMultiFiles.php`, formData, {
            headers: headers,
        });

        const result = response.data;

        if (result.status === true) {
            const fileData = result.file_url.map((fileUrl, index) => {
                const fileName = fileUrl.split('/').pop();
                return {
                    fileType: files[index].mimetype,
                    folderType: type,
                    fileName: fileName,
                    fileUrl: `${environment.apiBaseUrl}${fileUrl}`,
                };
            });

            return {
                status: true,
                message: result.message || 'Files uploaded successfully.',
                data: fileData,
            };
        } else {
            return { status: false, message: result.message || 'Files upload failed.' };
        }
    } catch (error) {
        return { status: false, message: `Error uploading files to server-${error}` };
    }
};

const deleteFileCommonFun = async (filename, type) => {
    if (!filename) {
        return { status: false, message: 'Filename is required.' };
    }

    try {
        const formData = new FormData();
        formData.append("filename", filename);
        formData.append("type", type || 'default');

        const headers = formData.getHeaders();

        const response = await axios.post(`${environment.apiBaseUrl}deleteFile.php`, formData, {
            headers: headers,
        });

        const result = response.data;

        if (result.status === true) {
            return { status: true, message: 'File deleted successfully.' };
        } else {
            return { status: false, message: result.message || 'Failed to delete file.' };
        }
    } catch (error) {
        return { status: false, message: 'Error deleting file from PHP server' };
    }
};

const prepareFileData = (file, type) => {
    const originalName = file.originalname;
    const extension = originalName.split('.').pop();
    const baseName = originalName.replace(`.${extension}`, '');
    const newFileName = `${baseName}_${Date.now()}.${extension}`;

    const formData = new FormData();
    formData.append('file', file.buffer, newFileName);
    formData.append("type", type || 'default');

    return { newFileName, formData };
};

// Apis
const uploadFile = async (req, res) => {
    const { type } = req.body;
    const { status, message, data } = await uploadFileCommonFun(req.file, type);
    if (status === true) {
        return res.status(200).json({ status, message, data });
    } else {
        return res.status(400).json({ status, message });
    }
};

const uploadMultiFiles = async (req, res) => {
    const { type } = req.body;
    const { status, message, data } = await uploadMultiFilesCommonFun(req.files, type);
    if (status === true) {
        return res.status(200).json({ status, message, data });
    } else {
        return res.status(400).json({ status, message });
    }
};

const deleteFile = async (req, res) => {
    const { filename, type } = req.body;
    const { status, message } = await deleteFileCommonFun(filename, type);
    if (status === true) {
        return res.status(200).json({ status, message });
    } else {
        return res.status(400).json({ status, message });
    }
};

module.exports = {
    uploadFile,
    uploadMultiFiles,
    deleteFile,
    uploadFileCommonFun,
    uploadMultiFilesCommonFun,
    deleteFileCommonFun,
    uploadFileStorage,
};