/** นับจำนวนครั้งต่อ key ในช่วงเวลาแบบเลื่อน */
export class RateLimiter {
  private hits = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** คืน true ถ้าอนุญาต และนับครั้งนี้เข้าไปด้วย */
  check(key: string, now: number): boolean {
    const cutoff = now - this.windowMs
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff)

    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }

    recent.push(now)
    this.hits.set(key, recent)
    return true
  }
}
