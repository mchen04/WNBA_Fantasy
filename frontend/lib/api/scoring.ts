import { apiClient } from './client';
import type { ScoringConfiguration, ScoringConfigInput } from '@shared/types';

export const scoringApi = {
  // Get user's scoring configurations
  async getConfigurations(): Promise<ScoringConfiguration[]> {
    return apiClient.get('/api/scoring/configurations');
  },

  // Get a specific scoring configuration
  async getConfiguration(configId: string): Promise<ScoringConfiguration> {
    return apiClient.get(`/api/scoring/configurations/${configId}`);
  },

  // Create a new scoring configuration
  async createConfiguration(data: ScoringConfigInput): Promise<ScoringConfiguration> {
    return apiClient.post('/api/scoring/configurations', data);
  },

  // Update a scoring configuration
  async updateConfiguration(
    configId: string,
    data: Partial<ScoringConfigInput>
  ): Promise<ScoringConfiguration> {
    return apiClient.put(`/api/scoring/configurations/${configId}`, data);
  },

  // Delete a scoring configuration
  async deleteConfiguration(configId: string): Promise<void> {
    return apiClient.delete(`/api/scoring/configurations/${configId}`);
  },

  // Set default configuration
  async setDefault(configId: string): Promise<ScoringConfiguration> {
    return apiClient.post(`/api/scoring/configurations/${configId}/set-default`);
  },

  // Get default scoring configuration
  async getDefault(): Promise<ScoringConfiguration> {
    return apiClient.get('/api/scoring/configurations/default');
  },
};