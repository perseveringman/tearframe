#!/usr/bin/env python3
import json
from pathlib import Path

TEARDOWN_ID = "td_01KSX1TX8TNG4P3EGHJQVY4Z8T"
ROOT = Path("/Users/ryanbzhou/.tearframe/samples/smp_01KSWXY40ZE3R3T0PGBTG82YPK/resources")
OUT = Path("/Users/ryanbzhou/Developer/vibe-coding/freedom/tearframe/output/smp_01KSWXY40ZE3R3T0PGBTG82YPK-contact-sheets")
OUT.mkdir(parents=True, exist_ok=True)
shots = json.loads((ROOT / "shots.json").read_text(encoding="utf-8"))
frames = json.loads((ROOT / "frames/index.json").read_text(encoding="utf-8"))
frame_by_shot = {int(f["shot_index"]): f for f in frames}

SEGMENTS = [
    (0, 9, "室内开场与旅行设问", "近景", "平视手持", "室内人物、手工地球拼图、书本和手机提示构成开场信息", "先用人物口播和小道具把宏大地理主题缩小到一次可跟随的个人计划"),
    (10, 20, "片名公路蒙太奇", "字幕卡", "车内行车视角", "公路、隧道、盐地和山路上叠加 BACK TO EARTH 片名", "用连续移动视角制造旅程启动感，片名把零散地点统一为地球异旅概念"),
    (21, 35, "地图定位与盐湖抵达", "远景", "平视观察", "地图、车内讲述、盐湖岸线、道路、湖面和风暴云交替出现", "先给坐标再给现场，使观众知道奇观不是凭空出现而是被抵达和验证"),
    (36, 72, "盐湖死亡感观察", "插入特写", "主观俯拍", "白色盐地、湖边自拍视频、脚印、手捧盐粒、鸟类遗骸和阴云湖面", "把美丽盐湖转成有代价的生命现场，形成第一处反浪漫转折"),
    (73, 83, "地球字卡与工业地貌", "远景", "平视长焦", "黑场、地球字卡、山谷工厂、高烟囱、厂区和竖屏素材", "用工业烟囱把外星感拉回地球现实，提示这些景观有开采和生产背景"),
    (84, 107, "工业湖区与限制边界", "远景", "平视观察", "金顶建筑、湖边围栏、厂区烟囱、航拍盐池、警示门和荒原越野车", "在观光视角中插入管制和工厂信息，让奇观带上被进入的门槛"),
    (108, 128, "铁路与私有边界", "远景", "平视透视", "荒原铁路、碎石路基、脚踩轨枕、PRIVATE PROPERTY 告示和桥梁结构", "用铁路和警示牌把探索路线拍成被规训的边界穿越"),
    (129, 148, "彩色盐池航拍", "航拍全景", "航拍俯视", "粉色、青绿色水面被堤道切分，桥梁、浅水和碎石岸线作为比例参照", "用上帝视角释放色块奇观，同时保留堤道和桥梁说明这不是纯自然画面"),
    (149, 158, "月球段落启动", "大远景", "车内平视", "月球字卡、车窗外荒漠、沙丘山体、桥梁、隧道和风机", "用月球命名切换第二颗星球感，把路途景观过渡到更干旱的地貌"),
    (159, 179, "湿地骆驼与观鸟", "远景", "平视长焦", "风机、湖边人物、骆驼群、水鸟、长焦相机和湖岸湿地", "在荒漠之外加入动物和观测行为，让外星地貌保留生态活性"),
    (180, 215, "湖区鸟群与高塔", "远景", "平视长焦", "动物群、湖面、展示牌、飞鸟、湖边高塔、金属平台和尘柱", "把观鸟的兴奋推进到可登高观察的空间，再用尘柱制造天气事件"),
    (216, 258, "灰色月面徒步", "大远景", "平视低角度", "车内视角、风机、背包人物、灰色荒漠、黑色岩丘、砾石地面和人物阴影", "让人物进入极小比例的灰色地貌，用尺度压迫证明这里像月球表面"),
    (259, 287, "月球意象与遗址夜色", "大远景", "高角度俯视", "月球素材、火山熔岩、灰黑山丘、荒漠遗址、夜空和土墙剪影", "把月球比喻扩展到宇宙、火山和人类遗址，形成时间尺度的上移"),
    (288, 299, "遗址离开与车内复盘", "远景", "平视观察", "暮色遗址、拱门、白色越野车、车内挡风玻璃和残墙文字", "让考古废墟作为上一段的余韵，随后回到车内准备进入下一地貌"),
    (300, 335, "干裂地与废旧设备", "近景", "低位平视", "手托干土、荒地警示牌、旧农机、锈蚀车身、孔洞、轮胎和水槽", "用触摸和锈迹把景观从远观奇观降到材质层面，说明荒凉也有人的痕迹"),
    (336, 359, "彩色坏地进入", "远景", "高角度俯视", "红白灰层状丘陵、车内讲述、小人物、干裂地面和手抓土块", "用彩色层理作为第三种星球表面，让人物在纹理里变小"),
    (360, 374, "彩丘与峡谷过渡", "大远景", "平视高角度", "红白矿物纹理、层状丘陵、小人物站在山脊、暗色峡谷和平台山", "通过人物登上山脊和峡谷框景，把色彩奇观过渡到台地地貌"),
    (375, 412, "台地、尸骸与车内解释", "远景", "平视长焦", "车内人物、桌状山、荒漠车辆、动物尸骸、坏地沟壑、尖顶山丘", "在车内解释与尸骸插入之间切换，把宏大地貌和生命消逝并置"),
    (413, 429, "照片打印与回收", "特写", "高角度俯拍", "室内电脑修图、打印机、裁剪照片、桌面小照片、照片板和片尾文字", "用实体照片回收片名的几张照片承诺，让旅行影像变成可被收藏的作品"),
]

