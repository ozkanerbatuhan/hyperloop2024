class StableMotionCalculator {
  constructor() {
    this.velocity = { x: 0, y: 0, z: 0 };
    this.position = { x: 0, y: 0, z: 0 };
    this.orientation = { pitch: 0, yaw: 0, roll: 0 };
    this.lastUpdateTime = Date.now();
    this.gravity = 9.81;

    // Kalman filter parameters
    this.kalmanState = {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      ax: 0,
      ay: 0,
      az: 0
    };
    this.kalmanCovariance = Array(9).fill().map(() => Array(9).fill(0));
    this.processNoise = 0.01;
    this.measurementNoise = 0.1;
  }

  update(acceleration, gyro) {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - this.lastUpdateTime) / 1000; // Time in seconds

    // Remove gravity from acceleration
    const accWithoutGravity = this.removeGravity(acceleration);

    // Apply Kalman filter
    this.kalmanFilter(accWithoutGravity, elapsedTime);

    // Update orientation using complementary filter
    this.updateOrientation(acceleration, gyro, elapsedTime);

    // Update velocity and position from Kalman filter state
    this.velocity = {
      x: this.kalmanState.vx,
      y: this.kalmanState.vy,
      z: this.kalmanState.vz
    };
    this.position = {
      x: this.kalmanState.x,
      y: this.kalmanState.y,
      z: this.kalmanState.z
    };

    this.lastUpdateTime = currentTime;

    return this.getCurrentState(elapsedTime);
  }

  removeGravity(acceleration) {
    // Simple gravity removal assuming the device is roughly level
    return {
      x: acceleration.x,
      y: acceleration.y,
      z: acceleration.z - this.gravity
    };
  }

  kalmanFilter(acceleration, dt) {
    // Prediction step
    const F = [
      [1, 0, 0, dt, 0, 0, 0.5*dt*dt, 0, 0],
      [0, 1, 0, 0, dt, 0, 0, 0.5*dt*dt, 0],
      [0, 0, 1, 0, 0, dt, 0, 0, 0.5*dt*dt],
      [0, 0, 0, 1, 0, 0, dt, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, dt, 0],
      [0, 0, 0, 0, 0, 1, 0, 0, dt],
      [0, 0, 0, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1]
    ];

    const predictedState = this.matrixMultiply(F, Object.values(this.kalmanState));
    const Q = this.createDiagonalMatrix(9, this.processNoise);
    const predictedCovariance = this.matrixAdd(
      this.matrixMultiply(this.matrixMultiply(F, this.kalmanCovariance), this.transposeMatrix(F)),
      Q
    );

    // Update step
    const H = [
      [0, 0, 0, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1]
    ];
    const R = this.createDiagonalMatrix(3, this.measurementNoise);
    const y = [acceleration.x - predictedState[6], acceleration.y - predictedState[7], acceleration.z - predictedState[8]];
    const S = this.matrixAdd(
      this.matrixMultiply(this.matrixMultiply(H, predictedCovariance), this.transposeMatrix(H)),
      R
    );
    const K = this.matrixMultiply(this.matrixMultiply(predictedCovariance, this.transposeMatrix(H)), this.inverseMatrix(S));

    const updatedState = this.vectorAdd(predictedState, this.matrixMultiply(K, y));
    const updatedCovariance = this.matrixSubtract(
      predictedCovariance,
      this.matrixMultiply(this.matrixMultiply(K, H), predictedCovariance)
    );

    // Update Kalman filter state and covariance
    this.kalmanState = {
      x: updatedState[0], y: updatedState[1], z: updatedState[2],
      vx: updatedState[3], vy: updatedState[4], vz: updatedState[5],
      ax: updatedState[6], ay: updatedState[7], az: updatedState[8]
    };
    this.kalmanCovariance = updatedCovariance;
  }

  updateOrientation(acceleration, gyro, dt) {
    // Complementary filter for orientation
    const accelPitch = Math.atan2(-acceleration.x, Math.sqrt(acceleration.y * acceleration.y + acceleration.z * acceleration.z));
    const accelRoll = Math.atan2(acceleration.y, acceleration.z);

    const alpha = 0.98;
    this.orientation.pitch = alpha * (this.orientation.pitch + gyro.x * dt) + (1 - alpha) * accelPitch;
    this.orientation.roll = alpha * (this.orientation.roll + gyro.y * dt) + (1 - alpha) * accelRoll;
    this.orientation.yaw += gyro.z * dt;

    this.orientation.pitch = this.normalizeAngle(this.orientation.pitch);
    this.orientation.roll = this.normalizeAngle(this.orientation.roll);
    this.orientation.yaw = this.normalizeAngle(this.orientation.yaw);
  }

  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  getCurrentState(timeStep) {
    return {
      velocity: { ...this.velocity },
      position: { ...this.position },
      orientation: { ...this.orientation },
      acceleration: {
        x: this.kalmanState.ax,
        y: this.kalmanState.ay,
        z: this.kalmanState.az
      },
      timeStep: timeStep
    };
  }

  // Matrix operation helper functions
  matrixMultiply(a, b) {
    if (typeof b[0] !== 'object') {
      return a.map(row => row.reduce((sum, val, i) => sum + val * b[i], 0));
    }
    return a.map(row => b[0].map((_, i) => row.reduce((sum, val, j) => sum + val * b[j][i], 0)));
  }

  matrixAdd(a, b) {
    return a.map((row, i) => row.map((val, j) => val + b[i][j]));
  }

  matrixSubtract(a, b) {
    return a.map((row, i) => row.map((val, j) => val - b[i][j]));
  }

  transposeMatrix(m) {
    return m[0].map((_, i) => m.map(row => row[i]));
  }

  createDiagonalMatrix(size, value) {
    return Array(size).fill().map((_, i) => Array(size).fill().map((_, j) => i === j ? value : 0));
  }

  inverseMatrix(m) {
    // Simple 3x3 matrix inversion, for larger matrices use a more robust method
    const det = m[0][0] * (m[1][1] * m[2][2] - m[2][1] * m[1][2]) -
                m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
                m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const invdet = 1 / det;
    return [
      [(m[1][1] * m[2][2] - m[2][1] * m[1][2]) * invdet, (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invdet, (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invdet],
      [(m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invdet, (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invdet, (m[1][0] * m[0][2] - m[0][0] * m[1][2]) * invdet],
      [(m[1][0] * m[2][1] - m[2][0] * m[1][1]) * invdet, (m[2][0] * m[0][1] - m[0][0] * m[2][1]) * invdet, (m[0][0] * m[1][1] - m[1][0] * m[0][1]) * invdet]
    ];
  }

  vectorAdd(a, b) {
    return a.map((val, i) => val + b[i]);
  }
}

module.exports = StableMotionCalculator;