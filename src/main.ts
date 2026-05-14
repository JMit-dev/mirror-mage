import Game from "./Wolfie2D/Loop/Game";
import { MBControls } from "./master-blaster/MBControls";
import MainMenu from "./master-blaster/Scenes/MainMenu";

// The main function is your entrypoint into Wolfie2D. Specify your first scene and any options here.
(function main(){

    // Set up options for our game
    let options = {
        canvasSize: {x: 1200, y: 600},          // The size of the game
        clearColor: {r: 216, g: 224, b: 238},   // The color the game clears to
        inputs: [
            {name: MBControls.MOVE_LEFT,     keys: ["a"]},
            {name: MBControls.MOVE_RIGHT,    keys: ["d"]},
            {name: MBControls.JUMP,          keys: ["w"]},
            {name: MBControls.ATTACK,        keys: ["e", "space"]},
            {name: MBControls.P2_MOVE_LEFT,  keys: ["j", "arrowleft"]},
            {name: MBControls.P2_MOVE_RIGHT, keys: ["l", "arrowright"]},
            {name: MBControls.P2_JUMP,       keys: ["i", "arrowup"]},
            {name: MBControls.P2_ATTACK,     keys: ["u", "enter"]},
        ],
        useWebGL: false,                        // Tell the game we want to use webgl
        showDebug: false                       // Whether to show debug messages. You can change this to true if you want
    }

    // Create a game with the options specified
    const game = new Game(options);

    // Start our game
    game.start(MainMenu, {});
})();
