import _ from 'lodash';
import {
  GameArea,
  GameStatus,
  QuantumTicTacToeGameState,
  QuantumTicTacToeMove,
  TicTacToeGridPosition,
} from '../../types/CoveyTownSocket';
import PlayerController from '../PlayerController';
import GameAreaController, {
  GameEventTypes,
  NO_GAME_IN_PROGRESS_ERROR,
  PLAYER_NOT_IN_GAME_ERROR,
} from './GameAreaController';

export type TicTacToeCell = 'X' | 'O' | undefined;
export type QuantumTicTacToeEvents = GameEventTypes & {
  boardChanged: (board: {
    A: TicTacToeCell[][];
    B: TicTacToeCell[][];
    C: TicTacToeCell[][];
  }) => void;
  turnChanged: (isOurTurn: boolean) => void;
};

/**
 * This class is responsible for managing the state of the Quantum Tic Tac Toe game, and for sending commands to the server
 */
export default class QuantumTicTacToeAreaController extends GameAreaController<
  QuantumTicTacToeGameState,
  QuantumTicTacToeEvents
> {
  protected _boards: { A: TicTacToeCell[][]; B: TicTacToeCell[][]; C: TicTacToeCell[][] } = {
    A: [
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
    ],
    B: [
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
    ],
    C: [
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
    ],
  };

  get boards(): { A: TicTacToeCell[][]; B: TicTacToeCell[][]; C: TicTacToeCell[][] } {
    return this._boards;
  }

  get x(): PlayerController | undefined {
    const x = this._model.game?.state.x;
    if (x) {
      return this.occupants.find(eachOccupant => eachOccupant.id === x);
    }
    return undefined;
  }

  get o(): PlayerController | undefined {
    const o = this._model.game?.state.o;
    if (o) {
      return this.occupants.find(eachOccupant => eachOccupant.id === o);
    }
    return undefined;
  }

  get xScore(): number {
    return this._model.game?.state.xScore || 0;
  }

  get oScore(): number {
    return this._model.game?.state.oScore || 0;
  }

  get moveCount(): number {
    return this._model.game?.state.moves.length || 0;
  }

  get winner(): PlayerController | undefined {
    const winner = this._model.game?.state.winner;
    if (winner) {
      return this.occupants.find(eachOccupant => eachOccupant.id === winner);
    }
    return undefined;
  }

  get whoseTurn(): PlayerController | undefined {
    if (this.status !== 'IN_PROGRESS') {
      return undefined;
    }
    if (this.moveCount % 2 === 0) {
      return this.x;
    }
    return this.o;
  }

  get isOurTurn(): boolean {
    return this.whoseTurn?.id === this._townController.ourPlayer.id;
  }

  get isPlayer(): boolean {
    return this._model.game?.players.includes(this._townController.ourPlayer.id) || false;
  }

  get gamePiece(): 'X' | 'O' {
    if (this.x?.id === this._townController.ourPlayer.id) {
      return 'X';
    } else if (this.o?.id === this._townController.ourPlayer.id) {
      return 'O';
    }
    throw new Error(PLAYER_NOT_IN_GAME_ERROR);
  }

  get status(): GameStatus {
    return this._model.game?.state.status || 'WAITING_TO_START';
  }

  public isActive(): boolean {
    return this.status !== 'OVER' && this.status !== 'WAITING_TO_START';
  }

  protected _updateFrom(newModel: GameArea<QuantumTicTacToeGameState>): void {
    const oldIsOurTurn = this.isOurTurn;
    super._updateFrom(newModel);
    
    if (newModel.game?.state.status === 'IN_PROGRESS') {
      // Reconstruct the visible state of the three boards
      const newBoards: { A: TicTacToeCell[][]; B: TicTacToeCell[][]; C: TicTacToeCell[][] } = {
        A: [
          [undefined, undefined, undefined],
          [undefined, undefined, undefined],
          [undefined, undefined, undefined],
        ],
        B: [
          [undefined, undefined, undefined],
          [undefined, undefined, undefined],
          [undefined, undefined, undefined],
        ],
        C: [
          [undefined, undefined, undefined],
          [undefined, undefined, undefined],
          [undefined, undefined, undefined],
        ],
      };

      // Process moves to build the visible board state
      if (newModel.game.state.moves) {
        for (const move of newModel.game.state.moves) {
          const isOurMove = move.gamePiece === this.gamePiece;
          const isPubliclyVisible = newModel.game.state.publiclyVisible[move.board][move.row][move.col];
          
          // Show the move if:
          // 1. It's our move (always visible to us)
          // 2. It's publicly visible (collision occurred)
          if (isOurMove || isPubliclyVisible) {
            // If there's a collision, show the first piece that was placed there
            // We need to find the first move to that position
            const firstMoveToPosition = newModel.game.state.moves.find(
              m => m.board === move.board && m.row === move.row && m.col === move.col
            );
            if (firstMoveToPosition) {
              newBoards[move.board][move.row][move.col] = firstMoveToPosition.gamePiece;
            }
          }
        }
      }

      // Check if boards have changed
      const boardsChanged = !_.isEqual(this._boards, newBoards);
      if (boardsChanged) {
        this._boards = newBoards;
        this.emit('boardChanged', this._boards);
      }

      // Check if turn has changed
      const newIsOurTurn = this.isOurTurn;
      if (oldIsOurTurn !== newIsOurTurn) {
        this.emit('turnChanged', newIsOurTurn);
      }
    }
  }

  public async makeMove(
    board: 'A' | 'B' | 'C',
    row: TicTacToeGridPosition,
    col: TicTacToeGridPosition,
  ) {
    const instanceID = this._instanceID;
    if (!instanceID || this.status !== 'IN_PROGRESS') {
      throw new Error(NO_GAME_IN_PROGRESS_ERROR);
    }
    const move: QuantumTicTacToeMove = {
      gamePiece: this.gamePiece,
      board,
      row,
      col,
    };
    await this._townController.sendInteractableCommand(this.id, {
      type: 'GameMove',
      gameID: instanceID,
      move,
    });
  }
}
