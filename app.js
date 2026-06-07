const STORAGE_KEY = "who:mvp:v1";
const HISTORY_LIMIT = 12;

const defaultTree = {
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

const defaultSettings = {
  theme: "light",
  animations: true
};

const elements = {
  views: [...document.querySelectorAll(".view")],
  modals: [...document.querySelectorAll(".modal")],
  questionText: document.getElementById("questionText"),
  progressText: document.getElementById("progressText"),
  progressFill: document.getElementById("progressFill"),
  thinkingState: document.getElementById("thinkingState"),
  answerGrid: document.getElementById("answerGrid"),
  guessName: document.getElementById("guessName"),
  confidenceValue: document.getElementById("confidenceValue"),
  confidenceFill: document.getElementById("confidenceFill"),
  learnGuessName: document.getElementById("learnGuessName"),
  learnForm: document.getElementById("learnForm"),
  historyList: document.getElementById("historyList"),
  themeSelect: document.getElementById("themeSelect"),
  animationsToggle: document.getElementById("animationsToggle")
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const loadStoredState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      tree: isBranch(saved.tree) || isLeaf(saved.tree) ? saved.tree : clone(defaultTree),
      history: Array.isArray(saved.history) ? saved.history.slice(0, HISTORY_LIMIT) : [],
      settings: { ...defaultSettings, ...(saved.settings || {}) }
    };
  } catch {
    return {
      tree: clone(defaultTree),
      history: [],
      settings: { ...defaultSettings }
    };
  }
};

const isLeaf = (node) => Boolean(node && typeof node.guess === "string");
const isBranch = (node) => Boolean(node && typeof node.question === "string" && node.yes && node.no);

let stored = loadStoredState();

const game = {
  view: "landing",
  node: stored.tree,
  path: [],
  fallback: null,
  confidence: 0,
  roundSaved: false,
  thinkingTimer: 0
};

const save = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
};

const applySettings = () => {
  document.body.dataset.theme = stored.settings.theme;
  document.body.classList.toggle("no-animations", !stored.settings.animations);
  elements.themeSelect.value = stored.settings.theme;
  elements.animationsToggle.checked = stored.settings.animations;
};

const showView = (name) => {
  game.view = name;
  elements.views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
};

const openModal = (id) => {
  const modal = document.getElementById(id);
  if (!modal) return;

  if (id === "historyModal") renderHistory();
  if (id === "learnModal") {
    elements.learnGuessName.textContent = isLeaf(game.node) ? game.node.guess : "this guess";
    elements.learnForm.reset();
    elements.learnForm.correctSide.value = "yes";
  }

  modal.showModal();
};

const closeModals = () => {
  elements.modals.forEach((modal) => {
    if (modal.open) modal.close();
  });
};

const renderHistory = () => {
  elements.historyList.innerHTML = "";

  if (!stored.history.length) {
    const empty = document.createElement("p");
    empty.className = "modal-note";
    empty.textContent = "No rounds yet.";
    elements.historyList.appendChild(empty);
    return;
  }

  stored.history.forEach((round) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const name = document.createElement("span");
    name.textContent = round.character;

    const details = document.createElement("small");
    details.textContent = `${round.confidence}% - ${round.success ? "correct" : "learned"} - ${round.date}`;

    item.append(name, details);
    elements.historyList.appendChild(item);
  });
};

const setProgress = () => {
  const answered = game.path.length;
  const pct = Math.min(92, 18 + answered * 18);
  elements.progressText.textContent = `${answered + 1} question${answered === 0 ? "" : "s"}`;
  elements.progressFill.style.width = `${pct}%`;
};

const showThinking = (callback) => {
  clearTimeout(game.thinkingTimer);
  elements.answerGrid.hidden = true;
  elements.thinkingState.classList.add("is-visible");
  elements.thinkingState.setAttribute("aria-hidden", "false");

  game.thinkingTimer = window.setTimeout(() => {
    elements.answerGrid.hidden = false;
    elements.thinkingState.classList.remove("is-visible");
    elements.thinkingState.setAttribute("aria-hidden", "true");
    callback();
  }, stored.settings.animations ? 260 : 0);
};

const showCurrentNode = () => {
  if (isLeaf(game.node)) {
    showResult();
    return;
  }

  elements.questionText.textContent = game.node.question;
  setProgress();
  showView("game");
};

const startGame = () => {
  clearTimeout(game.thinkingTimer);
  game.node = stored.tree;
  game.path = [];
  game.fallback = null;
  game.confidence = 88;
  game.roundSaved = false;
  elements.answerGrid.hidden = false;
  elements.thinkingState.classList.remove("is-visible");
  showCurrentNode();
};

