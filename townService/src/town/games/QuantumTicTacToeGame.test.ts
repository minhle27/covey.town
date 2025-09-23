import { createPlayerForTesting } from '../../TestUtils';
import {
  GAME_NOT_IN_PROGRESS_MESSAGE,
  INVALID_MOVE_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
} from '../../lib/InvalidParametersError'; // Assuming these are defined elsewhere
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

  const makeMove = (player: Player, board: 'A' | 'B' | 'C', row: 0 | 1 | 2, col: 0 | 1 | 2) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const move: GameMove<any> = {
      playerID: player.id,
      gameID: game.id, // Assuming game.id is available
      move: { board, row, col },
    };
    game.applyMove(move);
  };

  describe('_join', () => {
    it('should add the first player as X', () => {
      game.join(player1);
      expect(game.state.x).toBe(player1.id);
      expect(game.state.o).toBeUndefined();
      expect(game.state.status).toBe('WAITING_TO_START');
    });

    it('adds second player as O and sets status IN_PROGRESS', () => {
      game.join(player1);
      game.join(player2);
      expect(game.state.x).toBe(player1.id);
      expect(game.state.o).toBe(player2.id);
      expect(game.state.status).toBe('IN_PROGRESS');
    });

    it('assigns players to subgames consistently as X and O', () => {
      game.join(player1);
      game.join(player2);
      for (const label of ['A', 'B', 'C'] as const) {
        // @ts-expect-error private access in tests
        expect(game._games[label].state.x).toBe(player1.id);
        // @ts-expect-error private access in tests
        expect(game._games[label].state.o).toBe(player2.id);
      }
      expect(game.state.status).toBe('IN_PROGRESS');
    });

    it('rejects a third player (game full)', () => {
      const player3 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      expect(() => game.join(player3)).toThrow();
    });

    it('rejects duplicate join of the same player', () => {
      game.join(player1);
      expect(() => game.join(player1)).toThrow();
    });
  });

  describe('_leave', () => {
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

      it('when X leaves in-progress game, O is winner; when O leaves, X is winner', () => {
        game.leave(player1);
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBe(player2.id);

        // fresh game
        const newGame = new QuantumTicTacToeGame();
        const playerX = createPlayerForTesting();
        const playerO = createPlayerForTesting();
        newGame.join(playerX);
        newGame.join(playerO);
        newGame.leave(playerO);
        expect(newGame.state.status).toBe('OVER');
        expect(newGame.state.winner).toBe(playerX.id);
      });
    });
  });

  describe('applyMove', () => {
    beforeEach(() => {
      game.join(player1);
      game.join(player2);
    });

    describe('validation', () => {
      it('rejects moves when game is not in progress', () => {
        const gameNotStarted = new QuantumTicTacToeGame();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bad: GameMove<any> = {
          playerID: 'nobody',
          gameID: gameNotStarted.id,
          move: { board: 'A', row: 0, col: 0 },
        };
        expect(() => gameNotStarted.applyMove(bad)).toThrow();
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

      it('cannot play on a sub-board that is OVER', () => {
        // Win A for X
        makeMove(player1, 'A', 0, 0);
        makeMove(player2, 'B', 0, 0);
        makeMove(player1, 'A', 0, 1);
        makeMove(player2, 'B', 1, 1);
        makeMove(player1, 'A', 0, 2); // A closed

        expect(() => makeMove(player2, 'A', 1, 0)).toThrow();
        makeMove(player2, 'C', 0, 0); // legal elsewhere
        expect(() => makeMove(player1, 'A', 1, 0)).toThrow();
      });
    });

    describe('basic gameplay', () => {
      it('should place a piece on an empty square', () => {
        makeMove(player1, 'A', 0, 0);
        // @ts-expect-error - private property
        expect(game._games.A._board[0][0]).toBe('X');
        expect(game.state.moves.length).toBe(1);
      });

      it('normal placement remains hidden publicly until a collision', () => {
        makeMove(player1, 'C', 2, 2);
        expect(game.state.publiclyVisible.C[2][2]).toBe(false);
      });

      it('same coordinates on different boards are independent and legal', () => {
        makeMove(player1, 'A', 2, 1);
        makeMove(player2, 'B', 0, 0);
        makeMove(player1, 'B', 2, 1);
        makeMove(player2, 'C', 0, 0);
        makeMove(player1, 'C', 2, 1);
        expect(game.state.publiclyVisible.A[2][1]).toBe(false);
        expect(game.state.publiclyVisible.B[2][1]).toBe(false);
        expect(game.state.publiclyVisible.C[2][1]).toBe(false);
      });
    });

    describe('collision mechanics', () => {
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

      it('collision reveals only that specific cell on that board', () => {
        makeMove(player1, 'A', 1, 1);
        expect(game.state.publiclyVisible.A[1][1]).toBe(false);
        makeMove(player2, 'A', 1, 1); // collision
        expect(game.state.publiclyVisible.A[1][1]).toBe(true);
        expect(game.state.publiclyVisible.B[1][1]).toBe(false);
        expect(game.state.publiclyVisible.A[1][0]).toBe(false);
        expect(game.state.publiclyVisible.A[0][1]).toBe(false);
      });

      it("collision does not place mover's piece; defender remains owner privately", () => {
        makeMove(player1, 'B', 0, 2);
        makeMove(player2, 'B', 0, 2); // collide
        // @ts-expect-error private access
        const subMoves = game._games.B.state.moves;
        expect(subMoves.length).toBe(1);
        expect(subMoves[0]).toMatchObject({ row: 0, col: 2, gamePiece: 'X' });
      });

      it('revealed cells remain true after unrelated future moves (sticky reveal)', () => {
        makeMove(player1, 'C', 1, 2);
        makeMove(player2, 'A', 0, 0);
        makeMove(player1, 'A', 0, 1);
        makeMove(player2, 'C', 1, 2); // reveal
        expect(game.state.publiclyVisible.C[1][2]).toBe(true);
        makeMove(player1, 'B', 2, 2);
        makeMove(player2, 'B', 1, 0);
        expect(game.state.publiclyVisible.C[1][2]).toBe(true);
      });

      it('public grid objects are independent per board (no shared references)', () => {
        makeMove(player1, 'A', 0, 1);
        makeMove(player2, 'A', 0, 1); // reveal on A
        expect(game.state.publiclyVisible.A[0][1]).toBe(true);
        expect(game.state.publiclyVisible.B[0][1]).toBe(false);
        expect(game.state.publiclyVisible.C[0][1]).toBe(false);
      });
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

      it('multiple lines created by one move score exactly +1 and lock the board', () => {
        // X corners to enable double-diagonal with center
        makeMove(player1, 'C', 0, 0);
        makeMove(player2, 'A', 0, 0);
        makeMove(player1, 'C', 2, 2);
        makeMove(player2, 'A', 1, 0);
        makeMove(player1, 'C', 0, 2);
        makeMove(player2, 'A', 2, 0);
        makeMove(player1, 'C', 1, 1); // completes both diagonals

        expect(game.state.xScore).toBe(1);
        expect(() => makeMove(player2, 'C', 2, 0)).toThrow(); // locked/closed
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

      it('game stays in progress when legal placements remain, even with many revealed cells', () => {
        makeMove(player1, 'A', 0, 0);
        makeMove(player2, 'A', 0, 0); // reveal
        makeMove(player1, 'A', 1, 1);
        makeMove(player2, 'A', 1, 1); // reveal
        expect(game.state.status).toBe('IN_PROGRESS');
      });
    });

    describe('private method behavior (tested through public interface)', () => {
      it('_validateMove: throws when game not in progress', () => {
        const gameNotStarted = new QuantumTicTacToeGame();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mv: GameMove<any> = {
          playerID: 'nobody',
          gameID: gameNotStarted.id,
          move: { board: 'A', row: 0, col: 0 },
        };
        expect(() => gameNotStarted.applyMove(mv)).toThrow(GAME_NOT_IN_PROGRESS_MESSAGE);
      });

      it('_validateMove: throws for out-of-turn moves', () => {
        // O tries first (should be X's turn)
        expect(() => makeMove(player2, 'A', 0, 0)).toThrow(MOVE_NOT_YOUR_TURN_MESSAGE);
      });

      it('_validateMove: throws when trying to re-claim own square', () => {
        makeMove(player1, 'A', 1, 1); // claim
        makeMove(player2, 'B', 0, 0); // advance to X's turn again
        expect(() => makeMove(player1, 'A', 1, 1)).toThrow(INVALID_MOVE_MESSAGE);
      });

      it('_checkForWins: awards points only once per board', () => {
        // X wins on board A
        makeMove(player1, 'A', 0, 0);
        makeMove(player2, 'B', 0, 0);
        makeMove(player1, 'A', 0, 1);
        makeMove(player2, 'B', 1, 1);
        makeMove(player1, 'A', 0, 2); // X scores

        expect(game.state.xScore).toBe(1);

        // Further moves shouldn't re-award points for board A
        makeMove(player2, 'C', 0, 0);
        makeMove(player1, 'C', 1, 1);
        expect(game.state.xScore).toBe(1); // Still 1, not incremented
      });

      it('_checkForGameEnding: considers only privately claimed cells', () => {
        // Create a collision at A(0,0) without adding private claim for mover
        makeMove(player1, 'A', 0, 0); // claim by X
        makeMove(player2, 'A', 0, 0); // collision (public reveal only)

        // A still has many empty private cells, so game should continue
        expect(game.state.status).toBe('IN_PROGRESS');
      });
    });
  });
});

describe('QuantumTicTacToeGame extra tests (mutation killers)', () => {
  let game: QuantumTicTacToeGame;
  let playerX: Player;
  let playerO: Player;

  const makeMove = (player: Player, board: 'A' | 'B' | 'C', row: 0 | 1 | 2, col: 0 | 1 | 2) => {
    const gamePiece = player.id === playerX.id ? 'X' : 'O';
    const move: GameMove<any> = {
      playerID: player.id,
      gameID: game.id,
      move: { board, row, col, gamePiece },
    };
    game.applyMove(move);
  };

  beforeEach(() => {
    game = new QuantumTicTacToeGame();
    playerX = createPlayerForTesting();
    playerO = createPlayerForTesting();
    game.join(playerX);
    game.join(playerO);
  });

  it('awards +1 and closes the sub-board on a diagonal win (top-left to bottom-right)', () => {
    // X wins diagonally on board B
    makeMove(playerX, 'B', 0, 0); // X
    makeMove(playerO, 'B', 0, 1); // O
    makeMove(playerX, 'B', 1, 1); // X
    makeMove(playerO, 'B', 0, 2); // O
    makeMove(playerX, 'B', 2, 2); // X completes diagonal

    expect(game.state.xScore).toBe(1);
    expect(game.state.oScore).toBe(0);
    // The underlying subgame for B should be closed; further moves on B should be rejected
    expect(() => makeMove(playerO, 'B', 2, 0)).toThrow(INVALID_MOVE_MESSAGE);
  });

  it('fills a board with no 3-in-a-row: sub-board becomes OVER with no points awarded', () => {
    // Fill board C with a draw (no three in a row)
    // Sequence: (0,0),(0,1),(0,2),(1,0),(1,2),(1,1),(2,1),(2,2),(2,0)
    makeMove(playerX, 'C', 0, 0);
    makeMove(playerO, 'C', 0, 1);
    makeMove(playerX, 'C', 0, 2);
    makeMove(playerO, 'C', 1, 0);
    makeMove(playerX, 'C', 1, 2);
    makeMove(playerO, 'C', 1, 1);
    makeMove(playerX, 'C', 2, 1);
    makeMove(playerO, 'C', 2, 2);
    makeMove(playerX, 'C', 2, 0);

    // No points should be awarded for a draw, and further moves on C are invalid
    expect(game.state.xScore + game.state.oScore).toBe(0);
    expect(() => makeMove(playerO, 'C', 1, 2)).toThrow(INVALID_MOVE_MESSAGE);

    // Game as a whole should still be IN_PROGRESS because A and B are open
    expect(game.state.status).toBe('IN_PROGRESS');
  });

  it('game ends with winner undefined when total points are tied and no moves remain', () => {
    // Close A with an X win
    makeMove(playerX, 'A', 0, 0);
    makeMove(playerO, 'A', 0, 1);
    makeMove(playerX, 'A', 1, 1);
    makeMove(playerO, 'A', 0, 2);
    makeMove(playerX, 'A', 2, 2); // X gets diagonal on A (X:1)

    // Close B with an O win
    makeMove(playerO, 'B', 0, 0);
    makeMove(playerX, 'B', 1, 0);
    makeMove(playerO, 'B', 1, 1);
    makeMove(playerX, 'B', 2, 0);
    makeMove(playerO, 'B', 2, 2); // O gets diagonal on B (O:1)

    expect(game.state.xScore).toBe(1);
    expect(game.state.oScore).toBe(1);

    // Fill C as a draw (no winner) so that no moves remain anywhere
    makeMove(playerX, 'C', 0, 0);
    makeMove(playerO, 'C', 0, 1);
    makeMove(playerX, 'C', 0, 2);
    makeMove(playerO, 'C', 1, 0);
    makeMove(playerX, 'C', 1, 2);
    makeMove(playerO, 'C', 1, 1);
    makeMove(playerX, 'C', 2, 1);
    makeMove(playerO, 'C', 2, 2);
    makeMove(playerX, 'C', 2, 0);

    // No legal moves remain -> overall game should be OVER with winner undefined (tie)
    expect(game.state.status).toBe('OVER');
    expect(game.state.winner).toBeUndefined();

    // Any further move should be rejected
    expect(() => makeMove(playerX, 'A', 2, 0)).toThrow(GAME_NOT_IN_PROGRESS_MESSAGE);
  });

  it('completing two lines at once (center) awards exactly +1 and closes the sub-board', () => {
    // Build up so X has row 1: [ (1,0), (1,2) ] and col 1: [ (0,1), (2,1) ]
    // The final center move (1,1) completes BOTH a row and a column simultaneously.
    // Board A
    makeMove(playerX, 'A', 1, 0); // X
    makeMove(playerO, 'A', 0, 0); // O
    makeMove(playerX, 'A', 1, 2); // X
    makeMove(playerO, 'A', 0, 2); // O
    makeMove(playerX, 'A', 0, 1); // X
    makeMove(playerO, 'A', 2, 2); // O
    makeMove(playerX, 'A', 2, 1); // X
    makeMove(playerO, 'A', 2, 0); // O
    // Now X drops center, completing both row and column
    makeMove(playerX, 'A', 1, 1);

    expect(game.state.xScore).toBe(1);
    expect(game.state.oScore).toBe(0);
    // Sub-board A should be closed; any further move on A rejected
    expect(() => makeMove(playerO, 'A', 0, 1)).toThrow(INVALID_MOVE_MESSAGE);
  });

  it('does not allow a third player (or duplicate join) to join an in-progress 2-player game', () => {
    const intruder = createPlayerForTesting();
    // Third player should not be able to join
    expect(() => game.join(intruder)).toThrow();

    // Same player cannot join twice
    const game2 = new QuantumTicTacToeGame();
    const p1 = createPlayerForTesting();
    game2.join(p1);
    expect(() => game2.join(p1)).toThrow();
  });

  it('attempting to play a square already occupied by the opponent costs the mover their turn (collision loses turn)', () => {
    // X plays first at (A,0,0)
    makeMove(playerX, 'A', 0, 0);

    // O attempts to play the *same* square. By game rules: O loses their turn.
    // Implementation should NOT advance O's mark there; whether it throws or not,
    // the key property we assert is: after this attempt, it is X's turn again.
    try {
      makeMove(playerO, 'A', 0, 0);
    } catch {
      // Some implementations may signal this with INVALID_MOVE; that's fine.
    }

    // If O truly lost their turn, X should be able to move immediately without a turn-order error.
    expect(() => makeMove(playerX, 'A', 0, 1)).not.toThrow();

    // And O can then move next.
    expect(() => makeMove(playerO, 'A', 0, 2)).not.toThrow();

    // No points should have been awarded by the collision alone
    expect(game.state.xScore).toBe(0);
    expect(game.state.oScore).toBe(0);
  });
});
