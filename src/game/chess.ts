// ---------------------------------------------------------------------------
// Chess rules engine for Grand Duel. Pure functions, no Phaser/React deps.
// Board is (Piece|null)[][] indexed [row][col]; row 0 = black back rank.
// ---------------------------------------------------------------------------
import type { Board, Color, Move, Piece, PieceType } from "./utils";

const DIRS: Record<PieceType, number[][]> = {
    p: [],
    n: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
    b: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    r: [[-1, 0], [1, 0], [0, -1], [0, 1]],
    q: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]],
    k: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]],
};

export function initialBoard(): Board {
    const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
    const board: Board = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
    for (let c = 0; c < 8; c++) {
        board[0][c] = { type: back[c], color: "b" };
        board[1][c] = { type: "p", color: "b" };
        board[6][c] = { type: "p", color: "w" };
        board[7][c] = { type: back[c], color: "w" };
    }
    return board;
}

export function cloneBoard(b: Board): Board {
    return b.map((row) => row.map((p) => (p ? { ...p } : null)));
}

export function findKing(b: Board, color: Color): [number, number] | null {
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p && p.type === "k" && p.color === color) return [r, c];
        }
    return null;
}

export function isAttacked(b: Board, r: number, c: number, by: Color): boolean {
    // Pawn attacks: a `by` pawn sits one rank "forward" toward its target.
    // White pawns move up (decreasing row), so they attack from row+1.
    const pawnRow = by === "w" ? r + 1 : r - 1;
    for (const dc of [-1, 1]) {
        const p = b[pawnRow]?.[c + dc];
        if (p && p.color === by && p.type === "p") return true;
    }
    // Knight
    for (const [dr, dc] of DIRS.n) {
        const p = b[r + dr]?.[c + dc];
        if (p && p.color === by && p.type === "n") return true;
    }
    // King adjacency
    for (const [dr, dc] of DIRS.k) {
        const p = b[r + dr]?.[c + dc];
        if (p && p.color === by && p.type === "k") return true;
    }
    // Sliders
    const slide = (dirs: number[][], type: PieceType) => {
        for (const [dr, dc] of dirs) {
            let rr = r + dr, cc = c + dc;
            while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
                const p = b[rr][cc];
                if (p) {
                    if (p.color === by && (p.type === type || p.type === "q")) return true;
                    break;
                }
                rr += dr; cc += dc;
            }
        }
        return false;
    };
    if (slide(DIRS.b, "b")) return true;
    if (slide(DIRS.r, "r")) return true;
    return false;
}

export function inCheck(b: Board, color: Color): boolean {
    const k = findKing(b, color);
    if (!k) return false;
    return isAttacked(b, k[0], k[1], color === "w" ? "b" : "w");
}

