export type ProfileTheme = {
    id: string;
    label: string;
    main: string;
    soft: string;
    accent: string;
    text: string;
};

export type ProfileFont = {
    id: string;
    label: string;
    family: string;
};

export const DEFAULT_PROFILE_THEME_ID = 'svelta';

export const PROFILE_THEMES: ProfileTheme[] = [
    {
        id: 'svelta',
        label: 'Svelta',
        main: '#f2f1e8',
        soft: '#fefef8',
        accent: '#262626',
        text: '#262626',
    },
    {
        id: 'moss',
        label: 'Mose',
        main: '#365d2c',
        soft: '#edf5e8',
        accent: '#7faa67',
        text: '#12340d',
    },
    {
        id: 'terracotta',
        label: 'Terrakotta',
        main: '#9a4f37',
        soft: '#f8ece7',
        accent: '#d1886e',
        text: '#4b1f13',
    },
    {
        id: 'fjord',
        label: 'Fjord',
        main: '#2f6071',
        soft: '#e8f3f6',
        accent: '#79aebd',
        text: '#143340',
    },
    {
        id: 'berry',
        label: 'Bær',
        main: '#7d3558',
        soft: '#f7eaf1',
        accent: '#c97ca1',
        text: '#411428',
    },
    {
        id: 'sun',
        label: 'Sol',
        main: '#9b6a14',
        soft: '#fbf2dd',
        accent: '#d7aa4e',
        text: '#4c3200',
    },
];

export const PROFILE_FONTS: ProfileFont[] = [
    {
        id: 'urbanist',
        label: 'Urbanist',
        family: 'var(--font-urbanist), sans-serif',
    },
    { id: 'sora', label: 'Sora', family: 'var(--font-sora), sans-serif' },
    {
        id: 'space-grotesk',
        label: 'Space Grotesk',
        family: 'var(--font-space-grotesk), sans-serif',
    },
    {
        id: 'fraunces',
        label: 'Fraunces',
        family: 'var(--font-fraunces), serif',
    },
    {
        id: 'newsreader',
        label: 'Newsreader',
        family: 'var(--font-newsreader), serif',
    },
    { id: 'syne', label: 'Syne', family: 'var(--font-syne), sans-serif' },
];

const LEGACY_PROFILE_FONT_IDS: Record<string, string> = {
    georgia: 'fraunces',
    trebuchet: 'sora',
    palatino: 'newsreader',
    verdana: 'space-grotesk',
};

export function getProfileTheme(themeId?: string | null) {
    return (
        PROFILE_THEMES.find((theme) => theme.id === themeId) ??
        PROFILE_THEMES[0]
    );
}

export function getProfileFont(fontId?: string | null) {
    const resolvedFontId = fontId
        ? (LEGACY_PROFILE_FONT_IDS[fontId] ?? fontId)
        : fontId;
    return (
        PROFILE_FONTS.find((font) => font.id === resolvedFontId) ??
        PROFILE_FONTS[0]
    );
}
