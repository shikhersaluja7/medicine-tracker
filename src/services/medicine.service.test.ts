// src/services/medicine.service.test.ts — Unit tests for medicine.service.ts
//
// What are unit tests?
// Unit tests check that individual functions work correctly in isolation.
// We don't run these on a phone — we run them in Node.js using mocked
// (fake) versions of phone APIs like expo-sqlite.
//
// How mocking works:
// expo-sqlite can't run in Node.js (it needs native phone code).
// So we replace it with a fake version that records what was called
// and returns values we control. The service functions don't know
// they're talking to a fake — they just call the same API.
//
// Run all tests:    npm run test
// Run this file:    npx vitest run src/services/medicine.service.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  archiveMedicine,
} from "./medicine.service";
import type { Medicine } from "@/db/schema";

// ─── Mock expo-sqlite ────────────────────────────────────────────────────────
// Replace the real expo-sqlite with a fake that does nothing by default.
// Each test will then configure the fake to return specific test data.
vi.mock("expo-sqlite", () => ({
  openDatabaseSync: vi.fn(() => mockDb),
}));

// A fake SQLiteDatabase object with mock functions.
// vi.fn() creates a function that records every call made to it.
const mockDb = {
  // runSync: used for INSERT, UPDATE, DELETE
  runSync: vi.fn(),
  // getAllSync: used for SELECT * queries returning multiple rows
  getAllSync: vi.fn(),
  // getFirstSync: used for SELECT queries returning one row
  getFirstSync: vi.fn(),
  // execSync: used for running raw SQL (migrations, PRAGMA)
  execSync: vi.fn(),
};

// A realistic fake medicine row — what the database would return after an INSERT
const fakeMedicine: Medicine = {
  id: "test-id-abc",
  user_id: "auth0|user123",
  name: "Lisinopril",
  dosage: "10mg",
  instructions: "Take with food",
  doctor: "Dr. Smith",
  is_active: 1,
  created_at: "2026-03-08T08:00:00.000Z",
  updated_at: "2026-03-08T08:00:00.000Z",
};

// ─── Test setup ──────────────────────────────────────────────────────────────
beforeEach(() => {
  // Reset all mocks before each test so tests don't interfere with each other.
  // Without this, a mock returning "Lisinopril" in test 1 would still return
  // it in test 2 even if test 2 expects "Aspirin".
  vi.clearAllMocks();
});

// ─── addMedicine ─────────────────────────────────────────────────────────────
describe("addMedicine", () => {
  it("inserts a row and returns the saved medicine", () => {
    // Arrange: make getFirstSync (the read-back after INSERT) return our fake medicine
    mockDb.getFirstSync.mockReturnValue(fakeMedicine);

    // Act: call the real service function with our fake db
    const result = addMedicine(mockDb as any, "auth0|user123", {
      name: "Lisinopril",
      dosage: "10mg",
      instructions: "Take with food",
      doctor: "Dr. Smith",
    });

    // Assert: the function should have called INSERT exactly once
    expect(mockDb.runSync).toHaveBeenCalledTimes(1);

    // The INSERT SQL should target the medicines table
    const insertSql = mockDb.runSync.mock.calls[0][0] as string;
    expect(insertSql).toContain("INSERT INTO medicines");

    // The returned value should match what getFirstSync returned
    expect(result.name).toBe("Lisinopril");
    expect(result.dosage).toBe("10mg");
    expect(result.user_id).toBe("auth0|user123");
  });

  it("throws if the row cannot be read back after insert", () => {
    // Arrange: simulate a situation where getFirstSync returns null
    // (shouldn't happen in practice, but we guard against it)
    mockDb.getFirstSync.mockReturnValue(null);

    // Assert: the function should throw an error
    expect(() =>
      addMedicine(mockDb as any, "auth0|user123", {
        name: "Aspirin",
        dosage: "100mg",
      })
    ).toThrow("Failed to retrieve medicine after insert");
  });

  it("converts undefined instructions to null for SQLite storage", () => {
    mockDb.getFirstSync.mockReturnValue({ ...fakeMedicine, instructions: null });

    addMedicine(mockDb as any, "auth0|user123", {
      name: "Aspirin",
      dosage: "100mg",
      // instructions intentionally omitted
    });

    // The 5th argument to runSync (index 4) should be null, not undefined
    // because SQLite doesn't understand JavaScript's undefined
    const insertArgs = mockDb.runSync.mock.calls[0];
    expect(insertArgs[5]).toBeNull(); // instructions argument
    expect(insertArgs[6]).toBeNull(); // doctor argument
  });
});

