// ---------------------------------------------------------------------------
// Shared types, constants, lore, plot twists and procedural audio helpers for
// Grand Duel: Medieval Story Chess. Kept in ONE utils module per the flat
// layout rule (consumed by both src/game/main.ts and src/App.tsx).
// ---------------------------------------------------------------------------

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Color = "w" | "b";
export interface Piece {
    type: PieceType;
    color: Color;
}
export type Board = (Piece | null)[][]; // [row][col], row 0 = black back rank

export interface Move {
    from: [number, number];
    to: [number, number];
    piece: PieceType;
    color: Color;
    captured?: PieceType;
    promotion?: PieceType;
    castle?: "k" | "q";
    enPassant?: boolean;
    doublePush?: boolean;
    check?: boolean;
    mate?: boolean;
}

export type GamePhase =
    | "BOOT"
    | "MENU"
    | "PLAYING"
    | "DUEL_CLASH"
    | "PLOT_TWIST_EVENT"
    | "PAUSED"
    | "FINISHED"
    | "CODEX";

export interface PieceLore {
    name: string;
    title: string;
    faction: string;
    quote: string;
    backstory: string;
    stat: { atk: number; def: number; spd: number };
}

export interface PieceData {
    type: PieceType;
    color: Color;
    square: string;
}

export interface PlotTwist {
    title: string;
    description: string;
    effect: string;
    choices?: string[];
}

// ---- Event name constants (single source of truth) -------------------------
export const EV = {
    PHASE: "phase-changed",
    SELECTED: "piece-selected",
    MOVE: "move-made",
    TWIST: "plot-twist-triggered",
    DUEL_START: "duel-started",
    DUEL_DONE: "duel-completed",
    GAME_OVER: "game-over",
    START: "start-game",
    PAUSE: "toggle-pause",
    RESTART: "restart-game",
    CODEX: "open-codex",
    SCENE_READY: "current-scene-ready",
    RESOLVE_DUEL: "duel-resolve",
    HINT: "request-hint",
    CAPTURED: "captured-updated",
    STATE: "board-state",
} as const;

// ---- Board geometry (540 x 960 portrait) -----------------------------------
export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;
export const SQ = 58;
export const BOARD_PX = SQ * 8; // 464
export const BOARD_X = Math.round((GAME_WIDTH - BOARD_PX) / 2); // 38
export const BOARD_Y = 232;

export const COLORS = {
    darkSq: 0x3e2723,
    lightSq: 0xd7ccc8,
    gold: 0xb8860b,
    goldBright: 0xf1c40f,
    whitePiece: 0xfff8e1,
    whiteInlay: 0xc5a059,
    blackPiece: 0x212121,
    blackRune: 0x8e2800,
    moveRune: 0x4caf50,
    attackRune: 0xe53935,
    select: 0xffd54f,
    velvet: 0x1a120b,
} as const;

// ---- Algebraic helpers -----------------------------------------------------
export const FILES = "abcdefgh";
export function squareName(r: number, c: number): string {
    return FILES[c] + (8 - r);
}

// ---- Piece lore database ---------------------------------------------------
const LORE_W: Record<PieceType, PieceLore> = {
    p: {
        name: "Sir Cedric",
        title: "Peasant Conscript",
        faction: "Crown of the Dawn",
        quote: "For my village, I advance through the mud! Only steps to glory.",
        backstory:
            "A farmhand pressed into service, Cedric dreams of knighthood. Each square he crosses is a prayer for the home he may never see again. Should he reach the far rank, the blood of kings is said to stir within him.",
        stat: { atk: 2, def: 3, spd: 1 },
    },
    n: {
        name: "Dame Valerie",
        title: "Assassin of the Veil",
        faction: "Crown of the Dawn",
        quote: "I leap where no path exists. The enemy never hears the hoof.",
        backstory:
            "Sworn to a silent order, Valerie rides between the shadows of the board. Her lance has ended three succession wars, and she answers to no banner but her own quiet code.",
        stat: { atk: 6, def: 4, spd: 7 },
    },
    b: {
        name: "Lady Judith",
        title: "Zealous Inquisitor",
        faction: "Crown of the Dawn",
        quote: "By the ancient oaths, I purge the diagonals of all heresy.",
        backstory:
            "A fire-eyed cleric who reads omens in every slant of light. Judith's crosier is consecrated to root out corruption, and her prayers cut as cleanly as any blade.",
        stat: { atk: 5, def: 5, spd: 6 },
    },
    r: {
        name: "Baron Boris",
        title: "Iron Siege Tower",
        faction: "Crown of the Dawn",
        quote: "I do not retreat. I advance, and the walls fall before me.",
        backstory:
            "Lord of the northern keeps, Boris is a living fortress. His battlements have weathered a hundred sieges, and he carries the grudge of every stone the enemy ever broke.",
        stat: { atk: 7, def: 9, spd: 4 },
    },
    q: {
        name: "Queen Alyssa",
        title: "Sorceress Monarch",
        faction: "Crown of the Dawn",
        quote: "Every line obeys me. Watch your throne, cousin.",
        backstory:
            "Alyssa seized the scepter through a bargain with forces older than the realm. She moves as lightning and rules as winter — beloved, feared, and utterly alone.",
        stat: { atk: 10, def: 7, spd: 10 },
    },
    k: {
        name: "King Aurelius",
        title: "The Burdened Ruler",
        faction: "Crown of the Dawn",
        quote: "I am the realm. If I fall, the chronicle ends.",
        backstory:
            "A good man wearing a crown too heavy for his brow. Aurelius knows every loss on this board is a name he will carry into the next life. He steps only when his people demand it.",
        stat: { atk: 4, def: 10, spd: 2 },
    },
};

