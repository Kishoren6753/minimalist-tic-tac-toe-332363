import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const PLAYER_X = "X";
const PLAYER_O = "O";

const SCOREBOARD_STORAGE_KEY = "ttt_scoreboard_v1";

const WIN_LINES = [
  [0, 1, 2], // rows
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6], // cols
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8], // diags
  [2, 4, 6],
];

/**
 * Compute winner and winning line for a given board.
 * @param {(null|"X"|"O")[]} squares
 * @returns {{winner: null|"X"|"O", line: number[] | null}}
 */
function calculateWinner(squares) {
  for (const [a, b, c] of WIN_LINES) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], line: [a, b, c] };
    }
  }
  return { winner: null, line: null };
}

/**
 * @param {(null|"X"|"O")[]} squares
 * @returns {boolean}
 */
function isDraw(squares) {
  // Draw if all squares are filled and no winner.
  return squares.every((s) => s !== null) && !calculateWinner(squares).winner;
}

/**
 * Read the persisted scoreboard (if available).
 * Returns a safe default if localStorage is unavailable or corrupted.
 * @returns {{xWins:number, oWins:number, draws:number}}
 */
function readScoreboardFromStorage() {
  // localStorage can be unavailable (privacy mode / SSR / restricted environments).
  try {
    const raw = window.localStorage.getItem(SCOREBOARD_STORAGE_KEY);
    if (!raw) return { xWins: 0, oWins: 0, draws: 0 };

    const parsed = JSON.parse(raw);
    const xWins = Number(parsed?.xWins ?? 0);
    const oWins = Number(parsed?.oWins ?? 0);
    const draws = Number(parsed?.draws ?? 0);

    return {
      xWins: Number.isFinite(xWins) && xWins >= 0 ? xWins : 0,
      oWins: Number.isFinite(oWins) && oWins >= 0 ? oWins : 0,
      draws: Number.isFinite(draws) && draws >= 0 ? draws : 0,
    };
  } catch {
    return { xWins: 0, oWins: 0, draws: 0 };
  }
}

/**
 * @typedef {{squares:(null|"X"|"O")[], lastMoveIndex: number|null}} HistoryEntry
 */

/**
 * Derive whose turn it is from the board position.
 * Invariant: X always plays first, and players alternate.
 * @param {(null|"X"|"O")[]} squares
 * @returns {"X"|"O"}
 */
function getNextPlayerFromSquares(squares) {
  const xCount = squares.filter((s) => s === PLAYER_X).length;
  const oCount = squares.filter((s) => s === PLAYER_O).length;
  return xCount === oCount ? PLAYER_X : PLAYER_O;
}

/**
 * Pure state transition for the Tic Tac Toe "time travel" flow.
 *
 * Contract:
 * Inputs:
 *  - history: non-empty list of board snapshots. history[0] must be the initial empty board.
 *  - step: integer index into history.
 *  - action: one of:
 *      { type: "MOVE", index: 0..8 }
 *      { type: "JUMP", step: 0..history.length-1 }
 *      { type: "RESTART" }
 * Outputs:
 *  - { history, step } with invariants preserved:
 *      - history non-empty
 *      - step within bounds
 * Errors:
 *  - Never throws; invalid actions are treated as no-ops.
 *
 * Side effects: none (pure).
 *
 * @param {{history: HistoryEntry[], step: number}} state
 * @param {{type:"MOVE", index:number}|{type:"JUMP", step:number}|{type:"RESTART"}} action
 * @returns {{history: HistoryEntry[], step: number}}
 */
function applyTimeTravelAction(state, action) {
  if (!state?.history?.length) {
    return { history: [{ squares: Array(9).fill(null), lastMoveIndex: null }], step: 0 };
  }

  const safeStep = Math.min(Math.max(0, state.step), state.history.length - 1);
  const currentEntry = state.history[safeStep];
  const currentSquares = currentEntry.squares;

  if (action.type === "RESTART") {
    return { history: [{ squares: Array(9).fill(null), lastMoveIndex: null }], step: 0 };
  }

  if (action.type === "JUMP") {
    const nextStep = Number(action.step);
    if (!Number.isInteger(nextStep)) return { history: state.history, step: safeStep };
    if (nextStep < 0 || nextStep >= state.history.length) return { history: state.history, step: safeStep };
    return { history: state.history, step: nextStep };
  }

  if (action.type === "MOVE") {
    const idx = Number(action.index);
    if (!Number.isInteger(idx) || idx < 0 || idx > 8) return { history: state.history, step: safeStep };

    const { winner } = calculateWinner(currentSquares);
    const draw = isDraw(currentSquares);
    const gameOver = Boolean(winner) || draw;
    if (gameOver) return { history: state.history, step: safeStep };

    if (currentSquares[idx] !== null) return { history: state.history, step: safeStep };

    const nextPlayer = getNextPlayerFromSquares(currentSquares);

    // If user time-traveled to the past and makes a move, we discard the "future".
    const truncated = state.history.slice(0, safeStep + 1);
    const nextSquares = currentSquares.slice();
    nextSquares[idx] = nextPlayer;

    const nextHistory = truncated.concat([{ squares: nextSquares, lastMoveIndex: idx }]);
    return { history: nextHistory, step: nextHistory.length - 1 };
  }

  return { history: state.history, step: safeStep };
}

