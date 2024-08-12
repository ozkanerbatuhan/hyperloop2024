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
    this.stationaryThreshold = 0.015;
  }

  update(acceleration, gyro) {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - this.lastUpdateTime) / 1000; // Time in seconds

    if (!this.initialized) {
      this.initializeStationary(acceleration, gyro);
      this.initialized = true;
      return this.getCurrentState();
    }

    // ... (keep existing angle calculations)
    // Convert acceleration to g force (assuming it's in m/s^2)
    const accInG = {
      x: acceleration.x / this.gravity,
      y: acceleration.y / this.gravity,
      z: acceleration.z / this.gravity,
    };
    

    // Calculate accelerometer angles
    const accAngleX =
      (Math.atan(
        accInG.y / Math.sqrt(Math.pow(accInG.x, 2) + Math.pow(accInG.z, 2))
      ) *
        180) /
        Math.PI -
      this.accError.x;
    const accAngleY =
      (Math.atan(
        (-1 * accInG.x) /
          Math.sqrt(Math.pow(accInG.y, 2) + Math.pow(accInG.z, 2))
      ) *
        180) /
        Math.PI +
      this.accError.y;

    // Correct gyro values
    const correctedGyro = {
      x: gyro.x + this.gyroError.x,
      y: gyro.y + this.gyroError.y,
      z: gyro.z + this.gyroError.z,
    };

    // Calculate gyro angles
    this.gyroAngle.x += correctedGyro.x * elapsedTime;
    this.gyroAngle.y += correctedGyro.y * elapsedTime;
    this.orientation.yaw += correctedGyro.z * elapsedTime;

    // Complementary filter
    this.orientation.roll = 0.96 * this.gyroAngle.x + 0.04 * accAngleX;
    this.orientation.pitch = 0.96 * this.gyroAngle.y + 0.04 * accAngleY;

    // Normalize angles
    this.orientation.roll = this.normalizeAngle(this.orientation.roll);
    this.orientation.pitch = this.normalizeAngle(this.orientation.pitch);
    this.orientation.yaw = this.normalizeAngle(this.orientation.yaw);

    // Update velocity and position (simplified from original)
    const filteredAcc = this.lowPassFilter(this.removeGravity(acceleration));

    if (Math.abs(filteredAcc.x) > this.stationaryThreshold) {
      this.velocity.x += filteredAcc.x * elapsedTime;
    } else {
      this.velocity.x = 0;
    }

    if (Math.abs(filteredAcc.y) > this.stationaryThreshold) {
      this.velocity.y += filteredAcc.y * elapsedTime;
    } else {
      this.velocity.y = 0;
    }

    if (Math.abs(filteredAcc.z) > this.stationaryThreshold) {
      this.velocity.z += filteredAcc.z * elapsedTime;
    } else {
      this.velocity.z = 0;
    }

    const dampingFactor = 0.9;
    this.velocity.x *= dampingFactor;
    this.velocity.y *= dampingFactor;
    this.velocity.z *= dampingFactor;

    this.position.x += this.velocity.x * elapsedTime;
    this.position.y += this.velocity.y * elapsedTime;
    this.position.z += this.velocity.z * elapsedTime;

    this.lastUpdateTime = currentTime;
    this.lastGyro = gyro;

    const initialState = {
      position: { ...this.position },
      velocity: { ...this.velocity },
    };

    const finalState = this.rk4(initialState, acceleration, elapsedTime);

    this.position = finalState.position;
    this.velocity = finalState.velocity;

    this.lastUpdateTime = currentTime;
    this.lastGyro = gyro;

    return this.getCurrentState(elapsedTime);
  }

  rk4(initialState, acceleration, dt) {
    const k1 = this.derivative(initialState, acceleration);
    const k2 = this.derivative(
      this.getMiddleState(initialState, k1, dt / 2),
      acceleration
    );
    const k3 = this.derivative(
      this.getMiddleState(initialState, k2, dt / 2),
      acceleration
    );
    const k4 = this.derivative(
      this.getMiddleState(initialState, k3, dt),
      acceleration
    );

    return {
      position: {
        x:
          initialState.position.x +
          (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
        y:
          initialState.position.y +
          (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy),
        z:
          initialState.position.z +
          (dt / 6) * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz),
      },
      velocity: {
        x:
          initialState.velocity.x +
          (dt / 6) * (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx),
        y:
          initialState.velocity.y +
          (dt / 6) * (k1.dvy + 2 * k2.dvy + 2 * k3.dvy + k4.dvy),
        z:
          initialState.velocity.z +
          (dt / 6) * (k1.dvz + 2 * k2.dvz + 2 * k3.dvz + k4.dvz),
      },
    };
  }

  derivative(state, acceleration) {
    const filteredAcc = this.lowPassFilter(this.removeGravity(acceleration));
    return {
      dx: state.velocity.x,
      dy: state.velocity.y,
      dz: state.velocity.z,
      dvx: filteredAcc.x,
      dvy: filteredAcc.y,
      dvz: filteredAcc.z,
    };
  }

  getMiddleState(initialState, k, dt) {
    return {
      position: {
        x: initialState.position.x + k.dx * dt,
        y: initialState.position.y + k.dy * dt,
        z: initialState.position.z + k.dz * dt,
      },
      velocity: {
        x: initialState.velocity.x + k.dvx * dt,
        y: initialState.velocity.y + k.dvy * dt,
        z: initialState.velocity.z + k.dvz * dt,
      },
    };
  }

  initializeStationary(acceleration, gyro) {
    this.filteredAcc = { x: 0, y: 0, z: 0 };
    this.lastGyro = gyro;
  }

  removeGravity(acceleration) {
    return {
      x: acceleration.x - this.gravity,
      y: acceleration.y,
      z: acceleration.z,
    };
  }

  lowPassFilter(acceleration) {
    this.filteredAcc.x =
      this.alpha * this.filteredAcc.x + (1 - this.alpha) * acceleration.x;
    this.filteredAcc.y =
      this.alpha * this.filteredAcc.y + (1 - this.alpha) * acceleration.y;
    this.filteredAcc.z =
      this.alpha * this.filteredAcc.z + (1 - this.alpha) * acceleration.z;
    return this.filteredAcc;
  }

  correctGyro(gyro) {
    const gyroDiff = {
      x: gyro.x - this.lastGyro.x,
      y: gyro.y - this.lastGyro.y,
      z: gyro.z - this.lastGyro.z,
    };

    const errorWeight = 0.95;
    this.gyroError.x =
      errorWeight * this.gyroError.x + (1 - errorWeight) * gyroDiff.x;
    this.gyroError.y =
      errorWeight * this.gyroError.y + (1 - errorWeight) * gyroDiff.y;
    this.gyroError.z =
      errorWeight * this.gyroError.z + (1 - errorWeight) * gyroDiff.z;

    return {
      x: gyro.x - this.gyroError.x,
      y: gyro.y - this.gyroError.y,
      z: gyro.z - this.gyroError.z,
    };
  }

  updateOrientation(acceleration, gyro, timeStep) {
    const accelPitch = Math.atan2(
      -acceleration.x,
      Math.sqrt(
        acceleration.y * acceleration.y + acceleration.z * acceleration.z
      )
    );
    const accelRoll = Math.atan2(acceleration.y, acceleration.z);

    const gyroWeight = 0.95;
    this.orientation.pitch =
      gyroWeight * (this.orientation.pitch + gyro.x * timeStep) +
      (1 - gyroWeight) * ((accelPitch * 180) / Math.PI);
    this.orientation.roll =
      gyroWeight * (this.orientation.roll + gyro.y * timeStep) +
      (1 - gyroWeight) * ((accelRoll * 180) / Math.PI);
    this.orientation.yaw += gyro.z * timeStep;

    this.orientation.pitch = this.normalizeAngle(this.orientation.pitch);
    this.orientation.roll = this.normalizeAngle(this.orientation.roll);
    this.orientation.yaw = this.normalizeAngle(this.orientation.yaw);
  }

  normalizeAngle(angle) {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  getCurrentState(timeStep) {
    return {
      velocity: { ...this.velocity },
      position: { ...this.position },
      orientation: { ...this.orientation },
      acceleration: { ...this.filteredAcc },
      timeStep: timeStep,
    };
  }
}

module.exports = MotionCalculator;
