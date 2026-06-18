import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateAiPreferencesDto } from './dto/create-ai-preferences.dto';
import { UpdateAiPreferencesDto } from './dto/update-ai-preferences.dto';

interface AiPreferencesRow {
  id: number;
  name: string;
  language: string;
  tone: string;
  formality: number;
  harshness: number;
  softness: number;
  creativity: number;
  bravery: number;
  professionalism: number;
  emotionalIntensity: number;
  readingLevel: string;
  audienceType: string;
  technicalDepth: number;
  storytelling: number;
  persuasiveness: number;
  objectivity: number;
  seoEnabled: number;
  hashtagsEnabled: number;
  markdownEnabled: number;
  callToActionEnabled: number;
  emojiLevel: number;
  sentenceLength: string;
  paragraphLength: string;
  brandConsistency: number;
  customPreferencesJson: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AiPreferencesService {
  constructor(private readonly databaseService: DatabaseService) {}

  listPreferences() {
    return this.databaseService.all<AiPreferencesRow>('SELECT * FROM AiPreferences ORDER BY name ASC').map((row) => this.serialize(row));
  }

  getPreference(id: number) {
    const row = this.databaseService.get<AiPreferencesRow>('SELECT * FROM AiPreferences WHERE id = ?', [id]);
    if (!row) {
      throw new NotFoundException('AI preference profile was not found.');
    }
    return this.serialize(row);
  }

  createPreference(dto: CreateAiPreferencesDto) {
    const now = new Date().toISOString();
    const result = this.databaseService.run(
      `INSERT INTO AiPreferences (
        name, language, tone, formality, harshness, softness, creativity, bravery,
        professionalism, emotionalIntensity, readingLevel, audienceType, technicalDepth,
        storytelling, persuasiveness, objectivity, seoEnabled, hashtagsEnabled,
        markdownEnabled, callToActionEnabled, emojiLevel, sentenceLength,
        paragraphLength, brandConsistency, customPreferencesJson, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.name,
        dto.language,
        dto.tone,
        dto.formality,
        dto.harshness,
        dto.softness,
        dto.creativity,
        dto.bravery,
        dto.professionalism,
        dto.emotionalIntensity,
        dto.readingLevel,
        dto.audienceType,
        dto.technicalDepth,
        dto.storytelling,
        dto.persuasiveness,
        dto.objectivity,
        dto.seoEnabled ? 1 : 0,
        dto.hashtagsEnabled ? 1 : 0,
        dto.markdownEnabled ? 1 : 0,
        dto.callToActionEnabled ? 1 : 0,
        dto.emojiLevel,
        dto.sentenceLength,
        dto.paragraphLength,
        dto.brandConsistency,
        dto.customPreferencesJson ?? null,
        now,
        now,
      ],
    );

    return this.getPreference(result.lastInsertRowid);
  }

  updatePreference(id: number, dto: UpdateAiPreferencesDto) {
    const current = this.databaseService.get<AiPreferencesRow>('SELECT * FROM AiPreferences WHERE id = ?', [id]);
    if (!current) {
      throw new NotFoundException('AI preference profile was not found.');
    }

    const next = {
      ...current,
      ...dto,
      seoEnabled: dto.seoEnabled === undefined ? current.seoEnabled : dto.seoEnabled ? 1 : 0,
      hashtagsEnabled: dto.hashtagsEnabled === undefined ? current.hashtagsEnabled : dto.hashtagsEnabled ? 1 : 0,
      markdownEnabled: dto.markdownEnabled === undefined ? current.markdownEnabled : dto.markdownEnabled ? 1 : 0,
      callToActionEnabled: dto.callToActionEnabled === undefined ? current.callToActionEnabled : dto.callToActionEnabled ? 1 : 0,
      updatedAt: new Date().toISOString(),
    };

    this.databaseService.run(
      `UPDATE AiPreferences SET
        name = ?, language = ?, tone = ?, formality = ?, harshness = ?, softness = ?,
        creativity = ?, bravery = ?, professionalism = ?, emotionalIntensity = ?,
        readingLevel = ?, audienceType = ?, technicalDepth = ?, storytelling = ?,
        persuasiveness = ?, objectivity = ?, seoEnabled = ?, hashtagsEnabled = ?,
        markdownEnabled = ?, callToActionEnabled = ?, emojiLevel = ?, sentenceLength = ?,
        paragraphLength = ?, brandConsistency = ?, customPreferencesJson = ?, updatedAt = ?
       WHERE id = ?`,
      [
        next.name,
        next.language,
        next.tone,
        next.formality,
        next.harshness,
        next.softness,
        next.creativity,
        next.bravery,
        next.professionalism,
        next.emotionalIntensity,
        next.readingLevel,
        next.audienceType,
        next.technicalDepth,
        next.storytelling,
        next.persuasiveness,
        next.objectivity,
        next.seoEnabled,
        next.hashtagsEnabled,
        next.markdownEnabled,
        next.callToActionEnabled,
        next.emojiLevel,
        next.sentenceLength,
        next.paragraphLength,
        next.brandConsistency,
        next.customPreferencesJson ?? null,
        next.updatedAt,
        id,
      ],
    );

    return this.getPreference(id);
  }

  private serialize(row: AiPreferencesRow) {
    return {
      ...row,
      seoEnabled: Boolean(row.seoEnabled),
      hashtagsEnabled: Boolean(row.hashtagsEnabled),
      markdownEnabled: Boolean(row.markdownEnabled),
      callToActionEnabled: Boolean(row.callToActionEnabled),
    };
  }
}
