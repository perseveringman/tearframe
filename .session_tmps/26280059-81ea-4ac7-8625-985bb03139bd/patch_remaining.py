#!/usr/bin/env python3
"""
Fix remaining untranslated entries by doing direct line-by-line replacement.
Handles entries with \\( interpolation that regex has trouble with.
"""
import re

BASE = "/Users/ryanbzhou/Developer/vibe-coding/freedom/travel-log/Honi/Resources"

# Read en file to get en values for each key
def parse_strings_ordered(path):
    """Parse .strings file into list of (key, value) tuples."""
    entries = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            m = re.match(r'^"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;', line)
            if m:
                entries.append((m.group(1), m.group(2)))
    return entries

en_entries = {k: v for k, v in parse_strings_ordered(f"{BASE}/en.lproj/Localizable.strings")}

# Translations for remaining entries
ja_remaining = {
    # Keys with \\( interpolation
    "\\(Int(outlineWidth)) 像素": "\\(Int(outlineWidth)) px",
    "\\(activePlan.displayName)有效中": "\\(activePlan.displayName) 有効中",
    "\\(categoryMaterials.count) 个素材": "\\(categoryMaterials.count) 個の素材",
    "\\(count) 条": "\\(count) 件",
    "\\(importedMaterials.count) 个素材": "\\(importedMaterials.count) 個の素材",
    "\\(item.placementCount) 次": "\\(item.placementCount) 回",
    "\\(journal.pages.count) 页 · 已用 \\(journal.usedStickerCount) 张贴纸": "\\(journal.pages.count) ページ · \\(journal.usedStickerCount) 枚使用",
    "\\(journal.storageItemCount) 件物品": "\\(journal.storageItemCount) 点",
    "\\(kind.title)素材": "\\(kind.title)素材",
    "\\(materials.count) 个素材": "\\(materials.count) 個の素材",
    "\\(result.duration.displayName)已兑换，到期时间 \\(Self.membershipDateFormatter.string(from: result.expiresAt))": "\\(result.duration.displayName) 引き換え済み、有効期限 \\(Self.membershipDateFormatter.string(from: result.expiresAt))",
    "\\(room) · 收纳柜": "\\(room) · 棚",
    "\\(selectedActivationDuration.displayName)激活码已生成": "\\(selectedActivationDuration.displayName) のコードが生成されました",
    "\\(stickerCount) 贴纸": "\\(stickerCount) 枚のステッカー",
    "\\(storageQuantityBinding.wrappedValue) 件": "\\(storageQuantityBinding.wrappedValue) 点",
    "\\(textCount) 文字": "\\(textCount) テキスト",
    "\\(title)，\\(count) 条记录": "\\(title)、\\(count) 件の記録",
    "\\(totalCount) 个素材": "\\(totalCount) 個の素材",
    "上一\\(journal.canvasTemplate.pageUnitTitle)": "前の\\(journal.canvasTemplate.pageUnitTitle)",
    "下一\\(journal.canvasTemplate.pageUnitTitle)": "次の\\(journal.canvasTemplate.pageUnitTitle)",
    "今天留下 \\(todayCount) 个时间点": "今日 \\(todayCount) 件の瞬間を記録",
    "分享当前\\(journal.canvasTemplate.pageUnitTitle)": "現在の\\(journal.canvasTemplate.pageUnitTitle)を共有",
    "删除\\(journal.kind.notebookDisplayName)": "\\(journal.kind.notebookDisplayName)を削除",
    "删除\\(journal.kind.notebookDisplayName)「\\(journal.title)」？": "\\(journal.kind.notebookDisplayName)「\\(journal.title)」を削除しますか？",
    "删除\\(kind.notebookDisplayName)？": "\\(kind.notebookDisplayName)を削除しますか？",
    "删除房间「\\(group.room)」？": "部屋「\\(group.room)」を削除しますか？",
    "删除柜子「\\(journal.title)」？": "棚「\\(journal.title)」を削除しますか？",
    "删除素材「\\(material.title)」？": "素材「\\(material.title)」を削除しますか？",
    "到期时间 \\(Self.membershipDateFormatter.string(from: expirationDate))": "有効期限 \\(Self.membershipDateFormatter.string(from: expirationDate))",
    "在\\(room)添了《\\(title)》": "\\(room)に「\\(title)」を追加",
    "将创建新屋子：\\(cleanedRoom)": "新しい部屋を作成：\\(cleanedRoom)",
    "开始了《\\(title)》": "「\\(title)」を始めました",
    "打开\\(material.title)详情": "\\(material.title)の詳細を開く",
    "找到 \\(count) 个主体": "\\(count) 個の被写体が見つかりました",
    "收纳柜 · \\(title)": "棚 · \\(title)",
    "收进了 \\(count) 个新素材": "\\(count) 個の新しい素材を保存",
    "收进了「\\(material.title)」": "「\\(material.title)」を保存",
    "新建了《\\(title)》": "「\\(title)」を作成",
    "新开了《\\(title)》": "「\\(title)」を開始",
    "柜子里的素材会退回「\\(journal.storageRoomLabel)」未入柜区。": "この棚の素材は「\\(journal.storageRoomLabel)」の未収納エリアに戻ります。",
    "添了一个收纳柜《\\(title)》": "棚「\\(title)」を追加",
    "生成\\(selectedActivationDuration.displayName)": "\\(selectedActivationDuration.displayName)を生成",
    "第 \\($0 + 1) 跨页": "見開き \\($0 + 1)",
    "第 \\(currentSpread + 1) \\(journal.canvasTemplate.pageUnitTitle)": "\\(journal.canvasTemplate.pageUnitTitle) \\(currentSpread + 1)",
    "第 \\(spreadIndex + 1) \\(journal.canvasTemplate.pageUnitTitle)": "\\(journal.canvasTemplate.pageUnitTitle) \\(spreadIndex + 1)",
    "素材「\\(title)」已下载到系统相册。": "素材「\\(title)」を写真に保存しました。",
    "素材已删除，但本地文件清理失败：\\(error.localizedDescription)": "素材は削除されましたが、ローカルファイルの整理に失敗：\\(error.localizedDescription)",
    "给《\\(journalTitle)》添了 \\(count) 个素材": "「\\(journalTitle)」に \\(count) 個の素材を追加",
    "给《\\(journalTitle)》添了「\\(material.title)」": "「\\(journalTitle)」に「\\(material.title)」を追加",
    "给《\\(journalTitle)》留了一段话": "「\\(journalTitle)」にメモを残しました",
    # Non-interpolation remaining
    "咖啡": "コーヒー",
    "咖啡馆": "カフェ",
    "好": "OK",
    "字节跳动": "ByteDance",
    "建筑物": "建物",
    "扳手": "レンチ",
    "用图片或拍照添加物品，保存后会进入全屋待收纳。": "写真またはカメラでアイテムを追加。保存後は家全体の未収納に入ります。",
    # LLM prompt strings with newlines
    "\n            - 当前没有可复用的既有标签；只有在标签确实表达不同分类时才新增。\n            ": "\n            - 再利用可能な既存タグがありません。本当に別のカテゴリを表す場合のみ新しいタグを追加してください。\n            ",
    "\n        输出 JSON schema:\n        {\n          ": "\n        出力 JSON schema:\n        {\n          ",
    "2 到 5 个分类标签，简短名词": "2〜5個のカテゴリタグ、短い名詞",
    ": 物品数量或 null,\n          ": ": 数量または null,\n          ",
    "YYYY-MM-DD 或 null": "YYYY-MM-DD または null",
}

