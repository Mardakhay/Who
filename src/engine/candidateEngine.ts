import type { CandidateState, Entity, Question } from "../types/engine";

export const createCandidateState = (allEntities: Entity[]): CandidateState => ({
  candidates: [...allEntities],
  askedQuestions: [],
  answers: {}
});

/**
 * Returns entities that are still consistent with all recorded answers.
 * An entity is eliminated if any of its known facts contradicts a recorded answer.
 * Entities that lack a fact key are kept (benefit of the doubt).
 */
export const filterCandidates = (entities: Entity[], answers: Record<string, boolean>): Entity[] => {
  return entities.filter((entity) => {
    for (const [factKey, expected] of Object.entries(answers)) {
      const actual = entity.facts[factKey];
      if (actual !== undefined && actual !== expected) return false;
    }
    return true;
  });
};

/**
 * Records an answer and returns a new CandidateState with the candidate list
 * filtered to only those still consistent with all answers so far.
 */
export const applyAnswer = (
  state: CandidateState,
  questionId: string,
  factKey: string,
  answer: boolean
): CandidateState => {
  const updatedAnswers = { ...state.answers, [factKey]: answer };
  return {
    candidates: filterCandidates(state.candidates, updatedAnswers),
    askedQuestions: [...state.askedQuestions, questionId],
    answers: updatedAnswers
  };
};

/**
 * Returns the current list of remaining candidates after all answers applied.
 */
export const getRemainingCandidates = (state: CandidateState): Entity[] => state.candidates;

/**
 * Returns unanswered questions sorted by how evenly they split remaining candidates.
 * Questions closer to a 50/50 split appear first, maximising information gained per question.
 */
export const getAvailableQuestions = (state: CandidateState, allQuestions: Question[]): Question[] => {
  const asked = new Set(state.askedQuestions);
  const available = allQuestions.filter((q) => !asked.has(q.id));
  const total = state.candidates.length;
  if (total === 0) return available;

  return available.slice().sort((a, b) => {
    const scoreOf = (q: Question) => {
      const trueCount = state.candidates.filter((e) => e.facts[q.factKey] === true).length;
      return -Math.abs(trueCount / total - 0.5);
    };
    return scoreOf(b) - scoreOf(a);
  });
};

/** Returns the single best next question, or null if none remain or no candidates exist. */
export const getBestQuestion = (state: CandidateState, allQuestions: Question[]): Question | null => {
  if (state.candidates.length === 0) return null;
  return getAvailableQuestions(state, allQuestions)[0] ?? null;
};

/**
 * When multiple candidates remain and questions are exhausted, picks the one
 * whose known facts agree with the most recorded answers.
 */
export const getBestCandidate = (state: CandidateState): Entity | null => {
  if (state.candidates.length === 0) return null;
  const entries = Object.entries(state.answers);

  const scoreEntity = (entity: Entity): number =>
    entries.filter(([key, val]) => entity.facts[key] === val).length;

  return state.candidates.reduce((best, entity) =>
    scoreEntity(entity) > scoreEntity(best) ? entity : best
  );
};
