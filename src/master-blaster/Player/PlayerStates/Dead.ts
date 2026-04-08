import GameEvent from "../../../Wolfie2D/Events/GameEvent";
import { GameEventType } from "../../../Wolfie2D/Events/GameEventType";
import Input from "../../../Wolfie2D/Input/Input";
import { PlayerAnimations } from "../PlayerController";
import PlayerState from "./PlayerState";
import { MBEvents } from "../../MBEvents";
import Timer from "../../../Wolfie2D/Timing/Timer";

/**
 * The Dead state for the player's FSM AI. 
 */
export default class Dead extends PlayerState {
    protected deathTimer: Timer;

    // Trigger the player's death animation when we enter the dead state
    public onEnter(options: Record<string, any>): void {
        Input.disableInput();
        const deathAudio = this.owner.getScene().getDeathAudioKey();
        this.emitter.fireEvent(GameEventType.PLAY_SOUND, {key: deathAudio, loop: false, holdReference: false});
        this.owner.animation.play(PlayerAnimations.DYING, false);
        this.owner.animation.queue(PlayerAnimations.DEAD, true);

        this.deathTimer = new Timer(3000, () => {
            this.emitter.fireEvent(MBEvents.PLAYER_DEAD);
        });
        this.deathTimer.start();
    }

    // Ignore all events from the rest of the game
    public handleInput(event: GameEvent): void { }

    // Empty update method - if the player is dead, don't update anything
    public update(deltaT: number): void {}

    public onExit(): Record<string, any> { return {}; }
    
}
