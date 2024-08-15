const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const StableMotionCalculator = require("./class.js");
const fs = require("fs");
const path = require("path");
const isRedColor = require("./isRed.js");
const processSpeedCalculation = require("./speed.js");
const TrainTunnel = require("./TrainTunnel.js");
const StableSpeedCalculator = require("./StableSpeedCalculator.js");
const trainTunnel = new TrainTunnel();
let dashboardID = null;
let trainID = null;
let mobileID = null;
const COOLDOWN_PERIOD = 2; // 2 ms cooldown period
const speedCalculator = new StableSpeedCalculator();
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
  },
});
let prevTime = Date.now();
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
function sendPing(socket) {
  setInterval(() => {
    socket.to(trainID).emit("ping");
  }, 500); // Send ping every 1 second
}
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
      trainID = id;
      sendPing(socket);
      socket.to(trainID).emit("ping");
      console.log("train", trainID);
      if (!calculators.has(id)) {
        calculators.set(id, new StableMotionCalculator());
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
  socket.on("pong", () => {
    let currentTime = Date.now();
    let timeDiff = (currentTime - prevTime) / 1000;
    socket.to(trainID).emit("ping");
    console.log("pong", timeDiff.toFixed(3));
    prevTime = currentTime;
  });
  socket.on("band", (colorData) => {
    try {
      if (!isValidObject(colorData)) {
        throw new Error("Invalid color data");
      }

      const currentTime = Date.now();
      const isRed = isRedColor(colorData);

      if (isRed && currentTime - passedBandCountCoolDown > COOLDOWN_PERIOD) {
        passedBandCountCoolDown = currentTime;

        const { position, speed, timeSinceLastStripe, remainingDistance } =
          trainTunnel.calculatePositionAndSpeed(currentTime);

        console.log("Position:", position, "m");
        console.log("Speed:", speed.toFixed(2), "m/s");
        console.log(
          "Time since last stripe:",
          timeSinceLastStripe.toFixed(3),
          "s"
        );
        console.log("Remaining distance:", remainingDistance, "m");

        const currentSection = trainTunnel.getCurrentSection();
        console.log("Current section:", currentSection);

        if (dashboardID) {
          socket.to(dashboardID).emit("positionUpdate", {
            passedBandCount: trainTunnel.passedStripeCount,
            position,
            timeStep: timeSinceLastStripe,
          });
          socket.to(dashboardID).emit("speedUpdate", {
            speed,
            timeStep: timeSinceLastStripe,
          });
          socket.to(dashboardID).emit("position", position / 191);
        }

        if (mobileID) {
          socket.to(mobileID).emit("position", {
            passedBandCount: trainTunnel.passedStripeCount,
            position,
            timeStep: timeSinceLastStripe,
          });

          socket.to(mobileID).emit("speedUpdate", {
            speed,
            timeStep: timeSinceLastStripe,
          });
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

      const maxDistance = 40; // Maximum viewing distance in meters
      const minStrength = 4; // Minimum observed strength value
      const maxStrength = 13000; // Maximum observed strength value

      // Update ambient temperature if available
      if (data.temp !== null) {
        temperatures.tempAmbient = data.temp;
        if (dashboardID) {
          socket.to(dashboardID).emit("temperatureUpdate", temperatures);
        }
      }

      // Function to calculate expected strength based on distance
      const calculateExpectedStrength = (distance) => {
        if (distance < 10) {
          return maxStrength * Math.exp(-0.1 * distance);
        } else if (distance < 50) {
          return maxStrength * Math.exp(-0.1 * (distance - 10));
        } else {
          return Math.max(
            minStrength,
            maxStrength * Math.exp(-0.1 * (distance - 50))
          );
        }
      };

      // Function to check if the strength is within an acceptable range for the given distance
      const isStrengthValid = (strength, distance) => {
        const expectedStrength = calculateExpectedStrength(distance);
        // console.log("Expected strength:", expectedStrength, strength);

        const tolerance = 0.3; // 20% tolerance, adjust as needed
        return strength >= expectedStrength * (1 - tolerance);
      };

      if (data.dis !== null && data.strength !== null) {
        const distance = data.dis;
        const normalizedStrength =
          (data.strength - minStrength) / (maxStrength - minStrength);

        if (isStrengthValid(data.strength, distance)) {
          /*  console.log("Reliable LIDAR data received:", {
            distance: distance,
            strength: data.strength,
            normalizedStrength: normalizedStrength,
            temp: data.temp,
            time: data.time,
          }); */
          if (mobileID && distance <= maxDistance) {
            socket.to(mobileID).emit("lidar", {
              dis: distance,
              strength: data.strength,
              temp: data.temp,
              time: data.time,
            });
          }
          if (dashboardID) {
            socket.to(dashboardID).emit("lidarUpdate", {
              dis: distance,
              strength: data.strength,
              normalizedStrength: normalizedStrength,
              temp: data.temp,
              time: data.time,
            });
          }
          const result = speedCalculator.processSpeedCalculation({
            dis: distance,
          });
          if (result) {
            /* console.log(`Stable speed: ${result.filteredSpeed.toFixed(2)} m/s`); */
            /* socket.to(mobileID).emit("speedUpdate", {
              speed: result.filteredSpeed,
              timeDiff: result.timeDiff,
            });
            socket
              .to(dashboardID)
              .emit("speedUpdate", { speed: result.filteredSpeed }); */
          }
        } else {
          /* console.log("Unreliable LIDAR data:", {
            distance: distance,
            strength: data.strength,
            expectedStrength: calculateExpectedStrength(distance),
          }); */
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

  socket.on("disconnect", () => {
    console.log("A user disconnected");
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
