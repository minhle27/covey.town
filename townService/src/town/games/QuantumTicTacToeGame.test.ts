import { createPlayerForTesting } from '../../TestUtils';
import Player from '../../lib/Player';
import { GameMove } from '../../types/CoveyTownSocket';
import QuantumTicTacToeGame from './QuantumTicTacToeGame';

describe('QuantumTicTacToeGame', () => {
  let game: QuantumTicTacToeGame;
  let player1: Player;
  let player2: Player;

  beforeEach(() => {
    game = new QuantumTicTacToeGame();
    player1 = createPlayerForTesting();
    player2 = createPlayerForTesting();
  });

  describe('_join', () => {
    it('should add the first player as X', () => {
      game.join(player1);
      expect(game.state.x).toBe(player1.id);
      expect(game.state.o).toBeUndefined();
      expect(game.state.status).toBe('WAITING_TO_START');
    });
  });

  describe('_leave', () => {
    describe('when two players are in the game', () => {
      beforeEach(() => {
        game.join(player1);
        game.join(player2);
      });

      it('should set the game to OVER and declare the other player the winner', () => {
        game.leave(player1);
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBe(player2.id);
      });
    });
  });

  describe('applyMove', () => {
    beforeEach(() => {
      game.join(player1);
      game.join(player2);
    });

    const makeMove = (player: Player, board: 'A' | 'B' | 'C', row: 0 | 1 | 2, col: 0 | 1 | 2) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const move: GameMove<any> = {
        playerID: player.id,
        gameID: game.id,
        move: { board, row, col },
      };
      game.applyMove(move);
    };

    it('should place a piece on an empty square', () => {
      makeMove(player1, 'A', 0, 0);
      // @ts-expect-error - private property
      expect(game._games.A._board[0][0]).toBe('X');
      expect(game.state.moves.length).toBe(1);
    });

    describe('scoring and game end', () => {
      it('should award a point when a player gets three-in-a-row', () => {
        // X gets a win on board A
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 0, 1); // O
        makeMove(player1, 'A', 0, 2); // X -> scores 1 point

        expect(game.state.xScore).toBe(1);
        expect(game.state.oScore).toBe(0);
      });
    });
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/*                     EXTENDED TESTS — APPEND ONLY                          */
/*        (Covers join, leave, and applyMove behaviors further)              */
/* ────────────────────────────────────────────────────────────────────────── */

describe('QuantumTicTacToeGame (extended)', () => {
  let game: QuantumTicTacToeGame;
  let player1: Player;
  let player2: Player;

  beforeEach(() => {
    game = new QuantumTicTacToeGame();
    player1 = createPlayerForTesting();
    player2 = createPlayerForTesting();
  });

  const makeMove = (player: Player, board: 'A' | 'B' | 'C', row: 0 | 1 | 2, col: 0 | 1 | 2) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const move: GameMove<any> = {
      playerID: player.id,
      gameID: game.id,
      move: { board, row, col },
    };
    game.applyMove(move);
  };

  /* --------------------- JOIN --------------------- */

  describe('_join (extended)', () => {
    it('adds second player as O and sets status IN_PROGRESS', () => {
      game.join(player1);
      game.join(player2);
      expect(game.state.x).toBe(player1.id);
      expect(game.state.o).toBe(player2.id);
      expect(game.state.status).toBe('IN_PROGRESS');
    });

    it('rejects a third player (game full)', () => {
      const p3 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      expect(() => game.join(p3)).toThrow();
    });

    it('rejects duplicate join of the same player', () => {
      game.join(player1);
      expect(() => game.join(player1)).toThrow();
    });
  });

  /* --------------------- LEAVE --------------------- */

  describe('_leave (extended)', () => {
    it('throws if a non-participant attempts to leave', () => {
      const rando = createPlayerForTesting();
      expect(() => game.leave(rando)).toThrow();
    });

    it('resets to WAITING_TO_START if the only player leaves before start', () => {
      game.join(player1);
      game.leave(player1);
      expect(game.state.status).toBe('WAITING_TO_START');
      expect(game.state.x).toBeUndefined();
      expect(game.state.o).toBeUndefined();
      expect(game.state.xScore).toBe(0);
      expect(game.state.oScore).toBe(0);
      for (const board of ['A', 'B', 'C'] as const) {
        expect(game.state.publiclyVisible[board].flat().every(v => v === false)).toBe(true);
      }
    });
  });

  /* ------------------- APPLY MOVE ------------------ */

  describe('applyMove (validation & rules)', () => {
    it('rejects moves when game is not in progress', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bad: GameMove<any> = {
        playerID: 'nobody',
        gameID: game.id,
        move: { board: 'A', row: 0, col: 0 },
      };
      expect(() => game.applyMove(bad)).toThrow();
    });

    describe('with two players joined', () => {
      beforeEach(() => {
        game.join(player1);
        game.join(player2);
      });

      it('rejects a move by a player not in the game', () => {
        const intruder = createPlayerForTesting();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mv: GameMove<any> = {
          playerID: intruder.id,
          gameID: game.id,
          move: { board: 'A', row: 0, col: 0 },
        };
        expect(() => game.applyMove(mv)).toThrow();
      });

      it('enforces turn order (out-of-turn throws)', () => {
        // O tries to start
        expect(() => makeMove(player2, 'A', 0, 0)).toThrow();
        // Now valid order
        makeMove(player1, 'A', 0, 0);
        makeMove(player2, 'B', 0, 0);
      });

      it('rejects invalid coordinates and invalid board label', () => {
        // @ts-expect-error testing bounds
        expect(() => makeMove(player1, 'A', -1, 0)).toThrow();
        // @ts-expect-error testing bounds
        expect(() => makeMove(player1, 'A', 0, 3)).toThrow();
        // @ts-expect-error invalid board id
        expect(() => makeMove(player1, 'Z', 0, 0)).toThrow();
      });

      it('rejects placing on a square already owned by the same player on that board', () => {
        makeMove(player1, 'A', 1, 1); // X
        makeMove(player2, 'B', 0, 0); // O (advance turn)
        expect(() => makeMove(player1, 'A', 1, 1)).toThrow();
      });

      it('collision: attempting opponent-occupied square loses the turn and reveals publicly', () => {
        // X claims A(0,0)
        makeMove(player1, 'A', 0, 0);
        expect(game.state.publiclyVisible.A[0][0]).toBe(false);

        // O tries same square on A → collision, reveal
        makeMove(player2, 'A', 0, 0);
        expect(game.state.publiclyVisible.A[0][0]).toBe(true);

        // Turn advanced back to X (so X can act now)
        expect(() => makeMove(player1, 'A', 0, 1)).not.toThrow();
        // Moves log increments even on collision
        expect(game.state.moves.length).toBe(3);
      });

      it('simple placement does not reveal publicly (stays false) until a collision occurs', () => {
        makeMove(player1, 'B', 2, 2);
        expect(game.state.publiclyVisible.B[2][2]).toBe(false);
      });

      it('closing a sub-board awards +1 to the winner and disallows further play on that board', () => {
        // X wins on A top row
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 1, 1); // O
        makeMove(player1, 'A', 0, 2); // X scores

        expect(game.state.xScore).toBe(1);
        expect(game.state.oScore).toBe(0);

        // Now any attempt to play on A should throw
        expect(() => makeMove(player2, 'A', 1, 0)).toThrow();
        // Advance a legal move elsewhere, then X also should be blocked on A
        makeMove(player2, 'C', 0, 0);
        expect(() => makeMove(player1, 'A', 1, 0)).toThrow();
      });

      it('game eventually ends when all boards are closed or have no empty cells left', () => {
        // Helper to try to fill a board without caring about winners,
        // skipping any invalid attempts along the way.
        const tryFill = (label: 'A' | 'B' | 'C') => {
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              if (game.state.status === 'OVER') return;
              const current = game.state.moves.length % 2 === 0 ? player1 : player2;
              try {
                makeMove(current, label, r as 0 | 1 | 2, c as 0 | 1 | 2);
              } catch {
                // ignore invalid/closed/collision-only attempts
              }
            }
          }
        };

        tryFill('A');
        tryFill('B');
        tryFill('C');

        expect(['OVER', 'IN_PROGRESS']).toContain(game.state.status);
        if (game.state.status !== 'OVER') {
          // If still not over, do a second pass to mop up remaining legal placements
          tryFill('A');
          tryFill('B');
          tryFill('C');
        }

        expect(game.state.status).toBe('OVER');
        // Winner is consistent with scores; tie means no winner
        if (game.state.xScore === game.state.oScore) {
          expect(game.state.winner).toBeUndefined();
        } else if (game.state.xScore > game.state.oScore) {
          expect(game.state.winner).toBe(game.state.x);
        } else {
          expect(game.state.winner).toBe(game.state.o);
        }
      });

      it('public reveal is sticky: once revealed true, it stays true', () => {
        makeMove(player1, 'C', 1, 1); // place
        makeMove(player2, 'B', 0, 0); // advance
        makeMove(player1, 'C', 0, 0); // place
        makeMove(player2, 'C', 1, 1); // collide at (1,1) → reveal
        expect(game.state.publiclyVisible.C[1][1]).toBe(true);

        // Further moves elsewhere shouldn't unset it
        makeMove(player1, 'A', 2, 2);
        expect(game.state.publiclyVisible.C[1][1]).toBe(true);
      });
    });
  });
});

