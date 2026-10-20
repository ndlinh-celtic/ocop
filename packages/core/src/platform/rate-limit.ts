/** Attempts at a public endpoint, per bucket and hashed client address. */
export interface RateLimitRepo {
  record(bucket: string, subjectHash: string, at: Date): Promise<void>;
  countSince(bucket: string, subjectHash: string, since: Date): Promise<number>;
}

export interface RateLimit {
  max: number;
  windowMs: number;
}
