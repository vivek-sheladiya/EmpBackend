const NotesModel = require("../Models/Notes");
const { handleError } = require("../utils/utils");

const addNotes = async (req, res) => {
    try {
        const { title, desc, addedPersonName } = req.body;
    
        const notesModel = new NotesModel({ title, desc, addedPersonName });
        await notesModel.save();
        return res.status(201).json({message: 'Notes Add Successfully', success: true});
    } catch(err) {
        return handleError(res, 'Internal Server Error');
    }
}

module.exports = {
    addNotes,
}