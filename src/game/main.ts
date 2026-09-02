import { AUTO, Events, Game as PhaserGame, Scale, Scene } from "phaser";
import {
    BOARD_PX, BOARD_X, BOARD_Y, COLORS, EV, GAME_HEIGHT, GAME_WIDTH,
    SQ, audio, getLore, randomTaunt, randomTwist, squareName,
} from "./utils";
import type { Board, Color, GamePhase, Move, PieceType } from "./utils";
import { applyMove, chooseAiMove, inCheck, initialBoard, legalMoves } from "./chess";
import { buildPieceTextures } from "../sprites/pieces";

// ---------------------------------------------------------------------------
// EVENT BUS — shared React <-> Phaser bridge (named export).
// ---------------------------------------------------------------------------
export const EventBus = new Events.EventEmitter();

interface GameState {
    board: Board;
    turn: Color;
    castle: Record<string, boolean>;
    ep: [number, number] | null;
    moveCount: number;
}

const VAL: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

function freshState(): GameState {
    return {
        board: initialBoard(),
        turn: "w",
        castle: { wK: true, wQ: true, bK: true, bQ: true },
        ep: null,
        moveCount: 0,
    };
}

// ---------------------------------------------------------------------------
// THE GAME SCENE
// ---------------------------------------------------------------------------
export class Game extends Scene {
    private state!: GameState;
    private mode: "ai" | "pvp" = "ai";
    private difficulty: "normal" | "hard" = "normal";
    private phase: GamePhase = "MENU";
    private sprites = new Map<string, Phaser.GameObjects.Image>();
    private highlightLayer!: Phaser.GameObjects.Graphics;
    private selected: [number, number] | null = null;
    private legal: Move[] = [];
    private busy = false;
    private capturedW: PieceType[] = [];
    private capturedB: PieceType[] = [];

    constructor() {
        super("Game");
    }

    // ---- Lifecycle ---------------------------------------------------------
    create() {
        buildPieceTextures(this);
        this.cameras.main.setBackgroundColor(COLORS.velvet);
        this.state = freshState();

        // Static board + labels
        this.drawBoard();
        this.highlightLayer = this.add.graphics().setDepth(20);
        this.renderPieces();

        this.input.on("pointerdown", this.onPointer, this);
        this.input.keyboard?.on("keydown-ESC", () => this.togglePause());
        this.input.keyboard?.on("keydown-P", () => this.togglePause());

        EventBus.on(EV.START, this.onStart, this);
        EventBus.on(EV.RESTART, this.onRestart, this);
        EventBus.on(EV.PAUSE, this.togglePause, this);
        EventBus.on(EV.RESOLVE_DUEL, this.onDuelResolve, this);
        EventBus.on(EV.HINT, this.onHint, this);

        this.setPhase("MENU");
        EventBus.emit(EV.SCENE_READY, this);

        this.events.once("shutdown", () => {
            this.time.removeAllEvents();
            this.tweens.killAll();
            this.input.keyboard?.removeAllListeners();
            this.input?.removeAllListeners();
            EventBus.off(EV.START, this.onStart, this);
            EventBus.off(EV.RESTART, this.onRestart, this);
            EventBus.off(EV.PAUSE, this.togglePause, this);
            EventBus.off(EV.RESOLVE_DUEL, this.onDuelResolve, this);
            EventBus.off(EV.HINT, this.onHint, this);
            this.sound.stopAll();
        });
    }

    update() {
        /* turn-based; per-frame logic handled by tweens/timers */
    }

