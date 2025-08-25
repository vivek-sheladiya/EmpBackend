const { ApplicationModel } = require("../Models/ApplicationModel");

const addApp = async (req, res) => {
  try {
    const { appName, description, packageName, icon, versionName, versionCode, fields } = req.body;

    // Validate fields
    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({ success: false, message: "Fields array is required" });
    }

    // Create versionConfig from fields
    const versionConfig = new Map();
    fields.forEach(field => {
      versionConfig.set(field.key, field.defaultValue);
    });

    const app = await ApplicationModel.create({
      appName,
      description,
      packageName,
      icon,
      fields,
      versions: [
        {
          versionName,
          versionCode,
          versionConfig,
        },
      ],
    });

    res.status(201).json({ success: true, message: "App Added Successfully", data: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateApp = async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;

    // If updating fields, ensure versionConfig is updated for all versions
    if (update.fields) {
      const app = await ApplicationModel.findById(id);
      if (!app) return res.status(404).json({ success: false, message: "App not found" });

      const versionConfig = new Map();
      update.fields.forEach(field => {
        versionConfig.set(field.key, field.defaultValue);
      });

      app.versions.forEach(version => {
        update.fields.forEach(field => {
          if (!version.versionConfig.has(field.key)) {
            version.versionConfig.set(field.key, field.defaultValue);
          }
        });
      });

      update.versions = app.versions;
    }

    const app = await ApplicationModel.findByIdAndUpdate(id, update, { new: true });
    if (!app) return res.status(404).json({ success: false, message: "App not found" });

    res.status(200).json({ success: true, message: "App Updated", data: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteApp = async (req, res) => {
  try {
    const { id } = req.params;
    const app = await ApplicationModel.findByIdAndDelete(id);
    if (!app) return res.status(404).json({ success: false, message: "App not found" });
    res.status(200).json({ success: true, message: "App Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getApp = async (req, res) => {
  try {
    const { id } = req.params;
    const app = await ApplicationModel.findById(id);
    if (!app) return res.status(404).json({ success: false, message: "App not found" });

    res.status(200).json({ success: true, data: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllApps = async (req, res) => {
  try {
    const apps = await ApplicationModel.find();
    res.status(200).json({ success: true, data: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const addAppVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { versionName, versionCode, versionConfig } = req.body;

    const app = await ApplicationModel.findById(id);
    if (!app) return res.status(404).json({ success: false, message: "App not found" });

    const duplicate = app.versions.find(
        v => v.versionCode === versionCode || v.versionName === versionName
    );
    if (duplicate) return res.status(400).json({ success: false, message: "Version already exists" });

    // Use previous version's config or app's fields as default
    const lastVersion = app.versions[app.versions.length - 1];
    const newVersionConfig = new Map(lastVersion ? lastVersion.versionConfig : {});

    app.fields.forEach(field => {
      if (!newVersionConfig.has(field.key)) {
        newVersionConfig.set(field.key, field.defaultValue);
      }
    });

    // Override with provided versionConfig if any
    if (versionConfig) {
      Object.entries(versionConfig).forEach(([key, value]) => {
        newVersionConfig.set(key, value);
      });
    }

    const newVersion = {
      versionName,
      versionCode,
      versionConfig: newVersionConfig,
    };

    app.versions.push(newVersion);
    await app.save();

    res.status(200).json({ success: true, message: "Version Added", data: app });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addApp,
  updateApp,
  deleteApp,
  getApp,
  getAllApps,
  addAppVersion,
};

// const defaultVersionConfig = {
//   splashTime: 8000,
//   maxVer: 1,
//   adEnabled: true,
//   alEnabled: false,
//   forcedInt: false,
//   adPref: "google",
//   adFirstServe: "google",
//   adRoundRobin: false,
//   nativePreload: true,
//   nativeAdPref: "google",
//   nativeFirstServe: "google",
//   nativeRoundRobin: false,
//   showFbRectBanner: false,
//   bannerAdPref: "google",
//   bannerFirstServe: "google",
//   bannerRoundRobin: false,
//   inHouseEnabled: false,
//   iapEnabled: false,
//   appOpenEnabled: true,
//   splashAppOpenEnabled: true,
//   backPressEnabled: false,
//   rewardVideoEnabled: false,
//   rewardIntEnabled: false,
//   intType: "click",
//   intSkip: 0,
//   intClickInterval: 2,
//   intTimeInterval: 15,
//   intRandom: false,
//   nativeRandom: false,
//   smallNativeRandom: false,
//   bannerRandom: false,
//   appOpenBackFill: false,
//   intBackFill: false,
//   nativeBackFill: false,
//   smallNativeBackFill: false,
//   bannerBackFill: false,
//   rewardVideoBackFill: false,
//   rewardIntBackFill: false,
//   adBtnBGColor: "#0C6FF9",
//   adBtnTxtColor: "#ffffff",
//   ppLink: "https://intrepidapps4.blogspot.com/p/privacy-policy.html",
//   feedBackId: "feedback.intrepidapps@gmail.com",
//   appOpenId: "ca-app-pub-3940256099942544/9257395921",
//   appOpenIds: ["ca-app-pub-3940256099942544/9257395921"],
//   intIds: ["ca-app-pub-3940256099942544/1033173712"],
//   nativeIds: ["ca-app-pub-3940256099942544/2247696110"],
//   smallNativeIds: ["ca-app-pub-3940256099942544/2247696110"],
//   bannerIds: ["ca-app-pub-3940256099942544/6300978111"],
//   rewardIntIds: ["/21775744923/example/rewarded_interstitial"],
//   rewardVideoIds: ["/6499/example/rewarded"],
//   alAppOpen: "TEST",
//   alInt: "TEST",
//   alNative: "TEST",
//   alSmallNative: "TEST",
//   alBanner: "TEST",
//   alRewardVideo: "TEST",
//   fbInt: "CAROUSEL_IMG_SQUARE_APP_INSTALL#YOUR_PLACEMENT_ID",
//   fbNative: "IMG_16_9_APP_INSTALL#YOUR_PLACEMENT_ID",
//   fbBanner: "IMG_16_9_APP_INSTALL#YOUR_PLACEMENT_ID",
//   fbNativeBanner: "IMG_16_9_APP_INSTALL#YOUR_PLACEMENT_ID",
//   fbRectBanner: "IMG_16_9_APP_INSTALL#YOUR_PLACEMENT_ID",
//   fbRewardInt: "VID_HD_16_9_15S_APP_INSTALL#YOUR_PLACEMENT_ID",
//   intScreensCount: "-1",
//   intSkips: "-1",
//   intScreens: "None",
//   nativeScreens: "Insta_HomeFragment,StartAppActivity,TikTokActivity,Twitter_Activity,PinActivity",
//   smallNativeScreens: "Insta_Download_Fragment,ImageFragment,MystoryFragment,VideoFragment,SavedFragment",
//   bannerScreens: "None",
//   cBannerScreens: "None",
//   inlineBannerScreens: "None",
//   rewardIntScreens: "None",
//   rewardVideoScreens: "None"
// };
