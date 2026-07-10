// Resolve o adapter de plataforma pelo host atual. O content script só roda nos hosts do
// manifest (meet.google.com / teams.*), então o `null` é só defesa.
import type { PlatformAdapter } from './types';
import { MeetAdapter } from './meet-adapter';
import { TeamsAdapter } from './teams/teams-adapter';

export function getPlatform(): PlatformAdapter | null {
  const h = location.host.toLowerCase();
  if (h === 'meet.google.com') return new MeetAdapter();
  // Teams novo (autenticado) vive em teams.cloud.microsoft; convidado/anônimo em teams.microsoft.com.
  if (h === 'teams.cloud.microsoft' || h === 'teams.microsoft.com' || h.endsWith('.teams.microsoft.com')) {
    return new TeamsAdapter();
  }
  return null;
}

export type { PlatformAdapter } from './types';
