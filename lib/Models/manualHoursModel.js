const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ManualHoursSchema = new Schema(
    {
        year: {
            type: Number,
            required: true
        },
        monthly_hours: {
            january: Number,
            february: Number,
            march: Number,
            april: Number,
            may: Number,
            june: Number,
            july: Number,
            august: Number,
            september: Number,
            october: Number,
            november: Number,
            december: Number
        }
    },
    { timestamps: true }
);


const manualHoursModel = mongoose.model("ManualHours", ManualHoursSchema);

module.exports = { manualHoursModel };
