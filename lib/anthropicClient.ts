import Anthropic from '@anthropic-ai/sdk';

// API 키 배열 로드
function getApiKeys(): string[] {
  const keysJson = process.env.CLAUDE_API_KEYS;
  if (!keysJson) {
    throw new Error('CLAUDE_API_KEYS 환경 변수가 설정되지 않았습니다.');
  }
  
  try {
    const keys = JSON.parse(keysJson);
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error('CLAUDE_API_KEYS는 비어있지 않은 배열이어야 합니다.');
    }
    return keys;
  } catch (error) {
    throw new Error(`CLAUDE_API_KEYS 파싱 오류: ${error}`);
  }
}

// 라운드로빈을 위한 인덱스 관리
let currentKeyIndex = 0;
const keyErrorMap = new Map<string, number>(); // key -> 에러 발생 시간
const ERROR_COOLDOWN_MS = 5 * 60 * 1000; // 5분

function getNextKeyByRoundRobin(): string {
  const keys = getApiKeys();
  const validKeys = keys.filter((key) => {
    const errorTime = keyErrorMap.get(key);
    if (!errorTime) return true;
    // 쿨다운 시간이 지났으면 다시 사용 가능
    return Date.now() - errorTime > ERROR_COOLDOWN_MS;
  });

  if (validKeys.length === 0) {
    // 모든 키가 쿨다운 중이면 에러 시간 초기화 후 재시도
    keyErrorMap.clear();
    return keys[currentKeyIndex % keys.length];
  }

  // 유효한 키 중에서 라운드로빈
  const validIndex = currentKeyIndex % validKeys.length;
  currentKeyIndex++;
  return validKeys[validIndex];
}

export function markKeyAsError(key: string): void {
  keyErrorMap.set(key, Date.now());
}

// 현재 사용 중인 키를 추적하기 위한 맵
const clientKeyMap = new WeakMap<Anthropic, string>();

export function getAnthropicClient(): Anthropic {
  const apiKey = getNextKeyByRoundRobin();
  const client = new Anthropic({ apiKey });
  clientKeyMap.set(client, apiKey);
  return client;
}

export function getClientApiKey(client: Anthropic): string | undefined {
  return clientKeyMap.get(client);
}

// 모델 스냅샷 ID 상수
export const MODEL_SNAPSHOT = 'claude-sonnet-4-5-20250929';