const LORE_B: Record<PieceType, PieceLore> = {
    p: {
        name: "Grunt Tobrik",
        title: "Thrall of the Ash",
        faction: "Empire of Cinders",
        quote: "The dark master promised me a name. I will take one with my spear.",
        backstory:
            "Born in the sulfur pits, Tobrik has never once seen the sun. He marches for the single coin that will buy his mother's freedom — and for the rage of a man who has nothing left to lose.",
        stat: { atk: 2, def: 3, spd: 1 },
    },
    n: {
        name: "Warlord Kaine",
        title: "Renegade Knight",
        faction: "Empire of Cinders",
        quote: "I broke my oath to my king to keep a darker one.",
        backstory:
            "Once a champion of the Dawn, Kaine defected for a secret he refuses to name. His horse snorts embers, and his lance seeks the throat of the throne he once swore to defend.",
        stat: { atk: 6, def: 4, spd: 7 },
    },
    b: {
        name: "Hierarch Voss",
        title: "Hollow Prophet",
        faction: "Empire of Cinders",
        quote: "Your gods are silent. Mine are screaming. I serve the louder.",
        backstory:
            "Voss traded his soul for the gift of prophecy and now sees only endings. He preaches a gospel of ash to an army that has stopped asking questions.",
        stat: { atk: 5, def: 5, spd: 6 },
    },
    r: {
        name: "Dreadnought Morgh",
        title: "Black Bastion",
        faction: "Empire of Cinders",
        quote: "I am the gate that does not open. Pass, or be broken upon me.",
        backstory:
            "Forged from the hull of a sunken war-galleon, Morgh is more ruin than soldier. He guards the enemy flank with the patience of a collapsed keep.",
        stat: { atk: 7, def: 9, spd: 4 },
    },
    q: {
        name: "Empress Nyx",
        title: "Widow of Cinders",
        faction: "Empire of Cinders",
        quote: "I buried my king and wore his crown. Do not test my grief.",
        backstory:
            "Nyx burned her own capital to deny it to invaders. Now she commands the field with a cold brilliance that has unmade two allied houses.",
        stat: { atk: 10, def: 7, spd: 10 },
    },
    k: {
        name: "Tyrant Malakor",
        title: "The Cinder Crown",
        faction: "Empire of Cinders",
        quote: "Let them come. My blood is the mortar of this empire.",
        backstory:
            "Malakor seized the throne by a betrayal still whispered in the halls. He rules through fear and knows, one day, the board will demand its reckoning.",
        stat: { atk: 4, def: 10, spd: 2 },
    },
};

export function getLore(type: PieceType, color: Color): PieceLore {
    return color === "w" ? LORE_W[type] : LORE_B[type];
}

// Codex listing for the lore archive overlay.
export const CODEX: { type: PieceType; w: PieceLore; b: PieceLore }[] = (
    ["p", "n", "b", "r", "q", "k"] as PieceType[]
).map((t) => ({ type: t, w: LORE_W[t], b: LORE_B[t] }));