// ─── getMedicines ─────────────────────────────────────────────────────────────
describe("getMedicines", () => {
  it("returns all active medicines for the user", () => {
    // Arrange: simulate the database returning two medicines
    const medicines: Medicine[] = [
      { ...fakeMedicine, id: "id-1", name: "Aspirin" },
      { ...fakeMedicine, id: "id-2", name: "Lisinopril" },
    ];
    mockDb.getAllSync.mockReturnValue(medicines);

    // Act
    const result = getMedicines(mockDb as any, "auth0|user123");

    // Assert: should return both medicines
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Aspirin");
    expect(result[1].name).toBe("Lisinopril");
  });

  it("queries with the correct userId to prevent data leakage", () => {
    mockDb.getAllSync.mockReturnValue([]);

    getMedicines(mockDb as any, "auth0|user123");

    // The SQL and args should include user_id filtering
    const [sql, userId] = mockDb.getAllSync.mock.calls[0];
    expect(sql).toContain("user_id = ?");
    expect(userId).toBe("auth0|user123");
  });

  it("only returns active medicines (is_active = 1)", () => {
    mockDb.getAllSync.mockReturnValue([]);

    getMedicines(mockDb as any, "auth0|user123");

    const [sql] = mockDb.getAllSync.mock.calls[0];
    // The query must filter by is_active = 1 to exclude archived medicines
    expect(sql).toContain("is_active = 1");
  });

  it("returns an empty array when user has no medicines", () => {
    mockDb.getAllSync.mockReturnValue([]);
    const result = getMedicines(mockDb as any, "auth0|user123");
    expect(result).toEqual([]);
  });
});

// ─── getMedicineById ──────────────────────────────────────────────────────────
describe("getMedicineById", () => {
  it("returns the medicine when found", () => {
    mockDb.getFirstSync.mockReturnValue(fakeMedicine);

    const result = getMedicineById(mockDb as any, "test-id-abc", "auth0|user123");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("test-id-abc");
  });

  it("returns null when medicine does not exist", () => {
    // Simulate no matching row in the database
    mockDb.getFirstSync.mockReturnValue(null);

    const result = getMedicineById(mockDb as any, "nonexistent-id", "auth0|user123");

    expect(result).toBeNull();
  });

  it("scopes query to userId so users cannot access each other's data", () => {
    mockDb.getFirstSync.mockReturnValue(null);

    getMedicineById(mockDb as any, "some-id", "auth0|user456");

    const [sql, id, userId] = mockDb.getFirstSync.mock.calls[0];
    expect(sql).toContain("user_id = ?");
    expect(id).toBe("some-id");
    expect(userId).toBe("auth0|user456");
  });
});

// ─── updateMedicine ───────────────────────────────────────────────────────────
describe("updateMedicine", () => {
  it("updates the specified fields", () => {
    updateMedicine(mockDb as any, "test-id-abc", "auth0|user123", {
      dosage: "20mg",
    });

    expect(mockDb.runSync).toHaveBeenCalledTimes(1);
    const [sql] = mockDb.runSync.mock.calls[0];
    expect(sql).toContain("UPDATE medicines SET");
    expect(sql).toContain("dosage = ?");
    expect(sql).toContain("updated_at = ?");
  });

  it("does nothing when no fields are provided", () => {
    // Calling with an empty updates object should not run any SQL
    updateMedicine(mockDb as any, "test-id-abc", "auth0|user123", {});
    expect(mockDb.runSync).not.toHaveBeenCalled();
  });

  it("always updates the updated_at timestamp", () => {
    updateMedicine(mockDb as any, "test-id-abc", "auth0|user123", {
      name: "New Name",
    });

    const [sql] = mockDb.runSync.mock.calls[0];
    expect(sql).toContain("updated_at = ?");
  });
});

// ─── archiveMedicine ─────────────────────────────────────────────────────────
describe("archiveMedicine", () => {
  it("sets is_active to 0 (soft delete)", () => {
    archiveMedicine(mockDb as any, "test-id-abc", "auth0|user123");

    expect(mockDb.runSync).toHaveBeenCalledTimes(1);
    const [sql] = mockDb.runSync.mock.calls[0];
    expect(sql).toContain("is_active = 0");
  });

  it("scopes the archive to the correct user", () => {
    archiveMedicine(mockDb as any, "test-id-abc", "auth0|user123");

    const args = mockDb.runSync.mock.calls[0];
    // The last two args should be the id and userId for the WHERE clause
    expect(args[args.length - 2]).toBe("test-id-abc");
    expect(args[args.length - 1]).toBe("auth0|user123");
  });
});
