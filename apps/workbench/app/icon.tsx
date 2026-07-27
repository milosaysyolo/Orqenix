import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f4ee' }}>
        <div style={{ width: 16, height: 16, background: 'linear-gradient(135deg,#b65a3c,#73579c)', transform: 'rotate(45deg)', borderRadius: 3 }} />
      </div>
    ),
    { ...size }
  );
}