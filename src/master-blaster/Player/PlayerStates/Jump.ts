import GameEvent from "../../../Wolfie2D/Events/GameEvent";
import { GameEventType } from "../../../Wolfie2D/Events/GameEventType";
import { PlayerStates } from "../PlayerController";

import PlayerState from "./PlayerState";

export default class Jump extends PlayerState {
    private wobbleTimer: number = 0;
    private wobbleRate: number = 4;

	public onEnter(options: Record<string, any>): void {
        let jumpAudio = this.owner.getScene().getJumpAudioKey();
        this.parent.velocity.y = -400;
        this.wobbleTimer = 0;
        // Randomize wobble speed each jump so it's unpredictable
        this.wobbleRate = 3 + Math.random() * 6;
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
            this.parent.velocity.x += dir.x * this.parent.speed/3.5 - 0.3*this.parent.velocity.x;
            this.parent.velocity.y += this.gravity*deltaT;

            // Chaotic aim wobble — oscillate facing direction so spell aim is unpredictable
            if (this.parent.isLocalPlayer) {
                this.wobbleTimer += deltaT;
                const phase = Math.sin(this.wobbleTimer * this.wobbleRate * 2 * Math.PI);
                this.owner.invertX = phase < 0;
            }

            this.owner.move(this.parent.velocity.scaled(deltaT));
        }
	}

	public onExit(): Record<string, any> {
		this.owner.animation.stop();
		return {};
	}
}
