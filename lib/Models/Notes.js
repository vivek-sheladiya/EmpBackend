const { required } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NotesSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    desc: {
        type: String,
        required: true,
    },
    addedPersonName: {
        type: String,
        required: true,
    },
});

const NotesModel = mongoose.model('notes', NotesSchema);
module.exports = NotesModel;