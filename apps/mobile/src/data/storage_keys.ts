/**
 * Local Storage Keys & Identifier Utilities
 * Reference: CogniQuest_개발명세_v1/03_데이터와처리계약.md
 */

import { UUID, ISODateTimeString } from '../contracts/types';

export const STORAGE_KEYS = {
  DB_VERSION: '@cogniquest:db_version',
  PROFILE: '@cogniquest:profile',
  ROUTINE: '@cogniquest:routine',
  TOPICS: '@cogniquest:topics',
  SOURCES: '@cogniquest:sources',
  SOURCE_REVISIONS: '@cogniquest:source_revisions',
  SOURCE_CHUNKS: '@cogniquest:source_chunks',
  TOPIC_SOURCE_LINKS: '@cogniquest:topic_source_links',
  UNITS: '@cogniquest:units',
  LEARNING_SPECS: '@cogniquest:learning_specs',
  QUESTIONS: '@cogniquest:questions',
  SESSIONS: '@cogniquest:sessions',
  SESSION_ITEMS: '@cogniquest:session_items',
  ATTEMPTS: '@cogniquest:attempts',
  REVIEW_STATES: '@cogniquest:review_states',
  MANUAL_COMPLETIONS: '@cogniquest:manual_completions',
  API_KEY: '@cogniquest:gemini_api_key',
  PREFERRED_MODEL: '@cogniquest:preferred_ai_model',
  LAST_STUDIED_TOPIC: '@cogniquest:last_studied_topic',
  CUSTOM_NOTE_QUESTIONS: '@cogniquest:custom_note_questions',
  ALARM_CONFIG: '@celueste:alarm_config_v2',
  RANKING_PROFILE: '@celueste:ranking_profile',
  RANKING_SYNC_QUEUE: '@celueste:ranking_sync_queue',
  RANKING_RECOVERY_SEED: '@celueste:ranking_recovery_seed',
  ATTEMPT_CORRECTIONS: '@celueste:attempt_corrections',
  AI_DATA_NOTICE: '@celueste:ai_data_notice_version',
};

export const CURRENT_DB_VERSION = 4;

export function generateUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getCurrentISOTime(): ISODateTimeString {
  return new Date().toISOString();
}
