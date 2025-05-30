const express = require("express");
const expressApp = express();
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const AuthRouter = require("./lib/Routes/AuthRouter");
const UserDataRouter = require("./lib/Routes/UserDataRouter");
const HolidayEventRouter = require("./lib/Routes/HolidayEventRouter");
const AttendanceRouter = require("./lib/Routes/AttendanceRouter");
const TaskRouter = require("./lib/Routes/TaskRouter");
const DashboardRouter = require("./lib/Routes/DashboardRouter");
const LeaveDataRouter = require('./lib/Routes/LeaveRouter');
const BasicSalary = require("./lib/Routes/basicSalaryRouter");
const ClientProject = require("./lib/Routes/clientProjectRouter")
const AppSettingDataRouter = require("./lib/Routes/AppSettingDataRouter");
const ProjectRouter = require("./lib/Routes/ProjectRouter");
const punchReport = require("./lib/Routes/punchReportRoutes");
const userFileUpload = require("./lib/Routes/userFileUploadRouter")
const path = require("path");
const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");

const autoPunchOutJob = require('./cronJob');
const {ensureAuthenticated} = require("./lib/Middlewares/Auth");
const http = require("node:http");
const {Server} = require("socket.io");
const {generateGroupWiseTaskList} = require("./lib/Controllers/TaskController");
const {UserModel} = require("./lib/Models/UserModel");

const mongo_url = process.env.MONGO_CONN;

async function connectToDatabase() {
    try {
        await mongoose.connect(mongo_url);
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

async function startServer() {
    await connectToDatabase();

    const PORT = process.env.PORT || 8080;

    expressApp.get("/ping", (req, res) => {
        res.send("PONG");
    });

    // expressApp.use(bodyParser.json());
    expressApp.use(bodyParser.json({ limit: '50mb' }));
    expressApp.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
    expressApp.use(express.json());
    expressApp.use(express.urlencoded({ extended: true }));
    expressApp.use(cors());
    // expressApp.use(cors({
    //     origin: 'https://whogetsa.web.app',
    //     credentials: true,
    // }));
    expressApp.options('*', cors());
    expressApp.use("/auth", AuthRouter);
    expressApp.use("/api", ensureAuthenticated, UserDataRouter);
    expressApp.use(AppSettingDataRouter);
    expressApp.use(express.static(path.join(__dirname, "lib", "frontend")));
    expressApp.use("/uploads", express.static(path.join(__dirname, "uploads")));

    expressApp.use("/auth", AuthRouter);
    expressApp.use("/api", ensureAuthenticated, UserDataRouter);
    expressApp.use("/api", ensureAuthenticated, HolidayEventRouter);
    expressApp.use("/api", ensureAuthenticated, AttendanceRouter);
    expressApp.use("/api", ensureAuthenticated, TaskRouter);
    expressApp.use("/api", ensureAuthenticated, DashboardRouter);
    expressApp.use("/api", ensureAuthenticated, ProjectRouter);
    expressApp.use("/api", ensureAuthenticated, LeaveDataRouter);
    expressApp.use("/api", ensureAuthenticated, BasicSalary);
    expressApp.use("/api", ensureAuthenticated, ClientProject);
    expressApp.use("/api", ensureAuthenticated, punchReport);
    expressApp.use("/api", ensureAuthenticated, userFileUpload);

    expressApp.use(AppSettingDataRouter);
    expressApp.use(express.static(path.join(__dirname, "lib", "frontend")));
    expressApp.use("/uploads", express.static(path.join(__dirname, "uploads")));

    expressApp.get("/commonData", async (req, res) => {
        let client;
        try {
            client = await MongoClient.connect(mongo_url, {
                // useNewUrlParser: true,
                useUnifiedTopology: true,
            });

            const db = client.db();
            const commonDataCollection = db.collection("commonData");

            const commonData = await commonDataCollection.findOne({});

            if (commonData) {
                res.json(commonData);
            } else {
                res.status(404).json({ message: "No data found" });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        } finally {
            if (client) {
                client.close();
            }
        }
    });

    socketConnection(PORT);
    autoPunchOutJob();

    // expressApp.listen(PORT, () => {
    //     console.log(`Server is running on ${PORT}`);
    // });
}

const socketConnection = async (PORT) => {
  const server = http.createServer(expressApp);

  const io = new Server(server, {
      path: "/socket.io",
      cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    allowEIO3: true,
  });

    expressApp.use((req, res, next) => {
        console.log("xcvgxdsfg", req.user);
    });

  io.on("connection", (socket) => {
    // console.log("connection done");

    socket.on("socketMessage", (data) => {
      console.log("socketMessage:", data);
      // socket.broadcast.emit("receive_message", data);
      socket.emit("receive_message", data);
    });

    // socket.on("userData", (data) => {
    //   socket.broadcast.emit("userDetails", data);
    //   // socket.broadcast.emit("userData", data);
    // });
    //
    // socket.on("attendanceData", (data) => {
    //   // socket.broadcast.emit("attendanceData", data);
    //   socket.broadcast.emit("attendanceDetails", data);
    // });

    socket.on("taskData", async (data) => {
        console.log("taskData:", data);
        // const taskBoardData = await generateGroupWiseTaskList(user);
        socket.emit("taskData", data);
        // const taskBoardData = await generateGroupWiseTaskList(data);
        // socket.broadcast.emit("taskData", taskBoardData);
    });
  });

  server.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`);
    // startElectronApp();
  });
};

// const pathToElectron = path.join(
//   __dirname,
//   "node_modules",
//   "electron",
//   "dist",
//   "electron"
// );

// function startElectronApp() {
//   const electronProcess = spawn(pathToElectron, ["electron.js"], {
//     stdio: "inherit",
//   });

//   electronProcess.on("error", (error) => {
//     console.error("Error spawning Electron process:", error);
//   });

//   electronProcess.on("exit", (code) => {
//     console.log(`Electron process exited with code ${code}`);
//   });
// }

startServer();