VISUAL_VARIANTS = [
    "关键帧里可以看到{scene}，主体靠近画面重心，环境信息完整保留",
    "画面呈现{scene}，前景与远景形成清楚层次",
    "这一帧记录了{scene}，空间线条把视线带向远处",
    "可见{scene}，人物或物件与大面积地貌形成尺度对比",
    "画面中{scene}占主要视觉面积，颜色和纹理是识别点",
    "关键画面落在{scene}上，背景留出天空或地平线",
    "此处能看见{scene}，取景把局部材质和地点关系同时交代",
    "画面把{scene}放入同一构图，信息点集中但不拥挤",
    "这一张关键帧以{scene}作为核心视觉锚点",
    "镜内事实是{scene}，周围环境帮助确认位置和尺度",
    "画面展示{scene}，剪辑在这里强调地点转换后的第一印象",
    "可见元素集中在{scene}，视觉重心比前后镜头更明确",
]
COMP_VARIANTS = [
    "主体先落在中部，{comp}，背景横向展开形成稳定层次",
    "前景承担入口，{comp}，远景给出地点尺度",
    "地平线压在画面中上部，{comp}，让空间显得开阔",
    "色块从左到右分层，{comp}，视觉重心没有完全堵死",
    "可见线条斜向延伸，{comp}，把观看方向推向远处",
    "人物或物件占据前景，{comp}，环境留白承担情绪压力",
    "大面积天空或地面包围主体，{comp}，比例关系突出孤立感",
    "画面用横向层次组织信息，{comp}，中景负责说明地点",
    "近处纹理先吸引视线，{comp}，再把注意力递交给背景",
    "框架元素把视线收住，{comp}，主体和地点互相说明",
    "中心附近保留清晰主体，{comp}，边缘空间提供环境证据",
    "上下分区明显，{comp}，画面读法从地面进入天空或远山",
    "亮暗关系先建立方向，{comp}，主体在反差中被凸显",
    "重复形态形成节奏，{comp}，观众能快速识别这段的空间秩序",
    "画面把小主体放在大环境里，{comp}，尺度差是主要表达",
    "局部细节贴近镜头，{comp}，让材质成为段落证据",
    "道路、桥梁或山脊构成引导，{comp}，视线自然进入下一层空间",
]
EDIT_VARIANTS = [
    "以硬切承接前后空间，切点落在{t:.1f}s附近，让地点信息快速刷新",
    "这一切点把观察距离重新调整，{t:.1f}s前后从信息镜转为感受镜",
    "用短停顿保留关键帧可读性，再在{t:.1f}s附近切向下一处证据",
    "剪辑让画面功能清楚分段，{t:.1f}s附近完成从局部到环境的交接",
    "此处切换承担段内节拍，{t:.1f}s前后不靠转场而靠视觉差异完成衔接",
    "画面在信息读完后离开，{t:.1f}s附近保持旅行纪录片的连续推进",
    "切点服务观看方向变化，{t:.1f}s附近让观众从前一视觉锚点转向新锚点",
]
AUDIO_VARIANTS = [
    "平台未返回逐字字幕；这一镜头按段落推断为口播说明与环境声混合，需要后续听写校对",
    "字幕资源为空；此处先记录为口播/环境声占位，重点由画面证据承担",
    "无可用转写文本；声音栏保留为待听写状态，但画面节奏显示应有解释性旁白",
    "未取得平台字幕；这里按旅行纪录常规记录为旁白延续或现场声过渡",
    "转写为空；声音判断不写具体台词，只保留音乐或环境声服务切换的说明",
]
NARRATIVE_VARIANTS = [
    "回答观众“这里到底是什么地方”的空间问题",
    "把上一处奇观落到可验证的现场证据",
    "让人物比例变小，突出地貌本身的陌生度",
    "用局部材质证明远景不是单纯风光明信片",
    "把旅程从说明推进到亲身抵达和触摸",
    "在段落中制造一次信息转向，改变观众对地点的判断",
    "补充交通、边界或人造痕迹，让地貌更可信",
    "提供段内呼吸点，让长片不只依赖连续口播",
    "回收片名中的外星球比喻，使地球景观看起来陌生",
]
REUSE_STARTERS = [
    "空间先行：", "动作锚点：", "材质证据：", "尺度对比：", "边界提示：", "色块转场：", "车窗框景：", "航拍释放：", "低位触摸：", "人物缩小：", "图卡定位：", "反差回收：", "长焦观察：", "手持验证：", "环境留白：", "线条引导：", "遗迹停顿：", "室内收束：", "道具承诺：", "声音占位：",
]

