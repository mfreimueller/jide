/** Last events of this app run (Testen, Ausführen, Abgeben), kept in memory only, for the bug report (T44). */
export interface LogEvent {
  /** ISO 8601 UTC. */
  at: string;
  text: string;
}

export const EVENT_LOG_SIZE = 20;

export class EventLog {
  private entries: LogEvent[] = [];

  constructor(
    private readonly size = EVENT_LOG_SIZE,
    private readonly now: () => Date = () => new Date()
  ) {}

  add(text: string): void {
    this.entries.push({ at: this.now().toISOString(), text });
    if (this.entries.length > this.size) this.entries.splice(0, this.entries.length - this.size);
  }

  /** Oldest first. */
  list(): LogEvent[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

/** The log of this app run. */
export const eventLog = new EventLog();
