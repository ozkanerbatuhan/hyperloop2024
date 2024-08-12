class RaceTrack {
  constructor() {
    this.sections = [
      { length: 5, interval: 0 }, // İlk 5 metre (hiç şerit yok)
      { length: 86, interval: 4 }, // Sonraki 86 metre (4 metre aralıklarla)
      { length: 1.95, interval: 0.05 }, // 100 metre işaretçisinin 1.95 metre boyunca (5 cm)
      { length: 2.05, interval: 0 }, // 100 metre işaretçisinden sonraki 2.05 metre (hiç şerit yok)
      { length: 44, interval: 4 }, // 44 metre boyunca (4 metre aralıklarla)
      { length: 4, interval: 0 }, // 4 metre boyunca (hiç şerit yok)
      { length: 0.95, interval: 0.05 }, // 48 metre işaretçisinin 0.95 metre boyunca (5 cm)
      { length: 3.05, interval: 0 }, // 3.05 metre (hiç şerit yok)
      { length: 44, interval: 4 }, // 44 metre boyunca (4 metre aralıklarla)
    ];
    this.lastTime = null;
    this.lastPosition = 0;
    this.passedBandCount = 0;
  }

  calculatePositionAndSpeed(currentTime) {
    let position = 0;
    let totalStripes = 0;

    for (const section of this.sections) {
      const sectionStripes =
        section.interval > 0
          ? Math.floor(section.length / section.interval)
          : 0;

      if (totalStripes + sectionStripes >= this.passedBandCount) {
        position += (this.passedBandCount - totalStripes) * section.interval;
        break;
      }

      totalStripes += sectionStripes;
      position += section.length;
    }

    let speed = 0;
    if (this.lastTime !== null) {
      const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
      const deltaPosition = position - this.lastPosition;
      speed = deltaPosition / deltaTime; // Speed = distance/time
    }

    // Update the last known values
    this.lastTime = currentTime;
    this.lastPosition = position;

    return {
      position: position.toFixed(2),
      speed: speed.toFixed(2),
      timeStep: deltaTime,
    };
  }
}

module.exports = RaceTrack;
