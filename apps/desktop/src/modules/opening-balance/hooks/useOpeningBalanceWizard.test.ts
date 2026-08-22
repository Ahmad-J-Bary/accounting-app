import { describe, it, expect } from "vitest";
import { updateStepOrder, STEP_REVIEW, STEPS_EXISTING } from "./useOpeningBalanceWizard";

describe("updateStepOrder (Dynamic Step Ordering Logic)", () => {
  const dataEntryEnd = Math.min(STEP_REVIEW, STEPS_EXISTING.length); // 7

  it("returns natural initial order when only default step 0 is completed", () => {
    const initialOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const completedSteps = new Set([0]);
    const nextOrder = updateStepOrder(initialOrder, completedSteps, dataEntryEnd);
    expect(nextOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("moves an out-of-order completed step (Step 2) right after the last completed step (Step 0)", () => {
    // Scenario: User completes Step 0 ("بدء الحسابات"), then completes Step 2 ("الذمم المدينة") out of order.
    // Step 1 ("النقد والبنوك") is NOT completed.
    const initialOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const completedSteps = new Set([0, 2]);

    const nextOrder = updateStepOrder(initialOrder, completedSteps, dataEntryEnd);

    // Step 2 moves to index 1 (after step 0), pushing Step 1 to index 2.
    expect(nextOrder).toEqual([0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("keeps a step in place when all preceding steps in the CURRENT dynamic order are completed (User Problem Scenario)", () => {
    // Scenario:
    // 1. Step 0 ("بدء الحسابات") completed.
    // 2. Step 2 ("الذمم المدينة") completed out of order -> order became [0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10].
    // 3. Now Step 1 ("النقد والبنوك") is completed.
    // In current dynamic order [0, 2, 1, ...], preceding steps to Step 1 are 0 and 2.
    // BOTH 0 and 2 are completed!
    // Therefore, Step 1 MUST stay at position 2 and NOT jump back before Step 2!

    const currentOrder = [0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10];
    const completedSteps = new Set([0, 2, 1]);

    const nextOrder = updateStepOrder(currentOrder, completedSteps, dataEntryEnd);

    // Order MUST remain [0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(nextOrder).toEqual([0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("moves another out-of-order completed step (Step 5) right after the last completed step", () => {
    // Current order: [0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10]
    // Completed: {0, 2, 1}. Now user completes Step 5 ("الموردون والالتزامات").
    // Preceding steps in order: 0 (yes), 2 (yes), 1 (yes), 3 (no), 4 (no).
    // Last completed step before index 5 is Step 1 at index 2.
    // Target position for Step 5 = 2 + 1 = 3.

    const currentOrder = [0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10];
    const completedSteps = new Set([0, 2, 1, 5]);

    const nextOrder = updateStepOrder(currentOrder, completedSteps, dataEntryEnd);

    expect(nextOrder).toEqual([0, 2, 1, 5, 3, 4, 6, 7, 8, 9, 10]);
  });

  it("does not reset the order to initial sequence when all data entry steps are completed", () => {
    // Current order: [0, 2, 1, 5, 3, 4, 6, 7, 8, 9, 10]
    // Completed: {0, 2, 1, 5, 3, 4, 6} (ALL data entry steps completed)
    const currentOrder = [0, 2, 1, 5, 3, 4, 6, 7, 8, 9, 10];
    const completedSteps = new Set([0, 1, 2, 3, 4, 5, 6]);

    const nextOrder = updateStepOrder(currentOrder, completedSteps, dataEntryEnd);

    // Order must preserve the dynamic sequence [0, 2, 1, 5, 3, 4, 6, 7, 8, 9, 10]
    expect(nextOrder).toEqual([0, 2, 1, 5, 3, 4, 6, 7, 8, 9, 10]);
  });

  it("never alters fixed steps (review, action, first-period, done)", () => {
    const currentOrder = [0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10];
    const completedSteps = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const nextOrder = updateStepOrder(currentOrder, completedSteps, dataEntryEnd);

    expect(nextOrder.slice(dataEntryEnd)).toEqual([7, 8, 9, 10]);
  });
});
