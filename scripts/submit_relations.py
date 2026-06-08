#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

def submit_relations(teardown_id, relations):
    url = f"http://localhost:3030/api/teardowns/{teardown_id}/relations"
    data = json.dumps({"relations": relations}, ensure_ascii=False).encode('utf-8')
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
                print("Successfully submitted relations")
                return True
            else:
                print(f"Error submitting relations: {res_data}")
                return False
    except urllib.error.HTTPError as e:
        print(f"HTTP Error submitting relations: {e.code} - {e.read().decode('utf-8')}")
        return False
    except Exception as e:
        print(f"Error submitting relations: {e}")
        return False

def main():
    teardown_id = "td_01KTGN34Y7XNXZRT20VMZP7FAX"
    
    relations = [
        {
            "source_node": "topic",
            "target_node": "structure",
            "relation_type": "aligns_with",
            "description": "秘密基地的搭建与升级主题（Topic）与五天时间线的倒计时结构（Structure）完美咬合，使空间整理变成情节推手。"
        },
        {
            "source_node": "hook",
            "target_node": "pace",
            "relation_type": "causes",
            "description": "开头建立的独居5天陪伴感悬念（Hook）直接诱发了整片前松后紧、最后暖色拉长定焦的生活化呼吸节奏（Pace）。"
        },
        {
            "source_node": "shot",
            "target_node": "edit",
            "relation_type": "supports",
            "description": "极窄焦深的手持特写（Shot）与高密度理线、发条玩具卡点跳切（Edit）完美融合，极高地展现了手作细节和触觉爽快质感。"
        },
        {
            "source_node": "music",
            "target_node": "subtitle",
            "relation_type": "aligns_with",
            "description": "彩色中古玩具出场时叮咚作响的八音盒配乐（Music）与屏幕上柔和黄色、好玩的内心活动字幕（Subtitle）交相呼应，童真旧物氛围极佳。"
        }
    ]
    
    submit_relations(teardown_id, relations)

if __name__ == "__main__":
    main()
