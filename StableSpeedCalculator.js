class StableSpeedCalculator {
  constructor(updateInterval = 1000, movingAverageWindow = 5, alpha = 0.2) {
    this.updateInterval = updateInterval;
    this.movingAverageWindow = movingAverageWindow;
    this.alpha = alpha; // Low-pass filter coefficient

    this.lastPosition = null;
    this.lastTimestamp = null;
    this.lastSpeedUpdate = 0;
    this.speedHistory = [];
    this.filteredSpeed = 0;
  }

  calculateSpeed(currentPosition, currentTimestamp) {
    if (this.lastPosition === null || this.lastTimestamp === null) {
      this.lastPosition = currentPosition;
      this.lastTimestamp = currentTimestamp;
      return null;
    }

    const distance = Math.abs(currentPosition - this.lastPosition); // Metre cinsinden mesafe
    const timeDiff = (currentTimestamp - this.lastTimestamp) / 1000; // Saniye cinsinden zaman farkı

    if (timeDiff === 0) return null;

    const instantSpeed = distance / timeDiff; // Metre/saniye cinsinden anlık hız

    // Hareketli ortalama hesaplama
    this.speedHistory.push(instantSpeed);
    if (this.speedHistory.length > this.movingAverageWindow) {
      this.speedHistory.shift();
    }
    const averageSpeed =
      this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length;

    // Düşük geçişli filtre uygulama
    this.filteredSpeed =
      this.alpha * averageSpeed + (1 - this.alpha) * this.filteredSpeed;

    this.lastPosition = currentPosition;
    this.lastTimestamp = currentTimestamp;

    return {
      instantSpeed,
      averageSpeed,
      filteredSpeed: this.filteredSpeed,
      timeDiff,
    };
  }

  processSpeedCalculation(data) {
    const currentTime = Date.now();
    const timeStep = (currentTime - this.lastSpeedUpdate) / 1000;
    if (currentTime - this.lastSpeedUpdate >= this.updateInterval) {
      const result = this.calculateSpeed(data.dis, currentTime);

      if (result !== null) {
       /*  console.log(`Instant speed: ${result.instantSpeed.toFixed(2)} m/s`);
        console.log(`Average speed: ${result.averageSpeed.toFixed(2)} m/s`);
        console.log(`Filtered speed: ${result.filteredSpeed.toFixed(2)} m/s`); */

        this.lastSpeedUpdate = currentTime;
        return { ...result };
      }
    }

    return null;
  }
}

module.exports = StableSpeedCalculator;