const normalizeAnswer = (answer) => {
  if (answer === "probably") return { branch: "yes", confidenceDelta: -6 };
  if (answer === "probably_not") return { branch: "no", confidenceDelta: -6 };
  if (answer === "dont_know") return { branch: null, confidenceDelta: -14 };
  return { branch: answer, confidenceDelta: 0 };
};

const answerQuestion = (answer) => {
  if (game.view !== "game" || !isBranch(game.node)) return;

  const current = game.node;
  const normalized = normalizeAnswer(answer);
  let nextBranch = normalized.branch;

  if (!nextBranch) {
    nextBranch = game.fallback || "yes";
  }

  game.path.push({ question: current.question, answer, branch: nextBranch });
  game.fallback = nextBranch === "yes" ? "no" : "yes";
  game.confidence = Math.max(52, game.confidence + normalized.confidenceDelta);
  game.node = current[nextBranch];

  showThinking(showCurrentNode);
};

const showResult = () => {
  const confidence = Math.max(50, Math.min(96, game.confidence - Math.max(0, game.path.length - 2) * 2));
  game.confidence = confidence;
  elements.guessName.textContent = game.node.guess;
  elements.confidenceValue.textContent = `${confidence}%`;
  elements.confidenceFill.style.width = `${confidence}%`;
  showView("result");
};

const addHistory = (success, character = game.node.guess, confidence = game.confidence) => {
  if (!character) return;

  stored.history.unshift({
    character,
    confidence,
    date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    success
  });
  stored.history = stored.history.slice(0, HISTORY_LIMIT);
  save();
  renderHistory();
};

const markCorrect = () => {
  if (game.roundSaved || !isLeaf(game.node)) return;
  addHistory(true);
  game.roundSaved = true;
};

const learnFromMistake = (formData) => {
  if (!isLeaf(game.node)) return;

  const previousGuess = game.node.guess;
  const correctName = formData.get("correctName").trim();
  const question = formData.get("distinguishingQuestion").trim();
  const correctSide = formData.get("correctSide");

  if (!correctName || !question) return;

  const learnedNode = correctSide === "yes"
    ? {
        question,
        yes: { guess: correctName },
        no: { guess: previousGuess }
      }
    : {
        question,
        yes: { guess: previousGuess },
        no: { guess: correctName }
      };

  Object.keys(game.node).forEach((key) => delete game.node[key]);
  Object.assign(game.node, learnedNode);

  addHistory(false, correctName, 100);
  game.roundSaved = true;
  save();
  closeModals();
  showView("landing");
};

const resetData = () => {
  localStorage.removeItem(STORAGE_KEY);
  stored = {
    tree: clone(defaultTree),
    history: [],
    settings: { ...defaultSettings }
  };
  Object.assign(game, {
    node: stored.tree,
    path: [],
    fallback: null,
    confidence: 0,
    roundSaved: false
  });
  applySettings();
  renderHistory();
  closeModals();
  showView("landing");
  save();
};

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  const openButton = event.target.closest("[data-open]");
  const answerButton = event.target.closest("[data-answer]");

  if (openButton) openModal(openButton.dataset.open);
  if (answerButton) answerQuestion(answerButton.dataset.answer);

  if (!actionButton) return;

  const { action } = actionButton.dataset;
  if (action === "home") showView("landing");
  if (action === "startGame" || action === "restart") startGame();
  if (action === "markCorrect") markCorrect();
  if (action === "closeModals") closeModals();
  if (action === "resetData") resetData();
});

elements.learnForm.addEventListener("submit", (event) => {
  event.preventDefault();
  learnFromMistake(new FormData(elements.learnForm));
});

elements.themeSelect.addEventListener("change", () => {
  stored.settings.theme = elements.themeSelect.value;
  applySettings();
  save();
});

elements.animationsToggle.addEventListener("change", () => {
  stored.settings.animations = elements.animationsToggle.checked;
  applySettings();
  save();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModals();
    return;
  }

  if (event.target.matches("input, textarea, select") || game.view !== "game") return;

  const shortcuts = {
    y: "yes",
    n: "no",
    p: "probably",
    h: "probably_not",
    "?": "dont_know"
  };
  const answer = shortcuts[event.key.toLowerCase()];
  if (!answer) return;

  event.preventDefault();
  answerQuestion(answer);
});

applySettings();
renderHistory();
showView("landing");
