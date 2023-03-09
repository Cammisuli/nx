import { workspaceRoot } from '../../utils/workspace-root';
import type { Server, Socket } from 'net';
import { serverLogger } from './logger';
import { serializeResult } from '../socket-utils';
import type { AsyncSubscription } from '@parcel/watcher';
import { serialize } from 'v8';
import { compress } from '../../native';

export const SERVER_INACTIVITY_TIMEOUT_MS = 10800000 as const; // 10800000 ms = 3 hours

let sourceWatcherSubscription: AsyncSubscription | undefined;
let outputsWatcherSubscription: AsyncSubscription | undefined;

export function getSourceWatcherSubscription() {
  return sourceWatcherSubscription;
}

export function getOutputsWatcherSubscription() {
  return outputsWatcherSubscription;
}

export function storeSourceWatcherSubscription(s: AsyncSubscription) {
  sourceWatcherSubscription = s;
}

export function storeOutputsWatcherSubscription(s: AsyncSubscription) {
  outputsWatcherSubscription = s;
}

interface HandleServerProcessTerminationParams {
  server: Server;
  reason: string;
}

export async function handleServerProcessTermination({
  server,
  reason,
}: HandleServerProcessTerminationParams) {
  try {
    server.close();
    if (sourceWatcherSubscription) {
      await sourceWatcherSubscription.unsubscribe();
      serverLogger.watcherLog(
        `Unsubscribed from changes within: ${workspaceRoot} (sources)`
      );
    }
    if (outputsWatcherSubscription) {
      await outputsWatcherSubscription.unsubscribe();
      serverLogger.watcherLog(
        `Unsubscribed from changes within: ${workspaceRoot} (outputs)`
      );
    }
    serverLogger.log(`Server stopped because: "${reason}"`);
  } finally {
    process.exit(0);
  }
}

let serverInactivityTimerId: NodeJS.Timeout | undefined;

export function resetInactivityTimeout(cb: () => void): void {
  if (serverInactivityTimerId) {
    clearTimeout(serverInactivityTimerId);
  }
  serverInactivityTimerId = setTimeout(cb, SERVER_INACTIVITY_TIMEOUT_MS);
}

export function respondToClient(
  socket: Socket,
  response: string,
  description: string
) {
  return new Promise(async (res) => {
    if (description) {
      serverLogger.requestLog(`Responding to the client.`, description);
    }

    if (!response) {
      return res(null);
    }

    let socketWrite: string | Buffer;
    if (process.env.NX_NATIVE == 'false') {
      socketWrite = `${response}${String.fromCodePoint(4)}`;
    } else {
      performance.mark('serialize-start');
      const compressed = compress(response);
      performance.mark('serialize-end');
      performance.measure('serialize', 'serialize-start', 'serialize-end');

      // We include the size of the serialized data so that we can decompress it later
      socketWrite = Buffer.concat([
        Buffer.from(`${response.length}\r`),
        compressed,
        Buffer.from('\r\n'),
      ]);
    }

    socket.write(socketWrite, (err) => {
      if (err) {
        console.error(err);
      }
      serverLogger.log(`Done responding to the client`, description);
      res(null);
    });
  });
}

export async function respondWithErrorAndExit(
  socket: Socket,
  description: string,
  error: Error
) {
  // print some extra stuff in the error message
  serverLogger.requestLog(
    `Responding to the client with an error.`,
    description,
    error.message
  );
  console.error(error);

  error.message = `${error.message}\n\nBecause of the error the Nx daemon process has exited. The next Nx command is going to restart the daemon process.\nIf the error persists, please run "nx reset".`;

  await respondToClient(socket, serializeResult(error, null), null);
  process.exit(1);
}
