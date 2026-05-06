import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api-client';

export const useLessonPlanMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (newPlan: any) => {
      const { data } = await api.post('/plans', newPlan);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...update }: any) => {
      const { data } = await api.put(`/plans/${id}`, update);
      return data;
    },
    // Architect Recommendation: Optimistic Updates
    onMutate: async (updatedPlan) => {
      await queryClient.cancelQueries({ queryKey: ['plans'] });
      const previousPlans = queryClient.getQueryData(['plans']);
      queryClient.setQueryData(['plans'], (old: any) => 
        old?.map((p: any) => p.id === updatedPlan.id ? { ...p, ...updatedPlan } : p)
      );
      return { previousPlans };
    },
    onError: (_err, _updatedPlan, context: any) => {
      queryClient.setQueryData(['plans'], context.previousPlans);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  return { createMutation, updateMutation, deleteMutation };
};
