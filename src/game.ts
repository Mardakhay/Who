import type { Answer, BranchNode, BranchSide, GameStats, HistoryItem, StoredState, TreeNode } from "./types";

export const STORAGE_KEY = "who:mvp:v2";
export const HISTORY_LIMIT = 12;

export const defaultStats: GameStats = {
  gamesPlayed: 0,
  wins: 0,
  currentStreak: 0,
  bestStreak: 0
};

export const defaultTree: TreeNode = {
  question: "Is your character real?",
  yes: {
    question: "Is your character primarily known for music?",
    yes: {
      question: "Is your character a pop singer?",
      yes: { guess: "Taylor Swift" },
      no: { guess: "Beyoncé" }
    },
    no: {
      question: "Is your character primarily known for sports?",
      yes: { guess: "Cristiano Ronaldo" },
      no: {
        question: "Is your character known for technology or business?",
        yes: { guess: "Elon Musk" },
        no: { guess: "Albert Einstein" }
      }
    }
  },
  no: {
    question: "Is your character a superhero?",
    yes: {
      question: "Is your character from DC Comics?",
      yes: { guess: "Batman" },
      no: { guess: "Spider-Man" }
    },
    no: {
      question: "Is your character from anime or manga?",
      yes: { guess: "Naruto" },
      no: { guess: "Sherlock Holmes" }
    }
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
};

export const cloneTree = (tree: TreeNode): TreeNode => JSON.parse(JSON.stringify(tree)) as TreeNode;

export const isLeaf = (node: TreeNode | unknown): node is { guess: string } => {
  return Boolean(isPlainObject(node) && typeof node.guess === "string" && node.guess.trim().length > 0);
};

export const isBranch = (node: TreeNode | unknown): node is BranchNode => {
  return Boolean(
    isPlainObject(node) &&
      typeof node.question === "string" &&
      node.question.trim().length > 0 &&
      "yes" in node &&
      "no" in node
  );
};

export const sanitizeTree = (node: unknown): TreeNode => {
  if (isLeaf(node)) return { guess: node.guess.trim() };
  if (isBranch(node)) {
    return {
      question: node.question.trim(),
      yes: sanitizeTree(node.yes),
      no: sanitizeTree(node.no)
    };
  }
  return cloneTree(defaultTree);
};

export const normalizeAnswer = (answer: Answer): { branch: BranchSide | null; confidenceDelta: number } => {
  if (answer === "probably") return { branch: "yes", confidenceDelta: -6 };
  if (answer === "probably_not") return { branch: "no", confidenceDelta: -6 };
  if (answer === "dont_know") return { branch: null, confidenceDelta: -14 };
  return { branch: answer, confidenceDelta: 0 };
};

export const getNodeAtPath = (tree: TreeNode, path: BranchSide[]): TreeNode => {
  return path.reduce<TreeNode>((node, side) => {
    if (!isBranch(node)) return node;
    return node[side];
  }, tree);
};

export const replaceNodeAtPath = (tree: TreeNode, path: BranchSide[], replacement: TreeNode): TreeNode => {
  if (path.length === 0) return replacement;
  if (!isBranch(tree)) return tree;

  const [side, ...rest] = path;
  return {
    ...tree,
    [side]: replaceNodeAtPath(tree[side], rest, replacement)
  };
};

export const createLearnedNode = (
  previousGuess: string,
  correctName: string,
  question: string,
  correctSide: BranchSide
): BranchNode => {
  if (correctSide === "yes") {
    return {
      question,
      yes: { guess: correctName },
      no: { guess: previousGuess }
    };
  }

  return {
    question,
    yes: { guess: previousGuess },
    no: { guess: correctName }
  };
};

export const createInitialState = (): StoredState => ({
  tree: cloneTree(defaultTree),
  history: [],
  stats: { ...defaultStats }
});

const sanitizeStats = (value: unknown): GameStats => {
  if (!isPlainObject(value)) return { ...defaultStats };
  return {
    gamesPlayed: Math.max(0, Math.floor(Number(value.gamesPlayed) || 0)),
    wins: Math.max(0, Math.floor(Number(value.wins) || 0)),
    currentStreak: Math.max(0, Math.floor(Number(value.currentStreak) || 0)),
    bestStreak: Math.max(0, Math.floor(Number(value.bestStreak) || 0))
  };
};

const sanitizeHistory = (value: unknown): HistoryItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is HistoryItem =>
        isPlainObject(item) &&
        typeof item.character === "string" &&
        typeof item.confidence === "number" &&
        typeof item.date === "string" &&
        typeof item.success === "boolean"
    )
    .map((item) => ({
      character: item.character.trim(),
      confidence: Math.max(0, Math.min(100, Math.round(item.confidence))),
      date: item.date.trim(),
      success: item.success
    }))
    .filter((item) => item.character.length > 0 && item.date.length > 0)
    .slice(0, HISTORY_LIMIT);
};

export const loadStoredState = (): StoredState => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Partial<StoredState>;
    return {
      tree: sanitizeTree(saved.tree),
      history: sanitizeHistory(saved.history),
      stats: sanitizeStats(saved.stats)
    };
  } catch {
    return createInitialState();
  }
};

export const saveStoredState = (state: StoredState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};
