const mongoose = require('mongoose');

const officeUpdatesSchema = new mongoose.Schema({
    isDaily: {
        type: Boolean,
        default: false,
    },
    showTime: {
        type: Date,
        required: true,
    },
    isForDailyUpdate: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    windowLink: {
        type: String,
        required: false,
        trim: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'employee',
    },
}, {
    timestamps: true,
});

const OfficeUpdateModel = mongoose.model("officeUpdate", officeUpdatesSchema);

module.exports = { OfficeUpdateModel };