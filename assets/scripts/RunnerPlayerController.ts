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
    Node,
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
    private static instance: RunnerPlayerController | null = null;

    @property(Animation)
    animation: Animation | null = null;

    @property
    idleClipName = 'idle';

    @property
    runClipName = 'run';

    @property
    jumpClipName = 'jump';

    @property
    takeDamageClipName = 'TakeDamage';

    @property(SpriteFrame)
    groundSpriteFrame: SpriteFrame | null = null;

    @property
    fixedX = -390;

    @property
    jumpHeight = 220;

    @property
    maxFallSpeed = 1200;

    @property
    baseGravityScale = 5.5;

    @property
    riseGravityMultiplier = 1.15;

    @property
    fallGravityMultiplier = 2.4;

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
    finishStopDelay = 0.4;

    private body: RigidBody2D | null = null;
    private collider: Collider2D | null = null;
    private sprite: Sprite | null = null;
    private groundContacts = 0;
    private wasGrounded = false;
    private isJumping = false;
    private stoppedByFinish = false;
    private waitingForFinishLanding = false;
    private jumpUnlocked = false;
    private hasStartedRun = false;
    private currentClipName = '';
    private damageAnimationUntil = 0;
    private readonly preventContextMenu = (event: Event) => {
        event.preventDefault();
    };

    onLoad() {
        RunnerPlayerController.instance = this;
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
        this.body.gravityScale = this.baseGravityScale;
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
        if (RunnerPlayerController.instance === this) {
            RunnerPlayerController.instance = null;
        }

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

        if (RunnerGameManager.isFinished || RunnerGameManager.isFinishing) {
            this.stopAtFinish();
            this.updateFinishPosition();
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
        this.body.gravityScale = this.resolveCurrentGravityScale(velocity.y);
        const limitedFallSpeed = Math.max(velocity.y, -this.maxFallSpeed);
        this.body.linearVelocity = new Vec2(0, limitedFallSpeed);

        if (this.damageAnimationUntil > 0 && Date.now() >= this.damageAnimationUntil) {
            this.damageAnimationUntil = 0;
            this.restoreAnimationState();
        }

        const position = this.node.position;
        if (Math.abs(position.x - this.fixedX) > 0.01) {
            this.node.setPosition(this.fixedX, position.y, position.z);
        }
    }

    static playDamageAnimation() {
        RunnerPlayerController.instance?.triggerDamageAnimation();
    }

    private tryJump() {
        if (!this.jumpUnlocked || !this.body || !this.isGrounded()) {
            return;
        }

        this.isJumping = true;
        this.body.linearVelocity = new Vec2(0, 0);
        this.playJumpAnimation();
        RunnerGameManager.playJumpAudio();
        this.body.linearVelocity = new Vec2(0, this.calculateJumpVelocity());
    }

    private isGrounded() {
        return this.groundContacts > 0;
    }

    public isSpawnGrounded() {
        return this.isGrounded();
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
            RunnerGameManager.finishGame(this.finishStopDelay, this.resolveFinishRoot(other.node));
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

        if (!this.isGrounded()) {
            this.waitingForFinishLanding = true;
            this.body.angularVelocity = 0;
            return;
        }

        this.completeFinishStop();
    }

    private updateFinishPosition() {
        if (!this.body) {
            return;
        }

        if (this.waitingForFinishLanding) {
            this.body.angularVelocity = 0;
            if (this.isGrounded()) {
                this.completeFinishStop();
            }
            return;
        }

        if (!this.stoppedByFinish) {
            return;
        }

        this.body.angularVelocity = 0;
        this.body.linearVelocity = new Vec2(0, 0);
        this.body.gravityScale = 0;

        const position = this.node.position;
        if (Math.abs(position.x - this.fixedX) > 0.01) {
            this.node.setPosition(this.fixedX, position.y, position.z);
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
        if (this.damageAnimationUntil > 0) {
            return;
        }

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
        const gravity = 980 * this.baseGravityScale * this.riseGravityMultiplier;
        return Math.sqrt(2 * gravity * this.jumpHeight);
    }

    private triggerDamageAnimation() {
        if (!this.animation || this.currentClipName === this.takeDamageClipName) {
            return;
        }

        const state = this.animation.getState(this.takeDamageClipName);
        if (!state) {
            return;
        }

        this.animation.play(this.takeDamageClipName);
        this.currentClipName = this.takeDamageClipName;

        const clipDuration = state.duration / Math.max(0.001, state.speed || 1);
        this.damageAnimationUntil = Date.now() + clipDuration * 1000;
    }

    private restoreAnimationState() {
        if (this.isJumping && !this.isGrounded()) {
            this.playJumpAnimation();
            return;
        }

        if (RunnerGameManager.isStarted) {
            this.playGroundAnimation();
            return;
        }

        this.playIdleAnimation();
    }

    private completeFinishStop() {
        if (!this.body) {
            return;
        }

        this.waitingForFinishLanding = false;
        this.stoppedByFinish = true;
        this.isJumping = false;
        this.body.linearVelocity = new Vec2(0, 0);
        this.body.angularVelocity = 0;
        this.body.gravityScale = 0;
        this.playIdleAnimation();
    }

    private resolveCurrentGravityScale(verticalVelocity: number) {
        if (verticalVelocity < 0) {
            return this.baseGravityScale * this.fallGravityMultiplier;
        }

        if (verticalVelocity > 0) {
            return this.baseGravityScale * this.riseGravityMultiplier;
        }

        return this.baseGravityScale;
    }

    private onTouchStart() {
        this.handleJumpInput();
    }

    private onMouseDown(event: EventMouse) {
        if (
            event.getButton() === EventMouse.BUTTON_LEFT ||
            event.getButton() === EventMouse.BUTTON_RIGHT ||
            event.getButton() === EventMouse.BUTTON_MIDDLE
        ) {
            this.handleJumpInput();
        }
    }

    private onKeyDown(event: EventKeyboard) {
        if (event.keyCode === KeyCode.SPACE && RunnerGameManager.isStarted) {
            this.handleJumpInput();
        }
    }

    private handleJumpInput() {
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

    private resolveFinishRoot(node: Node) {
        let current: Node | null = node;

        while (current?.parent) {
            const parent = current.parent;
            if (parent === this.node.scene || parent.name === 'Canvas' || parent.name === 'World') {
                break;
            }

            current = current.parent;
        }

        return current ?? node;
    }
}
