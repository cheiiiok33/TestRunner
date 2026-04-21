import { _decorator, Animation, Collider2D, Component, Node, randomRange, Vec3 } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
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

    private startY = 0;
    private animation: Animation | null = null;

    onLoad() {
        this.startY = this.node.position.y;
        this.animation = this.getComponent(Animation);
        this.playWalkAnimation();

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

        if (nextX > this.leftBound) {
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
            if (!state.isPlaying) {
                this.animation.play(this.walkAnimationName);
            }
            return;
        }

        const defaultClip = this.animation.defaultClip;
        if (defaultClip && !this.animation.getState(defaultClip.name)?.isPlaying) {
            this.animation.play(defaultClip.name);
        }
    }
}
