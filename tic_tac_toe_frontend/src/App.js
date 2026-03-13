import React, { useEffect, useMemo, useState } from "react";
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

// PUBLIC_INTERFACE
function App() {
  /** Keep the template's theme handling, but default to the style guide's light theme. */
  const [theme, setTheme] = useState("light");

  const [squares, setSquares] = useState(Array(9).fill(null));
  const [nextPlayer, setNextPlayer] = useState(PLAYER_X);

  const [scoreboard, setScoreboard] = useState(() => readScoreboardFromStorage());

  const { winner, line } = useMemo(() => calculateWinner(squares), [squares]);
  const draw = useMemo(() => isDraw(squares), [squares]);

  const gameOver = Boolean(winner) || draw;

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

  // When the game ends, update scoreboard once per round.
  useEffect(() => {
    if (!gameOver) return;

    setScoreboard((prev) => {
      if (winner === PLAYER_X) return { ...prev, xWins: prev.xWins + 1 };
      if (winner === PLAYER_O) return { ...prev, oWins: prev.oWins + 1 };
      if (draw) return { ...prev, draws: prev.draws + 1 };
      return prev;
    });
    // We intentionally depend on "gameOver" to avoid double increments;
    // winner/draw are derived from squares and stable for the final position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  // PUBLIC_INTERFACE
  const restartGame = () => {
    setSquares(Array(9).fill(null));
    setNextPlayer(PLAYER_X);
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
    if (gameOver) return;
    if (squares[index] !== null) return;

    setSquares((prev) => {
      const next = prev.slice();
      next[index] = nextPlayer;
      return next;
    });

    setNextPlayer((p) => (p === PLAYER_X ? PLAYER_O : PLAYER_X));
  };

  const statusText = winner ? `Winner: ${winner}` : draw ? "Draw" : `Turn: ${nextPlayer}`;

  const statusSubtext = winner
    ? "Press Restart to play again."
    : draw
      ? "No more moves left—press Restart to try again."
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
              <button
                className="ttt-btn ttt-btnSecondary ttt-btnSmall"
                onClick={resetScoreboard}
                type="button"
              >
                Reset score
              </button>
            </div>
          </div>

          <div className="ttt-status" role="status" aria-live="polite">
            <div className="ttt-statusMain">{statusText}</div>
            <div className="ttt-statusSub">{statusSubtext}</div>
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
