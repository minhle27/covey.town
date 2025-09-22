import {
  GameMove,
  QuantumTicTacToeGameState,
  QuantumTicTacToeMove,
  TicTacToeMove,
} from '../../types/CoveyTownSocket';
import Game from './Game';
import TicTacToeGame from './TicTacToeGame';
import Player from '../../lib/Player';
import InvalidParametersError, {
  GAME_FULL_MESSAGE,
  PLAYER_ALREADY_IN_GAME_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
  GAME_NOT_IN_PROGRESS_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
  BOARD_POSITION_NOT_VALID_MESSAGE,
  INVALID_MOVE_MESSAGE,
} from '../../lib/InvalidParametersError';

/**
 * A QuantumTicTacToeGame is a Game that implements the rules of the Tic-Tac-Toe variant described at https://www.smbc-comics.com/comic/tic.
 * This class acts as a controller for three underlying TicTacToeGame instances, orchestrating the "quantum" rules by taking
 * the role of the monitor.
 */
export default class QuantumTicTacToeGame extends Game<
  QuantumTicTacToeGameState,
  QuantumTicTacToeMove
> {
  private _games: { A: TicTacToeGame; B: TicTacToeGame; C: TicTacToeGame };

  private _xScore: number;

  private _oScore: number;

  private _moveCount: number;

  private _scoredBoards: Set<'A' | 'B' | 'C'>;

  public constructor() {
    super({
      moves: [],
      status: 'WAITING_TO_START',
      xScore: 0,
      oScore: 0,
      publiclyVisible: {
        A: [
          [false, false, false],
          [false, false, false],
          [false, false, false],
        ],
        B: [
          [false, false, false],
          [false, false, false],
          [false, false, false],
        ],
        C: [
          [false, false, false],
          [false, false, false],
          [false, false, false],
        ],
      },
    });

    this._games = {
      A: new TicTacToeGame(),
      B: new TicTacToeGame(),
      C: new TicTacToeGame(),
    };

    this._xScore = 0;
    this._oScore = 0;
    this._moveCount = 0;
    this._scoredBoards = new Set();
  }

  protected _join(player: Player): void {
    if (this.state.x === player.id || this.state.o === player.id) {
      throw new InvalidParametersError(PLAYER_ALREADY_IN_GAME_MESSAGE);
    }

    if (!this.state.x) {
      this.state = {
        ...this.state,
        x: player.id,
      };
      // Join the player to all three subgames as X
      this._games.A.join(player);
      this._games.B.join(player);
      this._games.C.join(player);
    } else if (!this.state.o) {
      this.state = {
        ...this.state,
        o: player.id,
      };
      // Join the player to all three subgames as O
      this._games.A.join(player);
      this._games.B.join(player);
      this._games.C.join(player);
    } else {
      throw new InvalidParametersError(GAME_FULL_MESSAGE);
    }

    if (this.state.x && this.state.o) {
      this.state = {
        ...this.state,
        status: 'IN_PROGRESS',
      };
    }
  }

  protected _leave(player: Player): void {
    if (this.state.x !== player.id && this.state.o !== player.id) {
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    }

    // Leave all three subgames
    this._games.A.leave(player);
    this._games.B.leave(player);
    this._games.C.leave(player);

    // Handles case where the game has not started yet (only one player)
    if (this.state.o === undefined) {
      this.state = {
        moves: [],
        status: 'WAITING_TO_START',
        xScore: 0,
        oScore: 0,
        publiclyVisible: {
          A: [
            [false, false, false],
            [false, false, false],
            [false, false, false],
          ],
          B: [
            [false, false, false],
            [false, false, false],
            [false, false, false],
          ],
          C: [
            [false, false, false],
            [false, false, false],
            [false, false, false],
          ],
        },
      };
      this._xScore = 0;
      this._oScore = 0;
      this._moveCount = 0;
      this._scoredBoards = new Set();
      return;
    }

    // Game was in progress with two players - declare the other player winner
    if (this.state.x === player.id) {
      this.state = {
        ...this.state,
        status: 'OVER',
        winner: this.state.o,
      };
    } else {
      this.state = {
        ...this.state,
        status: 'OVER',
        winner: this.state.x,
      };
    }
  }

  /**
   * Checks that the given move is "valid": that it's the right
   * player's turn, that the game is actually in-progress, etc.
   * IMPORTANT: We do NOT reject "occupied by opponent" here, because that is a legal
   * collision attempt (lose turn + reveal). We only reject "already mine".
   */
  private _validateMove(move: GameMove<QuantumTicTacToeMove>): void {
    // Validate game is in progress
    if (this.state.status !== 'IN_PROGRESS') {
      throw new InvalidParametersError(GAME_NOT_IN_PROGRESS_MESSAGE);
    }

    // Validate player is in the game
    if (move.playerID !== this.state.x && move.playerID !== this.state.o) {
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    }

    // Validate board position is within bounds
    if (move.move.row < 0 || move.move.row > 2 || move.move.col < 0 || move.move.col > 2) {
      throw new InvalidParametersError(BOARD_POSITION_NOT_VALID_MESSAGE);
    }

    // Validate board selection
    if (move.move.board !== 'A' && move.move.board !== 'B' && move.move.board !== 'C') {
      throw new InvalidParametersError(BOARD_POSITION_NOT_VALID_MESSAGE);
    }

    // Validate it's the player's turn
    const isXTurn = this.state.moves.length % 2 === 0;
    const isXPlayer = move.playerID === this.state.x;

    if ((isXTurn && !isXPlayer) || (!isXTurn && isXPlayer)) {
      throw new InvalidParametersError(MOVE_NOT_YOUR_TURN_MESSAGE);
    }

    // Validate the board isn't already closed/won
    const targetGame = this._games[move.move.board];
    if (targetGame.state.status === 'OVER') {
      throw new InvalidParametersError(INVALID_MOVE_MESSAGE);
    }

    // Reject if the player is trying to place on a square they already own on THIS board
    const gamePiece: 'X' | 'O' = move.playerID === this.state.x ? 'X' : 'O';
    const alreadyMine = targetGame.state.moves.some(
      m => m.row === move.move.row && m.col === move.move.col && m.gamePiece === gamePiece,
    );
    if (alreadyMine) {
      // You can’t re-claim your own square.
      throw new InvalidParametersError(INVALID_MOVE_MESSAGE);
    }

    // NOTE: We intentionally DO NOT reject if the opponent already claimed the square.
    // That case is handled in applyMove as a collision: lose the turn + reveal on the public board.
    // Also: We do NOT restrict coordinates across different boards (boards are independent).
  }

  public applyMove(move: GameMove<QuantumTicTacToeMove>): void {
    this._validateMove(move);

    const targetBoardKey = move.move.board;
    const targetGame = this._games[targetBoardKey];

    // Determine which game piece this player is using
    const gamePiece: 'X' | 'O' = move.playerID === this.state.x ? 'X' : 'O';
    const opponentPiece: 'X' | 'O' = gamePiece === 'X' ? 'O' : 'X';

    // --- Collision check on the SAME BOARD only ---
    const opponentAlreadyClaimed = targetGame.state.moves.some(
      m => m.row === move.move.row && m.col === move.move.col && m.gamePiece === opponentPiece,
    );

    if (opponentAlreadyClaimed) {
      const newPubliclyVisible = this._getUpdatedPubliclyVisible(
        targetBoardKey,
        move.move.row,
        move.move.col,
      );
      // // COLLISION: Player loses the turn; reveal opponent's symbol publicly on the SAME board cell.
      // this._revealPublic(targetBoardKey, move.move.row, move.move.col);

      // Record the attempted move (to alternate turns) but DO NOT modify the subgame.
      this.state = {
        ...this.state,
        moves: [...this.state.moves, move.move], // Advances the turn
        publiclyVisible: newPubliclyVisible, // Reveals the square
      };

      this._checkForGameEnding();
      return;
    }

    // No collision: apply move to the target subgame (private claim stands)
    const subgameMove: TicTacToeMove = {
      gamePiece,
      row: move.move.row,
      col: move.move.col,
    };
    this._applyMoveToSubgame(targetGame, subgameMove);

    // Record the move in the quantum meta-state and check for wins/end
    this.state = {
      ...this.state,
      moves: [...this.state.moves, move.move],
    };
    this._checkForWins();
    this._checkForGameEnding();
  }

  /**
   * Reveal a cell on the public board for the given board letter.
   * The UI can derive which symbol to draw by inspecting the subgame's owner of that cell.
   * We keep a boolean "visible" grid for compatibility.
   */
  private _revealPublic(boardKey: 'A' | 'B' | 'C', row: number, col: number): void {
    const grid = this.state.publiclyVisible[boardKey].map(r => r.slice());
    grid[row][col] = true;

    this.state = {
      ...this.state,
      publiclyVisible: {
        ...this.state.publiclyVisible,
        [boardKey]: grid,
      },
    };
  }

  /**
   * Creates a new publiclyVisible object with a specific cell revealed.
   * @returns A new publiclyVisible object for the new state.
   */
  private _getUpdatedPubliclyVisible(boardKey: 'A' | 'B' | 'C', row: number, col: number) {
    // Deep copy to avoid mutation
    const newPubliclyVisible = JSON.parse(JSON.stringify(this.state.publiclyVisible));
    newPubliclyVisible[boardKey][row][col] = true;
    return newPubliclyVisible;
  }

  /**
   * Checks all three sub-games for any new three-in-a-row conditions.
   * Awards points and marks boards as "won" so they can't be played on.
   * (The subgames set status/winner; we just score once per board here.)
   */
  private _checkForWins(): void {
    for (const boardKey of ['A', 'B', 'C'] as const) {
      const game = this._games[boardKey];

      // Check if this board has a winner and we haven't already scored it
      if (game.state.status === 'OVER' && game.state.winner && !this._scoredBoards.has(boardKey)) {
        const isXWin = game.state.winner === this.state.x;
        const isOWin = game.state.winner === this.state.o;

        // Award points based on who won
        if (isXWin) {
          this._xScore += 1;
          this.state = {
            ...this.state,
            xScore: this._xScore,
          };
        } else if (isOWin) {
          this._oScore += 1;
          this.state = {
            ...this.state,
            oScore: this._oScore,
          };
        }

        // Mark this board as scored/closed
        this._scoredBoards.add(boardKey);

        // Do not reveal the board state; it remains private when closed.
      }
    }
  }

  /**
   * A Quantum Tic-Tac-Toe game ends when no more moves are possible.
   * This happens when all squares on all boards are either occupied or the board is closed.
   * "Occupied" means privately claimed by either player on that board.
   */
  private _checkForGameEnding(): void {
    let movesPossible = false;

    for (const boardKey of ['A', 'B', 'C'] as const) {
      const game = this._games[boardKey];

      // Closed boards are not playable
      if (game.state.status !== 'OVER') {
        // Collect occupied cells on this board from private claims
        const occupied = new Set<string>();
        for (const move of game.state.moves) {
          occupied.add(`${move.row},${move.col}`);
        }

        // Any unclaimed cell means at least one legal move exists
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            if (!occupied.has(`${row},${col}`)) {
              movesPossible = true;
              break;
            }
          }
          if (movesPossible) break;
        }

        if (movesPossible) break;
      }
    }

    if (!movesPossible) {
      // Determine winner based on scores
      let winner: string | undefined;
      if (this._xScore > this._oScore) {
        winner = this.state.x;
      } else if (this._oScore > this._xScore) {
        winner = this.state.o;
      } else {
        winner = undefined; // Tie
      }

      this.state = {
        ...this.state,
        status: 'OVER',
        winner,
      };
    }
  }

  /**
   * Applies a move to a subgame without turn validation.
   * This bypasses the normal applyMove validation since we handle turns at the quantum level.
   */
  private _applyMoveToSubgame(subgame: TicTacToeGame, move: TicTacToeMove): void {
    // Access the subgame's state through the getter and create a new state
    const currentState = subgame.state;
    const newState = {
      ...currentState,
      moves: [...currentState.moves, move],
    };

    // Use the protected setter by casting to any (this is a bit of a hack but necessary)
    // @ts-expect-error - accessing protected property for quantum game orchestration
    subgame.state = newState;

    // Check for win conditions
    this._checkSubgameWin(subgame);
  }

  /**
   * Checks if a subgame has a winner and updates its state accordingly.
   * This is a simplified version of TicTacToeGame's _checkForGameEnding logic.
   */
  private _checkSubgameWin(subgame: TicTacToeGame): void {
    const board = subgame.state.moves;
    const gameBoard: ('X' | 'O' | '')[][] = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];

    // Build the board from moves
    for (const move of board) {
      gameBoard[move.row][move.col] = move.gamePiece;
    }

    // Check for 3 in a row or column
    for (let i = 0; i < 3; i++) {
      if (
        gameBoard[i][0] !== '' &&
        gameBoard[i][0] === gameBoard[i][1] &&
        gameBoard[i][0] === gameBoard[i][2]
      ) {
        const newState = {
          ...subgame.state,
          status: 'OVER' as const,
          winner: gameBoard[i][0] === 'X' ? subgame.state.x : subgame.state.o,
        };
        // @ts-expect-error - accessing protected property for quantum game orchestration
        subgame.state = newState;
        return;
      }
      if (
        gameBoard[0][i] !== '' &&
        gameBoard[0][i] === gameBoard[1][i] &&
        gameBoard[0][i] === gameBoard[2][i]
      ) {
        const newState = {
          ...subgame.state,
          status: 'OVER' as const,
          winner: gameBoard[0][i] === 'X' ? subgame.state.x : subgame.state.o,
        };
        // @ts-expect-error - accessing protected property for quantum game orchestration
        subgame.state = newState;
        return;
      }
    }

    // Check for 3 in a diagonal
    if (
      gameBoard[0][0] !== '' &&
      gameBoard[0][0] === gameBoard[1][1] &&
      gameBoard[0][0] === gameBoard[2][2]
    ) {
      const newState = {
        ...subgame.state,
        status: 'OVER' as const,
        winner: gameBoard[0][0] === 'X' ? subgame.state.x : subgame.state.o,
      };
      // @ts-expect-error - accessing protected property for quantum game orchestration
      subgame.state = newState;
      return;
    }

    // Check for 3 in the other diagonal
    if (
      gameBoard[0][2] !== '' &&
      gameBoard[0][2] === gameBoard[1][1] &&
      gameBoard[0][2] === gameBoard[2][0]
    ) {
      const newState = {
        ...subgame.state,
        status: 'OVER' as const,
        winner: gameBoard[0][2] === 'X' ? subgame.state.x : subgame.state.o,
      };
      // @ts-expect-error - accessing protected property for quantum game orchestration
      subgame.state = newState;
      return;
    }

    // Check for no more moves (tie/closed without a winner)
    if (subgame.state.moves.length === 9) {
      const newState = {
        ...subgame.state,
        status: 'OVER' as const,
        winner: undefined,
      };
      // @ts-expect-error - accessing protected property for quantum game orchestration
      subgame.state = newState;
    }
  }
}
