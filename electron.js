const {
  app,
  BrowserWindow,
  desktopCapturer,
  session,
  screen,
} = require("electron");

const { LocalStorage } = require("node-localstorage");
const localStorage = new LocalStorage("./localStorageData");

let mainWindow;
let timerSecond = 0;
let takeScreenshotTime = 1 * 10;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 250,
    height: 150,
    frame: true,
    movable: false,
    show: true,
    resizable: false,
    closable: true,
    titleBarStyle: "hidden",
    transparent: true,
    alwaysOnTop: true,
    fullscreen: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow.setBounds({ x: width - 290, y: 50 });

  mainWindow.loadFile("index.html");

  setTimeout(() => {
    mainWindow.close();
    timerSecond = 0;
  }, 6000);

}

app.whenReady().then(() => {
  let value;

  setInterval(() => {
    
    value = JSON.parse(localStorage.getItem("isPunchIn"));

    if(value === true) {
      timerSecond++;
    }

    // console.log("timerSecond", value, timerSecond, takeScreenshotTime);
    
    if (value === true && timerSecond >= takeScreenshotTime) {
      createWindow();
      timerSecond = 0;
    }
  }, 1000);

  app.on("window-all-closed", (e) => {
    if (process.platform !== "darwin") {
      e.preventDefault();
    }
  });

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
      const screenSource = sources[0];
      callback({ video: screenSource, audio: "loopbackWithMute" });
    });
  });
});

app.on("before-quit", () => {
  app.quit();
});
