const environment = require("../../apiEndpoints");
const { Blob } = require("buffer");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
const {TasksModel} = require("../Models/TaskModel");
const {generateRandomId} = require("../utils/utils");
dayjs.extend(customParseFormat);

const addTask = async (req, res) => {
  try {
    const { taskTitle, taskDescription, taskStatus, taskPriority, taskCategory, taskAssignee, taskLabels, taskStartDate, taskEndDate, taskEstimatedTime, taskAttachments, taskAddedBy } = req.body;

    if (!taskTitle || !taskStatus || !taskAddedBy) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields (taskTitle, taskStatus, taskAssignee, taskAddedBy)",
      });
    }

    const newTask = new TasksModel({
      taskId: generateRandomId(),
      taskTitle,
      taskDescription,
      taskStatus,
      taskPriority,
      taskCategory,
      taskAssignee: taskAssignee.map(user => ({ userId: user._id })),
      taskLabels,
      taskStartDate,
      taskEndDate,
      taskEstimatedTime,
      taskAttachments,
      taskAddedBy,
    });

    await newTask.save();

    const tasks = await TasksModel.find();

    return res.status(201).json({
      success: true,
      message: "Task Added Successfully",
      data: tasks,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (id) {
      const updateData = req.body;

      if (updateData.taskAttachments && typeof updateData.taskAttachments === 'string') {
        try {
          updateData.taskAttachments = JSON.parse(updateData.taskAttachments);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: "Invalid JSON format in taskAttachments",
          });
        }
      }

      const existingTask = await TasksModel.findById(id);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: "Task not found",
        });
      }

      const fieldsToCheck = [
        "projectName",
        "taskTitle",
        "taskDescription",
        "taskStatus",
        "taskStartDate",
        "taskEndDate",
        "taskCategory",
        "taskPriority",
        "taskLabels",
        "taskEstimatedTime",
      ];

      let historyChanges = fieldsToCheck
        .filter((field) => updateData[field] && updateData[field] !== existingTask[field])
        .map((field) => ({
          fieldName: field,
          oldValue: existingTask[field],
          newValue: updateData[field],
          changedBy: updateData.userId,
          changeTime: new Date(),
        }));

      if (updateData.taskAssignee && !arraysEqual(existingTask.taskAssignee, updateData.taskAssignee)) {
        historyChanges.push({
          fieldName: "taskAssignee",
          oldValue: existingTask.taskAssignee,
          newValue: updateData.taskAssignee,
          changedBy: req.body.userId,
          changeTime: new Date(),
        });
      }

      if (updateData.taskStatus === 'completed' && existingTask.taskStatus !== 'completed') {
        updateData.taskClosedTime = [...existingTask.taskClosedTime, { closedAt: new Date() }];
      }

      if (historyChanges.length > 0) {
        updateData.taskHistory = [...existingTask.taskHistory, ...historyChanges];
      }

      const updatedTask = await TasksModel.findByIdAndUpdate(id, updateData, { new: true });

      const tasks = await TasksModel.find();

      return res.status(200).json({
        success: true,
        message: "Task updated successfully",
        data: tasks,
      });
    } else {
      const {
        projectName,
        taskTitle,
        taskDescription,
        taskStatus,
        taskPriority,
        taskCategory,
        taskAssignee,
        taskLabels,
        taskStartDate,
        taskEndDate,
        taskEstimatedTime,
        taskAttachments,
        taskAddedBy
      } = req.body;
      const newTask = new TasksModel({
        taskId: generateRandomId(),
        projectName: projectName || '',
        taskTitle: taskTitle || '',
        taskDescription: taskDescription || '',
        taskStatus: taskStatus || 'To Do',
        taskPriority: taskPriority || 'Normal',
        taskCategory: taskCategory || 'General',
        taskAssignee: Array.isArray(taskAssignee)
          ? taskAssignee.map(user => ({ userId: user._id }))
          : taskAddedBy
            ? [{ userId: taskAddedBy }]
            : [],
        taskLabels: taskLabels || '',
        taskStartDate: taskStartDate || null,
        taskEndDate: taskEndDate || null,
        taskEstimatedTime: taskEstimatedTime || '',
        taskAttachments: Array.isArray(taskAttachments) ? taskAttachments : [],
        taskAddedBy: taskAddedBy || null,
      });

      await newTask.save();

      const tasks = await TasksModel.find();

      return res.status(201).json({
        success: true,
        message: "Task Added Successfully",
        data: tasks,
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const uploadFiles = async (req, res) => {
  try {
    let uploadedAttachments = [];

    console.log("sdrfte", req.files);


    if (req.files && req.files.length > 0) {

      for (const file of req.files) {
        const form = new FormData();
        const blob = new Blob([file.buffer], { type: file.mimetype });
        const filename = `${Date.now()}_${file.originalname}`;

        form.append("image", blob, filename);

        const response = await fetch(`${environment.apiBaseUrl}upload.php`, {
          method: "POST",
          body: form,
        });

        const result = await response.json();

        if (result.status === true) {
          uploadedAttachments.push({
            attachmentType: file.mimetype,
            url: `${environment.apiBaseUrl}${result.file_url}`,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Image upload successfully",
      data: uploadedAttachments,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const arraysEqual = (arr1, arr2) => {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, index) => {
    return JSON.stringify(item) === JSON.stringify(arr2[index]);
  });
};

const getAllTasks = async (req, res) => {
  try {
    const tasks = await TasksModel.find();

    return res.status(200).json({
      success: true,
      message: "Tasks fetched Successfully",
      data: tasks,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  addTask,
  updateTask,
  getAllTasks,
  uploadFiles,
};