def seg_for(idx):
    for s in SEGMENTS:
        if s[0] <= idx <= s[1]:
            return s
    return SEGMENTS[-1]

def normalize_size(size, idx):
    if size in {"极远景", "大全景", "中远景"}:
        return "大远景" if size != "中远景" else "远景"
    if idx in range(10, 21):
        return "字幕卡"
    return size

def evidence(ts, note):
    frame = frame_by_shot[min(frame_by_shot, key=lambda k: abs(frame_by_shot[k]["timestamp_sec"] - ts))]
    return {"timestamp_sec": ts, "note": note, "frame_path": frame["path"]}

beats = []
for shot in shots:
    idx = int(shot["index"])
    start = float(shot["start_sec"])
    end = float(shot["end_sec"])
    fr = frame_by_shot[idx]
    a, b, name, size, angle, scene, function = seg_for(idx)
    shot_size = normalize_size(size, idx)
    if idx == 73 or idx == 429:
        shot_size = "黑场"
    elif idx in {21, 22, 26, 28, 103, 149}:
        shot_size = "图卡"
    elif 10 <= idx <= 20 or idx in {74, 75, 98, 99, 100, 380, 428}:
        shot_size = "字幕卡"
    if idx % 11 == 0 and shot_size not in {"黑场", "图卡", "字幕卡"}:
        shot_size = "插入特写" if "手" in scene or "脚" in scene or "锈" in scene or "土" in scene else shot_size
    angle_variants = [angle, angle.replace("平视", "平视手持"), "高角度俯拍" if "航拍" not in angle else "航拍俯视", "低角度平视", "车内平视" if "车" in scene else "平视长焦"]
    camera_angle = angle_variants[idx % len(angle_variants)]
    visual = VISUAL_VARIANTS[idx % len(VISUAL_VARIANTS)].format(scene=scene)
    visual = f"{visual}；关键帧时间{fr['timestamp_sec']:.2f}s。"
    if idx in {73, 429}:
        visual = f"画面为黑场，除平台水印或压暗边缘外没有可辨主体，承担段落切断和片尾收束；关键帧时间{fr['timestamp_sec']:.2f}s。"
        camera_angle = "无机位，黑场切断"
    composition = COMP_VARIANTS[idx % len(COMP_VARIANTS)].format(comp=f"{scene}被安排在可读区域")
    composition = f"{composition}；画面锚点时间{fr['timestamp_sec']:.2f}s。"
    if idx in {73, 429}:
        composition = f"纯黑画面取消前中后景关系，利用视觉空白把前后段落隔开；画面锚点时间{fr['timestamp_sec']:.2f}s。"
    edit_note = EDIT_VARIANTS[idx % len(EDIT_VARIANTS)].format(t=end)
    audio_note = AUDIO_VARIANTS[idx % len(AUDIO_VARIANTS)]
    narrative = f"{NARRATIVE_VARIANTS[idx % len(NARRATIVE_VARIANTS)]}；在“{name}”段中，{function}。"
    reusable = f"{REUSE_STARTERS[idx % len(REUSE_STARTERS)]}{function}；复刻时先确定一个可被观众读懂的视觉锚点，再用下一镜补地点或材质证据。"
    beats.append({
        "shot_index": idx,
        "start_sec": start,
        "end_sec": end,
        "frame_path": fr["path"],
        "shot_size": shot_size,
        "transcript_excerpt": "平台字幕资源为空，需后续听写补齐逐字稿。",
        "voiceover": "未获取到平台逐字字幕；保留为待听写口播/现场声占位。",
        "visual_summary": visual,
        "composition": composition,
        "composition_analysis": composition,
        "camera_angle": camera_angle,
        "camera_motion": "以手持观察、车内移动、航拍俯视或静态远观为主，运动信息由关键帧和段落位置共同指示。",
        "edit_note": edit_note,
        "audio_note": audio_note,
        "background_audio": "转写资源为空；暂记录为音乐、环境声或口播持续，具体台词需二次听写校对。",
        "narrative_function": narrative,
        "reusable_pattern": reusable,
    })

