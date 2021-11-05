const readline = require('readline');
const {
    genKeys,
    encryptText,
    decryptText
} = require('./DES');

const rl = readline.createInterface(process.stdin, process.stdout);
const question = function(query) {
    return new Promise((res, rej) => {
        rl.question(query, answer => {
            res(answer);
        })
    });
};

(async function main() {
    let key = '';
    while ( key.length !== 7 ) {
        key = await question('Введите 56-битный ключ: ');
    }
    console.log('Ваш ключ -', key);

    let text = '';
    while ( text.length === 0) {
        text = await question('\nВведите сообщение для зашифровки: ');
    }
    console.log('Ваше сообщение -', text);

    const keys = genKeys(key);
    const encryptedText = encryptText(text, keys);
    console.log('\nЗашифрованное сообщение - ', encryptedText);
    const decryptedText = decryptText(encryptedText, keys);
    console.log('Расшифрованное сообщение - ', decryptedText);

    rl.close();
})();