import { describe, it, expect } from "vitest";
import { calculateJob } from "../src/financial/calculateJob";
import type { FinancialModel, JobInput } from "../src/types/financial";

// Default Three Buckets model: 10% business, 10% owner, 80% worker pool
const DEFAULT_MODEL: FinancialModel = {
  buckets: [
    { name: "Business Expenses", percent: 10, type: "business" },
    { name: "Owner Profit", percent: 10, type: "owner" },
    { name: "Worker Pool", percent: 80, type: "worker_pool" },
  ],
};

describe("calculateJob", () => {
  // ================================================================
  // Scenario 1: Standard job, solo Alex
  // ================================================================
  it("Scenario 1: Standard job, solo Alex", () => {
    const input: JobInput = {
      totalFee: 200,
      houseCutPercent: 20,
      charges: [],
      assignments: [
        { userId: "alex", userName: "Alex", share: 1.0, isOwner: true },
      ],
    };

    const result = calculateJob(DEFAULT_MODEL, input);

    expect(result.grossRevenue).toBe(200);
    expect(result.houseCutAmount).toBe(40);
    expect(result.netRevenue).toBe(160);

    expect(result.businessExpenseAmount).toBe(16);
    expect(result.ownerProfitAmount).toBe(16);
    expect(result.workerPoolAmount).toBe(128);

    expect(result.totalShares).toBe(1.0);
    expect(result.perShareRate).toBe(128);

    expect(result.workerPayments).toHaveLength(1);
    expect(result.workerPayments[0].workerPoolPay).toBe(128);
    expect(result.workerPayments[0].ownerPay).toBe(16);
    expect(result.workerPayments[0].totalPay).toBe(144);
  });

  // ================================================================
  // Scenario 2: Two workers, equal shares
  // ================================================================
  it("Scenario 2: Two workers, equal shares", () => {
    const input: JobInput = {
      totalFee: 200,
      houseCutPercent: 20,
      charges: [],
      assignments: [
        { userId: "alex", userName: "Alex", share: 1.0, isOwner: true },
        { userId: "workerB", userName: "Worker B", share: 1.0, isOwner: false },
      ],
    };

    const result = calculateJob(DEFAULT_MODEL, input);

    expect(result.netRevenue).toBe(160);
    expect(result.businessExpenseAmount).toBe(16);
    expect(result.ownerProfitAmount).toBe(16);
    expect(result.workerPoolAmount).toBe(128);
    expect(result.totalShares).toBe(2.0);
    expect(result.perShareRate).toBe(64);

    const alex = result.workerPayments.find((w) => w.userId === "alex")!;
    expect(alex.workerPoolPay).toBe(64);
    expect(alex.ownerPay).toBe(16);
    expect(alex.totalPay).toBe(80);

    const workerB = result.workerPayments.find((w) => w.userId === "workerB")!;
    expect(workerB.workerPoolPay).toBe(64);
    expect(workerB.ownerPay).toBe(0);
    expect(workerB.totalPay).toBe(64);
  });

  // ================================================================
  // Scenario 3: Three workers, mixed shares (rounding test)
  // ================================================================
  it("Scenario 3: Three workers, mixed shares with rounding remainder", () => {
    const input: JobInput = {
      totalFee: 300,
      houseCutPercent: 0,
      charges: [],
      assignments: [
        { userId: "alex", userName: "Alex", share: 1.0, isOwner: true },
        { userId: "workerB", userName: "Worker B", share: 1.0, isOwner: false },
        {
          userId: "workerC",
          userName: "Worker C",
          share: 0.75,
          isOwner: false,
        },
      ],
    };

    const result = calculateJob(DEFAULT_MODEL, input);

    expect(result.netRevenue).toBe(300);
    expect(result.businessExpenseAmount).toBe(30);
    expect(result.ownerProfitAmount).toBe(30);
    expect(result.workerPoolAmount).toBe(240);
    expect(result.totalShares).toBe(2.75);

    // perShareRate = 240 / 2.75 = 87.272727... → banker's rounds to 87.27
    expect(result.perShareRate).toBe(87.27);

    const alex = result.workerPayments.find((w) => w.userId === "alex")!;
    const workerB = result.workerPayments.find((w) => w.userId === "workerB")!;
    const workerC = result.workerPayments.find((w) => w.userId === "workerC")!;

    // Worker C: 0.75 * 87.27 = 65.4525 → 65.45
    expect(workerC.workerPoolPay).toBe(65.45);

    // Sum of rounded worker pool payments before remainder:
    // 87.27 + 87.27 + 65.45 = 239.99
    // Remainder: 240 - 239.99 = 0.01, applied to Alex (owner)
    expect(alex.workerPoolPay).toBe(87.28); // 87.27 + 0.01 remainder
    expect(workerB.workerPoolPay).toBe(87.27);

    // Alex gets owner pay too
    expect(alex.ownerPay).toBe(30);
    expect(alex.totalPay).toBe(117.28); // 87.28 + 30

    // Verify no penny dropped: all worker pool payments sum to pool amount
    const poolSum =
      alex.workerPoolPay + workerB.workerPoolPay + workerC.workerPoolPay;
    expect(poolSum).toBe(240);
  });

  // ================================================================
  // Scenario 4: Job with extra charges
  // ================================================================
  it("Scenario 4: Job with extra charges", () => {
    const input: JobInput = {
      totalFee: 175,
      houseCutPercent: 15,
      charges: [{ amount: 60 }, { amount: 25 }],
      assignments: [
        { userId: "alex", userName: "Alex", share: 1.0, isOwner: true },
      ],
    };

    const result = calculateJob(DEFAULT_MODEL, input);

    expect(result.chargesTotal).toBe(85);
    expect(result.grossRevenue).toBe(260);
    expect(result.houseCutAmount).toBe(39); // 260 * 0.15 = 39
    expect(result.netRevenue).toBe(221); // 260 - 39

    expect(result.businessExpenseAmount).toBe(22.1); // 221 * 0.10
    expect(result.ownerProfitAmount).toBe(22.1); // 221 * 0.10
    expect(result.workerPoolAmount).toBe(176.8); // 221 * 0.80

    const alex = result.workerPayments[0];
    expect(alex.workerPoolPay).toBe(176.8);
    expect(alex.ownerPay).toBe(22.1);
    expect(alex.totalPay).toBe(198.9);
  });

  // ================================================================
  // Scenario 5: No crew assigned yet
  // ================================================================
  it("Scenario 5: No crew assigned yet", () => {
    const input: JobInput = {
      totalFee: 200,
      houseCutPercent: 20,
      charges: [],
      assignments: [],
    };

    const result = calculateJob(DEFAULT_MODEL, input);

    expect(result.grossRevenue).toBe(200);
    expect(result.houseCutAmount).toBe(40);
    expect(result.netRevenue).toBe(160);
    expect(result.workerPoolAmount).toBe(128);
    expect(result.workerPayments).toHaveLength(0);
    expect(result.totalShares).toBe(0);
    expect(result.perShareRate).toBe(0);
  });

  // ================================================================
  // Scenario 6: All shares Off
  // ================================================================
  it("Scenario 6: All shares Off — owner still gets owner bucket", () => {
    const input: JobInput = {
      totalFee: 200,
      houseCutPercent: 20,
      charges: [],
      assignments: [
        { userId: "alex", userName: "Alex", share: 0, isOwner: true },
        { userId: "workerB", userName: "Worker B", share: 0, isOwner: false },
      ],
    };

    const result = calculateJob(DEFAULT_MODEL, input);

    expect(result.totalShares).toBe(0);
    expect(result.perShareRate).toBe(0);

    const alex = result.workerPayments.find((w) => w.userId === "alex")!;
    expect(alex.workerPoolPay).toBe(0);
    expect(alex.ownerPay).toBe(16); // Still gets owner bucket
    expect(alex.totalPay).toBe(16);

    const workerB = result.workerPayments.find((w) => w.userId === "workerB")!;
    expect(workerB.workerPoolPay).toBe(0);
    expect(workerB.ownerPay).toBe(0);
    expect(workerB.totalPay).toBe(0);
  });

  // ================================================================
  // Scenario 7: Zero-fee job (owner-stay inspection)
  // ================================================================
  it("Scenario 7: Zero-fee job — everything is 0, no errors", () => {
    const input: JobInput = {
      totalFee: 0,
      houseCutPercent: 0,
      charges: [],
      assignments: [
        { userId: "alex", userName: "Alex", share: 1.0, isOwner: true },
      ],
    };

    const result = calculateJob(DEFAULT_MODEL, input);

    expect(result.grossRevenue).toBe(0);
    expect(result.houseCutAmount).toBe(0);
    expect(result.netRevenue).toBe(0);
    expect(result.businessExpenseAmount).toBe(0);
    expect(result.ownerProfitAmount).toBe(0);
    expect(result.workerPoolAmount).toBe(0);
    expect(result.workerPayments[0].totalPay).toBe(0);
  });

  // ================================================================
  // Scenario 8: Changed financial model (15/5/80)
  // ================================================================
  it("Scenario 8: Changed financial model (15/5/80)", () => {
    const altModel: FinancialModel = {
      buckets: [
        { name: "Business Expenses", percent: 15, type: "business" },
        { name: "Owner Profit", percent: 5, type: "owner" },
        { name: "Worker Pool", percent: 80, type: "worker_pool" },
      ],
    };

    const input: JobInput = {
      totalFee: 200,
      houseCutPercent: 20,
      charges: [],
      assignments: [
        { userId: "alex", userName: "Alex", share: 1.0, isOwner: true },
      ],
    };

    const result = calculateJob(altModel, input);

    expect(result.netRevenue).toBe(160);
    expect(result.businessExpenseAmount).toBe(24); // 160 * 0.15
    expect(result.ownerProfitAmount).toBe(8); // 160 * 0.05
    expect(result.workerPoolAmount).toBe(128); // 160 * 0.80

    const alex = result.workerPayments[0];
    expect(alex.workerPoolPay).toBe(128);
    expect(alex.ownerPay).toBe(8);
    expect(alex.totalPay).toBe(136);
  });

  // ================================================================
  // Additional edge cases
  // ================================================================
  describe("validation and edge cases", () => {
    it("throws on invalid financial model (buckets dont sum to 100)", () => {
      const badModel: FinancialModel = {
        buckets: [
          { name: "A", percent: 50, type: "business" },
          { name: "B", percent: 40, type: "worker_pool" },
        ],
      };

      const input: JobInput = {
        totalFee: 100,
        houseCutPercent: 0,
        charges: [],
        assignments: [],
      };

      expect(() => calculateJob(badModel, input)).toThrow(
        "bucket percentages sum to 90"
      );
    });

    it("throws on empty buckets array", () => {
      const emptyModel: FinancialModel = { buckets: [] };
      const input: JobInput = {
        totalFee: 100,
        houseCutPercent: 0,
        charges: [],
        assignments: [],
      };

      expect(() => calculateJob(emptyModel, input)).toThrow(
        "must have at least one bucket"
      );
    });

    it("handles custom share values (0.33)", () => {
      const input: JobInput = {
        totalFee: 300,
        houseCutPercent: 0,
        charges: [],
        assignments: [
          { userId: "a", userName: "A", share: 0.33, isOwner: false },
          { userId: "b", userName: "B", share: 0.33, isOwner: false },
          { userId: "c", userName: "C", share: 0.34, isOwner: false },
        ],
      };

      const result = calculateJob(DEFAULT_MODEL, input);

      // All pool payments should sum to pool amount (no penny lost)
      const poolSum = result.workerPayments.reduce(
        (sum, w) => sum + w.workerPoolPay,
        0
      );
      expect(poolSum).toBe(result.workerPoolAmount);
    });

    it("is a pure function — same input produces same output", () => {
      const input: JobInput = {
        totalFee: 200,
        houseCutPercent: 20,
        charges: [{ amount: 50 }],
        assignments: [
          { userId: "alex", userName: "Alex", share: 1.0, isOwner: true },
          { userId: "b", userName: "B", share: 0.75, isOwner: false },
        ],
      };

      const result1 = calculateJob(DEFAULT_MODEL, input);
      const result2 = calculateJob(DEFAULT_MODEL, input);

      expect(result1).toEqual(result2);
    });

    it("handles 100% house cut (net revenue is zero)", () => {
      const input: JobInput = {
        totalFee: 200,
        houseCutPercent: 100,
        charges: [],
        assignments: [
          { userId: "alex", userName: "Alex", share: 1.0, isOwner: true },
        ],
      };

      const result = calculateJob(DEFAULT_MODEL, input);

      expect(result.houseCutAmount).toBe(200);
      expect(result.netRevenue).toBe(0);
      expect(result.workerPoolAmount).toBe(0);
      expect(result.workerPayments[0].totalPay).toBe(0);
    });

    it("handles multiple owners splitting the owner bucket", () => {
      const input: JobInput = {
        totalFee: 200,
        houseCutPercent: 0,
        charges: [],
        assignments: [
          { userId: "owner1", userName: "Owner 1", share: 1.0, isOwner: true },
          { userId: "owner2", userName: "Owner 2", share: 1.0, isOwner: true },
        ],
      };

      const result = calculateJob(DEFAULT_MODEL, input);

      // Owner bucket: 200 * 10% = 20, split between 2 owners = 10 each
      const owner1 = result.workerPayments.find((w) => w.userId === "owner1")!;
      const owner2 = result.workerPayments.find((w) => w.userId === "owner2")!;

      expect(owner1.ownerPay).toBe(10);
      expect(owner2.ownerPay).toBe(10);
    });
  });
});
