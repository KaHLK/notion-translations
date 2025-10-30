import { Notion } from "../../util/notion.ts";

export function get_i18next_path(dir: string, lng_name: string): string {
    return `${dir}${lng_name}.json`;
}

export function gen_i18next(lng: Notion.Language): string {
    const out: { [key: Notion.Key]: string } = {};
    for (const [key, item] of lng) {
        if (item.type !== Notion.LanguageValueType.Single) {
            console.error(
                "Items are not allowed to be lists or plurals when exporting to i18next format",
            );
            continue;
        }
        out[key] = item.value;
    }
    return JSON.stringify(out, undefined, 4);
}
