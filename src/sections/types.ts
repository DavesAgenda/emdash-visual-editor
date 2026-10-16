export interface SectionDef { blockType: { slug: string; label: string; description?: string; category?: string; versions: { version: number; fields: any[] }[] }; optionValues: Record<string, Record<string, string>> }
export interface SectionModule { slug: string; Component: any; def: SectionDef; assets: (b: any) => { css: string[]; js: string[] }; allFonts?: boolean }
