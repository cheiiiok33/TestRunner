import {
    _decorator,
    AudioClip,
    AudioSource,
    Button,
    Collider2D,
    Component,
    EventKeyboard,
    EventMouse,
    game,
    input,
    Input,
    KeyCode,
    Label,
    Node,
    Prefab,
    Sprite,
    instantiate,
    tween,
    UIOpacity,
    UITransform,
    Vec3,
} from 'cc';
import { RunnerEvadeButtonPulse } from './RunnerEvadeButtonPulse';
import { RunnerGameOverScreen } from './RunnerGameOverScreen';
import { RunnerDownloadButtonStretch } from './RunnerDownloadButtonStretch';
import { RunnerFinishCelebration } from './RunnerFinishCelebration';
import { RunnerStoreRedirect } from './RunnerStoreRedirect';

const { ccclass, property } = _decorator;

@ccclass('RunnerGameManager')
export class RunnerGameManager extends Component {
    static isStarted = false;
    static isFinished = false;
    static isFinishing = false;
    static isFinishSpawned = false;
    static shouldConsumeStartInput = false;
    private static instance: RunnerGameManager | null = null;
    private static hasShownFirstEnemyHint = false;
    private static shouldJumpAfterFirstEnemyHint = false;

    @property(Node)
    hintFinger: Node | null = null;

    @property(Node)
    hintTextNode: Node | null = null;

    @property
    startText = 'Tap to start\ngaming!';

    @property
    firstEnemyHintText = 'Jump to avoid enemies';

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

    @property(Node)
    heartsRoot: Node | null = null;

    @property
    maxHealth = 3;

    @property
    damageCooldown = 0.8;

    @property
    damagedHeartOpacity = 80;

    @property
    heartFadeDuration = 0.25;

    @property(Node)
    collectTarget: Node | null = null;

    @property(Label)
    scoreLabel: Label | null = null;

    @property
    scorePrefix = '$';

    @property
    collectFlyDuration = 0.5;

    @property
    collectPopScale = 1.25;

    @property
    collectEndScale = 0.12;

    @property(Prefab)
    failPrefab: Prefab | null = null;

    @property(Node)
    failContainer: Node | null = null;

    @property(Prefab)
    gameOverPrefab: Prefab | null = null;

    @property(Node)
    gameOverContainer: Node | null = null;

    @property
    gameOverDelay = 0.8;

    @property(Prefab)
    winGamePrefab: Prefab | null = null;

    @property(Node)
    winGameContainer: Node | null = null;

    @property
    winGameDelay = 0.2;

    @property(RunnerFinishCelebration)
    finishCelebration: RunnerFinishCelebration | null = null;

    @property(Prefab)
    finishedFinishPrefab: Prefab | null = null;

    @property(Prefab)
    confettiPiecePrefab: Prefab | null = null;

    @property
    winTitleText = 'Congratulations!\nChoose your reward!';

    @property
    winButtonText = 'INSTALL AND EARN';

    @property
    androidStoreUrl = '';

    @property
    iosStoreUrl = '';

    @property
    fallbackStoreUrl = '';

    @property
    failStartScale = 0.15;

    @property
    failOvershootScale = 1.2;

    @property
    failPopDuration = 0.18;

    @property
    failSettleDuration = 0.12;

    @property(AudioClip)
    fone: AudioClip | null = null;

    @property(AudioClip)
    jump: AudioClip | null = null;

    @property(AudioClip)
    damage: AudioClip | null = null;

    @property(AudioClip)
    confetti: AudioClip | null = null;

    @property(AudioClip)
    looseGame: AudioClip | null = null;

    @property(AudioClip)
    winGame: AudioClip | null = null;

