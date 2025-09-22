import { createPlayerForTesting } from '../../TestUtils';
import InvalidParametersError, {
  BOARD_POSITION_NOT_VALID_MESSAGE,
  GAME_NOT_IN_PROGRESS_MESSAGE,
  INVALID_MOVE_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
} from '../../lib/InvalidParametersError';
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

    it('keeps status WAITING_TO_START until both players have joined', () => {
      game.join(playerX);
      expect(game.state.status).toBe('WAITING_TO_START');
      game.join(playerO);
      expect(game.state.status).toBe('IN_PROGRESS');
    });

    it('when X leaves in-progress game, O is winner; when O leaves, X is winner', () => {
      game.join(playerX);
      game.join(playerO);
      game.leave(playerX);
      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe(playerO.id);

      // fresh game
      game = new QuantumTicTacToeGame();
      playerX = createPlayerForTesting();
      playerO = createPlayerForTesting();
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
      //   makeMove(playerX, 'B', 2, 0); // claim
      //   makeMove(playerO, 'B', 2, 0); // collide
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

describe('QuantumTicTacToeGame (private method tests)', () => {
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

  /* ===================== _validateMove ===================== */

  describe('_validateMove', () => {
    it('throws when game not in progress', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mv: GameMove<any> = {
        playerID: 'nobody',
        gameID: game.id,
        move: { board: 'A', row: 0, col: 0 },
      };
      try {
        (game as any)._validateMove(mv);
        fail('expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidParametersError);
        expect((err as Error).message).toBe(GAME_NOT_IN_PROGRESS_MESSAGE);
      }
    });

    // it('throws for unknown player and out-of-turn, and invalid board/coords', () => {
    //   game.join(playerX);
    //   game.join(playerO);

    //   // unknown player
    //   const stranger = createPlayerForTesting();
    //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //   const unknownMove: GameMove<any> = {
    //     playerID: stranger.id,
    //     gameID: game.id,
    //     move: { board: 'A', row: 0, col: 0 },
    //   };
    //   try {
    //     (game as any)._validateMove(unknownMove);
    //     fail('expected error');
    //   } catch (err) {
    //     expect((err as Error).message).toBe(PLAYER_NOT_IN_GAME_MESSAGE);
    //   }

    //   // out of turn (O tries first)
    //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //   const oFirst: GameMove<any> = {
    //     playerID: playerO.id,
    //     gameID: game.id,
    //     move: { board: 'A', row: 0, col: 0 },
    //   };
    //   try {
    //     (game as any)._validateMove(oFirst);
    //     fail('expected error');
    //   } catch (err) {
    //     expect((err as Error).message).toBe(MOVE_NOT_YOUR_TURN_MESSAGE);
    //   }

    //   // invalid board
    //   // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment
    //   // @ts-ignore
    //   const badBoard: GameMove<any> = {
    //     playerID: playerX.id,
    //     gameID: game.id,
    //     move: { board: 'Z', row: 0, col: 0 },
    //   };
    //   try {
    //     (game as any)._validateMove(badBoard);
    //     fail('expected error');
    //   } catch (err) {
    //     expect((err as Error).message).toBe(BOARD_POSITION_NOT_VALID_MESSAGE);
    //   }

    //   // invalid coords
    //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //   const badCoords: GameMove<any> = {
    //     playerID: playerX.id,
    //     gameID: game.id,
    //     move: { board: 'A', row: -1, col: 3 },
    //   };
    //   try {
    //     (game as any)._validateMove(badCoords);
    //     fail('expected error');
    //   } catch (err) {
    //     expect((err as Error).message).toBe(BOARD_POSITION_NOT_VALID_MESSAGE);
    //   }
    // });

    it('throws when trying to play a square already owned by the same player on that board', () => {
      game.join(playerX);
      game.join(playerO);
      makeMove(playerX, 'A', 1, 1); // claim

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const repeat: GameMove<any> = {
        playerID: playerX.id,
        gameID: game.id,
        move: { board: 'A', row: 1, col: 1 },
      };
      // advance to X’s turn again
      makeMove(playerO, 'B', 0, 0);

      try {
        (game as any)._validateMove(repeat);
        fail('expected error');
      } catch (err) {
        expect((err as Error).message).toBe(INVALID_MOVE_MESSAGE);
      }
    });

    it('throws when attempting to play on a closed sub-board', () => {
      game.join(playerX);
      game.join(playerO);
      // close A with a quick X win
      makeMove(playerX, 'A', 0, 0);
      makeMove(playerO, 'B', 0, 0);
      makeMove(playerX, 'A', 0, 1);
      makeMove(playerO, 'B', 1, 1);
      makeMove(playerX, 'A', 0, 2); // A becomes OVER

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidOnClosed: GameMove<any> = {
        playerID: playerO.id,
        gameID: game.id,
        move: { board: 'A', row: 1, col: 0 },
      };
      try {
        (game as any)._validateMove(invalidOnClosed);
        fail('expected error');
      } catch (err) {
        expect((err as Error).message).toBe(INVALID_MOVE_MESSAGE);
      }
    });
  });

  /* ===================== _checkForWins ===================== */

  describe('_checkForWins', () => {
    beforeEach(() => {
      game.join(playerX);
      game.join(playerO);
    });

    it('awards +1 to X when a subgame is OVER with winner = X and not yet scored', () => {
      // make subgame B appear OVER with X as winner (simulate)
      // @ts-expect-error private access
      const subB = game._games.B;
      const newStateB = {
        ...subB.state,
        status: 'OVER' as const,
        winner: playerX.id,
      };
      // @ts-expect-error override protected
      subB.state = newStateB;

      // scores should be 0 before
      expect(game.state.xScore).toBe(0);
      expect(game.state.oScore).toBe(0);

      // invoke

      (game as any)._checkForWins();

      expect(game.state.xScore).toBe(1);
      expect(game.state.oScore).toBe(0);

      // calling again should not double-count (scoredBoards guard)

      (game as any)._checkForWins();
      expect(game.state.xScore).toBe(1);
    });

    it('awards +1 to O when O is winner; ignores boards already scored', () => {
      // @ts-expect-error private
      const subA = game._games.A;
      // @ts-expect-error override
      subA.state = { ...subA.state, status: 'OVER', winner: playerO.id };

      // first scoring

      (game as any)._checkForWins();
      expect(game.state.oScore).toBe(1);

      // set a second time (should not increment again)
      // @ts-expect-error override
      subA.state = { ...subA.state, status: 'OVER', winner: playerO.id };

      (game as any)._checkForWins();
      expect(game.state.oScore).toBe(1);
    });

    it('does not change scores for OVER board with undefined winner (tie)', () => {
      // @ts-expect-error private
      const subC = game._games.C;
      // @ts-expect-error override
      subC.state = { ...subC.state, status: 'OVER', winner: undefined };

      (game as any)._checkForWins();
      expect(game.state.xScore).toBe(0);
      expect(game.state.oScore).toBe(0);
    });
  });

  /* ===================== _checkForGameEnding ===================== */

  describe('_checkForGameEnding', () => {
    beforeEach(() => {
      game.join(playerX);
      game.join(playerO);
    });

    it('ends the game (OVER) and picks winner by score when no moves remain', () => {
      // give X one scored board (A)
      makeMove(playerX, 'A', 0, 0);
      makeMove(playerO, 'B', 0, 0);
      makeMove(playerX, 'A', 0, 1);
      makeMove(playerO, 'B', 1, 1);
      makeMove(playerX, 'A', 0, 2); // xScore becomes 1

      // now make B and C unplayable by setting them to OVER (ties)
      // @ts-expect-error private
      const subB = game._games.B;
      // @ts-expect-error private
      const subC = game._games.C;

      // @ts-expect-error override
      subB.state = { ...subB.state, status: 'OVER', winner: undefined };
      // @ts-expect-error override
      subC.state = { ...subC.state, status: 'OVER', winner: undefined };

      // and A is already OVER from the win

      // trigger game-end check

      (game as any)._checkForGameEnding();

      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe(game.state.x); // X had higher score
    });

    it('ends in a draw (winner undefined) when scores are equal and no moves remain', () => {
      // close all three boards as ties (no winners), no placements left

      // @ts-expect-error private
      const subA = game._games.A;
      // @ts-expect-error private
      const subB = game._games.B;
      // @ts-expect-error private
      const subC = game._games.C;

      // mark all OVER with no winner
      // @ts-expect-error override
      subA.state = { ...subA.state, status: 'OVER', winner: undefined };
      // @ts-expect-error override
      subB.state = { ...subB.state, status: 'OVER', winner: undefined };
      // @ts-expect-error override
      subC.state = { ...subC.state, status: 'OVER', winner: undefined };

      // scores stay equal at 0–0

      // invoke

      (game as any)._checkForGameEnding();

      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBeUndefined();
    });

    it('does not end while at least one unclaimed cell exists on an open board', () => {
      // ensure at least one open cell: put a single move on A so A is still open with empties
      makeMove(playerX, 'A', 1, 1);

      // mark B and C as OVER to isolate logic to A
      // @ts-expect-error private
      const subB = game._games.B;
      // @ts-expect-error private
      const subC = game._games.C;
      // @ts-expect-error override
      subB.state = { ...subB.state, status: 'OVER', winner: undefined };
      // @ts-expect-error override
      subC.state = { ...subC.state, status: 'OVER', winner: undefined };

      // call ending check — should stay IN_PROGRESS because A still has empties

      (game as any)._checkForGameEnding();
      expect(game.state.status).toBe('IN_PROGRESS');
    });

    it('considers only privately claimed cells (collisions alone do not fill a board)', () => {
      // Create a collision at A(0,0) without adding private claim for mover
      makeMove(playerX, 'A', 0, 0); // claim by X
      makeMove(playerO, 'A', 0, 0); // collision (public reveal only)

      // Close B and C so only A remains; A still has many empty private cells
      // @ts-expect-error private
      const subB = game._games.B;
      // @ts-expect-error private
      const subC = game._games.C;
      // @ts-expect-error override
      subB.state = { ...subB.state, status: 'OVER', winner: undefined };
      // @ts-expect-error override
      subC.state = { ...subC.state, status: 'OVER', winner: undefined };

      // Invoke check — should remain IN_PROGRESS (collision does not mark A as full)

      (game as any)._checkForGameEnding();
      expect(game.state.status).toBe('IN_PROGRESS');
    });
  });
});
