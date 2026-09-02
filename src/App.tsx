import { useEffect, useRef, useState } from "react";
import StartGame, { EventBus } from "./game/main";
import type { Game as GameScene } from "./game/main";
import {
    CODEX, EV, audio,
} from "./game/utils";
import type { Color, GamePhase, Move, PieceData, PieceLore, PieceType, PlotTwist } from "./game/utils";

interface IRefPhaserGame {
    game: Phaser.Game | null;
    scene: Phaser.Scene | null;
}

const PIECE_LABEL: Record<PieceType, string> = {
    p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King",
};
const PIECE_GLYPH: Record<PieceType, string> = {
    p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

function factionName(color: Color) {
    return color === "w" ? "Crown of the Dawn" : "Empire of Cinders";
}

export default function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [phase, setPhase] = useState<GamePhase>("BOOT");
    const [mode, setMode] = useState<"ai" | "pvp">("ai");
    const [difficulty, setDifficulty] = useState<"normal" | "hard">("normal");
    const [selected, setSelected] = useState<{ piece: PieceData; lore: PieceLore } | null>(null);
    const [turn, setTurn] = useState<Color>("w");
    const [check, setCheck] = useState(false);
    const [taunt, setTaunt] = useState<string | null>(null);
    const [captured, setCaptured] = useState<{ white: PieceType[]; black: PieceType[] }>({ white: [], black: [] });
    const [twist, setTwist] = useState<PlotTwist | null>(null);
    const [duel, setDuel] = useState<{ attacker: PieceData & { lore: PieceLore }; defender: PieceData & { lore: PieceLore } } | null>(null);
    const [duelResult, setDuelResult] = useState<{ winner: "attacker" | "defender"; story: string } | null>(null);
    const [duelMeter, setDuelMeter] = useState(0);
    const duelTimer = useRef<number | null>(null);
    const [over, setOver] = useState<{ winner: Color | "draw"; reason: string; epilogue: string; chronicle: { moves: number; capturedByWhite: number; capturedByBlack: number } } | null>(null);
    const [muted, setMuted] = useState(false);

    // ---- Mount Phaser ------------------------------------------------------
    useEffect(() => {
        if (phaserRef.current === null) {
            const game = StartGame("game-container");
            phaserRef.current = { game, scene: null };
        }
        const onReady = (scene: Phaser.Scene) => {
            if (phaserRef.current) phaserRef.current.scene = scene;
        };
        EventBus.on(EV.SCENE_READY, onReady);

        const onPhase = (p: GamePhase) => setPhase(p);
        const onSelect = (d: { piece: PieceData; lore: PieceLore }) => setSelected(d);
        const onMove = (d: { move?: Move; turn?: Color; isCheck?: boolean; taunt?: string }) => {
            if (d.taunt) { setTaunt(d.taunt); return; }
            if (d.turn) setTurn(d.turn === "w" ? "b" : "w");
            setCheck(!!d.isCheck);
        };
        const onCaptured = (d: { white: PieceType[]; black: PieceType[] }) => setCaptured(d);
        const onTwist = (t: PlotTwist) => setTwist(t);
        const onDuelStart = (d: { attacker: PieceData & { lore: PieceLore }; defender: PieceData & { lore: PieceLore } }) => {
            setDuel(d); setDuelResult(null); setDuelMeter(0);
        };
        const onDuelDone = (d: { winner: "attacker" | "defender"; duelStory: string }) => {
            setDuelResult({ winner: d.winner, story: d.duelStory });
        };
        const onOver = (d: { winner: Color | "draw"; reason: string; epilogue: string; chronicle: { moves: number; capturedByWhite: number; capturedByBlack: number } }) => {
            setOver(d); setTurn(d.winner === "draw" ? "w" : d.winner);
        };

        EventBus.on(EV.PHASE, onPhase);
        EventBus.on(EV.SELECTED, onSelect);
        EventBus.on(EV.MOVE, onMove);
        EventBus.on(EV.CAPTURED, onCaptured);
        EventBus.on(EV.TWIST, onTwist);
        EventBus.on(EV.DUEL_START, onDuelStart);
        EventBus.on(EV.DUEL_DONE, onDuelDone);
        EventBus.on(EV.GAME_OVER, onOver);

        return () => {
            EventBus.off(EV.SCENE_READY, onReady);
            EventBus.off(EV.PHASE, onPhase);
            EventBus.off(EV.SELECTED, onSelect);
            EventBus.off(EV.MOVE, onMove);
            EventBus.off(EV.CAPTURED, onCaptured);
            EventBus.off(EV.TWIST, onTwist);
            EventBus.off(EV.DUEL_START, onDuelStart);
            EventBus.off(EV.DUEL_DONE, onDuelDone);
            EventBus.off(EV.GAME_OVER, onOver);
            if (duelTimer.current) window.clearInterval(duelTimer.current);
            phaserRef.current?.game?.destroy(true);
            phaserRef.current = null;
        };
    }, []);

    // ---- Duel quick-time meter --------------------------------------------
    useEffect(() => {
        if (phase !== "DUEL_CLASH" || !duel || duelResult) {
            if (duelTimer.current) { window.clearInterval(duelTimer.current); duelTimer.current = null; }
            return;
        }
        let dir = 1;
        duelTimer.current = window.setInterval(() => {
            setDuelMeter((prev) => {
                let next = prev + dir * 4;
                if (next >= 100) { next = 100; dir = -1; }
                if (next <= 0) { next = 0; dir = 1; }
                return next;
            });
        }, 24);
        return () => { if (duelTimer.current) { window.clearInterval(duelTimer.current); duelTimer.current = null; } };
    }, [phase, duel, duelResult]);

    const strike = () => {
        if (!duel || duelResult) return;
        const inZone = duelMeter >= 62 && duelMeter <= 88;
        const winner: "attacker" | "defender" = inZone ? "attacker" : "defender";
        EventBus.emit(EV.RESOLVE_DUEL, winner);
    };

    const startGame = (m: "ai" | "pvp") => {
        audio.playClick();
        setMode(m);
        setOver(null); setSelected(null); setTaunt(null); setCheck(false);
        setCaptured({ white: [], black: [] });
        EventBus.emit(EV.START, { mode: m, difficulty });
    };

    const dismissTwist = () => {
        audio.playClick();
        setTwist(null);
        (phaserRef.current?.scene as GameScene | null)?.resolveTwist();
    };

    const backToMenu = () => {
        audio.playClick();
        setOver(null); setDuel(null); setTwist(null);
        EventBus.emit(EV.PHASE, "MENU");
    };

    const closeDuelResult = () => {
        setDuel(null); setDuelResult(null);
    };

    const toggleMute = () => { audio.playClick(); setMuted(audio.toggleMute()); };

    const playing = phase === "PLAYING" || phase === "PAUSED" || phase === "DUEL_CLASH" || phase === "PLOT_TWIST_EVENT";

    return (
        <div id="app">
            <div id="game-container"></div>

            {/* ---------- In-game HUD ---------- */}
            {playing && (
                <div className="hud">
                    <div className="hud-top">
                        <div className={`turn-pill ${turn === "w" ? "white" : "black"}`}>
                            <span className="turn-sword">{turn === "w" ? "⚔" : "⚔"}</span>
                            {phase === "PLAYING" && mode === "ai" && turn === "b"
                                ? "Enemy Grandmaster scheming…"
                                : `${factionName(turn)} to move`}
                            {check && <span className="check-badge">CHECK!</span>}
                        </div>
                        <div className="hud-btns">
                            <button className="mini-btn" onClick={() => { EventBus.emit(EV.HINT); }} title="Hint">?</button>
                            <button className="mini-btn" onClick={toggleMute} title="Sound">{muted ? "\u{1F507}" : "\u{1F508}"}</button>
                            <button className="mini-btn" onClick={() => EventBus.emit(EV.PAUSE)} title="Pause">II</button>
                            <button className="mini-btn" onClick={() => setPhase("CODEX")} title="Codex">✦</button>
                        </div>
                    </div>
                    <div className="vaults">
                        <div className="vault">
                            <span className="vault-label">Dawn took</span>
                            <span className="vault-pieces">{captured.white.map((p, i) => <span key={i} className="cap-glyph">{PIECE_GLYPH[p]}</span>)}</span>
                        </div>
                        <div className="vault">
                            <span className="vault-label">Cinders took</span>
                            <span className="vault-pieces">{captured.black.map((p, i) => <span key={i} className="cap-glyph dark">{PIECE_GLYPH[p]}</span>)}</span>
                        </div>
                    </div>
                    {taunt && <div className="taunt-bar">{taunt}</div>}
                </div>
            )}

            {/* ---------- Story card (bottom) ---------- */}
            {playing && selected && phase === "PLAYING" && (
                <div className="story-card">
                    <div className="story-portrait" data-color={selected.piece.color}>{PIECE_GLYPH[selected.piece.type]}</div>
                    <div className="story-body">
                        <div className="story-head">
                            <strong>{selected.lore.name}</strong>
                            <span className="story-title">{selected.lore.title} · {PIECE_LABEL[selected.piece.type]} · {selected.piece.square}</span>
                        </div>
                        <p className="story-quote">“{selected.lore.quote}”</p>
                        <div className="story-stats">
                            <span>ATK {selected.lore.stat.atk}</span>
                            <span>DEF {selected.lore.stat.def}</span>
                            <span>SPD {selected.lore.stat.spd}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ---------- MENU ---------- */}
            {phase === "MENU" && (
                <div className="overlay menu">
                    <div className="parchment">
                        <h1 className="game-title">Grand Duel</h1>
                        <p className="subtitle">Chronicles of the 64 Realms</p>
                        <p className="blurb">A story-driven medieval chess saga. Every piece you move speaks its vow — and every clash may turn the chronicle.</p>
                        <div className="diff-row">
                            <span>Difficulty:</span>
                            <button className={`chip ${difficulty === "normal" ? "on" : ""}`} onClick={() => { audio.playClick(); setDifficulty("normal"); }}>Squire</button>
                            <button className={`chip ${difficulty === "hard" ? "on" : ""}`} onClick={() => { audio.playClick(); setDifficulty("hard"); }}>Grandmaster</button>
                        </div>
                        <button className="big-btn" onClick={() => startGame("ai")}>Solo Story Chronicle (vs AI)</button>
                        <button className="big-btn alt" onClick={() => startGame("pvp")}>1v1 Noble Room (Pass &amp; Play)</button>
                        <button className="ghost-btn" onClick={() => { audio.playClick(); setPhase("CODEX"); }}>Piece Codex / Lore Archive</button>
                        <button className="ghost-btn" onClick={toggleMute}>{muted ? "Sound: Off" : "Sound: On"}</button>
                    </div>
                </div>
            )}

            {/* ---------- PAUSED ---------- */}
            {phase === "PAUSED" && (
                <div className="overlay dim">
                    <div className="modal">
                        <h2>Chronicle Paused</h2>
                        <button className="big-btn" onClick={() => EventBus.emit(EV.PAUSE)}>Resume</button>
                        <button className="big-btn alt" onClick={() => EventBus.emit(EV.RESTART)}>Restart Duel</button>
                        <button className="ghost-btn" onClick={backToMenu}>Abandon to Menu</button>
                    </div>
                </div>
            )}

            {/* ---------- PLOT TWIST ---------- */}
            {phase === "PLOT_TWIST_EVENT" && twist && (
                <div className="overlay dim">
                    <div className="modal twist">
                        <div className="twist-tag">Plot Twist</div>
                        <h2>{twist.title}</h2>
                        <p className="twist-desc">{twist.description}</p>
                        <p className="twist-effect">{twist.effect}</p>
                        <button className="big-btn" onClick={dismissTwist}>Face the Fate</button>
                    </div>
                </div>
            )}

            {/* ---------- DUEL CLASH ---------- */}
            {phase === "DUEL_CLASH" && duel && (
                <div className="overlay duel">
                    <div className="duel-arena">
                        <h2 className="duel-title">Arena Duel — Last Piece Standing</h2>
                        <div className="duelists">
                            <div className="duelist atk">
                                <div className="duel-glyph" data-color={duel.attacker.color}>{PIECE_GLYPH[duel.attacker.type]}</div>
                                <strong>{duel.attacker.lore.name}</strong>
                                <span>{PIECE_LABEL[duel.attacker.type]}</span>
                                <p>“{duel.attacker.lore.quote}”</p>
                            </div>
                            <div className="vs">⚔</div>
                            <div className="duelist def">
                                <div className="duel-glyph" data-color={duel.defender.color}>{PIECE_GLYPH[duel.defender.type]}</div>
                                <strong>{duel.defender.lore.name}</strong>
                                <span>{PIECE_LABEL[duel.defender.type]}</span>
                                <p>“{duel.defender.lore.quote}”</p>
                            </div>
                        </div>

                        {!duelResult ? (
                            <div className="duel-qte">
                                <p className="qte-hint">Strike in the <b>golden band</b> to win the square!</p>
                                <div className="meter">
                                    <div className="meter-zone"></div>
                                    <div className="meter-needle" style={{ left: `${duelMeter}%` }}></div>
                                </div>
                                <button className="big-btn strike" onClick={strike}>STRIKE</button>
                            </div>
                        ) : (
                            <div className="duel-outcome">
                                <p className={`outcome ${duelResult.winner}`}>{duelResult.winner === "attacker" ? "Attacker prevails!" : "Defender holds the ground!"}</p>
                                <p className="outcome-story">{duelResult.story}</p>
                                <button className="big-btn" onClick={closeDuelResult}>Continue</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ---------- FINISHED ---------- */}
            {phase === "FINISHED" && over && (
                <div className="overlay dim">
                    <div className="modal victory">
                        <div className="crown">{over.winner === "draw" ? "⚔" : "\u{1F451}"}</div>
                        <h2>{over.winner === "draw" ? "A Bleeding Stalemate" : `${factionName(over.winner as Color)} Triumphant`}</h2>
                        <p className="reason">{over.reason}</p>
                        <p className="epilogue">{over.epilogue}</p>
                        <div className="chronicle">
                            <span>Moves: {over.chronicle.moves}</span>
                            <span>Dawn captures: {over.chronicle.capturedByWhite}</span>
                            <span>Cinders captures: {over.chronicle.capturedByBlack}</span>
                        </div>
                        <button className="big-btn" onClick={() => EventBus.emit(EV.RESTART)}>Rewrite the Chronicle</button>
                        <button className="ghost-btn" onClick={backToMenu}>Return to Menu</button>
                    </div>
                </div>
            )}

            {/* ---------- CODEX ---------- */}
            {phase === "CODEX" && (
                <div className="overlay codex">
                    <div className="codex-inner">
                        <h2>Piece Codex — Lore Archive</h2>
                        <div className="codex-grid">
                            {CODEX.map((row: { type: PieceType; w: PieceLore; b: PieceLore }) => (
                                <div className="codex-card" key={row.type}>
                                    <div className="codex-head">
                                        <span className="codex-glyph">{PIECE_GLYPH[row.type]}</span>
                                        <span>{PIECE_LABEL[row.type]}</span>
                                    </div>
                                    <div className="codex-side">
                                        <strong>{row.w.name}</strong> <em>{row.w.title}</em>
                                        <p>“{row.w.quote}”</p>
                                        <p className="codex-back">{row.w.backstory}</p>
                                    </div>
                                    <div className="codex-side dark">
                                        <strong>{row.b.name}</strong> <em>{row.b.title}</em>
                                        <p>“{row.b.quote}”</p>
                                        <p className="codex-back">{row.b.backstory}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="big-btn" onClick={() => { audio.playClick(); setPhase(over ? "FINISHED" : (mode ? "PLAYING" : "MENU")); }}>Close Codex</button>
                    </div>
                </div>
            )}
        </div>
    );
}