export type UpdateChannel = 'stable' | 'beta' | 'nightly';

export interface UpdatePackage {
  url: string;
  sha256: string;
  size: number;
}

export interface DeltaPatch {
  from: string;
  to: string;
  url: string;
  sha256: string;
  size: number;
}

export interface UpdateManifest {
  latestVersion: string;
  fullPackage: UpdatePackage;
  patches: DeltaPatch[];
  releaseNotes: string;
  mandatory: boolean;
  channel: UpdateChannel;
  releaseDate: string;
}

export type UpdatePhase = 
  | 'idle' 
  | 'checking' 
  | 'available' 
  | 'downloading' 
  | 'verifying' 
  | 'preparing' 
  | 'ready' 
  | 'failed';

export interface UpdateState {
  phase: UpdatePhase;
  manifest: UpdateManifest | null;
  currentVersion: string;
  targetVersion: string;
  progress: {
    percentage: number;
    downloadedBytes: number;
    totalBytes: number;
    speed: number; // bytes per second
  };
  error: string | null;
  updateType: 'full' | 'delta' | null;
}
