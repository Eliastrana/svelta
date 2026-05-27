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

export const PROFILE_THEMES: ProfileTheme[] = [
    { id: 'moss', label: 'Mose', main: '#365d2c', soft: '#edf5e8', accent: '#7faa67', text: '#12340d' },
    { id: 'terracotta', label: 'Terrakotta', main: '#9a4f37', soft: '#f8ece7', accent: '#d1886e', text: '#4b1f13' },
    { id: 'fjord', label: 'Fjord', main: '#2f6071', soft: '#e8f3f6', accent: '#79aebd', text: '#143340' },
    { id: 'berry', label: 'Bær', main: '#7d3558', soft: '#f7eaf1', accent: '#c97ca1', text: '#411428' },
    { id: 'sun', label: 'Sol', main: '#9b6a14', soft: '#fbf2dd', accent: '#d7aa4e', text: '#4c3200' },
];

export const PROFILE_FONTS: ProfileFont[] = [
    { id: 'urbanist', label: 'Urbanist', family: 'Urbanist, sans-serif' },
    { id: 'georgia', label: 'Georgia', family: 'Georgia, serif' },
    { id: 'trebuchet', label: 'Trebuchet', family: '"Trebuchet MS", sans-serif' },
    { id: 'palatino', label: 'Palatino', family: '"Palatino Linotype", serif' },
    { id: 'verdana', label: 'Verdana', family: 'Verdana, sans-serif' },
];

export function getProfileTheme(themeId?: string | null) {
    return PROFILE_THEMES.find((theme) => theme.id === themeId) ?? PROFILE_THEMES[0];
}

export function getProfileFont(fontId?: string | null) {
    return PROFILE_FONTS.find((font) => font.id === fontId) ?? PROFILE_FONTS[0];
}
