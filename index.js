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
const ChattingRouter = require("./lib/Routes/ChattingRouter");
const ProjectRouter = require("./lib/Routes/ProjectRouter");
const punchReport = require("./lib/Routes/punchReportRoutes");
const userFileUpload = require("./lib/Routes/userFileUploadRouter")
const FileUploadRouter = require("./lib/Routes/FileUploadRouter")
const DailyUpdateRouter = require("./lib/Routes/DailyUpdateRouter")
const OfficeUpdatesRouter = require("./lib/Routes/OfficeUpdatesRouter")
const ApplicationRouter = require("./lib/Routes/ApplicationRouter")
const AppVersionRoutes = require("./lib/Routes/AppVersionRoutes")
const path = require("path");
const mongoose = require("mongoose");

const autoPunchOutJob = require('./cronJob');
const {ensureAuthenticated} = require("./lib/Middlewares/Auth");
const {generateGroupWiseTaskList} = require("./lib/Controllers/TaskController");
const {UserModel} = require("./lib/Models/UserModel");
const {TasksModel} = require("./lib/Models/TaskModel");
const {UserRole} = require("./lib/utils/utils");

const upload = require("./imageUploader");
const environment = require("./apiEndpoints");
const {chatUpdates} = require("./lib/Controllers/ChatControllerNew");
const http = require("node:http");
const {initializeApp, cert} = require("firebase-admin/app");
// const {ExpressPeerServer} = require("peer");
const {officeUpdates} = require("./lib/Controllers/OfficeUpdateController");
const {appSettingUpdates} = require("./lib/Controllers/AppSettingController");

const mongo_url = process.env.MONGO_CONN;

const serviceAccount = {
    type: process.env.type,
    project_id: process.env.project_id,
    private_key_id: process.env.private_key_id,
    private_key: process.env.private_key?.replace(/\\n/g, '\n'),
    client_email: process.env.client_email,
    client_id: process.env.client_id,
    auth_uri: process.env.auth_uri,
    token_uri: process.env.token_uri,
    auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
    client_x509_cert_url: process.env.client_x509_cert_url,
    universe_domain: process.env.universe_domain
};

