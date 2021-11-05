const { sBoxes } = require('./sBoxes.js');
const { 
  initialPermutationTable,
  finalPermutationTable,
  extensionBlockTable,
  initialPermutationKeyTable,
  cyclicKeysTable,
  finalPermutationKeyTable,
  permutationBlockTable
} = require('./permutations.js');

const BLOCK_SIZE = 64;
const BITE_SIZE = 8;
const NUMBER_OF_ROUNDS = 16;

/*
*         ENCRYPT
*/

const textToBinary = (text) => {
  const PADDING = '00000000';
  const binary = [];
  for (let i = 0; i < text.length; i++) {
    const compact = text.charCodeAt(i).toString(2);
    const padded = (PADDING.substring(0, PADDING.length - compact.length) + compact).split('');
    binary.push(padded);
  }
  return binary;
}

const splitBinary = (binary, size) => {
  const flatBinary = binary.flat(Infinity);
  const splitedBinary = [];
  for (let i = size; i <= flatBinary.length; i += size) {
    splitedBinary.push(flatBinary.slice(i - size, i));
  }

  if (flatBinary.length % size !== 0) {
    const PADDING = Array(size).fill(0).join('');
    const blockMaxCount = Math.floor(flatBinary.length / size);
    const compact = flatBinary.slice(blockMaxCount * size, flatBinary.length);
    splitedBinary.push([...compact, ...PADDING.slice(0, PADDING.length - compact.length)]);
  }

  return splitedBinary;
}

const binaryToText = (binary) => {
  const splitedToOctets = splitBinary(binary, BITE_SIZE);

  const text = splitedToOctets.map(octet => {
    return String.fromCharCode(parseInt(Number(octet.join('')), 2));
  });

  return text;
}

const splitBlockToLeftAndRight = (block) => {
  const left = block.slice(0, block.length / 2);
  const right = block.slice(block.length / 2,  block.length);
  return {
    left, 
    right
  };
}

const sBoxChanger = (extensionBlock, sBox) => {
  const PADDING = Array(4).fill(0).join('');;
  const changedBlock = [];
  for (let i = 0; i < extensionBlock.length; i++) {
    const splitedBits = splitToMiddleAndExtremeBits(extensionBlock[i]);
    const numberOfRow = parseInt(splitedBits.extreme, 2);
    const numberOfColumn = parseInt(splitedBits.middle, 2);
    const changedBits = Number(sBox[i][numberOfRow][numberOfColumn]).toString(2).split('');
    const normalizeBits = [...PADDING.slice(0, PADDING.length - changedBits.length), ...changedBits];
    changedBlock.push(normalizeBits);
  }
  return changedBlock;
}

const splitToMiddleAndExtremeBits = (block) => {
  const middleBits = [];
  for (let i = 1; i < block.length - 1; i++) {
    middleBits.push(block[i]);
  }
  const splitedBits = {
    extreme: String(block[0]) + String(block[block.length - 1]),
    middle: middleBits.join('')
  }
  return splitedBits;
}

const permutationChanger = (block, permutation) => {
  const flatBlock = block.flat(Infinity);
  const permutedBlock = [];
  for (let i = 0; i < permutation.length; i++) {
    permutedBlock.push(flatBlock[permutation[i] - 1])
  }
  return permutedBlock;
}

const XOR = (block, key) => {
  return block.map((bit, i) => {
    const xorBit = bit ^ key[i];
    return String(xorBit);
  })
}

// функция f
const cipherBlock = (block, roundCounter, keys) => {
  const extensionBlock = permutationChanger(block, extensionBlockTable);
  const xorBlock = XOR(extensionBlock, keys[roundCounter]);
  const splitedTo6 = splitBinary(xorBlock, 6);
  const changedBlockFromSBox = sBoxChanger(splitedTo6, sBoxes);
  const finalPermutationBlock = permutationChanger(changedBlockFromSBox, permutationBlockTable);
  return finalPermutationBlock;
}

