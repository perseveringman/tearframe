#!/usr/bin/env python3
"""Final fix for the remaining 18 entries per locale using exact content matching."""

BASE = "/Users/ryanbzhou/Developer/vibe-coding/freedom/travel-log/Honi/Resources"

def fix_lines(filepath, line_replacements):
    """Replace specific lines by line number (1-indexed)."""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    count = 0
    for line_num, new_line in line_replacements.items():
        if 0 < line_num <= len(lines):
            if lines[line_num - 1].strip() != new_line.strip():
                lines[line_num - 1] = new_line + '\n'
                count += 1
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    return count

# ===== JA FIXES =====
ja_path = f"{BASE}/ja.lproj/Localizable.strings"

# Read current ja file to get exact line numbers
with open(ja_path, 'r') as f:
    ja_lines = f.readlines()

# Build a map of replacements by finding exact line content
ja_fixes = {}

for i, line in enumerate(ja_lines):
    stripped = line.strip()
    line_num = i + 1
    
    # Line 4: travel scene LLM prompt
    if stripped.startswith('"\\n            场景：旅行手账素材') and 'Scene: travel journal material' in stripped:
        key_part = stripped.split('" = "')[0] + '"'
        ja_fixes[line_num] = key_part + ' = "\\n            シーン：旅の手帳素材。\\n            現在の仮名：\\(request.currentTitle)\\n\\n            画像の中の場所、チケット、お土産、食事、交通機関、建物、その他の旅行素材を認識し、カテゴリタグを付けてください。\\n            タグは旅行手帳カテゴリを優先してください（例：観光地、交通、グルメ、チケット、お土産、地図、建築、自然、人物）。\\n            quantity と expirationDate は常に null を出力してください。\\n            \\(tagReuseInstructions)\\n\\n            \\(schema)\\n            ";'
    
    # Line 5: storage scene LLM prompt
    elif stripped.startswith('"\\n            场景：物品收纳') and 'Scene: home storage' in stripped:
        key_part = stripped.split('" = "')[0] + '"'
        ja_fixes[line_num] = key_part + ' = "\\n            シーン：物品収納。\\n            現在の仮名：\\(request.currentTitle)\\n\\n            画像の中の収納物品の名前とカテゴリタグを認識してください。\\n            追加要件：\\n            - 画像から同種の物品の数量がわかる場合は quantity を記入してください。不明な場合は null にしてください。\\n            - パッケージに賞味期限が明確に読める場合は expirationDate を YYYY-MM-DD 形式で記入してください。製造日のみ、保存期間のみ、または読めない場合は null にしてください。\\n            - タグは家庭収納カテゴリを優先してください（例：食品、薬、清掃用品、キッチン用品、文具、デジタル周辺機器、衣類、工具、書類）。\\n            \\(tagReuseInstructions)\\n\\n            \\(schema)\\n            ";'
    
    # Line 6: recipe scene LLM prompt
    elif stripped.startswith('"\\n            场景：菜谱素材') and 'Scene: recipe material' in stripped:
        key_part = stripped.split('" = "')[0] + '"'
        ja_fixes[line_num] = key_part + ' = "\\n            シーン：レシピ素材。\\n            現在の仮名：\\(request.currentTitle)\\n\\n            画像の中の食材、料理、調味料、またはキッチン用品を認識し、カテゴリタグを付けてください。\\n            タグはレシピカテゴリを優先してください（例：食材、主食、野菜、肉類、海鮮、調味料、調理器具、出来上がり料理、飲み物）。\\n            quantity と expirationDate は常に null を出力してください。\\n            \\(tagReuseInstructions)\\n\\n            \\(schema)\\n            ";'
    
    # Line 7: tag reuse instructions
    elif stripped.startswith('"\\n        - 先从既有标签中选择') and 'Choose from existing tags first' in stripped:
        key_part = stripped.split('" = "')[0] + '"'
        ja_fixes[line_num] = key_part + ' = "\\n        - まず既存のタグから選択してください。既存タグと出力したいタグが同義語、類義語、または上位下位で分類できる場合は、既存タグの名前をそのまま出力し、類似語を新たに追加しないでください。\\n        - すべての既存タグが画像のカテゴリに合わない場合のみ、短い名詞タグを新規追加してください。\\n        - 既存タグ：\\(cleanNames.joined(separator: ";'
    
    # Line 18: quantity prompt
    elif 'item quantity or null' in stripped and stripped.startswith('": 物品数量或 null'):
        ja_fixes[line_num] = '": 物品数量或 null,\\n          " = ": 数量または null,\\n          ";'
    
    # Line 24: px (already correct - px is universal)
    # Lines 558-559: spread entries (already correct for ja - same format order)
    # journal.page.title.format, material.management format strings - intentionally same
    # 好/OK, ByteDance, 豆包/Doubao, HD, Lite - intentionally same across locales

