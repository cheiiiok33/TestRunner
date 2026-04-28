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
    autoLoopOverlap = 0;

    @property
    autoLoopLeadBleed = 0;

    @property
    useLocalPosition = true;

    @property
    pixelSnap = true;

    @property
    pixelSnapStep = 1;

    @property(Node)
    followTarget: Node | null = null;

    private cachedVisualWidth = 0;
    private cachedStepWidth = 0;

    onLoad() {
        this.refreshLoopMetrics();
    }

    start() {
        this.alignSiblingLoops();
    }

    public syncLoopLayout() {
        this.refreshLoopMetrics();
        this.alignSiblingLoops();
    }

    update(deltaTime: number) {
        if (!RunnerGameManager.isStarted) {
            return;
        }

        if (this.followTarget) {
            this.scrollSpeed = this.followTarget.getComponent(RunnerScrollLoop)?.scrollSpeed ?? this.scrollSpeed;
        }

        const effectiveSpeed = this.scrollSpeed * RunnerGameManager.getSpeedMultiplier();

        const currentPosition = this.useLocalPosition ? this.node.position : this.node.worldPosition;
        const nextX = this.snapAxis(currentPosition.x - effectiveSpeed * deltaTime);

        if (this.useLocalPosition) {
            this.node.setPosition(nextX, currentPosition.y, currentPosition.z);
        } else {
            this.node.setWorldPosition(nextX, currentPosition.y, currentPosition.z);
        }

        const resetThresholdX = this.resolveResetThresholdX();
        if (nextX > resetThresholdX) {
            return;
        }

        const resetPosition = new Vec3(this.snapAxis(this.getResetX()), currentPosition.y, currentPosition.z);
        if (this.useLocalPosition) {
            this.node.setPosition(resetPosition);
        } else {
            this.node.setWorldPosition(resetPosition);
        }
    }

    lateUpdate() {
        if (!RunnerGameManager.isStarted || !this.useAutoLoop) {
            return;
        }

        this.alignSiblingLoops();
    }

    private getResetX() {
        if (!this.useAutoLoop) {
            return this.resetX;
        }

        this.refreshLoopMetrics();
        const trailingX = this.findTrailingLoopX();
        if (trailingX !== null) {
            return trailingX + this.cachedStepWidth;
        }

        return this.node.position.x + this.cachedStepWidth;
    }

    private resolveResetThresholdX() {
        if (!this.useAutoLoop) {
            return this.leftBound;
        }

        this.refreshLoopMetrics();
        const visible = view.getVisibleSize();
        return -visible.width * 0.5 - this.cachedVisualWidth * 0.5 - this.resolveAutoLoopLeadBleed();
    }

    private refreshLoopMetrics() {
        this.cachedVisualWidth = this.resolveLoopWidth();
        this.cachedStepWidth = Math.max(1, this.cachedVisualWidth - this.resolveAutoLoopOverlap());
    }

    private resolveLoopWidth() {
        const transform = this.getComponent(UITransform);
        const measuredWidth = transform ? transform.width * Math.abs(this.node.scale.x) : 0;

        if (this.loopWidth > 0) {
            return Math.max(this.loopWidth, measuredWidth);
        }

        return measuredWidth;
    }

    private resolveAutoLoopOverlap() {
        return Math.max(0, this.autoLoopOverlap);
    }

    private resolveAutoLoopLeadBleed() {
        return Math.max(0, this.autoLoopLeadBleed);
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

    private alignSiblingLoops() {
        if (!this.useAutoLoop) {
            return;
        }

        const parent = this.node.parent;
        if (!parent) {
            return;
        }

        this.refreshLoopMetrics();

        const loops = parent.children
            .filter((child) => child.isValid && child.getComponent(RunnerScrollLoop))
            .sort((left, right) => {
                const leftPos = this.useLocalPosition ? left.position.x : left.worldPosition.x;
                const rightPos = this.useLocalPosition ? right.position.x : right.worldPosition.x;
                return leftPos - rightPos;
            });

        if (loops.length <= 1) {
            return;
        }

        let previousX = this.useLocalPosition ? loops[0].position.x : loops[0].worldPosition.x;
        for (let index = 1; index < loops.length; index += 1) {
            const loop = loops[index];
            const current = this.useLocalPosition ? loop.position : loop.worldPosition;
            const alignedX = this.snapAxis(previousX + this.cachedStepWidth);

            if (this.useLocalPosition) {
                loop.setPosition(alignedX, current.y, current.z);
            } else {
                loop.setWorldPosition(alignedX, current.y, current.z);
            }

            previousX = alignedX;
        }
    }

    private snapAxis(value: number) {
        if (!this.pixelSnap) {
            return value;
        }

        const step = Math.max(0.0001, this.pixelSnapStep);
        return Math.round(value / step) * step;
    }
}