const encryptText = (text, keys) => {
  const binaryText = textToBinary(text); 
  const splitedTo64Bits = splitBinary(binaryText, BLOCK_SIZE);

  const encryptedText = [];

  for (let i = 0; i < splitedTo64Bits.length; i++) {    
    let roundCounter = 0;
    const permutationBlock = permutationChanger(
      splitedTo64Bits[i], initialPermutationTable
    );
    const block = splitBlockToLeftAndRight(permutationBlock);

    const round = (block) => {
      if (roundCounter === NUMBER_OF_ROUNDS) {
        encryptedText.push(permutationChanger([...block.left, ...block.right], finalPermutationTable));
        return;
      }
  
      const cipheredBlock = cipherBlock(block.right, roundCounter, keys);
      const xorLeftAndRight = XOR(cipheredBlock, block.left);
  
      roundCounter++;
      round({
        left: block.right,
        right: xorLeftAndRight
      })
    }

    round(block);
  }

  return binaryToText(encryptedText).join('');
}

const decryptText = (text, keys) => {
  const binaryText = textToBinary(text); 
  const splitedTo64Bits = splitBinary(binaryText, BLOCK_SIZE);

  const decryptedText = [];

  for (let i = 0; i < splitedTo64Bits.length; i++) {    
    let roundCounter = NUMBER_OF_ROUNDS - 1;
    const permutationBlock = permutationChanger(
      splitedTo64Bits[i], initialPermutationTable
    );
    const block = splitBlockToLeftAndRight(permutationBlock);
  
    const round = (block) => {
      if (roundCounter === -1) {
        decryptedText.push(permutationChanger([...block.left, ...block.right], finalPermutationTable));
        return;
      }

      const cipheredBlock = cipherBlock(block.left, roundCounter, keys);
      const xorLeftAndRight = XOR(cipheredBlock, block.right);
  
      roundCounter--;
      round({
        left: xorLeftAndRight,
        right: block.left
      })
    }

    round(block);
  }

  return binaryToText(decryptedText).join('');
}

/* 
*         Generating 16 keys 
*/

const cyclicLeftShift = (block, pos) => {
  const changeBlock = [...block];
  const shifted = changeBlock.splice(0, pos);
  return [...changeBlock, ...shifted];
}

const checkOdd = (bits) => {
  let counter = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] == 1) counter++;
  }
  return counter % 2 === 1 ? true : false; 
}

const controlKeyCheck = (key) => {
  const newKey = [];
  for (let i = 0; i < key.length; i++) {
    if (checkOdd(key[i])) {
      newKey.push([...key[i], '0']);
    } else {
      newKey.push([...key[i], '1']);
    }
  }
  return newKey;
}


const genKeys = (key) => {
  if (key.length !== 7) throw new Error('key must have 56 bits');

  const keys = [];
  let keyCounter = 0;

  const binaryKey = textToBinary(key);
  const keyTo7bits = splitBinary(binaryKey, 7);
  // Контроль четности:
  // Добавляются биты в позиции 8, 16, 24, 32, 40, 48, 56, 64 ключа таким образом,
  // чтобы каждый байт содержал нечетное число единиц.
  const extendedKey = controlKeyCheck(keyTo7bits);
  const permutedKey = permutationChanger(extendedKey, initialPermutationKeyTable);
  
  const fillKey = (key) => {
    if (keyCounter === NUMBER_OF_ROUNDS) return;

    const splitedKey = splitBlockToLeftAndRight(key);
    const cyclikLeft = cyclicLeftShift(splitedKey.left, cyclicKeysTable[keyCounter]);
    const cyclikRight = cyclicLeftShift(splitedKey.right, cyclicKeysTable[keyCounter]);
    const finalKey = permutationChanger([...cyclikLeft, ...cyclikRight], finalPermutationKeyTable);
    keys.push(finalKey);
    keyCounter++;

    fillKey([...cyclikLeft, ...cyclikRight]);
  }

  fillKey(permutedKey);

  return keys;
}

module.exports = {
  genKeys,
  encryptText,
  decryptText
}
