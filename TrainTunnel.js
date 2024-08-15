class TrainTunnel {
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
    this.passedStripeCount = 0;
    this.speed = 0;
    this.position = 0;
    this.totalLength = this.sections.reduce((sum, section) => sum + section.length, 0);
    this.expectedNextStripePosition = 0;
    this.maxErrorThreshold = 0.5; // Metre cinsinden maksimum hata payı
    console.log(`Total tunnel length: ${this.totalLength} meters`);
  }

  calculatePositionAndSpeed(currentTime) {
    let newPosition = 0;
    let totalStripes = 0;
    this.incrementPassedStripeCount();

    // Geçilen şerit sayısına göre yeni pozisyonu hesapla
    for (const section of this.sections) {
      const sectionStripes = section.interval > 0 ? Math.floor(section.length / section.interval) : 0;
      if (totalStripes + sectionStripes >= this.passedStripeCount) {
        newPosition += (this.passedStripeCount - totalStripes) * section.interval;
        break;
      }
      totalStripes += sectionStripes;
      newPosition += section.length;
    }

    let deltaTime = 0;
    let deltaPosition = newPosition - this.lastPosition;

    // Hata kontrolü
    const positionError = Math.abs(newPosition - this.expectedNextStripePosition);
    let missedStripes = 0;
    if (positionError > this.maxErrorThreshold) {
      missedStripes = Math.round(positionError / this.getCurrentSection().stripeInterval) - 1;
      console.log(`Possible missed stripes detected: ${missedStripes}`);
      newPosition += missedStripes * this.getCurrentSection().stripeInterval;
      this.passedStripeCount += missedStripes;
    }

    // Zaman farkını hesapla ve hızı güncelle
    if (this.lastTime !== null) {
      deltaTime = (currentTime - this.lastTime) / 1000; // Saniyeye çevir
      console.log(`Time since last stripe: ${deltaTime.toFixed(3)}s`);

      if (deltaTime > 0 && deltaPosition > 0) {
        this.speed = deltaPosition / deltaTime;
        console.log(`Calculated Speed: ${this.speed.toFixed(2)}m/s`);
      } else {
        console.log(`Speed calculation skipped. DeltaTime: ${deltaTime}, DeltaPosition: ${deltaPosition}`);
      }
    } else {
      console.log("First stripe detected, initial speed set to 0");
    }

    // Son bilinen değerleri güncelle
    this.lastTime = currentTime;
    this.lastPosition = newPosition;
    this.position = Math.min(newPosition, this.totalLength);
    this.updateExpectedNextStripePosition();

    return {
      position: parseFloat(this.position.toFixed(2)),
      speed: parseFloat(this.speed.toFixed(2)),
      timeSinceLastStripe: parseFloat(deltaTime.toFixed(3)),
      remainingDistance: parseFloat((this.totalLength - this.position).toFixed(2)),
      missedStripes: missedStripes
    };
  }

  incrementPassedStripeCount() {
    this.passedStripeCount++;
    console.log(`Passed Stripe Count: ${this.passedStripeCount}`);
  }

  getCurrentSection() {
    let accumulatedLength = 0;
    for (let i = 0; i < this.sections.length; i++) {
      accumulatedLength += this.sections[i].length;
      if (this.position <= accumulatedLength) {
        return {
          sectionIndex: i,
          sectionType: this.sections[i].interval > 0 ? "Striped" : "Non-striped",
          stripeInterval: this.sections[i].interval
        };
      }
    }
    return null; // Tünel sonuna ulaşıldı
  }

  updateExpectedNextStripePosition() {
    const currentSection = this.getCurrentSection();
    if (currentSection && currentSection.stripeInterval > 0) {
      this.expectedNextStripePosition = this.position + currentSection.stripeInterval;
    } else {
      // Eğer şu anki bölüm şeritsizse, bir sonraki şeritli bölümü bul
      let accumulatedLength = this.position;
      for (let i = currentSection.sectionIndex + 1; i < this.sections.length; i++) {
        if (this.sections[i].interval > 0) {
          this.expectedNextStripePosition = accumulatedLength + this.sections[i].interval;
          break;
        }
        accumulatedLength += this.sections[i].length;
      }
    }
  }
}

module.exports = TrainTunnel;