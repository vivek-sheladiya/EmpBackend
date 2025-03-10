const express = require("express");
const expressApp = express();
// const UserModel = require("./lib/Models/User");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const AuthRouter = require("./lib/Routes/AuthRouter");
const RequestRouter = require("./lib/Routes/RequestRouter");
const UserDataRouter = require("./lib/Routes/UserDataRouter");
const NotesRouter = require("./lib/Routes/NotesRouter");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { spawn } = require("child_process");
const { AttendanceModel, UserModel } = require("./lib/Models/User");
const http = require("http");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");

require("./cronJob");

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

  const profilePhotoDir = path.join(__dirname, "uploads/profilePhoto");
  const screenshotDir = path.join(__dirname, "uploads/screenshots");
  if (!fs.existsSync(profilePhotoDir)) {
    fs.mkdirSync(profilePhotoDir);
  }
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }

  const PORT = process.env.PORT || 8080;

  expressApp.get("/ping", (req, res) => {
    res.send("PONG");
  });

  expressApp.use(bodyParser.json());
  expressApp.use(express.json());
  expressApp.use(express.urlencoded({ extended: true }));
  expressApp.use(cors());
  expressApp.use("/auth", AuthRouter);
  expressApp.use("/api", UserDataRouter);
  expressApp.use("/api", RequestRouter);
  expressApp.use("/api/notes", NotesRouter);
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

  // expressApp.listen(PORT, () => {/
  //   console.log(`Server is running on ${PORT}`);
  //   startElectronApp();
  // });
}

const socketConnection = async (PORT) => {
  const server = http.createServer(expressApp);

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    allowEIO3: true,
  });

  io.on("connection", (socket) => {
    // console.log("connection done");

    socket.on("socketMessage", (data) => {
      console.log("Attendance:", data);
      socket.broadcast.emit("receive_message", data);
    });

    socket.on("userData", (data) => {
      socket.broadcast.emit("userData", data);
    });

    socket.on("attendanceData", (data) => {
      socket.broadcast.emit("attendanceData", data);
    });
  });

  server.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`);
    // startElectronApp();
  });
};

const pathToElectron = path.join(
  __dirname,
  "node_modules",
  "electron",
  "dist",
  "electron"
);

function startElectronApp() {
  const electronProcess = spawn(pathToElectron, ["electron.js"], {
    stdio: "inherit",
  });

  electronProcess.on("error", (error) => {
    console.error("Error spawning Electron process:", error);
  });

  electronProcess.on("exit", (code) => {
    console.log(`Electron process exited with code ${code}`);
  });
}

startServer();
