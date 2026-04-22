import { _decorator, Camera, Color, Component, game, Node, ResolutionPolicy, screen, UITransform, Vec3, view } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerPlayerController } from './RunnerPlayerController';

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
    backgroundTileWidth = 1707;

    @property
    backgroundTileHeight = 720;

    @property
    usePlayableClearColor = true;

    @property(Color)
    playableClearColor = new Color(248, 229, 224, 255);

    private lastWidth = 0;
    private lastHeight = 0;
    private lastPortrait = false;
    private lastSafeKey = '';
    private readonly handBaseScale = new Vec3(1, 1, 1);
    private readonly onBrowserResize = () => {
        this.scheduleOnce(() => this.applyLayout(true), 0);
    };

    onLoad() {
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

        if (isPortrait && !this.keepLandscapeViewInPortrait) {
            view.setDesignResolutionSize(portraitWidth, portraitHeight, ResolutionPolicy.FIXED_HEIGHT);
        } else {
            view.setDesignResolutionSize(portraitHeight, portraitWidth, ResolutionPolicy.FIXED_HEIGHT);
        }
    }

    private applyViewportStyles() {
        if (typeof document === 'undefined') {
            return;
        }

        const canvas = game.canvas;
        const container = game.container;
        const viewportSize = this.getViewportSize();
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

        const halfWidth = visible.width * 0.5;
        const left = -halfWidth + safeInsets.left;
        const right = halfWidth - safeInsets.right;

        if (this.camera) {
            this.camera.orthoHeight = visible.height * 0.5;
            if (this.usePlayableClearColor) {
                this.camera.clearColor = this.playableClearColor;
            }
            this.camera.node.setPosition(0, 0, this.camera.node.position.z);
        }

        this.layoutBackgrounds(visible.width, visible.height, isPortrait);

        if (this.hero) {
            const x = isPortrait ? this.resolvePortraitHeroX(left, right) : this.landscapeHeroX;
            const y = isPortrait ? this.portraitHeroY : this.landscapeHeroY;
            const scale = isPortrait ? this.portraitHeroScale : this.landscapeHeroScale;
            const playerController = this.hero.getComponent(RunnerPlayerController);
            const safeX = isPortrait
                ? this.clamp(x, left + this.portraitHeroMinLeftPadding, right - this.portraitHeroMaxRightPadding)
                : x;
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

    private layoutBackgrounds(visibleWidth: number, visibleHeight: number, isPortrait: boolean) {
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

        const tileWidth = this.backgroundTileWidth > 0
            ? this.backgroundTileWidth
            : backgrounds[0].getComponent(UITransform)?.width ?? this.designWidth;
        const tileHeight = this.backgroundTileHeight > 0 ? this.backgroundTileHeight : undefined;

        backgrounds.forEach((background, index) => {
            const transform = background.getComponent(UITransform);
            if (transform && tileHeight) {
                transform.setContentSize(tileWidth, tileHeight);
            }

            background.setPosition(index * tileWidth, 0, background.position.z);

            for (const component of background.getComponents(Component)) {
                const scrollingComponent = component as Component & {
                    loopWidth?: number;
                    leftBound?: number;
                    resetX?: number;
                };
                if (typeof scrollingComponent.loopWidth === 'number') {
                    scrollingComponent.loopWidth = tileWidth;
                }
                if (typeof scrollingComponent.leftBound === 'number') {
                    scrollingComponent.leftBound = -tileWidth;
                }
                if (typeof scrollingComponent.resetX === 'number') {
                    scrollingComponent.resetX = tileWidth;
                }
            }
        });
    }

    private clamp(value: number, min: number, max: number) {
        if (min > max) {
            return (min + max) * 0.5;
        }

        return Math.min(max, Math.max(min, value));
    }

    private resolvePortraitHeroX(left: number, right: number) {
        if (!this.usePortraitHeroNormalizedX) {
            return this.portraitHeroX;
        }

        const normalizedX = this.clamp(this.portraitHeroNormalizedX, 0, 1);
        return left + (right - left) * normalizedX;
    }
}
