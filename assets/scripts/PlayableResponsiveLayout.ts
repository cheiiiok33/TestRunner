import { _decorator, BoxCollider2D, Camera, Color, Component, game, Node, ResolutionPolicy, screen, Size, UITransform, Vec3, view, Widget } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerPlayerController } from './RunnerPlayerController';
import { RunnerScrollLoop } from './RunnerScrollLoop';

const { ccclass, property } = _decorator;

@ccclass('PlayableResponsiveLayout')
export class PlayableResponsiveLayout extends Component {
    @property(Camera)
    camera: Camera | null = null;

    @property(Node)
    gameWorld: Node | null = null;

    @property(Node)
    hero: Node | null = null;

    @property(Node)
    tapHint: Node | null = null;

    @property(Node)
    hand: Node | null = null;

    @property(Node)
    ground: Node | null = null;

    @property
    designWidth = 1080;

    @property
    designHeight = 2368;

    @property
    portraitHeroX = -340;

    @property
    usePortraitHeroNormalizedX = true;

    @property
    portraitHeroNormalizedX = 0.2;

    @property
    portraitHeroMinLeftPadding = 90;

    @property
    portraitHeroMaxRightPadding = 220;

    @property
    portraitHeroY = -85;

    @property
    landscapeHeroX = -390;

    @property
    landscapeHeroY = -85;

    @property
    portraitHeroScale = 1;

    @property
    landscapeHeroScale = 1;

    @property
    keepLandscapeViewInPortrait = false;

    @property
    portraitWorldScale = 1;

    @property
    landscapeWorldScale = 1;

    @property
    portraitWorldY = 0;

    @property
    landscapeWorldY = 0;

    @property
    portraitGameplayHeight = 760;

    @property
    landscapeGameplayHeight = 720;

    @property
    backgroundTileWidth = 4000;

    @property
    backgroundTileHeight = 2368;

    @property
    backgroundTileOverlap = 16;

    @property
    backgroundTileBleed = 260;

    @property
    groundExtraWidth = 600;

    @property
    usePlayableClearColor = true;

    @property(Color)
    playableClearColor = new Color(248, 229, 224, 255);

    private lastWidth = 0;
    private lastHeight = 0;
    private lastPortrait = false;
    private lastSafeKey = '';
    private lastViewportWidth = 0;
    private lastViewportHeight = 0;
    private heroBaseX = 0;
    private heroBaseY = 0;
    private groundBaseY = 0;
    private readonly handBaseScale = new Vec3(1, 1, 1);
    private readonly backgroundBaseSizes = new WeakMap<Node, Size>();
    private readonly baseWidgetOffsets = new WeakMap<Widget, {
        left: number;
        right: number;
        top: number;
        bottom: number;
    }>();
    private readonly onBrowserResize = () => {
        this.scheduleOnce(() => this.applyLayout(true), 0);
    };

