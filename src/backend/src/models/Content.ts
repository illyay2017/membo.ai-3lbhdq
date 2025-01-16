/**
 * @fileoverview Content model class for managing content items with enhanced security and audit logging
 * @version 1.0.0
 */

import { PostgrestFilterBuilder } from '@supabase/postgrest-js'; // v1.8.4
import { ValidationError } from 'yup'; // v1.3.2
import { EncryptionService } from '@membo/encryption'; // v1.0.0
import { AuditLogger } from '@membo/audit-logger'; // v1.0.0
import { IContent, ContentStatus } from '../interfaces/IContent';
import supabase from '../config/supabase';
import * as yup from 'yup';

/**
 * Schema for content validation
 */
const contentSchema = yup.object().shape({
  userId: yup.string().required('User ID is required'),
  content: yup.string().required('Content is required'),
  metadata: yup.object().required('Metadata is required'),
  source: yup.string().required('Source is required'),
  sourceUrl: yup.string().nullable(),
  status: yup.string().oneOf(Object.values(ContentStatus)).default(ContentStatus.NEW)
});

/**
 * Content model class with enhanced security features and comprehensive error handling
 */
export class Content {
  private readonly tableName: string = 'contents';
  private readonly db = supabase;
  private readonly encryptionService: EncryptionService;
  private readonly auditLogger: AuditLogger;

  constructor() {
    this.encryptionService = new EncryptionService();
    this.auditLogger = new AuditLogger();
  }

  /**
   * Creates a new content item with encrypted sensitive data
   * @param contentData Content item data
   * @returns Created content item
   * @throws ValidationError if data is invalid
   */
  async create(contentData: Omit<IContent, 'id' | 'createdAt' | 'updatedAt' | 'processedAt'>): Promise<IContent> {
    try {
      // Validate input data
      const validatedData = await contentSchema.validate(contentData);

      // Encrypt sensitive metadata fields
      const encryptedMetadata = await this.encryptionService.encryptFields(validatedData.metadata, [
        'tags',
        'language',
        'confidence'
      ]);

      // Begin transaction
      const { data, error } = await this.db
        .from(this.tableName)
        .insert({
          ...validatedData,
          metadata: encryptedMetadata,
          status: ContentStatus.NEW,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (error) throw error;

      // Log audit trail
      await this.auditLogger.log({
        action: 'content.create',
        userId: validatedData.userId,
        resourceId: data.id,
        metadata: {
          source: validatedData.source,
          contentType: validatedData.metadata.contentType
        }
      });

      return data;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to create content: ${error.message}`);
    }
  }

  /**
   * Retrieves a content item with security checks
   * @param id Content item ID
   * @param userId User ID for authorization
   * @returns Found content item or null
   */
  async findById(id: string, userId: string): Promise<IContent | null> {
    try {
      const { data, error } = await this.db
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .eq('userId', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Decrypt sensitive metadata fields
      const decryptedMetadata = await this.encryptionService.decryptFields(data.metadata, [
        'tags',
        'language',
        'confidence'
      ]);

      return { ...data, metadata: decryptedMetadata };
    } catch (error) {
      throw new Error(`Failed to find content: ${error.message}`);
    }
  }

  /**
   * Retrieves all content items for a user
   * @param userId User ID
   * @param status Optional status filter
   * @returns Array of content items
   */
  async findByUserId(userId: string, status?: ContentStatus): Promise<IContent[]> {
    try {
      let query: PostgrestFilterBuilder<any> = this.db
        .from(this.tableName)
        .select('*')
        .eq('userId', userId)
        .is('deletedAt', null);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('createdAt', { ascending: false });

      if (error) throw error;

      // Decrypt sensitive metadata fields for all items
      const decryptedData = await Promise.all(
        data.map(async (item) => ({
          ...item,
          metadata: await this.encryptionService.decryptFields(item.metadata, [
            'tags',
            'language',
            'confidence'
          ])
        }))
      );

      return decryptedData;
    } catch (error) {
      throw new Error(`Failed to find content by user: ${error.message}`);
    }
  }

  /**
   * Updates content status with audit logging
   * @param id Content item ID
   * @param userId User ID for authorization
   * @param status New status
   * @returns Updated content item
   */
  async updateStatus(id: string, userId: string, status: ContentStatus): Promise<IContent> {
    try {
      const { data, error } = await this.db
        .from(this.tableName)
        .update({
          status,
          updated_at: new Date().toISOString(),
          processed_at: status === ContentStatus.PROCESSED ? new Date().toISOString() : null
        })
        .eq('id', id)
        .eq('userId', userId)
        .select('*')
        .single();

      if (error) throw error;

      // Log status change
      await this.auditLogger.log({
        action: 'content.status_update',
        userId,
        resourceId: id,
        metadata: { newStatus: status }
      });

      return data;
    } catch (error) {
      throw new Error(`Failed to update content status: ${error.message}`);
    }
  }

  /**
   * Archives a content item
   * @param id Content item ID
   * @param userId User ID for authorization
   * @returns Archived content item
   */
  async archive(id: string, userId: string): Promise<IContent> {
    return this.updateStatus(id, userId, ContentStatus.ARCHIVED);
  }

  /**
   * Soft deletes a content item
   * @param id Content item ID
   * @param userId User ID for authorization
   * @returns Success status
   */
  async delete(id: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.db
        .from(this.tableName)
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('userId', userId);

      if (error) throw error;

      // Log deletion
      await this.auditLogger.log({
        action: 'content.delete',
        userId,
        resourceId: id,
        metadata: { deletionType: 'soft' }
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to delete content: ${error.message}`);
    }
  }
}