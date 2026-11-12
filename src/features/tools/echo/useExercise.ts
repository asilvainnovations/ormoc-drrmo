// The ECHO exercise lives on this device (per account), like the other readiness tools: a training record the
// person exports or prints. Nothing about real evacuees is entered here.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { loadTool, saveTool } from '../storage';
import { newExercise, type Exercise } from '@/domain/echo';

const KEY = 'echo-exercise';

export function useExercise() {
  const { userId } = useAuth();
  const [ex, setEx] = useState<Exercise>(() => loadTool<Exercise | null>(userId, KEY, null) ?? newExercise());
  const [saved, setSaved] = useState<boolean | null>(null);
  useEffect(() => { setEx(loadTool<Exercise | null>(userId, KEY, null) ?? newExercise()); }, [userId]);
  const update = useCallback((fn: (e: Exercise) => Exercise) => {
    setEx((cur) => {
      const next = { ...fn(cur), updated_at: new Date().toISOString() };
      setSaved(saveTool(userId, KEY, next));
      return next;
    });
  }, [userId]);
  const replace = useCallback((e: Exercise) => { setSaved(saveTool(userId, KEY, e)); setEx(e); }, [userId]);
  return { ex, update, replace, saved };
}
