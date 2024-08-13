const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const MotionCalculator = require("./gptdeeneme.js");
const fs = require("fs");
const path = require("path");
const RaceTrack = require("./bandClass.js");
const isRedColor = require("./isRed.js");

let dashboardID = null;
let trainID = null;
let mobileID = null;

const app = express();
const server = http.createServer(app);
const raceTrack = new RaceTrack();
const io = socketIO(server, {
  cors: {
    origin: "*",
  },
});

const maxStrength = 12000;
const minStrength = 5;
const strengthThreshold = 1000;
let temperatures = {
  tempAmbient: 0,
  tempBattery: 0,
};
let passedBandCount = 0;
let passedBandCountCoolDown = 0;
const calculators = new Map();

// Yardımcı fonksiyonlar
const isValidId = (id) => typeof id === "string" && id.length > 0;
const isValidNumber = (num) =>
  typeof num === "number" && !isNaN(num) && isFinite(num);
const isValidObject = (obj) => typeof obj === "object" && obj !== null;

// Lidar verisi için yeni doğrulama fonksiyonu
const isValidLidarData = (data) => {
  return (
    isValidObject(data) &&
    (isValidNumber(data.temp) || data.temp === null) &&
    (isValidNumber(data.strength) || data.strength === null) &&
    (isValidNumber(data.dis) || data.dis === null) &&
    isValidNumber(data.time)
  );
};

