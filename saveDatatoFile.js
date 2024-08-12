const fs = require('fs');
const path = require('path');

function saveDataToFile(data) {
    const filePath = path.resolve(__dirname, '../data.json'); // Bir üst klasöre kaydedilecek dosya

    // Dosya varsa üzerine yazmamak için kontrol edelim
    fs.readFile(filePath, 'utf8', (err, fileData) => {
        let dataArray = [];
        if (!err && fileData) {
            try {
                dataArray = JSON.parse(fileData);
            } catch (e) {
                console.error('Error parsing JSON file:', e);
            }
        }

        dataArray.push(data);

        fs.writeFile(filePath, JSON.stringify(dataArray, null, 2), 'utf8', (err) => {
            if (err) {
                console.error('Error saving data:', err);
            } else {
                console.log('Data successfully saved.');
            }
        });
    });
}

module.exports = saveDataToFile;