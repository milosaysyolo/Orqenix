export const PROTOCOL_ID = '/orqenix/mesh/1.0.0';

export function isSupportedProtocol(p: string): boolean {
  return p === PROTOCOL_ID;
}

export function supportedProtocols(): string[] {
  return [PROTOCOL_ID];
}
