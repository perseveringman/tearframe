import { create } from "zustand";

export type PlayerStore = {
  currentTime: number;
  seekTo?: (seconds: number) => void;
  setCurrentTime: (seconds: number) => void;
  setSeekTo: (seekTo: (seconds: number) => void) => void;
};

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTime: 0,
  setCurrentTime: (currentTime) => set({ currentTime }),
  setSeekTo: (seekTo) => set({ seekTo })
}));
