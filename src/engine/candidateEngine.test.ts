import { describe, expect, it } from "vitest";
import type { Entity, Question } from "../types/engine";
import {
  applyAnswer,
  createCandidateState,
  filterCandidates,
  getAvailableQuestions,
  getRemainingCandidates
} from "./candidateEngine";

const BATMAN: Entity = {
  id: "batman",
  name: "Batman",
  facts: { is_fictional: true, is_superhero: true, is_from_anime: false, is_male: true }
};

const TAYLOR_SWIFT: Entity = {
  id: "taylor_swift",
  name: "Taylor Swift",
  facts: { is_fictional: false, is_superhero: false, is_from_anime: false, is_male: false, is_musician: true }
};

const NARUTO: Entity = {
  id: "naruto",
  name: "Naruto",
  facts: { is_fictional: true, is_superhero: false, is_from_anime: true, is_male: true }
};

const ALL_ENTITIES: Entity[] = [BATMAN, TAYLOR_SWIFT, NARUTO];

const QUESTIONS: Question[] = [
  { id: "q_fictional", text: "Is fictional?", factKey: "is_fictional" },
  { id: "q_anime", text: "From anime?", factKey: "is_from_anime" },
  { id: "q_superhero", text: "Superhero?", factKey: "is_superhero" }
];

describe("createCandidateState", () => {
  it("starts with all entities and no answers", () => {
    const state = createCandidateState(ALL_ENTITIES);
    expect(state.candidates).toHaveLength(3);
    expect(state.askedQuestions).toHaveLength(0);
    expect(state.answers).toEqual({});
  });

  it("does not mutate the input array", () => {
    createCandidateState(ALL_ENTITIES);
    expect(ALL_ENTITIES).toHaveLength(3);
  });
});

describe("filterCandidates", () => {
  it("keeps entities that match all answers", () => {
    const result = filterCandidates(ALL_ENTITIES, { is_fictional: true });
    expect(result.map((e) => e.id)).toEqual(["batman", "naruto"]);
  });

  it("eliminates entities contradicting any answer", () => {
    const result = filterCandidates(ALL_ENTITIES, { is_fictional: true, is_from_anime: false });
    expect(result.map((e) => e.id)).toEqual(["batman"]);
  });

  it("keeps entities with no fact for the queried key (benefit of the doubt)", () => {
    const partial: Entity = { id: "mystery", name: "Mystery", facts: {} };
    const result = filterCandidates([partial], { is_fictional: true });
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no candidates match", () => {
    const result = filterCandidates(ALL_ENTITIES, { is_fictional: true, is_fictional_also: false });
    const contradicted = filterCandidates(ALL_ENTITIES, { is_fictional: true, is_from_anime: true, is_superhero: true });
    expect(contradicted).toHaveLength(0);
  });
});

describe("applyAnswer", () => {
  it("records the answer and filters candidates", () => {
    const state = createCandidateState(ALL_ENTITIES);
    const next = applyAnswer(state, "q_fictional", "is_fictional", true);
    expect(next.candidates).toHaveLength(2);
    expect(next.askedQuestions).toContain("q_fictional");
    expect(next.answers).toEqual({ is_fictional: true });
  });

  it("is immutable — original state is unchanged", () => {
    const state = createCandidateState(ALL_ENTITIES);
    applyAnswer(state, "q_fictional", "is_fictional", true);
    expect(state.candidates).toHaveLength(3);
    expect(state.answers).toEqual({});
  });

  it("chains multiple answers correctly", () => {
    const state = createCandidateState(ALL_ENTITIES);
    const s1 = applyAnswer(state, "q_fictional", "is_fictional", true);
    const s2 = applyAnswer(s1, "q_anime", "is_from_anime", false);
    expect(s2.candidates.map((e) => e.id)).toEqual(["batman"]);
    expect(s2.askedQuestions).toEqual(["q_fictional", "q_anime"]);
  });
});

describe("getRemainingCandidates", () => {
  it("mirrors state.candidates", () => {
    const state = createCandidateState(ALL_ENTITIES);
    expect(getRemainingCandidates(state)).toBe(state.candidates);
  });
});

describe("getAvailableQuestions", () => {
  it("returns all questions when none have been asked", () => {
    const state = createCandidateState(ALL_ENTITIES);
    expect(getAvailableQuestions(state, QUESTIONS)).toHaveLength(3);
  });

  it("excludes already-asked questions", () => {
    const state = createCandidateState(ALL_ENTITIES);
    const next = applyAnswer(state, "q_fictional", "is_fictional", true);
    const available = getAvailableQuestions(next, QUESTIONS);
    expect(available.map((q) => q.id)).not.toContain("q_fictional");
    expect(available).toHaveLength(2);
  });

  it("returns empty array when all questions have been asked", () => {
    let state = createCandidateState(ALL_ENTITIES);
    for (const q of QUESTIONS) {
      state = applyAnswer(state, q.id, q.factKey, true);
    }
    expect(getAvailableQuestions(state, QUESTIONS)).toHaveLength(0);
  });
});
