#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

def submit_card(teardown_id, card_type, payload):
    url = f"http://localhost:3030/api/teardowns/{teardown_id}/cards/{card_type}"
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='PUT'
    )
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if res_data.get('ok'):
                print(f"Successfully submitted card: {card_type}")
                return True
            else:
                print(f"Error submitting card {card_type}: {res_data}")
                return False
    except urllib.error.HTTPError as e:
        print(f"HTTP Error submitting card {card_type}: {e.code} - {e.read().decode('utf-8')}")
        return False
    except Exception as e:
        print(f"Error submitting card {card_type}: {e}")
        return False

def main():
    teardown_id = "td_01KTGN34Y7XNXZRT20VMZP7FAX"
    sample_id = "smp_01KTGMWK2EFRTF3VCX2QY0H622"
    
    # 1. Topic Card
    topic_card = {
        "summary": "妻子不在家的5天里，主角通过亲手制作户外装备墙、重新组搭高质感数码桌面，以及摆满怀旧中古玩具，在享受绝对专注的独居生活后，迎来温馨的妻子回归收尾的日常治愈拉片纪实视频。",
        "reusable_skeleton": "独居限制性假设设定 → 硬核手作释放玩心 → 极简硬件提升格调 → 中古潮玩折射童趣 → 伴侣回归将情绪温柔收拢归于现实生活。",
        "transferable_formula": "给一个时间约束的假设 → 露营手工工具化展现 → 极简黑胡桃桌搭视觉享受 → 中古发条玩具温润解压 → 双人晚餐温馨落幕。",
        "question": "如何将一次日常化的桌面和书桌升级过程，拍成关于‘秘密基地’搭建、自我专注整合与亲密关系流淌的高级感生活纪录片？",
        "why_now": "当代都市人在繁忙的工作与繁琐的亲密关系中，渴望有一块只属于自己、能完全释放个人天性的‘秘密角落’（即秘密基地），片子的桌搭极其治愈地击中了这一情绪点。",
        "angle_type": "personal",
        "evidence": [
            {"timestamp_sec": 10.5, "note": "妻子的拉杆箱带走日常热闹，拉开5天独居大幕。"},
            {"timestamp_sec": 320.3, "note": "电钻打孔和配件挂壁，完成了户外露营装备墙的硬件秩序收纳。"},
            {"timestamp_sec": 620.5, "note": "工作室灯亮屏显，极简黑胡桃木在镜头下散发出安静、工业质感十足的治愈格调。"},
            {"timestamp_sec": 1080.2, "note": "餐桌上两副餐具和热气腾腾的晚饭，完美宣告独居落幕，秘密基地回归共同家园。"}
        ]
    }
    
    # 2. Hook Card
    hook_card = {
        "summary": "开头极度生活化，以‘结婚6年没有独居过的夫妻’建立反向探索的心理锚点，配以行李箱、空房和主角与智能扫地机的呆萌互动让观众产生窥视独居的好奇心。",
        "retention_logic": "通过温和的文字假设和微弱的主角动作建立起‘今天他到底要干什么’的信息留白，从而极高地提升前30秒留存率。",
        "next_question_in_viewer_mind": "在属于主角独自支配的五天时间里，他会将这个原本一成不变的工作生活空间折腾出怎样的奇妙大变样？",
        "reusable_skeleton": "大门透光行李离家 → 温和旁白给出时间限定 → 起床小动作与空屋相处 → 主角与家居智能的可爱相处建立陪伴趣味。",
        "t0_frame": {
            "timestamp_sec": 0.434,
            "description": "暖色调玄关大门透出一缕金黄，深色行李箱被轻轻拉出，门板的明暗切割极为舒适。",
            "frame_path": f"samples/{sample_id}/resources/frames/shot_000_t0.434s.jpg"
        },
        "first_sentence": {
            "text": "结婚6年，两个在家工作的人，好像没有什么特别的机会可以体验独居。",
            "sentence_pattern": "scene_immersion"
        },
        "hook_type": "info_gap",
        "evidence": [
            {"timestamp_sec": 15.6, "note": "大门关上的清脆现场音，瞬间将空气中的安静和主角独处的仪式感拉满。"},
            {"timestamp_sec": 50.8, "note": "智能扫地机器人闪烁着灯光在地板上滑行，主角伸手触碰，展现了一丝寂寞但治愈的科技生活感。"}
        ]
    }
    
    # 3. Structure Card
    structure_card = {
        "summary": "整片采用‘五天独居’的时间线结构，将三个相对独立的桌面手作升级任务（装备墙、工作室桌搭、玩具店书桌）层层递进地展开，最终借由妻子的回归暖融融地闭合结构。",
        "archetype": "时间倒计时线 + 手作整理 + 书桌桌搭升级 + 中古收藏展示 + 温馨生活流收尾。",
        "skeleton_template": "第一天开篇设定约束 → 第二天露营装备上壁 → 第三天极简工作室理线 → 第四天中古玩具上桌注入温润 → 第五天伴侣回家生活回归。",
        "segments": [
            {"start_sec": 0, "end_sec": 240, "label": "独居开启与AI陪伴", "summary": "妻子出门主角开始独处，通过扫地机、冲咖啡等动作快速交代独居首日的冷清与怡然自得。"},
            {"start_sec": 240, "end_sec": 480, "label": "手工户外装备墙", "summary": "主角拿出电钻在实木板上定位开孔，打造一整面极具秩序美的户外装备洞洞板展示墙。"},
            {"start_sec": 480, "end_sec": 750, "label": "极简升降桌搭重组", "summary": "升级黑胡桃木升降桌，安装铝合金支架台灯并完美理顺桌面线缆，追求科技桌面的极简美学。"},
            {"start_sec": 750, "end_sec": 980, "label": "童趣中古玩具桌面", "summary": "在层架和桌面上摆满斑驳锈迹的铁皮玩具，上紧发条，让古朴的书桌闪烁着童真梦幻的旧物色彩。"},
            {"start_sec": 980, "end_sec": 1101, "label": "温润落幕妻子回归", "summary": "妻子推着箱子进门，两人并坐在新升级好的秘密基地里，温馨交谈，影片在暖色灯光和丰盛晚餐中治愈落幕。"}
        ],
        "turn_points": [
            {"start_sec": 240, "end_sec": 240, "label": "拿出电钻和卷尺开始工作", "summary": "主角拿出电钻和卷尺，影片从第一天的悠闲生活状态转换到热火朝天的手工改造状态。"},
            {"start_sec": 480, "end_sec": 480, "label": "新胡桃木桌板送达组装", "summary": "黑胡桃木桌板到位，主角开始对主工作书桌进行高质感的桌搭物理改造和极其舒适的极简走线。"},
            {"start_sec": 750, "end_sec": 750, "label": "上发条的青蛙开始在桌上弹跳", "summary": "主角拿出发条玩具，冷淡科技的工作空间瞬间充满了五彩斑斓的童真旧物格调。"},
            {"start_sec": 980, "end_sec": 980, "label": "门口箱子轮轴声响起", "summary": "门口传来妻子推箱子的清脆轴轮声，预示着五天基地时光即将落幕，故事回归温馨双人生活。"}
        ],
        "storyline": {
            "premise": "当结婚六年的妻子离家五天，在家的全职创作者将生活空间逐一改造成承载露营、数码、中古旧物等绝对天性的‘秘密基地’，实现了一次与自己和爱好的深度专注整合。",
            "protagonist_arc": {
                "start_state": "人物处于一成不变的双人居家工作状态中，缺乏一个绝对自我释放、专注独处的空间和时间契机。",
                "end_state": "人物在一系列扎实解压的动手改造中，不仅获得了高美学的工作空间，还通过自我天性的释放重新充盈了内心情感。",
                "transformation": "从‘寻找一个逃避繁琐的物理基地’转向‘用极具美感的自我空间重新富养并热爱两人的共同生活’。"
            },
            "story_beats": [
                {
                    "start_sec": 0,
                    "end_sec": 240,
                    "label": "时间设定与空间空旷",
                    "story_function": "setup",
                    "viewer_knows": "主角将独自在家待五天，他与智能扫地机进行可爱对话，喝着热咖啡，享受这平静的生活。",
                    "viewer_question": "在这个没有妻子陪伴的寂静客厅里，主角会在第一天干些什么来打发时间？",
                    "author_intent": "通过轻Lo-Fi、大空间和清冷的光线建立生活流的缓慢节奏，拉近与观众的生活感受。",
                    "why_here": "开端必须交代空间和规则（五天期限），让后面的折腾具备坚实的时间边界和行为合理性。",
                    "evidence_shots": [5, 12, 28]
                },
                {
                    "start_sec": 240,
                    "end_sec": 480,
                    "label": "硬核工具改造装备墙",
                    "story_function": "execution",
                    "viewer_knows": "观众看到卷尺、木工铅笔、高速旋转的电钻在实木板上打眼，各种露营配件被一个个分类挂上装备墙。",
                    "viewer_question": "这面装备洞洞墙最终挂满后，会是什么样高质感的画面？",
                    "author_intent": "通过微距特写、木屑飞溅 and 现场工具刺耳的环境声，展现手作的物理力量感和理所当然的成就感。",
                    "why_here": "用硬核的手工开眼，打消前期的沉闷，为秘密基地定下高动手能力、极其极客的物理底色。",
                    "evidence_shots": [130, 142, 175]
                },
                {
                    "start_sec": 480,
                    "end_sec": 750,
                    "label": "黑胡桃书桌搭建与理线",
                    "story_function": "proof_of_work",
                    "viewer_knows": "观众看到升降桌升起，显示器支架定位，长臂台灯合围出核心办公区，各种扎线管将线缆理得工工整整。",
                    "viewer_question": "这个新工作台点亮后，会是什么高级极简的视觉震撼？",
                    "author_intent": "用黑胡桃木纹和金属支架的斜打逆光，渲染工作室高级、理性的冷感和秩序美。",
                    "why_here": "在露营墙完工后，立刻转向每日相处的电脑书桌，从户外兴趣完美过渡到理性创作的硬核主场。",
                    "evidence_shots": [262, 290, 312]
                },
                {
                    "start_sec": 750,
                    "end_sec": 980,
                    "label": "中古玩具店与大男孩童心",
                    "story_function": "desire_expansion",
                    "viewer_knows": "观众看到一排排色彩斑斓的铁皮发条公仔，古旧打字机的敲击，在暖光百叶窗下充满旧物怀旧感。",
                    "viewer_question": "在这些古朴可爱的旧物玩具被彻底摆满后，书桌是否会打破科技冷感，变得富有童趣？",
                    "author_intent": "用极高饱和度的暖色拼接构图，展现人物心中隐藏的大男孩浪漫，形成强烈的色彩冲击和情感共鸣。",
                    "why_here": "极简工作室过于硬朗理性，在临近尾声时注入彩色潮玩和温润发条玩具，是对人物灵魂深处纯真童心的暖色回归。",
                    "evidence_shots": [386, 422, 458]
                },
                {
                    "start_sec": 980,
                    "end_sec": 1101,
                    "label": "妻子回归与家园的圆满",
                    "story_function": "resolution",
                    "viewer_knows": "观众听到门锁转动声、行李箱轮毂声，妻子推门走入玄关，和主角并坐在新升级的基地里亲密倾听交谈。",
                    "viewer_question": "独居生活的结束，是意味着秘密基地的被收编，还是家庭温情重构的起点？",
                    "author_intent": "用温暖玄关走廊逆光和两人温馨的晚餐画面，将片子升华为夫妻间包容彼此空间、又渴望紧密连接的亲密大方向。",
                    "why_here": "最后的回归是生活本身的必然归宿，也是影片传递的成熟亲密关系价值观：独处的专注让我们在重聚时更爱彼此。",
                    "evidence_shots": [510, 532, 560]
                }
            ],
            "setup_payoffs": [
                {
                    "setup_sec": 10.5,
                    "payoff_sec": 985.2,
                    "setup_shot": 12,
                    "payoff_shot": 510,
                    "setup": "大门透光，行李箱带走妻子的身影，留下极其冷清但自由的倒数5天大幕。",
                    "payoff": "大门再次推开，妻子拉着箱子重新进入玄关，玄关在斜照余晖下显得格外温暖。",
                    "meaning": "独居的界限开始和收束都落在大门的推开与行李上，完成物理和情绪的双向闭合结构。"
                },
                {
                    "setup_sec": 255.4,
                    "payoff_sec": 380.2,
                    "setup_shot": 130,
                    "payoff_shot": 175,
                    "setup": "电钻旋转打出的实木木屑飞溅，主角认真用卷尺在板材上划线测量定位。",
                    "payoff": "整面挂钩锁扣和露营手冲壶稳稳贴在墙体上，被主角在微仰视角下得意地拿手机快门记录。",
                    "meaning": "硬核、吃力打孔测量的工作步骤，最终收获了一面被秩序和爱好完美填满的物理露营艺术墙。"
                },
                {
                    "setup_sec": 490.8,
                    "payoff_sec": 650.5,
                    "setup_shot": 262,
                    "payoff_shot": 312,
                    "setup": "显示器、拓展坞和升降机架等一堆数码配件冰冷、略显凌乱地横在工作台上。",
                    "payoff": "极简升降桌板平顺地升起，极佳的灯光打亮了整张干净、极客理线堪称典范的工作桌面核心办公区。",
                    "meaning": "凌乱繁琐的外设组装和理线过程，被最终完美的点亮桌面所兑现，代表一个高效专注创作状态的开启。"
                }
            ]
        },
        "reusable_skeleton": "用5步倒计时改造结构复刻：独居设限假设起篇 → 硬核兴趣整理打底 → 极简生产力桌面重组 → 中古旧物旧物温暖注入 → 伴侣回家烟火晚餐治愈落幕。",
        "evidence": [
            {"timestamp_sec": 12.5, "note": "行李箱轮毂离家定义独居时间起点。"},
            {"timestamp_sec": 280.2, "note": "高速运转的电钻特写推动手工装备墙的实质动作。"},
            {"timestamp_sec": 850.4, "note": "旋转中古发条玩具拧劲儿，带出童趣桌面改造高潮。"}
        ]
    }
    
    # 4. Shot Card
    shot_card = {
        "summary": "镜头运动极其舒缓，以带有呼吸感的手持摄影机位为主，通过精准、极窄焦深的特写景别，将工具、木屑、手指和潮玩材质放大，拍出了浓郁的生活纹理和情绪质感。",
        "reusable_skeleton": "对角线焦点平移 + 暖色窗影侧逆光 + 工具动作中景到微距特写，建立充满物理温度与呼吸格调的情绪细节B-roll。",
        "a_roll_style": "手持手微晃为主，镜头高度贴近人物，通过焦点浅层平移，捕捉呼吸感下的微小空间改变。",
        "b_roll_functions": [
            "工具打孔定位特写用来交代硬核改造实操的每一个解压步骤，让观众信任方案的真实感。",
            "百叶窗漏光的中古玩具大特写用来刻画旧物上的斑驳漆色和岁月，注入童话和怀旧情绪色彩。",
            "双人交谈的中景逆光镜头用来烘托温馨、舒畅的亲密关系，带给观众强烈的生活幸福感。"
        ],
        "cut_density": "整体保持舒缓的生活流节奏。但理线与打孔改装段落，镜头切分极其细致，剪辑节奏密集高频卡在音乐打击乐的重拍上（均长1.2-1.6秒/镜），具有极强的治愈舒爽律动。",
        "low_cost_replicable": True,
        "evidence": [
            {"timestamp_sec": 260.4, "note": "低俯视角中电钻的金属反光在焦点上虚化，镜头带有极其自然的手持呼吸晃动。"},
            {"timestamp_sec": 790.8, "note": "彩色亚克力在百叶窗横斜光线照射下，微距特写凸显了晶莹剔透的光影折射层次。"}
        ]
    }
    
    # 5. Edit Card
    edit_card = {
        "summary": "剪辑技巧非常克制，避免炫酷的技术性包装，而着重于‘现场声卡点’、‘视线平顺转场’和‘动作物理惯性拼接’，极大地烘托了纪实日记的自然感，并让理线摆件等琐碎场景极其顺理成章、行云流水。",
        "reusable_skeleton": "中景空屏过渡 → 手部工具特写跳切步骤 → 卡环境声重拍硬切出改造成果 → 长镜头安静空镜收拢情绪节奏。",
        "tempo_map": [
            {"start_sec": 0, "end_sec": 240, "label": "日常松慢节奏", "summary": "均长4-6秒/镜，建立冷清舒适的独居日记感。"},
            {"start_sec": 240, "end_sec": 750, "label": "手作桌搭密集重拍卡点", "summary": "剪辑时间显著变快，均长1.2-1.8秒/镜，且紧卡在Lo-Fi背景配乐的打击卡点上，律动感极好。"},
            {"start_sec": 750, "end_sec": 980, "label": "中古怀旧跳切高潮", "summary": "均长1.0秒/镜左右的极其利落、连贯的高频快切，将满屋的发条青蛙、打字机和雪花电视拼接，视觉冲击力十足。"},
            {"start_sec": 980, "end_sec": 1101, "label": "温馨回归舒缓空屏", "summary": "重回5.5-7.5秒的大定焦长镜头，配合晚餐的热气腾腾，让温暖的情绪自然溢出。"}
        ],
        "transitions": [
            "动作运动匹配切：前镜手拧发条玩具向右用力，切至后镜发条青蛙朝右蹦跳起步，利用运动惯性无缝拼接。",
            "光线对比切转场：第四天微亮的工作室书桌瞬间切到第五天落日余晖下大面积金黄的客厅木地板，靠色彩冷暖更替交代时间更迭。",
            "现场环境声声桥：妻子行李箱滑轮轴的滚动声提前2帧响起，画面后切到妻子推门进玄关，听觉线索拉开视觉新帷幕。"
        ],
        "jump_cuts": [
            {"start_sec": 500, "end_sec": 600, "label": "数码升级理线跃进", "summary": "理线过程中，显示器背后线缆从‘一把凌乱’到‘逐步捆扎’再到‘顺直藏匿’采用多个特写画面的利落跳切，省去冗余动作，显得极其爽快和理所当然。"}
        ],
        "pause_points": [
            {"start_sec": 238, "end_sec": 240, "label": "章节更替黑屏过渡", "summary": "每一天的早晨倒计时日期卡片展现前，画面都会出现2秒左右相对安静、平稳甚至接近凝固的静止空镜，作为呼吸顿挫点，帮助观众重新调整情绪节奏。"}
        ],
        "evidence": [
            {"timestamp_sec": 510.3, "note": "键盘电源插线口的金属撞击现场声作为音效，完美卡点剪入下一桌面的全景画面。"},
            {"timestamp_sec": 995.4, "note": "行李轮轱辘的滚动声作为标志性声桥，顺理成章地带出妻子回归的温暖玄关远景。"}
        ]
    }
    
    # 6. Music Card
    music_card = {
        "summary": "配乐是片子治愈格调的灵魂，选用舒缓轻盈、带有节奏感的Lo-Fi电子，混入温暖柔和的日常爵士钢琴，最终在中古玩偶出场时引入清亮悠扬的八音盒怀旧小调，整体声场极富情感张力和层次感。",
        "reusable_skeleton": "关门声卡低频Lo-Fi开启 → 手工电钻打击鼓乐烘托专注 → 发条脆音接入怀旧八音盒 → 进门轮轴音淡出，温润弦乐引向大结局晚餐。",
        "reference_genre": "Lo-Fi Beats、温暖日常爵士（Mellow Jazz Piano）、怀旧机械八音盒（Antique Music Box）。",
        "mood_curve": [
            {"start_sec": 0, "end_sec": 240, "label": "松弛轻盈 (情绪40%)", "summary": "静谧松弛的Lo-Fi电子律动，烘托出独处的平静舒畅。"},
            {"start_sec": 240, "end_sec": 480, "label": "硬朗打击鼓点 (情绪60%)", "summary": "手工打孔改装时加入节奏沉稳清脆的打击乐，伴随电钻的低沉振动非常专注。"},
            {"start_sec": 480, "end_sec": 750, "label": "极简理性钢琴 (情绪55%)", "summary": "极简工作室理线是专注理性的轻柔钢琴。"},
            {"start_sec": 750, "end_sec": 980, "label": "童真八音盒变奏 (情绪75%)", "summary": "中古玩具出场时变为彩色、满溢童真幻想的八音盒。"},
            {"start_sec": 980, "end_sec": 1101, "label": "温暖大提琴弦乐 (情绪85%)", "summary": "迎来妻子进门时变奏为柔美的大提琴与弦乐合奏，将整支视频推向最温馨的港湾大高潮。"}
        ],
        "in_points": [
            {"start_sec": 12.5, "end_sec": 15.6, "label": "Lo-Fi低音引入", "summary": "在大门关上的一瞬间，Lo-Fi电子乐低频鼓点准时、极其温柔地在空旷房间里响起，渲染独居自由和宁静。"},
            {"start_sec": 760.3, "end_sec": 765.8, "label": "童真八音盒清脆切入", "summary": "主角手指触碰拧紧发条钥匙的一瞬间，叮咚作响的清脆机械八音盒音乐欢快地切入声场。"}
        ],
        "out_points": [
            {"start_sec": 235.4, "end_sec": 240, "label": "Lo-Fi平滑淡出", "summary": "第一天独居尾声，配乐旋律在主角整理完桌面物品、画面拉到落地窗外的夜色中时，温柔淡出。"},
            {"start_sec": 980.2, "end_sec": 985.2, "label": "八音盒玩具音乐抽离", "summary": "箱子轮轴声在大门口响起，欢快的中古配乐淡出，现场的门口开锁环境声在安静中被温柔托起。"}
        ],
        "evidence": [
            {"timestamp_sec": 15.6, "note": "大门关闭，Lo-Fi背景配乐像是一层温暖的毛毯，悄然盖住了空屋里的寂静。"},
            {"timestamp_sec": 765.8, "note": "八音盒清亮苏雅的水晶音色一进入，原本冷静硬朗的书桌瞬间散发出中古童话店般的斑斓梦幻。"}
        ]
    }
    
    # 7. Subtitle Card
    subtitle_card = {
        "summary": "字幕不采用烂俗的综艺花字，而采用极其质感、纤细的简体中文字，仅在每一天日期的交替时，使用全屏黑色背景和工整的白色手写艺术日期字卡，起到高品位的日记章节分割效果。",
        "reusable_skeleton": "画面中心极简半透明字幕 + 内心搞笑弹幕微调磨砂黄 + 全屏手写连笔黑卡进行日期章节大更迭。",
        "strategy": "全片文字量极少，不靠密集的口播和无聊台词驱动，而完全让字幕作为人物内心的碎碎念（如‘不是我说的，是S说的’），极大地增加了片子的幽默感和人格温度。 字幕在画面下三分线正中央，字体偏纤细、半透明，具有极高的小清新电影日记风。",
        "keyword_choices": [
            "‘秘密基地’使用温暖柔黄色的字体和轻微放大，突出这四个字承载的情绪重量。",
            "‘独居日常’使用淡淡的浅灰底色方框，给人一种整齐、有仪式感的日记手账质感。",
            "‘come back’在片子尾声悄然亮起并呈斜角，具有极佳的视觉平衡和亲密温暖感。"
        ],
        "color_coding": "普通旁白字幕为纯白（#FFFFFF）搭配20%半透明黑色超窄描边。内心调侃性的碎碎念字幕使用淡淡的磨砂黄（#FFF3A1），形成轻松诙谐、毫无压迫感的主配角文字对话。",
        "emphasis_style": "艺术全屏日期字卡（例如：‘Day 1 一个人怎么开心起来呢’）使用大字号、带有手写温度的英文手绘连笔，居中呈现，配合2秒黑场，极具大片高级章节感。",
        "evidence": [
            {"timestamp_sec": 5.8, "note": "黑色底卡上显现出纤细手写体：‘Day 1 欢迎来到我的独居日常’，极佳地起到了Vlog章节引领的作用。"},
            {"timestamp_sec": 41.2, "note": "主角逗弄扫地机器人，字幕打出淡黄色内心活动：‘（不怎么聪明，但他确实在陪我）’，引人会心一笑。"}
        ]
    }
    
    # 8. Pace Card
    pace_card = {
        "summary": "全片节奏极具张弛之道。手工制造、升降桌搭理线和玩具蹦跳呈现出均长1.5秒左右的短镜头强密度爆发；而首尾早晚、冲泡咖啡、妻子回归等场景则刻意保留了5秒以上的长镜头和温暖空屏，做到了极佳的生活呼吸感和情绪舒缓。",
        "reusable_skeleton": "舒缓日常长定焦 → 专注工作密集鼓点卡点短镜硬切 → 特写高潮色彩玩具连环跳切 → 伴侣相伴定焦大长镜呼吸顿挫收束。",
        "overall_curve": "全片情绪曲线呈现平稳上升后温馨合拢的‘山形’。开头松弛，手工和桌搭高强度操作让画面镜头切分极其细密，剪辑节奏密集高频卡在音乐打击乐的重拍上，到中古玩具弹跳时达到全片色彩和物理动感的高潮，妻子回家时画面镜头重新被温柔拉长放慢，在安静和晚餐白噪音中完成大合拢收束。",
        "density_segments": [
            {"start_sec": 255.4, "end_sec": 380.2, "label": "装备墙搭建高频剪辑", "summary": "镜头紧密卡在Lo-Fi鼓点上，电钻、起子、挂钩、手壶在1分多钟内切换近35个镜，产生极度解压的工具装配快感。"},
            {"start_sec": 840.5, "end_sec": 920.4, "label": "中古玩具运转密集卡点", "summary": "铁皮青蛙蹦跳、打字机敲击、小车轮子滑动、彩色电视机雪花，20个镜头在短短30秒内利落跳切，形成视觉高饱和高频率爆点。"}
        ],
        "breath_points": [
            {"start_sec": 45.5, "end_sec": 53.5, "label": "沙发伸懒腰固定镜头", "summary": "8秒长定焦，配乐低频空荡，让前期的行李离别悬念得到极其舒服的情绪沉淀。"},
            {"start_sec": 650.2, "end_sec": 656.7, "label": "黑胡桃木升降桌面亮起", "summary": "镜头保持静止观察长达6.5秒，给观众留出充裕的惊叹和视觉满足时间。"},
            {"start_sec": 1090.4, "end_sec": 1100.4, "label": "沙发对笑及晚餐热蒸汽", "summary": "晚餐长定焦镜头，大提琴背景乐余音缭绕，在安静中让治愈的温馨缓缓溢出屏幕。"}
        ],
        "evidence": [
            {"timestamp_sec": 320.5, "note": "装备墙挂钩的密集卡点快剪极具工业爽快感，节奏极其硬朗鲜明。"},
            {"timestamp_sec": 1095.5, "note": "晚餐桌上热蒸汽升腾的长达10秒固定镜头，完美提供了治愈人心的生活留白呼吸。"}
        ]
    }
    
    # List of cards to submit
    cards = [
        ("topic", topic_card),
        ("hook", hook_card),
        ("structure", structure_card),
        ("shot", shot_card),
        ("edit", edit_card),
        ("music", music_card),
        ("subtitle", subtitle_card),
        ("pace", pace_card)
    ]
    
    for c_type, payload in cards:
        submit_card(teardown_id, c_type, payload)
        
if __name__ == "__main__":
    main()
