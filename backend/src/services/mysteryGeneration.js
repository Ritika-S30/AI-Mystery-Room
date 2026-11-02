import { GoogleGenAI } from '@google/genai';
import mongoose from 'mongoose';
import Evidence from '../models/Evidence.js';
import Mystery from '../models/Mystery.js';
import Suspect from '../models/Suspect.js';
import { DIFFICULTY_RULES } from '../gameRules.js';

const EVIDENCE_TYPES = [
  'chat_message',
  'document',
  'written_statement',
  'photograph',
  'cctv_transcript',
  'timeline',
  'investigation_record',
  'other',
];

const blueprintSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    scenario: { type: 'string' },
    location: { type: 'string' },
    victim: {
      type: 'object',
      additionalProperties: false,
      properties: { name: { type: 'string' }, description: { type: 'string' } },
      required: ['name', 'description'],
    },
    timeline: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { at: { type: 'string' }, event: { type: 'string' } },
        required: ['at', 'event'],
      },
    },
    suspects: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          key: { type: 'string' }, name: { type: 'string' }, age: { type: 'integer' },
          background: { type: 'string' }, relationshipToCase: { type: 'string' },
          motive: { type: 'string' }, alibi: { type: 'string' }, relevantInformation: { type: 'string' },
        },
        required: ['key', 'name', 'age', 'background', 'relationshipToCase', 'motive', 'alibi', 'relevantInformation'],
      },
    },
    culpritKey: { type: 'string' },
    solution: {
      type: 'object', additionalProperties: false,
      properties: {
        motive: { type: 'string' }, whatHappened: { type: 'string' }, explanation: { type: 'string' },
        cluePlan: { type: 'array', items: { type: 'string' } },
        redHerringPlan: { type: 'array', items: { type: 'string' } },
      },
      required: ['motive', 'whatHappened', 'explanation', 'cluePlan', 'redHerringPlan'],
    },
  },
  required: ['title', 'description', 'scenario', 'location', 'victim', 'timeline', 'suspects', 'culpritKey', 'solution'],
};

const evidenceBundleSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    evidence: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          key: { type: 'string' }, title: { type: 'string' }, type: { type: 'string', enum: EVIDENCE_TYPES },
          content: { type: 'string' }, relevantAt: { type: ['string', 'null'] },
          relatedSuspectKeys: { type: 'array', items: { type: 'string' } },
          relatedLocation: { type: 'string' }, role: { type: 'string', enum: ['decisive_clue', 'red_herring', 'supporting'] },
          reasoning: { type: 'string' },
        },
        required: ['key', 'title', 'type', 'content', 'relevantAt', 'relatedSuspectKeys', 'relatedLocation', 'role', 'reasoning'],
      },
    },
  },
  required: ['evidence'],
};

export class MysteryGenerationError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'MysteryGenerationError';
    this.statusCode = statusCode;
  }
}

export function mapGeminiError(error) {
  if (error?.status === 429 || error?.name === 'RateLimitError' || error?.code === 'RESOURCE_EXHAUSTED') {
    return new MysteryGenerationError(
      'Gemini quota or rate limit reached for this project or model. Check the active limits in Google AI Studio and retry after capacity is available.',
      429,
    );
  }
  if (error?.status === 402 || error?.code === 'PAYMENT_REQUIRED') {
    return new MysteryGenerationError('Gemini billing is required or the available prepaid balance is exhausted.', 402);
  }
  if (error?.status === 403 || error?.name === 'PermissionDeniedError') {
    return new MysteryGenerationError('This Gemini project does not have access to the configured model. Check its project and model access in Google AI Studio.', 503);
  }
  if (error?.status === 404 || error?.name === 'NotFoundError') {
    return new MysteryGenerationError('The configured Gemini model is unavailable. Check GEMINI_MODEL.', 503);
  }
  if (error?.name === 'APIConnectionTimeoutError' || error?.name === 'TimeoutError') {
    return new MysteryGenerationError('Gemini did not respond in time. Please retry.', 503);
  }
  return new MysteryGenerationError('Gemini could not generate the requested case. Please try again.', 502);
}

function requireText(value, field, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new MysteryGenerationError(`Invalid generated field: ${field}.`);
  }
}

function requireUniqueKeys(values, field) {
  const keys = values.map((item) => item.key);
  if (keys.some((key) => typeof key !== 'string' || key.length === 0) || new Set(keys).size !== keys.length) {
    throw new MysteryGenerationError(`Generated ${field} keys must be present and unique.`);
  }
}

