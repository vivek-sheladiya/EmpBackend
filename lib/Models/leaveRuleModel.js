const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const LeaveRuleSchema = new Schema(
    {
        leaveRule: {
            type: String
        }
    }
)

const leaveRuleModel = mongoose.model("leaveRule", LeaveRuleSchema);

module.exports = { leaveRuleModel };