export type Answer = "yes" | "no" | "probably" | "probably_not" | "dont_know";
export type BranchSide = "yes" | "no";
export type ViewName = "landing" | "game" | "result";
export type ModalName = "how" | "learn" | "history" | "keyboard" | null;

export type LeafNode = {
  guess: string;
};

export type BranchNode = {
  question: string;
  yes: TreeNode;
  no: TreeNode;
};

export type TreeNode = LeafNode | BranchNode;

export type HistoryItem = {
  character: string;
  confidence: number;
  date: string;
  success: boolean;
};

export type GameStats = {
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
};

export type StoredState = {
  tree: TreeNode;
  history: HistoryItem[];
  stats: GameStats;
};

export type PathItem = {
  question: string;
  answer: Answer;
  branch: BranchSide;
};
