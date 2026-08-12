// ========== JOGADOR (SEM CORRIDA) ==========
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.footOffset = 16;
        this.speed = 3.6; // Velocidade única de caminhada
        
        this.sanity = 100;
        this.maxSanity = 100;
        this.inventory = [null, null, null, null];
        this.selectedSlot = 0;
        
        this.hasLantern = false;
        this.lanternOn = false;
        this.lightRadius = 95;
        this.lanternRadius = 170;
        
        this.attackCooldown = 0;
        this.attackRange = 45;
        this.facing = 'down';
        this.invincible = 0;
        
        this.anim = 0;
        this.state = 'idle';
        this.sprite = new Image();
        this.sprite.src = 'assets/character/character_spritesheet.png';
        this.frameSize = 512;
        this.displaySize = 52; 
    }

    update() {
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
            this.state = 'punch';
        } else if (this.state === 'punch') {
            this.state = 'idle';
        }
        if (this.invincible > 0) this.invincible--;
    }

    move(dx, dy) {
        if (this.state === 'punch') return;

        if (dx === 0 && dy === 0) {
            this.state = 'idle';
            return;
        }

        this.state = 'walk';
        this.anim += 0.22; // Velocidade constante da animação

        if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
        else this.facing = dy > 0 ? 'down' : 'up';

        const len = Math.hypot(dx, dy) || 1;
        const mx = (dx / len) * this.speed;
        const my = (dy / len) * this.speed;

        const tx = this.x + mx;
        const ty = this.y + my;
        const foot = this.footOffset;

        const canMoveX = !this.solidAt(tx, this.y) && 
                         (typeof hitsDynamic !== 'function' || !hitsDynamic(tx, this.y + foot, this.radius));
        
        const canMoveY = !this.solidAt(this.x, ty) && 
                         (typeof hitsDynamic !== 'function' || !hitsDynamic(this.x, ty + foot, this.radius));

        if (canMoveX) this.x = tx;
        if (canMoveY) this.y = ty;

        this.x = Math.max(16, Math.min(MAP_W - 16, this.x));
        this.y = Math.max(16, Math.min(MAP_H - 16, this.y));
    }

    solidAt(px, py) {
        const footY = py + this.footOffset;
        const r = this.radius * 0.7;
        const pts = [[px, footY], [px - r, footY], [px + r, footY]];
        for (const [x, y] of pts) {
            if (typeof isSolid === 'function' && isSolid(x, y)) return true;
        }
        return false;
    }

    drawWorld(ctx) {
        const x = this.x, y = this.y;
        ctx.save();
        
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + 18, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        const dirMap = { 'down': 0, 'up': 1, 'left': 2, 'right': 3 };
        let col = dirMap[this.facing];
        let row = 0; // Sempre usa a linha 0 (Walk) ou 2 (Punch)
        let currentFrame = 0;

        if (this.state === 'punch') {
            row = 2;
            const maxCooldown = this.hasItem('faca') ? 14 : 22;
            currentFrame = Math.min(2, Math.floor((1 - this.attackCooldown / maxCooldown) * 3));
        } else if (this.state === 'walk') {
            row = 0;
            currentFrame = Math.floor(this.anim) % 4;
        } else {
            row = 0; // Idle usa o primeiro frame do andar
            currentFrame = 0;
        }

        const sx = (col * 4 + currentFrame) * this.frameSize;
        const sy = row * this.frameSize;

        if (this.invincible > 0 && Math.floor(this.invincible / 3) % 2 === 0) ctx.globalAlpha = 0.5;

        ctx.drawImage(this.sprite, sx, sy, this.frameSize, this.frameSize, 
                      x - this.displaySize/2, y - this.displaySize*0.8, this.displaySize, this.displaySize);
        ctx.restore();
    }
    
    // Métodos de utilidade
    takeDamage(amount) { if (this.invincible <= 0) { this.sanity = Math.max(0, this.sanity - amount); this.invincible = 40; } }
    heal(amount) { this.sanity = Math.min(this.maxSanity, this.sanity + amount); }
    addItem(type) { for (let i = 0; i < 4; i++) { if (!this.inventory[i]) { this.inventory[i] = type; return true; } } return false; }
    hasItem(type) { return this.inventory.includes(type); }
    useSelectedItem() {
        const item = this.inventory[this.selectedSlot];
        if (!item) return null;
        if (item === 'cafe') { this.heal(25); this.inventory[this.selectedSlot] = null; return 'Café. +25 sanidade.'; }
        if (item === 'lanterna') { this.hasLantern = true; this.lanternOn = true; this.inventory[this.selectedSlot] = null; return 'Lanterna equipada.'; }
        return null;
    }
}
