import { _decorator, Component, tween, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('RunnerEvadeButtonPulse')
export class RunnerEvadeButtonPulse extends Component {
    @property
    stretchX = 1.28;

    @property
    squeezeY = 0.82;

    @property
    stretchY = 1.28;

    @property
    squeezeX = 0.88;

    @property
    stepDuration = 0.16;

    @property
    cooldown = 1.5;

    private baseScale = new Vec3(1, 1, 1);

    onEnable() {
        this.baseScale = this.node.scale.clone();
        this.playLoop();
    }

    onDisable() {
        tween(this.node).stop();
        this.node.setScale(this.baseScale);
    }

    private playLoop() {
        const wideScale = new Vec3(this.baseScale.x * this.stretchX, this.baseScale.y * this.squeezeY, this.baseScale.z);
        const tallScale = new Vec3(this.baseScale.x * this.squeezeX, this.baseScale.y * this.stretchY, this.baseScale.z);

        tween(this.node)
            .repeatForever(
                tween()
                    .to(this.stepDuration, { scale: wideScale }, { easing: 'sineOut' })
                    .to(this.stepDuration, { scale: this.baseScale }, { easing: 'sineInOut' })
                    .to(this.stepDuration, { scale: tallScale }, { easing: 'sineOut' })
                    .to(this.stepDuration, { scale: this.baseScale }, { easing: 'sineInOut' })
                    .delay(this.cooldown),
            )
            .start();
    }
}