count = fix_lines(ja_path, ja_fixes)
print(f"JA line fixes: {count}")

# ===== KO FIXES =====
ko_path = f"{BASE}/ko.lproj/Localizable.strings"

with open(ko_path, 'r') as f:
    ko_lines = f.readlines()

ko_fixes = {}

for i, line in enumerate(ko_lines):
    stripped = line.strip()
    line_num = i + 1
    
    if stripped.startswith('"\\n            场景：旅行手账素材') and 'Scene: travel journal material' in stripped:
        key_part = stripped.split('" = "')[0] + '"'
        ko_fixes[line_num] = key_part + ' = "\\n            시나리오: 여행 저널 소재.\\n            현재 임시 이름: \\(request.currentTitle)\\n\\n            이미지에서 장소, 티켓, 기념품, 음식, 교통수단, 건물 또는 기타 여행 소재 이름을 인식하고 분류 태그를 달아주세요.\\n            태그는 여행 저널 분류를 우선 사용하세요(예: 명소, 교통, 맛집, 티켓, 기념품, 지도, 건축, 자연, 인물).\\n            quantity와 expirationDate는 항상 null을 출력하세요.\\n            \\(tagReuseInstructions)\\n\\n            \\(schema)\\n            ";'
    
    elif stripped.startswith('"\\n            场景：物品收纳') and 'Scene: home storage' in stripped:
        key_part = stripped.split('" = "')[0] + '"'
        ko_fixes[line_num] = key_part + ' = "\\n            시나리오: 물품 수납.\\n            현재 임시 이름: \\(request.currentTitle)\\n\\n            이미지에서 수납 물품의 이름과 분류 태그를 인식해주세요.\\n            추가 요구사항:\\n            - 이미지에서 동종 물품의 수량을 알 수 있으면 quantity를 입력하세요. 확인할 수 없으면 null을 입력하세요.\\n            - 포장에서 유통기한을 명확히 읽을 수 있으면 expirationDate를 YYYY-MM-DD 형식으로 입력하세요. 제조일만 있거나 읽을 수 없으면 null을 입력하세요.\\n            - 태그는 가정 수납 분류를 우선 사용하세요(예: 식품, 의약품, 세정용품, 주방용품, 문구, 디지털 액세서리, 의류, 도구, 서류).\\n            \\(tagReuseInstructions)\\n\\n            \\(schema)\\n            ";'
    
    elif stripped.startswith('"\\n            场景：菜谱素材') and 'Scene: recipe material' in stripped:
        key_part = stripped.split('" = "')[0] + '"'
        ko_fixes[line_num] = key_part + ' = "\\n            시나리오: 레시피 소재.\\n            현재 임시 이름: \\(request.currentTitle)\\n\\n            이미지에서 식재료, 요리, 양념 또는 주방용품 이름을 인식하고 분류 태그를 달아주세요.\\n            태그는 레시피 분류를 우선 사용하세요(예: 식재료, 주식, 채소, 육류, 해산물, 양념, 조리기구, 완성 요리, 음료).\\n            quantity와 expirationDate는 항상 null을 출력하세요.\\n            \\(tagReuseInstructions)\\n\\n            \\(schema)\\n            ";'
    
    elif stripped.startswith('"\\n        - 先从既有标签中选择') and 'Choose from existing tags first' in stripped:
        key_part = stripped.split('" = "')[0] + '"'
        ko_fixes[line_num] = key_part + ' = "\\n        - 먼저 기존 태그에서 선택하세요. 기존 태그와 출력하려는 태그가 동의어, 유사어 또는 상하위 관계로 분류할 수 있으면 기존 태그 이름을 그대로 출력하고, 유사한 새 태그를 추가하지 마세요.\\n        - 모든 기존 태그가 이미지 분류에 맞지 않을 때만 짧은 명사 태그를 추가하세요.\\n        - 기존 태그: \\(cleanNames.joined(separator: ";'
    
    elif 'item quantity or null' in stripped and stripped.startswith('": 物品数量或 null'):
        ko_fixes[line_num] = '": 物品数量或 null,\\n          " = ": 수량 또는 null,\\n          ";'

count = fix_lines(ko_path, ko_fixes)
print(f"KO line fixes: {count}")
