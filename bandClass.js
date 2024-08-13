class RaceTrack {
  constructor() {
    this.sections = [
      { length: 5, interval: 0 },
      { length: 86, interval: 4 },
      { length: 1.95, interval: 0.05 },
      { length: 2.05, interval: 0 },
      { length: 44, interval: 4 },
      { length: 4, interval: 0 },
      { length: 0.95, interval: 0.05 },
      { length: 3.05, interval: 0 },
      { length: 44, interval: 4 },
    ];
    this.lastTime = null;
    this.lastPosition = 0;
    this.passedBandCount = 0;
    this.speed = 0;
    this.position = 0;
  }

  calculatePositionAndSpeed(currentTime) {
    let newPosition = 0;
    let totalStripes = 0;
    this.incrementPassedBandCount();

    for (const section of this.sections) {
      const sectionStripes =
        section.interval > 0
          ? Math.floor(section.length / section.interval)
          : 0;
      if (totalStripes + sectionStripes >= this.passedBandCount) {
        newPosition += (this.passedBandCount - totalStripes) * section.interval;
        break;
      }
      totalStripes += sectionStripes;
      newPosition += section.length;
    }

    let deltaTime = 0;
    let deltaPosition = newPosition - this.lastPosition;

    if (this.lastTime !== null) {
      deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
      console.log(`Delta Time: ${deltaTime.toFixed(3)}s`);

      // Calculate instant speed based on the distance between the last two bands
      if (deltaTime > 0 && deltaPosition > 0) {
        this.speed = deltaPosition / deltaTime;
        console.log(`Calculated Speed: ${this.speed.toFixed(2)}m/s`);
      } else {
        console.log(
          `Speed calculation skipped. DeltaTime: ${deltaTime}, DeltaPosition: ${deltaPosition}`
        );
      }
    } else {
      console.log("First calculation, speed set to 0");
    }

    // Update the last known values
    this.lastTime = currentTime;
    this.lastPosition = newPosition;
    this.position = newPosition;

    return {
      position: this.position,
      speed: parseFloat(this.speed.toFixed(2)),
      timeStep: deltaTime,
    };
  }

  incrementPassedBandCount() {
    this.passedBandCount++;
    console.log(`Passed Band Count incremented: ${this.passedBandCount}`);
  }
}

module.exports = RaceTrack;