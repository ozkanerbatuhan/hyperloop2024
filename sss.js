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
      // This is a simplified model. You may need to adjust this based on your specific LIDAR's characteristics
      return Math.max(minStrength, maxStrength * Math.exp(-0.1 * distance));
    };

    // Function to check if the strength is within an acceptable range for the given distance
    const isStrengthValid = (strength, distance) => {
      const expectedStrength = calculateExpectedStrength(distance);
      const tolerance = 0.2; // 20% tolerance, adjust as needed
      return (
        strength >= expectedStrength * (1 - tolerance) &&
        strength <= expectedStrength * (1 + tolerance)
      );
    };

    if (data.dis !== null && data.strength !== null) {
      const distance = Math.min(data.dis, maxDistance);
      const normalizedStrength =
        (data.strength - minStrength) / (maxStrength - minStrength);

      if (isStrengthValid(data.strength, distance)) {
        console.log("Reliable LIDAR data received:", {
          distance: distance,
          strength: data.strength,
          normalizedStrength: normalizedStrength,
          temp: data.temp,
          time: data.time,
        });

        // Emit to mobile device if connected and distance is within range
        if (mobileID && distance <= maxDistance) {
          socket.to(mobileID).emit("lidar", {
            dis: distance,
            strength: data.strength,
            temp: data.temp,
            time: data.time,
          });
        }

        // Emit to dashboard if connected
        if (dashboardID) {
          socket.to(dashboardID).emit("lidarUpdate", {
            dis: distance,
            strength: data.strength,
            normalizedStrength: normalizedStrength,
            temp: data.temp,
            time: data.time,
          });
        }
      } else {
        console.log("Unreliable LIDAR data:", {
          distance: distance,
          strength: data.strength,
          expectedStrength: calculateExpectedStrength(distance),
        });
      }
    }
  } catch (error) {
    console.error("Error in lidar event:", error);
  }
});
