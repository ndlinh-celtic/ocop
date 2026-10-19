import net from "node:net";
import type { Readable } from "node:stream";

export type ScanResult = { clean: true } | { clean: false; signature: string };

export interface VirusScanner {
  scan(stream: AsyncIterable<Uint8Array> | Readable): Promise<ScanResult>;
}

const CHUNK = 64 * 1024;

/**
 * clamd INSTREAM over TCP: "zINSTREAM\0", then length-prefixed chunks, then a zero-length chunk.
 * clamd answers "stream: OK" or "stream: <signature> FOUND". Anything else is an error, so the
 * job retries rather than marking a file clean.
 */
export function clamdScanner(opts: { host: string; port: number; timeoutMs?: number }) {
  const connect = () =>
    new Promise<net.Socket>((resolve, reject) => {
      const socket = net.connect({ host: opts.host, port: opts.port }, () => resolve(socket));
      socket.setTimeout(opts.timeoutMs ?? 120_000, () => socket.destroy(new Error("clamd timed out")));
      socket.once("error", reject);
    });

  const reply = (socket: net.Socket) =>
    new Promise<string>((resolve, reject) => {
      let data = "";
      socket.on("data", (d) => (data += d.toString("utf8")));
      socket.once("end", () => resolve(data.replace(/\0/g, "").trim()));
      socket.once("error", reject);
    });

  const write = (socket: net.Socket, buf: Buffer) =>
    new Promise<void>((resolve, reject) => socket.write(buf, (err) => (err ? reject(err) : resolve())));

  return {
    async ping(): Promise<void> {
      const socket = await connect();
      const answer = reply(socket);
      socket.end("zPING\0");
      if ((await answer) !== "PONG") throw new Error("clamd did not answer PONG");
    },
    async scan(stream: AsyncIterable<Uint8Array>): Promise<ScanResult> {
      const socket = await connect();
      const answer = reply(socket);
      await write(socket, Buffer.from("zINSTREAM\0"));
      for await (const piece of stream) {
        for (let off = 0; off < piece.length; off += CHUNK) {
          const chunk = Buffer.from(piece.subarray(off, off + CHUNK));
          const len = Buffer.alloc(4);
          len.writeUInt32BE(chunk.length);
          await write(socket, Buffer.concat([len, chunk]));
        }
      }
      socket.end(Buffer.alloc(4));
      const text = await answer;
      if (text.endsWith("OK")) return { clean: true };
      const found = /^stream: (.+) FOUND$/.exec(text);
      if (found) return { clean: false, signature: found[1]! };
      throw new Error(`clamd error: ${text}`);
    },
  } satisfies VirusScanner & { ping(): Promise<void> };
}
