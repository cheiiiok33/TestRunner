import {
    _decorator,
    Component,
    EventKeyboard,
    EventMouse,
    game,
    input,
    Input,
    KeyCode,
    Label,
    Node,
    tween,
    UIOpacity,
    Vec3,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('RunnerGameManager')
export class RunnerGameManager extends Component {
    static isStarted = false;
    static shouldConsumeStartInput = false;
    private static instance: RunnerGameManager | null = null;

    @property(Node)
    hintFinger: Node | null = null;

    @property(Node)
    hintTextNode: Node | null = null;

    @property
    startText = 'Tap to start\ngaming!';

    @property
    fingerMinScale = 0.85;

    @property
    fingerMaxScale = 1.1;

    @property
    fingerPulseDuration = 0.45;

    @property
    hideHintDuration = 0.2;

    @property([Node])
    hearts: Node[] = [];

    @property
    maxHealth = 3;

    @property
    damageCooldown = 0.8;

    private fingerStartScale = new Vec3(1, 1, 1);
    private started = false;
    private health = 0;
    private lastDamageTime = -Infinity;
    private readonly preventContextMenu = (event: Event) => {
        event.preventDefault();
    };

    onLoad() {
        RunnerGameManager.instance = this;
        RunnerGameManager.isStarted = false;
        RunnerGameManager.shouldConsumeStartInput = false;
        this.health = this.resolveMaxHealth();
        this.lastDamageTime = -Infinity;
        this.updateHearts();

        if (this.hintTextNode) {
            const label = this.hintTextNode.getComponent(Label);
            if (label) {
                label.string = this.startText;
            }
        }

        if (this.hintFinger) {
            this.fingerStartScale = this.hintFinger.scale.clone();
            this.playFingerPulse();
        }

        input.on(Input.EventType.TOUCH_START, this.onFirstInput, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        game.canvas?.addEventListener('contextmenu', this.preventContextMenu);
    }

    onDestroy() {
        if (RunnerGameManager.instance === this) {
            RunnerGameManager.instance = null;
        }

        input.off(Input.EventType.TOUCH_START, this.onFirstInput, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        game.canvas?.removeEventListener('contextmenu', this.preventContextMenu);
    }

    private playFingerPulse() {
        if (!this.hintFinger) {
            return;
        }

        const minScale = this.fingerStartScale.clone().multiplyScalar(this.fingerMinScale);
        const maxScale = this.fingerStartScale.clone().multiplyScalar(this.fingerMaxScale);

        tween(this.hintFinger)
            .repeatForever(
                tween()
                    .to(this.fingerPulseDuration, { scale: maxScale })
                    .to(this.fingerPulseDuration, { scale: minScale }),
            )
            .start();
    }

    private onMouseDown(event: EventMouse) {
        if (event.getButton() === EventMouse.BUTTON_LEFT || event.getButton() === EventMouse.BUTTON_RIGHT) {
            this.onFirstInput();
        }
    }

    private onKeyDown(event: EventKeyboard) {
        if (event.keyCode === KeyCode.SPACE) {
            this.onFirstInput();
        }
    }

    private onFirstInput() {
        if (this.started) {
            return;
        }

        this.started = true;
        RunnerGameManager.isStarted = true;
        RunnerGameManager.shouldConsumeStartInput = true;
        this.hideStartHint();
    }

    static consumeStartInput() {
        if (!RunnerGameManager.shouldConsumeStartInput) {
            return false;
        }

        RunnerGameManager.shouldConsumeStartInput = false;
        return true;
    }

    static damagePlayer(amount = 1) {
        RunnerGameManager.instance?.takeDamage(amount);
    }

    private takeDamage(amount: number) {
        if (!RunnerGameManager.isStarted || this.health <= 0) {
            return;
        }

        const now = Date.now() / 1000;
        if (now - this.lastDamageTime < this.damageCooldown) {
            return;
        }

        this.lastDamageTime = now;
        this.health = Math.max(0, this.health - amount);
        this.updateHearts();

        if (this.health <= 0) {
            RunnerGameManager.isStarted = false;
        }
    }

    private resolveMaxHealth() {
        if (this.hearts.length > 0) {
            return this.hearts.length;
        }

        return Math.max(1, this.maxHealth);
    }

    private updateHearts() {
        this.hearts.forEach((heart, index) => {
            heart.active = index < this.health;
        });
    }

    private hideStartHint() {
        this.fadeOutNode(this.hintFinger);
        this.fadeOutNode(this.hintTextNode);
    }

    private fadeOutNode(target: Node | null) {
        if (!target) {
            return;
        }

        tween(target).stop();

        let opacity = target.getComponent(UIOpacity);
        if (!opacity) {
            opacity = target.addComponent(UIOpacity);
        }

        tween(opacity)
            .to(this.hideHintDuration, { opacity: 0 })
            .call(() => {
                target.active = false;
            })
            .start();
    }
}