// Acceleration verisi için yeni doğrulama fonksiyonu
const isValidAccelerationData = (data) => {
  const isValidXYZ = (obj) =>
    isValidObject(obj) &&
    isValidNumber(obj.x) &&
    isValidNumber(obj.y) &&
    isValidNumber(obj.z);

  return (
    isValidObject(data) &&
    isValidXYZ(data.accelerometer) &&
    isValidXYZ(data.gyroscope) &&
    isValidNumber(data.temperature)
  );
};
io.on("connection", (socket) => {
  socket.emit("connected", socket.id);

  socket.on("train", (id) => {
    try {
      if (!isValidId(id)) {
        throw new Error("Invalid train ID");
      }
      console.log("train", id);
      trainID = id;
      if (dashboardID) {
        socket.to(trainID).emit("ping", 1);
      }
      if (!calculators.has(id)) {
        calculators.set(id, new MotionCalculator());
      }
    } catch (error) {
      console.error("Error in train event:", error);
    }
  });

  socket.on("dashboard", (id) => {
    try {
      if (!isValidId(id)) {
        throw new Error("Invalid dashboard ID");
      }
      console.log("dashboard", id);
      dashboardID = id;
    } catch (error) {
      console.error("Error in dashboard event:", error);
    }
  });

  socket.on("mobile", (id) => {
    try {
      if (!isValidId(id)) {
        throw new Error("Invalid mobile ID");
      }
      console.log("mobile", id);
      mobileID = id;
    } catch (error) {
      console.error("Error in mobile event:", error);
    }
  });

  socket.on("band", (colorData) => {
    try {
      if (!isValidObject(colorData)) {
        throw new Error("Invalid color data");
      }
      const isRed = isRedColor(colorData);
      if (isRed && Date.now() - passedBandCountCoolDown > 500) {
        passedBandCount += 1;
        passedBandCountCoolDown = Date.now();
        const { position, speed, timeStep } =
          raceTrack.calculatePositionAndSpeed(Date.now());
        console.log("position", position, "speed", speed, "timeStep", timeStep);

        if (dashboardID) {
          socket
            .to(dashboardID)
            .emit("positionUpdate", { passedBandCount, position, timeStep });
          socket.to(dashboardID).emit("speedUpdate", { speed, timeStep });
        }
        if (mobileID) {
          socket
            .to(mobileID)
            .emit("position", { passedBandCount, position, timeStep });
          socket.to(mobileID).emit("speedUpdate", { speed, timeStep });
        }
      }
    } catch (error) {
      console.error("Error in band event:", error);
    }
  });

  socket.on("lidar", (data) => {
    try {
      if (!isValidLidarData(data)) {
        console.log("Invalid lidar data received:", data);
        throw new Error("Invalid lidar data");
      }
      temperatures.tempAmbient =
        data.temp !== null ? data.temp : temperatures.tempAmbient;
      if (dashboardID) {
        socket.to(dashboardID).emit("temperatureUpdate", temperatures);
      }
      if (data.strength !== null && data.strength >= strengthThreshold) {
        const remainingDistance =
          ((data.strength - minStrength) / (maxStrength - minStrength)) * 40;
        if (remainingDistance <= 40 && mobileID) {
          socket.to(mobileID).emit("lidar", {
            dis: data.dis,
            strength: data.strength,
            temp: data.temp,
            time: data.time,
          });
        }
        if (dashboardID) {
          socket.to(dashboardID).emit("lidarUpdate", {
            dis: remainingDistance,
            strength: data.strength,
            temp: data.temp,
            time: data.time,
          });
        }
      }
    } catch (error) {
      console.error("Error in lidar event:", error);
    }
  });

  socket.on("acceleration", (acc) => {
    try {
      let data;
      if (typeof acc === "string") {
        data = JSON.parse(acc);
      } else if (acc.gyroscope && acc.accelerometer && acc.temperature) {
        data = acc;
      } else {
        throw new Error("Invalid acceleration data type");
      }

      if (!isValidAccelerationData(data)) {
        console.log("Invalid acceleration data received:", data);
        throw new Error("Invalid acceleration data structure");
      }

      const { accelerometer, gyroscope, temperature } = data;
      temperatures.tempBattery = temperature;

      if (dashboardID) {
        socket.to(dashboardID).emit("temperatureUpdate", temperatures);
      }

      if (calculators.has(trainID)) {
        const calculator = calculators.get(trainID);
        const result = calculator.update(accelerometer, gyroscope);
        const progress = (result.position.x / 191) * 100;

        if (dashboardID) {
          socket.to(dashboardID).emit("progressUpdate", progress);
          socket.to(dashboardID).emit("motionUpdate", {
            acceleration: accelerometer,
            velocity: result?.velocity || { x: 0, y: 0, z: 0 },
            position: result?.position || { x: 0, y: 0, z: 0 },
            orientation: result?.orientation || { roll: 0, pitch: 0, yaw: 0 },
          });
        }
        if (mobileID) {
          socket.to(mobileID).emit("progressUpdate", progress);
          socket.to(mobileID).emit("motionUpdate", {
            acceleration: accelerometer,
            velocity: result?.velocity || { x: 0, y: 0, z: 0 },
            position: result?.position || { x: 0, y: 0, z: 0 },
            orientation: result?.orientation || { roll: 0, pitch: 0, yaw: 0 },
            timeInterval: result?.timeStep || 0,
          });
        }
      } else if (dashboardID) {
        socket.to(dashboardID).emit("acceleration", data);
      }
    } catch (error) {
      console.error("Error in acceleration event:", error);
    }
  });
  socket.on("ping", (time) => {
    try {
      console.log("ping", Date.now() - time);
      if (dashboardID) socket.to(dashboardID).emit("ping", Date.now() - time);
      if (mobileID) socket.to(mobileID).emit("ping", Date.now() - time);
      if (trainID) socket.to(trainID).emit("ping", Date.now());
    } catch (error) {
      console.error("Error in ping event:", error);
    }
  });

  // Diğer event handler'lar için benzer kontroller eklenebilir
  socket.on("disconnect", () => {
    console.log("A user disconnected");
    if (socket.id === dashboardID) dashboardID = null;
    if (socket.id === trainID) trainID = null;
    if (socket.id === mobileID) mobileID = null;
  });

  socket.on("ready", (data) => {
    console.log("Ready event", data);
    socket.to(trainID).emit("ready", data);
  });

  socket.on("start", (data) => {
    console.log("Start event", data);
    socket.to(trainID).emit("start", data);
  });

  socket.on("stop", (data) => {
    console.log("Stop event", data);
    socket.to(trainID).emit("stop", data);
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  socket.on("break_event", (data) => {
    console.log("Break event", data);
    socket.to(trainID).emit("break_event", data);
  });

  socket.on("break_open", (data) => {
    console.log("Brake open event", data);
    socket.to(trainID).emit("break_open", data);
  });

  socket.on("break_close", (data) => {
    console.log("Brake closed event", data);
    socket.to(trainID).emit("break_close", data);
  });

  socket.on("emergency", (data) => {
    console.log("Emergency event", data);
    socket.to(trainID).emit("emergency", data);
  });
});

server.on("error", (error) => {
  console.error("Server error:", error);
});

const port = process.env.PORT || 3030;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
