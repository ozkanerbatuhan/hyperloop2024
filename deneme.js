const data = require("./acceleration_data.js");
const MotionCalculator = require("./gptdeeneme");
const motion = new MotionCalculator();

function processDataWithInterval(dataArray, index = 0) {
  if (index >= dataArray.length) {
    console.log("Tüm veriler işlendi.");
    return;
  }

  const item = dataArray[index];
  const result = motion.update(item.accelerometer, item.gyroscope);
  console.log(result);

  setTimeout(() => processDataWithInterval(dataArray, index + 1), 700);
}

processDataWithInterval(data);

