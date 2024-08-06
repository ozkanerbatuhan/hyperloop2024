const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const MotionCalculator = require("./class");

let dashboardID = 1;
let trainID = 2;
let mobileID = 3;

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
  cors: {
    origin: "*",
  },
});

// Her tren için ayrı bir hesaplayıcı oluştur
const calculators = new Map();

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);
  socket.emit("connected", socket.id);

  socket.on("train", (id) => {
    console.log("train", id);
    trainID = id;
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

  // come to train and send to dashboard
  socket.on("hasBand", (isReady) => {
    console.log("ready", isReady);
    socket.to(dashboardID).emit("ready", isReady);
  });

  socket.on("acceleration", (acc) => {
    if (calculators.has(trainID)) {
      const json = JSON.parse(acc);
      const accelerometer = json.accelerometer;
      const gyroscope = json.gyroscope;
      const temperature = json.temperature;
      console.log("temperature", temperature);

      const calculator = calculators.get(trainID);
      const result = calculator.update(accelerometer, gyroscope);
      console.log("result", result);

      // Hesaplanan değerleri dashboard'a gönder
      socket.to(dashboardID).emit("motionUpdate", {
        acceleration: acc,
        velocity: result?.velocity || { x: 0, y: 0, z: 0 },
        position: result?.position || { x: 0, y: 0, z: 0 },
        orientation: result?.orientation || { roll: 0, pitch: 0, yaw: 0 },
        timeStep: result?.timeStep || 0,
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
    console.log("band", band);
  });
  socket.on("decreaseBand", (band) => {
    console.log("band", band);
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
