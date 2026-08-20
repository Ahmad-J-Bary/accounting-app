import { describe, it, expect } from "vitest";
import { friendlyBackupError } from "./backupErrors";

describe("friendlyBackupError", () => {
  it("maps integrity failures to a friendly Arabic message and keeps raw detail", () => {
    const err = friendlyBackupError("Database integrity check failed: table account_entries failed");
    expect(err.friendly).toBe("فشل فحص سلامة قاعدة البيانات");
    expect(err.detail).toBe("Database integrity check failed: table account_entries failed");
  });

  it("maps unreadable/not-a-database files", () => {
    const err = friendlyBackupError("Backup is not a readable SQLite database");
    expect(err.friendly).toBe("الملف ليس قاعدة بيانات سليمة");
  });

  it("maps snapshot creation failures", () => {
    const err = friendlyBackupError("Failed to create snapshot: Database(SomeErr)");
    expect(err.friendly).toBe("تعذر إنشاء النسخة");
  });

  it("maps lock and busy conditions", () => {
    const err = friendlyBackupError("Error: database is locked");
    expect(err.friendly).toContain("قاعدة البيانات مشغولة");
  });

  it("maps constraint and FK violations", () => {
    expect(friendlyBackupError("UNIQUE constraint failed: id").friendly).toContain("تعارض في البيانات");
    expect(friendlyBackupError("FOREIGN KEY constraint failed").friendly).toContain("علاقات البيانات");
  });

  it("maps permission and disk-space failures", () => {
    expect(friendlyBackupError("permission denied (os error 13)").friendly).toContain("صلاحية");
    expect(friendlyBackupError("no space left on device").friendly).toContain("التخزين غير كافية");
  });

  it("extracts the message from Error objects", () => {
    const err = friendlyBackupError(new Error("UNIQUE constraint failed: id"));
    expect(err.friendly).not.toBe("UNIQUE constraint failed: id");
  });

  it("passes already-Arabic messages through without a detail pane", () => {
    const message = "فشل التحقق من قيد التوازن في ميزان المراجعة";
    const err = friendlyBackupError(message);
    expect(err.friendly).toBe(message);
    expect(err.detail).toBeNull();
  });

  it("falls back to a generic message while keeping unknown raw text as detail", () => {
    const err = friendlyBackupError("WeirdEngineCode 0xDEAD");
    expect(err.friendly).toBe("حدث خطأ أثناء العملية — راجع التفاصيل");
    expect(err.detail).toBe("WeirdEngineCode 0xDEAD");
  });

  it("handles empty input without a detail pane", () => {
    const err = friendlyBackupError("");
    expect(err.friendly).toBe("حدث خطأ أثناء العملية — راجع التفاصيل");
    expect(err.detail).toBeNull();
  });
});