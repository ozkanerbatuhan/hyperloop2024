function isRedColor(data) {
    const { red, green, blue, clear, color_temp, light_lux } = data;

    // Oran hesaplama
    const total = red + green + blue;
    const redRatio = red / total;
    const greenRatio = green / total;
    const blueRatio = blue / total;

    // Işık koşullarına göre dinamik eşik değerleri belirleme
    const minRedRatio = 0.45; // Kırmızı bileşenin toplamda en az %45 olması
    const maxGreenRatio = 0.35; // Yeşil bileşenin toplamda en fazla %35 olması
    const maxBlueRatio = 0.35; // Mavi bileşenin toplamda en fazla %35 olması

    // Parlaklık ve renk sıcaklığına bağlı dinamik kontroller
    const minLux = 50; // Minimum kabul edilebilir ışık seviyesi (lüks)
    const maxColorTemp = 6500; // Maksimum kabul edilebilir renk sıcaklığı (düşük sıcaklık kırmızımsı bir ışık verir)

    // Renk oranlarını ve ışık koşullarını kontrol etme
    if (
        redRatio > minRedRatio &&
        greenRatio < maxGreenRatio &&
        blueRatio < maxBlueRatio &&
        light_lux > minLux &&
        color_temp < maxColorTemp
    ) {
        return true; // Kırmızı renk baskın
    } else {
        return false; // Kırmızı renk baskın değil
    }
}

module.exports = isRedColor;