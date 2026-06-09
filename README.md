# Who?

**Who?** is a calm, browser-based guessing game inspired by Akinator. Think of a person, celebrity, public figure, or fictional character, then answer a series of questions and let the game try to identify the character in your mind.

## Features

- Adaptive question flow powered by a candidate-filtering engine
- Multiple answer options: **Yes**, **No**, **Probably**, **Probably not**, and **Don't know**
- Learning mode that lets the game improve when it guesses wrong
- Local history and statistics saved in `localStorage`
- Keyboard shortcuts for faster play
- Clean Vite + React + TypeScript setup
- Vitest test coverage for the candidate engine

## How it works

1. Start a round and think of a character.
2. Answer the questions as accurately as you can.
3. The game narrows down the list of possible candidates.
4. When it makes a guess, confirm whether it is correct.
5. If the guess is wrong, teach the game with a new distinguishing question.

## Keyboard shortcuts

- `Y` — Yes
- `N` — No
- `P` — Probably
- `H` — Probably not
- `?` — Don't know
- `Esc` — Close modal dialogs

## Tech stack

- React 18
- TypeScript
- Vite
- Vitest

## Project structure

```text
src/
├── App.tsx                  # Main game UI
├── main.tsx                 # App entry point
├── game.ts                  # Tree storage, learning, and state helpers
├── engine/
│   └── candidateEngine.ts   # Candidate filtering and question selection
├── data/
│   ├── entities.json        # Possible characters / candidates
│   └── questions.json       # Question bank
└── types/                   # Shared TypeScript types
```

## Getting started

### Prerequisites

- Node.js 18+ recommended
- npm

### Install

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

### Run tests

```bash
npm run test
```

## Customization

You can extend the game by editing:

- `src/data/entities.json` — add or update characters
- `src/data/questions.json` — add or refine questions
- `src/game.ts` — adjust the default decision tree and learning behavior
- `src/engine/candidateEngine.ts` — tune question selection logic

## Storage

The game stores progress, learned knowledge, and history in browser `localStorage` under the key:

```text
who:mvp:v2
```
