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

    // key ที่ไม่เคยถูกเรียกซ้ำจะไม่มีใครไปล้างให้ ต้องกวาดตอนรับ key ใหม่
    // ไม่งั้น Map โตขึ้นหนึ่งช่องต่อหนึ่ง IP ตลอดอายุโปรเซส
    if (!this.hits.has(key)) this.evictExpired(cutoff)

    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff)
    const allowed = recent.length < this.limit
    if (allowed) recent.push(now)

    if (recent.length === 0) this.hits.delete(key)
    else this.hits.set(key, recent)

    return allowed
  }

  private evictExpired(cutoff: number): void {
    for (const [k, times] of this.hits) {
      if (times.every((t) => t <= cutoff)) this.hits.delete(k)
    }
  }
}