    private fingerStartScale = new Vec3(1, 1, 1);
    private started = false;
    private isFirstEnemyPaused = false;
    private health = 0;
    private score = 0;
    private failShown = false;
    private lastDamageTime = -Infinity;
    private foneSource: AudioSource | null = null;
    private effectsSource: AudioSource | null = null;
    private playedLooseGame = false;
    private playedWinGame = false;
    private foneStarted = false;
    private readonly collectedNodes = new Set<Node>();
    private readonly preventContextMenu = (event: Event) => {
        event.preventDefault();
    };

    onLoad() {
        RunnerGameManager.instance = this;
        RunnerGameManager.isStarted = false;
        RunnerGameManager.isFinished = false;
        RunnerGameManager.isFinishing = false;
        RunnerGameManager.isFinishSpawned = false;
        RunnerGameManager.shouldConsumeStartInput = false;
        RunnerGameManager.hasShownFirstEnemyHint = false;
        RunnerGameManager.shouldJumpAfterFirstEnemyHint = false;
        this.resolveHearts();
        this.health = this.resolveMaxHealth();
        this.resolveCollectTarget();
        this.resolveScoreLabel();
        this.updateScoreLabel();
        this.attachEvadeButtonPulses();
        this.attachDownloadButtonStretch();
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
        this.stopFone();
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
        if (this.isFirstEnemyPaused) {
            this.resumeFromFirstEnemyHint();
            return;
        }

        if (this.started) {
            return;
        }

        this.started = true;
        RunnerGameManager.isStarted = true;
        RunnerGameManager.shouldConsumeStartInput = true;
        this.playFone();
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

    static finishGame(delay = 0, finishNode: Node | null = null) {
        RunnerGameManager.instance?.finishGame(delay, finishNode);
    }

    static playJumpAudio() {
        const manager = RunnerGameManager.instance;
        manager?.playEffect(manager.jump);
    }

    static markFinishSpawned() {
        RunnerGameManager.isFinishSpawned = true;
    }

    static collectNode(node: Node, value = 10) {
        return RunnerGameManager.instance?.collectNode(node, value) ?? false;
    }

    static getCollectTarget() {
        return RunnerGameManager.instance?.resolveCollectTarget() ?? null;
    }

    static consumeFirstEnemyHintJump() {
        if (!RunnerGameManager.shouldJumpAfterFirstEnemyHint) {
            return false;
        }

        RunnerGameManager.shouldJumpAfterFirstEnemyHint = false;
        return true;
    }

    static pauseForFirstEnemy() {
        const manager = RunnerGameManager.instance;
        if (!manager || RunnerGameManager.hasShownFirstEnemyHint || !RunnerGameManager.isStarted) {
            return false;
        }

        RunnerGameManager.hasShownFirstEnemyHint = true;
        manager.showFirstEnemyHint();
        return true;
    }

    private takeDamage(amount: number) {
        if (!RunnerGameManager.isStarted || RunnerGameManager.isFinished || RunnerGameManager.isFinishing || this.health <= 0) {
            return;
        }

        const now = Date.now() / 1000;
        if (now - this.lastDamageTime < this.damageCooldown) {
            return;
        }

        this.lastDamageTime = now;
        this.health = Math.max(0, this.health - amount);
        this.updateHearts(true);
        this.playEffect(this.damage);

        if (this.health <= 0) {
            RunnerGameManager.isStarted = false;
            this.showFail();
            return;
        }
    }

    private resolveMaxHealth() {
        if (this.hearts.length > 0) {
            return this.hearts.length;
        }

        return Math.max(1, this.maxHealth);
    }

    private attachEvadeButtonPulses() {
        this.attachEvadeButtonPulsesIn(this.node.scene);
    }

    private attachDownloadButtonStretch() {
        this.attachDownloadButtonStretchIn(this.node.scene);
    }

    private attachEvadeButtonPulsesIn(node: Node | null) {
        if (!node) {
            return;
        }

        if (/^evade$/i.test(node.name) && !node.getComponent(RunnerEvadeButtonPulse)) {
            node.addComponent(RunnerEvadeButtonPulse);
        }

        node.children.forEach((child) => this.attachEvadeButtonPulsesIn(child));
    }

    private attachDownloadButtonStretchIn(node: Node | null) {
        if (!node) {
            return;
        }

        if (/^download$/i.test(node.name) && !node.getComponent(RunnerDownloadButtonStretch)) {
            node.addComponent(RunnerDownloadButtonStretch);
        }

        if (/^download$/i.test(node.name)) {
            this.attachStoreRedirect(node);
        }

        node.children.forEach((child) => this.attachDownloadButtonStretchIn(child));
    }

    private attachStoreRedirectsIn(node: Node | null) {
        if (!node) {
            return;
        }

        if (node.getComponent(Button)) {
            this.attachStoreRedirect(node);
        }

        node.children.forEach((child) => this.attachStoreRedirectsIn(child));
    }

    private attachStoreRedirect(node: Node) {
        let redirect = node.getComponent(RunnerStoreRedirect);
        if (!redirect) {
            redirect = node.addComponent(RunnerStoreRedirect);
        }

        redirect.configure(this.androidStoreUrl, this.iosStoreUrl, this.fallbackStoreUrl);
    }

    private showFail() {
        if (this.failShown) {
            return;
        }

        this.failShown = true;

        if (!this.failPrefab) {
            this.scheduleOnce(() => this.showGameOver(), this.gameOverDelay);
            return;
        }

        const fail = instantiate(this.failPrefab);
        const container = this.failContainer ?? this.node.parent ?? this.node.scene;
        container.addChild(fail);
        fail.setPosition(0, 0, 0);

        const finalScale = fail.scale.clone();
        fail.setScale(finalScale.clone().multiplyScalar(this.failStartScale));

        tween(fail)
            .to(this.failPopDuration, { scale: finalScale.clone().multiplyScalar(this.failOvershootScale) }, { easing: 'backOut' })
            .to(this.failSettleDuration, { scale: finalScale }, { easing: 'sineOut' })
            .call(() => {
                this.scheduleOnce(() => this.showGameOver(), this.gameOverDelay);
            })
            .start();
    }

    private finishGame(delay: number, finishNode: Node | null = null) {
        if (RunnerGameManager.isFinished || RunnerGameManager.isFinishing) {
            return;
        }

        this.replaceFinishNode(finishNode);

        if (delay > 0) {
            RunnerGameManager.isFinishing = true;
            RunnerGameManager.isStarted = false;
            RunnerGameManager.shouldConsumeStartInput = false;
            RunnerGameManager.shouldJumpAfterFirstEnemyHint = false;
            this.scheduleOnce(() => this.completeFinish(), delay);
            return;
        }

        this.completeFinish();
    }

    private replaceFinishNode(finishNode: Node | null) {
        if (!this.finishedFinishPrefab || !finishNode?.isValid) {
            return;
        }

        const parent = finishNode.parent;
        if (!parent) {
            return;
        }

        const replacement = instantiate(this.finishedFinishPrefab);
        const siblingIndex = finishNode.getSiblingIndex();
        const position = finishNode.position.clone();
        const scale = finishNode.scale.clone();
        const angle = finishNode.angle;

        parent.addChild(replacement);
        replacement.setSiblingIndex(siblingIndex);
        replacement.setPosition(position);
        replacement.setScale(scale);
        replacement.angle = angle;
        this.alignReplacementFinishToSource(finishNode, replacement, parent);
        finishNode.destroy();
    }

    private alignReplacementFinishToSource(source: Node, replacement: Node, parent: Node) {
        const sourceTransform = source.getComponent(UITransform);
        const replacementTransform = replacement.getComponent(UITransform);
        if (!sourceTransform || !replacementTransform) {
            return;
        }

        const sourceBounds = sourceTransform.getBoundingBoxToWorld();
        const replacementBounds = replacementTransform.getBoundingBoxToWorld();
        const bottomDelta = sourceBounds.yMin - replacementBounds.yMin;

        if (Math.abs(bottomDelta) <= 0.01) {
            return;
        }

        const parentTransform = parent.getComponent(UITransform);
        const worldShift = new Vec3(0, bottomDelta, 0);
        const localShift = new Vec3();

        if (parentTransform) {
            const origin = parentTransform.convertToNodeSpaceAR(new Vec3(0, 0, 0));
            const shifted = parentTransform.convertToNodeSpaceAR(worldShift);
            localShift.set(shifted.x - origin.x, shifted.y - origin.y, 0);
        } else {
            const origin = new Vec3();
            const shifted = new Vec3();
            parent.inverseTransformPoint(origin, new Vec3(0, 0, 0));
            parent.inverseTransformPoint(shifted, worldShift);
            localShift.set(shifted.x - origin.x, shifted.y - origin.y, 0);
        }

        replacement.setPosition(
            replacement.position.x + localShift.x,
            replacement.position.y + localShift.y,
            replacement.position.z,
        );
    }

    private completeFinish() {
        if (RunnerGameManager.isFinished) {
            return;
        }

        RunnerGameManager.isFinishing = false;
        RunnerGameManager.isFinished = true;
        RunnerGameManager.isStarted = false;
        RunnerGameManager.shouldConsumeStartInput = false;
        RunnerGameManager.shouldJumpAfterFirstEnemyHint = false;
        this.fadeOutNode(this.hintFinger);
        this.fadeOutNode(this.hintTextNode);

        const finishCelebration = this.finishCelebration ?? this.ensureFinishCelebration();
        finishCelebration?.play();
        this.playEffect(this.confetti);
        const winDelay = Math.max(this.winGameDelay, finishCelebration?.winScreenDelay ?? 0);
        this.scheduleOnce(() => this.showWinGame(), winDelay);
    }

    private ensureFinishCelebration() {
        if (this.finishCelebration?.isValid) {
            return this.finishCelebration;
        }

        if (!this.confettiPiecePrefab) {
            return null;
        }

        const container = this.node.scene?.getChildByName('Canvas') ?? this.node.parent ?? this.node.scene ?? this.node;
        const celebrationNode = new Node('FinishCelebration');
        container.addChild(celebrationNode);
        celebrationNode.setPosition(0, 0, 0);

        const celebration = celebrationNode.addComponent(RunnerFinishCelebration);
        celebration.piecePrefab = this.confettiPiecePrefab;
        celebration.spawnContainer = container;
        this.finishCelebration = celebration;
        return celebration;
    }

    private showWinGame() {
        this.playWinGameAudio();

        if (!this.winGamePrefab) {
            return;
        }

        const winGame = instantiate(this.winGamePrefab);
        const container = this.winGameContainer ?? this.gameOverContainer ?? this.failContainer ?? this.node.parent ?? this.node.scene;
        container.addChild(winGame);
        winGame.setPosition(0, 0, 0);

        let winScreen = winGame.getComponent(RunnerGameOverScreen);
        if (!winScreen) {
            winScreen = winGame.addComponent(RunnerGameOverScreen);
        }

        winScreen.titleText = this.winTitleText;
        winScreen.buttonText = this.winButtonText;
        winScreen.setup(this.score);
        this.attachStoreRedirectsIn(winGame);
    }

    private showGameOver() {
        this.playLooseGameAudio();

        if (!this.gameOverPrefab) {
            return;
        }

        const gameOver = instantiate(this.gameOverPrefab);
        const container = this.gameOverContainer ?? this.failContainer ?? this.node.parent ?? this.node.scene;
        container.addChild(gameOver);
        gameOver.setPosition(0, 0, 0);

        let gameOverScreen = gameOver.getComponent(RunnerGameOverScreen);
        if (!gameOverScreen) {
            gameOverScreen = gameOver.addComponent(RunnerGameOverScreen);
        }
        gameOverScreen.setup(this.score);
        this.attachStoreRedirectsIn(gameOver);
    }

    private collectNode(node: Node, value: number) {
        if (!node.isValid || this.collectedNodes.has(node)) {
            return false;
        }

        this.collectedNodes.add(node);
        node.getComponents(Collider2D).forEach((collider) => {
            collider.enabled = false;
        });

        const target = this.resolveCollectTarget();
        const startScale = node.scale.clone();
        const popScale = startScale.clone().multiplyScalar(this.collectPopScale);
        const endScale = startScale.clone().multiplyScalar(this.collectEndScale);

        tween(node).stop();

        if (!target) {
            tween(node)
                .to(0.15, { scale: endScale })
                .call(() => {
                    this.addScore(value);
                    node.destroy();
                })
                .start();
            return true;
        }

        const targetPosition = target.worldPosition.clone();
        tween(node)
            .to(0.08, { scale: popScale }, { easing: 'backOut' })
            .to(
                this.collectFlyDuration,
                {
                    worldPosition: new Vec3(targetPosition.x, targetPosition.y, node.worldPosition.z),
                    scale: endScale,
                },
                { easing: 'cubicIn' },
            )
            .call(() => {
                this.addScore(value);
                node.destroy();
            })
            .start();

        return true;
    }

    private addScore(value: number) {
        this.score += value;
        this.updateScoreLabel();
    }

    private updateScoreLabel() {
        if (this.scoreLabel) {
            this.scoreLabel.string = `${this.scorePrefix}${this.score}`;
        }
    }

    private resolveScoreLabel() {
        if (this.scoreLabel?.isValid) {
            return this.scoreLabel;
        }

        this.scoreLabel = this.findScoreLabel(this.node.scene);
        return this.scoreLabel;
    }

    private findScoreLabel(node: Node | null, insideScoreContainer = false): Label | null {
        if (!node) {
            return null;
        }

        const isScoreContainer = insideScoreContainer || /counter|cunter|score|money|cash|paypal/i.test(node.name);
        const label = node.getComponent(Label);
        if (label && (isScoreContainer || label.string.includes(this.scorePrefix))) {
            return label;
        }

        for (const child of node.children) {
            const found = this.findScoreLabel(child, isScoreContainer);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private resolveCollectTarget() {
        if (this.collectTarget?.isValid) {
            return this.collectTarget;
        }

        const root = this.node.scene;
        this.collectTarget = this.findNamedCollectTarget(root) ?? this.findTopRightCollectTarget(root);
        return this.collectTarget;
    }

    private findNamedCollectTarget(node: Node | null): Node | null {
        if (!node) {
            return null;
        }

        if (/(paypal|pay\s*pal|score|wallet|counter|cunter|collecttarget)/i.test(node.name) && node.getComponent(Sprite)) {
            return node;
        }

        for (const child of node.children) {
            const target = this.findNamedCollectTarget(child);
            if (target) {
                return target;
            }
        }

        return null;
    }

    private findTopRightCollectTarget(node: Node | null, best: Node | null = null): Node | null {
        if (!node) {
            return best;
        }

        const transform = node.getComponent(UITransform);
        const isUiSizedSprite =
            node.getComponent(Sprite) &&
            transform &&
            transform.width <= 420 &&
            transform.height <= 220 &&
            node.worldPosition.x > 0 &&
            node.worldPosition.y > 0 &&
            !/^heart/i.test(node.name);

        if (isUiSizedSprite) {
            const bestScore = best ? best.worldPosition.x + best.worldPosition.y : -Infinity;
            const nodeScore = node.worldPosition.x + node.worldPosition.y;
            if (nodeScore > bestScore) {
                best = node;
            }
        }

        for (const child of node.children) {
            best = this.findTopRightCollectTarget(child, best);
        }

        return best;
    }

    private resolveHearts() {
        if (this.hearts.length > 0) {
            this.hearts = this.hearts.filter((heart) => heart);
            return;
        }

        const root = this.heartsRoot ?? this.node.scene;
        const found: Node[] = [];
        this.collectHeartNodes(root, found);

        this.hearts = found.sort((left, right) => left.worldPosition.x - right.worldPosition.x);
    }

    private collectHeartNodes(node: Node | null, output: Node[]) {
        if (!node) {
            return;
        }

        if (/^heart/i.test(node.name) && node.getComponent(Sprite)) {
            output.push(node);
        }

        node.children.forEach((child) => this.collectHeartNodes(child, output));
    }

    private updateHearts(animate = false) {
        this.hearts.forEach((heart, index) => {
            heart.active = true;

            let opacity = heart.getComponent(UIOpacity);
            if (!opacity) {
                opacity = heart.addComponent(UIOpacity);
            }

            const targetOpacity = index < this.health ? 255 : this.damagedHeartOpacity;
            tween(opacity).stop();

            if (animate) {
                tween(opacity)
                    .to(this.heartFadeDuration, { opacity: targetOpacity })
                    .start();
                return;
            }

            opacity.opacity = targetOpacity;
        });
    }

    private hideStartHint() {
        this.fadeOutNode(this.hintFinger);
        this.fadeOutNode(this.hintTextNode);
    }

    private showFirstEnemyHint() {
        this.isFirstEnemyPaused = true;
        RunnerGameManager.isStarted = false;

        if (this.hintTextNode) {
            const label = this.hintTextNode.getComponent(Label);
            if (label) {
                label.string = this.firstEnemyHintText;
            }
        }

        this.fadeInNode(this.hintTextNode);
        this.fadeInNode(this.hintFinger);
        this.playFingerPulse();
    }

    private resumeFromFirstEnemyHint() {
        this.isFirstEnemyPaused = false;
        RunnerGameManager.isStarted = true;
        RunnerGameManager.shouldConsumeStartInput = false;
        RunnerGameManager.shouldJumpAfterFirstEnemyHint = true;
        this.playFone();
        this.hideStartHint();
    }

    private fadeInNode(target: Node | null) {
        if (!target) {
            return;
        }

        tween(target).stop();
        target.active = true;

        let opacity = target.getComponent(UIOpacity);
        if (!opacity) {
            opacity = target.addComponent(UIOpacity);
        }

        opacity.opacity = 255;
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
                if (target !== this.node) {
                    target.active = false;
                }
            })
            .start();
    }

    private playFone() {
        if (!this.fone || this.foneStarted || this.playedLooseGame || this.playedWinGame) {
            return;
        }

        const source = this.getFoneSource();
        source.clip = this.fone;
        source.loop = true;
        source.play();
        this.foneStarted = true;
    }

    private stopFone() {
        this.foneSource?.stop();
        this.foneStarted = false;
    }

    private playLooseGameAudio() {
        if (this.playedLooseGame) {
            return;
        }

        this.playedLooseGame = true;
        this.stopFone();
        this.playEffect(this.looseGame);
    }

    private playWinGameAudio() {
        if (this.playedWinGame) {
            return;
        }

        this.playedWinGame = true;
        this.stopFone();
        this.playEffect(this.winGame);
    }

    private playEffect(clip: AudioClip | null) {
        if (!clip) {
            return;
        }

        this.getEffectsSource().playOneShot(clip);
    }

    private getFoneSource() {
        if (!this.foneSource) {
            this.foneSource = this.getAudioHost().addComponent(AudioSource);
        }

        return this.foneSource;
    }

    private getEffectsSource() {
        if (!this.effectsSource) {
            this.effectsSource = this.getAudioHost().addComponent(AudioSource);
        }

        return this.effectsSource;
    }

    private getAudioHost() {
        return this.node.parent ?? this.node.scene ?? this.node;
    }
}
