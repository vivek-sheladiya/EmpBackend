const { required } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RequestSchema = new Schema({
    name: {
        type: String,
    },
    mobile: {
        type: String,
    },
    mobile2: {
        type: String,
    },
    address: {
        type: String,
    },
    district: {
        type: String,
    },
    subDistrict: {
        type: String,
    },
    village: {
        type: String,
    },
    pinCode: {
        type: String,
    },
    productImages: {
        type: [String],
    },
    warrantyCardImages: {
        type: [String],
    },
    priority: {
        type: String,
    },
    activeStatus: {
        type: String,
    },
    approvalStatus: {
        type: String,
    },
    reason: {
        type: String,
    },
    complaintCreatedDate: {
        type: String,
    },
    complaintCloseDate: {
        type: String,
    },
    status: {
        type: String,
    },
    latitude: {
        type: String,
    },
    longitude: {
        type: String,
    },
    assignedPersonUserId: {
        type: String,
    },
    complaintAddPersonUserId: {
        type: String,
    },
    approvedPersonUserId: {
        type: String,
    },
    isOtpSend: {
        type: Boolean,
    },
    otp: {
        type: String,
    },
    complaintId: {
        type: String,
    },
    productName: {
        type: String,
    },
    productDescription: {
        type: String,
    },
    dueDate: {
        type: String,
    },
    usedSpareParts: {
        type: String,
    },
    receivedAmount: {
        type: String,
    },
});

const RequestModel = mongoose.model('requests', RequestSchema);
module.exports = RequestModel;