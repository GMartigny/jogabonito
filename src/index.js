import { Scene, Text, Circle, Image, Position, Triangle, Math as M } from "pencil.js/pencil";
import { nets, TinyFaceDetectorOptions, DetectSingleFaceTask, resizeResults } from "face-api.js";
import ballImage from "./ball.png";
import "github-corner";
import "./style.css";

// Load required models
const loadModels = () => {
    const modelURI = "./models";
    return Promise.all([
        nets.tinyFaceDetector.loadFromUri(modelURI), // Face detection
    ]);
};

const tinyFaceOptions = new TinyFaceDetectorOptions({
    scoreThreshold: 0.1, // Lower score reduce emoji disappearance
});

// Create video element
const startVideo = async (container, size) => {
    const video = document.createElement("video");
    video.style.position = "absolute";
    video.width = size.width;
    video.height = size.height;
    video.setAttribute("autoplay", true);
    video.setAttribute("muted", true);

    // Ask user for permission
    video.srcObject = await navigator.mediaDevices.getUserMedia({
        video: true,
    });

    container.appendChild(video);

    return video;
};

const friction = 0.005; // Air friction
const bounce = 0.4; // Bounce strength
const gravity = new Position(0, 0.2); // Gravity constant
const minDistance = 50; // Minimum distance between ball and head to count as a juggle
const scores = {
    1: "😴",
    5: "😐",
    10: "😊",
    20: "😁",
    Infinity: "🤩",
};

// Apply Verlet integration to simulate movement
const verlet = (component, getForces) => {
    const previous = component.position.clone();

    if (component.previousPosition) {
        component.position.add(
            component.position.clone()
                .subtract(component.previousPosition)
                .multiply(1 - friction),
        );
    }

    component.position.add(getForces());

    component.previousPosition = previous;
};

// Main function
const run = async () => {
    // Size of the playground
    const size = {
        width: 960,
        height: 720,
    };
    document.body.innerHTML = `
<github-corner fill="#28166F">
    <a href="https://github.com/GMartigny/jogabonito"></a>
</github-corner>
<main id="container" style="width: ${size.width}px; height: ${size.height}px">
    <p>Enable your camera</p>
</main>
`;
    const container = document.getElementById("container");

    let video;
    try {
        video = await startVideo(container, size);
    }
    catch (e) {
        return;
    }

    const detector = new DetectSingleFaceTask(video, tinyFaceOptions);

    let ready = false;
    loadModels()
        .then(() => ready = true);

    const scene = new Scene(container);

    const shadow = {
        blur: 10,
        color: "#000",
    };
    const textOptions = {
        align: "center",
        fill: "#fff",
        fontSize: 40,
        shadow,
    };
    // Display some infos to the player
    const info = new Text(scene.center.subtract(0, textOptions.fontSize), "", textOptions);

    // Head of the player
    const box = new Circle();

    // Playing ball
    const ball = new Circle([scene.width / 2, 0], 100, {
        fill: null,
    });
    ball.add(new Image(undefined, ballImage, {
        origin: "center",
    }));

    // Out of screen display
    const marker = new Triangle([0, 15], 15, {
        fill: "red",
        shadow,
    });
    marker.hide();
    const heightInTheAir = new Text([0, 15], "", {
        ...textOptions,
        fontSize: 20,
    });
    marker.add(heightInTheAir);

    // Show the juggle count
    const juggleCount = new Text(undefined, "", {
        ...textOptions,
        opacity: 0,
    });

    let enabled = false; // Ball can be hit
    let dropped = 0; // Ball has been dropped
    let sticky = 3 * 60; // Ball don't fall
    let juggle = 0; // Juggle count
    let furthest = 0; // Max distance between the player's head and the ball this juggle

    scene
        .add(ball, info, marker, juggleCount) // Add all element to the scene
        .startLoop() // Animation loop
        .on(Scene.events.draw, async () => {
            if (!ready) {
                const nbDots = Math.floor(info.frameCount / 30) % 4;
                info.text = `Loading ${".".repeat(nbDots)}`;
                return;
            }

            enabled = true;
            let text;
            // Ball is stuck for now
            if (sticky > 0) {
                text = (sticky-- / 60).toFixed(1);
                enabled = false;
            }

            // Ball just dropped
            if (ball.position.y + ball.radius > scene.height && dropped <= 0) {
                dropped = 3 * 60;
            }
            // Ball is considered dropped
            if (dropped > 0) {
                const emoji = Object.keys(scores).filter(key => key > juggle)[0];
                text = [`You made ${juggle} juggle${juggle > 1 ? "s" : ""}`, scores[emoji]];
                enabled = false;

                // Reset ball position
                if (--dropped <= 0) {
                    sticky = 4 * 60;
                    ball.position.set(scene.width / 2, 0);
                    ball.previousPosition.set(ball.position);
                    juggle = 0;
                }
            }

            if (text) {
                info.text = text;
                info.show();
            }
            else {
                info.hide();
            }

            // Fade-out the juggle counter
            juggleCount.options.opacity = M.lerp(juggleCount.options.opacity, 0, 0.04);

            if (enabled) {
                // Try detecting a face
                const result = await detector.run();

                if (result) {
                    const resized = resizeResults(result, size);

                    const { height, width, left, top } = resized.box;
                    box.position.lerp([scene.width - left - (height / 2), top + (height / 2) - (height * 0.2)], 0.5);
                    box.radius = M.lerp(box.radius, width / 2, 0.05);

                    furthest = Math.max(furthest, ball.position.distance(box.position) - ball.radius - box.radius);
                }
            }

            // Rotate ball
            if (ball.previousPosition) {
                ball.options.rotation += (ball.position.x - ball.previousPosition.x) / 500;
            }

            // Ball out of the screen
            if (ball.position.y < -ball.radius) {
                marker.show();
                marker.position.x = ball.position.x;
                heightInTheAir.text = `${((-ball.position.y - ball.radius) / (ball.radius * 4)).toFixed(1)}m`;
            }
            else {
                marker.hide();
            }

            // Move the ball
            verlet(ball, () => {
                const forces = new Position();

                if (sticky <= 0) {
                    forces.add(gravity);
                }

                const { radius, position } = ball;

                // Bounce on head
                if (enabled) {
                    const distance = position.distance(box.position);
                    const field = radius + box.radius;
                    if (distance < field) {
                        forces.add(position.clone()
                            .subtract(box.position)
                            .divide(distance)
                            .multiply(distance - field)
                            .multiply(-bounce));
                        // Has gone far enough
                        if (furthest > minDistance) {
                            juggle++;
                            furthest = 0;
                            juggleCount.text = juggle.toString();
                            juggleCount.position.set(position.clone().lerp(box.position, 0.4));
                            juggleCount.previousPosition.set(juggleCount.position.clone().add(5, 0).rotate(M.random(0.2, 0.4), juggleCount.position));
                            juggleCount.options.opacity = 1;
                        }
                    }
                }

                // Bounce on walls
                [
                    [ball.position.x, 0, ball.position.y], // left
                    [scene.width - ball.position.x, scene.width, ball.position.y], // right
                    [scene.height - ball.position.y, ball.position.x, scene.height], // bottom
                ].forEach(([distance, x, y]) => {
                    const field = ball.radius;
                    if (distance < field) {
                        forces.add(ball.position.clone()
                            .subtract(x, y)
                            .divide(distance)
                            .multiply(distance - ball.radius)
                            .multiply(-bounce));
                    }
                });

                return forces;
            });

            // Move juggle counter
            verlet(juggleCount, () => gravity);
        }, true);
};

run();