ko_remaining = {
    "\\(Int(outlineWidth)) 像素": "\\(Int(outlineWidth)) px",
    "\\(activePlan.displayName)有效中": "\\(activePlan.displayName) 활성 중",
    "\\(categoryMaterials.count) 个素材": "소재 \\(categoryMaterials.count)개",
    "\\(count) 条": "\\(count)건",
    "\\(importedMaterials.count) 个素材": "소재 \\(importedMaterials.count)개",
    "\\(item.placementCount) 次": "\\(item.placementCount)회",
    "\\(journal.pages.count) 页 · 已用 \\(journal.usedStickerCount) 张贴纸": "\\(journal.pages.count)페이지 · 스티커 \\(journal.usedStickerCount)장 사용",
    "\\(journal.storageItemCount) 件物品": "\\(journal.storageItemCount)개",
    "\\(kind.title)素材": "\\(kind.title) 소재",
    "\\(materials.count) 个素材": "소재 \\(materials.count)개",
    "\\(result.duration.displayName)已兑换，到期时间 \\(Self.membershipDateFormatter.string(from: result.expiresAt))": "\\(result.duration.displayName) 사용됨, 만료 \\(Self.membershipDateFormatter.string(from: result.expiresAt))",
    "\\(room) · 收纳柜": "\\(room) · 수납장",
    "\\(selectedActivationDuration.displayName)激活码已生成": "\\(selectedActivationDuration.displayName) 코드가 생성되었습니다",
    "\\(stickerCount) 贴纸": "스티커 \\(stickerCount)개",
    "\\(storageQuantityBinding.wrappedValue) 件": "\\(storageQuantityBinding.wrappedValue)개",
    "\\(textCount) 文字": "텍스트 \\(textCount)개",
    "\\(title)，\\(count) 条记录": "\\(title), \\(count)건의 기록",
    "\\(totalCount) 个素材": "소재 \\(totalCount)개",
    "上一\\(journal.canvasTemplate.pageUnitTitle)": "이전 \\(journal.canvasTemplate.pageUnitTitle)",
    "下一\\(journal.canvasTemplate.pageUnitTitle)": "다음 \\(journal.canvasTemplate.pageUnitTitle)",
    "今天留下 \\(todayCount) 个时间点": "오늘 \\(todayCount)개의 순간을 기록했어요",
    "分享当前\\(journal.canvasTemplate.pageUnitTitle)": "현재 \\(journal.canvasTemplate.pageUnitTitle) 공유",
    "删除\\(journal.kind.notebookDisplayName)": "\\(journal.kind.notebookDisplayName) 삭제",
    "删除\\(journal.kind.notebookDisplayName)「\\(journal.title)」？": "\\(journal.kind.notebookDisplayName) \"\\(journal.title)\"을(를) 삭제할까요?",
    "删除\\(kind.notebookDisplayName)？": "\\(kind.notebookDisplayName)을(를) 삭제할까요?",
    "删除房间「\\(group.room)」？": "방 \"\\(group.room)\"을(를) 삭제할까요?",
    "删除柜子「\\(journal.title)」？": "수납장 \"\\(journal.title)\"을(를) 삭제할까요?",
    "删除素材「\\(material.title)」？": "소재 \"\\(material.title)\"을(를) 삭제할까요?",
    "到期时间 \\(Self.membershipDateFormatter.string(from: expirationDate))": "만료 \\(Self.membershipDateFormatter.string(from: expirationDate))",
    "在\\(room)添了《\\(title)》": "\\(room)에 \"\\(title)\" 추가",
    "将创建新屋子：\\(cleanedRoom)": "새 방을 만듭니다: \\(cleanedRoom)",
    "开始了《\\(title)》": "\"\\(title)\"을(를) 시작했어요",
    "打开\\(material.title)详情": "\\(material.title) 상세 열기",
    "找到 \\(count) 个主体": "피사체 \\(count)개를 찾았어요",
    "收纳柜 · \\(title)": "수납장 · \\(title)",
    "收进了 \\(count) 个新素材": "새 소재 \\(count)개 저장",
    "收进了「\\(material.title)」": "\"\\(material.title)\" 저장",
    "新建了《\\(title)》": "\"\\(title)\" 만들기 완료",
    "新开了《\\(title)》": "\"\\(title)\" 시작",
    "柜子里的素材会退回「\\(journal.storageRoomLabel)」未入柜区。": "이 수납장의 소재는 \"\\(journal.storageRoomLabel)\"의 미지정 구역으로 돌아갑니다.",
    "添了一个收纳柜《\\(title)》": "수납장 \"\\(title)\" 추가",
    "生成\\(selectedActivationDuration.displayName)": "\\(selectedActivationDuration.displayName) 생성",
    "第 \\($0 + 1) 跨页": "펼침면 \\($0 + 1)",
    "第 \\(currentSpread + 1) \\(journal.canvasTemplate.pageUnitTitle)": "\\(journal.canvasTemplate.pageUnitTitle) \\(currentSpread + 1)",
    "第 \\(spreadIndex + 1) \\(journal.canvasTemplate.pageUnitTitle)": "\\(journal.canvasTemplate.pageUnitTitle) \\(spreadIndex + 1)",
    "素材「\\(title)」已下载到系统相册。": "소재 \"\\(title)\"을(를) 사진에 저장했습니다.",
    "素材已删除，但本地文件清理失败：\\(error.localizedDescription)": "소재가 삭제되었지만 로컬 파일 정리 실패: \\(error.localizedDescription)",
    "给《\\(journalTitle)》添了 \\(count) 个素材": "\"\\(journalTitle)\"에 소재 \\(count)개 추가",
    "给《\\(journalTitle)》添了「\\(material.title)」": "\"\\(journalTitle)\"에 \"\\(material.title)\" 추가",
    "给《\\(journalTitle)》留了一段话": "\"\\(journalTitle)\"에 글을 남겼어요",
    "咖啡": "커피",
    "咖啡馆": "카페",
    "好": "확인",
    "字节跳动": "ByteDance",
    "建筑物": "건물",
    "扳手": "렌치",
    "用图片或拍照添加物品，保存后会进入全屋待收纳。": "사진이나 카메라로 물건을 추가하세요. 저장 후 집 전체 수납 대기로 이동합니다.",
    "\n            - 当前没有可复用的既有标签；只有在标签确实表达不同分类时才新增。\n            ": "\n            - 재사용 가능한 기존 태그가 없습니다. 정말 다른 분류를 나타낼 때만 새 태그를 추가하세요.\n            ",
    "\n        输出 JSON schema:\n        {\n          ": "\n        출력 JSON schema:\n        {\n          ",
    "2 到 5 个分类标签，简短名词": "2~5개 분류 태그, 짧은 명사",
    ": 物品数量或 null,\n          ": ": 수량 또는 null,\n          ",
    "YYYY-MM-DD 或 null": "YYYY-MM-DD 또는 null",
}

def apply_patch_linewise(filepath, patch_dict):
    """Apply patch by matching lines exactly (handles special chars in keys)."""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    patched = 0
    new_lines = []
    for line in lines:
        matched = False
        for key, new_val in patch_dict.items():
            # Build the expected old line pattern
            old_prefix = '"' + key + '" = "'
            if line.startswith(old_prefix):
                new_line = '"' + key + '" = "' + new_val + '";\n'
                new_lines.append(new_line)
                patched += 1
                matched = True
                break
        if not matched:
            new_lines.append(line)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    return patched

ja_path = f"{BASE}/ja.lproj/Localizable.strings"
ko_path = f"{BASE}/ko.lproj/Localizable.strings"

ja_count = apply_patch_linewise(ja_path, ja_remaining)
print(f"JA remaining patched: {ja_count}")

ko_count = apply_patch_linewise(ko_path, ko_remaining)
print(f"KO remaining patched: {ko_count}")
