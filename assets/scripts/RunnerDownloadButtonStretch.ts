import { _decorator, Component, UITransform, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

type StretchPhase = 'leftOut' | 'leftBack' | 'upOut' | 'upBack' | 'cooldown';

@ccclass('RunnerDownloadButtonStretch')
export class RunnerDownloadButtonStretch extends Component {
    @property
    leftStretchFactor = 1.18;

    @property
    upStretchFactor = 1.18;

    @property
    elasticOvershoot = 0.06;

    @property
    stretchDuration = 0.24;

    @property
    cooldown = 1;

    private transform: UITransform | null = null;
    private baseWidth = 0;
    private baseHeight = 0;
    private basePosition = new Vec3();
    private phase: StretchPhase = 'leftOut';
    private phaseTime = 0;

    onLoad() {
        this.transform = this.getComponent(UITransform);
        this.captureBaseState();
    }

    onEnable() {
        this.captureBaseState();
        this.phase = 'leftOut';
        this.phaseTime = 0;
    }

    onDisable() {
        this.applyState(this.baseWidth, this.baseHeight, this.basePosition.x, this.basePosition.y);
    }

    update(deltaTime: number) {
        if (!this.transform) {
            return;
        }

        this.phaseTime += deltaTime;

        if (this.phase === 'cooldown') {
            if (this.phaseTime >= this.cooldown) {
                this.nextPhase();
            }
            return;
        }

        const progress = Math.min(1, this.phaseTime / Math.max(0.001, this.stretchDuration));
        const eased = this.phase.endsWith('Out') ? this.easeOutBack(progress) : this.easeOutElastic(progress);
        this.applyPhase(eased);

        if (progress >= 1) {
            this.nextPhase();
        }
    }

    private captureBaseState() {
        this.transform = this.transform ?? this.getComponent(UITransform);
        if (!this.transform) {
            return;
        }

        this.baseWidth = this.transform.width;
        this.baseHeight = this.transform.height;
        this.basePosition = this.node.position.clone();
        this.applyState(this.baseWidth, this.baseHeight, this.basePosition.x, this.basePosition.y);
    }

    private applyPhase(progress: number) {
        const leftWidth = this.baseWidth * this.leftStretchFactor;
        const leftX = this.basePosition.x - (leftWidth - this.baseWidth) * 0.5;
        const upHeight = this.baseHeight * this.upStretchFactor;
        const upY = this.basePosition.y + (upHeight - this.baseHeight) * 0.5;

        if (this.phase === 'leftOut') {
            this.applyState(
                this.lerp(this.baseWidth, leftWidth, progress),
                this.baseHeight,
                this.lerp(this.basePosition.x, leftX, progress),
                this.basePosition.y,
            );
            return;
        }

        if (this.phase === 'leftBack') {
            this.applyState(
                this.lerp(leftWidth, this.baseWidth, progress),
                this.baseHeight,
                this.lerp(leftX, this.basePosition.x, progress),
                this.basePosition.y,
            );
            return;
        }

        if (this.phase === 'upOut') {
            this.applyState(
                this.baseWidth,
                this.lerp(this.baseHeight, upHeight, progress),
                this.basePosition.x,
                this.lerp(this.basePosition.y, upY, progress),
            );
            return;
        }

        this.applyState(
            this.baseWidth,
            this.lerp(upHeight, this.baseHeight, progress),
            this.basePosition.x,
            this.lerp(upY, this.basePosition.y, progress),
        );
    }

    private applyState(width: number, height: number, x: number, y: number) {
        if (!this.transform) {
            return;
        }

        this.transform.setContentSize(width, height);
        this.node.setPosition(x, y, this.basePosition.z);
    }

    private nextPhase() {
        this.phaseTime = 0;

        if (this.phase === 'leftOut') {
            this.phase = 'leftBack';
            return;
        }

        if (this.phase === 'leftBack') {
            this.phase = 'upOut';
            return;
        }

        if (this.phase === 'upOut') {
            this.phase = 'upBack';
            return;
        }

        if (this.phase === 'upBack') {
            this.phase = 'cooldown';
            this.applyState(this.baseWidth, this.baseHeight, this.basePosition.x, this.basePosition.y);
            return;
        }

        this.phase = 'leftOut';
    }

    private lerp(from: number, to: number, progress: number) {
        return from + (to - from) * progress;
    }

    private easeOutBack(progress: number) {
        const overshoot = 1.70158 + this.elasticOvershoot * 8;
        return 1 + (overshoot + 1) * Math.pow(progress - 1, 3) + overshoot * Math.pow(progress - 1, 2);
    }

    private easeOutElastic(progress: number) {
        if (progress === 0 || progress === 1) {
            return progress;
        }

        const period = 0.3;
        return Math.pow(2, -10 * progress) * Math.sin(((progress * 10 - 0.75) * (2 * Math.PI)) / period) + 1;
    }
}
