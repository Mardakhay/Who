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
 * Returns questions that have not yet been asked.
 *
 * TODO (Phase 2): Replace this with entropy-based selection.
 * Choose the question whose factKey splits remaining candidates closest to 50/50:
 *   score(q) = -|trueCount/total - 0.5|   (higher is better)
 * Return questions sorted descending by score so callers can pick state.candidates[0].
 */
export const getAvailableQuestions = (state: CandidateState, allQuestions: Question[]): Question[] => {
  const asked = new Set(state.askedQuestions);
  return allQuestions.filter((q) => !asked.has(q.id));
};
