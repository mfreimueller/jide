import { StringDecoder } from "node:string_decoder";

export const OUTPUT_LIMIT_BYTES = 1024 * 1024;
export const FLUSH_INTERVAL_MS = 16;

export type Stream = "stdout" | "stderr";
export interface OutputChunk {
  stream: Stream;
  text: string;
}

/**
 * Decodes the program's output (UTF-8, also when a character is split between two reads),
 * counts the bytes of stdout and stderr together and hands the text on in batches, so a print
 * loop cannot flood the renderer. Once the limit is reached further output is dropped.
 */
export class OutputBatcher {
  private readonly decoders: Record<Stream, StringDecoder> = {
    stdout: new StringDecoder("utf8"),
    stderr: new StringDecoder("utf8")
  };
  private pending: OutputChunk[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private total = 0;
  private limited = false;

  constructor(
    private readonly emit: (chunks: OutputChunk[]) => void,
    private readonly onLimit: () => void,
    private readonly limitBytes = OUTPUT_LIMIT_BYTES,
    private readonly intervalMs = FLUSH_INTERVAL_MS
  ) {}

  get limitReached(): boolean {
    return this.limited;
  }

  push(stream: Stream, data: Buffer): void {
    if (this.limited) return;
    let buf = data;
    let reached = false;
    if (this.total + buf.length >= this.limitBytes) {
      buf = buf.subarray(0, Math.max(0, this.limitBytes - this.total));
      reached = true;
    }
    this.total += buf.length;
    this.add(stream, this.decoders[stream].write(buf));
    if (reached) {
      this.limited = true;
      this.onLimit();
    }
  }

  /** Emits everything that is still pending, including incomplete characters at the end. */
  finish(): void {
    if (!this.limited) {
      for (const s of ["stdout", "stderr"] as const) this.add(s, this.decoders[s].end());
    }
    this.flushNow();
  }

  private add(stream: Stream, text: string): void {
    if (text === "") return;
    const last = this.pending[this.pending.length - 1];
    if (last && last.stream === stream) last.text += text;
    else this.pending.push({ stream, text });
    this.timer ??= setTimeout(() => this.flushNow(), this.intervalMs);
  }

  flushNow(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.pending.length === 0) return;
    const out = this.pending;
    this.pending = [];
    this.emit(out);
  }
}