// ---- Plot twist engine -----------------------------------------------------
export const PLOT_TWISTS: PlotTwist[] = [
    {
        title: "The Pawn's Secret Royal Bloodline",
        description:
            "A birthmark of the old dynasty is found upon a humble footman. The ranks murmur — a conscript may be a lost heir.",
        effect: "Pawns now march with doubled conviction. (Promotion is foretold.)",
    },
    {
        title: "Betrayal in the Ranks",
        description:
            "An enemy Bishop was a double agent all along. Whispers of a secret pact unravel the enemy's counsel.",
        effect: "The enemy hesitates. Their next strike is less certain.",
    },
    {
        title: "Vengeance of the Fallen",
        description:
            "For every comrade lost, a survivor burns brighter. Grief becomes steel.",
        effect: "A fallen ally is avenged — honor rises.",
    },
    {
        title: "The Necromancer's Eclipse",
        description:
            "A black sun blots the field. For a heartbeat, the dead consider returning.",
        effect: "An omen of dark magic. The next capture echoes with dread.",
    },
    {
        title: "The King's Illegitimate Heir",
        description:
            "A hooded stranger claims royal blood before the throne. Loyalties fracture along the back rank.",
        effect: "The monarch's guard grows uneasy. Castling may yet save the crown.",
    },
    {
        title: "Divine Blessing of the Dawn",
        description:
            "A shaft of golden light breaks the clouds and rests upon your banner.",
        effect: "The heavens favor you. A move is whispered to your commander.",
    },
];

export function randomTwist(): PlotTwist {
    return PLOT_TWISTS[Math.floor(Math.random() * PLOT_TWISTS.length)];
}

// ---- AI taunts -------------------------------------------------------------
export const TAUNTS: string[] = [
    'Your position crumbles, sovereign.',
    'I have read this chronicle before. You lose.',
    'Every pawn you spend is a verse in my elegy.',
    'The dark empire does not negotiate.',
    'Check, little king. The noose tightens.',
    'Glory is a debt, and you are overdrawn.',
];
export function randomTaunt(): string {
    return TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
}

// ---- Procedural Web Audio synthesizer (no external files) ------------------
class AudioEngine {
    private ctx: AudioContext | null = null;
    muted = false;

    private ensure(): AudioContext | null {
        if (typeof window === "undefined") return null;
        if (!this.ctx) {
            const AC =
                (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
                    .AudioContext ||
                (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (AC) this.ctx = new AC();
        }
        if (this.ctx && this.ctx.state === "suspended") {
            void this.ctx.resume();
        }
        return this.ctx;
    }

    private tone(
        freq: number,
        dur: number,
        type: OscillatorType,
        vol: number,
        when = 0,
        glideTo?: number,
    ) {
        if (this.muted) return;
        const ctx = this.ensure();
        if (!ctx) return;
        const t0 = ctx.currentTime + when;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    }

    private noise(dur: number, vol: number, when = 0, hp = 800) {
        if (this.muted) return;
        const ctx = this.ensure();
        if (!ctx) return;
        const t0 = ctx.currentTime + when;
        const frames = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filt = ctx.createBiquadFilter();
        filt.type = "highpass";
        filt.frequency.value = hp;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(filt).connect(gain).connect(ctx.destination);
        src.start(t0);
    }

    playMove() {
        this.tone(180, 0.12, "triangle", 0.25, 0, 90);
        this.noise(0.08, 0.12, 0, 400);
    }
    playCapture() {
        this.noise(0.18, 0.3, 0, 1200);
        this.tone(320, 0.18, "sawtooth", 0.2, 0, 120);
        this.tone(640, 0.12, "square", 0.12, 0.02);
    }
    playCheck() {
        this.tone(440, 0.35, "sawtooth", 0.18, 0, 330);
        this.tone(220, 0.4, "triangle", 0.16, 0.02, 165);
    }
    playTwist() {
        this.tone(523, 0.2, "sine", 0.16);
        this.tone(659, 0.2, "sine", 0.16, 0.12);
        this.tone(784, 0.3, "sine", 0.16, 0.24);
        this.tone(1046, 0.35, "sine", 0.12, 0.36);
    }
    playVictory() {
        const notes = [523, 659, 784, 1046, 784, 1046];
        notes.forEach((n, i) => this.tone(n, 0.3, "square", 0.16, i * 0.14));
    }
    playDefeat() {
        this.tone(220, 0.6, "sawtooth", 0.18, 0, 110);
        this.tone(164, 0.8, "triangle", 0.16, 0.1, 82);
    }
    playClick() {
        this.tone(660, 0.05, "square", 0.12);
        this.noise(0.04, 0.06, 0, 2000);
    }
    playDuel() {
        this.noise(0.1, 0.28, 0, 1500);
        this.tone(880, 0.1, "sawtooth", 0.16, 0, 220);
    }
    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }
}

export const audio = new AudioEngine();