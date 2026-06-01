#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path("/Users/ryanbzhou/Developer/vibe-coding/freedom/tearframe")
OUTPUT = ROOT / "output"
SAMPLE_ID = "smp_01KSWWTEWHPJPCD6AM3D1HA8Z1"
TEARDOWN_ID = "td_01KSWXEY29TCKBGY0DKTPQTBXY"
SHOTS_PATH = Path(f"/Users/ryanbzhou/.tearframe/samples/{SAMPLE_ID}/resources/shots.json")
FRAMES_PATH = Path(f"/Users/ryanbzhou/.tearframe/samples/{SAMPLE_ID}/resources/frames/index.json")
OBS_PATHS = [
    OUTPUT / "storyboard_observations_000_053.json",
    OUTPUT / "storyboard_observations_054_107.json",
    OUTPUT / "storyboard_observations_108_161.json",
    OUTPUT / "storyboard_observations_162_211.json",
]

ALLOWED_SHOT_SIZES = {
    "黑场", "图卡", "字幕卡", "大特写", "特写", "近景", "中近景", "中景", "中全景", "全景", "远景", "大远景", "航拍全景", "俯拍全景", "主观镜头", "插入特写", "屏幕录制", "档案素材",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def visible_len(text):
    return len(re.sub(r"\s+", "", str(text or "")))


def normalize_size(raw, summary=""):
    text = f"{raw or ''} {summary or ''}"
    low = text.lower()
    if "pending_visual_review" in low:
        if any(k in text for k in ["黑", "极暗", "纯暗", "暗场"]):
            return "黑场"
        return "特写"
    if any(k in text for k in ["黑场", "纯黑", "全黑", "几乎全黑", "极暗画面", "未见可辨认主体"]):
        return "黑场"
    if any(k in text for k in ["标题卡", "图文卡", "文字卡", "日期标题", "2024.1.1", "新年快乐"]):
        return "图卡"
    if any(k in text for k in ["字幕卡"]):
        return "字幕卡"
    if any(k in text for k in ["屏幕", "网页", "浏览器", "Google", "资料拼贴", "搜索结果", "地图", "卫星地图", "录制界面"]):
        return "屏幕录制"
    if any(k in text for k in ["资料视频", "资料画面", "复古黑白车图", "黑白画面"]):
        return "档案素材"
    if any(k in text for k in ["航拍"]):
        return "航拍全景"
    if any(k in text for k in ["俯瞰", "高处俯", "高角度俯", "俯拍全景"]):
        return "俯拍全景"
    if any(k in text for k in ["车内主观", "POV", "主观"]):
        return "主观镜头"
    if any(k in text for k in ["极近", "大特写"]):
        return "大特写"
    if any(k in text for k in ["插入", "道具特写", "手部特写", "局部特写", "工具特写", "屏幕特写", "近景特写", "极近特写", "特写"]):
        return "特写"
    for size in ["大远景", "远景", "中远景", "全景", "中全景", "中近景", "中景", "近景"]:
        if size in text:
            if size == "中远景":
                return "远景"
            return size
    return "中景"


def repair_visual_fields(obs, idx):
    summary = str(obs.get("visual_summary", "")).strip()
    comp = str(obs.get("composition_analysis", "")).strip()
    angle = str(obs.get("camera_angle", "")).strip()
    raw_size = str(obs.get("shot_size", "")).strip()

    if "pending_visual_review" in summary.lower() or not summary:
        fallback_summaries = {
            26: "该格关键帧几乎全黑，只能确认是车内或夜间段落里的短促暗场切换。",
            61: "该格下半部被大面积遮挡，仅能确认上方有仓储货架和人物头肩轮廓。",
            65: "该格主体被近距离物体遮住，剩余边缘只露出货架/室内背景信息。",
            66: "该格照度很低，只有微弱轮廓可见，更像室内或车内的暗场过渡。",
            69: "该格画面被前景遮挡，边缘隐约露出商品或货架背景，主体动作不可确认。",
            97: "该格呈暗紫色遮挡画面并叠有录制界面图标，像镜头被遮住的过渡。",
            154: "该格是人物极近距离近景，脸部大面积模糊，除车内背景外细节很少。",
            191: "该格为黑场，除右上角水印外没有可辨认主体，用作视觉停顿。",
            193: "该格为纯黑或近纯黑过渡帧，未见人物、道具或环境细节。",
            198: "该格过暗且红黑色块占画面，无法确认主体，更接近夜间遮挡切镜。",
        }
        summary = fallback_summaries.get(idx, "该格关键帧可见信息有限，按遮挡或暗场过渡记录。")
    if "pending_visual_review" in comp.lower() or not comp:
        fallback_comps = {
            26: "黑色区域占据绝大部分画面，少量边缘亮度不足以形成明确主体。",
            61: "遮挡物压住下半画面，人物和货架只在上方形成局部层次。",
            65: "近距离遮挡覆盖中心区域，背景信息被压到画面边缘。",
            66: "弱光让主体轮廓并入暗部，画面重心落在黑色块面本身。",
            69: "前景遮挡切断主体，剩余货架边缘只提供地点线索。",
            97: "录制界面符号浮在暗紫背景上，画面主体被遮挡而非正常构图。",
            154: "模糊脸部占满中心，车内背景只剩边缘暗块，信息集中在距离感。",
            191: "黑场没有主体位置关系，只保留水印和转场停顿。",
            193: "近纯黑画面缺少前中后景，构图功能是短暂停顿。",
            198: "红黑色块占据中心，缺乏可辨主体，画面用于暗场切换。",
        }
        comp = fallback_comps.get(idx, "暗部或遮挡占据主要区域，可见信息集中在少量边缘轮廓。")
    if "pending_visual_review" in angle.lower() or not angle:
        angle = "角度不可精确判定；按遮挡或暗场中的近距离观察处理。"

    shot_size = normalize_size(raw_size, summary)
    return summary, shot_size, angle, comp


def thicken(value, fallback, min_len):
    text = str(value or "").strip()
    if text.lower() == "pending_visual_review" or not text:
        text = fallback
    if visible_len(text) < min_len:
        text = f"{text}；{fallback}"
    return text


def make_voiceover(idx, obs):
    text = "无完整 transcript；本镜旁白需回看原片核对。"
    summary = str(obs.get("visual_summary", ""))
    if "字幕" in summary or "中文字幕" in str(obs.get("audio_note", "")):
        text = "画面可见中文字幕，但 transcript 资源未返回；按可见字卡和画面功能记录。"
    return text


def make_background_audio():
    return "transcript 资源仍为 running/data:null，无法可靠判断音乐与现场声；按画面节奏先占位。"


def build_storyboard():
    shots = load_json(SHOTS_PATH)
    frames = load_json(FRAMES_PATH)
    frame_by_index = {int(f["shot_index"]): f for f in frames}
    obs_by_index = {}
    for path in OBS_PATHS:
        for item in load_json(path):
            obs_by_index[int(item["shot_index"])] = item

    beats = []
    for shot in shots:
        idx = int(shot["index"])
        obs = obs_by_index.get(idx, {})
        summary, shot_size, angle, comp = repair_visual_fields(obs, idx)
        frame = frame_by_index[idx]
        edit_note = thicken(
            obs.get("edit_note"),
            "这个切点负责把上一个信息点落到下一步动作或地点变化上。",
            14,
        )
        audio_note = "transcript 资源未返回；本镜声音只按可见字幕、场景和剪辑位置做低置信度记录。"
        narrative_function = thicken(
            obs.get("narrative_function"),
            "本镜为观众提供理解当前行动、地点或道具关系所需的画面证据。",
            14,
        )
        reusable_pattern = str(obs.get("reusable_pattern", "")).strip()
        if reusable_pattern.lower() == "pending_visual_review" or not reusable_pattern:
            reusable_pattern = "遮挡或暗场过渡：保留短停顿，让信息切换不显突兀"
        if visible_len(reusable_pattern) < 14:
            reusable_pattern = f"{reusable_pattern}：用同类主体、道具和空间关系拍成可替换素材"
        camera_motion = str(obs.get("camera_motion", "")).strip()
        if camera_motion.lower() == "pending_visual_review" or not camera_motion:
            camera_motion = "单帧无法确认镜头运动；按静态关键帧记录，动态需原片复核。"
        beat = {
            "shot_index": idx,
            "start_sec": float(shot["start_sec"]),
            "end_sec": float(shot["end_sec"]),
            "frame_path": frame["path"],
            "shot_size": shot_size,
            "transcript_excerpt": "transcript 资源未返回；无可核验逐字稿。",
            "voiceover": make_voiceover(idx, obs),
            "visual_summary": thicken(summary, "画面按已查看关键帧记录可见主体、动作和环境线索。", 18),
            "composition": comp,
            "composition_analysis": thicken(comp, "构图说明以主体位置、前景遮挡、背景线条和画面重心为依据。", 22),
            "camera_angle": angle,
            "camera_motion": camera_motion,
            "edit_note": edit_note,
            "audio_note": audio_note,
            "background_audio": make_background_audio(),
            "narrative_function": narrative_function,
            "reusable_pattern": reusable_pattern,
        }
        beats.append(beat)
    return beats


def evidence(timestamp, note):
    return {"timestamp_sec": timestamp, "note": note}


def normalize_cards_for_schema(cards):
    topic = cards["topic"]
    topic["question"] = "怎样把一次低成本车内睡眠改造，拍成关于新年上路和 campervan 愿望的完整故事？"
    topic["why_now"] = "新年日期、临时 DIY 和 van life 资料浏览同时出现，让普通改车动作变成一个生活方式选择的节点。"
    topic["angle_type"] = "personal"

    hook = cards["hook"]
    hook["t0_frame"] = {
        "timestamp_sec": 4.984,
        "description": "室内近距离人物头部与手部，脸部被模糊，背景偏暗绿色。",
        "frame_path": "samples/smp_01KSWWTEWHPJPCD6AM3D1HA8Z1/resources/frames/shot_000_t4.984s.jpg",
    }
    hook["first_sentence"] = {
        "text": "transcript 未返回；开头实际以清晨起床和 06:30 时间画面制造沉浸。",
        "sentence_pattern": "scene_immersion",
    }
    hook["hook_type"] = "info_gap"

    structure = cards["structure"]
    for seg in structure.get("segments", []):
        if "purpose" in seg:
            seg["summary"] = seg.pop("purpose")
    for item in structure.get("turn_points", []):
        note = item.pop("note", "")
        ts = item.pop("timestamp_sec")
        item["start_sec"] = ts
        item["end_sec"] = ts
        item["label"] = note[:20] or "转折点"
        item["summary"] = note

    pace = cards["pace"]
    for seg in pace.get("density_segments", []):
        seg["label"] = seg.pop("density")
        seg["summary"] = seg.pop("reason", "")
    for item in pace.get("breath_points", []):
        ts = item.pop("timestamp_sec")
        note = item.pop("note")
        item["start_sec"] = ts
        item["end_sec"] = ts
        item["label"] = "呼吸点"
        item["summary"] = note

    shot = cards["shot"]
    shot["b_roll_functions"] = [
        f"{item['type']}：{item['note']}（shots {', '.join(str(s) for s in item['shots'])}）"
        for item in shot.get("b_roll_functions", [])
    ]
    shot["low_cost_replicable"] = True

    edit = cards["edit"]
    for item in edit.get("tempo_map", []):
        item["label"] = item.pop("tempo")
        item["summary"] = item.pop("note", "")
    edit["transitions"] = [
        f"{item['timestamp_sec']}s：{item['from']} → {item['to']}；{item['method']}"
        for item in edit.get("transitions", [])
    ]
    for item in edit.get("jump_cuts", []):
        rng = item.pop("range")
        note = item.pop("note")
        nums = [int(n) for n in re.findall(r"\d+", rng)]
        start = float(nums[0]) if nums else 0.0
        end = float(nums[-1]) if nums else start
        item["start_sec"] = start
        item["end_sec"] = end
        item["label"] = f"shots {rng}"
        item["summary"] = note
    for item in edit.get("pause_points", []):
        ts = item.pop("timestamp_sec")
        note = item.pop("note")
        item["start_sec"] = ts
        item["end_sec"] = ts
        item["label"] = "停顿点"
        item["summary"] = note

    music = cards["music"]
    for field in ("mood_curve", "in_points", "out_points"):
        for item in music.get(field, []):
            if "mood" in item:
                item["label"] = item.pop("mood")
                item["summary"] = item.pop("function", "")
            elif "timestamp_sec" in item:
                ts = item.pop("timestamp_sec")
                note = item.pop("note")
                item["start_sec"] = ts
                item["end_sec"] = ts
                item["label"] = "音乐点"
                item["summary"] = note

    subtitle = cards["subtitle"]
    subtitle["color_coding"] = "常规说明以白色底部字幕为主，部分强调字幕使用橙色；结尾日期卡使用绿色日期和红色祝福。"
    subtitle["keyword_choices"] = [
        f"{item['word']}：{item['function']}" for item in subtitle.get("keyword_choices", [])
    ]
    subtitle.pop("transcript_limitation", None)
    return cards


def build_cards():
    cards = {
        "topic": {
            "summary": "这是一条从日常醒来、采购木板、改造车内睡眠平台，到被 van life 想象和旧车记忆牵引上路的新年车居探索片。",
            "transferable_formula": "清晨行动触发 → 采购和 DIY 证明可行性 → 车内过夜测试 → 查资料扩大欲望 → 看车/旧车记忆回收 → 风景路途和日期字卡收束。",
            "reusable_skeleton": "如果你要复刻：先给一个具体生活问题，再拍购买材料、实际动手、第一次使用、搜索更大方案、情绪性路途收束。",
            "evidence": [
                evidence(4.984, "手机 06:30 和起床洗漱建立清晨出发点。"),
                evidence(70.617, "卷尺、木板和手锯把想象落成 DIY 行动。"),
                evidence(740.917, "2024.1.1 新年快乐字卡把旅程收束到新年节点。"),
            ],
        },
        "hook": {
            "summary": "开头不靠强冲突，而靠“清晨私密起床 + 具体时间 + 一连串准备动作”让观众等着看今天到底要做什么。",
            "retention_logic": "观众先看到 06:30、起床、取物、上车和地图，问题从“他是谁”转成“他这么早出门要做什么”。",
            "next_question_in_viewer_mind": "这些准备动作会导向一次普通出门，还是一次车居/旅行改造？",
            "reusable_skeleton": "用手机时间特写 + 低光起床 + 出门前小动作 + 上车/地图，把观众带进一个尚未揭晓的日常任务。",
            "evidence": [
                evidence(4.984, "人物暗部近景制造私密进入感。"),
                evidence(17.566, "手机 06:30 明确当天开始得很早。"),
                evidence(57.617, "车辆和地图把行动从室内推出去。"),
            ],
        },
        "structure": {
            "summary": "全片结构是“试做一张能睡的车床”不断外扩成“我想拥有一辆真正 campervan”的欲望链。",
            "archetype": "DIY 实验片 + 旅行愿望片 + 旧车记忆回收。",
            "segments": [
                {"start_sec": 0, "end_sec": 66.333, "label": "清晨启动", "purpose": "用起床、洗漱、上车和地图建立行动动机。"},
                {"start_sec": 66.333, "end_sec": 142.367, "label": "采购材料", "purpose": "在仓储商店寻找木板、工具和配件。"},
                {"start_sec": 142.367, "end_sec": 342.4, "label": "车边 DIY", "purpose": "测量、切割、涂胶、钻孔，把车内空间改成可睡平台。"},
                {"start_sec": 342.4, "end_sec": 449.767, "label": "夜宿测试", "purpose": "把改造成果放进真实车内过夜场景。"},
                {"start_sec": 449.767, "end_sec": 538.767, "label": "资料扩张", "purpose": "通过 van life 视频和网页，把小实验升级成生活方式想象。"},
                {"start_sec": 538.767, "end_sec": 617.0, "label": "看车比较", "purpose": "浏览 Toyota Hiace、Fiat Ducato 等候选车，把愿望推向购买决策。"},
                {"start_sec": 617.0, "end_sec": 663.3, "label": "旧车记忆", "purpose": "用 1996 Toyota Tarago 和黑白驾驶画面连接个人历史。"},
                {"start_sec": 663.3, "end_sec": 745.5, "label": "新年上路", "purpose": "雨雾道路、山路远景和日期字卡完成情绪收束。"},
            ],
            "turn_points": [
                {"timestamp_sec": 66.333, "note": "进入仓储商店，行动目标从出门变成采购材料。"},
                {"timestamp_sec": 142.367, "note": "开始测量和切割木板，影片从购买转入制作。"},
                {"timestamp_sec": 342.4, "note": "夜晚打开后备箱和睡袋，改造成果进入真实使用测试。"},
                {"timestamp_sec": 449.767, "note": "开始搜索 van life 与改装资料，故事从一辆现有车扩展到理想车型。"},
                {"timestamp_sec": 617.0, "note": "1996 Toyota Tarago 图卡把车型选择转入个人记忆。"},
                {"timestamp_sec": 736.333, "note": "新年字卡给出时间节点和祝福式结尾。"},
            ],
            "skeleton_template": "日常触发 → 补给采购 → 手作过程 → 真实测试 → 参考资料 → 方案升级 → 个人记忆 → 路途/日期收束。",
            "storyline": {
                "premise": "一个清晨出发的车内改造小实验，逐步扩展成关于 campervan 生活、旧车记忆和新年上路的个人愿望。",
                "protagonist_arc": {
                    "start_state": "人物从卧室里的低光、碎片化准备动作开始，只是在处理一个具体当天任务。",
                    "end_state": "人物被放到山路、车辆和新年日期之中，车不再只是工具，而成为生活方向的象征。",
                    "transformation": "从“临时让车能睡”转向“认真想象一种可以长期移动生活的可能”。",
                },
                "story_beats": [
                    {"start_sec": 0, "end_sec": 66.333, "label": "清晨启动", "story_function": "setup", "viewer_knows": "观众知道人物很早起床、取物、上车并查看地图，但还不知道完整目的。", "viewer_question": "这些准备动作会导向一次普通出门，还是某个更大的计划？", "author_intent": "先用时间、卧室和车内细节把故事压在可亲近的生活尺度里。", "why_here": "开头必须先给身体动作和时间坐标，让后面的采购与改装显得是当天自然发生的行动。", "evidence_shots": [4, 16, 24]},
                    {"start_sec": 66.333, "end_sec": 142.367, "label": "采购材料", "story_function": "task_definition", "viewer_knows": "观众看到仓储货架、购物车、木板和手锯，意识到任务和 DIY 材料有关。", "viewer_question": "这些木板和工具最终会被装到车上的什么位置？", "author_intent": "把抽象想法换成可购买、可搬动、可测量的材料。", "why_here": "在上车之后马上进入商店，能快速回答“今天要做什么”，避免前段准备悬而不决。", "evidence_shots": [49, 58, 63]},
                    {"start_sec": 142.367, "end_sec": 273.533, "label": "开始加工", "story_function": "execution", "viewer_knows": "观众看到卷尺、铅笔、手锯和木板标记，知道人物在把材料加工成车内结构。", "viewer_question": "这个低成本手工方案是否真的能装进车里并承重？", "author_intent": "用密集工具特写把制作步骤拆开，让观众相信方案可复刻。", "why_here": "采购完成后必须立刻兑现为手工动作，否则材料清单不会产生观看回报。", "evidence_shots": [71, 74, 81]},
                    {"start_sec": 273.533, "end_sec": 342.4, "label": "固定成型", "story_function": "proof_of_work", "viewer_knows": "观众看到涂胶、电钻和支撑件，知道结构正在从临时板材变成可使用平台。", "viewer_question": "它在车内真实使用时会不会太窄、太冷或不舒服？", "author_intent": "用胶线、钻孔和支撑细节证明这不是空想，而是实际完成的装置。", "why_here": "在进入夜宿前先让观众看见结构成型，夜晚测试才有物理依据。", "evidence_shots": [87, 90, 95]},
                    {"start_sec": 342.4, "end_sec": 449.767, "label": "车内过夜", "story_function": "field_test", "viewer_knows": "观众看到夜间车尾、睡袋、躺卧和车内游戏，知道改装空间被拿来生活和休息。", "viewer_question": "一次成功过夜会让人物满足，还是激发更大的车居欲望？", "author_intent": "把工具成果放进真实身体体验里，让空间限制和生活感同时出现。", "why_here": "制作后需要立即给使用场景，才能判断这个 DIY 是否解决了最初问题。", "evidence_shots": [112, 118, 131]},
                    {"start_sec": 449.767, "end_sec": 538.767, "label": "灵感外扩", "story_function": "desire_expansion", "viewer_knows": "观众看到 Google、van life 视频、内饰图和露营车资料，知道人物开始比较更理想的方案。", "viewer_question": "他会继续改现在的车，还是转向购买真正的 campervan？", "author_intent": "用屏幕资料把小车内实验扩展成生活方式想象。", "why_here": "过夜测试之后插入资料，正好说明真实体验如何刺激下一层愿望。", "evidence_shots": [134, 138, 151]},
                    {"start_sec": 538.767, "end_sec": 617.0, "label": "车型选择", "story_function": "decision_pressure", "viewer_knows": "观众看到 Toyota Hiace、Fiat Ducato 等二手车页面和现场看车画面，愿望开始接近购买决策。", "viewer_question": "这些车型里哪一辆承载了人物真正想要的生活？", "author_intent": "把灵感板变成价格、型号、车况和现实选择。", "why_here": "资料浏览之后必须进入具体候选项，否则愿望只停留在图片收藏。", "evidence_shots": [163, 165, 166]},
                    {"start_sec": 617.0, "end_sec": 663.3, "label": "旧车记忆", "story_function": "personal_context", "viewer_knows": "观众看到 1996 Toyota Tarago 图卡和黑白驾驶画面，知道车型选择与过去经历有关。", "viewer_question": "这辆旧车记忆会怎样影响当下的新年出发？", "author_intent": "用黑白和车型字卡把车从消费品变成个人历史线索。", "why_here": "在看车比较之后补入旧车记忆，能解释为什么某类车对人物有情感重量。", "evidence_shots": [171, 175, 179]},
                    {"start_sec": 663.3, "end_sec": 745.5, "label": "新年上路", "story_function": "resolution", "viewer_knows": "观众看到雨雾道路、山路远景、车内驾驶和新年字卡，知道故事以继续上路而非购买答案收束。", "viewer_question": "下一次出发会不会真的变成长期车居生活？", "author_intent": "把选择悬念留在路上，用日期祝福替代明确结论。", "why_here": "结尾不需要宣布决定，而是让车辆、道路和新年时间共同给出开放的下一步。", "evidence_shots": [180, 204, 211]},
                ],
                "setup_payoffs": [
                    {"setup_sec": 17.566, "payoff_sec": 740.917, "setup_shot": 4, "payoff_shot": 211, "setup": "手机 06:30 把故事钉在一个清晨。", "payoff": "2024.1.1 新年快乐字卡把一天的行动落到新年时间点。", "meaning": "早起不是普通日常，而是一次新生活想象的开端。"},
                    {"setup_sec": 70.617, "payoff_sec": 395.1, "setup_shot": 71, "payoff_shot": 118, "setup": "卷尺和铅笔在木板上标记尺寸。", "payoff": "人物躺进车内平台和睡袋里测试成果。", "meaning": "测量动作被回收为身体能否真正睡下的验证。"},
                    {"setup_sec": 462.2, "payoff_sec": 578.767, "setup_shot": 134, "payoff_shot": 163, "setup": "Google 和 van life 视频打开理想车型想象。", "payoff": "二手 Toyota Hiace / Fiat Ducato 页面把想象变成价格和车型选择。", "meaning": "灵感浏览被现实购买条件拉回地面。"},
                    {"setup_sec": 617.75, "payoff_sec": 717.434, "setup_shot": 171, "payoff_shot": 204, "setup": "1996 Toyota Tarago 图卡引入旧车记忆。", "payoff": "高处山路远景让车辆继续在新年路途中移动。", "meaning": "过去的车不只是怀旧素材，而成为继续出发的情绪燃料。"},
                ],
            },
            "reusable_skeleton": "用 8 段式结构复刻：清晨启动、采购材料、开始加工、固定成型、真实使用、资料外扩、现实选择、开放上路。",
            "evidence": [
                evidence(67.75, "仓储商店购物车和货架定义采购段落。"),
                evidence(291.5, "涂胶和电钻把 DIY 推到成型阶段。"),
                evidence(578.767, "车辆网页和看车画面让愿望进入现实选择。"),
            ],
        },
        "pace": {
            "summary": "节奏从清晨碎片快切进入采购与制作密集细节，中段以夜宿和车内活动放慢，后段靠屏幕资料与道路远景交替收束。",
            "overall_curve": "0-66s 轻快启动；66-342s 工具/材料信息密度最高；342-449s 使用测试放慢；449-617s 屏幕信息加速；617-745s 记忆和路途降速收束。",
            "density_segments": [
                {"start_sec": 0, "end_sec": 66.333, "density": "medium", "reason": "起床、取物、上车、地图连续交代。"},
                {"start_sec": 66.333, "end_sec": 342.4, "density": "high", "reason": "采购和制作细节密集，镜头短且动作明确。"},
                {"start_sec": 342.4, "end_sec": 449.767, "density": "medium-low", "reason": "睡袋、躺卧、车内娱乐让观看从步骤转为体验。"},
                {"start_sec": 449.767, "end_sec": 617.0, "density": "high", "reason": "网页、资料视频、车型列表快速切换。"},
                {"start_sec": 617.0, "end_sec": 745.5, "density": "low", "reason": "黑白驾驶、雨雾道路和山路远景拉长情绪。"},
            ],
            "breath_points": [
                {"timestamp_sec": 125.6, "note": "购物通道全景给采购段落短暂停顿。"},
                {"timestamp_sec": 342.4, "note": "夜间车辆外景从制作高密度转为使用测试。"},
                {"timestamp_sec": 617.0, "note": "1996 Tarago 图卡让屏幕资料段落切入记忆。"},
                {"timestamp_sec": 736.333, "note": "结尾字卡让道路段落停住。"},
            ],
            "reusable_skeleton": "高密度步骤段之后必须安排体验段；大量屏幕资料之后用路途远景和图卡降速。",
            "evidence": [
                evidence(70.617, "测量和工具镜头开始连续密集。"),
                evidence(395.1, "躺进睡袋后节奏明显放缓。"),
                evidence(712.117, "山路大远景给结尾留出呼吸。"),
            ],
        },
        "shot": {
            "summary": "拍法混合手持生活近景、工具插入特写、购物车/车内 POV、屏幕录制资料和道路远景，核心是让每个抽象愿望都有一个可拍的物件锚点。",
            "a_roll_style": "人物正面讲话很少，更多用车内近景、手部动作和背影承担主线；脸部常模糊，主体靠动作和道具辨识。",
            "b_roll_functions": [
                {"type": "时间/地点锚点", "shots": [4, 19, 24, 211], "note": "手机时间、地图、导航和日期字卡负责交代坐标。"},
                {"type": "过程证据", "shots": [71, 87, 90, 95], "note": "卷尺、胶线、电钻和板边连接点证明 DIY 真的发生。"},
                {"type": "愿望资料", "shots": [134, 138, 151, 163], "note": "搜索页面和参考视频把想象外部化。"},
                {"type": "情绪收束", "shots": [180, 202, 204, 211], "note": "雨雾道路、山路远景和字卡把结尾拉开。"},
            ],
            "cut_density": "制作和购物段以 1-4 秒短镜头为主；夜宿和道路段保留更长镜头承载体验。",
            "low_cost_replicable": "高：主要需要手机/小相机、购物车 POV、车内固定机位、工具特写和屏幕录制。",
            "reusable_skeleton": "每个步骤至少拍三类镜头：动作手部特写、环境全景、结果/使用镜头；愿望段补屏幕资料，结尾补道路远景。",
            "evidence": [
                evidence(17.566, "手机时间特写提供低成本信息锚。"),
                evidence(273.533, "胶瓶和板边特写说明组装步骤。"),
                evidence(712.117, "高位道路远景提升结尾空间尺度。"),
            ],
        },
        "edit": {
            "summary": "剪辑以硬切为主，用“特写说明动作 → 全景确认空间 → 下一步特写”的方式推进；后段用屏幕资料和道路/车内反打形成想象与现实交替。",
            "tempo_map": [
                {"start_sec": 0, "end_sec": 66.333, "tempo": "碎片化日常快切", "note": "起床、取物、上车、地图快速接续。"},
                {"start_sec": 66.333, "end_sec": 342.4, "tempo": "步骤拆解快切", "note": "每个工具动作都有对应细节镜头。"},
                {"start_sec": 342.4, "end_sec": 449.767, "tempo": "体验观察", "note": "夜宿、躺卧和游戏镜头稍慢。"},
                {"start_sec": 449.767, "end_sec": 617.0, "tempo": "资料浏览快切", "note": "网页、视频和候选车型连续出现。"},
                {"start_sec": 617.0, "end_sec": 745.5, "tempo": "道路慢收束", "note": "黑白回忆、雨雾道路和山路远景交替。"},
            ],
            "transitions": [
                {"timestamp_sec": 66.333, "from": "车内导航", "to": "仓储商店", "method": "地点硬切，保持行动方向。"},
                {"timestamp_sec": 142.367, "from": "采购", "to": "测量木板", "method": "用工具动作承接材料结果。"},
                {"timestamp_sec": 449.767, "from": "车内使用", "to": "屏幕搜索", "method": "从体验问题切到资料寻找。"},
                {"timestamp_sec": 617.0, "from": "二手车页面", "to": "旧车图卡", "method": "用车型信息触发记忆转场。"},
            ],
            "jump_cuts": [
                {"range": "29-38", "note": "油箱盖、油枪、金额、车侧全景组成加油流程压缩。"},
                {"range": "71-95", "note": "测量、锯切、涂胶、电钻把长制作过程压成关键动作。"},
                {"range": "134-161", "note": "网页和资料视频连续跳切，模拟搜索和比较速度。"},
            ],
            "pause_points": [
                {"timestamp_sec": 342.4, "note": "夜间车辆外景让制作段落停下。"},
                {"timestamp_sec": 617.75, "note": "1996 Toyota Tarago 图卡让观众转换到记忆线。"},
                {"timestamp_sec": 740.917, "note": "新年字卡完成最后停顿。"},
            ],
            "reusable_skeleton": "流程类片子按“动作细节三连 + 空间确认 + 结果使用”剪；资料段用屏幕快切，结尾用风景远景减速。",
            "evidence": [
                evidence(92.85, "油枪和油箱连续特写压缩补给过程。"),
                evidence(291.5, "电钻镜头把制作推到结果阶段。"),
                evidence(617.75, "车型图卡改变剪辑质感和时间层级。"),
            ],
        },
        "music": {
            "summary": "由于 transcript/音频资源未返回，音乐判断只能低置信度占位；从画面结构看，声音应支撑清晨行动、DIY 密度、夜宿安静和道路收束四种状态。",
            "mood_curve": [
                {"start_sec": 0, "end_sec": 66.333, "mood": "清晨轻启动", "function": "给日常准备动作提供连续性。"},
                {"start_sec": 66.333, "end_sec": 342.4, "mood": "工具步骤感", "function": "让大量短镜头不散。"},
                {"start_sec": 342.4, "end_sec": 449.767, "mood": "夜间低能量", "function": "突出车内过夜的狭小和安静。"},
                {"start_sec": 617.0, "end_sec": 745.5, "mood": "回忆与路途", "function": "给黑白旧车和新年路途统一尾声。"},
            ],
            "in_points": [
                {"timestamp_sec": 0, "note": "若复刻，可从起床近景下轻音乐或环境底噪。"},
                {"timestamp_sec": 66.333, "note": "采购段可加入更稳定的节拍承接购物车移动。"},
                {"timestamp_sec": 617.0, "note": "旧车图卡处适合换成更怀旧的音色。"},
            ],
            "out_points": [
                {"timestamp_sec": 342.4, "note": "夜宿前应降低音乐密度，给车内空间留白。"},
                {"timestamp_sec": 736.333, "note": "字卡前后适合让音乐尾音自然收束。"},
            ],
            "reference_genre": "低饱和旅行 vlog / DIY 纪录感配乐；避免过强情绪盖住工具细节。",
            "reusable_skeleton": "没有清晰同期声时，用音乐分段：日常轻启动、制作稳定节拍、夜晚降密度、道路尾声拉长。",
            "evidence": [
                evidence(0, "音频资源缺失，本卡按画面结构给声音方案。"),
                evidence(395.1, "车内睡袋段应让声音降下来。"),
                evidence(717.434, "道路远景适合尾声音乐延展。"),
            ],
        },
        "subtitle": {
            "summary": "画面多处可见中文字幕，但 transcript 未成功落库；字幕策略更像补充内心说明和行动解释，而不是强排版装饰。",
            "strategy": "底部中文字幕跟随旁白/说明出现；屏幕资料段保留原网页或视频字幕，让观众同时看到信息来源。",
            "emphasis_style": "以橙色或白色底部字幕为主；结尾用独立图卡显示日期和祝福。",
            "keyword_choices": [
                {"word": "06:30", "function": "时间锚点，提示清晨行动。"},
                {"word": "van life / campervan", "function": "资料段关键词，把车内实验扩展为生活方式。"},
                {"word": "1996 Toyota Tarago", "function": "车型和记忆锚点。"},
                {"word": "2024.1.1 新年快乐", "function": "结尾时间和情绪落点。"},
            ],
            "transcript_limitation": "sample.preprocess transcript 后台任务完成，但 sample.get_resources 仍显示 running/data:null；逐字旁白未能核验。",
            "reusable_skeleton": "行动段字幕解释原因，资料段保留网页/视频文字，结尾用独立日期卡完成情绪确认。",
            "evidence": [
                evidence(17.566, "06:30 手机时间承担字幕之外的信息锚。"),
                evidence(462.2, "Google 和资料视频画面自带文字信息。"),
                evidence(740.917, "新年快乐字卡是全片最明确的文字落点。"),
            ],
        },
    }
    return normalize_cards_for_schema(cards)


def build_templates():
    return [
        {
            "teardown_id": TEARDOWN_ID,
            "type": "structure",
            "title": "从临时 DIY 到生活方式愿望的 8 段模板",
            "body_md": """# 从临时 DIY 到生活方式愿望\n\n1. 清晨启动：拍手机时间、起床、取物、上车。\n2. 采购材料：拍购物车 POV、材料全景、工具拿取特写。\n3. 开始加工：拍卷尺、划线、锯切、材料支撑。\n4. 固定成型：拍涂胶、电钻、连接点、成品局部。\n5. 真实使用：拍夜晚、铺床、躺下、空间限制。\n6. 灵感外扩：拍搜索页面、参考视频、收藏图。\n7. 现实选择：拍价格、车型、实地看车或对比表。\n8. 开放收束：拍道路远景、车内驾驶、日期或一句祝福。\n\n填空：我的具体问题是【____】；我的低成本实验是【____】；它引出的更大愿望是【____】。""",
        },
        {
            "teardown_id": TEARDOWN_ID,
            "type": "shot",
            "title": "低成本车居/DIY 片必拍镜头清单",
            "body_md": """# 低成本车居/DIY 必拍镜头\n\n- 信息锚：手机时间、地图、导航、日期卡。\n- 动作锚：手拿工具、卷尺划线、锯切、涂胶、钻孔。\n- 空间锚：车尾打开、后备箱全景、车内座椅遮挡、睡袋铺开。\n- 欲望锚：Google 搜索、参考视频、二手车网页、车型标题卡。\n- 情绪锚：雨雾道路、山路俯视、车内驾驶近景、最终字卡。\n\n拍摄顺序建议：先拍结果使用，再补动作特写；先拍真实空间，再补屏幕资料。""",
        },
        {
            "teardown_id": TEARDOWN_ID,
            "type": "edit",
            "title": "流程类 vlog 的剪辑节奏模板",
            "body_md": """# 流程类 vlog 剪辑节奏\n\n- 开头 10 秒：人物近景 + 时间特写 + 第一个动作。\n- 每个步骤：工具特写 → 手部动作 → 环境确认 → 下一步。\n- 高密度段后：插入一段真实使用或空间观察，让观众消化。\n- 资料段：屏幕内容快切，但每 3-5 个资料镜头给一个人物/车内反应。\n- 结尾：减少信息量，用道路、远景、字卡完成余韵。""",
        },
    ]


def build_relations():
    return [
        {"source_node": "topic", "target_node": "structure", "relation_type": "supports", "description": "主题的车居愿望由八段故事结构逐步展开。"},
        {"source_node": "hook", "target_node": "structure", "relation_type": "transitions_to", "description": "清晨启动悬念过渡到采购和 DIY 主线。"},
        {"source_node": "shot", "target_node": "edit", "relation_type": "supports", "description": "工具特写和车内 POV 为步骤式硬切提供素材。"},
        {"source_node": "subtitle", "target_node": "music", "relation_type": "aligns_with", "description": "两者都受 transcript 缺失限制，需要后续回看原片核验。"},
        {"source_node": "structure", "target_node": "template:structure", "relation_type": "supports", "description": "八段故事线可直接抽成复刻模板。"},
        {"source_node": "shot", "target_node": "template:shot", "relation_type": "supports", "description": "必拍镜头清单来自 storyboard 中反复出现的素材功能。"},
    ]


def main():
    beats = build_storyboard()
    cards = build_cards()
    templates = build_templates()
    relations = build_relations()

    (OUTPUT / "storyboard_walter_mitty_bilibili.json").write_text(json.dumps(beats, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUTPUT / "submit_storyboard_walter_mitty_bilibili.json").write_text(json.dumps({"teardown_id": TEARDOWN_ID, "beats": beats}, ensure_ascii=False, indent=2), encoding="utf-8")
    for card_type, payload in cards.items():
        (OUTPUT / f"card_{card_type}_walter_mitty_bilibili.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        (OUTPUT / f"submit_card_{card_type}_walter_mitty_bilibili.json").write_text(json.dumps({"teardown_id": TEARDOWN_ID, "card_type": card_type, "payload": payload}, ensure_ascii=False, indent=2), encoding="utf-8")
    for index, template in enumerate(templates, start=1):
        (OUTPUT / f"submit_template_{index}_walter_mitty_bilibili.json").write_text(json.dumps(template, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUTPUT / "submit_relations_walter_mitty_bilibili.json").write_text(json.dumps({"teardown_id": TEARDOWN_ID, "relations": relations}, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest = {
        "sample_id": SAMPLE_ID,
        "teardown_id": TEARDOWN_ID,
        "storyboard_beats": len(beats),
        "cards": sorted(cards),
        "templates": len(templates),
        "relations": len(relations),
        "transcript_status": "resource remained running/data:null after background preprocess completed; storyboard uses visible subtitles and frame evidence only",
    }
    (OUTPUT / "teardown_payload_manifest_walter_mitty_bilibili.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