    // ---- Board rendering ---------------------------------------------------
    private drawBoard() {
        const g = this.add.graphics().setDepth(0);
        // gold frame
        g.fillStyle(COLORS.gold, 1);
        g.fillRoundedRect(BOARD_X - 10, BOARD_Y - 10, BOARD_PX + 20, BOARD_PX + 20, 8);
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(BOARD_X - 6, BOARD_Y - 6, BOARD_PX + 12, BOARD_PX + 12, 6);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const dark = (r + c) % 2 === 1;
                g.fillStyle(dark ? COLORS.darkSq : COLORS.lightSq, 1);
                g.fillRect(BOARD_X + c * SQ, BOARD_Y + r * SQ, SQ, SQ);
                if (dark) {
                    g.fillStyle(0xffffff, 0.03);
                    g.fillRect(BOARD_X + c * SQ, BOARD_Y + r * SQ, SQ, 3);
                }
            }
        }
        // coordinate labels
        const style = { fontFamily: "Georgia, serif", fontSize: "13px" } as const;
        for (let c = 0; c < 8; c++) {
            const t = this.add.text(BOARD_X + c * SQ + SQ / 2, BOARD_Y + BOARD_PX + 4, "abcdefgh"[c], { ...style, color: "#f5ebe0" }).setOrigin(0.5, 0).setDepth(1);
            void t;
        }
        for (let r = 0; r < 8; r++) {
            this.add.text(BOARD_X - 16, BOARD_Y + r * SQ + SQ / 2, String(8 - r), { ...style, color: "#f5ebe0" }).setOrigin(0.5).setDepth(1);
        }
    }

    private key(r: number, c: number) {
        return `${r},${c}`;
    }

    private renderPieces() {
        this.sprites.forEach((s) => s.destroy());
        this.sprites.clear();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.state.board[r][c];
                if (!p) continue;
                this.addPieceSprite(r, c, p.type, p.color);
            }
        }
    }

    private addPieceSprite(r: number, c: number, type: PieceType, color: Color) {
        const img = this.add
            .image(BOARD_X + c * SQ + SQ / 2, BOARD_Y + r * SQ + SQ / 2, `piece_${type}_${color}`)
            .setDisplaySize(SQ - 6, SQ - 6)
            .setDepth(10);
        this.sprites.set(this.key(r, c), img);
    }

    private drawHighlights() {
        this.highlightLayer.clear();
        if (!this.selected) return;
        const [sr, sc] = this.selected;
        this.highlightLayer.fillStyle(COLORS.select, 0.4);
        this.highlightLayer.fillRect(BOARD_X + sc * SQ, BOARD_Y + sr * SQ, SQ, SQ);
        for (const m of this.legal) {
            const [tr, tc] = m.to;
            const occ = this.state.board[tr][tc];
            if (occ) {
                this.highlightLayer.lineStyle(4, COLORS.attackRune, 1);
                this.highlightLayer.strokeRect(BOARD_X + tc * SQ + 3, BOARD_Y + tr * SQ + 3, SQ - 6, SQ - 6);
            } else {
                this.highlightLayer.fillStyle(COLORS.moveRune, 0.85);
                this.highlightLayer.fillCircle(BOARD_X + tc * SQ + SQ / 2, BOARD_Y + tr * SQ + SQ / 2, 8);
            }
        }
    }

    // ---- Input -------------------------------------------------------------
    private onPointer(pointer: Phaser.Input.Pointer) {
        if (this.phase !== "PLAYING" || this.busy) return;
        if (this.mode === "ai" && this.state.turn === "b") return;
        const x = pointer.x - BOARD_X;
        const y = pointer.y - BOARD_Y;
        if (x < 0 || y < 0 || x >= BOARD_PX || y >= BOARD_PX) {
            this.clearSelection();
            return;
        }
        const c = Math.floor(x / SQ);
        const r = Math.floor(y / SQ);
        const piece = this.state.board[r][c];

        if (this.selected) {
            const mv = this.legal.find((m) => m.to[0] === r && m.to[1] === c);
            if (mv) {
                this.clearHighlights();
                this.commitMove(mv);
                return;
            }
        }
        if (piece && piece.color === this.state.turn) {
            this.selected = [r, c];
            this.legal = legalMoves(this.state.board, this.state.turn, this.state.castle, this.state.ep, [r, c]);
            this.drawHighlights();
            const lore = getLore(piece.type, piece.color);
            EventBus.emit(EV.SELECTED, {
                piece: { type: piece.type, color: piece.color, square: squareName(r, c) },
                lore,
            });
            audio.playClick();
        } else {
            this.clearSelection();
        }
    }

    private clearSelection() {
        this.selected = null;
        this.legal = [];
        this.drawHighlights();
    }
    private clearHighlights() {
        this.selected = null;
        this.legal = [];
        this.highlightLayer.clear();
    }

    // ---- Move execution ----------------------------------------------------
    private commitMove(m: Move) {
        this.busy = true;
        const isCapture = !!m.captured;
        const sprite = this.sprites.get(this.key(m.from[0], m.from[1]));
        const [tr, tc] = m.to;
        const destX = BOARD_X + tc * SQ + SQ / 2;
        const destY = BOARD_Y + tr * SQ + SQ / 2;

        const finish = () => {
            // handle captured piece removal
            if (isCapture) {
                const capKey = m.enPassant
                    ? this.key(m.from[0], m.to[1])
                    : this.key(tr, tc);
                const capSprite = this.sprites.get(capKey);
                if (m.castle) {
                    // rook already relocated below; capture sprite is the target
                }
                if (capSprite) {
                    this.sprites.delete(capKey);
                    const capturedType = this.state.board[tr][tc]?.type ?? m.captured;
                    const mover: Color = m.color;
                    if (capturedType) {
                        if (mover === "w") this.capturedW.push(capturedType);
                        else this.capturedB.push(capturedType);
                    }
                    this.tweens.add({ targets: capSprite, alpha: 0, scale: 0.3, duration: 220, onComplete: () => capSprite.destroy() });
                    audio.playCapture();
                    this.burstFX(destX, destY);
                }
                EventBus.emit(EV.CAPTURED, { white: this.capturedW, black: this.capturedB });
            }

            // apply to state
            const res = applyMove(this.state.board, m, this.state.castle, this.state.ep);
            this.state.board = res.board;
            this.state.castle = res.castle;
            this.state.ep = res.epTarget;
            this.state.turn = m.color === "w" ? "b" : "w";
            this.state.moveCount++;

            // move/castle sprite bookkeeping
            this.sprites.delete(this.key(m.from[0], m.from[1]));
            if (m.castle) {
                const home = m.color === "w" ? 7 : 0;
                const rookFrom = m.castle === "k" ? 7 : 0;
                const rookTo = m.castle === "k" ? 5 : 3;
                const rk = this.sprites.get(this.key(home, rookFrom));
                if (rk) {
                    this.sprites.delete(this.key(home, rookFrom));
                    this.tweens.add({ targets: rk, x: BOARD_X + rookTo * SQ + SQ / 2, duration: 200, onComplete: () => this.sprites.set(this.key(home, rookTo), rk) });
                }
            }
            if (sprite) this.sprites.set(this.key(tr, tc), sprite);
            if (m.promotion && sprite) {
                sprite.setTexture(`piece_${m.promotion}_${m.color}`);
                this.tweens.add({ targets: sprite, scale: 1.25, yoyo: true, duration: 220 });
            }

            const check = inCheck(this.state.board, this.state.turn);
            if (check) {
                m.check = true;
                audio.playCheck();
                this.cameras.main.shake(120, 0.004);
            }
            EventBus.emit(EV.MOVE, { move: m, turn: m.color, isCheck: check });

            // mate / stalemate
            const oppMoves = legalMoves(this.state.board, this.state.turn, this.state.castle, this.state.ep);
            if (oppMoves.length === 0) {
                const winner: Color | "draw" = check ? (m.color) : "draw";
                this.endGame(winner, check ? "Checkmate" : "Stalemate");
                return;
            }

            // Plot twist every ~7 plies
            if (this.state.moveCount > 0 && this.state.moveCount % 7 === 0 && this.state.moveCount < 120) {
                this.busy = false;
                this.triggerTwist();
                return;
            }

            this.busy = false;
            this.afterMove();
        };

        if (sprite) {
            this.tweens.add({ targets: sprite, x: destX, y: destY, duration: 240, ease: "Quad.easeOut", onComplete: finish });
        } else finish();
    }

    private afterMove() {
        if (this.mode === "ai" && this.state.turn === "b" && this.phase === "PLAYING") {
            this.busy = true;
            this.time.delayedCall(520, () => this.aiTurn());
        }
    }

    private aiTurn() {
        if (this.phase !== "PLAYING") { this.busy = false; return; }
        const mv = chooseAiMove(this.state.board, this.state.castle, this.state.ep, this.difficulty);
        if (!mv) { this.busy = false; return; }
        // AI captures of high-value pieces may trigger a duel
        const capVal = mv.captured ? VAL[mv.captured] : 0;
        if (capVal >= 3 && Math.random() < 0.5) {
            this.startDuel(mv, () => { this.busy = false; this.commitMove(mv); });
            return;
        }
        this.busy = false;
        this.commitMove(mv);
        if (Math.random() < 0.35) EventBus.emit(EV.MOVE, { taunt: randomTaunt() });
    }

    // ---- Duel clash --------------------------------------------------------
    private pendingDuel: { move: Move; then: () => void } | null = null;

    private startDuel(m: Move, then: () => void) {
        const atk = this.state.board[m.from[0]][m.from[1]];
        const def = this.state.board[m.to[0]][m.to[1]] ?? (m.enPassant ? { type: "p" as PieceType, color: m.color === "w" ? "b" : "w" } : null);
        if (!atk || !def) { then(); return; }
        this.pendingDuel = { move: m, then };
        this.setPhase("DUEL_CLASH");
        EventBus.emit(EV.DUEL_START, {
            attacker: { type: atk.type, color: atk.color, square: squareName(m.from[0], m.from[1]), lore: getLore(atk.type, atk.color) },
            defender: { type: def.type, color: def.color, square: squareName(m.to[0], m.to[1]), lore: getLore(def.type, def.color) },
        });
    }

    private onDuelResolve(winner: "attacker" | "defender") {
        audio.playDuel();
        const story =
            winner === "attacker"
                ? "Steel rings out — the attacker stands over the fallen, claiming the square."
                : "The defender parries and holds the ground! The assault is broken.";
        EventBus.emit(EV.DUEL_DONE, { winner, duelStory: story });
        const pd = this.pendingDuel;
        this.pendingDuel = null;
        if (!pd) { this.setPhase("PLAYING"); return; }
        if (winner === "defender") {
            // attacker loses the move; turn passes to defender as a free tempo
            this.state.turn = pd.move.color === "w" ? "b" : "w";
            this.state.moveCount++;
            this.setPhase("PLAYING");
            this.busy = false;
            this.afterMove();
            return;
        }
        this.setPhase("PLAYING");
        pd.then();
    }

    // ---- Plot twist --------------------------------------------------------
    private triggerTwist() {
        const twist = randomTwist();
        this.setPhase("PLOT_TWIST_EVENT");
        EventBus.emit(EV.TWIST, twist);
    }

    // Called by React after the twist modal is dismissed.
    public resolveTwist() {
        this.setPhase("PLAYING");
        this.afterMove();
    }

    // ---- Hint --------------------------------------------------------------
    private onHint() {
        if (this.phase !== "PLAYING") return;
        const mv = chooseAiMove(this.state.board, this.state.castle, this.state.ep, "hard");
        // chooseAiMove is for black; for white use a quick search by flipping perspective
        const whiteMoves = legalMoves(this.state.board, "w", this.state.castle, this.state.ep);
        let best = mv && mv.color === "w" ? mv : null;
        if (!best && whiteMoves.length) {
            // pick a capture or check if available, else random
            best = whiteMoves.find((m) => m.captured) ?? whiteMoves[0];
        }
        if (best && best.color === "w") {
            this.selected = best.from;
            this.legal = legalMoves(this.state.board, "w", this.state.castle, this.state.ep, best.from);
            this.drawHighlights();
            this.tweens.add({ targets: this.highlightLayer, alpha: 0.2, yoyo: true, repeat: 3, duration: 200 });
        }
    }

    // ---- Game over ---------------------------------------------------------
    private endGame(winner: Color | "draw", reason: string) {
        this.setPhase("FINISHED");
        const epilogue =
            winner === "draw"
                ? "Two banners bleed into the mud. The chronicle records only exhaustion — no crown changes hands today."
                : winner === "w"
                    ? "The Crown of the Dawn endures. King Aurelius knaps his sword as the realm's bards sing of a hard-won peace."
                    : "The Empire of Cinders claims the throne. Malakor's shadow stretches across the 64 realms, and the old court falls silent.";
        if (winner === "w") audio.playVictory(); else if (winner === "b") audio.playDefeat(); else audio.playDefeat();
        EventBus.emit(EV.GAME_OVER, {
            winner,
            reason,
            epilogue,
            chronicle: {
                moves: this.state.moveCount,
                capturedByWhite: this.capturedW.length,
                capturedByBlack: this.capturedB.length,
            },
        });
    }

    // ---- Phase control -----------------------------------------------------
    private setPhase(p: GamePhase) {
        this.phase = p;
        EventBus.emit(EV.PHASE, p);
    }

    private onStart(data: { mode: "ai" | "pvp"; difficulty: "normal" | "hard" }) {
        this.mode = data?.mode ?? "ai";
        this.difficulty = data?.difficulty ?? "normal";
        this.capturedW = [];
        this.capturedB = [];
        this.state = freshState();
        this.clearSelection();
        this.renderPieces();
        this.busy = false;
        EventBus.emit(EV.CAPTURED, { white: this.capturedW, black: this.capturedB });
        this.setPhase("PLAYING");
    }

    private onRestart() {
        this.onStart({ mode: this.mode, difficulty: this.difficulty });
    }

    private togglePause() {
        if (this.phase === "PLAYING") {
            this.setPhase("PAUSED");
            this.physics.world?.pause();
        } else if (this.phase === "PAUSED") {
            this.setPhase("PLAYING");
            this.physics.world?.resume();
        }
    }

    // ---- FX ----------------------------------------------------------------
    private burstFX(x: number, y: number) {
        for (let i = 0; i < 8; i++) {
            const s = this.add.image(x, y, "fx_spark").setDepth(30).setScale(0.8);
            const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
            this.tweens.add({
                targets: s,
                x: x + Math.cos(ang) * (30 + Math.random() * 24),
                y: y + Math.sin(ang) * (30 + Math.random() * 24),
                alpha: 0,
                scale: 0.1,
                duration: 420 + Math.random() * 160,
                onComplete: () => s.destroy(),
            });
        }
        const slash = this.add.image(x, y, "fx_slash").setDepth(31).setScale(1.2).setAngle(Math.random() * 60 - 30);
        this.tweens.add({ targets: slash, alpha: 0, scale: 1.8, duration: 260, onComplete: () => slash.destroy() });
    }
}

// ---------------------------------------------------------------------------
// GAME FACTORY
// ---------------------------------------------------------------------------
const StartGame = (parent: string) => {
    const config: Phaser.Types.Core.GameConfig = {
        type: AUTO,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        parent,
        backgroundColor: "#1a120b",
        scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
        physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } },
        scene: [Game],
    };
    const game = new PhaserGame(config);
    if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).__PHASER_GAME__ = game;
        (window as unknown as Record<string, unknown>).__PHASER_EVENT_BUS__ = EventBus;
    }
    return game;
};

export default StartGame;
