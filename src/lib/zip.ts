import { Zip, ZipPassThrough } from 'fflate'

/** fflate writes classic ZIP files, which stop at 4 GB. Stay clear of it. */
const ZIP_LIMIT_BYTES = 4 * 1024 ** 3 - 64 * 1024 ** 2

/** Fold finished chunks into a Blob every so often, so the browser can move them out of memory. */
const FOLD_BYTES = 64 * 1024 ** 2

export class ZipTooLargeError extends Error {}

/**
 * Builds a ZIP file one entry at a time. Files are stored without compression
 * because PDF and PNG are already compressed, which keeps it fast.
 */
export class ZipBuilder {
  private readonly zip: Zip
  private parts: BlobPart[] = []
  private pending: Uint8Array[] = []
  private pendingBytes = 0
  private totalBytes = 0
  private failure: Error | null = null
  private readonly finished: Promise<void>

  constructor() {
    let resolve!: () => void
    let reject!: (err: Error) => void
    this.finished = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    this.zip = new Zip((err, chunk, final) => {
      if (err) {
        this.failure = err
        reject(err)
        return
      }
      this.pending.push(chunk)
      this.pendingBytes += chunk.length
      this.totalBytes += chunk.length
      if (this.pendingBytes >= FOLD_BYTES) this.fold()
      if (final) {
        this.fold()
        resolve()
      }
    })
  }

  private fold(): void {
    if (this.pending.length === 0) return
    this.parts = [new Blob([...this.parts, ...(this.pending as BlobPart[])])]
    this.pending = []
    this.pendingBytes = 0
  }

  /** Size written so far. */
  get size(): number {
    return this.totalBytes
  }

  add(fileName: string, data: Uint8Array): void {
    if (this.failure) throw this.failure
    if (this.totalBytes + data.length > ZIP_LIMIT_BYTES) {
      throw new ZipTooLargeError('The ZIP file would pass 4 GB. Export fewer names at a time.')
    }
    const entry = new ZipPassThrough(fileName)
    this.zip.add(entry)
    entry.push(data, true)
  }

  async finish(): Promise<Blob> {
    this.zip.end()
    await this.finished
    return new Blob(this.parts, { type: 'application/zip' })
  }

  /** Stop and free what was written. */
  abort(): void {
    this.zip.terminate()
    this.parts = []
    this.pending = []
  }
}
