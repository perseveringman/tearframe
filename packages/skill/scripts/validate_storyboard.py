#!/usr/bin/env python3
import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


REQUIRED_FIELDS = [
    "frame_path",
    "shot_size",
    "visual_summary",
    "voiceover",
    "background_audio",
    "camera_angle",
    "composition_analysis",
    "camera_motion",
    "edit_note",
    "audio_note",
    "narrative_function",
    "reusable_pattern",
]

ALLOWED_SHOT_SIZES = {
    "黑场",
    "图卡",
    "字幕卡",
    "大特写",
    "特写",
    "近景",
    "中近景",
    "中景",
    "中全景",
    "全景",
    "远景",
    "大远景",
    "航拍全景",
    "俯拍全景",
    "主观镜头",
    "插入特写",
    "屏幕录制",
    "档案素材",
}

GENERIC_PHRASES = [
    "主体居中或三分构图",
    "背景留出荒漠/车窗/道路作为情绪空间",
    "平视为主",
    "硬切为主，按叙事信息点推进",
    "轻微手持或静态观察，运动感来自剪辑",
    "荒漠中主角单人出镜，风、太阳和空旷背景放大孤独感",
    "可复用为",
    "建立叙事基调",
]

MIN_LENGTHS = {
    "visual_summary": 18,
    "composition_analysis": 22,
    "edit_note": 14,
    "audio_note": 12,
    "narrative_function": 14,
    "reusable_pattern": 14,
}


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError(f"{path}: invalid JSON: {exc}") from exc


