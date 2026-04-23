import { _decorator, Component, Node, UITransform, Vec3, view } from 'cc';
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

        const resetThresholdX = this.resolveResetThresholdX();
        if (nextX > resetThresholdX) {
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

        this.cachedWidth = this.resolveLoopWidth();
        const trailingX = this.findTrailingLoopX();
        if (trailingX !== null) {
            return trailingX + this.cachedWidth;
        }

        return this.node.position.x + this.cachedWidth;
    }

    private resolveResetThresholdX() {
        if (!this.useAutoLoop) {
            return this.leftBound;
        }

        this.cachedWidth = this.resolveLoopWidth();
        const visible = view.getVisibleSize();
        return -visible.width * 0.5 - this.cachedWidth * 0.5;
    }

    private resolveLoopWidth() {
        const transform = this.getComponent(UITransform);
        const measuredWidth = transform ? transform.width * Math.abs(this.node.scale.x) : 0;

        if (this.loopWidth > 0) {
            return Math.max(this.loopWidth, measuredWidth);
        }

        return measuredWidth;
    }

    private findTrailingLoopX() {
        const parent = this.node.parent;
        if (!parent) {
            return null;
        }

        let trailingX: number | null = null;
        for (const sibling of parent.children) {
            if (sibling === this.node || !sibling.isValid) {
                continue;
            }

            const siblingLoop = sibling.getComponent(RunnerScrollLoop);
            if (!siblingLoop) {
                continue;
            }

            const siblingPosition = this.useLocalPosition ? sibling.position : sibling.worldPosition;
            trailingX = trailingX === null ? siblingPosition.x : Math.max(trailingX, siblingPosition.x);
        }

        return trailingX;
    }
}
