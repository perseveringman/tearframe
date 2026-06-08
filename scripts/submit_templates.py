#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

def submit_template(teardown_id, payload):
    url = f"http://localhost:3030/api/teardowns/{teardown_id}/templates"
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if res_data.get('ok'):
                print(f"Successfully submitted template: {payload['title']}")
                return True
            else:
                print(f"Error submitting template: {res_data}")
                return False
    except urllib.error.HTTPError as e:
        print(f"HTTP Error submitting template: {e.code} - {e.read().decode('utf-8')}")
        return False
    except Exception as e:
        print(f"Error submitting template: {e}")
        return False

def main():
    teardown_id = "td_01KTGN34Y7XNXZRT20VMZP7FAX"
    
    t1 = {
        "type": "structure",
        "title": "户外手作与独处Vlog五段式结构大纲",
        "body_md": """# 户外手作与独处Vlog五段式结构大纲

本模板由拉片样片《妻子不在家的5天，我拥有了一个“秘密基地”》结构提炼而来，极适合自制、数码桌搭、旧物整理、个人生活流等Vlog。

## 结构框架与填空脚本

### 1. 独居/倒计时开篇（时间：00:00 - 02:00）
* **视觉描述**：主角身处微暗、安静的生活空间，进行起床、洗漱或做早餐的片段动作。
* **字幕旁白（填空）**：[输入你的特殊假设，例如：“妻子离家/全职独处的第X天，在这个我一个人支配的空间里，一切都变慢了。”]
* **视听技巧**：使用松弛、安静的Lo-Fi音乐伴奏，压低环境现场声。

### 2. 硬核手工/整理（时间：02:00 - 04:00）
* **视觉描述**：主角拿出卷尺测量、标记、开孔，使用各种工具并完成一个局部的整理/手作过程。
* **字幕旁白（填空）**：[输入你的手作目标，例如：“一直想自己做一面户外装备挂墙，今天正好有大把完整的时间。”]
* **视听技巧**：微距、极窄焦深，将敲击、摩擦等现场物声卡点剪辑，并加入清脆律动的打击打击配乐。

### 3. 工作室/数码桌搭（时间：04:00 - 06:00）
* **视觉描述**：展现黑胡桃木或极简升降桌面，理顺线缆，调试显示器和拓展坞，亮起屏幕。
* **字幕旁白（填空）**：[输入你的理线格言，例如：“理清桌下的每一根杂线，就像是理清了乱糟糟的生活。”]
* **视听技巧**：侧打逆光展现木纹质感，由虚变实的焦点变换，理线和摆件过程用高频硬切。

### 4. 中古/童心旧物注入（时间：06:00 - 08:00）
* **视觉描述**：在冷淡极简的桌面上，塞满各种色彩斑斓的复古玩具、盲盒或打字机，拧动发条。
* **字幕旁白（填空）**：[输入你对旧物的独特见解，例如：“大男孩书桌的终极形态，永远是一个藏满了儿时梦想的秘密玩具店。”]
* **视听技巧**：超大特写景别卡点，配乐瞬间转换成欢快、梦幻的机械八音盒音乐。

### 5. 烟火气团圆收尾（时间：08:00 - 尾声）
* **视觉描述**：大门口推开，伴侣进门/回归，主角迎接，镜头落在餐桌上热气腾腾的两份晚饭。
* **字幕旁白（填空）**：[输入你的亲密感言，例如：“独处的自由非常过瘾，但更棒的是，我有了可以一起分享这面新墙和晚餐的人。”]
* **视听技巧**：大中景定焦长定镜头，现场开大门声桥先入，配乐变奏为温厚的大提琴弦乐。
"""
    }
    
    t2 = {
        "type": "shot",
        "title": "低成本电影感B-roll手持特写配镜指南",
        "body_md": """# 低成本电影感B-roll手持特写配镜指南

极低成本复刻高级工业感镜头！只需一台单反或无反，搭配大光圈镜头在窗下侧逆光环境中即可高质感产出。

## 镜头复刻实操方案

### 1. 黄金对角线呼吸手特写（适用：穿挂锁扣、拧螺丝、摆弄潮玩）
* **拍摄机位**：相机平视侧拍，镜头与双手呈45度对角线角度。
* **参数设定**：快门1/50（拍24帧），光圈F1.8-F2.8（获取极浅景深），感光度ISO自动。
* **运镜手法**：手持相机，保持极其轻微、自然的身体呼吸晃动（不使用稳定器），焦点锁定在主角手指尖和玩具接触的物理点上，背景自然虚化。

### 2. 百叶窗侧逆光焦点平移特写（适用：桌面旧物展示、咖啡杯蒸汽）
* **拍摄机位**：相机斜俯拍，百叶窗的斜照光束打在物体侧后方135度，形成耀眼的高反差冷暖边缘反光。
* **运镜手法**：固定机位，手动扭动镜头对焦环，将焦点从前景虚化处的摆件平滑、极其舒缓地推移到背景中亮起的灯光上。

### 3. 工具匹配运动连环跳切（适用：理线扎扎带、钻孔装配）
* **拍摄机位**：工具特写微距景别。
* **剪辑手法**：拍摄多组1秒左右的短镜，卡在Lo-Fi背景音乐的重拍卡点上，利索拼接。镜头1（对焦铅笔画线）→ 镜头2（对钻头旋转木屑飞溅）→ 镜头3（敲击锤子现场声），视觉震撼、解压感十足。
"""
    }
    
    submit_template(teardown_id, t1)
    submit_template(teardown_id, t2)

if __name__ == "__main__":
    main()
