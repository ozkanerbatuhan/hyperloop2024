// Import the necessary modules
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
let dashboardID = 1;
let trainID = 2;
let mobileID = 3;

// Create an Express app
const app = express();
const server = http.createServer(app);

// Create a Socket.IO instance
const io = socketIO(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);
  socket.emit("connected", socket.id);
  socket.on("train", (id) => {
    console.log("train", id);
    trainID = id;
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
    console.log("acceleration", acc);
    socket.to(dashboardID).emit("acceleration", acc);
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
