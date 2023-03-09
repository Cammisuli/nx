import { decompress } from '../native';

export function consumeMessagesFromSocket(callback: (message: string) => void) {
  let message = '';
  console.log('string message');
  return (data) => {
    const chunk = data.toString();
    if (chunk.codePointAt(chunk.length - 1) === 4) {
      message += chunk.substring(0, chunk.length - 1);
      callback(message);
      message = '';
    } else {
      message += chunk;
    }
  };
}

export function consumeBinaryMessagesFromSocket(
  callback: (data: string) => void
) {
  // todo
  console.log('binary message');
  const returnCodes = Buffer.from('\r\n');
  let message = Buffer.alloc(0);
  let uncompressedSize = 0;
  return (data: Buffer) => {
    if (uncompressedSize == 0) {
      const messageSize = data.subarray(
        0,
        data.findIndex((i) => i == returnCodes[0])
      );
      uncompressedSize = +messageSize.toString();
      data = data.subarray(messageSize.length + 1);
    }

    if (
      data[data.length - 2] == returnCodes[0] &&
      data[data.length - 1] == returnCodes[1]
    ) {
      message = Buffer.concat([message, data.subarray(0, data.length - 2)]);
      const decompressed = decompress(message, uncompressedSize);
      callback(decompressed.toString());
      message = Buffer.alloc(0);
      uncompressedSize = 0;
    } else {
      message = Buffer.concat([message, data]);
    }
  };
}
