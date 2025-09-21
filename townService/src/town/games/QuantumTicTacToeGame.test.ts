import { createPlayerForTesting } from '../../TestUtils';
import Player from '../../lib/Player';
import { GameMove, QuantumTicTacToeMove } from '../../types/CoveyTownSocket';
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

    it('should add the second player as O and start the game', () => {
      game.join(player1);
      game.join(player2);
      expect(game.state.x).toBe(player1.id);
      expect(game.state.o).toBe(player2.id);
      expect(game.state.status).toBe('IN_PROGRESS');
    });

    it('should throw error if player tries to join when game is full', () => {
      const player3 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      expect(() => game.join(player3)).toThrow('Game is full');
    });

    it('should throw error if player tries to join when already in game', () => {
      game.join(player1);
      expect(() => game.join(player1)).toThrow('Player is already in this game');
    });

    it('should join players to all three subgames', () => {
      game.join(player1);
      game.join(player2);

      // @ts-expect-error - accessing private property for testing
      expect(game._games.A.state.x).toBe(player1.id);
      // @ts-expect-error - accessing private property for testing
      expect(game._games.A.state.o).toBe(player2.id);
      // @ts-expect-error - accessing private property for testing
      expect(game._games.B.state.x).toBe(player1.id);
      // @ts-expect-error - accessing private property for testing
      expect(game._games.B.state.o).toBe(player2.id);
      // @ts-expect-error - accessing private property for testing
      expect(game._games.C.state.x).toBe(player1.id);
      // @ts-expect-error - accessing private property for testing
      expect(game._games.C.state.o).toBe(player2.id);
    });
  });

  describe('_leave', () => {
    describe('when only one player is in the game', () => {
      beforeEach(() => {
        game.join(player1);
      });

      it('should reset the game state when first player leaves', () => {
        game.leave(player1);
        expect(game.state.x).toBeUndefined();
        expect(game.state.o).toBeUndefined();
        expect(game.state.status).toBe('WAITING_TO_START');
        expect(game.state.moves).toEqual([]);
        expect(game.state.xScore).toBe(0);
        expect(game.state.oScore).toBe(0);
      });

      it('should throw error if player not in game tries to leave', () => {
        expect(() => game.leave(player2)).toThrow('Player is not in this game');
      });
    });

    describe('when two players are in the game', () => {
      beforeEach(() => {
        game.join(player1);
        game.join(player2);
      });

      it('should set the game to OVER and declare the other player the winner when X leaves', () => {
        game.leave(player1);
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBe(player2.id);
      });

      it('should set the game to OVER and declare the other player the winner when O leaves', () => {
        game.leave(player2);
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBe(player1.id);
      });

      it('should throw error if player not in game tries to leave', () => {
        const player3 = createPlayerForTesting();
        expect(() => game.leave(player3)).toThrow('Player is not in this game');
      });

      it('should remove players from all three subgames when leaving', () => {
        game.leave(player1);

        // @ts-expect-error - accessing private property for testing
        expect(game._games.A.state.status).toBe('OVER');
        // @ts-expect-error - accessing private property for testing
        expect(game._games.A.state.winner).toBe(player2.id);
        // @ts-expect-error - accessing private property for testing
        expect(game._games.B.state.status).toBe('OVER');
        // @ts-expect-error - accessing private property for testing
        expect(game._games.B.state.winner).toBe(player2.id);
        // @ts-expect-error - accessing private property for testing
        expect(game._games.C.state.status).toBe('OVER');
        // @ts-expect-error - accessing private property for testing
        expect(game._games.C.state.winner).toBe(player2.id);
      });
    });
  });

  describe('applyMove', () => {
    beforeEach(() => {
      game.join(player1);
      game.join(player2);
    });

    const makeMove = (player: Player, board: 'A' | 'B' | 'C', row: 0 | 1 | 2, col: 0 | 1 | 2) => {
      const move: GameMove<QuantumTicTacToeMove> = {
        playerID: player.id,
        gameID: game.id,
        move: { gamePiece: player.id === player1.id ? 'X' : 'O', board, row, col },
      };
      game.applyMove(move);
    };

    it('should place a piece on an empty square', () => {
      makeMove(player1, 'A', 0, 0);
      // Check that the move was recorded in the quantum game state
      expect(game.state.moves.length).toBe(1);
      expect(game.state.moves[0].board).toBe('A');
      expect(game.state.moves[0].row).toBe(0);
      expect(game.state.moves[0].col).toBe(0);
      // Check that the subgame has the move
      // @ts-expect-error - accessing private property for testing
      expect(game._games.A.state.moves.length).toBe(1);
      // @ts-expect-error - accessing private property for testing
      expect(game._games.A.state.moves[0].gamePiece).toBe('X');
    });

    it('should validate game is in progress before allowing moves', () => {
      const game2 = new QuantumTicTacToeGame();
      const makeMove2 = (
        player: Player,
        board: 'A' | 'B' | 'C',
        row: 0 | 1 | 2,
        col: 0 | 1 | 2,
      ) => {
        const move: GameMove<QuantumTicTacToeMove> = {
          playerID: player.id,
          gameID: game2.id,
          move: { gamePiece: 'X', board, row, col },
        };
        game2.applyMove(move);
      };
      expect(() => makeMove2(player1, 'A', 0, 0)).toThrow('Game is not in progress');
    });

    it('should validate player is in the game', () => {
      const player3 = createPlayerForTesting();
      expect(() => makeMove(player3, 'A', 0, 0)).toThrow('Player is not in this game');
    });

    it('should validate board position bounds', () => {
      // @ts-expect-error - testing invalid row
      expect(() => makeMove(player1, 'A', -1, 0)).toThrow('Board position is not valid');
      // @ts-expect-error - testing invalid row
      expect(() => makeMove(player1, 'A', 3, 0)).toThrow('Board position is not valid');
      // @ts-expect-error - testing invalid col
      expect(() => makeMove(player1, 'A', 0, -1)).toThrow('Board position is not valid');
      // @ts-expect-error - testing invalid col
      expect(() => makeMove(player1, 'A', 0, 3)).toThrow('Board position is not valid');
    });

    it('should validate board selection', () => {
      // @ts-expect-error - testing invalid board
      expect(() => makeMove(player1, 'D', 0, 0)).toThrow('Board position is not valid');
    });

    it('should validate turn order', () => {
      makeMove(player1, 'A', 0, 0); // X's turn
      expect(() => makeMove(player1, 'A', 0, 1)).toThrow('Not your turn'); // X tries again
    });

    it('should prevent moves on already occupied squares', () => {
      makeMove(player1, 'A', 0, 0); // X
      expect(() => makeMove(player2, 'A', 0, 0)).toThrow('Board position is not empty');
    });

    it('should prevent moves on completed boards', () => {
      // Complete board A with X winning
      makeMove(player1, 'A', 0, 0); // X
      makeMove(player2, 'B', 0, 0); // O
      makeMove(player1, 'A', 0, 1); // X
      makeMove(player2, 'B', 0, 1); // O
      makeMove(player1, 'A', 0, 2); // X wins board A

      expect(() => makeMove(player2, 'A', 1, 0)).toThrow('Cannot play on a completed board');
    });

    describe('collision detection', () => {
      it('should make squares publicly visible when both players occupy the same position', () => {
        makeMove(player1, 'A', 0, 0); // X on board A
        makeMove(player2, 'B', 0, 0); // O on board B - collision!

        expect(game.state.publiclyVisible.A[0][0]).toBe(true);
        expect(game.state.publiclyVisible.B[0][0]).toBe(true);
      });

      it('should handle collisions across all boards', () => {
        makeMove(player1, 'A', 1, 1); // X on board A
        makeMove(player2, 'C', 1, 1); // O on board C - collision!

        expect(game.state.publiclyVisible.A[1][1]).toBe(true);
        expect(game.state.publiclyVisible.C[1][1]).toBe(true);
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

      it('should award points for wins on different boards', () => {
        // X wins board A
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 0, 1); // O
        makeMove(player1, 'A', 0, 2); // X wins board A

        // O wins board B
        makeMove(player2, 'B', 1, 0); // O
        makeMove(player1, 'C', 0, 0); // X
        makeMove(player2, 'B', 1, 1); // O
        makeMove(player1, 'C', 0, 1); // X
        makeMove(player2, 'B', 1, 2); // O wins board B

        expect(game.state.xScore).toBe(1);
        expect(game.state.oScore).toBe(1);
      });

      it('should make entire board visible when someone wins', () => {
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 0, 1); // O
        makeMove(player1, 'A', 0, 2); // X wins board A

        // All squares on board A should be visible
        expect(game.state.publiclyVisible.A).toEqual([
          [true, true, true],
          [true, true, true],
          [true, true, true],
        ]);
      });
    });
  });
});
