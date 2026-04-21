import { _decorator, Component, Node, UITransform, Vec3 } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';

const { ccclass, property } = _decorator;

@ccclass('RunnerScrollLoop')
export class RunnerScrollLoop extends Component {
    @property
    scrollSpeed = 320;

    @property
    leftBound = -900;

    @property
    resetX = 900;

    @property
    useAutoLoop = true;

    @property
    loopWidth = 0;

    @property
    useLocalPosition = true;

    @property(Node)
    followTarget: Node | null = null;

    private cachedWidth = 0;

    onLoad() {
        this.cachedWidth = this.resolveLoopWidth();
    }

    update(deltaTime: number) {
        if (!RunnerGameManager.isStarted) {
            return;
        }

        if (this.followTarget) {
            this.scrollSpeed = this.followTarget.getComponent(RunnerScrollLoop)?.scrollSpeed ?? this.scrollSpeed;
        }

        const currentPosition = this.useLocalPosition ? this.node.position : this.node.worldPosition;
        const nextX = currentPosition.x - this.scrollSpeed * deltaTime;

        if (this.useLocalPosition) {
            this.node.setPosition(nextX, currentPosition.y, currentPosition.z);
        } else {
            this.node.setWorldPosition(nextX, currentPosition.y, currentPosition.z);
        }

        if (nextX > this.leftBound) {
            return;
        }

        const resetPosition = new Vec3(this.getResetX(), currentPosition.y, currentPosition.z);
        if (this.useLocalPosition) {
            this.node.setPosition(resetPosition);
        } else {
            this.node.setWorldPosition(resetPosition);
        }
    }

    private getResetX() {
        if (!this.useAutoLoop) {
            return this.resetX;
        }

        return this.node.position.x + this.cachedWidth * 2;
    }

    private resolveLoopWidth() {
        if (this.loopWidth > 0) {
            return this.loopWidth;
        }

        const transform = this.getComponent(UITransform);
        if (!transform) {
            return 0;
        }

        return transform.width * this.node.scale.x;
    }
}
