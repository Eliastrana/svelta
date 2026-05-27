const UNIT_ALIASES: Record<string, string> = {
    ss: 'ss',
    spsk: 'ss',
    spiseskje: 'ss',
    spiseskjeer: 'ss',
    ts: 'ts',
    tsk: 'ts',
    teskje: 'ts',
    teskjeer: 'ts',
    l: 'l',
    dl: 'dl',
    cl: 'cl',
    ml: 'ml',
    g: 'g',
    kg: 'kg',
    hg: 'hg',
    stk: 'stk',
    stykk: 'stk',
    stykker: 'stk',
    pk: 'pk',
    pose: 'pose',
    poser: 'pose',
    boks: 'boks',
    bokser: 'boks',
    kopp: 'kopp',
    kopper: 'kopp',
    neve: 'neve',
    never: 'neve',
    bunt: 'bunt',
    klype: 'klype',
    fedd: 'fedd',
    skive: 'skive',
    skiver: 'skive',
    dash: 'dash',
};

const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
    .sort((a, b) => b.length - a.length)
    .join('|');

const NUMBER_PATTERN = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)`;
const AMOUNT_WITH_UNIT_REGEX = new RegExp(
    String.raw`^\s*(${NUMBER_PATTERN})(\s*)(${UNIT_PATTERN})\.?\s*$`,
    'iu',
);

export type ParsedIngredientAmount = {
    formatted: string;
    didAutoFormat: boolean;
    isCompleteAmount: boolean;
    detectedUnit?: string;
};

export function normalizeIngredientAmountInput(rawValue: string): ParsedIngredientAmount {
    const collapsed = rawValue.replace(/\s+/g, ' ').trim();
    if (!collapsed) {
        return {
            formatted: '',
            didAutoFormat: false,
            isCompleteAmount: false,
        };
    }

    const match = collapsed.match(AMOUNT_WITH_UNIT_REGEX);
    if (!match) {
        return {
            formatted: rawValue,
            didAutoFormat: false,
            isCompleteAmount: false,
        };
    }

    const [, amountPart, spacing, unitPart] = match;
    const normalizedUnit = UNIT_ALIASES[unitPart.toLowerCase()] ?? unitPart.toLowerCase();
    const formatted = `${amountPart.replace(/\s+/g, ' ')} ${normalizedUnit}`;

    return {
        formatted,
        didAutoFormat: spacing.length === 0 || formatted !== collapsed,
        isCompleteAmount: true,
        detectedUnit: normalizedUnit,
    };
}
