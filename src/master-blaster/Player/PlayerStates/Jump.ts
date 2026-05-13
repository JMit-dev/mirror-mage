import { GameEventType } from "../../../Wolfie2D/Events/GameEventType";
import { PlayerStates } from "../PlayerController";

import PlayerState from "./PlayerState";

export default class Jump extends PlayerState {
    private readonly jumpStrength: number = 420;

	public onEnter(_options: Record<string, any>): void {
        let jumpAudio = this.owner.getScene().getJumpAudioKey();
        this.parent.velocity.y = -this.jumpStrength;
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
            this.parent.velocity.y += this.gravity * deltaT;
            this.owner.move(this.parent.velocity.scaled(deltaT));
        }
	}

	public onExit(): Record<string, any> {
        this.owner.rotation = 0;
		this.owner.animation.stop();
		return {};
	}
}
