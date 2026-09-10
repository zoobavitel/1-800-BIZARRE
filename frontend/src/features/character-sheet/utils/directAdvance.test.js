import {
  actionDotBatchBlockedReason,
  actionDotStepsToTarget,
  canAffordActionDotSteps,
  canDirectStandUpgrade,
  canFundTrackAdvance,
  isAttributeActionTrackComplete,
  mergedActionRating,
  marksNeededToMintPending,
  poolMarksNeededToMint,
  standCoinChargenHasFreeRoom,
} from "./directAdvance";

describe("directAdvance", () => {
  test("marksNeededToMintPending for playbook at 7/10", () => {
    expect(marksNeededToMintPending("playbook", { playbook: 7 })).toBe(3);
  });

  test("open pending needs no pool marks", () => {
    expect(
      poolMarksNeededToMint({
        track: "playbook",
        xpMarks: { playbook: 0 },
        unallocatedXp: 0,
        pendingAdvanceCounts: { playbook: 1 },
      }),
    ).toBe(0);
  });

  test("pool funds gap to mint", () => {
    expect(
      poolMarksNeededToMint({
        track: "insight",
        xpMarks: { insight: 2 },
        unallocatedXp: 10,
        pendingAdvanceCounts: {},
      }),
    ).toBe(3);
  });

  test("cannot fund when pool too small", () => {
    expect(
      poolMarksNeededToMint({
        track: "playbook",
        xpMarks: { playbook: 0 },
        unallocatedXp: 5,
        pendingAdvanceCounts: {},
      }),
    ).toBe(null);
  });

  test("canFundTrackAdvance with legacy full marks", () => {
    expect(
      canFundTrackAdvance({
        track: "playbook",
        xpMarks: { playbook: 10 },
        unallocatedXp: 0,
        pendingAdvanceCounts: {},
      }),
    ).toBe(true);
  });

  test("standCoinChargenHasFreeRoom until creation budget full", () => {
    expect(
      standCoinChargenHasFreeRoom({
        standCoinPointsGained: 0,
        totalStandPoints: 5,
        creationBudget: 6,
      }),
    ).toBe(true);
    expect(
      standCoinChargenHasFreeRoom({
        standCoinPointsGained: 0,
        totalStandPoints: 6,
        creationBudget: 6,
      }),
    ).toBe(false);
    expect(
      standCoinChargenHasFreeRoom({
        standCoinPointsGained: 1,
        totalStandPoints: 5,
        creationBudget: 6,
      }),
    ).toBe(false);
  });

  test("canDirectStandUpgrade when pool can fill playbook (no prior allocations)", () => {
    expect(
      canDirectStandUpgrade({
        stat: "speed",
        standGradeIndex: 1,
        maxStandGradeIndex: 4,
        canEditSheet: true,
        hasStandPlaybook: true,
        xpMarks: { playbook: 0 },
        unallocatedXp: 100,
        pendingAdvanceCounts: {},
      }),
    ).toBe(true);
  });

  test("canDirectStandUpgrade with full playbook marks and available pool", () => {
    expect(
      canDirectStandUpgrade({
        stat: "speed",
        standGradeIndex: 0,
        maxStandGradeIndex: 4,
        canEditSheet: true,
        hasStandPlaybook: true,
        xpMarks: { playbook: 100 },
        unallocatedXp: 100,
        pendingAdvanceCounts: {},
      }),
    ).toBe(true);
  });

  test("canDirectStandUpgrade false when locked or unfunded", () => {
    expect(
      canDirectStandUpgrade({
        stat: "speed",
        standGradeIndex: 1,
        maxStandGradeIndex: 4,
        canEditSheet: true,
        hasStandPlaybook: true,
        xpMarks: { playbook: 0 },
        unallocatedXp: 5,
        pendingAdvanceCounts: {},
      }),
    ).toBe(false);
  });

  test("mergedActionRating prefers server when local stale", () => {
    expect(
      mergedActionRating("FINESSE", { FINESSE: 0 }, { FINESSE: 2 }),
    ).toBe(2);
  });

  test("actionDotBatchBlockedReason when queued through target", () => {
    expect(
      actionDotBatchBlockedReason({
        action: "FINESSE",
        targetDot: 4,
        actionRating: 0,
        plannedExtra: 4,
      }),
    ).toMatch(/4 queued/i);
  });

  test("actionDotStepsToTarget from 1 to dot 4", () => {
    expect(
      actionDotStepsToTarget({
        actionRating: 1,
        plannedExtra: 0,
        targetDot: 4,
      }),
    ).toBe(3);
  });

  test("actionDotStepsToTarget respects planned dots", () => {
    expect(
      actionDotStepsToTarget({
        actionRating: 1,
        plannedExtra: 1,
        targetDot: 4,
      }),
    ).toBe(2);
  });

  test("canAffordActionDotSteps for three prowess fills from pool", () => {
    expect(
      canAffordActionDotSteps({
        steps: 3,
        track: "prowess",
        xpMarks: { prowess: 0 },
        unallocatedXp: 15,
        pendingAdvanceCounts: {},
      }),
    ).toBe(true);
  });

  test("isAttributeActionTrackComplete when all four actions at 4", () => {
    expect(
      isAttributeActionTrackComplete(
        { HUNT: 4, STUDY: 4, SURVEY: 4, TINKER: 4 },
        "insight",
      ),
    ).toBe(true);
    expect(
      isAttributeActionTrackComplete(
        { HUNT: 4, STUDY: 4, SURVEY: 3, TINKER: 4 },
        "insight",
      ),
    ).toBe(false);
  });

  test("canAffordActionDotSteps false when pool short for batch", () => {
    expect(
      canAffordActionDotSteps({
        steps: 3,
        track: "prowess",
        xpMarks: { prowess: 0 },
        unallocatedXp: 10,
        pendingAdvanceCounts: {},
      }),
    ).toBe(false);
  });
});
