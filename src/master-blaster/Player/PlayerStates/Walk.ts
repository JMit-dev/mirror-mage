import { PlayerStates, PlayerAnimations } from "../PlayerController";
import PlayerState from "./PlayerState";

export default class Walk extends PlayerState {
    private walkTimer: number = 0;

	onEnter(_options: Record<string, any>): void {
		this.parent.speed = this.parent.MIN_SPEED;
        this.walkTimer = 0;
        this.owner.animation.playIfNotAlready(PlayerAnimations.WALK);
	}

	update(deltaT: number): void {
        super.update(deltaT);

		let dir = this.parent.inputDir;

		if(dir.isZero()){
			this.finished(PlayerStates.IDLE);
		} else if (this.parent.jumpJustPressed) {
            this.finished(PlayerStates.JUMP);
        } else if (!this.owner.onGround && this.parent.velocity.y !== 0) {
            this.finished(PlayerStates.FALL);
        } else {
            this.walkTimer += deltaT;
            // Slight random speed variation and body sway for wacky feel
            const speedVariance = 0.85 + Math.random() * 0.35;
            this.parent.velocity.y += this.gravity * deltaT;
            this.parent.velocity.x = dir.x * this.parent.speed * speedVariance;
            this.owner.rotation = Math.sin(this.walkTimer * 8) * 0.1;
            this.owner.move(this.parent.velocity.scaled(deltaT));
        }
	}

	onExit(): Record<string, any> {
        this.owner.rotation = 0;
		this.owner.animation.stop();
		return {};
	}
}
