import type { Clock } from "../../ports/clock/clock.js";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
