// Global değişkenler
let lastPosition = null;
let lastTimestamp = null;
const updateInterval = 1000; // Hız güncelleme aralığı (ms cinsinden)

// Hız hesaplama fonksiyonu
function calculateSpeed(currentPosition, currentTimestamp) {
  if (lastPosition === null || lastTimestamp === null) {
    lastPosition = currentPosition;
    lastTimestamp = currentTimestamp;
    return null;
  }

  const distance = Math.abs(currentPosition - lastPosition); // Metre cinsinden mesafe
  const timeDiff = (currentTimestamp - lastTimestamp) / 1000; // Saniye cinsinden zaman farkı

  if (timeDiff === 0) return null;

  const speed = distance / timeDiff; // Metre/saniye cinsinden hız

  lastPosition = currentPosition;
  lastTimestamp = currentTimestamp;

  return { speed, timeDiff };
}

// Hız hesaplama ve gönderme işlemi
let lastSpeedUpdate = 0;

function processSpeedCalculation(data) {
  const currentTime = Date.now();

  if (currentTime - lastSpeedUpdate >= updateInterval) {
    const { speed, timeDiff } = calculateSpeed(data.dis, currentTime);

    if (speed !== null) {
      console.log(`Calculated speed: ${speed.toFixed(2)} m/s`);

      // Hız verisini dashboard'a gönder


      return { speed, timeDiff };

      lastSpeedUpdate = currentTime;
    }
  }
}

module.exports = processSpeedCalculation;
