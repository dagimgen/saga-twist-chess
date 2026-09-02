// ---------------------------------------------------------------------------
// Procedural medieval chess piece textures via Phaser Graphics -> generateTexture.
// Each piece is drawn with layered armor shading, gold inlays, faction emblems,
// and a soft drop shadow so they read as gothic vector sprites (not boxes).
// ---------------------------------------------------------------------------
import type { Scene } from "phaser";
import { COLORS } from "../game/utils";

const TEX = 96; // texture size per piece

function shade(g: Scene["add"], _x: number) {
    void g; void _x;
}

// Base silhouette helpers -----------------------------------------------------
function pedestal(g: Phaser.GameObjects.Graphics, base: number, accent: number) {
    g.fillStyle(base, 1);
    g.fillRoundedRect(20, 78, 56, 12, 4);
    g.fillStyle(accent, 1);
    g.fillRoundedRect(24, 74, 48, 8, 3);
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(48, 90, 60, 8);
}

function body(g: Phaser.GameObjects.Graphics, color: number, inlay: number) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(32, 40, 32, 38, 6);
    g.fillStyle(inlay, 1);
    g.fillRect(32, 58, 32, 4);
}

// Individual pieces -----------------------------------------------------------
function drawPawn(g: Phaser.GameObjects.Graphics, color: number, inlay: number, rune: number) {
    pedestal(g, color, inlay);
    g.fillStyle(color, 1);
    g.fillCircle(48, 40, 13); // helm
    g.fillStyle(rune, 1);
    g.fillRect(46, 22, 4, 14); // spear tip
    g.fillStyle(inlay, 1);
    g.fillTriangle(48, 20, 44, 30, 52, 30);
    g.fillStyle(color, 1);
    g.fillRoundedRect(38, 48, 20, 28, 5);
    g.fillStyle(inlay, 0.9);
    g.fillCircle(48, 40, 5);
}

function drawRook(g: Phaser.GameObjects.Graphics, color: number, inlay: number, rune: number) {
    pedestal(g, color, inlay);
    g.fillStyle(color, 1);
    g.fillRoundedRect(30, 34, 36, 44, 4); // tower
    // battlements
    for (let i = 0; i < 4; i++) g.fillRect(30 + i * 10, 24, 6, 12);
    g.fillStyle(inlay, 1);
    g.fillRect(30, 46, 36, 4);
    g.fillStyle(rune, 1);
    g.fillRect(44, 52, 8, 18); // arrow slit
    g.fillStyle(0x000000, 0.2);
    g.fillRect(30, 34, 6, 44);
}

function drawKnight(g: Phaser.GameObjects.Graphics, color: number, inlay: number, rune: number) {
    pedestal(g, color, inlay);
    g.fillStyle(color, 1);
    g.fillTriangle(34, 78, 62, 78, 40, 40); // neck
    g.fillCircle(52, 40, 14); // head
    g.fillTriangle(58, 30, 70, 40, 56, 44); // snout
    g.fillTriangle(44, 26, 50, 14, 54, 28); // ear
    g.fillStyle(inlay, 1);
    g.fillRect(36, 60, 22, 4);
    g.fillStyle(rune, 1);
    g.fillCircle(54, 38, 2.5); // eye
}

function drawBishop(g: Phaser.GameObjects.Graphics, color: number, inlay: number, rune: number) {
    pedestal(g, color, inlay);
    g.fillStyle(color, 1);
    g.fillRoundedRect(36, 44, 24, 34, 8); // robe
    g.fillCircle(48, 34, 12); // mitre
    g.fillTriangle(48, 16, 40, 34, 56, 34); // mitre peak
    g.fillStyle(inlay, 1);
    g.fillRect(46, 12, 4, 12); // crosier
    g.fillRect(42, 16, 12, 4);
    g.fillStyle(rune, 1);
    g.fillCircle(48, 56, 4); // rune glow
}

