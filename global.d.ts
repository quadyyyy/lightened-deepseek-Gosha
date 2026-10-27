export {};

declare global {
    type Lang = 'RU' | 'UA' | 'EN';

    type DeepSeekModel = 'deepseek-flash';

    type Strategy = {
        model: DeepSeekModel;
        useRofl: boolean;
        useCaption: boolean;
        tries: number;
    };

    type Variant = {
        content: string;
        isGood: boolean;
    };

    type Config = {
        geminiVideo: import('./video-reactions.js').VideoSettings;
        deepseekApiKey: string;
        deepseekModel: DeepSeekModel;
        proxyUrl?: string;
        botToken: string;
        botUsername: string;
        banList: number[];
        adminId: number | null;
        prompt: string;
        captionPrompt: string;
        mentions: Record<Lang, Array<string>>;
        logsChatId: number;
        adminIds: Array<number>;
        helloMessage: string;
        anonMessage: Record<Lang, string>;
        censoredMessage: Record<Lang, string>;
        cooldownMessage: Record<Lang, string>;
    };
}
