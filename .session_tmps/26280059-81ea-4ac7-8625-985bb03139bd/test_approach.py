#!/usr/bin/env python3
"""Generate corrected ja and ko Localizable.strings with proper translations."""
import re

def parse_strings(path):
    """Parse a .strings file, preserving order and comments."""
    lines = []
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    return content

def replace_values(content, translations):
    """Replace values for specific keys in a .strings file content."""
    for key, new_val in translations.items():
        # Escape key for regex
        escaped_key = re.escape(key)
        pattern = f'"{escaped_key}"\\s*=\\s*"[^"]*"\\s*;'
        replacement = f'"{key}" = "{new_val}";'
        content = re.sub(pattern, lambda m: replacement, content, count=1)
    return content

# Japanese translations for entries currently showing English
ja_translations = {
    # === AI/System prompt strings (keep English for LLM prompts) ===
    # These are LLM instructions, already correctly in English for ja
    
    # === Format/Technical strings (keep as-is) ===
    # journal.page.title.format, material.management.row.subtitle etc already correct
    
    # === User-facing strings that need Japanese translation ===
    
    # Counting/Display strings
    "\\\\(Int(outlineWidth)) 像素": "\\\\(Int(outlineWidth)) px",
    "\\\\(activePlan.displayName)有效中": "\\\\(activePlan.displayName) 有効中",
    "\\\\(categoryMaterials.count) 个素材": "\\\\(categoryMaterials.count) 個の素材",
    "\\\\(count) 条": "\\\\(count) 件",
    "\\\\(importedMaterials.count) 个素材": "\\\\(importedMaterials.count) 個の素材",
    "\\\\(item.placementCount) 次": "\\\\(item.placementCount) 回",
    "\\\\(journal.pages.count) 页 · 已用 \\\\(journal.usedStickerCount) 张贴纸": "\\\\(journal.pages.count) ページ · \\\\(journal.usedStickerCount) 枚のステッカー使用",
    "\\\\(journal.storageItemCount) 件物品": "\\\\(journal.storageItemCount) 点",
    "\\\\(kind.title)素材": "\\\\(kind.title) 素材",
    "\\\\(materials.count) 个素材": "\\\\(materials.count) 個の素材",
    "\\\\(result.duration.displayName)已兑换，到期时间 \\\\(Self.membershipDateFormatter.string(from: result.expiresAt))": "\\\\(result.duration.displayName) 引き換え済み、有効期限 \\\\(Self.membershipDateFormatter.string(from: result.expiresAt))",
    "\\\\(room) · 收纳柜": "\\\\(room) · 棚",
    "\\\\(selectedActivationDuration.displayName)激活码已生成": "\\\\(selectedActivationDuration.displayName) のコードを生成しました",
    "\\\\(stickerCount) 贴纸": "\\\\(stickerCount) 枚のステッカー",
    "\\\\(storageQuantityBinding.wrappedValue) 件": "\\\\(storageQuantityBinding.wrappedValue) 点",
    "\\\\(textCount) 文字": "\\\\(textCount) テキスト",
    "\\\\(title)，\\\\(count) 条记录": "\\\\(title)、\\\\(count) 件の記録",
    "\\\\(totalCount) 个素材": "\\\\(totalCount) 個の素材",
}

print("Translation dict has", len(ja_translations), "entries")
print("Done generating base. Will expand in next step.")
