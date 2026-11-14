import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_CONFIG, MISSIONS, type SpacecraftConfig, type StepId } from '../data/missionData';
import type { BestScoresMap, SavedDraft } from '../engine/physics';
import { db, handleFirestoreError, OperationType } from '../firebase';

function sanitizeDisplayName(user: User): string {
  const raw = (user.displayName ?? user.email?.split('@')[0] ?? 'Flight Director').trim();
  return raw.slice(0, 80) || 'Flight Director';
}

function sanitizePhotoURL(user: User): string | undefined {
  const url = (user.photoURL ?? '').trim();
  if (!url) return undefined;
  return url.slice(0, 500);
}

function sanitizeBestScores(scores: BestScoresMap): BestScoresMap {
  const allowed: Record<string, { score: number; grade: 'S' | 'A' | 'B' | 'C' | 'D' }> = {};
  for (const m of MISSIONS) {
    const entry = scores[m.id];
    if (entry && typeof entry.score === 'number') {
      allowed[m.id] = {
        score: Math.max(0, Math.min(100, Math.round(entry.score))),
        grade: entry.grade,
      };
    }
  }
  return allowed;
}

function sanitizeDraft(draft: SavedDraft): SavedDraft {
  const mergedConfig: SpacecraftConfig = {
    ...DEFAULT_CONFIG,
    ...draft.config,
    propellantKg: Math.max(0, Math.min(12000, Number(draft.config.propellantKg) || 0)),
    autoFuel: Boolean(draft.config.autoFuel),
    instruments: Array.isArray(draft.config.instruments)
      ? draft.config.instruments.slice(0, 9).map((id) => String(id))
      : [],
  };
  const stepVal: StepId = draft.step === 3 ? 3 : 2;
  return {
    config: mergedConfig,
    step: stepVal,
    savedAt: typeof draft.savedAt === 'number' ? draft.savedAt : Date.now(),
  };
}

export async function syncUserProfile(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const displayName = sanitizeDisplayName(user);
  const photoURL = sanitizePhotoURL(user);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid: user.uid,
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photoURL) payload.photoURL = photoURL;
      await setDoc(userRef, payload);
    } else {
      const updatePayload: Record<string, unknown> = {
        displayName,
        updatedAt: serverTimestamp(),
      };
      if (photoURL) updatePayload.photoURL = photoURL;
      await updateDoc(userRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export function subscribeUserProgress(
  uid: string,
  onData: (data: { bestScores?: BestScoresMap; draft?: SavedDraft | null }) => void,
): Unsubscribe {
  const progressPath = `users/${uid}/progress/state`;
  const progressRef = doc(db, 'users', uid, 'progress', 'state');

  return onSnapshot(
    progressRef,
    (snap) => {
      if (!snap.exists()) {
        onData({});
        return;
      }
      const raw = snap.data() as {
        bestScores?: BestScoresMap;
        draft?: SavedDraft | null;
      };
      onData({
        bestScores: raw.bestScores ? sanitizeBestScores(raw.bestScores) : undefined,
        draft: raw.draft ? sanitizeDraft(raw.draft) : null,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, progressPath);
    },
  );
}

export async function saveCloudProgress(
  uid: string,
  bestScores: BestScoresMap,
  draft: SavedDraft | null,
): Promise<void> {
  const progressPath = `users/${uid}/progress/state`;
  const progressRef = doc(db, 'users', uid, 'progress', 'state');
  const cleanScores = sanitizeBestScores(bestScores);
  const cleanDraft = draft ? sanitizeDraft(draft) : null;

  try {
    const snap = await getDoc(progressRef);
    if (!snap.exists()) {
      await setDoc(progressRef, {
        ownerId: uid,
        bestScores: cleanScores,
        ...(cleanDraft ? { draft: cleanDraft } : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(progressRef, {
        bestScores: cleanScores,
        ...(cleanDraft ? { draft: cleanDraft } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, progressPath);
  }
}
