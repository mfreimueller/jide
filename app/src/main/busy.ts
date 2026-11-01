/** Set while a test run is in progress, so "Ausführen" and "Testen" never run at the same time. */
let testing = false;

export function isTesting(): boolean {
  return testing;
}

export function setTesting(value: boolean): void {
  testing = value;
}
