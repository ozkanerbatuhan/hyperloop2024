const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const MotionCalculator = require("./gptdeeneme.js");
const fs = require("fs");
const path = require("path");
const RaceTrack = require("./bandClass.js");
const isRedColor = require("./isRed.js");
let dashboardID = 1;
let trainID = 2;
let mobileID = 3;

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
const strengthThreshold = 1000; // Example threshold for acceptable strength
let temperatures = {
  tempAmbient: 0,
  tempBattery: 0,
};
let passedBandCount = 0;
let passedBandCountCoolDown;
let motionUpdate = {
  acceleration: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  position: { x: 0, y: 0, z: 0 },
  orientation: { roll: 0, pitch: 0, yaw: 0 },
  timeInterval: 0,
};
const calculators = new Map();

io.on("connection", (socket) => {
  socket.emit("connected", socket.id);
  socket.on("train", (id) => {
    console.log("train", id);
    trainID = id;
    socket.to(trainID).emit("ping", 1);
    if (!calculators.has(id)) {
      calculators.set(id, new MotionCalculator());
    }
  });

  socket.on("dashboard", (id) => {
    console.log("dashboard", id);
    dashboardID = id;
  });

  socket.on("mobile", (id) => {
    console.log("mobile", id);
    mobileID = id;
  });

  socket.on("band", (colorData) => {
    const isRed = isRedColor(colorData);
    console.log("isRed", isRed, passedBandCountCoolDown);
    if (isRed && Date.now() - passedBandCountCoolDown > 500) {
      passedBandCount += 1;
      passedBandCountCoolDown = Date.now();
      const { position, speed, timeStep } = raceTrack.calculatePositionAndSpeed(
        Date.now()
      );
      socket
        .to(dashboardID)
        .emit("position", { passedBandCount, position, timeStep });
      socket
        .to(mobileID)
        .emit("position", { passedBandCount, position, timeStep });
      socket.to(dashboardID).emit("speedUpdate", { speed, timeStep });
      socket.to(mobileID).emit("speedUpdate", { speed, timeStep });
    }
  });
  socket.on("lidar", (data) => {
    temperatures.tempAmbient = data.temp;
    socket.to(dashboardID).emit("temperatureUpdate", temperatures);
    if (strength >= strengthThreshold) {
      const remainingDistance =
        ((strength - minStrength) / (maxStrength - minStrength)) * 30;
      if (remainingDistance <= 30) {
        socket.to(mobileID).emit("lidar", { dis, strength, temp, time });
        socket.to(dashboardID).emit("lidar", { dis, strength, temp, time });
      }
    }
  });
  socket.on("ping", (time) => {
    console.log("ping", Date.now() - time);
    socket.to(dashboardID).emit("ping", Date.now() - time);
    socket.to(mobileID).emit("ping", Date.now() - time);
    socket.to(trainID).emit("ping", Date.now());
  });
  socket.on("acceleration", (acc) => {
    if (calculators.has(trainID)) {
      const json = JSON.parse(acc);
      const accelerometer = json.accelerometer;
      const gyroscope = json.gyroscope;
      const temperature = json.temperature;
      temperatures.tempBattery = temperature;
      socket.to(dashboardID).emit("temperatureUpdate", temperatures);
      const calculator = calculators.get(trainID);
      const result = calculator.update(accelerometer, gyroscope);
      socket
        .to(dashboardID)
        .emit("progressUpdate", (result.position.x / 191) * 100);
      socket.to(dashboardID).emit("motionUpdate", {
        acceleration: accelerometer,
        velocity: result?.velocity || { x: 0, y: 0, z: 0 },
        position: result?.position || { x: 0, y: 0, z: 0 },
        orientation: result?.orientation || { roll: 0, pitch: 0, yaw: 0 },
      });
      //console.log(result);

      socket
        .to(mobileID)
        .emit("progressUpdate", (result.position.x / 191) * 100);
      socket.to(mobileID).emit("motionUpdate", {
        acceleration: result.acceleration,
        velocity: result?.velocity || { x: 0, y: 0, z: 0 },
        position: result?.position || { x: 0, y: 0, z: 0 },
        orientation: result?.orientation || { roll: 0, pitch: 0, yaw: 0 },
        timeInterval: result?.timeStep || 0,
      });
    } else {
      socket.to(dashboardID).emit("acceleration", acc);
    }
  });

  // come to dashboard and send to train
  socket.on("ready", (isReady) => {
    console.log("ready", isReady);
    socket.to(trainID).emit("ready", isReady);
  });
  socket.on("start", (isStart) => {
    console.log("start", isStart);
    socket.to(trainID).emit("start", isStart);
  });
  socket.on("stop", (isStop) => {
    console.log("stop", isStop);
    socket.to(trainID).emit("stop", isStop);
  });
  socket.on("break", (isBreak) => {
    console.log("break_event", isBreak);
    socket.to(trainID).emit("break", isBreak);
  });
  socket.on("emergency", (isEmergency) => {
    console.log("emergency", isEmergency);
    socket.to(trainID).emit("emergency", isEmergency);
  });
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });

  // come to mobile and send to train
  socket.on("increaseBand", (band) => {
    passedBandCount = passedBandCount + 1;
    socket.to(dashboardID).emit("band", passedBandCount);
  });
  socket.on("decreaseBand", (band) => {
    passedBandCount = passedBandCount - 1;
    socket.to(dashboardID).emit("band", passedBandCount);
  });
  socket.on("brakeOpen", (isBrakeOpen) => {
    console.log("brakeOpen", isBrakeOpen);
    socket.to(trainID).emit("brakeOpen", isBrakeOpen);
  });
  socket.on("brakeClose", (isBrakeClose) => {
    console.log("brakeClose", isBrakeClose);
    socket.to(trainID).emit("brakeClose", isBrakeClose);
  });
});

// Start the server
const port = 3030;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
