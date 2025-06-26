import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scoringApi } from '@/lib/api';
import { useUserStore } from '@/lib/store/user';
import type { ScoringConfiguration, ScoringConfigInput } from '@shared/types';
import toast from 'react-hot-toast';

// Query keys factory
export const scoringKeys = {
  all: ['scoring'] as const,
  configurations: () => [...scoringKeys.all, 'configurations'] as const,
  configuration: (id: string) => [...scoringKeys.configurations(), id] as const,
  default: () => [...scoringKeys.all, 'default'] as const,
};

// Get all scoring configurations
export function useScoringConfigurations() {
  const setScoringConfigs = useUserStore((state) => state.setScoringConfigs);

  return useQuery({
    queryKey: scoringKeys.configurations(),
    queryFn: async () => {
      const configs = await scoringApi.getConfigurations();
      setScoringConfigs(configs);
      return configs;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get single scoring configuration
export function useScoringConfiguration(configId: string) {
  return useQuery({
    queryKey: scoringKeys.configuration(configId),
    queryFn: () => scoringApi.getConfiguration(configId),
    enabled: !!configId,
  });
}

// Get default scoring configuration
export function useDefaultScoringConfiguration() {
  const setDefaultConfig = useUserStore((state) => state.setDefaultScoringConfig);

  return useQuery({
    queryKey: scoringKeys.default(),
    queryFn: async () => {
      const config = await scoringApi.getDefault();
      setDefaultConfig(config);
      return config;
    },
    staleTime: 10 * 60 * 1000,
  });
}

// Create scoring configuration
export function useCreateScoringConfiguration() {
  const queryClient = useQueryClient();
  const addScoringConfig = useUserStore((state) => state.addScoringConfig);

  return useMutation({
    mutationFn: (data: ScoringConfigInput) => scoringApi.createConfiguration(data),
    onSuccess: (newConfig) => {
      addScoringConfig(newConfig);
      queryClient.invalidateQueries({ queryKey: scoringKeys.configurations() });
      toast.success('Scoring configuration created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create configuration');
    },
  });
}

// Update scoring configuration
export function useUpdateScoringConfiguration() {
  const queryClient = useQueryClient();
  const updateScoringConfig = useUserStore((state) => state.updateScoringConfig);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScoringConfigInput> }) =>
      scoringApi.updateConfiguration(id, data),
    onSuccess: (updatedConfig) => {
      updateScoringConfig(updatedConfig.id, updatedConfig);
      queryClient.invalidateQueries({ queryKey: scoringKeys.configuration(updatedConfig.id) });
      queryClient.invalidateQueries({ queryKey: scoringKeys.configurations() });
      toast.success('Scoring configuration updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update configuration');
    },
  });
}

// Delete scoring configuration
export function useDeleteScoringConfiguration() {
  const queryClient = useQueryClient();
  const deleteScoringConfig = useUserStore((state) => state.deleteScoringConfig);

  return useMutation({
    mutationFn: (configId: string) => scoringApi.deleteConfiguration(configId),
    onSuccess: (_, configId) => {
      deleteScoringConfig(configId);
      queryClient.invalidateQueries({ queryKey: scoringKeys.configurations() });
      toast.success('Scoring configuration deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete configuration');
    },
  });
}

// Set default configuration
export function useSetDefaultConfiguration() {
  const queryClient = useQueryClient();
  const setDefaultConfig = useUserStore((state) => state.setDefaultScoringConfig);
  const updateScoringConfig = useUserStore((state) => state.updateScoringConfig);

  return useMutation({
    mutationFn: (configId: string) => scoringApi.setDefault(configId),
    onSuccess: (updatedConfig) => {
      setDefaultConfig(updatedConfig);
      updateScoringConfig(updatedConfig.id, { isDefault: true });
      
      // Update other configs to not be default
      queryClient.setQueryData<ScoringConfiguration[]>(
        scoringKeys.configurations(),
        (old) => old?.map((config) => ({
          ...config,
          isDefault: config.id === updatedConfig.id,
        }))
      );
      
      queryClient.invalidateQueries({ queryKey: scoringKeys.default() });
      toast.success('Default scoring configuration updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to set default configuration');
    },
  });
}