export function validateBlueprint(blueprint, requestedDifficulty = 'medium') {
  if (!blueprint || typeof blueprint !== 'object' || Array.isArray(blueprint)) {
    throw new MysteryGenerationError('Gemini returned an invalid case plan.');
  }
  requireText(blueprint.title, 'title', 160);
  requireText(blueprint.description, 'description', 5000);
  requireText(blueprint.scenario, 'scenario', 10000);
  requireText(blueprint.location, 'location', 300);
  if (!blueprint.victim || typeof blueprint.victim !== 'object') throw new MysteryGenerationError('Generated victim details are missing.');
  requireText(blueprint.victim.name, 'victim.name', 120);
  requireText(blueprint.victim.description, 'victim.description', 2000);
  if (!Array.isArray(blueprint.timeline) || blueprint.timeline.length < 3 || blueprint.timeline.length > 12) {
    throw new MysteryGenerationError('Generated timeline must contain 3 to 12 events.');
  }
  for (const [index, event] of blueprint.timeline.entries()) {
    requireText(event?.at, `timeline.${index}.at`, 120);
    requireText(event?.event, `timeline.${index}.event`, 1000);
  }
  const rules = DIFFICULTY_RULES[requestedDifficulty];
  if (!rules) throw new MysteryGenerationError('Difficulty must be easy, medium, or hard.', 400);
  if (!Array.isArray(blueprint.suspects) || blueprint.suspects.length !== rules.suspects) {
    throw new MysteryGenerationError(`${requestedDifficulty} cases must have exactly ${rules.suspects} suspects.`);
  }
  requireUniqueKeys(blueprint.suspects, 'suspect');
  const suspectNames = blueprint.suspects.map(({ name }) => String(name).trim().toLocaleLowerCase());
  if (new Set(suspectNames).size !== suspectNames.length) throw new MysteryGenerationError('Generated suspect names must be unique.');
  for (const [index, suspect] of blueprint.suspects.entries()) {
    requireText(suspect.name, `suspects.${index}.name`, 120);
    if (!Number.isInteger(suspect.age) || suspect.age < 0 || suspect.age > 130) throw new MysteryGenerationError(`Invalid age for suspects.${index}.`);
    requireText(suspect.background, `suspects.${index}.background`, 4000);
    requireText(suspect.relationshipToCase, `suspects.${index}.relationshipToCase`, 500);
    requireText(suspect.motive, `suspects.${index}.motive`, 2000);
    requireText(suspect.alibi, `suspects.${index}.alibi`, 2000);
    requireText(suspect.relevantInformation, `suspects.${index}.relevantInformation`, 3000);
  }
  if (!blueprint.suspects.some(({ key }) => key === blueprint.culpritKey)) {
    throw new MysteryGenerationError('Generated culprit does not match a suspect.');
  }
  const solution = blueprint.solution;
  if (!solution || typeof solution !== 'object') throw new MysteryGenerationError('Generated solution is missing.');
  requireText(solution.motive, 'solution.motive', 3000);
  requireText(solution.whatHappened, 'solution.whatHappened', 5000);
  requireText(solution.explanation, 'solution.explanation', 8000);
  if (!Array.isArray(solution.cluePlan) || solution.cluePlan.length < 3) throw new MysteryGenerationError('Solution needs at least three planned clues.');
  if (!Array.isArray(solution.redHerringPlan) || solution.redHerringPlan.length < 1) throw new MysteryGenerationError('Solution needs at least one red herring.');
  for (const [index, clue] of solution.cluePlan.entries()) requireText(clue, `solution.cluePlan.${index}`, 1200);
  for (const [index, clue] of solution.redHerringPlan.entries()) requireText(clue, `solution.redHerringPlan.${index}`, 1200);
  return blueprint;
}

const ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))?$/i;

