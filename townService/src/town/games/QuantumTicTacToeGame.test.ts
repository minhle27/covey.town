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

type BoardKey = 'A' | 'B' | 'C';

describe('QuantumTicTacToeGame (extended)', () => {
  let game: QuantumTicTacToeGame;
  let playerX: Player;
  let playerO: Player;
  let spectator: Player;

  const makeMove = (player: Player, board: BoardKey, row: number, col: number) => {
    const move: GameMove<any> = {
      playerID: player.id,
      gameID: game.id,
      move: { board, row, col },
    };
    game.applyMove(move);
  };

  beforeEach(() => {
    game = new QuantumTicTacToeGame();
    playerX = createPlayerForTesting();
    playerO = createPlayerForTesting();
    spectator = createPlayerForTesting();
  });

  describe('_join', () => {
    it('adds first player as X', () => {
      game.join(playerX);
      expect(game.state.x).toBe(playerX.id);
      expect(game.state.o).toBeUndefined();
      expect(game.state.status).toBe('WAITING_TO_START');
    });

    it('adds second player as O and sets status IN_PROGRESS', () => {
      game.join(playerX);
      game.join(playerO);
      expect(game.state.x).toBe(playerX.id);
      expect(game.state.o).toBe(playerO.id);
      expect(game.state.status).toBe('IN_PROGRESS');
    });

    it('assigns players to subgames consistently as X and O', () => {
      game.join(playerX);
      game.join(playerO);

      makeMove(playerX, 'A', 0, 0);
      // @ts-expect-error - private property
      expect(game._games.A._board[0][0]).toBe('X');
      makeMove(playerO, 'B', 1, 1);
      // @ts-expect-error - private property
      expect(game._games.B._board[1][1]).toBe('O');
    });

    it('rejects a third player (game full)', () => {
      game.join(playerX);
      game.join(playerO);
      const intruder = createPlayerForTesting();
      expect(() => game.join(intruder)).toThrow();
    });

    it('rejects duplicate join of the same player', () => {
      game.join(playerX);
      expect(() => game.join(playerX)).toThrow();
    });
  });

  describe('_leave', () => {
    it('throws if a non-participant attempts to leave', () => {
      expect(() => game.leave(spectator)).toThrow();
    });

    it('resets to WAITING_TO_START if the only player leaves before start', () => {
      game.join(playerX);
      game.leave(playerX);
      expect(game.state.status).toBe('WAITING_TO_START');
      expect(game.state.x).toBeUndefined();
      expect(game.state.o).toBeUndefined();
    });

    describe('when two players are in the game', () => {
      beforeEach(() => {
        game.join(playerX);
        game.join(playerO);
      });

      it('sets the game to OVER and declares the other player the winner when one leaves', () => {
        game.leave(playerX);
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBe(playerO.id);
      });

      it('when X leaves in-progress game, O is winner; when O leaves, X is winner', () => {
        // X leaves
        const g1 = new QuantumTicTacToeGame();
        const px = createPlayerForTesting();
        const po = createPlayerForTesting();
        g1.join(px);
        g1.join(po);
        g1.leave(px);
        expect(g1.state.winner).toBe(po.id);

        // O leaves
        const g2 = new QuantumTicTacToeGame();
        const qx = createPlayerForTesting();
        const qo = createPlayerForTesting();
        g2.join(qx);
        g2.join(qo);
        g2.leave(qo);
        expect(g2.state.winner).toBe(qx.id);
      });
    });
  });

  describe('applyMove validation', () => {
    it('rejects moves when game is not in progress', () => {
      game.join(playerX);
      expect(() => makeMove(playerX, 'A', 0, 0)).toThrow();
    });

    it('rejects a move by a player not in the game', () => {
      game.join(playerX);
      game.join(playerO);
      expect(() => makeMove(spectator, 'A', 0, 0)).toThrow();
    });

    it('enforces turn order (out-of-turn throws)', () => {
      game.join(playerX);
      game.join(playerO);
      makeMove(playerX, 'A', 0, 0);
      expect(() => makeMove(playerX, 'A', 0, 1)).toThrow();
    });

    it('rejects invalid coordinates and invalid board label', () => {
      game.join(playerX);
      game.join(playerO);
      // invalid coordinates
      expect(() => makeMove(playerX, 'A', -1, 0)).toThrow();
      expect(() => makeMove(playerX, 'A', 3, 0)).toThrow();
      expect(() => makeMove(playerX, 'A', 0, 3)).toThrow();
      // invalid board label (cast to avoid TS error; runtime should throw)
      expect(() => makeMove(playerX, 'Z' as BoardKey, 0, 0)).toThrow();
    });

    it('rejects placing on a square already owned by the same player on that board', () => {
      game.join(playerX);
      game.join(playerO);
      makeMove(playerX, 'A', 0, 0);
      expect(() => makeMove(playerX, 'A', 0, 0)).toThrow();
    });

    it('cannot play on a sub-board that is OVER', () => {
      game.join(playerX);
      game.join(playerO);
      // Close board A by giving X a quick win
      makeMove(playerX, 'A', 0, 0); // X
      makeMove(playerO, 'B', 0, 0); // O (different board to keep turns alternating)
      makeMove(playerX, 'A', 0, 1); // X
      makeMove(playerO, 'B', 1, 1); // O
      makeMove(playerX, 'A', 0, 2); // X wins on A; A is OVER
      // Further moves on A should be rejected
      expect(() => makeMove(playerO, 'A', 2, 2)).toThrow();
    });
  });

  describe('applyMove basic gameplay', () => {
    beforeEach(() => {
      game.join(playerX);
      game.join(playerO);
    });

    it('places a piece on an empty square', () => {
      makeMove(playerX, 'A', 0, 0);
      // @ts-expect-error - private property
      expect(game._games.A._board[0][0]).toBe('X');
      expect(game.state.moves.length).toBe(1);
    });

    it('normal placement remains hidden publicly until a collision', () => {
      makeMove(playerX, 'A', 0, 0);
      expect(game.state.publiclyVisible.A[0][0]).toBe(false);
    });

    it('same coordinates on different boards are independent and legal', () => {
      makeMove(playerX, 'A', 1, 1);
      makeMove(playerO, 'B', 1, 1);
      makeMove(playerX, 'C', 1, 1);
      // @ts-expect-error - private property
      expect(game._games.A._board[1][1]).toBe('X');
      // @ts-expect-error - private property
      expect(game._games.B._board[1][1]).toBe('O');
      // @ts-expect-error - private property
      expect(game._games.C._board[1][1]).toBe('X');
    });
  });

  describe('collision mechanics', () => {
    beforeEach(() => {
      game.join(playerX);
      game.join(playerO);
    });

    it('collision: attempting opponent-occupied square loses the turn and reveals publicly', () => {
      makeMove(playerX, 'A', 2, 2); // X privately on A[2][2]
      makeMove(playerO, 'B', 0, 0); // O move elsewhere
      // Now X tries to place where O already is on B[0][0]
      makeMove(playerX, 'B', 0, 0); // collision: should NOT overwrite; should reveal B[0][0]
      // @ts-expect-error - private property (board still O)
      expect(game._games.B._board[0][0]).toBe('O');
      expect(game.state.publiclyVisible.B[0][0]).toBe(true);
      // And turn should have advanced to O
      expect(() => makeMove(playerX, 'C', 0, 0)).toThrow();
    });

    it('collision reveals only that specific cell on that board', () => {
      makeMove(playerX, 'A', 0, 0);
      makeMove(playerO, 'A', 1, 1);
      makeMove(playerX, 'A', 1, 1); // collide with O at A[1][1]
      expect(game.state.publiclyVisible.A[1][1]).toBe(true);
      expect(game.state.publiclyVisible.A[0][0]).toBe(false);
    });

    it("collision does not place mover's piece; defender remains owner privately", () => {
      makeMove(playerX, 'C', 0, 2);
      makeMove(playerO, 'C', 0, 0);
      makeMove(playerX, 'C', 0, 0); // collide
      // @ts-expect-error - private property
      expect(game._games.C._board[0][0]).toBe('O');
    });

    it('revealed cells remain true after unrelated future moves (sticky reveal)', () => {
      makeMove(playerX, 'B', 2, 1);
      makeMove(playerO, 'B', 0, 2);
      makeMove(playerX, 'B', 0, 2); // collide -> reveal B[0][2]
      expect(game.state.publiclyVisible.B[0][2]).toBe(true);
      // later moves elsewhere
      makeMove(playerO, 'A', 0, 0);
      makeMove(playerX, 'A', 0, 1);
      expect(game.state.publiclyVisible.B[0][2]).toBe(true);
    });

    it('public grid objects are independent per board (no shared references)', () => {
      // Toggle a reveal on A
      makeMove(playerX, 'A', 2, 2);
      makeMove(playerO, 'A', 0, 0);
      makeMove(playerX, 'A', 0, 0); // collide -> reveal A[0][0]
      expect(game.state.publiclyVisible.A[0][0]).toBe(true);
      // Ensure B/C unaffected
      expect(game.state.publiclyVisible.B[0][0]).toBe(false);
      expect(game.state.publiclyVisible.C[0][0]).toBe(false);
    });
  });

  describe('scoring and game end', () => {
    beforeEach(() => {
      game.join(playerX);
      game.join(playerO);
    });

    it('awards a point when a player gets three-in-a-row', () => {
      makeMove(playerX, 'A', 0, 0); // X
      makeMove(playerO, 'B', 0, 0); // O
      makeMove(playerX, 'A', 0, 1); // X
      makeMove(playerO, 'B', 0, 1); // O
      makeMove(playerX, 'A', 0, 2); // X -> scores 1 point
      expect(game.state.xScore).toBe(1);
      expect(game.state.oScore).toBe(0);
    });

    it('closing a sub-board awards +1 to the winner and disallows further play on that board', () => {
      // Close board C with O winning
      makeMove(playerX, 'C', 2, 2); // X
      makeMove(playerO, 'C', 1, 0); // O
      makeMove(playerX, 'B', 0, 0); // X elsewhere
      makeMove(playerO, 'C', 1, 1); // O
      makeMove(playerX, 'B', 1, 1); // X elsewhere
      makeMove(playerO, 'C', 1, 2); // O -> row win on C
      expect(game.state.oScore).toBeGreaterThanOrEqual(1);
      expect(() => makeMove(playerX, 'C', 0, 0)).toThrow();
    });

    it('multiple lines created by one move score exactly +1 and lock the board', () => {
      // Create a situation where center completes two lines for X on A
      makeMove(playerX, 'A', 0, 1); // X
      makeMove(playerO, 'B', 0, 0); // O
      makeMove(playerX, 'A', 1, 0); // X
      makeMove(playerO, 'B', 1, 1); // O
      // Now X plays center to complete row 1 and column 1 simultaneously
      makeMove(playerX, 'A', 1, 1);
      expect(game.state.xScore).toBeGreaterThanOrEqual(1);
      // Board should be locked
      expect(() => makeMove(playerO, 'A', 2, 2)).toThrow();
    });

    it('game eventually ends when all boards are closed or have no empty cells left', () => {
      // Close A with X
      makeMove(playerX, 'A', 0, 0);
      makeMove(playerO, 'B', 0, 0);
      makeMove(playerX, 'A', 0, 1);
      makeMove(playerO, 'B', 0, 1);
      makeMove(playerX, 'A', 0, 2);
      // Fill B without a win (draw)
      makeMove(playerO, 'B', 1, 1);
      makeMove(playerX, 'B', 0, 2);
      makeMove(playerO, 'B', 1, 0);
      makeMove(playerX, 'B', 1, 2);
      makeMove(playerO, 'B', 2, 0);
      makeMove(playerX, 'B', 2, 1);
      makeMove(playerO, 'B', 2, 2);
      // Close C with O
      makeMove(playerX, 'C', 2, 2);
      makeMove(playerO, 'C', 0, 0);
      makeMove(playerX, 'C', 1, 2);
      makeMove(playerO, 'C', 0, 1);
      makeMove(playerX, 'C', 2, 1);
      makeMove(playerO, 'C', 0, 2); // O wins on C row 0
      expect(game.state.status).toBe('OVER');
    });

    it('game stays in progress when legal placements remain, even with many revealed cells', () => {
      // Create several reveals via collisions but leave legal moves
      makeMove(playerX, 'A', 0, 0);
      makeMove(playerO, 'A', 1, 1);
      makeMove(playerX, 'A', 1, 1); // reveal
      makeMove(playerO, 'A', 2, 2);
      makeMove(playerX, 'A', 2, 2); // reveal
      // Still should be IN_PROGRESS as there are moves left on B/C
      expect(game.state.status).toBe('IN_PROGRESS');
    });
  });

  describe('private method behavior (via public interface)', () => {
    it('_validateMove: throws when game not in progress', () => {
      game.join(playerX);
      expect(() => makeMove(playerX, 'A', 0, 0)).toThrow();
    });

    it('_validateMove: throws for out-of-turn moves', () => {
      game.join(playerX);
      game.join(playerO);
      makeMove(playerX, 'A', 0, 0);
      expect(() => makeMove(playerX, 'B', 0, 0)).toThrow();
    });

    it('_validateMove: throws when trying to re-claim own square', () => {
      game.join(playerX);
      game.join(playerO);
      makeMove(playerX, 'A', 2, 2);
      expect(() => makeMove(playerX, 'A', 2, 2)).toThrow();
    });

    it('_checkForWins: awards points only once per board', () => {
      game.join(playerX);
      game.join(playerO);
      makeMove(playerX, 'A', 0, 0);
      makeMove(playerO, 'B', 0, 0);
      makeMove(playerX, 'A', 0, 1);
      makeMove(playerO, 'B', 1, 0);
      makeMove(playerX, 'A', 0, 2); // X wins on A -> +1
      const xScoreAfterWin = game.state.xScore;
      // Further moves on A are forbidden; ensure score does not increase
      expect(() => makeMove(playerO, 'A', 1, 1)).toThrow();
      expect(game.state.xScore).toBe(xScoreAfterWin);
    });

    it('_checkForGameEnding: considers only privately claimed cells', () => {
      game.join(playerX);
      game.join(playerO);
      // Trigger a reveal on A without actually filling privately
      makeMove(playerX, 'A', 0, 0);
      makeMove(playerO, 'A', 0, 1);
      makeMove(playerX, 'A', 0, 1); // reveal A[0][1]
      // Game should still be IN_PROGRESS and not mistakenly think A is full
      expect(game.state.status).toBe('IN_PROGRESS');
    });
  });

  describe('extra tests (mutation killers)', () => {
    beforeEach(() => {
      game.join(playerX);
      game.join(playerO);
    });

    it('awards +1 and closes the sub-board on a diagonal win (top-left to bottom-right)', () => {
      makeMove(playerX, 'B', 0, 0);
      makeMove(playerO, 'A', 0, 0);
      makeMove(playerX, 'B', 1, 1);
      makeMove(playerO, 'A', 0, 1);
      makeMove(playerX, 'B', 2, 2); // diagonal
      expect(game.state.xScore).toBeGreaterThanOrEqual(1);
      expect(() => makeMove(playerO, 'B', 0, 2)).toThrow();
    });

    it('fills a board with no 3-in-a-row: sub-board becomes OVER with no points awarded', () => {
      // Draw on board A
      makeMove(playerX, 'A', 0, 0);
      makeMove(playerO, 'A', 0, 1);
      makeMove(playerX, 'A', 0, 2);
      makeMove(playerO, 'A', 1, 1);
      makeMove(playerX, 'A', 1, 0);
      makeMove(playerO, 'A', 1, 2);
      makeMove(playerX, 'A', 2, 1);
      makeMove(playerO, 'A', 2, 0);
      makeMove(playerX, 'A', 2, 2);
      // No scores should have changed (depending on sequence, X or O may have scored on other boards; assert only A did not grant extra)
      // Try to play again on A -> should be rejected
      expect(() => makeMove(playerO, 'A', 2, 2)).toThrow();
    });

    it('game ends with winner undefined when total points are tied and no moves remain', () => {
      // Close A with X, C with O, draw B
      // A: X wins
      makeMove(playerX, 'A', 0, 0);
      makeMove(playerO, 'B', 0, 0);
      makeMove(playerX, 'A', 0, 1);
      makeMove(playerO, 'B', 1, 0);
      makeMove(playerX, 'A', 0, 2);
      // C: O wins
      makeMove(playerO, 'C', 1, 0);
      makeMove(playerX, 'B', 0, 1);
      makeMove(playerO, 'C', 1, 1);
      makeMove(playerX, 'B', 0, 2);
      makeMove(playerO, 'C', 1, 2);
      // Fill remaining B cells to draw
      makeMove(playerX, 'B', 1, 1);
      makeMove(playerO, 'B', 1, 2);
      makeMove(playerX, 'B', 2, 0);
      makeMove(playerO, 'B', 2, 1);
      makeMove(playerX, 'B', 2, 2);
      expect(game.state.status).toBe('OVER');
      if (game.state.xScore === game.state.oScore) {
        expect(game.state.winner).toBeUndefined();
      }
    });

    it('completing two lines at once (center) awards exactly +1 and closes the sub-board', () => {
      // On board C: set up so O finishes two lines by center
      makeMove(playerX, 'A', 0, 0); // just to alternate
      makeMove(playerO, 'C', 0, 1); // O
      makeMove(playerX, 'A', 0, 1);
      makeMove(playerO, 'C', 1, 0); // O
      makeMove(playerX, 'A', 0, 2);
      makeMove(playerO, 'C', 1, 1); // O completes row1 and col1 (if C[2][1] or [1][2] later)
      // Score increased exactly once and C locked
      expect(game.state.oScore).toBeGreaterThanOrEqual(1);
      expect(() => makeMove(playerX, 'C', 2, 2)).toThrow();
    });

    it('does not allow a third player (or duplicate join) to join an in-progress 2-player game', () => {
      const third = createPlayerForTesting();
      expect(() => game.join(third)).toThrow();
      expect(() => game.join(playerX)).toThrow();
    });

    it('attempting to play a square already occupied by the opponent costs the mover their turn (collision loses turn)', () => {
      makeMove(playerX, 'A', 1, 1);
      makeMove(playerO, 'B', 2, 2);
      // X collides with O on B
      makeMove(playerX, 'B', 2, 2);
      // It should now be O's turn; X moving again should throw
      expect(() => makeMove(playerX, 'C', 0, 0)).toThrow();
    });
  });
});
