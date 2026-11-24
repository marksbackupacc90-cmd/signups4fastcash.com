export interface DeviceFingerprint {
  hash: string;
  components: {
    canvas: string;
    screen: string;
    language: string;
    languages: string;
    hardwareConcurrency: number;
    platform: string;
    timezone: string;
  };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 48;
    const context = canvas.getContext('2d');
    if (!context) return 'no-canvas';
    context.textBaseline = 'top';
    context.font = '16px Georgia';
    context.fillStyle = '#0b1520';
    context.fillRect(0, 0, 240, 48);
    context.fillStyle = '#2dd4ee';
    context.fillText('S4FC fingerprint', 2, 2);
    context.strokeStyle = '#ededed';
    context.beginPath();
    context.moveTo(2, 34);
    context.lineTo(238, 34);
    context.stroke();
    return canvas.toDataURL();
  } catch {
    return 'canvas-unavailable';
  }
}

export async function createDeviceFingerprint(): Promise<DeviceFingerprint> {
  const components = {
    canvas: canvasFingerprint(),
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    language: navigator.language || '',
    languages: (navigator.languages || []).join(','),
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    platform: navigator.platform || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  };
  const hash = await sha256(JSON.stringify(components));
  return { hash, components };
}