function tryNormalizeIsoDateTime(value) {
  if (typeof value !== 'string') return null;
  const match = ISO_DATE_TIME_PATTERN.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, , , , , zone, , offsetHours, offsetMinutes] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offsetHour = Number(offsetHours || 0);
  const offsetMinute = Number(offsetMinutes || 0);
  if (
    month < 1 || month > 12 || day < 1 || day > monthLengths[month - 1]
    || (zone && zone.toUpperCase() !== 'Z' && (offsetHour > 14 || (offsetHour === 14 && offsetMinute !== 0)))
  ) {
    return null;
  }

  // A date-time without an explicit offset is treated as UTC; all stored values
  // are then canonicalized to ISO UTC, for example 2025-06-10T16:30:00.000Z.
  const parsed = new Date(zone ? value : `${value}Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeEvidenceTimestamp(value, evidenceNumber) {
  const normalized = tryNormalizeIsoDateTime(value);
  if (normalized) return normalized;
  throw new MysteryGenerationError(`Evidence item ${evidenceNumber} has an invalid timestamp.`);
}

function getTimelineAnchorDate(timeline, evidenceItems) {
  for (const event of timeline) {
    const at = event?.at;
    if (typeof at !== 'string' || !/\b\d{4}\b/.test(at)) continue;
    const milliseconds = Date.parse(at);
    if (!Number.isNaN(milliseconds)) return new Date(milliseconds);
  }
  // If timeline labels contain only clock times, reuse a valid date already
  // present in this case's evidence before falling back to the fixed base date.
  for (const item of evidenceItems) {
    const normalized = tryNormalizeIsoDateTime(item?.relevantAt);
    if (normalized) return new Date(normalized);
  }
  // A deterministic fictional date keeps relative case timelines stable.
  return new Date(Date.UTC(2000, 0, 1));
}

function timestampFromTimelineEvent(event, eventIndex, anchorDate) {
  const at = typeof event?.at === 'string' ? event.at.trim() : '';
  const embeddedIso = at.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})?/i)?.[0];
  const exactTimestamp = tryNormalizeIsoDateTime(embeddedIso);
  if (exactTimestamp) return exactTimestamp;

  if (/\b\d{4}\b/.test(at)) {
    const parsedDate = Date.parse(at);
    if (!Number.isNaN(parsedDate)) return new Date(parsedDate).toISOString();
  }

  const time = at.match(/\b(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?\s*(AM|PM)\b/i)
    ?? at.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  const fallbackDate = new Date(anchorDate);
  if (time) {
    let hours = Number(time[1]);
    const minutes = Number(time[2] || 0);
    const seconds = Number(time[3] || 0);
    const meridiem = time[4]?.toUpperCase();
    if (meridiem) hours = (hours % 12) + (meridiem === 'PM' ? 12 : 0);
    if (hours <= 23 && minutes <= 59 && seconds <= 59) {
      fallbackDate.setUTCHours(hours, minutes, seconds, 0);
      return fallbackDate.toISOString();
    }
  }

  // Preserve event order if the timeline uses labels such as "before closing"
  // rather than a concrete clock time.
  fallbackDate.setUTCHours(9 + eventIndex, 0, 0, 0);
  return fallbackDate.toISOString();
}

function timelineFallbackTimestamp(timeline, evidenceIndex, evidenceCount, anchorDate) {
  const eventIndex = Math.min(
    timeline.length - 1,
    Math.floor((evidenceIndex * timeline.length) / evidenceCount),
  );
  return timestampFromTimelineEvent(timeline[eventIndex], eventIndex, anchorDate);
}

export function validateEvidenceBundle(bundle, blueprint, requestedDifficulty = 'medium') {
  const rules = DIFFICULTY_RULES[requestedDifficulty];
  if (!rules) throw new MysteryGenerationError('Difficulty must be easy, medium, or hard.', 400);
  if (!bundle || !Array.isArray(bundle.evidence) || bundle.evidence.length !== rules.clues) {
    throw new MysteryGenerationError(`${requestedDifficulty} cases must have exactly ${rules.clues} clues.`);
  }
  requireUniqueKeys(bundle.evidence, 'evidence');
  const suspectKeys = new Set(blueprint.suspects.map(({ key }) => key));
  const evidenceKeys = new Set(bundle.evidence.map(({ key }) => key));
  const clueItems = [];
  const redHerringItems = [];
  const timeline = Array.isArray(blueprint.timeline) ? blueprint.timeline : [];
  const timelineAnchorDate = getTimelineAnchorDate(timeline, bundle.evidence);

  for (const [index, item] of bundle.evidence.entries()) {
    requireText(item.title, `evidence.${index}.title`, 180);
    requireText(item.content, `evidence.${index}.content`, 10000);
    requireText(item.relatedLocation, `evidence.${index}.relatedLocation`, 300);
    requireText(item.reasoning, `evidence.${index}.reasoning`, 2000);
    if (!EVIDENCE_TYPES.includes(item.type)) throw new MysteryGenerationError(`Unsupported evidence type at item ${index + 1}.`);
    if (!['decisive_clue', 'red_herring', 'supporting'].includes(item.role)) throw new MysteryGenerationError(`Unsupported evidence role at item ${index + 1}.`);
    if (!Array.isArray(item.relatedSuspectKeys) || item.relatedSuspectKeys.some((key) => !suspectKeys.has(key))) {
      throw new MysteryGenerationError(`Evidence item ${index + 1} refers to an unknown suspect.`);
    }
    try {
      item.relevantAt = normalizeEvidenceTimestamp(item.relevantAt, index + 1);
    } catch {
      const invalidType = typeof item.relevantAt;
      const invalidValue = typeof item.relevantAt === 'string'
        ? item.relevantAt.slice(0, 80)
        : item.relevantAt === undefined ? '<missing>' : String(item.relevantAt);
      item.relevantAt = timeline.length > 0
        ? timelineFallbackTimestamp(timeline, index, bundle.evidence.length, timelineAnchorDate)
        : new Date(Date.UTC(2000, 0, 1, 9 + index)).toISOString();
      console.warn(`Corrected invalid Gemini evidence timestamp: ${JSON.stringify({ item: index + 1, suppliedType: invalidType, suppliedValue: invalidValue, replacement: item.relevantAt })}`);
    }
    if (item.role === 'decisive_clue') clueItems.push(item);
    if (item.role === 'red_herring') redHerringItems.push(item);
  }
  if (clueItems.length < 3 || redHerringItems.length < 1) {
    throw new MysteryGenerationError('Evidence needs at least three clues and one red herring.');
  }
  if (blueprint.solution.cluePlan.length > clueItems.length || blueprint.solution.redHerringPlan.length > redHerringItems.length) {
    throw new MysteryGenerationError('Evidence does not fulfil the complete solution plan.');
  }
  return { ...bundle, evidenceKeys };
}

function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new MysteryGenerationError('Gemini is not configured on the server.', 503);
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      // Structured case generation may take longer than a short chat reply.
      // Allow one full minute per stage while avoiding automatic quota retries.
      timeout: 60000,
      retryOptions: { attempts: 1 },
    },
  });
}

async function generateStructuredJson(client, input, schema) {
  let interaction;
  try {
    interaction = await client.interactions.create({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      input,
      response_format: { type: 'text', mime_type: 'application/json', schema },
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 'unavailable';
    const knownName = ['APIConnectionTimeoutError', 'RateLimitError', 'PermissionDeniedError', 'NotFoundError'].includes(error?.name)
      ? error.name
      : 'ProviderError';
    // Keep provider bodies and request configuration out of terminal logs.
    console.error(`Gemini generation request failed (${knownName}; status ${status}).`);
    throw mapGeminiError(error);
  }
  if (typeof interaction?.output_text !== 'string') throw new MysteryGenerationError('Gemini returned no structured case data. Please try again.');
  try {
    return JSON.parse(interaction.output_text);
  } catch {
    throw new MysteryGenerationError('Gemini returned invalid JSON. Please try again.');
  }
}

function makeBlueprintPrompt(difficulty) {
  const rules = DIFFICULTY_RULES[difficulty];
  return `Create the planning stage for an original, entirely fictional detective mystery. Difficulty: ${difficulty}.
Return a self-contained case blueprint in the required JSON format. This stage decides the culprit BEFORE evidence is written. Make exactly one culprit, select culpritKey from the suspect keys, and provide the true motive and complete solution now. Do not put any culprit label in suspect profile fields.
Create exactly ${rules.suspects} distinct suspects. Every suspect needs a plausible motive and an alibi; innocent suspects must have believable alternative motives. Write a case that can be solved from concrete evidence, with a fair timeline and at least three distinct planned deductions plus one plausible red herring plan. All details, names, places, and events must be fictional. The scenario must not depend on real crimes or private persons. Do not include graphic violence.
The cluePlan and redHerringPlan are private internal planning notes, not player-facing content. Keep suspect keys short and unique. Use concise but specific prose.`;
}

function makeEvidencePrompt(blueprint, difficulty) {
  const rules = DIFFICULTY_RULES[difficulty];
  return `Write the evidence for the following fixed case plan. The culprit has already been selected and MUST NOT change. Keep every suspect profile and all evidence factually consistent with this plan. Do not add a culprit label or reveal the solution directly in any evidence or public profile.
Create exactly ${rules.clues} distinct fictional clues/evidence items. At least three must be decisive_clue items that directly support the stored deductions; at least one must be a plausible red_herring that has a clear explanation in the plan; remaining items may be supporting material. The evidence must allow a careful player to distinguish the culprit from every innocent suspect. Avoid contradictions, impossible timing, and clues that require knowledge not supplied in the case. Related suspect keys must come from the plan. relevantAt must be a full ISO-8601 date-time with a date and timezone, such as 2025-01-01T18:00:00Z, or null when no exact timestamp applies. Never return a time-only value such as 23:00:00Z. Include reasoning for each item; reasoning is private and will never be shown before solution reveal.

FIXED CASE PLAN (treat as authoritative):
${JSON.stringify(blueprint)}`;
}

export function toPublicMystery(mystery, suspects, evidence) {
  return {
    // Mongoose's id virtual is omitted from toJSON() by default. Include an
    // explicit API id so the frontend can create an investigation reliably.
    mystery: { ...mystery.toJSON(), id: String(mystery._id) },
    suspects: suspects.map((suspect) => suspect.toJSON()),
    evidence: evidence.map((item) => item.toJSON()),
  };
}

export async function generateMysteryCase({ difficulty = 'medium' } = {}) {
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    throw new MysteryGenerationError('Difficulty must be easy, medium, or hard.', 400);
  }
  const client = getGeminiClient();
  const blueprint = validateBlueprint(
    await generateStructuredJson(client, makeBlueprintPrompt(difficulty), blueprintSchema),
    difficulty,
  );
  const bundle = validateEvidenceBundle(
    await generateStructuredJson(client, makeEvidencePrompt(blueprint, difficulty), evidenceBundleSchema),
    blueprint,
    difficulty,
  );

  const suspectIds = new Map(blueprint.suspects.map((suspect) => [suspect.key, new mongoose.Types.ObjectId()]));
  const evidenceIds = new Map(bundle.evidence.map((item) => [item.key, new mongoose.Types.ObjectId()]));
  const clueItems = bundle.evidence.filter((item) => item.role === 'decisive_clue');
  const redHerringItems = bundle.evidence.filter((item) => item.role === 'red_herring');
  const plannedClues = clueItems.slice(0, blueprint.solution.cluePlan.length);
  const plannedRedHerrings = redHerringItems.slice(0, blueprint.solution.redHerringPlan.length);
  const culpritId = suspectIds.get(blueprint.culpritKey);

  const mystery = new Mystery({
    title: blueprint.title,
    description: blueprint.description,
    difficulty,
    scenario: blueprint.scenario,
    location: blueprint.location,
    victim: blueprint.victim,
    timeline: blueprint.timeline,
    status: 'active',
    solution: {
      culpritSuspectId: culpritId,
      motive: blueprint.solution.motive,
      whatHappened: blueprint.solution.whatHappened,
      explanation: blueprint.solution.explanation,
      importantClues: plannedClues.map((item) => ({ evidenceId: evidenceIds.get(item.key), explanation: item.reasoning })),
      redHerrings: plannedRedHerrings.map((item) => ({ evidenceId: evidenceIds.get(item.key), explanation: item.reasoning })),
    },
  });
  const suspects = blueprint.suspects.map((suspect) => new Suspect({
    _id: suspectIds.get(suspect.key),
    mysteryId: mystery._id,
    name: suspect.name,
    age: suspect.age,
    background: suspect.background,
    relationshipToCase: suspect.relationshipToCase,
    motive: suspect.motive,
    alibi: suspect.alibi,
    relevantInformation: suspect.relevantInformation,
  }));
  const evidence = bundle.evidence.map((item) => new Evidence({
    _id: evidenceIds.get(item.key),
    mysteryId: mystery._id,
    title: item.title,
    type: item.type,
    content: item.content,
    relevantAt: item.relevantAt || undefined,
    relatedSuspects: item.relatedSuspectKeys.map((key) => suspectIds.get(key)),
    relatedLocation: item.relatedLocation,
    isFictional: true,
  }));

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await mystery.save({ session });
      await Suspect.insertMany(suspects, { session });
      await Evidence.insertMany(evidence, { session });
    });
  } catch {
    throw new MysteryGenerationError('The generated case could not be saved. Please try again.', 500);
  } finally {
    await session.endSession();
  }

  return toPublicMystery(mystery, suspects, evidence);
}
