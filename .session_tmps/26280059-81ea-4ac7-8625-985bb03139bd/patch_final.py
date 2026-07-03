#!/usr/bin/env python3
"""
Final pass: replace remaining untranslated entries using exact string matching
on the full file content (not line-by-line).
"""

BASE = "/Users/ryanbzhou/Developer/vibe-coding/freedom/travel-log/Honi/Resources"

def patch_exact(filepath, replacements):
    """Replace exact old_value with new_value in file content."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    count = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            count += 1
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return count

# For JA - replace the English values with Japanese
# These are exact substrings to find and replace
ja_replacements = [
    # Lines 3-9: multi-line LLM prompts - these already have correct EN translations for ja
    # (They are AI prompts that should stay in the locale's language)
    # Line 3
    ('= "\\n            - No reusable existing tags are available; add a new tag only when it represents a genuinely different category.\\n            ";',
     '= "\\n            - 再利用可能な既存タグがありません。本当に別のカテゴリを表す場合のみ新しいタグを追加してください。\\n            ";'),
    # Line 4 - travel scene prompt (already translated to Japanese in line 8 system prompt)
    # These should stay as English since they're LLM prompts that work in English
    # Actually, let me check - the zh-Hans keeps them in Chinese, so ja should translate them
    
    # Line 9
    ('= "\\n        Output JSON schema:\\n        {\\n          ";',
     '= "\\n        出力 JSON schema:\\n        {\\n          ";'),
    
    # Interpolation entries - need to match with actual escaped backslashes in file
    ('"\\\\(Int(outlineWidth)) 像素" = "\\\\(Int(outlineWidth)) px";',
     '"\\\\(Int(outlineWidth)) 像素" = "\\\\(Int(outlineWidth)) px";'),  # px is fine
    
    ('"\\\\(activePlan.displayName)有效中" = "\\\\(activePlan.displayName) active";',
     '"\\\\(activePlan.displayName)有效中" = "\\\\(activePlan.displayName) 有効中";'),
    
    ('"\\\\(categoryMaterials.count) 个素材" = "\\\\(categoryMaterials.count) materials";',
     '"\\\\(categoryMaterials.count) 个素材" = "\\\\(categoryMaterials.count) 個の素材";'),
    
    ('"\\\\(count) 条" = "\\\\(count) entries";',
     '"\\\\(count) 条" = "\\\\(count) 件";'),
    
    ('"\\\\(importedMaterials.count) 个素材" = "\\\\(importedMaterials.count) materials";',
     '"\\\\(importedMaterials.count) 个素材" = "\\\\(importedMaterials.count) 個の素材";'),
    
    ('"\\\\(item.placementCount) 次" = "\\\\(item.placementCount) times";',
     '"\\\\(item.placementCount) 次" = "\\\\(item.placementCount) 回";'),
    
    ('"\\\\(journal.pages.count) 页 · 已用 \\\\(journal.usedStickerCount) 张贴纸" = "\\\\(journal.pages.count) pages · \\\\(journal.usedStickerCount) stickers used";',
     '"\\\\(journal.pages.count) 页 · 已用 \\\\(journal.usedStickerCount) 张贴纸" = "\\\\(journal.pages.count) ページ · \\\\(journal.usedStickerCount) 枚使用";'),
    
    ('"\\\\(journal.storageItemCount) 件物品" = "\\\\(journal.storageItemCount) items";',
     '"\\\\(journal.storageItemCount) 件物品" = "\\\\(journal.storageItemCount) 点";'),
    
    ('"\\\\(kind.title)素材" = "\\\\(kind.title) Materials";',
     '"\\\\(kind.title)素材" = "\\\\(kind.title)素材";'),
    
    ('"\\\\(materials.count) 个素材" = "\\\\(materials.count) materials";',
     '"\\\\(materials.count) 个素材" = "\\\\(materials.count) 個の素材";'),
    
    ('"\\\\(result.duration.displayName)已兑换，到期时间 \\\\(Self.membershipDateFormatter.string(from: result.expiresAt))" = "\\\\(result.duration.displayName) redeemed, expires \\\\(Self.membershipDateFormatter.string(from: result.expiresAt))";',
     '"\\\\(result.duration.displayName)已兑换，到期时间 \\\\(Self.membershipDateFormatter.string(from: result.expiresAt))" = "\\\\(result.duration.displayName) 引き換え済み、有効期限 \\\\(Self.membershipDateFormatter.string(from: result.expiresAt))";'),
    
    ('"\\\\(room) · 收纳柜" = "\\\\(room) · Cabinet";',
     '"\\\\(room) · 收纳柜" = "\\\\(room) · 棚";'),
    
    ('"\\\\(selectedActivationDuration.displayName)激活码已生成" = "\\\\(selectedActivationDuration.displayName) activation code generated";',
     '"\\\\(selectedActivationDuration.displayName)激活码已生成" = "\\\\(selectedActivationDuration.displayName) のコードが生成されました";'),
    
    ('"\\\\(stickerCount) 贴纸" = "\\\\(stickerCount) stickers";',
     '"\\\\(stickerCount) 贴纸" = "\\\\(stickerCount) 枚のステッカー";'),
    
    ('"\\\\(storageQuantityBinding.wrappedValue) 件" = "\\\\(storageQuantityBinding.wrappedValue) items";',
     '"\\\\(storageQuantityBinding.wrappedValue) 件" = "\\\\(storageQuantityBinding.wrappedValue) 点";'),
    
    ('"\\\\(textCount) 文字" = "\\\\(textCount) texts";',
     '"\\\\(textCount) 文字" = "\\\\(textCount) テキスト";'),
    
    ('"\\\\(title)，\\\\(count) 条记录" = "\\\\(title), \\\\(count) entries";',
     '"\\\\(title)，\\\\(count) 条记录" = "\\\\(title)、\\\\(count) 件の記録";'),
    
    ('"\\\\(totalCount) 个素材" = "\\\\(totalCount) materials";',
     '"\\\\(totalCount) 个素材" = "\\\\(totalCount) 個の素材";'),
    
    # Format strings - keep format but adjust locale
    ('"journal.page.title.format" = "%2$@ %1$d";',
     '"journal.page.title.format" = "%2$@ %1$d";'),  # Same format for ja
    
    ('"material.management.row.subtitle" = "%@ · %@";',
     '"material.management.row.subtitle" = "%@ · %@";'),  # Same
    
    ('"material.management.storage.room_cabinet" = "%@ · %@";',
     '"material.management.storage.room_cabinet" = "%@ · %@";'),  # Same
    
    # Page navigation with interpolation
    ('"上一\\\\(journal.canvasTemplate.pageUnitTitle)" = "Previous \\\\(journal.canvasTemplate.pageUnitTitle)";',
     '"上一\\\\(journal.canvasTemplate.pageUnitTitle)" = "前の\\\\(journal.canvasTemplate.pageUnitTitle)";'),
    
    ('"下一\\\\(journal.canvasTemplate.pageUnitTitle)" = "Next \\\\(journal.canvasTemplate.pageUnitTitle)";',
     '"下一\\\\(journal.canvasTemplate.pageUnitTitle)" = "次の\\\\(journal.canvasTemplate.pageUnitTitle)";'),
    
    ('"今天留下 \\\\(todayCount) 个时间点" = "\\\\(todayCount) moments saved today";',
     '"今天留下 \\\\(todayCount) 个时间点" = "今日 \\\\(todayCount) 件の瞬間を記録";'),
    
    ('"分享当前\\\\(journal.canvasTemplate.pageUnitTitle)" = "Share current \\\\(journal.canvasTemplate.pageUnitTitle)";',
     '"分享当前\\\\(journal.canvasTemplate.pageUnitTitle)" = "現在の\\\\(journal.canvasTemplate.pageUnitTitle)を共有";'),
    
    ('"删除\\\\(journal.kind.notebookDisplayName)" = "Delete \\\\(journal.kind.notebookDisplayName)";',
     '"删除\\\\(journal.kind.notebookDisplayName)" = "\\\\(journal.kind.notebookDisplayName)を削除";'),
    
    ('= "Delete \\\\(journal.kind.notebookDisplayName) \\"\\\\(journal.title)\\"?";',
     '= "\\\\(journal.kind.notebookDisplayName)「\\\\(journal.title)」を削除しますか？";'),
    
    ('"删除\\\\(kind.notebookDisplayName)？" = "Delete \\\\(kind.notebookDisplayName)?";',
     '"删除\\\\(kind.notebookDisplayName)？" = "\\\\(kind.notebookDisplayName)を削除しますか？";'),
    
    ('= "Delete room \\"\\\\(group.room)\\"?";',
     '= "部屋「\\\\(group.room)」を削除しますか？";'),
    
    ('= "Delete cabinet \\"\\\\(journal.title)\\"?";',
     '= "棚「\\\\(journal.title)」を削除しますか？";'),
    
    ('= "Delete material \\"\\\\(material.title)\\"?";',
     '= "素材「\\\\(material.title)」を削除しますか？";'),
    
    ('"到期时间 \\\\(Self.membershipDateFormatter.string(from: expirationDate))" = "Expires \\\\(Self.membershipDateFormatter.string(from: expirationDate))";',
     '"到期时间 \\\\(Self.membershipDateFormatter.string(from: expirationDate))" = "有効期限 \\\\(Self.membershipDateFormatter.string(from: expirationDate))";'),
    
    ('= "Added \\"\\\\(title)\\" to \\\\(room)";',
     '= "\\\\(room)に「\\\\(title)」を追加";'),
    
    ('"将创建新屋子：\\\\(cleanedRoom)" = "Will create new room: \\\\(cleanedRoom)";',
     '"将创建新屋子：\\\\(cleanedRoom)" = "新しい部屋を作成：\\\\(cleanedRoom)";'),
    
    ('"开始了《\\\\(title)》" = "Started \\"\\\\(title)\\"";',
     '"开始了《\\\\(title)》" = "「\\\\(title)」を始めました";'),
    
    ('= "Open details for \\\\(material.title)";',
     '= "\\\\(material.title)の詳細を開く";'),
    
    ('"找到 \\\\(count) 个主体" = "Found \\\\(count) subjects";',
     '"找到 \\\\(count) 个主体" = "\\\\(count) 個の被写体が見つかりました";'),
    
    ('"收纳柜 · \\\\(title)" = "Cabinet · \\\\(title)";',
     '"收纳柜 · \\\\(title)" = "棚 · \\\\(title)";'),
    
    ('"收进了 \\\\(count) 个新素材" = "Stored \\\\(count) new materials";',
     '"收进了 \\\\(count) 个新素材" = "\\\\(count) 個の新しい素材を保存";'),
    
    ('= "Stored \\"\\\\(material.title)\\"";',
     '= "「\\\\(material.title)」を保存";'),
    
    ('= "Created \\"\\\\(title)\\"";',
     '= "「\\\\(title)」を作成";'),
    
    ('"新开了《\\\\(title)》" = "Opened \\"\\\\(title)\\"";',
     '"新开了《\\\\(title)》" = "「\\\\(title)」を開始";'),
    
    ('= "Materials in this cabinet will return to the unassigned area of \\"\\\\(journal.storageRoomLabel)\\".";',
     '= "この棚の素材は「\\\\(journal.storageRoomLabel)」の未収納エリアに戻ります。";'),
    
    ('= "Added a cabinet \\"\\\\(title)\\"";',
     '= "棚「\\\\(title)」を追加";'),
    
    ('"生成\\\\(selectedActivationDuration.displayName)" = "Generate \\\\(selectedActivationDuration.displayName)";',
     '"生成\\\\(selectedActivationDuration.displayName)" = "\\\\(selectedActivationDuration.displayName)を生成";'),
    
    ('= "Add items with a photo or camera. After saving, they go to Whole Home To Store.";',
     '= "写真またはカメラでアイテムを追加。保存後は家全体の未収納に入ります。";'),
    
    ('"第 \\\\($0 + 1) 跨页" = "Spread \\\\($0 + 1)";',
     '"第 \\\\($0 + 1) 跨页" = "見開き \\\\($0 + 1)";'),
    
    ('= "Material \\"\\\\(title)\\" has been saved to Photos.";',
     '= "素材「\\\\(title)」を写真に保存しました。";'),
    
    ('= "Material deleted, but local file cleanup failed: \\\\(error.localizedDescription)";',
     '= "素材は削除されましたが、ローカルファイルの整理に失敗：\\\\(error.localizedDescription)";'),
    
    ('= "Added \\\\(count) materials to \\"\\\\(journalTitle)\\"";',
     '= "「\\\\(journalTitle)」に \\\\(count) 個の素材を追加";'),
    
    ('= "Added \\"\\\\(material.title)\\" to \\"\\\\(journalTitle)\\"";',
     '= "「\\\\(journalTitle)」に「\\\\(material.title)」を追加";'),
    
    ('= "Left a note in \\"\\\\(journalTitle)\\"";',
     '= "「\\\\(journalTitle)」にメモを残しました";'),
    
    # yyyy format
    ('"yyyy年M月d日 HH:mm" = "yyyy MMM d HH:mm";',
     '"yyyy年M月d日 HH:mm" = "yyyy年M月d日 HH:mm";'),
    
    # Remaining simple items
    ('"建筑物" = "Building";', '"建筑物" = "建物";'),
    ('"扳手" = "Wrench";', '"扳手" = "レンチ";'),
    ('"咖啡" = "Coffee";', '"咖啡" = "コーヒー";'),
    ('"咖啡馆" = "Cafe";', '"咖啡馆" = "カフェ";'),
]

# For KO - same approach
ko_replacements = [
    ('= "\\n            - No reusable existing tags are available; add a new tag only when it represents a genuinely different category.\\n            ";',
     '= "\\n            - 재사용 가능한 기존 태그가 없습니다. 정말 다른 분류를 나타낼 때만 새 태그를 추가하세요.\\n            ";'),
    
    ('= "\\n        Output JSON schema:\\n        {\\n          ";',
     '= "\\n        출력 JSON schema:\\n        {\\n          ";'),
    
    ('"\\\\(activePlan.displayName)有效中" = "\\\\(activePlan.displayName) active";',
     '"\\\\(activePlan.displayName)有效中" = "\\\\(activePlan.displayName) 활성 중";'),
    
    ('"\\\\(categoryMaterials.count) 个素材" = "\\\\(categoryMaterials.count) materials";',
     '"\\\\(categoryMaterials.count) 个素材" = "소재 \\\\(categoryMaterials.count)개";'),
    
    ('"\\\\(count) 条" = "\\\\(count) entries";',
     '"\\\\(count) 条" = "\\\\(count)건";'),
    
    ('"\\\\(importedMaterials.count) 个素材" = "\\\\(importedMaterials.count) materials";',
     '"\\\\(importedMaterials.count) 个素材" = "소재 \\\\(importedMaterials.count)개";'),
    
    ('"\\\\(item.placementCount) 次" = "\\\\(item.placementCount) times";',
     '"\\\\(item.placementCount) 次" = "\\\\(item.placementCount)회";'),
    
    ('"\\\\(journal.pages.count) 页 · 已用 \\\\(journal.usedStickerCount) 张贴纸" = "\\\\(journal.pages.count) pages · \\\\(journal.usedStickerCount) stickers used";',
     '"\\\\(journal.pages.count) 页 · 已用 \\\\(journal.usedStickerCount) 张贴纸" = "\\\\(journal.pages.count)페이지 · 스티커 \\\\(journal.usedStickerCount)장 사용";'),
    
    ('"\\\\(journal.storageItemCount) 件物品" = "\\\\(journal.storageItemCount) items";',
     '"\\\\(journal.storageItemCount) 件物品" = "\\\\(journal.storageItemCount)개";'),
    
    ('"\\\\(kind.title)素材" = "\\\\(kind.title) Materials";',
     '"\\\\(kind.title)素材" = "\\\\(kind.title) 소재";'),
    
    ('"\\\\(materials.count) 个素材" = "\\\\(materials.count) materials";',
     '"\\\\(materials.count) 个素材" = "소재 \\\\(materials.count)개";'),
    
    ('"\\\\(result.duration.displayName)已兑换，到期时间 \\\\(Self.membershipDateFormatter.string(from: result.expiresAt))" = "\\\\(result.duration.displayName) redeemed, expires \\\\(Self.membershipDateFormatter.string(from: result.expiresAt))";',
     '"\\\\(result.duration.displayName)已兑换，到期时间 \\\\(Self.membershipDateFormatter.string(from: result.expiresAt))" = "\\\\(result.duration.displayName) 사용됨, 만료 \\\\(Self.membershipDateFormatter.string(from: result.expiresAt))";'),
    
    ('"\\\\(room) · 收纳柜" = "\\\\(room) · Cabinet";',
     '"\\\\(room) · 收纳柜" = "\\\\(room) · 수납장";'),
    
    ('"\\\\(selectedActivationDuration.displayName)激活码已生成" = "\\\\(selectedActivationDuration.displayName) activation code generated";',
     '"\\\\(selectedActivationDuration.displayName)激活码已生成" = "\\\\(selectedActivationDuration.displayName) 코드가 생성되었습니다";'),
    
    ('"\\\\(stickerCount) 贴纸" = "\\\\(stickerCount) stickers";',
     '"\\\\(stickerCount) 贴纸" = "스티커 \\\\(stickerCount)개";'),
    
    ('"\\\\(storageQuantityBinding.wrappedValue) 件" = "\\\\(storageQuantityBinding.wrappedValue) items";',
     '"\\\\(storageQuantityBinding.wrappedValue) 件" = "\\\\(storageQuantityBinding.wrappedValue)개";'),
    
    ('"\\\\(textCount) 文字" = "\\\\(textCount) texts";',
     '"\\\\(textCount) 文字" = "텍스트 \\\\(textCount)개";'),
    
    ('"\\\\(title)，\\\\(count) 条记录" = "\\\\(title), \\\\(count) entries";',
     '"\\\\(title)，\\\\(count) 条记录" = "\\\\(title), \\\\(count)건의 기록";'),
    
    ('"\\\\(totalCount) 个素材" = "\\\\(totalCount) materials";',
     '"\\\\(totalCount) 个素材" = "소재 \\\\(totalCount)개";'),
    
    ('"上一\\\\(journal.canvasTemplate.pageUnitTitle)" = "Previous \\\\(journal.canvasTemplate.pageUnitTitle)";',
     '"上一\\\\(journal.canvasTemplate.pageUnitTitle)" = "이전 \\\\(journal.canvasTemplate.pageUnitTitle)";'),
    
    ('"下一\\\\(journal.canvasTemplate.pageUnitTitle)" = "Next \\\\(journal.canvasTemplate.pageUnitTitle)";',
     '"下一\\\\(journal.canvasTemplate.pageUnitTitle)" = "다음 \\\\(journal.canvasTemplate.pageUnitTitle)";'),
    
    ('"今天留下 \\\\(todayCount) 个时间点" = "\\\\(todayCount) moments saved today";',
     '"今天留下 \\\\(todayCount) 个时间点" = "오늘 \\\\(todayCount)개의 순간을 기록했어요";'),
    
    ('"分享当前\\\\(journal.canvasTemplate.pageUnitTitle)" = "Share current \\\\(journal.canvasTemplate.pageUnitTitle)";',
     '"分享当前\\\\(journal.canvasTemplate.pageUnitTitle)" = "현재 \\\\(journal.canvasTemplate.pageUnitTitle) 공유";'),
    
    ('"删除\\\\(journal.kind.notebookDisplayName)" = "Delete \\\\(journal.kind.notebookDisplayName)";',
     '"删除\\\\(journal.kind.notebookDisplayName)" = "\\\\(journal.kind.notebookDisplayName) 삭제";'),
    
    ('= "Delete \\\\(journal.kind.notebookDisplayName) \\"\\\\(journal.title)\\"?";',
     '= "\\\\(journal.kind.notebookDisplayName) \\"\\\\(journal.title)\\"을(를) 삭제할까요?";'),
    
    ('"删除\\\\(kind.notebookDisplayName)？" = "Delete \\\\(kind.notebookDisplayName)?";',
     '"删除\\\\(kind.notebookDisplayName)？" = "\\\\(kind.notebookDisplayName)을(를) 삭제할까요?";'),
    
    ('= "Delete room \\"\\\\(group.room)\\"?";',
     '= "방 \\"\\\\(group.room)\\"을(를) 삭제할까요?";'),
    
    ('= "Delete cabinet \\"\\\\(journal.title)\\"?";',
     '= "수납장 \\"\\\\(journal.title)\\"을(를) 삭제할까요?";'),
    
    ('= "Delete material \\"\\\\(material.title)\\"?";',
     '= "소재 \\"\\\\(material.title)\\"을(를) 삭제할까요?";'),
    
    ('"到期时间 \\\\(Self.membershipDateFormatter.string(from: expirationDate))" = "Expires \\\\(Self.membershipDateFormatter.string(from: expirationDate))";',
     '"到期时间 \\\\(Self.membershipDateFormatter.string(from: expirationDate))" = "만료 \\\\(Self.membershipDateFormatter.string(from: expirationDate))";'),
    
    ('= "Added \\"\\\\(title)\\" to \\\\(room)";',
     '= "\\\\(room)에 \\"\\\\(title)\\" 추가";'),
    
    ('"将创建新屋子：\\\\(cleanedRoom)" = "Will create new room: \\\\(cleanedRoom)";',
     '"将创建新屋子：\\\\(cleanedRoom)" = "새 방을 만듭니다: \\\\(cleanedRoom)";'),
    
    ('"开始了《\\\\(title)》" = "Started \\"\\\\(title)\\"";',
     '"开始了《\\\\(title)》" = "\\"\\\\(title)\\"을(를) 시작했어요";'),
    
    ('= "Open details for \\\\(material.title)";',
     '= "\\\\(material.title) 상세 열기";'),
    
    ('"找到 \\\\(count) 个主体" = "Found \\\\(count) subjects";',
     '"找到 \\\\(count) 个主体" = "피사체 \\\\(count)개를 찾았어요";'),
    
    ('"收纳柜 · \\\\(title)" = "Cabinet · \\\\(title)";',
     '"收纳柜 · \\\\(title)" = "수납장 · \\\\(title)";'),
    
    ('"收进了 \\\\(count) 个新素材" = "Stored \\\\(count) new materials";',
     '"收进了 \\\\(count) 个新素材" = "새 소재 \\\\(count)개 저장";'),
    
    ('= "Stored \\"\\\\(material.title)\\"";',
     '= "\\"\\\\(material.title)\\" 저장";'),
    
    ('= "Created \\"\\\\(title)\\"";',
     '= "\\"\\\\(title)\\" 만들기 완료";'),
    
    ('"新开了《\\\\(title)》" = "Opened \\"\\\\(title)\\"";',
     '"新开了《\\\\(title)》" = "\\"\\\\(title)\\" 시작";'),
    
    ('= "Materials in this cabinet will return to the unassigned area of \\"\\\\(journal.storageRoomLabel)\\".";',
     '= "이 수납장의 소재는 \\"\\\\(journal.storageRoomLabel)\\"의 미지정 구역으로 돌아갑니다.";'),
    
    ('= "Added a cabinet \\"\\\\(title)\\"";',
     '= "수납장 \\"\\\\(title)\\" 추가";'),
    
    ('"生成\\\\(selectedActivationDuration.displayName)" = "Generate \\\\(selectedActivationDuration.displayName)";',
     '"生成\\\\(selectedActivationDuration.displayName)" = "\\\\(selectedActivationDuration.displayName) 생성";'),
    
    ('= "Add items with a photo or camera. After saving, they go to Whole Home To Store.";',
     '= "사진이나 카메라로 물건을 추가하세요. 저장 후 집 전체 수납 대기로 이동합니다.";'),
    
    ('"第 \\\\($0 + 1) 跨页" = "Spread \\\\($0 + 1)";',
     '"第 \\\\($0 + 1) 跨页" = "펼침면 \\\\($0 + 1)";'),
    
    ('= "Material \\"\\\\(title)\\" has been saved to Photos.";',
     '= "소재 \\"\\\\(title)\\"을(를) 사진에 저장했습니다.";'),
    
    ('= "Material deleted, but local file cleanup failed: \\\\(error.localizedDescription)";',
     '= "소재가 삭제되었지만 로컬 파일 정리 실패: \\\\(error.localizedDescription)";'),
    
    ('= "Added \\\\(count) materials to \\"\\\\(journalTitle)\\"";',
     '= "\\"\\\\(journalTitle)\\"에 소재 \\\\(count)개 추가";'),
    
    ('= "Added \\"\\\\(material.title)\\" to \\"\\\\(journalTitle)\\"";',
     '= "\\"\\\\(journalTitle)\\"에 \\"\\\\(material.title)\\" 추가";'),
    
    ('= "Left a note in \\"\\\\(journalTitle)\\"";',
     '= "\\"\\\\(journalTitle)\\"에 글을 남겼어요";'),
    
    ('"yyyy年M月d日 HH:mm" = "yyyy MMM d HH:mm";',
     '"yyyy年M月d日 HH:mm" = "yyyy년 M월 d일 HH:mm";'),
    
    ('"建筑物" = "Building";', '"建筑物" = "건물";'),
    ('"扳手" = "Wrench";', '"扳手" = "렌치";'),
    ('"咖啡" = "Coffee";', '"咖啡" = "커피";'),
    ('"咖啡馆" = "Cafe";', '"咖啡馆" = "카페";'),
]

ja_path = f"{BASE}/ja.lproj/Localizable.strings"
ko_path = f"{BASE}/ko.lproj/Localizable.strings"

ja_count = patch_exact(ja_path, ja_replacements)
print(f"JA final patched: {ja_count}")

ko_count = patch_exact(ko_path, ko_replacements)
print(f"KO final patched: {ko_count}")
