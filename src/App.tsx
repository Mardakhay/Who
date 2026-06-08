import { FormEvent, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  HISTORY_LIMIT,
  createInitialState,
  createLearnedNode,
  getNodeAtPath,
  isBranch,
  isLeaf,
  loadStoredState,
  normalizeAnswer,
  replaceNodeAtPath,
  saveStoredState
} from "./game";
import type { Answer, BranchSide, HistoryItem, ModalName, PathItem, StoredState, ViewName } from "./types";

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

const formatDate = () => new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

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

  const timerRef = useRef<number | null>(null);

  const currentNode = getNodeAtPath(stored.tree, path.map((item) => item.branch));
  const resultConfidence = Math.max(50, Math.min(96, confidence - Math.max(0, path.length - 2) * 2));

  useEffect(() => {
    saveStoredState(stored);
  }, [stored]);

  useEffect(() => {
    if (view === "landing") {
      document.body.dataset.theme = "light";
      return;
    }
    document.body.dataset.theme = "light";
  }, [view]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveModal(null);
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select") || view !== "game" || !isBranch(currentNode) || isThinking) return;

      const answer = shortcutMap[event.key.toLowerCase()];
      if (!answer) return;
      event.preventDefault();
      answerQuestion(answer);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [view, currentNode, isThinking, path, fallback, confidence, roundSaved, stored.tree]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
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
    setPath([]);
    setFallback(null);
    setConfidence(88);
    setRoundSaved(false);
    setIsThinking(false);
    setView("game");
  };

  const answerQuestion = (answer: Answer) => {
    if (view !== "game" || !isBranch(currentNode) || isThinking) return;

    clearActiveTimer();

    const normalized = normalizeAnswer(answer);
    const branch = normalized.branch ?? fallback ?? "yes";
    const nextPath = [...path, { question: currentNode.question, answer, branch }];

    setIsThinking(true);
    timerRef.current = window.setTimeout(() => {
      const nextNode = getNodeAtPath(stored.tree, nextPath.map((item) => item.branch));
      setPath(nextPath);
      setFallback(branch === "yes" ? "no" : "yes");
      setConfidence((value) => Math.max(52, value + normalized.confidenceDelta));
      setView(isLeaf(nextNode) ? "result" : "game");
      setIsThinking(false);
      timerRef.current = null;
    }, 180);
  };

  const addHistory = (success: boolean, character: string, itemConfidence: number) => {
    const item: HistoryItem = {
      character,
      confidence: itemConfidence,
      date: formatDate(),
      success
    };

    updateStored((state) => ({
      ...state,
      history: [item, ...state.history].slice(0, HISTORY_LIMIT)
    }));
  };

  const markCorrect = () => {
    if (roundSaved || !isLeaf(currentNode)) return;
    addHistory(true, currentNode.guess, resultConfidence);
    setRoundSaved(true);
  };

  const openLearnModal = () => {
    setLearnForm({ correctName: "", distinguishingQuestion: "", correctSide: "yes" });
    setActiveModal("learn");
  };

  const learnFromMistake = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLeaf(currentNode)) return;

    const correctName = learnForm.correctName.trim();
    const question = learnForm.distinguishingQuestion.trim();
    if (!correctName || !question) return;

    const learnedNode = createLearnedNode(currentNode.guess, correctName, question, learnForm.correctSide);
    updateStored((state) => ({
      ...state,
      tree: replaceNodeAtPath(state.tree, path.map((item) => item.branch), learnedNode),
      history: [
        { character: correctName, confidence: 100, date: formatDate(), success: false },
        ...state.history
      ].slice(0, HISTORY_LIMIT)
    }));

    setRoundSaved(true);
    setActiveModal(null);
    setView("landing");
  };

  const resetData = () => {
    clearActiveTimer();
    const nextState = createInitialState();
    setStored(nextState);
    setPath([]);
    setFallback(null);
    setConfidence(88);
    setRoundSaved(false);
    setIsThinking(false);
    setActiveModal(null);
    setView("landing");
  };

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

        {view === "game" && isBranch(currentNode) && (
          <section className="view is-active" aria-live="polite" aria-labelledby="questionText">
            <article className="glass-card game-card">
              <div className="progress-row">
                <span>
                  {path.length + 1} question{path.length === 0 ? "" : "s"}
                </span>
                <div className="progress-track" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${Math.min(92, 18 + path.length * 18)}%` }} />
                </div>
              </div>
              <p className="eyebrow">Question</p>
              <h2 id="questionText">{currentNode.question}</h2>
              <div className={`thinking${isThinking ? " is-visible" : ""}`} aria-hidden={!isThinking}>
                Thinking<span>.</span><span>.</span><span>.</span>
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

        {view === "result" && isLeaf(currentNode) && (
          <section className="view is-active" aria-labelledby="resultTitle">
            <article className="glass-card result-card">
              <p className="eyebrow">Result</p>
              <h2 id="resultTitle">
                I think it's <span>{currentNode.guess}</span>.
              </h2>
              <p className="subcopy">
                Confidence: <strong>{resultConfidence}%</strong>
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
            Current guess: <strong>{isLeaf(currentNode) ? currentNode.guess : "this guess"}</strong>
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
              onChange={(event) => setLearnForm((form) => ({ ...form, distinguishingQuestion: event.target.value }))}
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
          <button className="primary-btn form-submit" type="submit">
            Save and learn
          </button>
        </form>
      </Modal>

      <Modal isOpen={activeModal === "history"} onClose={() => setActiveModal(null)} labelledBy="historyTitle">
        <p className="eyebrow">History</p>
        <h3 id="historyTitle">Recent rounds</h3>
        <div className="history-list">
          {stored.history.length === 0 ? (
            <p className="modal-note">No rounds yet.</p>
          ) : (
            stored.history.map((round, index) => (
              <div className="history-item" key={`${round.character}-${round.date}-${index}`}>
                <span>{round.character}</span>
                <small>
                  {round.confidence}% — {round.success ? "correct" : "learned"} — {round.date}
                </small>
              </div>
            ))
          )}
        </div>
        <button className="danger-btn" type="button" onClick={resetData}>
          Reset learned data
        </button>
      </Modal>

      <Modal isOpen={activeModal === "keyboard"} onClose={() => setActiveModal(null)} labelledBy="keyboardTitle">
        <p className="eyebrow">Shortcuts</p>
        <h3 id="keyboardTitle">Keyboard controls</h3>
        <div className="shortcut-row"><kbd>Y</kbd><span>Yes</span></div>
        <div className="shortcut-row"><kbd>N</kbd><span>No</span></div>
        <div className="shortcut-row"><kbd>P</kbd><span>Probably</span></div>
        <div className="shortcut-row"><kbd>H</kbd><span>Probably not</span></div>
        <div className="shortcut-row"><kbd>?</kbd><span>Don't know</span></div>
        <div className="shortcut-row"><kbd>Esc</kbd><span>Close modal</span></div>
      </Modal>

      {activeModal && <div className="modal-backdrop" onClick={() => setActiveModal(null)} />}
    </>
  );
}

type ModalProps = {
  isOpen: boolean;
  labelledBy: string;
  children: ReactNode;
  onClose: () => void;
};

function Modal({ isOpen, labelledBy, children, onClose }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal is-open" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="modal-card glass-card">
        <button className="close-btn" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
