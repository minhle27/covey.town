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

  /* --------------------- JOIN --------------------- */

  describe('_join (extended)', () => {
    it('assigns players to subgames consistently as X and O', () => {
      game.join(playerX);
      game.join(playerO);
      for (const label of ['A', 'B', 'C'] as const) {
        // @ts-expect-error private access in tests
        expect(game._games[label].state.x).toBe(playerX.id);
        // @ts-expect-error private access in tests
        expect(game._games[label].state.o).toBe(playerO.id);
      }
      expect(game.state.status).toBe('IN_PROGRESS');
    });

    it('rejects a third player and duplicate joins', () => {
      const extraPlayer = createPlayerForTesting();
      game.join(playerX);
      game.join(playerO);
      expect(() => game.join(extraPlayer)).toThrow();
      expect(() => game.join(playerX)).toThrow();
    });
  });

  /* --------------------- LEAVE --------------------- */

  describe('_leave (extended)', () => {
    it('throws if a non-participant tries to leave', () => {
      const stranger = createPlayerForTesting();
      expect(() => game.leave(stranger)).toThrow();
    });

    it('single-player leave resets state and public visibility', () => {
      game.join(playerX);
      game.leave(playerX);
      expect(game.state.status).toBe('WAITING_TO_START');
      expect(game.state.x).toBeUndefined();
      expect(game.state.o).toBeUndefined();
      expect(game.state.xScore).toBe(0);
      expect(game.state.oScore).toBe(0);
      for (const label of ['A', 'B', 'C'] as const) {
        expect(game.state.publiclyVisible[label].flat().every(val => val === false)).toBe(true);
      }
    });

    it('with two players, leaving declares the other player winner', () => {
      game.join(playerX);
      game.join(playerO);
      game.leave(playerO);
      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe(playerX.id);
    });
  });

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

      it('rejects invalid coordinates and invalid board label', () => {
        // @ts-expect-error bounds
        expect(() => makeMove(playerX, 'A', -1, 0)).toThrow();
        // @ts-expect-error bounds
        expect(() => makeMove(playerX, 'A', 0, 3)).toThrow();
        // @ts-expect-error invalid board
        expect(() => makeMove(playerX, 'Z', 0, 0)).toThrow();
      });

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

      it('collision does not place mover’s piece; defender remains owner privately', () => {
        makeMove(playerX, 'B', 0, 2);
        makeMove(playerO, 'B', 0, 2); // collide
        // @ts-expect-error private access
        const subMoves = game._games.B.state.moves;
        expect(subMoves.length).toBe(1);
        expect(subMoves[0]).toMatchObject({ row: 0, col: 2, gamePiece: 'X' });
      });

      it('multiple lines created by one move score exactly +1 and lock the board', () => {
        // X corners to enable double-diagonal with center
        makeMove(playerX, 'C', 0, 0);
        makeMove(playerO, 'A', 0, 0);
        makeMove(playerX, 'C', 2, 2);
        makeMove(playerO, 'A', 1, 0);
        makeMove(playerX, 'C', 0, 2);
        makeMove(playerO, 'A', 2, 0);
        makeMove(playerX, 'C', 1, 1); // completes both diagonals

        expect(game.state.xScore).toBe(1);
        expect(() => makeMove(playerO, 'C', 2, 0)).toThrow(); // locked/closed
      });

      it('same coordinates on different boards are independent and legal', () => {
        makeMove(playerX, 'A', 2, 1);
        makeMove(playerO, 'B', 0, 0);
        makeMove(playerX, 'B', 2, 1);
        makeMove(playerO, 'C', 0, 0);
        makeMove(playerX, 'C', 2, 1);
        expect(game.state.publiclyVisible.A[2][1]).toBe(false);
        expect(game.state.publiclyVisible.B[2][1]).toBe(false);
        expect(game.state.publiclyVisible.C[2][1]).toBe(false);
      });

      it('public grid objects are independent per board (no shared references)', () => {
        makeMove(playerX, 'A', 0, 1);
        makeMove(playerO, 'A', 0, 1); // reveal on A
        expect(game.state.publiclyVisible.A[0][1]).toBe(true);
        expect(game.state.publiclyVisible.B[0][1]).toBe(false);
        expect(game.state.publiclyVisible.C[0][1]).toBe(false);
      });

      it('error does not advance turn (turn integrity)', () => {
        // @ts-expect-error force invalid
        expect(() => makeMove(playerX, 'A', 0, 99)).toThrow();
        expect(() => makeMove(playerX, 'A', 1, 1)).not.toThrow(); // still X turn
      });

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

      it('moves log records collision attempts with board/coords; subgame not mutated', () => {
        makeMove(playerX, 'B', 2, 0); // claim
        makeMove(playerO, 'B', 2, 0); // collide
        const lastMove = game.state.moves[game.state.moves.length - 1];
        expect(lastMove).toEqual({ board: 'B', row: 2, col: 0 });
        // @ts-expect-error private access
        expect(game._games.B.state.moves.length).toBe(1);
      });

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
