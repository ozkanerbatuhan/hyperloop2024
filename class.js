class MotionCalculator {
  constructor() {
    this.velocity = { x: 0, y: 0, z: 0 };
    this.position = { x: 0, y: 0, z: 0 };
    this.orientation = { roll: 0, pitch: 0, yaw: 0 };
    this.lastUpdateTime = Date.now();
    this.gravitationalAcceleration = 9.81; // m/s^2
    this.noiseThreshold = 0.05; // m/s^2 (arttırıldı)
    this.maxAcceleration = 20; // m/s^2
    this.stationaryThreshold = 0.1; // m/s^2 (arttırıldı)
    this.lastValidAcceleration = {
      x: 0,
      y: 0,
      z: this.gravitationalAcceleration,
    };
    this.accumulatedData = [];
    this.analysisPeriod = 5; // seconds (azaltıldı)
    this.analysisStartTime = null;
    this.stationaryMaxValues = null;
    this.isAnalyzing = true;
    this.stationaryCount = 0;
    this.stationaryCountThreshold = 5; // Sabit durum için gereken ardışık sayım (azaltıldı)
    this.lastVelocity = { x: 0, y: 0, z: 0 };
    this.minMovementThreshold = 0.01; // Minimum hareket eşiği (yeni eklendi)
  }

  update(acceleration, gyro) {
    const currentTime = Date.now();
    const timeStep = (currentTime - this.lastUpdateTime) / 1000; // Saniye cinsinden

    if (!this.validateAccelerationData(acceleration)) {
      console.error("Geçersiz ivme verisi:", acceleration);
      return null;
    }

    if (this.analysisStartTime === null) {
      this.analysisStartTime = currentTime;
    }

    if (this.isAnalyzing) {
      this.accumulateData(acceleration, currentTime);
      if ((currentTime - this.analysisStartTime) / 1000 >= this.analysisPeriod) {
        this.calculateStationaryMaxValues();
        this.isAnalyzing = false;
      }
      return null;
    }

    const filteredAcc = this.filterAcceleration(acceleration);

    if (!this.exceedsStationaryThreshold(filteredAcc)) {
      this.stationaryCount++;
      if (this.stationaryCount >= this.stationaryCountThreshold) {
        this.resetMotion();
        return this.getCurrentState(timeStep);
      }
    } else {
      this.stationaryCount = 0;
      this.updateVelocityAndPosition(filteredAcc, timeStep);
    }

    this.calculateOrientation(acceleration, gyro, timeStep);

    this.lastUpdateTime = currentTime;
    this.lastValidAcceleration = acceleration;
    this.lastVelocity = { ...this.velocity };

    return this.getCurrentState(timeStep);
  }

  validateAccelerationData(acceleration) {
    // Veri varlığı kontrolü
    if (
      !acceleration ||
      typeof acceleration.x !== "number" ||
      typeof acceleration.y !== "number" ||
      typeof acceleration.z !== "number"
    ) {
      return false;
    }

    // Makul aralık kontrolü
    const totalAcc = Math.sqrt(
      Math.pow(acceleration.x, 2) +
        Math.pow(acceleration.y, 2) +
        Math.pow(acceleration.z, 2)
    );

    if (totalAcc > this.maxAcceleration * 2) {
      return false;
    }

    // Ani değişim kontrolü
    const accChange = {
      x: Math.abs(acceleration.x - this.lastValidAcceleration.x),
      y: Math.abs(acceleration.y - this.lastValidAcceleration.y),
      z: Math.abs(acceleration.z - this.lastValidAcceleration.z),
    };

    if (
      accChange.x > this.maxAcceleration ||
      accChange.y > this.maxAcceleration ||
      accChange.z > this.maxAcceleration
    ) {
      return false;
    }

    return true;
  }

  filterAcceleration(acceleration) {
    return {
      x: Math.abs(acceleration.x) > this.noiseThreshold ? acceleration.x : 0,
      y: Math.abs(acceleration.y) > this.noiseThreshold ? acceleration.y : 0,
      z: Math.abs(acceleration.z - this.gravitationalAcceleration) > this.noiseThreshold
        ? acceleration.z - this.gravitationalAcceleration
        : 0,
    };
  }

  accumulateData(acceleration, currentTime) {
    this.accumulatedData.push(acceleration);
  }

  calculateStationaryMaxValues() {
    let maxX = 0,
      maxY = 0,
      maxZ = 0;

    this.accumulatedData.forEach((data) => {
      if (Math.abs(data.x) > maxX) maxX = Math.abs(data.x);
      if (Math.abs(data.y) > maxY) maxY = Math.abs(data.y);
      if (Math.abs(data.z - this.gravitationalAcceleration) > maxZ)
        maxZ = Math.abs(data.z - this.gravitationalAcceleration);
    });

    this.stationaryMaxValues = {
      x: maxX * 1.2,
      y: maxY * 1.2,
      z: maxZ * 1.2,
    };
  }

  exceedsStationaryThreshold(acceleration) {
    return (
      Math.abs(acceleration.x) > this.stationaryMaxValues.x ||
      Math.abs(acceleration.y) > this.stationaryMaxValues.y ||
      Math.abs(acceleration.z) > this.stationaryMaxValues.z
    );
  }

  resetMotion() {
    this.velocity = { x: 0, y: 0, z: 0 };
    this.position = { x: 0, y: 0, z: 0 };
  }

  updateVelocityAndPosition(acceleration, timeStep) {
    // Hız güncelleme
    this.velocity.x += acceleration.x * timeStep;
    this.velocity.y += acceleration.y * timeStep;
    this.velocity.z += acceleration.z * timeStep;

    // Hız sönümleme
    const dampingFactor = 0.95; // Azaltıldı
    this.velocity.x *= dampingFactor;
    this.velocity.y *= dampingFactor;
    this.velocity.z *= dampingFactor;

    // Minimum hareket eşiği kontrolü
    if (Math.abs(this.velocity.x) < this.minMovementThreshold) this.velocity.x = 0;
    if (Math.abs(this.velocity.y) < this.minMovementThreshold) this.velocity.y = 0;
    if (Math.abs(this.velocity.z) < this.minMovementThreshold) this.velocity.z = 0;

    // Konum güncelleme
    this.position.x += this.velocity.x * timeStep;
    this.position.y += this.velocity.y * timeStep;
    this.position.z += this.velocity.z * timeStep;
  }
  calculateOrientation(acceleration, gyro, timeStep) {
    // Roll ve Pitch açıları için ivmeölçer kullanımı
    this.orientation.roll =
      Math.atan2(acceleration.y, acceleration.z) * (180 / Math.PI);
    this.orientation.pitch =
      Math.atan2(
        -acceleration.x,
        Math.sqrt(
          acceleration.y * acceleration.y + acceleration.z * acceleration.z
        )
      ) *
      (180 / Math.PI);

    // Yaw açısı için jiroskop kullanımı
    this.orientation.yaw += gyro.z * timeStep;

    // Açıları normalize et
    this.orientation.roll = this.normalizeAngle(this.orientation.roll);
    this.orientation.pitch = this.normalizeAngle(this.orientation.pitch);
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
      timeStep: timeStep,
    };
  }
}

module.exports = MotionCalculator;
