import {
    Animation,
    _decorator,
    Collider2D,
    Component,
    Contact2DType,
    ERigidBody2DType,
    EventKeyboard,
    EventMouse,
    game,
    input,
    Input,
    IPhysics2DContact,
    KeyCode,
    RigidBody2D,
    Sprite,
    SpriteFrame,
    Vec2,
} from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerCollectable } from './RunnerCollectable';

const { ccclass, property } = _decorator;

@ccclass('RunnerPlayerController')
export class RunnerPlayerController extends Component {
    @property(Animation)
    animation: Animation | null = null;

    @property
    idleClipName = 'idle';

    @property
    runClipName = 'run';

    @property
    jumpClipName = 'jump';

    @property(SpriteFrame)
    groundSpriteFrame: SpriteFrame | null = null;

    @property
    fixedX = -390;

    @property
    jumpHeight = 220;

    @property
    maxFallSpeed = 1200;

    @property
    groundTag = 1;

    @property
    enemyTag = 2;

    @property
    obstacleTag = 3;

    @property
    collectableTag = 4;

    @property
    finishTag = 5;

    @property
    finishStopDelay = 0.5;

    private body: RigidBody2D | null = null;
    private collider: Collider2D | null = null;
    private sprite: Sprite | null = null;
    private groundContacts = 0;
    private wasGrounded = false;
    private isJumping = false;
    private stoppedByFinish = false;
    private finishStopY = 0;
    private jumpUnlocked = false;
    private hasStartedRun = false;
    private currentClipName = '';
    private readonly preventContextMenu = (event: Event) => {
        event.preventDefault();
    };

    onLoad() {
        this.body = this.getComponent(RigidBody2D);
        this.collider = this.getComponent(Collider2D);
        this.sprite = this.getComponent(Sprite);

        if (!this.animation) {
            this.animation = this.getComponent(Animation);
        }

        if (!this.groundSpriteFrame && this.sprite) {
            this.groundSpriteFrame = this.sprite.spriteFrame;
        }

        if (!this.body) {
            console.warn('[RunnerPlayerController] Add RigidBody2D to the player node.');
            return;
        }

        if (this.body.type !== ERigidBody2DType.Dynamic) {
            this.body.type = ERigidBody2DType.Dynamic;
        }

        this.body.enabledContactListener = true;
        this.body.gravityScale = 2.5;
        this.body.fixedRotation = true;
        this.node.setPosition(this.fixedX, this.node.position.y, this.node.position.z);

        if (!this.collider) {
            console.warn('[RunnerPlayerController] Add Collider2D to the player node.');
        } else {
            this.collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this.collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        }

        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);