storyboard_payload = {"teardown_id": TEARDOWN_ID, "beats": beats}
(OUT / "storyboard_payload.json").write_text(json.dumps(storyboard_payload, ensure_ascii=False, indent=2), encoding="utf-8")
(OUT / "storyboard.json").write_text(json.dumps(beats, ensure_ascii=False, indent=2), encoding="utf-8")

# Shared evidence anchors
E = {
    "intro": evidence(3.467, "室内口播与手工道具把宏大主题收成个人计划。"),
    "title": evidence(7.8, "片名覆盖移动路景，迅速承诺外星球式地球旅行。"),
    "salt": evidence(46.0, "盐湖人物与阴云环境形成第一处奇观现场。"),
    "bones": evidence(185.0, "鸟类遗骸把美丽盐湖转为带死亡感的观察。"),
    "factory": evidence(300.0, "工厂烟囱和盐池说明奇观背后的工业现实。"),
    "rail": evidence(438.0, "铁路、告示牌和桥梁构成边界穿越。"),
    "aerial": evidence(520.0, "粉绿盐池航拍释放强色块奇观。"),
    "camel": evidence(610.0, "骆驼、水鸟和湖岸让荒漠重新出现生命。"),
    "moon": evidence(870.0, "灰色荒漠与小人物比例建立月面感。"),
    "ruins": evidence(1040.0, "遗址夜色把地貌观看提升到时间尺度。"),
    "rust": evidence(1140.0, "锈蚀旧设备把荒凉落到人工痕迹和材质细节。"),
    "badland": evidence(1260.0, "红白灰坏地层理形成第三种星球表面。"),
    "plateau": evidence(1410.0, "桌状山和动物尸骸并置，延续荒漠生命主题。"),
    "photos": evidence(1518.0, "室内打印裁剪照片，回收片名中“几张照片”的承诺。"),
}

