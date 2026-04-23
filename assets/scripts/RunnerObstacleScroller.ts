import { _decorator, Animation, Collider2D, Component, Node, randomRange, Rect, UITransform, Vec3 } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerEvadeButtonPulse } from './RunnerEvadeButtonPulse';
import { RunnerPlayerController } from './RunnerPlayerController';
import { RunnerScrollLoop } from './RunnerScrollLoop';

const { ccclass, property } = _decorator;

@ccclass('RunnerObstacleScroller')
export class RunnerObstacleScroller extends Component {
    @property
    scrollSpeed = 320;

    @property
    extraMoveSpeed = 0;

    @property
    leftBound = -900;

    @property
    resetX = 900;

    @property
    randomOffsetXMin = 0;

    @property
    randomOffsetXMax = 260;

    @property
    keepStartY = true;

    @property
    resetY = 0;

    @property
    destroyAtLeftBound = false;

    @property
    configureCollider = true;

    @property
    colliderTag = 2;

    @property
    colliderSensor = true;

    @property
    walkAnimationName = 'EnemyWalking';

    @property(Node)
    followTarget: Node | null = null;

    @property
    triggerFirstEnemyHint = true;

    @property
    firstEnemyHintX = -80;

    @property(Node)
    firstEnemyHintTarget: Node | null = null;

    @property
    firstEnemyHintLeadDistance = 300;

    private startY = 0;
    private animation: Animation | null = null;
    private hasTriggeredFirstEnemyHint = false;

    onLoad() {
        this.startY = this.node.position.y;
        this.animation = this.getComponent(Animation);
        this.playWalkAnimation();
        this.attachEvadeButtonPulse(this.node);

        if (this.configureCollider) {
            const collider = this.getComponent(Collider2D);
            if (collider) {
                collider.tag = this.colliderTag;
                collider.sensor = this.colliderSensor;
            }
        }
    }

    update(deltaTime: number) {
        if (!RunnerGameManager.isStarted) {
            this.stopWalkAnimation();
            return;
        }

        this.playWalkAnimation();

        if (this.followTarget) {
            this.scrollSpeed =
                this.followTarget.getComponent(RunnerObstacleScroller)?.scrollSpeed ??
                this.followTarget.getComponent(RunnerScrollLoop)?.scrollSpeed ??
                this.scrollSpeed;
        }

        const position = this.node.position;
        const nextX = position.x - (this.scrollSpeed + this.extraMoveSpeed) * deltaTime;
        this.node.setPosition(nextX, position.y, position.z);

        if (this.shouldTriggerFirstEnemyHint(nextX) && RunnerGameManager.pauseForFirstEnemy()) {
            this.hasTriggeredFirstEnemyHint = true;
            this.stopWalkAnimation();
            return;
        }

        if (this.getNodeRightEdgeInParent() > this.leftBound) {
            return;
        }

        if (this.destroyAtLeftBound) {
            this.node.destroy();
            return;
        }

        const nextY = this.keepStartY ? this.startY : this.resetY;
        const offsetX = randomRange(this.randomOffsetXMin, this.randomOffsetXMax);
        this.node.setPosition(new Vec3(this.resetX + offsetX, nextY, position.z));
    }

    private playWalkAnimation() {
        if (!this.animation) {
            return;
        }

        const state = this.animation.getState(this.walkAnimationName);
        if (state) {
            state.speed = 1;
            if (!state.isPlaying) {
                this.animation.play(this.walkAnimationName);
            }
            return;
        }

        const defaultClip = this.animation.defaultClip;
        const defaultState = defaultClip ? this.animation.getState(defaultClip.name) : null;
        if (defaultState) {
            defaultState.speed = 1;
        }
        if (defaultClip && !defaultState?.isPlaying) {
            this.animation.play(defaultClip.name);
        }
    }

    private attachEvadeButtonPulse(node: Node) {
        if (/^evade$/i.test(node.name) && !node.getComponent(RunnerEvadeButtonPulse)) {
            node.addComponent(RunnerEvadeButtonPulse);
        }

        node.children.forEach((child) => this.attachEvadeButtonPulse(child));
    }

    private stopWalkAnimation() {
        if (!this.animation) {
            return;
        }

        const state = this.animation.getState(this.walkAnimationName);
        if (state) {
            state.speed = 0;
            return;
        }

        const defaultClip = this.animation.defaultClip;
        const defaultState = defaultClip ? this.animation.getState(defaultClip.name) : null;
        if (defaultState) {
            defaultState.speed = 0;
        }
    }

    private shouldTriggerFirstEnemyHint(nextX: number) {
        if (!this.triggerFirstEnemyHint || this.hasTriggeredFirstEnemyHint) {
            return false;
        }

        if (!this.firstEnemyHintTarget?.isValid) {
            return nextX <= this.firstEnemyHintX;
        }

        const playerController = this.firstEnemyHintTarget.getComponent(RunnerPlayerController);
        const targetX = playerController?.fixedX ?? this.firstEnemyHintTarget.position.x;
        return nextX <= targetX + this.firstEnemyHintLeadDistance;
    }

    private getNodeRightEdgeInParent() {
        const parent = this.node.parent;
        if (!parent) {
            return this.node.position.x;
        }

        const transform = this.node.getComponent(UITransform);
        if (!transform) {
            return this.node.position.x;
        }

        const worldBounds = transform.getBoundingBoxToWorld();
        const boundsInParent = this.convertWorldRectToParentRect(worldBounds, parent);
        return boundsInParent.xMax;
    }

    private convertWorldRectToParentRect(worldRect: Rect, parent: Node) {
        const parentTransform = parent.getComponent(UITransform);
        const minWorld = new Vec3(worldRect.xMin, worldRect.yMin, 0);
        const maxWorld = new Vec3(worldRect.xMax, worldRect.yMax, 0);
        const minLocal = new Vec3();
        const maxLocal = new Vec3();

        if (parentTransform) {
            parentTransform.convertToNodeSpaceAR(minWorld, minLocal);
            parentTransform.convertToNodeSpaceAR(maxWorld, maxLocal);
        } else {
            parent.inverseTransformPoint(minLocal, minWorld);
            parent.inverseTransformPoint(maxLocal, maxWorld);
        }

        return new Rect(
            Math.min(minLocal.x, maxLocal.x),
            Math.min(minLocal.y, maxLocal.y),
            Math.abs(maxLocal.x - minLocal.x),
            Math.abs(maxLocal.y - minLocal.y),
        );
    }
}
