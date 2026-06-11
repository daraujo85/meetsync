// Logo/marca do MeetSync (balão + transcrição + câmera) — inline como data URL para o Shadow DOM.
// Usar como <img> isola os gradientes do SVG (sem conflito de IDs entre instâncias) e dispensa
// web_accessible_resources. Fonte: Mockups/assets/meetsync-mark.svg (HANDOFF §1).

const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="MeetSync">
  <defs>
    <radialGradient id="bg" cx="35%" cy="25%" r="75%">
      <stop offset="0%" stop-color="#3C4043"/><stop offset="70%" stop-color="#202124"/><stop offset="100%" stop-color="#17191C"/>
    </radialGradient>
    <linearGradient id="bl" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#AECBFA"/><stop offset="45%" stop-color="#8AB4F8"/><stop offset="100%" stop-color="#4285F4"/>
    </linearGradient>
    <linearGradient id="wh" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#E8EAED"/>
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="118" fill="url(#bg)"/>
  <path d="M86 82 H159 Q178 82 178 101 V151 Q178 170 159 170 H114 L84 199 V170 H79 Q60 170 60 151 V101 Q60 82 79 82 Z" fill="none" stroke="url(#wh)" stroke-width="15" stroke-linejoin="round" stroke-linecap="round"/>
  <line x1="97" y1="114" x2="148" y2="114" stroke="url(#bl)" stroke-width="11" stroke-linecap="round"/>
  <line x1="97" y1="139" x2="130" y2="139" stroke="url(#bl)" stroke-width="11" stroke-linecap="round" opacity="0.95"/>
  <path d="M187 113 L219 94 Q229 88 229 102 V154 Q229 168 219 162 L187 143 Z" fill="url(#bl)" opacity="0.95"/>
</svg>`;

export const MS_MARK_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(MARK_SVG);

/** Cria um <img> da marca do MeetSync. */
export function logoImg(size: number): HTMLImageElement {
  const img = document.createElement('img');
  img.src = MS_MARK_URL;
  img.width = size;
  img.height = size;
  img.alt = 'MeetSync';
  img.draggable = false;
  img.style.display = 'block';
  return img;
}