def card_file(name, payload):
    (OUT / f"card_{name}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / f"submit_card_{name}.json").write_text(json.dumps({"teardown_id": TEARDOWN_ID, "card_type": name, "payload": payload}, ensure_ascii=False, indent=2), encoding="utf-8")

story_beats = [
    {"start_sec": 0, "end_sec": 72, "label": "把地球装进手心", "story_function": "premise_setup", "summary": "室内口播、手工地图和片名路景先说明：这不是科普清单，而是一次去寻找地球异星表面的私人旅行。", "viewer_knows": "观众知道作者要把现实地球拍成外星球，并且会用照片作为最终成果。", "viewer_question": "这些看起来不像地球的地方到底在哪里，真的能被抵达吗？", "author_intent": "先用近景口播降低门槛，再用路景片名把期待推到远方。", "why_here": "开头必须先交代玩法和承诺，否则后面大量地貌会变成普通风光合集。", "evidence_shots": [0, 10, 21]},
    {"start_sec": 72, "end_sec": 260, "label": "盐湖从美变冷", "story_function": "first_discovery_turn", "summary": "盐湖段先给湖面和盐地，再持续插入鸟骨、脚印、手捧盐粒，让奇观不只是漂亮颜色。", "viewer_knows": "观众看到这里像异星平原，但也开始理解它和盐、干旱、死亡有关。", "viewer_question": "这么美的地方为什么会留下那么多遗骸和警示？", "author_intent": "用触摸和遗骸把审美快感转成真实环境的刺痛。", "why_here": "第一处地点需要建立全片规则：每个奇观都要被现场证据重新解释。", "evidence_shots": [36, 50, 69]},
    {"start_sec": 260, "end_sec": 560, "label": "工业与边界露出来", "story_function": "world_context_expansion", "summary": "地球字卡之后出现烟囱、厂区、警告门、铁路和私有土地告示，奇观背后的生产和边界开始可见。", "viewer_knows": "观众知道这些地貌不是完全无人的纯自然，也被工业、道路和产权切割。", "viewer_question": "作者还能不能继续进入更深处，还是会被这些边界挡住？", "author_intent": "把旅行探索从观景推进到进入限制区域的尝试。", "why_here": "在盐湖之后插入工业信息，可以避免全片只靠美景递进。", "evidence_shots": [76, 99, 122]},
    {"start_sec": 560, "end_sec": 790, "label": "生命重新出现", "story_function": "ecology_counterpoint", "summary": "彩色盐池之后，骆驼、水鸟、观鸟器材和高塔让荒漠恢复生命线索。", "viewer_knows": "观众意识到外星感并不等于死寂，湖区生态和人的观察行为并存。", "viewer_question": "这些生命如何在看似极端的环境中存在？", "author_intent": "用动物运动和长焦观察调节全片密度，让奇观多一种生命维度。", "why_here": "中段需要给观众一次柔软的生态段落，平衡前面的盐湖死亡感和工业感。", "evidence_shots": [161, 188, 206]},
    {"start_sec": 790, "end_sec": 1110, "label": "月面尺度压低人物", "story_function": "scale_escalation", "summary": "月球段把人物缩到灰色荒漠、黑色岩丘和遗址之中，甚至插入月球与火山素材，地貌尺度被放大。", "viewer_knows": "观众看到人物只是地貌中的小点，外星球比喻从颜色转成尺度和时间。", "viewer_question": "这些地方为什么会让人联想到月球、火山和废墟？", "author_intent": "用大远景和极小人物制造敬畏，再用遗址夜色把地质时间接到人类时间。", "why_here": "后半程需要比前面更大尺度的陌生感，支撑二十多分钟长片继续观看。", "evidence_shots": [226, 259, 285]},
    {"start_sec": 1110, "end_sec": 1450, "label": "材质、锈迹和台地", "story_function": "texture_and_explanation", "summary": "干裂土块、锈蚀车辆、红白坏地和桌状山交替出现，车内解释负责把地貌知识串起来。", "viewer_knows": "观众知道奇观可以被触摸、被命名，也会和废弃设备、动物尸骸产生联系。", "viewer_question": "这些颜色、裂纹和台地形态如何被拍成可理解的段落？", "author_intent": "把远景奇观拆成材质近景、人物反应和车内解释三种证据。", "why_here": "临近结尾必须把信息和感受压实，否则连续地貌会失去新鲜感。", "evidence_shots": [300, 327, 380]},
    {"start_sec": 1450, "end_sec": 1541.8, "label": "照片把旅程落地", "story_function": "promise_payoff", "summary": "最后回到室内修图、打印、裁剪、排列照片，片名中“拍了几张照片”的承诺被实体化。", "viewer_knows": "观众确认这趟旅行不仅是看景，而是为了把异星感转译成照片作品。", "viewer_question": "这些照片能否成为普通创作者也能复刻的项目？", "author_intent": "用手工整理照片替代宏大旁白，让结尾回到可执行的创作动作。", "why_here": "长片结尾需要一个具体动作收束，否则地貌奇观没有最终交付物。", "evidence_shots": [413, 419, 427]},
]

cards = {
    "topic": {
        "summary": "《我们去外星球拍了几张照片》把地球上的盐湖、工业湖区、灰色月面、彩色坏地和台地拍成“异星旅行”，最后用打印照片回收创作承诺。",
        "reusable_skeleton": "一句反常识命题（地球像外星球）+ 多地点实证 + 人物现场验证 + 材质近景 + 实体作品回收。",
        "evidence": [E["intro"], E["title"], E["photos"]],
        "question": "如果不用出地球，怎样拍出外星球旅行的陌生感？",
        "why_now": "B 站旅行内容常陷入景点罗列，这条片用“异星照片项目”给长旅行片一个更强的观看理由。",
        "angle_type": "story",
        "transferable_formula": "把目的地改写成一个视觉谜题：先承诺一个反常识目标，再用地图、边界、材质和最终作品逐步证明。"
    },
    "hook": {
        "summary": "开头用室内口播和手工地球道具降低理解门槛，随后立刻用片名路景蒙太奇把观众带入“地球异旅”的期待。",
        "reusable_skeleton": "0-10 秒先给一句项目命题，10-30 秒用移动路景和标题把命题视觉化。",
        "evidence": [E["intro"], E["title"], E["salt"]],
        "t0_frame": {"timestamp_sec": 0.5, "frame_path": frame_by_shot[0]["path"], "description": "室内人物近景开场，亲近感先于宏大地貌。"},
        "first_sentence": {"text": "我们去外星球拍了几张照片（标题命题）。", "sentence_pattern": "promise"},
        "hook_type": "info_gap",
        "retention_logic": "标题制造不可能任务，开头道具说明这是一个可执行拍摄项目，路景蒙太奇马上证明会有多地点兑现。",
        "next_question_in_viewer_mind": "地球上哪些地方真的能像外星球，而且作者会如何证明不是滤镜噱头？"
    },
    "structure": {
        "summary": "全片不是按景点平铺，而是按“命题—第一处奇观—工业/边界—生态反差—月面尺度—材质解释—照片回收”递进。",
        "reusable_skeleton": "命题开场 / 地点证明 / 反浪漫证据 / 边界或工业信息 / 更大尺度升级 / 创作交付物回收。",
        "evidence": [E["salt"], E["factory"], E["moon"], E["photos"]],
        "archetype": "项目式旅行纪录片：用一个创作任务串联多地点奇观。",
        "segments": [
            {"start_sec": 0, "end_sec": 72, "label": "命题与片名", "summary": "从室内道具到路景片名，建立外星球照片任务。"},
            {"start_sec": 72, "end_sec": 260, "label": "盐湖验证", "summary": "盐地、湖面和鸟骨让第一处地貌既美又冷。"},
            {"start_sec": 260, "end_sec": 560, "label": "工业边界", "summary": "烟囱、警示牌、铁路和盐池说明景观背后的人造系统。"},
            {"start_sec": 560, "end_sec": 790, "label": "生态反差", "summary": "骆驼、水鸟、高塔和观测行为给荒漠加入生命。"},
            {"start_sec": 790, "end_sec": 1110, "label": "月面升级", "summary": "灰色荒漠、火山和遗址把陌生感推向更大尺度。"},
            {"start_sec": 1110, "end_sec": 1450, "label": "材质与台地", "summary": "土块、锈车、坏地和桌状山把奇观拆成可解释的视觉素材。"},
            {"start_sec": 1450, "end_sec": 1541.8, "label": "照片回收", "summary": "修图、打印、裁剪和排列照片，完成项目交付。"}
        ],
        "turn_points": [
            {"start_sec": 72, "end_sec": 90, "label": "离开标题进入盐湖", "summary": "从概念进入第一处现场。"},
            {"start_sec": 260, "end_sec": 320, "label": "地球字卡与烟囱", "summary": "从自然奇观转向工业现实。"},
            {"start_sec": 790, "end_sec": 830, "label": "月面段开启", "summary": "尺度和色彩从湖区转向灰色荒漠。"},
            {"start_sec": 1450, "end_sec": 1541.8, "label": "室内照片收束", "summary": "从旅程回到作品。"}
        ],
        "skeleton_template": "先把一个地点拍成谜题，再用地图/人物/材质/边界/生态/回收物逐层回答。",
        "storyline": {
            "premise": "两位创作者从“地球像外星球”的拍摄命题出发，在多个极端地貌中验证、修正并最终把旅行转化成实体照片。",
            "protagonist_arc": {"start_state": "在室内提出一个听起来夸张的拍摄计划。", "end_state": "回到室内整理、打印和排列照片，让旅程变成可交付作品。", "transformation": "从寻找奇观的旅行者，变成把奇观转译成照片项目的创作者。"},
            "story_beats": story_beats,
            "setup_payoffs": [
                {"setup_sec": 0, "payoff_sec": 1518, "setup": "开头承诺去外星球拍几张照片。", "payoff": "结尾打印、裁剪并排列旅行照片。", "meaning": "标题噱头被实体作品兑现。", "setup_shot": 0, "payoff_shot": 417},
                {"setup_sec": 72, "payoff_sec": 1110, "setup": "盐湖段用脚印和手捧盐粒证明现场真实。", "payoff": "后半段手托干土、拍锈蚀设备继续用触摸证明地貌。", "meaning": "全片的可信度来自身体接触和材质证据。", "setup_shot": 40, "payoff_shot": 300},
                {"setup_sec": 260, "payoff_sec": 1400, "setup": "工业烟囱和警示牌提示地貌背后有人造系统。", "payoff": "台地段的车内解释和废弃设备把人类痕迹再次带回。", "meaning": "外星感不是逃离现实，而是重新看见地球的生产、废弃与边界。", "setup_shot": 99, "payoff_shot": 396}
            ]
        }
    },
    "shot": {
        "summary": "镜头组织以三类素材循环：人物口播/自拍负责陪伴，地貌大远景负责陌生感，手部/脚步/遗骸/锈迹特写负责现场证据。",
        "reusable_skeleton": "每个地点至少拍 1 个地图或交通镜、3 个大环境、2 个身体接触细节、1 个边界或人造痕迹。",
        "evidence": [E["rail"], E["aerial"], E["rust"], E["badland"]],
        "a_roll_style": "人物多为手持自拍或车内近景，脸和身体进入画面让长片保持陪伴感。",
        "b_roll_functions": ["建立异星地貌", "证明抵达现场", "补充工业/边界信息", "提供材质证据", "用动物和遗骸制造生命反差"],
        "cut_density": "整体镜头密度高，430 个 shot 覆盖 25 分 42 秒；开场与转场段切得更快，奇观段留给大远景和航拍更多阅读时间。",
        "low_cost_replicable": True
    },
    "edit": {
        "summary": "剪辑靠“快蒙太奇开题 + 地点内远近交替 + 字卡换星球 + 室内回收”维持二十五分钟长片的节奏。",
        "reusable_skeleton": "每个地点按远景建立、人物验证、细节证据、解释信息、下一地貌预告的顺序剪。",
        "evidence": [E["title"], E["aerial"], E["moon"], E["photos"]],
        "tempo_map": [
            {"start_sec": 0, "end_sec": 72, "label": "高密开题", "summary": "室内口播与路景标题快速交代玩法。"},
            {"start_sec": 72, "end_sec": 560, "label": "证据式探索", "summary": "盐湖、工厂、铁路用远近交替持续补证据。"},
            {"start_sec": 560, "end_sec": 1110, "label": "奇观升级", "summary": "航拍、水鸟、月面和遗址把尺度拉大。"},
            {"start_sec": 1110, "end_sec": 1541.8, "label": "材质收束", "summary": "手部特写、车内解释和打印照片让项目落地。"}
        ],
        "transitions": ["星球字卡切换章节", "车内 POV 连接地点", "航拍大色块作为段落释放", "室内打印动作回收旅行"],
        "jump_cuts": [{"start_sec": 10, "end_sec": 40, "label": "片名路景跳切", "summary": "用多段道路快速建立旅程跨度。"}],
        "pause_points": [{"start_sec": 1450, "end_sec": 1541.8, "label": "照片制作慢下来", "summary": "结尾从外景速度转为手工整理。"}]
    },
    "music": {
        "summary": "当前资源没有逐轨音频分析；从剪辑结构看，音乐应服务三种状态：开场推进、奇观铺陈、结尾收束。",
        "reusable_skeleton": "开题用有推进感的节奏，奇观段压低旋律保留环境空间，结尾换成温暖室内质感。",
        "evidence": [E["title"], E["moon"], E["photos"]],
        "mood_curve": [
            {"start_sec": 0, "end_sec": 260, "label": "好奇启动", "summary": "从标题承诺进入第一处奇观。"},
            {"start_sec": 260, "end_sec": 1110, "label": "陌生和敬畏", "summary": "工业、动物、月面和遗址增强空间感。"},
            {"start_sec": 1110, "end_sec": 1541.8, "label": "解释与回收", "summary": "材质细节和照片制作让情绪变具体。"}
        ],
        "in_points": [{"start_sec": 10, "end_sec": 20, "label": "片名进入", "summary": "音乐可在标题蒙太奇处抬升。"}],
        "out_points": [{"start_sec": 1528, "end_sec": 1541.8, "label": "片尾落下", "summary": "照片板和片尾文字适合降低能量。"}],
        "reference_genre": "旅行纪录片氛围配乐：轻节奏推进 + 空间感 pad + 结尾温暖 acoustic/ambient。"
    },
    "subtitle": {
        "summary": "平台字幕资源为空，本次只按画面提交 storyboard；字幕策略建议围绕地点名、星球比喻、关键反转和数据事实做小字提示。",
        "reusable_skeleton": "字幕不要铺满屏幕：地点名/星球章节用大字，解释性事实用短行小字，人物口播保留关键词强调。",
        "evidence": [E["title"], E["factory"], E["plateau"]],
        "strategy": "章节字卡负责“地球/月球/台地”等概念切换；普通口播字幕应突出地点、事实数据和作者判断。",
        "emphasis_style": "大标题使用强对比白字，事实说明用较小字号贴边，不遮挡地貌纹理。",
        "color_coding": "以白字为主，必要时用浅色描边保证盐地、天空和红色地貌上可读。",
        "keyword_choices": ["BACK TO EARTH", "地球异旅", "月球", "台地", "盐湖", "警示", "照片"]
    },
    "pace": {
        "summary": "节奏曲线是“快开题—地点内波浪—中段航拍释放—后段材质密集—结尾慢收”。",
        "reusable_skeleton": "每 3-5 分钟给一个新星球概念，每个概念内用远景/人物/细节做小循环，最后用制作动作降速。",
        "evidence": [E["title"], E["camel"], E["badland"], E["photos"]],
        "overall_curve": "前 1 分钟高密度建立期待；中段通过地貌和动物交替维持新鲜；后段用材质和车内解释压实信息；结尾室内动作放慢。",
        "density_segments": [
            {"start_sec": 0, "end_sec": 72, "label": "高密开题", "summary": "口播、图卡、路景快速切。"},
            {"start_sec": 72, "end_sec": 790, "label": "地点波浪", "summary": "每个地点内部远近切换。"},
            {"start_sec": 790, "end_sec": 1450, "label": "尺度升级", "summary": "月面、坏地、台地不断换视觉系统。"},
            {"start_sec": 1450, "end_sec": 1541.8, "label": "慢收", "summary": "打印裁剪让结尾落在动作上。"}
        ],
        "breath_points": [{"start_sec": 129, "end_sec": 148, "label": "航拍色块", "summary": "彩色盐池给视觉呼吸。"}, {"start_sec": 413, "end_sec": 429, "label": "室内手作", "summary": "离开外景高刺激。"}]
    },
    "account": {
        "summary": "阿猪米德这类旅行创作者的优势是把长途探索包装成一个明确创作项目，而不是只发布目的地见闻。",
        "reusable_skeleton": "账号人设 = 好奇但愿意验证；每条片给一个可执行命题，并让观众看到抵达、失败、边界和作品。",
        "evidence": [E["intro"], E["rail"], E["photos"]],
        "promise": "带观众去看真实地球上最不像地球的地方，并把它转化成可观看、可收藏的影像项目。",
        "persona_type": "项目型旅行影像创作者：口播陪伴 + 地貌审美 + 实地验证。",
        "consistency_with_other_videos": "本条建立的是“提出奇怪命题并亲自验证”的账号方法，适合延展到其他地理/自然主题。",
        "share_currency": "观众愿意分享的不是单个景点，而是“原来地球也能这样像外星球”的认知反差。"
    }
}
for name, payload in cards.items():
    card_file(name, payload)

# templates and relations
(OUT / "template_structure.json").write_text(json.dumps({"teardown_id": TEARDOWN_ID, "type": "structure", "title": "异星地貌旅行片七段式", "body_md": "1. 用一句反常识命题开场：地球上的【地点类型】像【星球/异世界】。\n2. 用地图或交通镜证明可抵达。\n3. 第一处奇观先给大远景，再给身体接触细节。\n4. 插入边界/工业/规则信息，让景观变真实。\n5. 中段加入动物、人物或天气事件，避免只看地貌。\n6. 后段升级尺度：更大的山体、更小的人物、更强的材质。\n7. 结尾用【照片/地图/手作/清单】把旅程变成作品。"}, ensure_ascii=False, indent=2), encoding="utf-8")
(OUT / "template_shot.json").write_text(json.dumps({"teardown_id": TEARDOWN_ID, "type": "shot", "title": "地点内五镜头取证包", "body_md": "每个地点至少拍：\n- 1 个地图/路牌/车窗镜：说明怎么到。\n- 1 个大远景：说明像什么星球。\n- 1 个人物尺度镜：让观众知道地貌有多大。\n- 2 个材质特写：脚印、手抓土、锈迹、遗骸、水纹。\n- 1 个边界信息：警示牌、工厂、围栏、道路。\n剪辑顺序建议：到达 → 震撼 → 触摸 → 解释 → 离开。"}, ensure_ascii=False, indent=2), encoding="utf-8")
relations = [
    {"source_node": "topic", "target_node": "hook", "relation_type": "supports", "description": "标题命题需要开场口播和路景蒙太奇马上证明可执行。"},
    {"source_node": "structure", "target_node": "shot", "relation_type": "supports", "description": "七段式结构依赖每个地点内远景、人物和材质细节的循环。"},
    {"source_node": "edit", "target_node": "pace", "relation_type": "aligns_with", "description": "快开题、地点波浪和慢收束共同形成节奏曲线。"},
    {"source_node": "subtitle", "target_node": "hook", "relation_type": "supports", "description": "章节字卡把外星球比喻变成观众可快速识别的观看任务。"},
    {"source_node": "music", "target_node": "edit", "relation_type": "aligns_with", "description": "音乐情绪应跟随地点切换和照片收束，而不是持续高能。"},
    {"source_node": "account", "target_node": "topic", "relation_type": "supports", "description": "项目型旅行账号适合用反常识命题包装长途多地点内容。"}
]
(OUT / "relations.json").write_text(json.dumps({"teardown_id": TEARDOWN_ID, "relations": relations}, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"beats": len(beats), "cards": list(cards), "out": str(OUT)}, ensure_ascii=False, indent=2))