def extract_storyboard(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("beats", "storyboard"):
            value = data.get(key)
            if isinstance(value, list):
                return value
        if isinstance(data.get("data"), dict):
            return extract_storyboard(data["data"])
    raise ValueError("storyboard JSON must be an array, or an object with beats/storyboard")


def extract_shots(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if isinstance(data.get("data"), list):
            return data["data"]
        resources = data.get("resources")
        if isinstance(resources, list):
            for resource in resources:
                if resource.get("resource_type") == "shots" and isinstance(resource.get("data"), list):
                    return resource["data"]
    raise ValueError("shots JSON must be an array, a resource object, or sample.get_resources output")


def extract_frames(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if isinstance(data.get("data"), list):
            return data["data"]
        resources = data.get("resources")
        if isinstance(resources, list):
            for resource in resources:
                if resource.get("resource_type") == "frames" and isinstance(resource.get("data"), list):
                    return resource["data"]
    raise ValueError("frames JSON must be an array, a resource object, or sample.get_resources output")


def normalize_text(value: Any) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"[，。,.!！?？:：；;、（）()【】\[\]\"'“”‘’]", "", text)
    return text


def visible_length(value: Any) -> int:
    text = re.sub(r"\s+", "", str(value or ""))
    return len(text)


def shot_index_of(shot: dict[str, Any]) -> int:
    return int(shot.get("index", shot.get("shot_index")))


def validate(beats: list[dict[str, Any]], shots: list[dict[str, Any]] | None, frames: list[dict[str, Any]] | None, strict: bool) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    beats_by_index: dict[int, dict[str, Any]] = {}

    if not beats:
        errors.append("storyboard is empty")
        return errors, warnings

    for row, beat in enumerate(beats, start=1):
        if not isinstance(beat, dict):
            errors.append(f"row {row}: beat must be an object")
            continue
        try:
            idx = int(beat.get("shot_index"))
        except Exception:
            errors.append(f"row {row}: shot_index must be a number")
            continue
        if idx in beats_by_index:
            errors.append(f"shot {idx}: duplicate storyboard beat")
        beats_by_index[idx] = beat

        for field in REQUIRED_FIELDS:
            value = str(beat.get(field, "")).strip()
            if not value:
                errors.append(f"shot {idx}: missing required field {field}")

        shot_size = str(beat.get("shot_size", "")).strip()
        if shot_size and shot_size not in ALLOWED_SHOT_SIZES:
            errors.append(f"shot {idx}: unsupported shot_size '{shot_size}'")
        if re.search(r"[/／、]|交替|为主|等|或", shot_size):
            errors.append(f"shot {idx}: shot_size must be a single clean value, got '{shot_size}'")

        for field, min_len in MIN_LENGTHS.items():
            value = str(beat.get(field, "")).strip()
            if value and value != "无" and visible_length(value) < min_len:
                errors.append(f"shot {idx}: {field} is too thin ({visible_length(value)} chars, need >= {min_len})")

        joined = "\n".join(str(beat.get(field, "")) for field in REQUIRED_FIELDS)
        for phrase in GENERIC_PHRASES:
            if phrase in joined:
                errors.append(f"shot {idx}: contains banned generic phrase '{phrase}'")

    if shots is not None:
        shot_by_index = {shot_index_of(shot): shot for shot in shots}
        expected_indexes = set(shot_by_index)
        actual_indexes = set(beats_by_index)
        missing = sorted(expected_indexes - actual_indexes)
        extra = sorted(actual_indexes - expected_indexes)
        if missing:
            errors.append(f"missing storyboard beats for shots: {summarize_indexes(missing)}")
        if extra:
            errors.append(f"storyboard contains unknown shot indexes: {summarize_indexes(extra)}")
        for idx, shot in shot_by_index.items():
            beat = beats_by_index.get(idx)
            if not beat:
                continue
            for field in ("start_sec", "end_sec"):
                expected = float(shot[field])
                actual = float(beat.get(field, -999999))
                if abs(expected - actual) > 0.05:
                    errors.append(f"shot {idx}: {field} {actual} does not match source {expected}")

    if frames is not None:
        frame_by_index = {int(frame.get("shot_index")): frame for frame in frames if "shot_index" in frame}
        for idx, beat in beats_by_index.items():
            frame = frame_by_index.get(idx)
            frame_path = str(beat.get("frame_path", "")).strip()
            if not frame:
                warnings.append(f"shot {idx}: no keyframe found for this shot")
                continue
            expected_path = str(frame.get("path", "")).strip()
            if expected_path and frame_path != expected_path:
                errors.append(f"shot {idx}: frame_path '{frame_path}' does not match keyframe '{expected_path}'")

    check_repetition(beats_by_index, "visual_summary", 1 if strict else 2, errors, warnings)
    check_repetition(beats_by_index, "composition_analysis", 2 if strict else 3, errors, warnings)
    check_repetition(beats_by_index, "edit_note", 4 if strict else 6, errors, warnings)

    if strict and len(beats_by_index) >= 10:
        camera_counts = Counter(normalize_text(beat.get("camera_angle")) for beat in beats_by_index.values())
        camera_counts.pop("", None)
        if camera_counts:
            value, count = camera_counts.most_common(1)[0]
            if count / len(beats_by_index) > 0.45:
                errors.append(f"camera_angle lacks variety: '{value}' appears {count}/{len(beats_by_index)} times")

    return errors, warnings


def check_repetition(
    beats_by_index: dict[int, dict[str, Any]],
    field: str,
    max_count: int,
    errors: list[str],
    warnings: list[str],
) -> None:
    groups: dict[str, list[int]] = defaultdict(list)
    for idx, beat in beats_by_index.items():
        value = normalize_text(beat.get(field))
        if value and value != "无":
            groups[value].append(idx)
    for value, indexes in groups.items():
        if len(indexes) > max_count:
            errors.append(f"{field} repeats {len(indexes)} times at shots {summarize_indexes(indexes)}: '{value[:36]}'")

    sorted_indexes = sorted(beats_by_index)
    run: list[int] = []
    last_value = None
    for idx in sorted_indexes:
        value = normalize_text(beats_by_index[idx].get(field))
        if value and value == last_value:
            run.append(idx)
        else:
            if len(run) > max_count:
                warnings.append(f"adjacent {field} run at shots {summarize_indexes(run)}")
            run = [idx]
            last_value = value
    if len(run) > max_count:
        warnings.append(f"adjacent {field} run at shots {summarize_indexes(run)}")


def summarize_indexes(indexes: list[int], limit: int = 18) -> str:
    if len(indexes) <= limit:
        return ", ".join(str(i) for i in indexes)
    head = ", ".join(str(i) for i in indexes[:limit])
    return f"{head}, ... (+{len(indexes) - limit})"


def self_test() -> int:
    shots = [{"index": 0, "start_sec": 0, "end_sec": 2}]
    frames = [{"shot_index": 0, "path": "samples/x/resources/frames/shot_000.jpg"}]
    beats = [
        {
            "shot_index": 0,
            "start_sec": 0,
            "end_sec": 2,
            "frame_path": "samples/x/resources/frames/shot_000.jpg",
            "shot_size": "中近景",
            "visual_summary": "主角站在车门旁回看道路，手扶车窗，远处山线压在画面下沿。",
            "voiceover": "无",
            "background_audio": "低频音乐延续，车外风声很轻，压住现场空间。",
            "camera_angle": "车外平视侧拍",
            "composition_analysis": "人物落在右三分线，车窗形成前景框，左侧道路留白指向旅程方向。",
            "camera_motion": "手持轻微晃动，主体与车保持相对静止。",
            "edit_note": "从道路空镜切入人物，完成空间到人物的收束。",
            "audio_note": "音乐不断，利用环境声弱化切点。",
            "narrative_function": "把抽象旅行主题落到一个可跟随的主角动作上。",
            "reusable_pattern": "先拍交通工具框景，再让人物在框内回望，建立出发前的犹豫。",
        }
    ]
    errors, warnings = validate(beats, shots, frames, strict=True)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("validate_storyboard self-test passed")
    if warnings:
        print("\n".join(warnings), file=sys.stderr)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Tearframe storyboard quality.")
    parser.add_argument("--storyboard", help="Path to storyboard JSON, teardown JSON, or { beats } payload.")
    parser.add_argument("--shots", help="Path to shots.json or sample.get_resources output.")
    parser.add_argument("--frames", help="Path to frames/index.json or sample.get_resources output.")
    parser.add_argument("--strict", action="store_true", help="Enable premium repetition and variety checks.")
    parser.add_argument("--self-test", action="store_true", help="Run built-in smoke test.")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if not args.storyboard:
        parser.error("--storyboard is required unless --self-test is set")

    try:
        beats = extract_storyboard(load_json(Path(args.storyboard)))
        shots = extract_shots(load_json(Path(args.shots))) if args.shots else None
        frames = extract_frames(load_json(Path(args.frames))) if args.frames else None
        errors, warnings = validate(beats, shots, frames, strict=args.strict)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    if errors:
        print(f"Storyboard validation failed with {len(errors)} error(s):", file=sys.stderr)
        for error in errors[:120]:
            print(f"- {error}", file=sys.stderr)
        if len(errors) > 120:
            print(f"- ... {len(errors) - 120} more error(s)", file=sys.stderr)
        return 1

    print(f"Storyboard passed quality validation: {len(beats)} beats")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
