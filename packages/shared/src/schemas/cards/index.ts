import { z } from "zod";
import { CardBaseSchema, TemplateHintSchema } from "./base";
import { TimeSegmentSchema } from "../common";
import { CARD_TYPES } from "../../constants/cards";

export const TopicCardSchema = CardBaseSchema.extend({
  question: z.string().min(1),
  why_now: z.string().min(1),
  angle_type: z.enum(["counter_consensus", "timely", "personal", "tutorial", "story", "review"]),
  transferable_formula: z.string().min(1)
});

export const CopyCardSchema = CardBaseSchema.extend({
  first_line: z.string().min(1),
  key_lines: z.array(z.string()).default([]),
  rhetorical_devices: z.array(z.string()).default([]),
  info_density_curve: z.array(TimeSegmentSchema).default([])
});

export const HookCardSchema = CardBaseSchema.extend({
  t0_frame: z.object({
    timestamp_sec: z.number().nonnegative(),
    frame_path: z.string().optional(),
    description: z.string().min(1)
  }),
  first_sentence: z.object({
    text: z.string().min(1),
    sentence_pattern: z.enum([
      "question",
      "counter_intuitive",
      "number_shock",
      "scene_immersion",
      "self_deprecation",
      "promise"
    ])
  }),
  hook_type: z.enum(["info_gap", "emotion_gap", "identity", "suspense", "benefit_promise"]),
  retention_logic: z.string().min(1),
  next_question_in_viewer_mind: z.string().min(1)
});

export const StorylineBeatSchema = z.object({
  start_sec: z.number().nonnegative(),
  end_sec: z.number().nonnegative(),
  label: z.string().min(1),
  story_function: z.string().min(1),
  summary: z.string().optional(),
  viewer_knows: z.string().min(1),
  viewer_question: z.string().min(1),
  author_intent: z.string().min(1),
  why_here: z.string().min(1),
  evidence_shots: z.array(z.number().int().nonnegative()).min(1)
});

export const StorylinePayoffSchema = z.object({
  setup_sec: z.number().nonnegative(),
  payoff_sec: z.number().nonnegative(),
  setup: z.string().min(1),
  payoff: z.string().min(1),
  meaning: z.string().min(1),
  setup_shot: z.number().int().nonnegative().optional(),
  payoff_shot: z.number().int().nonnegative().optional()
});

export const StorylineSchema = z.object({
  premise: z.string().min(1),
  protagonist_arc: z.object({
    start_state: z.string().min(1),
    end_state: z.string().min(1),
    transformation: z.string().min(1)
  }),
  story_beats: z.array(StorylineBeatSchema).min(1),
  setup_payoffs: z.array(StorylinePayoffSchema).default([])
});

export const StructureCardSchema = CardBaseSchema.extend({
  archetype: z.string().min(1),
  segments: z.array(TimeSegmentSchema).min(1),
  turn_points: z.array(TimeSegmentSchema).default([]),
  skeleton_template: z.string().min(1),
  storyline: StorylineSchema.optional()
});

export const ShotCardSchema = CardBaseSchema.extend({
  a_roll_style: z.string().optional(),
  b_roll_functions: z.array(z.string()).default([]),
  cut_density: z.string().optional(),
  low_cost_replicable: z.boolean().default(true)
});

export const EditCardSchema = CardBaseSchema.extend({
  tempo_map: z.array(TimeSegmentSchema).default([]),
  transitions: z.array(z.string()).default([]),
  jump_cuts: z.array(TimeSegmentSchema).default([]),
  pause_points: z.array(TimeSegmentSchema).default([])
});

export const MusicCardSchema = CardBaseSchema.extend({
  mood_curve: z.array(TimeSegmentSchema).default([]),
  in_points: z.array(TimeSegmentSchema).default([]),
  out_points: z.array(TimeSegmentSchema).default([]),
  reference_genre: z.string().optional()
});

export const SubtitleCardSchema = CardBaseSchema.extend({
  strategy: z.string().min(1),
  emphasis_style: z.string().optional(),
  color_coding: z.string().optional(),
  keyword_choices: z.array(z.string()).default([])
});

export const PaceCardSchema = CardBaseSchema.extend({
  overall_curve: z.string().min(1),
  density_segments: z.array(TimeSegmentSchema).default([]),
  breath_points: z.array(TimeSegmentSchema).default([])
});

export const AccountCardSchema = CardBaseSchema.extend({
  promise: z.string().min(1),
  persona_type: z.string().min(1),
  consistency_with_other_videos: z.string().optional(),
  share_currency: z.string().optional()
});

export const CardSchemas = {
  topic: TopicCardSchema,
  copy: CopyCardSchema,
  hook: HookCardSchema,
  structure: StructureCardSchema,
  shot: ShotCardSchema,
  edit: EditCardSchema,
  music: MusicCardSchema,
  subtitle: SubtitleCardSchema,
  pace: PaceCardSchema,
  account: AccountCardSchema
} satisfies Record<(typeof CARD_TYPES)[number], z.ZodTypeAny>;

export const TeardownTemplateSchema = TemplateHintSchema.extend({
  type: z.enum(CARD_TYPES),
  source_card_type: z.enum(CARD_TYPES).optional()
});

export type CardPayloadMap = {
  [K in keyof typeof CardSchemas]: z.infer<(typeof CardSchemas)[K]>;
};

export type AnyCardPayload = CardPayloadMap[keyof CardPayloadMap];
