import type { Answer, BranchNode, BranchSide, Settings, StoredState, TreeNode } from "./types";

export const STORAGE_KEY = "who:mvp:v1";
export const HISTORY_LIMIT = 12;

export const defaultTree: TreeNode = {
  question: "Is your character real?",
  yes: {
    question: "Is your character primarily known for music?",
    yes: { guess: "Taylor Swift" },
    no: {
      question: "Is your character known for technology or business?",
      yes: { guess: "Elon Musk" },
      no: { guess: "Cristiano Ronaldo" }
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
      question: "Is your character a detective?",
      yes: { guess: "Sherlock Holmes" },
      no: { guess: "Naruto" }
    }
  }
};

export const defaultSettings: Settings = {
  theme: "light",
  animations: true
};

export const cloneTree = (tree: TreeNode): TreeNode => JSON.parse(JSON.stringify(tree)) as TreeNode;

export const isLeaf = (node: TreeNode | unknown): node is { guess: string } => {
  return Boolean(node && typeof node === "object" && "guess" in node && typeof (node as { guess?: unknown }).guess === "string");
};

export const isBranch = (node: TreeNode | unknown): node is BranchNode => {
  if (!node || typeof node !== "object") return false;
  const candidate = node as { question?: unknown; yes?: unknown; no?: unknown };
  return typeof candidate.question === "string" && Boolean(candidate.yes) && Boolean(candidate.no);
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
  settings: { ...defaultSettings }
});

export const loadStoredState = (): StoredState => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Partial<StoredState>;
    return {
      tree: isBranch(saved.tree) || isLeaf(saved.tree) ? saved.tree : cloneTree(defaultTree),
      history: Array.isArray(saved.history) ? saved.history.slice(0, HISTORY_LIMIT) : [],
      settings: { ...defaultSettings, ...(saved.settings || {}) }
    };
  } catch {
    return createInitialState();
  }
};

export const saveStoredState = (state: StoredState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};