// Pseudo-legal moves for a single piece at (r,c).
function pseudoMoves(
    b: Board,
    r: number,
    c: number,
    epTarget: [number, number] | null,
    castle: Record<string, boolean>,
): Move[] {
    const piece = b[r][c];
    if (!piece) return [];
    const color = piece.color;
    const enemy: Color = color === "w" ? "b" : "w";
    const moves: Move[] = [];
    const add = (tr: number, tc: number, extra: Partial<Move> = {}) => {
        const cap = b[tr][tc];
        moves.push({
            from: [r, c],
            to: [tr, tc],
            piece: piece.type,
            color,
            captured: cap ? cap.type : undefined,
            ...extra,
        });
    };

    if (piece.type === "p") {
        const dir = color === "w" ? -1 : 1;
        const startRow = color === "w" ? 6 : 1;
        const promoRow = color === "w" ? 0 : 7;
        const oneR = r + dir;
        if (oneR >= 0 && oneR < 8 && !b[oneR][c]) {
            if (oneR === promoRow) {
                for (const promo of ["q", "r", "b", "n"] as PieceType[]) add(oneR, c, { promotion: promo });
            } else add(oneR, c);
            const twoR = r + dir * 2;
            if (r === startRow && !b[twoR][c]) add(twoR, c, { doublePush: true });
        }
        for (const dc of [-1, 1]) {
            const tc = c + dc;
            if (tc < 0 || tc > 7) continue;
            const cap = b[oneR]?.[tc];
            if (cap && cap.color === enemy) {
                if (oneR === promoRow) {
                    for (const promo of ["q", "r", "b", "n"] as PieceType[]) add(oneR, tc, { promotion: promo });
                } else add(oneR, tc);
            } else if (epTarget && epTarget[0] === oneR && epTarget[1] === tc) {
                add(oneR, tc, { enPassant: true, captured: "p" });
            }
        }
        return moves;
    }

    if (piece.type === "n" || piece.type === "k") {
        for (const [dr, dc] of DIRS[piece.type]) {
            const tr = r + dr, tc = c + dc;
            if (tr < 0 || tr > 7 || tc < 0 || tc > 7) continue;
            const occ = b[tr][tc];
            if (!occ || occ.color === enemy) add(tr, tc);
        }
    } else {
        for (const [dr, dc] of DIRS[piece.type]) {
            let tr = r + dr, tc = c + dc;
            while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                const occ = b[tr][tc];
                if (!occ) add(tr, tc);
                else {
                    if (occ.color === enemy) add(tr, tc);
                    break;
                }
                tr += dr; tc += dc;
            }
        }
    }

    // Castling (king only)
    if (piece.type === "k" && !inCheck(b, color)) {
        const home = color === "w" ? 7 : 0;
        if (r === home && c === 4) {
            const kSide = color === "w" ? castle.wK : castle.bK;
            const qSide = color === "w" ? castle.wQ : castle.bQ;
            if (
                kSide &&
                !b[home][5] && !b[home][6] &&
                b[home][7]?.type === "r" && b[home][7]?.color === color &&
                !isAttacked(b, home, 5, enemy) && !isAttacked(b, home, 6, enemy)
            ) add(home, 6, { castle: "k" });
            if (
                qSide &&
                !b[home][3] && !b[home][2] && !b[home][1] &&
                b[home][0]?.type === "r" && b[home][0]?.color === color &&
                !isAttacked(b, home, 3, enemy) && !isAttacked(b, home, 2, enemy)
            ) add(home, 2, { castle: "q" });
        }
    }
    return moves;
}

// Apply a move to a board (mutates a clone) and return new castling/ep state.
export function applyMove(
    b: Board,
    m: Move,
    castle: Record<string, boolean>,
    epTarget: [number, number] | null,
): { board: Board; castle: Record<string, boolean>; epTarget: [number, number] | null } {
    const board = cloneBoard(b);
    const nc = { ...castle };
    const [fr, fc] = m.from;
    const [tr, tc] = m.to;
    const piece = board[fr][fc]!;

    board[tr][tc] = piece;
    board[fr][fc] = null;

    if (m.enPassant) board[fr][tc] = null; // captured pawn sits on from-row, to-col
    if (m.promotion) board[tr][tc] = { type: m.promotion, color: piece.color };
    if (m.castle) {
        const home = piece.color === "w" ? 7 : 0;
        if (m.castle === "k") {
            board[home][5] = board[home][7];
            board[home][7] = null;
        } else {
            board[home][3] = board[home][0];
            board[home][0] = null;
        }
    }
    if (m.doublePush) epTarget = [(fr + tr) / 2, fc];
    else epTarget = null;

    // Update castling rights
    if (piece.type === "k") {
        if (piece.color === "w") { nc.wK = false; nc.wQ = false; }
        else { nc.bK = false; nc.bQ = false; }
    }
    if (piece.type === "r") {
        if (piece.color === "w" && fr === 7 && fc === 0) nc.wQ = false;
        if (piece.color === "w" && fr === 7 && fc === 7) nc.wK = false;
        if (piece.color === "b" && fr === 0 && fc === 0) nc.bQ = false;
        if (piece.color === "b" && fr === 0 && fc === 7) nc.bK = false;
    }
    // Rook captured in place
    if (tr === 0 && tc === 0) nc.bQ = false;
    if (tr === 0 && tc === 7) nc.bK = false;
    if (tr === 7 && tc === 0) nc.wQ = false;
    if (tr === 7 && tc === 7) nc.wK = false;

    return { board, castle: nc, epTarget };
}

