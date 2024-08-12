class MotionCalculator {
    constructor() {
      this.velocity = { x: 0, y: 0, z: 0 };
      this.position = { x: 0, y: 0, z: 0 };
      this.orientation = { pitch: 0, yaw: 0, roll: 0 };
      this.lastUpdateTime = Date.now();
      this.gravity = 9.81;
      this.alpha = 0.8; // Low-pass filter coefficient
      this.gyroError = { x: 0.56, y: -2, z: 0.79 }; // From Arduino code
      this.accError = { x: 0.58, y: -1.58 }; // From Arduino code
      this.lastGyro = { x: 0, y: 0, z: 0 };
      this.gyroAngle = { x: 0, y: 0 };
      this.initialized = false;
      this.stationaryThreshold = 0.15;
      this.velocityThreshold = 0.05; // New threshold for velocity
      this.maxVelocity = 10; // Maximum allowable velocity
      this.kalmanFilter = new KalmanFilter(3); // Assuming 3D state
    }
  
    update(acceleration, gyro) {
      const currentTime = Date.now();
      const elapsedTime = (currentTime - this.lastUpdateTime) / 1000; // Time in seconds
  
      if (!this.initialized) {
        this.initializeStationary(acceleration, gyro);
        this.initialized = true;
        return this.getCurrentState();
      }
  
      // Convert acceleration to g force (assuming it's in m/s^2)
      const accInG = {
        x: acceleration.x / this.gravity,
        y: acceleration.y / this.gravity,
        z: acceleration.z / this.gravity
      };
  
      // Update orientation
      this.updateOrientation(accInG, gyro, elapsedTime);
  
      // Remove gravity and apply low-pass filter
      const filteredAcc = this.lowPassFilter(this.removeGravity(acceleration));
  
      // Update velocity with individual axis checks
      this.updateVelocity(filteredAcc, elapsedTime);
  
      // Update position
      this.updatePosition(elapsedTime);
  
      this.lastUpdateTime = currentTime;
      this.lastGyro = gyro;
  
      return this.getCurrentState(elapsedTime);
    }
  
    updateVelocity(filteredAcc, elapsedTime) {
      ['x', 'y', 'z'].forEach(axis => {
        if (Math.abs(filteredAcc[axis]) > this.stationaryThreshold) {
          this.velocity[axis] += filteredAcc[axis] * elapsedTime;
        } else if (Math.abs(this.velocity[axis]) < this.velocityThreshold) {
          this.velocity[axis] = 0; // Stop completely if below threshold
        } else {
          // Apply friction to gradually reduce velocity
          this.velocity[axis] *= 0.95;
        }
  
        // Limit maximum velocity
        this.velocity[axis] = Math.max(Math.min(this.velocity[axis], this.maxVelocity), -this.maxVelocity);
      });
  
      // Apply Kalman filter to velocity
      const filteredState = this.kalmanFilter.filter([this.velocity.x, this.velocity.y, this.velocity.z]);
      this.velocity = {
        x: filteredState[0],
        y: filteredState[1],
        z: filteredState[2]
      };
    }
  
    updatePosition(elapsedTime) {
      ['x', 'y', 'z'].forEach(axis => {
        this.position[axis] += this.velocity[axis] * elapsedTime;
      });
    }
  
    updateOrientation(accInG, gyro, elapsedTime) {
      // Calculate accelerometer angles
      const accAngleX = (Math.atan(accInG.y / Math.sqrt(Math.pow(accInG.x, 2) + Math.pow(accInG.z, 2))) * 180 / Math.PI) - this.accError.x;
      const accAngleY = (Math.atan(-1 * accInG.x / Math.sqrt(Math.pow(accInG.y, 2) + Math.pow(accInG.z, 2))) * 180 / Math.PI) + this.accError.y;
  
      // Correct gyro values
      const correctedGyro = this.correctGyro(gyro);
  
      // Calculate gyro angles
      this.gyroAngle.x += correctedGyro.x * elapsedTime;
      this.gyroAngle.y += correctedGyro.y * elapsedTime;
      this.orientation.yaw += correctedGyro.z * elapsedTime;
  
      // Complementary filter
      const alpha = 0.96; // Adjust this value to change the filter's behavior
      this.orientation.roll = alpha * (this.orientation.roll + correctedGyro.x * elapsedTime) + (1 - alpha) * accAngleX;
      this.orientation.pitch = alpha * (this.orientation.pitch + correctedGyro.y * elapsedTime) + (1 - alpha) * accAngleY;
  
      // Normalize angles
      this.orientation.roll = this.normalizeAngle(this.orientation.roll);
      this.orientation.pitch = this.normalizeAngle(this.orientation.pitch);
      this.orientation.yaw = this.normalizeAngle(this.orientation.yaw);
    }
  
    // ... (other methods remain the same)
  
    // New method for gyro correction
    correctGyro(gyro) {
      return {
        x: gyro.x - this.gyroError.x,
        y: gyro.y - this.gyroError.y,
        z: gyro.z - this.gyroError.z
      };
    }
  }
  
  // Simple Kalman Filter implementation
  class KalmanFilter {
    constructor(dimension) {
      this.dimension = dimension;
      this.x = new Array(dimension).fill(0); // State estimate
      this.P = new Array(dimension).fill(1); // Estimate uncertainty
      this.Q = 0.1; // Process noise
      this.R = 1; // Measurement noise
    }
  
    filter(measurement) {
      // Prediction step
      // (In this simple implementation, we assume no control input and constant state)
  
      // Update step
      for (let i = 0; i < this.dimension; i++) {
        const K = this.P[i] / (this.P[i] + this.R); // Kalman gain
        this.x[i] = this.x[i] + K * (measurement[i] - this.x[i]);
        this.P[i] = (1 - K) * this.P[i];
  
        // Update process noise
        this.P[i] += this.Q;
      }
  
      return this.x;
    }
  }
  
  module.exports = MotionCalculator;