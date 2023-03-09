import { hashFile, compress, decompress } from '../index';

import { tmpdir } from 'os';
import { mkdtemp, writeFile } from 'fs-extra';
import { join } from 'path';
import { deserialize, serialize } from 'v8';
import { PerformanceObserver } from 'perf_hooks';

describe('hasher', () => {
  it('should hash', async () => {
    expect(hashFile).toBeDefined();

    const tempDirPath = await mkdtemp(join(tmpdir(), 'native-test'));
    const tempFilePath = join(tempDirPath, 'temp.txt');
    await writeFile(tempFilePath, 'content');

    expect(hashFile(tempFilePath).hash).toBe('6193209363630369380');
  });
});

describe('binary', () => {
  it('compression', (done) => {
    function perfObserver(list, observer) {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'measure') {
          console.log(`${entry.name}'s duration: ${entry.duration}`);
        }
      });
      done();
    }

    const obj = {
      node: {
        obj: {
          temp: '2',
        },
      },
    };

    const observer = new PerformanceObserver(perfObserver);
    observer.observe({ entryTypes: ['measure', 'mark'] });
   

    performance.mark('flow-start');
    const stringify = JSON.stringify(obj);

    console.log("string length", stringify.length);

    performance.mark('compression-start');
    const compressed = compress(JSON.stringify(obj));
    performance.mark('compression-finished');
    performance.measure(
      'compression',
      'compression-start',
      'compression-finished'
    );
    console.log("compression length", compressed.length)

    performance.mark('decompress-start');
    const decompressed = decompress(compressed, stringify.length);
    performance.mark('decompress-finished');
    performance.measure(
      'decompress',
      'decompress-start',
      'decompress-finished'
    );

    performance.mark('deserialized-start');
    const deserialized = JSON.parse(decompressed.toString());
    performance.mark('deserialized-finished');
    performance.measure(
      'deserialized',
      'deserialized-start',
      'deserialized-finished'
    );

    performance.mark('flow-end');
    performance.measure('flow', 'flow-start', 'flow-end');

    // performance.mark('stringify-start');
    // const stringify = JSON.stringify(obj);
    // performance.mark('stringify-finished');
    // performance.measure('stringify', 'stringify-start', 'stringify-finished');

    expect(deserialized).toMatchInlineSnapshot(`
      Object {
        "node": Object {
          "obj": Object {
            "temp": "2",
          },
        },
      }
      `);
  });
});
