import { PlayerStates } from "../PlayerController";
import PlayerState from "./PlayerState";

export default class Fall extends PlayerState {
    protected tookFallDamage: boolean;

    onEnter(options: Record<string, any>): void {
        // If we're falling, the vertical velocity should be >= 0
        this.parent.velocity.y = 0;
        this.tookFallDamage = false;
    }

    update(deltaT: number): void {

        // If the player hits the ground, start idling and check if we should take damage
        if (this.owner.onGround) {
            this.tookFallDamage = false;
            this.finished(PlayerStates.IDLE);
        } 
        // Otherwise, keep moving
        else {
            // Get the movement direction from the player 
            let dir = this.parent.inputDir;
            // Update the horizontal velocity of the player
            this.parent.velocity.x += dir.x * this.parent.speed/3.5 - 0.3*this.parent.velocity.x;
            // Update the vertical velocity of the player
            this.parent.velocity.y += this.gravity*deltaT;
            // Move the player
            this.owner.move(this.parent.velocity.scaled(deltaT));
        }

    }

    onExit(): Record<string, any> {
        return { tookDamage: this.tookFallDamage };
    }
}