function drawQueen(g: Phaser.GameObjects.Graphics, color: number, inlay: number, rune: number) {
    pedestal(g, color, inlay);
    g.fillStyle(color, 1);
    g.fillRoundedRect(34, 44, 28, 34, 6); // gown
    g.fillCircle(48, 34, 13); // head
    // crown spikes
    for (let i = 0; i < 5; i++) {
        const cx = 36 + i * 6;
        g.fillTriangle(cx, 26, cx + 4, 26, cx + 2, 14 + (i % 2) * 4);
    }
    g.fillStyle(inlay, 1);
    g.fillRect(34, 28, 28, 5);
    g.fillStyle(rune, 1);
    for (let i = 0; i < 5; i++) g.fillCircle(38 + i * 6, 20, 2);
    g.fillStyle(inlay, 0.9);
    g.fillCircle(48, 58, 5);
}

function drawKing(g: Phaser.GameObjects.Graphics, color: number, inlay: number, rune: number) {
    pedestal(g, color, inlay);
    g.fillStyle(color, 1);
    g.fillRoundedRect(34, 42, 28, 36, 6); // mantle
    g.fillCircle(48, 32, 13); // head
    // crown band + cross
    g.fillStyle(inlay, 1);
    g.fillRect(34, 24, 28, 7);
    g.fillRect(45, 8, 6, 16);
    g.fillRect(40, 13, 16, 6);
    g.fillStyle(rune, 1);
    g.fillCircle(48, 16, 2.5);
    g.fillStyle(0x000000, 0.18);
    g.fillRect(34, 42, 6, 36);
}

const DRAW: Record<string, (g: Phaser.GameObjects.Graphics, c: number, i: number, r: number) => void> = {
    p: drawPawn,
    r: drawRook,
    n: drawKnight,
    b: drawBishop,
    q: drawQueen,
    k: drawKing,
};

// Generate all 12 piece textures + a few FX/icons.
export function buildPieceTextures(scene: Scene) {
    void shade;
    const kinds = ["p", "n", "b", "r", "q", "k"];
    const factions: { color: "w" | "b"; body: number; inlay: number; rune: number }[] = [
        { color: "w", body: COLORS.whitePiece, inlay: COLORS.whiteInlay, rune: COLORS.goldBright },
        { color: "b", body: COLORS.blackPiece, inlay: COLORS.blackRune, rune: COLORS.attackRune },
    ];
    for (const f of factions) {
        for (const kind of kinds) {
            const g = scene.add.graphics();
            DRAW[kind](g, f.body, f.inlay, f.rune);
            g.generateTexture(`piece_${kind}_${f.color}`, TEX, TEX);
            g.destroy();
        }
    }

    // FX: spark
    const spark = scene.add.graphics();
    spark.fillStyle(0xfff3b0, 1);
    spark.fillCircle(8, 8, 6);
    spark.fillStyle(0xffd54f, 0.7);
    spark.fillCircle(8, 8, 3);
    spark.generateTexture("fx_spark", 16, 16);
    spark.destroy();

    // FX: slash
    const slash = scene.add.graphics();
    slash.lineStyle(5, 0xffe082, 0.9);
    slash.beginPath();
    slash.moveTo(4, 40);
    slash.lineTo(56, 8);
    slash.strokePath();
    slash.lineStyle(2, 0xffffff, 0.9);
    slash.beginPath();
    slash.moveTo(6, 38);
    slash.lineTo(54, 10);
    slash.strokePath();
    slash.generateTexture("fx_slash", 60, 48);
    slash.destroy();

    // Icon: sword
    const sword = scene.add.graphics();
    sword.fillStyle(0xcfd8dc, 1);
    sword.fillTriangle(24, 4, 20, 40, 28, 40);
    sword.fillStyle(0xb8860b, 1);
    sword.fillRect(12, 40, 24, 6);
    sword.fillStyle(0x5d4037, 1);
    sword.fillRect(21, 46, 6, 16);
    sword.generateTexture("icon_sword", 48, 64);
    sword.destroy();

    // Icon: shield
    const shield = scene.add.graphics();
    shield.fillStyle(0x8e2800, 1);
    shield.fillRoundedRect(8, 8, 40, 44, 8);
    shield.fillStyle(0xf1c40f, 1);
    shield.fillTriangle(28, 16, 18, 34, 26, 34);
    shield.fillTriangle(28, 44, 26, 28, 34, 30);
    shield.generateTexture("icon_shield", 56, 60);
    shield.destroy();
}