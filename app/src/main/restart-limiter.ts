/** Allows the first start and then at most `maxRestarts` restarts within `windowMs`. */
export class RestartLimiter {
  private starts: number[] = [];

  constructor(
    private readonly maxRestarts = 3,
    private readonly windowMs = 60_000
  ) {}

  /** Records a start attempt; false means the limit is exceeded and nothing must be started. */
  tryStart(now = Date.now()): boolean {
    this.starts = this.starts.filter((t) => now - t < this.windowMs);
    if (this.starts.length >= this.maxRestarts + 1) return false;
    this.starts.push(now);
    return true;
  }
}
