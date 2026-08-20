import { describe, it, expect } from "vitest";
import {
  backupStatus,
  formatSize,
  formatDate,
  formatTime,
  formatTimestamp,
} from "./backupFormat";

describe("backupStatus", () => {
  it("is صالحة (ok) when verified and backend reports ok", () => {
    const s = backupStatus({ status: "ok", verified: true });
    expect(s.kind).toBe("ok");
    expect(s.label).toBe("صالحة");
    expect(s.tone).toBe("emerald");
  });

  it("is غير صالحة (invalid) when backend reports a non-ok status", () => {
    const s = backupStatus({ status: "error", verified: false });
    expect(s.kind).toBe("invalid");
    expect(s.tone).toBe("rose");
  });

  it("is تحتاج تحقق (pending) for legacy files without a sidecar", () => {
    const s = backupStatus({ status: null, verified: false });
    expect(s.kind).toBe("pending");
    expect(s.tone).toBe("amber");
  });

  it("never treats unverified as ok even when status says ok", () => {
    const s = backupStatus({ status: "ok", verified: false });
    expect(s.kind).not.toBe("ok");
  });
});

describe("formatSize", () => {
  it("renders B / KB / MB buckets in latin digits", () => {
    expect(formatSize(0)).toBe("—");
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2.0 KB");
    expect(formatSize(5 * 1024 * 1024)).toBe("5.00 MB");
  });
});

describe("formatDate / formatTime", () => {
  it("splits a unix timestamp into date and time parts", () => {
    const ts = new Date(2026, 7, 20, 9, 5).getTime() / 1000;
    const date = formatDate(ts);
    const time = formatTime(ts);
    expect(date.split("/")).toHaveLength(3);
    expect(time).toMatch(/^\d{2}:\d{2}$/);
    expect(formatTimestamp(0)).toBe("—");
  });
});