async function connectToDatabase() {
    try {
        await mongoose.connect(mongo_url);
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

async function startServer() {

    initializeApp({
        credential: cert(serviceAccount),
    });

    await connectToDatabase();

    const PORT = process.env.PORT || 8080;

    expressApp.get("/ping", (req, res) => {
        res.send("PONG");
    });

    const server = http.createServer(expressApp);

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
    expressApp.use("/api", ensureAuthenticated, ChattingRouter);
    expressApp.use("/api", ensureAuthenticated, DailyUpdateRouter);
    expressApp.use("/api", ensureAuthenticated, OfficeUpdatesRouter);
    expressApp.use("/api", ensureAuthenticated, AppVersionRoutes);
    expressApp.use("/api", ApplicationRouter);
    expressApp.use("/api", FileUploadRouter);

    expressApp.use(AppSettingDataRouter);

    expressApp.use(express.static(path.join(__dirname, "lib", "frontend")));
    expressApp.use("/uploads", express.static(path.join(__dirname, "uploads")));

    expressApp.get('/employeesChange', async (req, res) => {
        const { userId, role } = req.query;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        let isAnyChange = false;

        const changeStream = UserModel.watch();

        changeStream.on('change', async (change) => {
            isAnyChange = true;
        });

        const interval = setInterval(async () => {
            if (isAnyChange) {
                try {
                    const usersData = await UserModel.find({}, role === UserRole.Admin ? {} : {
                        _id: 1,
                        fullName: 1,
                        mobileNumber: 1,
                        emailAddress: 1,
                        role: 1,
                        profilePhoto: 1,
                        approvalStatus: 1,
                        isActive: 1,
                        status: 1,
                    }, undefined);
                    isAnyChange = false;
                    res.write(`data: ${JSON.stringify(usersData)}\n\n`);
                } catch (err) {
                    console.log("Error->", err);
                }
            }
        }, 1000);

        // changeStream.on('error', (err) => {
        //     console.error('ChangeStream Error:', err);
        //     changeStream.close();
        // });

        req.on('close', () => {
            clearInterval(interval);
            changeStream.close();
            res.end();
            console.log('SSE connection closed');
        });
    });

    chatUpdates(expressApp);
    officeUpdates(expressApp);
    appSettingUpdates(expressApp);

    expressApp.get('/tasksChange', async (req, res) => {
        const { userId, role } = req.query;
        const loginUser = { _id: userId, role };

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        let isAnyChange = false;

        const changeStream = TasksModel.watch();

        changeStream.on('change', async (change) => {
            isAnyChange = true;
        });

        const interval = setInterval(async () => {
            if (isAnyChange) {
                try {
                    const testData = await generateGroupWiseTaskList(loginUser);
                    isAnyChange = false;
                    res.write(`data: ${JSON.stringify(testData)}\n\n`);
                } catch (err) {
                    console.log("Error->", err);
                    // res.write(`data: ${JSON.stringify({error: err.message})}\n\n`);
                }
            }
        }, 1000);

        // changeStream.on('error', (err) => {
        //     console.error('ChangeStream Error:', err);
        //     changeStream.close();
        // });

        req.on('close', () => {
            clearInterval(interval);
            changeStream.close();
            res.end();
            console.log('SSE connection closed');
        });
    });

    // autoPunchOutJob();
    //
    // const peerServer = ExpressPeerServer(server, {
    //     debug: true,
    //     path: "/myapp", // Can be any path you want
    // });
    // expressApp.use('/peerjs', peerServer); // mount at /peerjs
    //
    // server.listen(PORT, () => {
    //     console.log(`Server is running on http://localhost:${PORT}`);
    //     console.log(`PeerJS server is running on http://localhost:${PORT}/peerjs/myapp`);
    // });

    expressApp.listen(PORT, () => {
        console.log(`Server is running on ${PORT}`);
    });


}

// // Base URL
// const baseUrl = "https://fonts.gstatic.com/s/e/notoemoji/latest";
//
// // Output folder
// const outputDir = "./downloads";
// if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
//
// // Parse emoji entries
// const emojiList = emojiRawList.trim().split('\n').map(line => {
//     const [, code, name, group] = line.split('->');
//     return { code, name, group };
// });
//
// // Download helper
// function downloadFile(url, dest) {
//     return new Promise((resolve, reject) => {
//         const file = fs.createWriteStream(dest);
//         https.get(url, response => {
//             if (response.statusCode !== 200) {
//                 fs.unlink(dest, () => {});
//                 return reject(`Failed: ${url}`);
//             }
//             response.pipe(file);
//             file.on('finish', () => file.close(resolve));
//         }).on('error', err => {
//             fs.unlink(dest, () => {});
//             reject(err.message);
//         });
//     });
// }
//
// const outputJson = {};
//
// // Process all emojis
// (async () => {
//     for (const emoji of emojiList) {
//         const { code, name, group } = emoji;
//
//         const media = {
//             image: `${code}.webp`,
//             gif: `${code}.gif`,
//             animation: `${code}.json`
//         };
//
//         const item = {
//             code,
//             name,
//             ...media,
//             group
//         };
//
//         if (!outputJson[group]) {
//             outputJson[group] = [];
//         }
//
//         outputJson[group].push(item);
//
//         try {
//             console.log(`Downloading ${code}...`);
//             await downloadFile(`${baseUrl}/${code}/512.webp`, path.join(outputDir, media.image));
//             await downloadFile(`${baseUrl}/${code}/512.gif`, path.join(outputDir, media.gif));
//             await downloadFile(`${baseUrl}/${code}/lottie.json`, path.join(outputDir, media.animation));
//             console.log(`Done: ${code}`);
//         } catch (err) {
//             console.error(`Error downloading ${code}: ${err}`);
//         }
//     }
//
//     // Save final JSON file
//     fs.writeFileSync("emoji-data.json", JSON.stringify(outputJson, null, 2));
//     console.log("✅ JSON saved as emoji-data.json");
// })();

// const socketConnection = async (PORT) => {
//   const server = http.createServer(expressApp);
//
//   const io = new Server(server, {
//       path: "/socket.io",
//       cors: {
//       origin: "*",
//       methods: ["GET", "POST"],
//     },
//     allowEIO3: true,
//   });
//
//   io.on("connection", (socket) => {
//     // console.log("connection done");
//
//     socket.on("socketMessage", (data) => {
//       console.log("socketMessage:", data);
//       // socket.broadcast.emit("receive_message", data);
//       socket.emit("receive_message", data);
//     });
//
//     // socket.on("userData", (data) => {
//     //   socket.broadcast.emit("userDetails", data);
//     //   // socket.broadcast.emit("userData", data);
//     // });
//     //
//     // socket.on("attendanceData", (data) => {
//     //   // socket.broadcast.emit("attendanceData", data);
//     //   socket.broadcast.emit("attendanceDetails", data);
//     // });
//
//     socket.on("taskData", async (data) => {
//         // console.log("taskData:", data);
//         // const taskBoardData = await generateGroupWiseTaskList(user);
//         socket.emit("taskData", data);
//         // const taskBoardData = await generateGroupWiseTaskList(data);
//         // socket.broadcast.emit("taskData", taskBoardData);
//     });
//   });
//
//   server.listen(PORT, () => {
//     console.log(`Server is running on ${PORT}`);
//     // startElectronApp();
//   });
// };

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


process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});
