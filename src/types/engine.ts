export interface Entity {
  id: string;
  name: string;
  facts: Record<string, boolean>;
}

export interface Question {
  id: string;
  text: string;
  factKey: string;
}

export interface CandidateState {
  candidates: Entity[];
  askedQuestions: string[];
  answers: Record<string, boolean>;
}
