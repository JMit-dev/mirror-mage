import Vec2 from "../../../Wolfie2D/DataTypes/Vec2";
import { GameEventType } from "../../../Wolfie2D/Events/GameEventType";
import { PlayerStates } from "../PlayerController";

import PlayerState from "./PlayerState";

export default class Jump extends PlayerState {
    private wobbleTimer: number = 0;
    private wobbleRate: number = 4;
    private wobbleRate2: number = 6.5;  // Second oscillator — irrational ratio = chaotic Lissajous
    private jumpGravity: number = 500;

	public onEnter(_options: Record<string, any>): void {
        let jumpAudio = this.owner.getScene().getJumpAudioKey();
        // Random jump strength
        this.parent.velocity.y = -(370 + Math.random() * 80);
        this.wobbleTimer = 0;
        this.wobbleRate  = 2.5 + Math.random() * 5.5;
        this.wobbleRate2 = this.wobbleRate * (1.4 + Math.random() * 0.8);
        this.jumpGravity = 460 + Math.random() * 100;
		this.emitter.fireEvent(GameEventType.PLAY_SOUND, {key: jumpAudio, loop: false, holdReference: false});
	}

	public update(deltaT: number): void {
        super.update(deltaT);

        if (this.owner.onGround) {
			this.finished(PlayerStates.IDLE);
		} else if(this.owner.onCeiling || this.parent.velocity.y >= 0){
            this.finished(PlayerStates.FALL);
		} else {
            let dir = this.parent.inputDir;
            this.parent.velocity.x += dir.x * this.parent.speed / 3.5 - 0.3 * this.parent.velocity.x;
            this.parent.velocity.y += this.jumpGravity * deltaT;

            // Chaotic horizontal kicks mid-air
            if (Math.random() < deltaT * 4) {
                this.parent.velocity.x += (Math.random() - 0.5) * 200;
            }

            // Lissajous aim: two oscillators at irrational ratio → sweeps all directions
            this.wobbleTimer += deltaT;
            const t = this.wobbleTimer;
            const aimX = Math.cos(t * this.wobbleRate  * 2 * Math.PI);
            const aimY = Math.sin(t * this.wobbleRate2 * 2 * Math.PI);
            const len  = Math.sqrt(aimX * aimX + aimY * aimY) || 1;
            const normX = aimX / len;
            const normY = aimY / len;

            // Set aim direction — PlayerController reads this for firing
            this.parent.aimDirection = new Vec2(normX, normY);
            this.owner.invertX = normX < 0;

            // Visual wobble rotation (±20 degrees)
            this.owner.rotation = Math.sin(t * this.wobbleRate * 2 * Math.PI) * 0.35;

            this.owner.move(this.parent.velocity.scaled(deltaT));
        }
	}

	public onExit(): Record<string, any> {
        // Reset visual state when landing
        this.owner.rotation = 0;
        this.parent.aimDirection = new Vec2(this.owner.invertX ? -1 : 1, 0);
		this.owner.animation.stop();
		return {};
	}
}
