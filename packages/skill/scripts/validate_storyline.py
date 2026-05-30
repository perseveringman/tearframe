#!/usr/bin/env python3
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any


TOP_LEVEL_FIELDS = ["premise", "protagonist_arc", "story_beats"]
ARC_FIELDS = ["start_state", "end_state", "transformation"]
BEAT_STRING_FIELDS = ["label", "story_function", "viewer_knows", "viewer_question", "author_intent", "why_here"]
PAYOFF_STRING_FIELDS = ["setup", "payoff", "meaning"]
GENERIC_PHRASES = [
    "推进叙事",
    "承上启下",
    "建立情绪",
    "丰富画面",
    "氛围感",
    "作者想表达",
    "强化主题",
    "提升质感",
]


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError(f"{path}: invalid JSON: {exc}") from exc


def extract_structure(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("structure JSON must be an object")
    if isinstance(data.get("storyline"), dict):
        return data
    payload = data.get("payload")
    if isinstance(payload, dict) and isinstance(payload.get("storyline"), dict):
        return payload
    cards = data.get("cards")
    if isinstance(cards, dict) and isinstance(cards.get("structure"), dict):
        return cards["structure"]
    if isinstance(data.get("data"), dict):
        return extract_structure(data["data"])
    raise ValueError("could not find structure.storyline in input")


def extract_storyboard(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        for key in ("beats", "storyboard"):
            value = data.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        if isinstance(data.get("data"), dict):
            return extract_storyboard(data["data"])
    raise ValueError("storyboard JSON must be an array, or an object with beats/storyboard")


def as_record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_number(value: Any) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return None


def visible_length(value: Any) -> int:
    return len(re.sub(r"\s+", "", str(value or "")))


def normalize_text(value: Any) -> str:
    text = re.sub(r"\s+", "", str(value or ""))
    return re.sub(r"[，。,.!！?？:：；;、（）()【】\[\]\"'“”‘’/\\-]", "", text)


def summarize_indexes(indexes: list[int], limit: int = 18) -> str:
    if len(indexes) <= limit:
        return ", ".join(str(i) for i in indexes)
    head = ", ".join(str(i) for i in indexes[:limit])
    return f"{head}, ... (+{len(indexes) - limit})"


def storyboard_indexes(storyboard: list[dict[str, Any]] | None) -> set[int]:
    indexes: set[int] = set()
    for beat in storyboard or []:
        value = beat.get("shot_index", beat.get("index"))
        if isinstance(value, int):
            indexes.add(value)
    return indexes


def validate(
    structure: dict[str, Any],
    storyboard: list[dict[str, Any]] | None,
    strict: bool,
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    storyline = as_record(structure.get("storyline"))
    if not storyline:
        return ["structure.storyline is missing"], warnings

    for field in TOP_LEVEL_FIELDS:
        if field not in storyline:
            errors.append(f"storyline missing required field {field}")
    if visible_length(storyline.get("premise")) < 18:
        errors.append("storyline.premise is too thin; explain the whole-video change in one concrete sentence")

    arc = as_record(storyline.get("protagonist_arc"))
    for field in ARC_FIELDS:
        if visible_length(arc.get(field)) < 8:
            errors.append(f"storyline.protagonist_arc.{field} is missing or too thin")

    story_beats = storyline.get("story_beats")
    if not isinstance(story_beats, list) or not story_beats:
        errors.append("storyline.story_beats must be a non-empty array")
        return errors, warnings
    if strict and not 5 <= len(story_beats) <= 9:
        errors.append(f"storyline.story_beats should contain 5-9 high-level beats, got {len(story_beats)}")
    elif len(story_beats) < 3:
        errors.append("storyline.story_beats needs at least 3 beats")

    shot_indexes = storyboard_indexes(storyboard)
    ranges: list[tuple[float, float, int]] = []
    functions: list[str] = []
    for index, raw_beat in enumerate(story_beats, start=1):
        beat = as_record(raw_beat)
        if not beat:
            errors.append(f"story beat {index}: must be an object")
            continue

        start = as_number(beat.get("start_sec"))
        end = as_number(beat.get("end_sec"))
        if start is None or end is None:
            errors.append(f"story beat {index}: start_sec and end_sec must be numbers")
        elif end <= start:
            errors.append(f"story beat {index}: end_sec must be greater than start_sec")
        else:
            ranges.append((start, end, index))

        for field in BEAT_STRING_FIELDS:
            min_len = 2 if field == "label" else 3 if field == "story_function" else 8
            if visible_length(beat.get(field)) < min_len:
                errors.append(f"story beat {index}: {field} is missing or too thin")

        function = str(beat.get("story_function", "")).strip()
        if function:
            functions.append(function)

        joined = "\n".join(str(beat.get(field, "")) for field in [*BEAT_STRING_FIELDS, "summary"])
        for phrase in GENERIC_PHRASES:
            if phrase in joined:
                errors.append(f"story beat {index}: contains banned generic phrase '{phrase}'")
        if normalize_text(beat.get("author_intent")) == normalize_text(beat.get("why_here")):
            errors.append(f"story beat {index}: author_intent and why_here must answer different questions")

        evidence_shots = beat.get("evidence_shots")
        if not isinstance(evidence_shots, list):
            errors.append(f"story beat {index}: evidence_shots must be an array")
            continue
        min_evidence = 2 if strict else 1
        if len(evidence_shots) < min_evidence:
            errors.append(f"story beat {index}: evidence_shots needs at least {min_evidence} shot reference(s)")
        invalid = [shot for shot in evidence_shots if not isinstance(shot, int) or shot < 0]
        if invalid:
            errors.append(f"story beat {index}: evidence_shots must contain non-negative integers")
        unknown = [shot for shot in evidence_shots if isinstance(shot, int) and shot_indexes and shot not in shot_indexes]
        if unknown:
            errors.append(f"story beat {index}: evidence_shots reference unknown shots {summarize_indexes(unknown)}")

    validate_storyline_coverage(ranges, storyboard, strict, errors, warnings)
    validate_story_functions(functions, strict, errors, warnings)
    validate_payoffs(storyline.get("setup_payoffs"), shot_indexes, strict, errors, warnings)
    return errors, warnings


def validate_storyline_coverage(
    ranges: list[tuple[float, float, int]],
    storyboard: list[dict[str, Any]] | None,
    strict: bool,
    errors: list[str],
    warnings: list[str],
) -> None:
    if not ranges:
        return
    ranges = sorted(ranges)
    for (prev_start, prev_end, prev_index), (start, _end, index) in zip(ranges, ranges[1:]):
        if start < prev_start:
            errors.append(f"story beat {index}: ranges must be ordered by time")
        gap = start - prev_end
        if gap > 20:
            message = f"story beats {prev_index}->{index}: gap is {gap:.1f}s"
            if strict:
                errors.append(message)
            else:
                warnings.append(message)

    if not storyboard:
        return
    storyboard_start = min(float(beat.get("start_sec", 0)) for beat in storyboard)
    storyboard_end = max(float(beat.get("end_sec", 0)) for beat in storyboard)
    if ranges[0][0] - storyboard_start > 12:
        errors.append("storyline.story_beats should start near the first shot")
    if storyboard_end - ranges[-1][1] > 18:
        errors.append("storyline.story_beats should cover the ending")
    covered = sum(max(0.0, end - start) for start, end, _index in ranges)
    duration = max(0.01, storyboard_end - storyboard_start)
    if strict and covered / duration < 0.85:
        errors.append(f"storyline.story_beats cover only {covered / duration:.0%} of the sample")


def validate_story_functions(
    functions: list[str],
    strict: bool,
    errors: list[str],
    warnings: list[str],
) -> None:
    if not functions:
        return
    for index in range(2, len(functions)):
        if functions[index] == functions[index - 1] == functions[index - 2]:
            errors.append(f"story_function repeats three times in a row around beat {index + 1}")
            break
    if strict:
        function, count = Counter(functions).most_common(1)[0]
        if len(functions) >= 5 and count / len(functions) > 0.45:
            warnings.append(f"story_function may be too repetitive: '{function}' appears {count}/{len(functions)} times")


def validate_payoffs(
    raw_payoffs: Any,
    shot_indexes: set[int],
    strict: bool,
    errors: list[str],
    warnings: list[str],
) -> None:
    if raw_payoffs is None:
        raw_payoffs = []
    if not isinstance(raw_payoffs, list):
        errors.append("storyline.setup_payoffs must be an array")
        return
    if strict and len(raw_payoffs) < 3:
        errors.append(f"storyline.setup_payoffs should contain at least 3 setup/payoff pairs, got {len(raw_payoffs)}")
    elif not raw_payoffs:
        warnings.append("storyline.setup_payoffs is empty")

    for index, raw_payoff in enumerate(raw_payoffs, start=1):
        payoff = as_record(raw_payoff)
        setup_sec = as_number(payoff.get("setup_sec"))
        payoff_sec = as_number(payoff.get("payoff_sec"))
        if setup_sec is None or payoff_sec is None:
            errors.append(f"setup_payoff {index}: setup_sec and payoff_sec must be numbers")
        elif payoff_sec <= setup_sec:
            errors.append(f"setup_payoff {index}: payoff_sec must be after setup_sec")
        for field in PAYOFF_STRING_FIELDS:
            if visible_length(payoff.get(field)) < 6:
                errors.append(f"setup_payoff {index}: {field} is missing or too thin")
        for field in ("setup_shot", "payoff_shot"):
            value = payoff.get(field)
            if value is not None and (not isinstance(value, int) or value < 0):
                errors.append(f"setup_payoff {index}: {field} must be a non-negative integer")
            if isinstance(value, int) and shot_indexes and value not in shot_indexes:
                errors.append(f"setup_payoff {index}: {field} references unknown shot {value}")


def self_test() -> int:
    structure = {
        "storyline": {
            "premise": "主角从不敢出发的孤立状态，经过试探和释放，最后主动进入新的关系。",
            "protagonist_arc": {
                "start_state": "一个人停在车边，不知道下一步去哪。",
                "end_state": "在群体场景里主动举杯，接受新的关系位置。",
                "transformation": "从防御式自由转为关系中的自由。",
            },
            "story_beats": [
                {
                    "start_sec": 0,
                    "end_sec": 20,
                    "label": "孤立起点",
                    "story_function": "setup",
                    "viewer_knows": "观众知道主角处在没有方向的出发前。",
                    "viewer_question": "他会选择逃离还是留下？",
                    "author_intent": "先把自由拍成空旷和停顿，压低初始能量。",
                    "why_here": "开头先给出低能量状态，后面释放才有对比。",
                    "evidence_shots": [0, 1],
                },
                {
                    "start_sec": 20,
                    "end_sec": 45,
                    "label": "上路试探",
                    "story_function": "inciting_incident",
                    "viewer_knows": "观众知道交通工具开始承担逃离功能。",
                    "viewer_question": "这趟路会把他带到哪里？",
                    "author_intent": "用移动镜头把人物从停顿推入行动。",
                    "why_here": "在起点之后立刻给出方向，避免故事停在情绪里。",
                    "evidence_shots": [2, 3],
                },
                {
                    "start_sec": 45,
                    "end_sec": 70,
                    "label": "自我保护",
                    "story_function": "escalation",
                    "viewer_knows": "观众知道旅程仍带着风险和防备。",
                    "viewer_question": "他真正害怕的是什么？",
                    "author_intent": "把自由的代价落在具体道具和动作上。",
                    "why_here": "在旅行变浪漫前先补上危险感，让人物更立体。",
                    "evidence_shots": [4, 5],
                },
                {
                    "start_sec": 70,
                    "end_sec": 95,
                    "label": "身体释放",
                    "story_function": "release",
                    "viewer_knows": "观众看到人物第一次把控制放下来。",
                    "viewer_question": "这种释放能不能持续？",
                    "author_intent": "用水、阳光和动作把紧绷状态松开。",
                    "why_here": "中段需要给观众一次情绪奖励，再进入更远的段落。",
                    "evidence_shots": [6, 7],
                },
                {
                    "start_sec": 95,
                    "end_sec": 120,
                    "label": "关系回收",
                    "story_function": "payoff",
                    "viewer_knows": "观众知道主角已经不再只和荒野相处。",
                    "viewer_question": "这是否意味着新的生活成立？",
                    "author_intent": "用群体同框回收前面的孤立状态。",
                    "why_here": "结尾必须把自由从个人动作转为可共享的状态。",
                    "evidence_shots": [8, 9],
                },
            ],
            "setup_payoffs": [
                {"setup_sec": 0, "payoff_sec": 95, "setup": "开头单人停顿", "payoff": "结尾群体同框", "meaning": "孤立被关系回收。"},
                {"setup_sec": 20, "payoff_sec": 70, "setup": "车辆开始移动", "payoff": "身体终于松开", "meaning": "外部移动转化成内部释放。"},
                {"setup_sec": 45, "payoff_sec": 120, "setup": "自我保护道具", "payoff": "主动进入人群", "meaning": "防备被信任取代。"},
            ],
        }
    }
    storyboard = [{"shot_index": i, "start_sec": i * 12, "end_sec": i * 12 + 12} for i in range(10)]
    errors, warnings = validate(structure, storyboard, strict=True)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("validate_storyline self-test passed")
    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Tearframe structure.storyline quality.")
    parser.add_argument("--structure", help="Path to structure card JSON, submit_card payload, or teardown JSON.")
    parser.add_argument("--storyboard", help="Path to storyboard JSON or teardown JSON.")
    parser.add_argument("--strict", action="store_true", help="Enable premium coverage, evidence, and payoff checks.")
    parser.add_argument("--self-test", action="store_true", help="Run built-in smoke test.")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if not args.structure:
        parser.error("--structure is required unless --self-test is set")

    try:
        structure = extract_structure(load_json(Path(args.structure)))
        storyboard = extract_storyboard(load_json(Path(args.storyboard))) if args.storyboard else None
        errors, warnings = validate(structure, storyboard, strict=args.strict)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    if errors:
        print(f"Storyline validation failed with {len(errors)} error(s):", file=sys.stderr)
        for error in errors[:80]:
            print(f"- {error}", file=sys.stderr)
        if len(errors) > 80:
            print(f"- ... {len(errors) - 80} more error(s)", file=sys.stderr)
        return 1

    print("Storyline passed quality validation")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
