import GameEvent from "../../../Wolfie2D/Events/GameEvent";
import { GameEventType } from "../../../Wolfie2D/Events/GameEventType";
import PlayerState from "./PlayerState";
import { MBEvents } from "../../MBEvents";

/**
 * The Dead state for the player's FSM AI. 
 */
export default class Dead extends PlayerState {
    // Trigger the player's death animation when we enter the dead state
    public onEnter(options: Record<string, any>): void {
        const deathAudio = this.owner.getScene().getDeathAudioKey();
        this.emitter.fireEvent(GameEventType.PLAY_SOUND, {key: deathAudio, loop: false, holdReference: false});
        this.emitter.fireEvent(MBEvents.PLAYER_DEAD, { playerNum: this.parent.playerNumber });
    }

    // Ignore all events from the rest of the game
    public handleInput(event: GameEvent): void { }

    // Empty update method - if the player is dead, don't update anything
    public update(deltaT: number): void {}

    public onExit(): Record<string, any> { return {}; }
    
}