        game.canvas?.addEventListener('contextmenu', this.preventContextMenu);
        this.playIdleAnimation();
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);

        game.canvas?.removeEventListener('contextmenu', this.preventContextMenu);

        if (!this.collider) {
            return;
        }

        this.collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        this.collider.off(Contact2DType.END_CONTACT, this.onEndContact, this);
    }

    update() {
        if (!this.body) {
            return;
        }

        if (RunnerGameManager.isFinished) {
            this.stopAtFinish();
            this.holdFinishPosition();
            return;
        }

        if (!RunnerGameManager.isStarted) {
            this.playIdleAnimation();
        }

        if (RunnerGameManager.isStarted && !this.hasStartedRun && this.isGrounded()) {
            this.hasStartedRun = true;
            this.playGroundAnimation();
        }

        if (
            RunnerGameManager.isStarted &&
            this.isGrounded() &&
            !this.isJumping &&
            this.currentClipName === this.idleClipName
        ) {
            this.playGroundAnimation();
        }

        if (RunnerGameManager.isStarted) {
            this.consumeFirstEnemyHintJump();
        }

        const grounded = this.isGrounded();
        if (grounded && !this.wasGrounded) {
            this.isJumping = false;
            if (RunnerGameManager.isStarted) {
                this.playGroundAnimation();
            }
        }

        this.wasGrounded = grounded;

        const velocity = this.body.linearVelocity;
        const limitedFallSpeed = Math.max(velocity.y, -this.maxFallSpeed);
        this.body.linearVelocity = new Vec2(0, limitedFallSpeed);

        const position = this.node.position;
        if (Math.abs(position.x - this.fixedX) > 0.01) {
            this.node.setPosition(this.fixedX, position.y, position.z);
        }
    }

    private tryJump() {
        if (!this.jumpUnlocked || !this.body || !this.isGrounded()) {
            return;
        }

        this.isJumping = true;
        this.body.linearVelocity = new Vec2(0, 0);
        this.playJumpAnimation();
        this.body.linearVelocity = new Vec2(0, this.calculateJumpVelocity());
    }

    private isGrounded() {
        return this.groundContacts > 0;
    }

    private onBeginContact(_self: Collider2D, other: Collider2D, _contact?: IPhysics2DContact | null) {
        if (other.tag === this.groundTag) {
            this.groundContacts += 1;
            return;
        }

        if (other.tag === this.collectableTag) {
            const collectable = other.node.getComponent(RunnerCollectable);
            if (collectable) {
                collectable.collect();
                return;
            }

            RunnerGameManager.collectNode(other.node);
            return;
        }

        if (other.tag === this.finishTag) {
            RunnerGameManager.finishGame(this.finishStopDelay);
            return;
        }

        if (this.isDamageCollider(other)) {
            RunnerGameManager.damagePlayer();
        }
    }

    private onEndContact(_self: Collider2D, other: Collider2D, _contact?: IPhysics2DContact | null) {
        if (other.tag !== this.groundTag) {
            return;
        }

        this.groundContacts = Math.max(0, this.groundContacts - 1);
    }

    private isDamageCollider(other: Collider2D) {
        return other.tag === this.enemyTag || other.tag === this.obstacleTag;
    }

    private stopAtFinish() {
        if (!this.body || this.stoppedByFinish) {
            return;
        }

        this.stoppedByFinish = true;
        this.isJumping = false;
        this.finishStopY = this.node.position.y;
        this.body.linearVelocity = new Vec2(0, 0);
        this.body.angularVelocity = 0;
        this.body.gravityScale = 0;
        this.playIdleAnimation();
    }

    private holdFinishPosition() {
        if (!this.body || !this.stoppedByFinish) {
            return;
        }

        this.body.linearVelocity = new Vec2(0, 0);
        this.body.angularVelocity = 0;

        const position = this.node.position;
        if (Math.abs(position.x - this.fixedX) > 0.01 || Math.abs(position.y - this.finishStopY) > 0.01) {
            this.node.setPosition(this.fixedX, this.finishStopY, position.z);
        }
    }

    private playJumpAnimation() {
        if (!this.animation || !this.animation.getState(this.jumpClipName)) {
            return;
        }

        this.animation.play(this.jumpClipName);
        this.currentClipName = this.jumpClipName;
    }

    private playRunAnimation() {
        if (this.animation && this.animation.getState(this.runClipName)) {
            this.animation.play(this.runClipName);
            this.currentClipName = this.runClipName;
            return;
        }

        if (this.sprite && this.groundSpriteFrame) {
            this.sprite.spriteFrame = this.groundSpriteFrame;
        }
    }

    private playIdleAnimation() {
        const idleState = this.animation?.getState(this.idleClipName);
        if (!this.animation || !idleState) {
            return;
        }

        if (this.currentClipName === this.idleClipName && idleState.isPlaying) {
            return;
        }

        this.animation.play(this.idleClipName);
        this.currentClipName = this.idleClipName;
    }

    private playGroundAnimation() {
        if (this.animation) {
            this.animation.stop();
        }

        this.currentClipName = '';

        if (RunnerGameManager.isStarted) {
            this.playRunAnimation();
            return;
        }

        this.playIdleAnimation();
    }

    private calculateJumpVelocity() {
        if (!this.body) {
            return 0;
        }

        const gravity = 980 * this.body.gravityScale;
        return Math.sqrt(2 * gravity * this.jumpHeight);
    }

    private onTouchStart() {
        if (!RunnerGameManager.isStarted) {
            return;
        }

        if (this.consumeStartTap()) {
            return;
        }

        if (this.consumeFirstEnemyHintJump()) {
            return;
        }

        this.tryJump();
    }

    private onMouseDown(event: EventMouse) {
        if (!RunnerGameManager.isStarted) {
            return;
        }

        if (this.consumeStartTap()) {
            return;
        }

        if (this.consumeFirstEnemyHintJump()) {
            return;
        }

        if (
            event.getButton() === EventMouse.BUTTON_LEFT ||
            event.getButton() === EventMouse.BUTTON_RIGHT ||
            event.getButton() === EventMouse.BUTTON_MIDDLE
        ) {
            this.tryJump();
        }
    }

    private onKeyDown(event: EventKeyboard) {
        if (event.keyCode === KeyCode.SPACE && RunnerGameManager.isStarted) {
            if (this.consumeStartTap()) {
                return;
            }

            if (this.consumeFirstEnemyHintJump()) {
                return;
            }

            this.tryJump();
        }
    }

    private consumeStartTap() {
        return RunnerGameManager.consumeStartInput();
    }

    private consumeFirstEnemyHintJump() {
        if (!RunnerGameManager.consumeFirstEnemyHintJump()) {
            return false;
        }

        this.jumpUnlocked = true;
        this.tryJump();
        return true;
    }
}