    onLoad() {
        this.applyBootstrapBackgroundColor();
        this.ground = this.ground ?? this.node.scene?.getChildByName('Ground') ?? this.node.getChildByName('Ground');
        this.heroBaseX = this.hero?.position.x ?? 0;
        this.heroBaseY = this.hero?.position.y ?? 0;
        this.groundBaseY = this.ground?.position.y ?? 0;
        const playerController = this.hero?.getComponent(RunnerPlayerController);
        if (this.hero && playerController) {
            playerController.fixedX = this.heroBaseX;
            this.hero.setPosition(this.heroBaseX, this.hero.position.y, this.hero.position.z);
        }

        if (this.hand) {
            this.handBaseScale.set(this.hand.scale);
        }

        view.resizeWithBrowserSize(true);
        this.applyResolution(this.isPortraitFrame());
        screen.on('orientation-change', this.onOrientationChange, this);
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this.onBrowserResize);
        }
        this.applyLayout(true);
    }

    onDestroy() {
        screen.off('orientation-change', this.onOrientationChange, this);
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.onBrowserResize);
        }
    }

    update() {
        this.applyLayout(false);
    }

    private onOrientationChange() {
        this.scheduleOnce(() => this.applyLayout(true), 0.1);
    }

    private getViewportSize() {
        if (typeof window === 'undefined') {
            return view.getFrameSize();
        }

        const visualViewport = window.visualViewport;
        return {
            width: visualViewport?.width ?? window.innerWidth,
            height: visualViewport?.height ?? window.innerHeight,
        };
    }

    private isPortraitFrame() {
        if (typeof window !== 'undefined') {
            const viewportSize = this.getViewportSize();
            return viewportSize.height >= viewportSize.width;
        }

        const frame = view.getFrameSize();
        return frame.height >= frame.width;
    }

    private getSafeInsets(visibleWidth: number, visibleHeight: number) {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return { top: 0, right: 0, bottom: 0, left: 0, key: '0,0,0,0' };
        }

        const styles = getComputedStyle(document.documentElement);
        const readInset = (name: string) => {
            const value = Number.parseFloat(styles.getPropertyValue(name).trim());
            return Number.isFinite(value) ? value : 0;
        };

        const viewportSize = this.getViewportSize();
        const scaleX = visibleWidth / Math.max(1, viewportSize.width);
        const scaleY = visibleHeight / Math.max(1, viewportSize.height);

        const top = readInset('--safe-top') * scaleY;
        const right = readInset('--safe-right') * scaleX;
        const bottom = readInset('--safe-bottom') * scaleY;
        const left = readInset('--safe-left') * scaleX;

        return {
            top,
            right,
            bottom,
            left,
            key: `${top.toFixed(1)},${right.toFixed(1)},${bottom.toFixed(1)},${left.toFixed(1)}`,
        };
    }

    private applyResolution(isPortrait = this.isPortraitFrame()) {
        const portraitWidth = Math.min(this.designWidth, this.designHeight);
        const portraitHeight = Math.max(this.designWidth, this.designHeight);
        void isPortrait;
        view.setDesignResolutionSize(portraitWidth, portraitHeight, ResolutionPolicy.FIXED_HEIGHT);
    }

    private applyViewportStyles() {
        if (typeof document === 'undefined') {
            return;
        }

        this.applyBootstrapBackgroundColor();
        const viewportSize = this.getViewportSize();
        if (
            Math.abs(viewportSize.width - this.lastViewportWidth) < 0.5 &&
            Math.abs(viewportSize.height - this.lastViewportHeight) < 0.5
        ) {
            return;
        }

        this.lastViewportWidth = viewportSize.width;
        this.lastViewportHeight = viewportSize.height;

        const canvas = game.canvas;
        const container = game.container;
        const width = `${viewportSize.width}px`;
        const height = `${viewportSize.height}px`;

        if (document.body) {
            document.body.style.position = 'fixed';
            document.body.style.left = '0';
            document.body.style.top = '0';
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            document.body.style.overflow = 'hidden';
            document.body.style.width = width;
            document.body.style.height = height;
        }

        if (document.documentElement) {
            document.documentElement.style.margin = '0';
            document.documentElement.style.padding = '0';
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.width = width;
            document.documentElement.style.height = height;
            document.documentElement.style.setProperty('--safe-top', 'env(safe-area-inset-top)');
            document.documentElement.style.setProperty('--safe-right', 'env(safe-area-inset-right)');
            document.documentElement.style.setProperty('--safe-bottom', 'env(safe-area-inset-bottom)');
            document.documentElement.style.setProperty('--safe-left', 'env(safe-area-inset-left)');
        }

        const gameDiv = document.getElementById('GameDiv');
        const cocosContainer = document.getElementById('Cocos3dGameContainer');

        if (gameDiv) {
            gameDiv.style.width = width;
            gameDiv.style.height = height;
        }

        if (cocosContainer) {
            cocosContainer.style.width = width;
            cocosContainer.style.height = height;
        }

        if (container) {
            container.style.width = width;
            container.style.height = height;
        }

        if (canvas) {
            canvas.style.width = width;
            canvas.style.height = height;
        }
    }

    private applyBootstrapBackgroundColor() {
        if (typeof document === 'undefined') {
            return;
        }

        const backgroundColor = this.toCssColor(this.playableClearColor);
        const body = document.body;
        const root = document.documentElement;
        const canvas = game.canvas;
        const container = game.container;
        const gameDiv = document.getElementById('GameDiv');
        const cocosContainer = document.getElementById('Cocos3dGameContainer');

        if (body) {
            body.style.backgroundColor = backgroundColor;
        }

        if (root) {
            root.style.backgroundColor = backgroundColor;
        }

        if (gameDiv) {
            gameDiv.style.backgroundColor = backgroundColor;
        }

        if (cocosContainer) {
            cocosContainer.style.backgroundColor = backgroundColor;
        }

        if (container) {
            container.style.backgroundColor = backgroundColor;
        }

        if (canvas) {
            canvas.style.backgroundColor = backgroundColor;
        }
    }

    private toCssColor(color: Color) {
        return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
    }

    private applyLayout(force: boolean) {
        this.applyViewportStyles();

        const isPortrait = this.isPortraitFrame();
        this.applyResolution(isPortrait);
        const visible = view.getVisibleSize();
        const safeInsets = this.getSafeInsets(visible.width, visible.height);

        if (
            !force &&
            Math.abs(visible.width - this.lastWidth) < 0.5 &&
            Math.abs(visible.height - this.lastHeight) < 0.5 &&
            isPortrait === this.lastPortrait &&
            safeInsets.key === this.lastSafeKey
        ) {
            return;
        }

        this.lastWidth = visible.width;
        this.lastHeight = visible.height;
        this.lastPortrait = isPortrait;
        this.lastSafeKey = safeInsets.key;

        this.applySafeAreaToWidgets(safeInsets);

        if (this.camera) {
            this.camera.orthoHeight = visible.height * 0.5;
            if (this.usePlayableClearColor) {
                this.camera.clearColor = this.playableClearColor;
            }
            this.camera.node.setPosition(0, 0, this.camera.node.position.z);
        }

        this.layoutBackgrounds(visible.width, visible.height);
        this.layoutGround(visible.width, safeInsets.left + safeInsets.right);

        if (this.hero) {
            const x = this.resolveHeroX(isPortrait);
            const y = this.resolveHeroY(isPortrait);
            const scale = isPortrait ? this.portraitHeroScale : this.landscapeHeroScale;
            const playerController = this.hero.getComponent(RunnerPlayerController);
            const safeX = x;
            if (playerController) {
                playerController.fixedX = safeX;
            }
            this.hero.setPosition(safeX, RunnerGameManager.isStarted ? this.hero.position.y : y, this.hero.position.z);
            this.hero.setScale(scale, scale, this.hero.scale.z);
        }

        if (this.tapHint) {
            this.tapHint.setPosition(0, isPortrait ? 120 : 80, this.tapHint.position.z);
            const scale = isPortrait ? 0.8 : 1;
            this.tapHint.setScale(scale, scale, this.tapHint.scale.z);
        }

        if (this.hand) {
            this.hand.setPosition(0, isPortrait ? -120 : -80, this.hand.position.z);
            const scale = isPortrait ? 0.65 : 1;
            this.hand.setScale(
                this.handBaseScale.x * scale,
                this.handBaseScale.y * scale,
                this.handBaseScale.z,
            );
        }

        if (this.gameWorld) {
            const worldScale = isPortrait ? this.portraitWorldScale : this.landscapeWorldScale;
            const worldY = isPortrait ? this.portraitWorldY : this.landscapeWorldY;
            this.gameWorld.setScale(worldScale, worldScale, this.gameWorld.scale.z);
            this.gameWorld.setPosition(this.gameWorld.position.x, worldY, this.gameWorld.position.z);
        }
    }

    private layoutBackgrounds(visibleWidth: number, visibleHeight: number) {
        if (!this.gameWorld) {
            return;
        }

        const backgrounds = [
            this.gameWorld.getChildByName('Background'),
            this.gameWorld.getChildByName('Background1'),
        ].filter((node): node is Node => !!node);

        if (backgrounds.length === 0) {
            return;
        }

        backgrounds.forEach((background, index) => {
            const transform = background.getComponent(UITransform);
            if (transform) {
                let baseSize = this.backgroundBaseSizes.get(background);
                if (!baseSize) {
                    baseSize = new Size(transform.width, transform.height);
                    this.backgroundBaseSizes.set(background, baseSize);
                }

                const overlap = Math.max(0, this.backgroundTileOverlap);
                const bleed = Math.max(0, this.backgroundTileBleed);
                const targetWidth = Math.max(baseSize.width, visibleWidth + bleed * 2 + overlap + 32);
                const targetHeight = Math.max(baseSize.height, visibleHeight);

                if (Math.abs(transform.width - targetWidth) > 0.5 || Math.abs(transform.height - targetHeight) > 0.5) {
                    transform.setContentSize(targetWidth, targetHeight);
                }
            }

            const visualWidth = transform ? transform.width : this.backgroundTileWidth;
            const overlap = Math.max(0, this.backgroundTileOverlap);
            const bleed = Math.max(0, this.backgroundTileBleed);
            const spacing = Math.max(1, visualWidth - overlap);
            background.setPosition(index * spacing - bleed, 0, background.position.z);

            const scroller = background.getComponent(RunnerScrollLoop);
            if (scroller) {
                scroller.autoLoopOverlap = overlap;
                scroller.autoLoopLeadBleed = bleed;
            }
        });
    }

    private layoutGround(visibleWidth: number, totalSafeInsetX: number) {
        if (!this.ground) {
            return;
        }

        const transform = this.ground.getComponent(UITransform);
        if (!transform) {
            return;
        }

        const targetWidth = Math.max(2000, visibleWidth + totalSafeInsetX + this.groundExtraWidth);
        if (Math.abs(transform.width - targetWidth) > 0.5) {
            transform.setContentSize(targetWidth, transform.height);
        }

        const collider = this.ground.getComponent(BoxCollider2D);
        if (collider && Math.abs(collider.size.width - targetWidth) > 0.5) {
            collider.size = new Size(targetWidth, collider.size.height);
        }

        if (Math.abs(this.ground.position.x) > 0.5) {
            this.ground.setPosition(0, this.ground.position.y, this.ground.position.z);
        }

        const playerController = this.hero?.getComponent(RunnerPlayerController);
        const minGroundX = this.ground.position.x - targetWidth * 0.5 + 120;
        if (playerController && playerController.fixedX < minGroundX) {
            playerController.fixedX = minGroundX;
        }
    }

    private applySafeAreaToWidgets(safeInsets: { top: number; right: number; bottom: number; left: number; key: string; }) {
        const root = this.node.scene ?? this.node;
        const widgets = root.getComponentsInChildren(Widget);

        widgets.forEach((widget) => {
            if (widget.node === this.node) {
                return;
            }

            let baseOffsets = this.baseWidgetOffsets.get(widget);
            if (!baseOffsets) {
                baseOffsets = {
                    left: widget.left,
                    right: widget.right,
                    top: widget.top,
                    bottom: widget.bottom,
                };
                this.baseWidgetOffsets.set(widget, baseOffsets);
            }

            widget.left = baseOffsets.left + safeInsets.left;
            widget.right = baseOffsets.right + safeInsets.right;
            widget.top = baseOffsets.top + safeInsets.top;
            widget.bottom = baseOffsets.bottom + safeInsets.bottom;
            widget.updateAlignment();
        });
    }

    private clamp(value: number, min: number, max: number) {
        if (min > max) {
            return (min + max) * 0.5;
        }

        return Math.min(max, Math.max(min, value));
    }

    private resolveHeroY(isPortrait: boolean) {
        if (this.ground) {
            return this.ground.position.y + (this.heroBaseY - this.groundBaseY);
        }

        return isPortrait ? this.portraitHeroY : this.landscapeHeroY;
    }

    private resolveHeroX(_isPortrait: boolean) {
        return this.heroBaseX;
    }
}
