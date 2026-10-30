import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const jar = join(here, '..', 'target', 'java-helper.jar')
const repoRoot = join(here, '..', '..')
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java'

class Helper {
  proc: ChildProcessWithoutNullStreams
  private buf = ''
  private waiting: ((line: string) => void)[] = []
  private lines: string[] = []
  exit: Promise<number | null>

  constructor() {
    this.proc = spawn(java, ['-jar', jar])
    this.proc.stdout.setEncoding('utf8')
    this.proc.stdout.on('data', (chunk: string) => {
      this.buf += chunk
      let i
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i)
        this.buf = this.buf.slice(i + 1)
        const w = this.waiting.shift()
        if (w) w(line)
        else this.lines.push(line)
      }
    })
    this.exit = new Promise((resolve) => this.proc.on('exit', (code) => resolve(code)))
  }

  private nextLine(): Promise<string> {
    const queued = this.lines.shift()
    if (queued !== undefined) return Promise.resolve(queued)
    return new Promise((resolve) => this.waiting.push(resolve))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async request(raw: string | object): Promise<any> {
    this.proc.stdin.write((typeof raw === 'string' ? raw : JSON.stringify(raw)) + '\n')
    return JSON.parse(await this.nextLine())
  }
}

let helper: Helper | undefined
afterEach(() => {
  helper?.proc.kill()
  helper = undefined
})

describe('java-helper protocol', () => {
  it('answers ping', async () => {
    helper = new Helper()
    const r = await helper.request({ id: 1, op: 'ping' })
    expect(r.id).toBe(1)
    expect(r.ok).toBe(true)
    expect(typeof r.version).toBe('string')
    expect(r.javaVersion).toMatch(/^\d+/)
  })

  it('reports a missing semicolon in Summe.java', async () => {
    helper = new Helper()
    const src = readFileSync(join(repoRoot, 'examples/summe/files/Summe.java'), 'utf8')
    const marker = '    // Dein Code kommt hierher'
    expect(src).toContain(marker)
    const content = src.replace(marker, '    int x = 5')
    const line = content.split('\n').findIndex((l) => l === '    int x = 5') + 1
    const r = await helper.request({ id: 2, op: 'compile', files: [{ path: 'Summe.java', content }] })
    expect(r.id).toBe(2)
    expect(r.ok).toBe(true)
    expect(r.success).toBe(false)
    expect(r.diagnostics).toHaveLength(1)
    expect(r.diagnostics[0]).toMatchObject({
      file: 'Summe.java',
      line,
      column: 14,
      severity: 'error',
      message: "';' erwartet",
      origin: 'student',
    })
  })

  it('compiles the unchanged example cleanly', async () => {
    helper = new Helper()
    const content = readFileSync(join(repoRoot, 'examples/summe/files/Summe.java'), 'utf8')
    const r = await helper.request({ id: 3, op: 'compile', files: [{ path: 'Summe.java', content }] })
    expect(r.success).toBe(true)
    expect(r.diagnostics).toEqual([])
  })

  it('survives malformed JSON and unknown ops', async () => {
    helper = new Helper()
    const bad = await helper.request('{this is not json')
    expect(bad).toMatchObject({ id: null, ok: false })
    expect(typeof bad.error).toBe('string')
    const unknown = await helper.request({ id: 9, op: 'frobnicate' })
    expect(unknown).toMatchObject({ id: 9, ok: false })
    const ping = await helper.request({ id: 10, op: 'ping' })
    expect(ping.ok).toBe(true)
  })

  it('exits 0 on shutdown', async () => {
    helper = new Helper()
    const r = await helper.request({ id: 4, op: 'shutdown' })
    expect(r).toEqual({ id: 4, ok: true })
    expect(await helper.exit).toBe(0)
  })

  it('exits 0 on EOF', async () => {
    helper = new Helper()
    await helper.request({ id: 1, op: 'ping' })
    helper.proc.stdin.end()
    expect(await helper.exit).toBe(0)
  })
})