describe('QuantumTicTacToeGame (extended 2)', () => {
  let game: QuantumTicTacToeGame;
  let playerX: Player;
  let playerO: Player;

  beforeEach(() => {
    game = new QuantumTicTacToeGame();
    playerX = createPlayerForTesting();
    playerO = createPlayerForTesting();
  });

  const makeMove = (player: Player, board: 'A' | 'B' | 'C', row: 0 | 1 | 2, col: 0 | 1 | 2) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const move: GameMove<any> = { playerID: player.id, gameID: game.id, move: { board, row, col } };
    game.applyMove(move);
  };

  /* ------------------- APPLY MOVE ------------------ */

  describe('applyMove (validation & rules)', () => {
    it('rejects moves when not in progress', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidMove: GameMove<any> = {
        playerID: 'none',
        gameID: game.id,
        move: { board: 'A', row: 0, col: 0 },
      };
      expect(() => game.applyMove(invalidMove)).toThrow();
    });

    describe('with two players joined', () => {
      beforeEach(() => {
        game.join(playerX);
        game.join(playerO);
      });

      it('enforces turn order; errors do not advance turn', () => {
        expect(() => makeMove(playerO, 'A', 0, 0)).toThrow(); // out of turn
        expect(() => makeMove(playerX, 'A', 0, 0)).not.toThrow(); // still X turn and valid
      });

      // it('rejects invalid coordinates and invalid board label', () => {
      //   // @ts-expect-error bounds
      //   expect(() => makeMove(playerX, 'A', -1, 0)).toThrow();
      //   // @ts-expect-error bounds
      //   expect(() => makeMove(playerX, 'A', 0, 3)).toThrow();
      //   // @ts-expect-error invalid board
      //   expect(() => makeMove(playerX, 'Z', 0, 0)).toThrow();
      // });

      it('cannot play on a sub-board that is OVER for any player', () => {
        // Win A for X
        makeMove(playerX, 'A', 0, 0);
        makeMove(playerO, 'B', 0, 0);
        makeMove(playerX, 'A', 0, 1);
        makeMove(playerO, 'B', 1, 1);
        makeMove(playerX, 'A', 0, 2); // A closed

        expect(() => makeMove(playerO, 'A', 1, 0)).toThrow();
        makeMove(playerO, 'C', 0, 0); // legal elsewhere
        expect(() => makeMove(playerX, 'A', 1, 0)).toThrow();
      });

      // it('placing on your own already-owned square throws and does not change turn', () => {
      //   makeMove(playerX, 'B', 1, 1); // X
      //   // keep it O's turn with a valid move
      //   makeMove(playerO, 'C', 0, 0);
      //   // back to X; repeat on same cell should throw
      //   expect(() => makeMove(playerX, 'B', 1, 1)).toThrow();
      //   // still O's turn after exception
      //   expect(() => makeMove(playerO, 'B', 0, 1)).not.toThrow();
      // });

      it('normal placement remains hidden publicly until a collision', () => {
        makeMove(playerX, 'C', 2, 2);
        expect(game.state.publiclyVisible.C[2][2]).toBe(false);
      });

      it('collision reveals only that specific cell on that board', () => {
        makeMove(playerX, 'A', 1, 1);
        expect(game.state.publiclyVisible.A[1][1]).toBe(false);
        makeMove(playerO, 'A', 1, 1); // collision
        expect(game.state.publiclyVisible.A[1][1]).toBe(true);
        expect(game.state.publiclyVisible.B[1][1]).toBe(false);
        expect(game.state.publiclyVisible.A[1][0]).toBe(false);
        expect(game.state.publiclyVisible.A[0][1]).toBe(false);
      });

      // it('repeated collisions on a revealed cell advance turns but do not modify subgame', () => {
      //   makeMove(playerX, 'A', 0, 0);   // claim
      //   makeMove(playerO, 'A', 0, 0);   // reveal
      //   // @ts-expect-error private access
      //   const moveCountBefore = game._games.A.state.moves.length; // should be 1
      //   makeMove(playerX, 'A', 0, 0);   // collide again
      //   // @ts-expect-error private access
      //   expect(game._games.A.state.moves.length).toBe(moveCountBefore);
      //   expect(game.state.publiclyVisible.A[0][0]).toBe(true);
      // });

      // it('collision does not place mover’s piece; defender remains owner privately', () => {
      //   makeMove(playerX, 'B', 0, 2);
      //   makeMove(playerO, 'B', 0, 2); // collide
      //   // @ts-expect-error private access
      //   const subMoves = game._games.B.state.moves;
      //   expect(subMoves.length).toBe(1);
      //   expect(subMoves[0]).toMatchObject({ row: 0, col: 2, gamePiece: 'X' });
      // });

      // it('multiple lines created by one move score exactly +1 and lock the board', () => {
      //   // X corners to enable double-diagonal with center
      //   makeMove(playerX, 'C', 0, 0);
      //   makeMove(playerO, 'A', 0, 0);
      //   makeMove(playerX, 'C', 2, 2);
      //   makeMove(playerO, 'A', 1, 0);
      //   makeMove(playerX, 'C', 0, 2);
      //   makeMove(playerO, 'A', 2, 0);
      //   makeMove(playerX, 'C', 1, 1); // completes both diagonals

      //   expect(game.state.xScore).toBe(1);
      //   expect(() => makeMove(playerO, 'C', 2, 0)).toThrow(); // locked/closed
      // });

      // it('same coordinates on different boards are independent and legal', () => {
      //   makeMove(playerX, 'A', 2, 1);
      //   makeMove(playerO, 'B', 0, 0);
      //   makeMove(playerX, 'B', 2, 1);
      //   makeMove(playerO, 'C', 0, 0);
      //   makeMove(playerX, 'C', 2, 1);
      //   expect(game.state.publiclyVisible.A[2][1]).toBe(false);
      //   expect(game.state.publiclyVisible.B[2][1]).toBe(false);
      //   expect(game.state.publiclyVisible.C[2][1]).toBe(false);
      // });

      // it('public grid objects are independent per board (no shared references)', () => {
      //   makeMove(playerX, 'A', 0, 1);
      //   makeMove(playerO, 'A', 0, 1); // reveal on A
      //   expect(game.state.publiclyVisible.A[0][1]).toBe(true);
      //   expect(game.state.publiclyVisible.B[0][1]).toBe(false);
      //   expect(game.state.publiclyVisible.C[0][1]).toBe(false);
      // });

      // it('error does not advance turn (turn integrity)', () => {
      //   // @ts-expect-error force invalid
      //   expect(() => makeMove(playerX, 'A', 0, 99)).toThrow();
      //   expect(() => makeMove(playerX, 'A', 1, 1)).not.toThrow(); // still X turn
      // });

      it('game stays in progress when legal placements remain, even with many revealed cells', () => {
        makeMove(playerX, 'A', 0, 0);
        makeMove(playerO, 'A', 0, 0); // reveal
        makeMove(playerX, 'A', 1, 1);
        makeMove(playerO, 'A', 1, 1); // reveal
        expect(game.state.status).toBe('IN_PROGRESS');
      });

      it('game ends when no unclaimed cells remain across all open boards', () => {
        const tryFill = (label: 'A' | 'B' | 'C') => {
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
              if (game.state.status === 'OVER') return;
              const currentPlayer = game.state.moves.length % 2 === 0 ? playerX : playerO;
              try {
                makeMove(currentPlayer, label, row as 0 | 1 | 2, col as 0 | 1 | 2);
              } catch {
                // ignore
              }
            }
          }
        };

        tryFill('A');
        tryFill('B');
        tryFill('C');
        if (game.state.status !== 'OVER') {
          tryFill('A');
          tryFill('B');
          tryFill('C');
        }

        expect(game.state.status).toBe('OVER');
        if (game.state.xScore === game.state.oScore) {
          expect(game.state.winner).toBeUndefined();
        } else if (game.state.xScore > game.state.oScore) {
          expect(game.state.winner).toBe(game.state.x);
        } else {
          expect(game.state.winner).toBe(game.state.o);
        }
      });

      // it('moves log records collision attempts with board/coords; subgame not mutated', () => {
      //   makeMove(playerX, 'B', 2, 0);     // claim
      //   makeMove(playerO, 'B', 2, 0);     // collide
      //   const lastMove = game.state.moves[game.state.moves.length - 1];
      //   expect(lastMove).toEqual({ board: 'B', row: 2, col: 0 });
      //   // @ts-expect-error private access
      //   expect(game._games.B.state.moves.length).toBe(1);
      // });

      it('revealed cells remain true after unrelated future moves (sticky reveal)', () => {
        makeMove(playerX, 'C', 1, 2);
        makeMove(playerO, 'A', 0, 0);
        makeMove(playerX, 'A', 0, 1);
        makeMove(playerO, 'C', 1, 2); // reveal
        expect(game.state.publiclyVisible.C[1][2]).toBe(true);
        makeMove(playerX, 'B', 2, 2);
        makeMove(playerO, 'B', 1, 0);
        expect(game.state.publiclyVisible.C[1][2]).toBe(true);
      });
    });
  });
});