// PUBLIC_INTERFACE
function App() {
  /** Keep the template's theme handling, but default to the style guide's light theme. */
  const [theme, setTheme] = useState("light");

  /** Time-travel state (single canonical flow state). */
  const [timeTravel, setTimeTravel] = useState(() => ({
    history: [{ squares: Array(9).fill(null), lastMoveIndex: null }],
    step: 0,
  }));

  const squares = timeTravel.history[timeTravel.step].squares;

  const [scoreboard, setScoreboard] = useState(() => readScoreboardFromStorage());

  const { winner, line } = useMemo(() => calculateWinner(squares), [squares]);
  const draw = useMemo(() => isDraw(squares), [squares]);

  const nextPlayer = useMemo(() => getNextPlayerFromSquares(squares), [squares]);
  const gameOver = Boolean(winner) || draw;

  const moveCount = timeTravel.step;
  const canUndo = timeTravel.step > 0;

  // ---- Observability (debuggability) ----
  const prevStepRef = useRef(timeTravel.step);
  useEffect(() => {
    // Minimal, consistent tracing for the time travel flow.
    // This is intentionally console-based (no external logging deps).
    const prevStep = prevStepRef.current;
    if (prevStep !== timeTravel.step) {
      // eslint-disable-next-line no-console
      console.debug("[TicTacToeTimeTravelFlow] step_changed", {
        from: prevStep,
        to: timeTravel.step,
        historyLength: timeTravel.history.length,
      });
      prevStepRef.current = timeTravel.step;
    }
  }, [timeTravel.step, timeTravel.history.length]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Persist scoreboard across refreshes.
  useEffect(() => {
    try {
      window.localStorage.setItem(SCOREBOARD_STORAGE_KEY, JSON.stringify(scoreboard));
    } catch {
      // Ignore persistence errors; scoreboard still works in-memory.
    }
  }, [scoreboard]);

  // When the game ends, update scoreboard once per round (per unique final board state).
  const creditedFinalBoardKeyRef = useRef(null);
  useEffect(() => {
    if (!gameOver) {
      creditedFinalBoardKeyRef.current = null;
      return;
    }

    const finalKey = squares.map((s) => s ?? "-").join("");
    if (creditedFinalBoardKeyRef.current === finalKey) return;
    creditedFinalBoardKeyRef.current = finalKey;

    setScoreboard((prev) => {
      if (winner === PLAYER_X) return { ...prev, xWins: prev.xWins + 1 };
      if (winner === PLAYER_O) return { ...prev, oWins: prev.oWins + 1 };
      if (draw) return { ...prev, draws: prev.draws + 1 };
      return prev;
    });
  }, [gameOver, squares, winner, draw]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  // PUBLIC_INTERFACE
  const restartGame = () => {
    setTimeTravel((prev) => applyTimeTravelAction(prev, { type: "RESTART" }));
  };

  // PUBLIC_INTERFACE
  const resetScoreboard = () => {
    const cleared = { xWins: 0, oWins: 0, draws: 0 };
    setScoreboard(cleared);
    try {
      window.localStorage.setItem(SCOREBOARD_STORAGE_KEY, JSON.stringify(cleared));
    } catch {
      // Ignore persistence errors.
    }
  };

  /**
   * Attempt a move at the given index.
   * @param {number} index
   */
  const handleSquareClick = (index) => {
    setTimeTravel((prev) => applyTimeTravelAction(prev, { type: "MOVE", index }));
  };

  // PUBLIC_INTERFACE
  const jumpToMove = (step) => {
    setTimeTravel((prev) => applyTimeTravelAction(prev, { type: "JUMP", step }));
  };

  // PUBLIC_INTERFACE
  const undoMove = () => {
    if (!canUndo) return;
    jumpToMove(timeTravel.step - 1);
  };

  const statusText = winner ? `Winner: ${winner}` : draw ? "Draw" : `Turn: ${nextPlayer}`;

  const statusSubtext = winner
    ? "Press Restart to play again."
    : draw
      ? "No more moves left—press Restart to try again."
      : canUndo
        ? "Tap a square to place your mark, or undo to revisit a prior move."
        : "Tap a square to place your mark.";

  return (
    <div className="App">
      <main className="ttt-shell" aria-label="Tic Tac Toe">
        <header className="ttt-header">
          <div className="ttt-titleRow">
            <div>
              <h1 className="ttt-title">Tic Tac Toe</h1>
              <p className="ttt-subtitle">Minimal 3×3, two players, instant win/draw detection.</p>
            </div>

            <div className="ttt-headerActions">
              <button
                className="ttt-btn ttt-btnSecondary"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                type="button"
              >
                {theme === "light" ? "Dark" : "Light"}
              </button>

              <button className="ttt-btn ttt-btnSecondary" onClick={undoMove} type="button" disabled={!canUndo}>
                Undo
              </button>

              <button className="ttt-btn ttt-btnPrimary" onClick={restartGame} type="button">
                Restart
              </button>
            </div>
          </div>

          <div className="ttt-scoreboard" aria-label="Scoreboard">
            <div className="ttt-scoreItem" aria-label={`X wins: ${scoreboard.xWins}`}>
              <div className="ttt-scoreLabel">
                X <span className="ttt-scoreLabelSub">wins</span>
              </div>
              <div className="ttt-scoreValue">{scoreboard.xWins}</div>
            </div>

            <div className="ttt-scoreItem" aria-label={`O wins: ${scoreboard.oWins}`}>
              <div className="ttt-scoreLabel">
                O <span className="ttt-scoreLabelSub">wins</span>
              </div>
              <div className="ttt-scoreValue">{scoreboard.oWins}</div>
            </div>

            <div className="ttt-scoreItem" aria-label={`Draws: ${scoreboard.draws}`}>
              <div className="ttt-scoreLabel">
                Draws <span className="ttt-scoreLabelSub">total</span>
              </div>
              <div className="ttt-scoreValue">{scoreboard.draws}</div>
            </div>

            <div className="ttt-scoreActions">
              <button className="ttt-btn ttt-btnSecondary ttt-btnSmall" onClick={resetScoreboard} type="button">
                Reset score
              </button>
            </div>
          </div>

          <div className="ttt-status" role="status" aria-live="polite">
            <div className="ttt-statusMain">{statusText}</div>
            <div className="ttt-statusSub">{statusSubtext}</div>
          </div>

          <div className="ttt-history" aria-label="Move history">
            <div className="ttt-historyHeader">
              <div className="ttt-historyTitle">Moves</div>
              <div className="ttt-historyMeta">
                {moveCount === 0 ? "No moves yet." : `${moveCount} move${moveCount === 1 ? "" : "s"} played.`}
              </div>
            </div>

            <ol className="ttt-historyList">
              {timeTravel.history.map((entry, step) => {
                const isCurrent = step === timeTravel.step;
                const label =
                  step === 0
                    ? "Go to start"
                    : entry.lastMoveIndex === null
                      ? `Go to move #${step}`
                      : `Go to move #${step} (square ${entry.lastMoveIndex + 1})`;

                return (
                  <li key={step} className="ttt-historyItem">
                    <button
                      type="button"
                      className={["ttt-btn", "ttt-btnSecondary", "ttt-historyBtn", isCurrent ? "ttt-historyBtnActive" : ""].join(
                        " "
                      )}
                      onClick={() => jumpToMove(step)}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {isCurrent ? "Current: " : ""}
                      {label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </header>

        <section className="ttt-boardWrap" aria-label="Game board">
          <div className="ttt-board" role="grid" aria-label="3 by 3 board">
            {squares.map((value, idx) => {
              const isWinningSquare = line ? line.includes(idx) : false;
              const isDisabled = gameOver || value !== null;

              return (
                <button
                  key={idx}
                  className={[
                    "ttt-square",
                    value ? "ttt-squareFilled" : "",
                    isWinningSquare ? "ttt-squareWin" : "",
                  ].join(" ")}
                  type="button"
                  role="gridcell"
                  aria-label={`Square ${idx + 1}${value ? `, ${value}` : ""}`}
                  onClick={() => handleSquareClick(idx)}
                  disabled={isDisabled}
                >
                  <span className="ttt-squareValue" aria-hidden="true">
                    {value ?? ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <footer className="ttt-footer">
          <div className="ttt-hint">
            {winner ? (
              <span>
                Game over — <strong>{winner}</strong> wins.
              </span>
            ) : draw ? (
              <span>Game over — draw.</span>
            ) : (
              <span>
                Players: <strong>X</strong> and <strong>O</strong>
              </span>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