export function legalMoves(
    b: Board,
    color: Color,
    castle: Record<string, boolean>,
    epTarget: [number, number] | null,
    onlyFrom?: [number, number],
): Move[] {
    const result: Move[] = [];
    const rows = onlyFrom ? [onlyFrom[0]] : [0, 1, 2, 3, 4, 5, 6, 7];
    const cols = onlyFrom ? [onlyFrom[1]] : [0, 1, 2, 3, 4, 5, 6, 7];
    for (const r of rows)
        for (const c of cols) {
            const p = b[r][c];
            if (!p || p.color !== color) continue;
            for (const m of pseudoMoves(b, r, c, epTarget, castle)) {
                const { board: nb } = applyMove(b, m, castle, epTarget);
                if (!inCheck(nb, color)) result.push(m);
            }
        }
    return result;
}

export function sameMove(a: Move, b: Move): boolean {
    return (
        a.from[0] === b.from[0] && a.from[1] === b.from[1] &&
        a.to[0] === b.to[0] && a.to[1] === b.to[1] &&
        a.promotion === b.promotion
    );
}

// ---- Evaluation + AI -------------------------------------------------------
const VALUE: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const PST_PAWN = [0, 5, 10, 15, 20, 25, 30, 0];

function evaluate(b: Board): number {
    let score = 0;
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (!p) continue;
            let v = VALUE[p.type];
            if (p.type === "p") v += p.color === "w" ? PST_PAWN[7 - r] : PST_PAWN[r];
            if (p.type === "n" || p.type === "b") v += 10; // small mobility bonus
            score += p.color === "b" ? v : -v;
        }
    return score; // positive = good for black (AI)
}

function minimax(
    b: Board,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean,
    castle: Record<string, boolean>,
    epTarget: [number, number] | null,
): number {
    const color: Color = maximizing ? "b" : "w";
    const moves = legalMoves(b, color, castle, epTarget);
    if (moves.length === 0) {
        if (inCheck(b, color)) return maximizing ? -99999 - depth : 99999 + depth;
        return 0;
    }
    if (depth === 0) return evaluate(b);
    let best = maximizing ? -Infinity : Infinity;
    for (const m of moves) {
        const next = applyMove(b, m, castle, epTarget);
        const val = minimax(next.board, depth - 1, alpha, beta, !maximizing, next.castle, next.epTarget);
        if (maximizing) {
            best = Math.max(best, val);
            alpha = Math.max(alpha, val);
        } else {
            best = Math.min(best, val);
            beta = Math.min(beta, val);
        }
        if (beta <= alpha) break;
    }
    return best;
}

export function chooseAiMove(
    b: Board,
    castle: Record<string, boolean>,
    epTarget: [number, number] | null,
    difficulty: "normal" | "hard",
): Move | null {
    const moves = legalMoves(b, "b", castle, epTarget);
    if (moves.length === 0) return null;
    const depth = difficulty === "hard" ? 3 : 2;
    let bestScore = -Infinity;
    let best: Move[] = [];
    for (const m of moves) {
        const next = applyMove(b, m, castle, epTarget);
        let val = minimax(next.board, depth - 1, -Infinity, Infinity, false, next.castle, next.epTarget);
        if (difficulty === "normal") val += (Math.random() - 0.5) * 80; // loosen
        if (val > bestScore) {
            bestScore = val;
            best = [m];
        } else if (val === bestScore) best.push(m);
    }
    return best[Math.floor(Math.random() * best.length)] ?? moves[0];
}
