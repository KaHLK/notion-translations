import { Notion } from "../../util/notion.ts";

export function transform_android_dir(
    lng_name: string,
): (dir: string) => string {
    return (dir) => `${dir}-${lng_name}`;
}

export function get_android_path(dir: string, _lng_name: string): string {
    return `${dir}strings.xml`;
}

export function gen_android(lng: Notion.Language): string {
    const out: string[] = [
        `<?xml version="1.0" encoding="utf-8"?>`,
        `<resources xmlns:tools="http://schemas.android.com/tools"`,
    ];
    for (const [key, item] of lng) {
        switch (item.type) {
            case Notion.LanguageValueType.Single: {
                out.push(`    <string name="${key}">${item.value}</string>`);
                continue;
            }
            case Notion.LanguageValueType.List: {
                out.push(`    <string-array name="${key}">`);
                for (const value of item.values) {
                    out.push(`        <item>${value.value}</item>`);
                }
                out.push("    </string-array>");
                continue;
            }
            case Notion.LanguageValueType.Plural: {
                out.push(`    <plurals name="${key}">`);
                for (const value of item.values) {
                    out.push(
                        `        <item quantity="${value.plural}">${value.value}</item>`,
                    );
                }
                out.push("    </plurals>");
                continue;
            }
        }
    }
    out.push("</resources>");
    return out.join("\n");
}
