const environment = require("../../apiEndpoints");
const { Blob } = require("buffer");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
const {TasksModel} = require("../Models/TaskModel");
const {generateRandomId, handleError, UserRole} = require("../utils/utils");
const {ProjectModel} = require("../Models/ProjectModel");
const {LeaveModel} = require("../Models/LeaveModel");
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
    const loginUser = req.user;

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

      const groupedTaskList = await generateGroupWiseTaskList(loginUser);

      return res.status(200).json({
        success: true,
        message: "Task updated successfully",
        data: groupedTaskList,
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
        taskAssignee: taskAssignee || [],
        // taskAssignee: Array.isArray(taskAssignee)
        //   ? taskAssignee.map(user => ({ userId: user._id }))
        //   : taskAddedBy
        //     ? [{ userId: taskAddedBy }]
        //     : [],
        taskLabels: taskLabels || '',
        taskStartDate: taskStartDate || null,
        taskEndDate: taskEndDate || null,
        taskEstimatedTime: taskEstimatedTime || '',
        taskAttachments: Array.isArray(taskAttachments) ? taskAttachments : [],
        taskAddedBy: taskAddedBy || null,
      });

      await newTask.save();

    const groupedTaskList = await generateGroupWiseTaskList(loginUser);

      return res.status(201).json({
        success: true,
        message: "Task Added Successfully",
        data: groupedTaskList,
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
    const loginUser = req.user;

    const groupedTaskList = await generateGroupWiseTaskList(loginUser);

    return res.status(200).json({
      success: true,
      message: "Tasks fetched Successfully",
      data: groupedTaskList,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const deleteTask = async (req, res) => {
  try {
    const id = req.params._id
    const loginUser = req.user;
    const task = await TasksModel.findByIdAndDelete({ _id: id });
    if (!task) {
      return handleError(res, "Task Not Found.", 400);
    }

    const groupedTaskList = await generateGroupWiseTaskList(loginUser);

    return res.status(200).json({
      success: true,
      message: "Tasks deleted successfully.",
      data: groupedTaskList
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

const generateGroupWiseTaskList = async (loginUser) => {
  const {_id: userId, role} = loginUser;
  let matchCriteria = {};

  if (role !== UserRole.Admin) {
    matchCriteria = {
      $or: [
        {taskAddedBy: userId},
        {taskAssignee: {$elemMatch: {userId: userId}}}
      ]
    };
  }

  const tasks = await TasksModel.find(matchCriteria, undefined, undefined).lean();

  const projectIds = [...new Set(tasks.map(task => {
    if(task.projectName) {
      return task.projectName;
    }
  }))];

  const projects = await ProjectModel.find({ _id: { $in: projectIds } });

  const projectMap = {};
  projects.forEach(project => {
    projectMap[project._id.toString()] = project.clientName;
  });

  const tasksWithClientName = tasks.map(task => ({
    ...task,
    clientName: projectMap[task.projectName?.toString()] || null
  }));

  const groupedTasks = {
    toDo: [],
    inProgress: [],
    testing: [],
    onHold: [],
    completed: [],
    reopened: []
  };

  tasksWithClientName.forEach(task => {
    const status = task.taskStatus || "toDo";
    if (groupedTasks[status]) {
      groupedTasks[status].push(task);
    }
  });

  return groupedTasks;
}

const getGroupTask = async (req, res) => {
  try {
    const loginUser = req.user;

    const tasks = await getRoleWiseTask(loginUser);

    const taskList = await generateGroupWiseTaskList(tasks);

    return res.status(200).json({
      success: true,
      message: "Task Fetched Successfully.",
      data: taskList
    });
  } catch (err) {
    return handleError(res, err.message);
  }
}

const taskReorder = async (req, res) => {
  const { updates } = req.body;
  try {
    const bulkOps = updates.map(task => ({
      updateOne: {
        filter: { _id: task._id },
        update: {
          $set: {
            placementIndex: task.placementIndex,
            taskStatus: task.taskStatus
          }
        }
      }
    }));

    await TasksModel.bulkWrite(bulkOps);
    res.status(200).json({ success: true, message: "Task order updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update order", error: err.message });
  }
}

module.exports = {
  addTask,
  updateTask,
  getAllTasks,
  uploadFiles,
  deleteTask,
  getGroupTask,
  taskReorder,
};
