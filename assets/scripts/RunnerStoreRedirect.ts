import { _decorator, Button, Component, sys } from 'cc';

const { ccclass, property } = _decorator;

type MraidWindow = Window & {
    mraid?: {
        open?: (url: string) => void;
    };
};

@ccclass('RunnerStoreRedirect')
export class RunnerStoreRedirect extends Component {
    @property
    androidStoreUrl = '';

    @property
    iosStoreUrl = '';

    @property
    fallbackUrl = '';

    @property
    openInNewTab = false;

    private button: Button | null = null;

    onEnable() {
        this.button = this.getComponent(Button);
        this.button?.node.on(Button.EventType.CLICK, this.openStore, this);
    }

    onDisable() {
        this.button?.node.off(Button.EventType.CLICK, this.openStore, this);
    }

    configure(androidStoreUrl: string, iosStoreUrl: string, fallbackUrl: string) {
        this.androidStoreUrl = androidStoreUrl;
        this.iosStoreUrl = iosStoreUrl;
        this.fallbackUrl = fallbackUrl;
    }

    openStore() {
        const url = this.resolveStoreUrl();
        if (!url) {
            console.warn('RunnerStoreRedirect: store URL is not configured.');
            return;
        }

        const browserWindow = this.getBrowserWindow();
        const mraid = browserWindow?.mraid;
        if (mraid?.open) {
            mraid.open(url);
            return;
        }

        if (sys.isBrowser && browserWindow) {
            if (this.openInNewTab) {
                const opened = browserWindow.open(url, '_blank');
                if (opened) {
                    return;
                }
            }

            browserWindow.location.href = url;
            return;
        }

        sys.openURL(url);
    }

    private resolveStoreUrl() {
        if (this.isAndroid()) {
            return this.androidStoreUrl || this.fallbackUrl;
        }

        if (this.isIos()) {
            return this.iosStoreUrl || this.fallbackUrl;
        }

        return this.fallbackUrl || this.androidStoreUrl || this.iosStoreUrl;
    }

    private isAndroid() {
        return /android/i.test(this.getUserAgent());
    }

    private isIos() {
        const browserWindow = this.getBrowserWindow();
        const navigator = browserWindow?.navigator;
        const userAgent = this.getUserAgent();
        const platform = navigator?.platform ?? '';
        const maxTouchPoints = navigator?.maxTouchPoints ?? 0;

        return /iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
    }

    private getUserAgent() {
        return this.getBrowserWindow()?.navigator?.userAgent ?? '';
    }

    private getBrowserWindow() {
        if (typeof window === 'undefined') {
            return null;
        }

        return window as MraidWindow;
    }
}
