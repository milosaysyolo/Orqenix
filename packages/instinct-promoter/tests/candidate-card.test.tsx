// SPDX-License-Identifier: Apache-2.0
// Component contract test for CandidateCard
import { afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CandidateCard } from "../src/ui/candidate-card";
import type { PromoterCandidate } from "../src/types";

afterEach(cleanup);
const mockCandidate: PromoterCandidate = {
  id: "c1",
  patternName: "@local/test-then-commit",
  patternDescription: "Test then commit",
  occurrenceCount: 6,
  successRate: 1.0,
  impactScore: 8.5,
  estTimeSavedPerWeekMin: 15,
  crossScope: false,
  crossScopeSources: [],
  samples: [],
  status: "detected",
};
describe("CandidateCard", () => {
  it("renders pattern name and impact score", () => {
    render(<CandidateCard candidate={mockCandidate} onReview={() => {}} />);
    expect(screen.getByText("@local/test-then-commit")).toBeDefined();
    expect(screen.getByText(/Impact 8.5/)).toBeDefined();
  });
  it("renders all four action buttons", () => {
    render(<CandidateCard candidate={mockCandidate} onReview={() => {}} />);
    expect(screen.getByText("Promote")).toBeDefined();
    expect(screen.getByText("Customize First")).toBeDefined();
    expect(screen.getByText("Defer")).toBeDefined();
    expect(screen.getByText("Reject")).toBeDefined();
  });
  it("disables buttons when busy", () => {
    render(<CandidateCard candidate={mockCandidate} onReview={() => {}} busy />);
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
