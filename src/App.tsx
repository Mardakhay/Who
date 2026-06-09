import { FormEvent, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  HISTORY_LIMIT,
  createInitialState,
  createLearnedNode,
  defaultStats,
  isBranch,
  isLeaf,
  loadStoredState,
  normalizeAnswer,
  replaceNodeAtPath,
  saveStoredState
} from "./game";
import type { Answer, BranchSide, HistoryItem, ModalName, PathItem, StoredState, ViewName } from "./types";
import { applyAnswer, createCandidateState, getBestCandidate, getBestQuestion } from "./engine/candidateEngine";
import type { CandidateState, Question } from "./types/engine";
import entitiesData from "./data/entities.json";
import questionsData from "./data/questions.json";

const allEntities = entitiesData as import("./types/engine").Entity[];
const allQuestions = questionsData as Question[];

type LearnFormState = {
  correctName: string;
  distinguishingQuestion: string;
  correctSide: BranchSide;
};

const answerLabels: Record<Answer, string> = {
  yes: "Yes",
  no: "No",
  probably: "Probably",
  probably_not: "Probably not",
  dont_know: "Don't know"
};

const shortcutMap: Record<string, Answer> = {
  y: "yes",
  n: "no",
  p: "probably",
  h: "probably_not",
  "?": "dont_know"
};

const formatDate = () =>
  new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const answerToBool = (answer: Answer): boolean | null => {
  if (answer === "yes" || answer === "probably") return true;
  if (answer === "no" || answer === "probably_not") return false;
  return null;
};

export function App() {
  const [stored, setStored] = useState<StoredState>(() => loadStoredState());
  const [view, setView] = useState<ViewName>("landing");
  const [activeModal, setActiveModal] = useState<ModalName>(null);
  const [path, setPath] = useState<PathItem[]>([]);
  const [fallback, setFallback] = useState<BranchSide | null>(null);
  const [confidence, setConfidence] = useState(88);
  const [roundSaved, setRoundSaved] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [learnForm, setLearnForm] = useState<LearnFormState>({
    correctName: "",
    distinguishingQuestion: "",
    correctSide: "yes"
  });

  // Candidate engine state
  const [candidateState, setCandidateState] = useState<CandidateState>(() =>
    createCandidateState(allEntities)
  );
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(() =>
    getBestQuestion(createCandidateState(allEntities), allQuestions)
  );
  const [guess, setGuess] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  const resultConfidence = Math.max(50, Math.min(96, confidence - Math.max(0, path.length - 2) * 2));

  useEffect(() => {
    saveStoredState(stored);
  }, [stored]);

  useEffect(() => {
    document.body.dataset.theme = view === "landing" ? "light" : "soft";
  }, [view]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveModal(null);
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select") ||
        view !== "game" ||
        currentQuestion === null ||
        isThinking
      )
        return;
      const answer = shortcutMap[event.key.toLowerCase()];
      if (!answer) return;
      event.preventDefault();
      handleAnswer(answer);
    };

    const handleAnswer = (answer: Answer) => {
      if (view !== "game" || currentQuestion === null || isThinking) return;
      answerQuestion(answer);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [view, currentQuestion, isThinking]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const updateStored = (updater: (state: StoredState) => StoredState) => {
    setStored((current) => updater(current));
  };

  const clearActiveTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startGame = () => {
    clearActiveTimer();
    const fresh = createCandidateState(allEntities);
    const firstQ = getBestQuestion(fresh, allQuestions);
    setPath([]);
    setFallback(null);
    setConfidence(88);
    setRoundSaved(false);
    setIsThinking(false);
    setGuess(null);
    setCandidateState(fresh);
    setCurrentQuestion(firstQ);
    setView("game");
  };

  const answerQuestion = (answer: Answer) => {
    if (view !== "game" || currentQuestion === null || isThinking) return;

    clearActiveTimer();

    const normalized = normalizeAnswer(answer);
    const branch = normalized.branch ?? fallback ?? "yes";
    const nextPath = [...path, { question: currentQuestion.text, answer, branch }];

    setIsThinking(true);
    timerRef.current = window.setTimeout(() => {
      const boolAnswer = answerToBool(answer);
      let nextState = candidateState;

      if (boolAnswer !== null) {
        nextState = applyAnswer(candidateState, currentQuestion.id, currentQuestion.factKey, boolAnswer);
      }

      const remaining = nextState.candidates;
      const nextQ = getBestQuestion(nextState, allQuestions);

      setPath(nextPath);
      setFallback(branch === "yes" ? "no" : "yes");
      setConfidence((v) => Math.max(52, v + normalized.confidenceDelta));
      setCandidateState(nextState);

      if (remaining.length <= 1 || nextQ === null) {
        const topGuess = (remaining.length <= 1 ? remaining[0] : getBestCandidate(nextState))?.name ?? "someone";
        setGuess(topGuess);
        setCurrentQuestion(null);
        setIsThinking(false);
        timerRef.current = null;
        setView("result");
        return;
      }

      if (remaining.length === 2 && nextQ !== null) {
        setGuess(remaining[0].name);
        setCurrentQuestion(nextQ);
        setIsThinking(false);
        timerRef.current = null;
        setView("result");
        return;
      }

      setCurrentQuestion(nextQ);
      setIsThinking(false);
      timerRef.current = null;
    }, 180);
  };

  const addHistory = (success: boolean, character: string, itemConfidence: number) => {
    const item: HistoryItem = { character, confidence: itemConfidence, date: formatDate(), success };
    updateStored((state) => {
      const newStreak = success ? state.stats.currentStreak + 1 : 0;
      return {
        ...state,
        history: [item, ...state.history].slice(0, HISTORY_LIMIT),
        stats: {
          gamesPlayed: state.stats.gamesPlayed + 1,
          wins: state.stats.wins + (success ? 1 : 0),
          currentStreak: newStreak,
          bestStreak: Math.max(state.stats.bestStreak, newStreak)
        }
      };
    });
  };

  const markCorrect = () => {
    if (roundSaved || guess === null) return;
    addHistory(true, guess, resultConfidence);
    setRoundSaved(true);
  };

  const openLearnModal = () => {
    setLearnForm({ correctName: "", distinguishingQuestion: "", correctSide: "yes" });
    setActiveModal("learn");
  };

  const learnFromMistake = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const correctName = learnForm.correctName.trim();
    const question = learnForm.distinguishingQuestion.trim();
    if (!correctName || !question || guess === null) return;

    const currentLeaf = { guess };
    const learnedNode = createLearnedNode(currentLeaf.guess, correctName, question, learnForm.correctSide);
    updateStored((state) => ({
      ...state,
      tree: replaceNodeAtPath(state.tree, path.map((item) => item.branch), learnedNode),
      history: [
        { character: correctName, confidence: 100, date: formatDate(), success: false },
        ...state.history
      ].slice(0, HISTORY_LIMIT),
      stats: {
        gamesPlayed: state.stats.gamesPlayed + 1,
        wins: state.stats.wins,
        currentStreak: 0,
        bestStreak: state.stats.bestStreak
      }
    }));

    setRoundSaved(true);
    setActiveModal(null);
    setView("landing");
  };

  const resetData = () => {
    clearActiveTimer();
    const nextState = createInitialState();
    nextState.stats = { ...defaultStats };
    setStored(nextState);
    setPath([]);
    setFallback(null);
    setConfidence(88);
    setRoundSaved(false);
    setIsThinking(false);
    setGuess(null);
    setCandidateState(createCandidateState(allEntities));
    setCurrentQuestion(getBestQuestion(createCandidateState(allEntities), allQuestions));
    setActiveModal(null);
    setView("landing");
  };

  const currentGuessDisplay = guess ?? "someone";
  const candidatesLeft = candidateState.candidates.length;

  return (
    <>
      <main className="app-shell">
        <header className="topbar">
          <button className="brand-button" type="button" onClick={() => setView("landing")} aria-label="Return home">
            Who<span>?</span>
          </button>
          <nav className="top-actions" aria-label="App actions">
            <button className="ghost-btn" type="button" onClick={() => setActiveModal("history")}>
              History
            </button>
            <button className="ghost-btn" type="button" onClick={() => setActiveModal("keyboard")}>
              Shortcuts
            </button>
          </nav>
        </header>

        {view === "landing" && (
          <section className="view is-active" aria-labelledby="landingTitle">
            <article className="glass-card hero-card">
              <p className="eyebrow">Minimal guessing game</p>
              <h1 id="landingTitle">Think of someone.</h1>
              <p className="subcopy">
                Answer a few calm questions and Who? will try to identify the person, public figure, celebrity, or
                character in your mind.
              </p>
              <div className="cta-row">
                <button className="primary-btn" type="button" onClick={startGame}>
                  Start
                </button>
                <button className="secondary-btn" type="button" onClick={() => setActiveModal("how")}>
                  How it works
                </button>
              </div>
            </article>
          </section>
        )}

        {view === "game" && currentQuestion !== null && (
          <section className="view is-active" aria-live="polite" aria-labelledby="questionText">
            <article className="glass-card game-card">
              <div className="progress-row">
                <span>
                  {path.length + 1} question{path.length === 0 ? "" : "s"}
                  {candidatesLeft > 1 && (
                    <span className="candidates-hint"> &middot; {candidatesLeft} possible</span>
                  )}
                </span>
                <div className="progress-track" aria-hidden="true">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(92, 18 + path.length * 18)}%` }}
                  />
                </div>
              </div>
              {candidatesLeft > 1 && candidatesLeft <= 5 && (
                <div className="candidates-preview">
                  {candidateState.candidates.slice(0, 5).map((c, i) => (
                    <span key={c.id} className="candidate-chip" style={{ animationDelay: `${i * 40}ms` }}>
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
              <p className="eyebrow">Question</p>
              <h2 id="questionText">{currentQuestion.text}</h2>
              <div className={`thinking${isThinking ? " is-visible" : ""}`} aria-hidden={!isThinking}>
                Thinking<span>.</span>
                <span>.</span>
                <span>.</span>
              </div>
              <div className="answer-grid" aria-label="Answer choices" hidden={isThinking}>
                {(Object.keys(answerLabels) as Answer[]).map((answer) => (
                  <button
                    className={`answer-btn${answer === "dont_know" ? " wide" : ""}`}
                    key={answer}
                    type="button"
                    onClick={() => answerQuestion(answer)}
                  >
                    {answerLabels[answer]}
                  </button>
                ))}
              </div>
            </article>
          </section>
        )}

        {view === "result" && (
          <section className="view is-active" aria-labelledby="resultTitle">
            <article className="glass-card result-card">
              <p className="eyebrow">Result</p>
              <h2 id="resultTitle">
                I think it's <span>{currentGuessDisplay}</span>.
              </h2>
              <p className="subcopy">
                Guessed in <strong>{path.length} question{path.length !== 1 ? "s" : ""}</strong> with{" "}
                <strong>{resultConfidence}%</strong> confidence
              </p>
              <div className="progress-track confidence" aria-hidden="true">
                <div className="progress-fill" style={{ width: `${resultConfidence}%` }} />
              </div>
              <div className="cta-row">
                <button className="primary-btn" type="button" onClick={markCorrect}>
                  {roundSaved ? "Saved" : "Correct"}
                </button>
                <button className="secondary-btn" type="button" onClick={openLearnModal}>
                  Not correct
                </button>
              </div>
              <button className="text-btn" type="button" onClick={startGame}>
                Play again
              </button>
            </article>
          </section>
        )}
      </main>

      <Modal isOpen={activeModal === "how"} onClose={() => setActiveModal(null)} labelledBy="howTitle">
        <p className="eyebrow">How it works</p>
        <h3 id="howTitle">Think. Answer. Guess.</h3>
        <ol>
          <li>Think of a person, celebrity, public figure, or fictional character.</li>
          <li>Answer each question with the closest match.</li>
          <li>If the guess is wrong, teach Who? one question that separates the answers.</li>
        </ol>
      </Modal>

      <Modal isOpen={activeModal === "learn"} onClose={() => setActiveModal(null)} labelledBy="learnTitle">
        <form onSubmit={learnFromMistake}>
          <p className="eyebrow">Learn</p>
          <h3 id="learnTitle">Teach Who? the right answer</h3>
          <p className="modal-note">
            Current guess: <strong>{currentGuessDisplay}</strong>
          </p>
          <label>
            Correct character name
            <input
              value={learnForm.correctName}
              onChange={(event) => setLearnForm((form) => ({ ...form, correctName: event.target.value }))}
              type="text"
              placeholder="e.g. Spider-Man"
              autoComplete="off"
              required
            />
          </label>
          <label>
            Distinguishing question
            <textarea
              value={learnForm.distinguishingQuestion}
              onChange={(event) =>
                setLearnForm((form) => ({ ...form, distinguishingQuestion: event.target.value }))
              }
              rows={3}
              placeholder="Does this character shoot webs?"
              required
            />
          </label>
          <fieldset>
            <legend>For the correct character, the answer is</legend>
            <label className="radio-row">
              <input
                type="radio"
                name="correctSide"
                value="yes"
                checked={learnForm.correctSide === "yes"}
                onChange={() => setLearnForm((form) => ({ ...form, correctSide: "yes" }))}
              />
              Yes
            </label>
            <label className="radio-row">
              <input
                type="radio"
                name="correctSide"
                value="no"
                checked={learnForm.correctSide === "no"}
                onChange={() => setLearnForm((form) => ({ ...form, correctSide: "no" }))}
              />
              No
            </label>
          </fieldset>
          <div className="modal-actions">
            <button className="primary-btn" type="submit">
              Save knowledge
            </button>
            <button className="secondary-btn" type="button" onClick={() => setActiveModal(null)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={activeModal === "history"} onClose={() => setActiveModal(null)} labelledBy="historyTitle">
        <p className="eyebrow">History</p>
        <div className="history-header">
          <h3 id="historyTitle">Recent rounds</h3>
          <button className="danger-btn" type="button" onClick={resetData}>
            Reset data
          </button>
        </div>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{stored.stats.gamesPlayed}</span>
            <span className="stat-label">Played</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stored.stats.wins}</span>
            <span className="stat-label">Wins</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {stored.stats.gamesPlayed > 0
                ? Math.round((stored.stats.wins / stored.stats.gamesPlayed) * 100)
                : 0}%
            </span>
            <span className="stat-label">Rate</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stored.stats.bestStreak}</span>
            <span className="stat-label">Best</span>
          </div>
        </div>
        {stored.history.length === 0 ? (
          <p className="modal-note">No saved rounds yet.</p>
        ) : (
          <div className="history-list">
            {stored.history.map((item, index) => (
              <article className="history-item" key={`${item.character}-${index}`}>
                <div>
                  <strong>{item.character}</strong>
                  <p>{item.date}</p>
                </div>
                <span className={item.success ? "badge success" : "badge fail"}>
                  {item.success ? `${item.confidence}%` : "Learned"}
                </span>
              </article>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={activeModal === "keyboard"} onClose={() => setActiveModal(null)} labelledBy="keyboardTitle">
        <p className="eyebrow">Shortcuts</p>
        <h3 id="keyboardTitle">Quick answers</h3>
        <ul className="shortcut-list">
          <li>
            <kbd>Y</kbd> Yes
          </li>
          <li>
            <kbd>N</kbd> No
          </li>
          <li>
            <kbd>P</kbd> Probably
          </li>
          <li>
            <kbd>H</kbd> Probably not
          </li>
          <li>
            <kbd>?</kbd> Don't know
          </li>
          <li>
            <kbd>Esc</kbd> Close modal
          </li>
        </ul>
      </Modal>
    </>
  );
}

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
};

function Modal({ isOpen, onClose, labelledBy, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      closeBtnRef.current?.focus();
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
      role="presentation"
    >
      <div className="modal">
        <article className="modal-card glass-card" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
          <button
            ref={closeBtnRef}
            className="close-btn"
            type="button"
            aria-label="Close modal"
            onClick={onClose}
          >
            ×
          </button>
          {children}
        </article>
      </div>
    </div>
  );
}
