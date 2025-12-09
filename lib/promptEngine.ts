import { Category, StylePreset } from './types';

// 업종별 스타일 규칙 (고도화 버전)
const categoryStyles: Record<Category, { tone: string; structure: string; rules: string; details: string }> = {
  '피부과/에스테틱': {
    tone: '안정적·차분·신뢰 기반',
    structure: '상담 → 과정 → 느낌',
    rules: '의료법 금지 표현 자동 제거. 시술 과정은 "느낌 중심", 효과 단정 금지.',
    details: '상담·청결·조도·설명력 중심으로 자연스럽게 서술하되, 과장이나 효과 보장 표현은 절대 사용하지 않는다.',
  },
  '네일/속눈썹': {
    tone: '디테일 중심의 편안한 톤',
    structure: '디자인 선택 → 시술 과정 → 디테일 → 느낌',
    rules: '세부 디테일 강조 (컬, 두께, 결, 색감). 시술 중 편안함 묘사. 가벼운 대화체 가능.',
    details: '디자인 선택 과정을 자연스럽게 서술하고, 시술 중 느낀 편안함을 구체적으로 표현한다.',
  },
  '미용실': {
    tone: 'Before→After 변화 중심의 생동감',
    structure: 'Before → 상담 → After',
    rules: '헤어 질감·볼륨·광택 등 촉각적 표현. 디자이너의 제안·설명력 강조.',
    details: '변화를 명확하게 보여주되 과장하지 않고, 실제 느낀 질감과 변화를 구체적으로 묘사한다.',
  },
  '카페': {
    tone: '향·식감·공간 분위기 중심의 감성적 톤',
    structure: '방문 계기 → 메뉴 선택 → 감각 묘사 → 분위기',
    rules: '향·식감·소리·온도 등 감각 묘사. 공간 분위기·빛·좌석감 중심. 메뉴 1~2개 집중 묘사.',
    details: '다섯 감각을 활용한 생생한 묘사를 자연스럽게 녹여내되, 과장된 표현은 피한다.',
  },
  '맛집': {
    tone: '방문 흐름 기반의 생동감 있는 톤',
    structure: '입장 → 주문 → 식사 → 마무리',
    rules: '방문 흐름 기반 서사. 음식 향→맛→식감 순서. 과장형 감탄 금지.',
    details: '음식의 식감과 맛을 구체적이고 생생하게 표현하되, "최고다" 같은 과장 표현은 사용하지 않는다.',
  },
  'PT': {
    tone: '설명력·안전감 중심의 전문적 톤',
    structure: '목표 → 프로그램 설명 → 동작 느낌 → 체감',
    rules: '강사의 설명력·케어. 동작 수행 느낌. 공간 안전감·기구 상태 묘사. "효과 단정" 금지.',
    details: '안전한 운동 방법과 체계적인 프로그램을 강조하며, 성과 보장 표현(예: 살 빠진다)은 절대 사용하지 않는다.',
  },
  '반려동물': {
    tone: '아이 반응 중심의 따뜻한 톤',
    structure: '방문 계기 → 아이 반응 → 서비스 내용 → 만족도',
    rules: '아이(펫)의 반응 중심. 공간 청결·안전성. 직원의 케어·세심함. 과한 의인화 금지.',
    details: '반려동물의 자연스러운 반응과 세심한 케어를 강조하되, 과도한 의인화 표현은 피한다.',
  },
  '숙소': {
    tone: '채광·구조·체류감 중심의 편안한 톤',
    structure: '체크인 → 공간 구조 → 채광/분위기 → 편의시설 → 체류 경험',
    rules: '채광·조도·뷰 묘사. 동선, 편의시설, 침구 느낌. 감성적·여운 있는 문장 허용.',
    details: '공간의 구조와 분위기를 구체적으로 묘사하며 체류감을 전달하되, 과장된 표현은 피한다.',
  },
  '자동차/정비': {
    tone: '신뢰·과정 투명성 중심의 전문적 톤',
    structure: '문제 상황 → 점검 과정 → 원인 설명 → 수리/조치 → 결과',
    rules: '신뢰감·과정 투명성. 작업 이해도·설명력. 위험한 추정 금지 (고장 원인 단정 X).',
    details: '전문성과 신뢰감을 강조하며, 기술적 설명을 이해하기 쉽게 전달하되, 원인을 단정하는 표현은 피한다.',
  },
  '인테리어': {
    tone: '공간 구성·활용성 중심의 실용적 톤',
    structure: '공간 개요 → 구성 요소 → 활용성 → 만족도',
    rules: '공간 구조·채광·재질·활용성. 목적별 사용 편의성. 과도한 미사여구 금지.',
    details: '공간의 구성과 실용성을 구체적으로 설명하며 활용 방안을 제시하되, 과도한 미사여구는 사용하지 않는다.',
  },
  '학원': {
    tone: '안정감·정돈·설명력 중심의 신뢰 톤',
    structure: '등록 계기 → 수업 분위기 → 설명력 → 만족도',
    rules: '안정감·정돈·교습 설명력. 학부모/학생 시점 모두 자연스럽게 가능. 성과 보장 금지. 공간의 조용함·관리력 강조.',
    details: '성과 보장 표현은 절대 사용하지 않으며, 교육 환경과 설명력을 중심으로 자연스럽게 표현한다.',
  },
};

// 문장 패턴 30개 (AI 티 제거용 - 패턴 유형 지시)
const sentencePatternTypes = [
  '짧은 문장 후 긴 문장 조합',
  '감정 연결어 사용 ("솔직히", "생각보다")',
  '시간 흐름 기반 서술',
  '공간 묘사 먼저 → 내용 서술',
  '느낌 먼저 제시 후 구체 설명',
  '결론 먼저 말하는 구조',
  '비교 문장 ("전에 갔던 곳보다…")',
  '감탄문 1회 포함',
  '의문형 1회 포함',
  '구어체 10~20% 섞기',
  '묘사 + 관찰 혼합',
  '단락 첫 문장 변형(직설/질문/감성)',
  '불완전 문장 1회 포함',
  '동의어 자동 치환',
  '반복 단어 자동 회피',
  '명사 나열 → 정리형 문장',
  '문장 길이의 편차 크게',
  '감정선 한 줄 삽입',
  '의외의 디테일 1줄 삽입',
  '내적 독백 스타일 1줄',
  '"먼저 말하면…" 구조 1회',
  '여운을 주는 마무리',
  '강조 표현 1회',
  '전환구문 사용 ("그러다 보니", "게다가")',
  '경험 기반 추론 삽입',
  '부드러운 톤 + 리듬 불규칙',
  '첫 문장 후킹 스타일',
  '두 번째 문장은 매우 짧게',
  '감성톤 마무리',
  '전체 문단의 예측 가능성 제거',
];

// 플레이스 링크 중간 삽입 문구 30개
const placeLinkInsertPhrases = [
  '자세한 정보는 여기서 확인하실 수 있습니다.',
  '더 많은 정보가 궁금하시다면 이곳을 방문해보세요.',
  '상세한 위치와 정보는 여기서 확인 가능합니다.',
  '방문 전에 이곳에서 미리 확인해보시면 좋을 것 같습니다.',
  '자세한 내용은 여기서 확인하실 수 있어요.',
  '더 알아보고 싶으시다면 이곳을 클릭해보세요.',
  '상세 정보는 여기서 확인하시면 됩니다.',
  '이곳에서 더 많은 정보를 확인할 수 있습니다.',
  '자세한 안내는 여기서 받으실 수 있어요.',
  '더 궁금한 점이 있으시다면 이곳을 방문해보세요.',
  '상세한 위치 정보는 여기서 확인 가능합니다.',
  '자세한 내용이 궁금하시다면 이곳을 클릭해보세요.',
  '더 많은 정보는 여기서 확인하실 수 있습니다.',
  '이곳에서 상세한 안내를 받으실 수 있어요.',
  '자세한 정보가 필요하시다면 여기서 확인해보세요.',
  '더 알아보고 싶으시면 이곳을 방문해보시면 됩니다.',
  '상세한 내용은 여기서 확인하실 수 있습니다.',
  '이곳에서 더 자세한 정보를 확인할 수 있어요.',
  '자세한 안내가 필요하시다면 여기서 확인해보세요.',
  '더 많은 내용은 이곳에서 확인하실 수 있습니다.',
  '상세 정보가 궁금하시다면 여기서 확인해보시면 됩니다.',
  '이곳에서 자세한 안내를 받으실 수 있어요.',
  '더 알아보고 싶으시다면 이곳을 클릭해보세요.',
  '자세한 정보는 여기서 확인 가능합니다.',
  '상세한 내용이 필요하시다면 이곳을 방문해보세요.',
  '더 많은 정보는 여기서 확인하실 수 있어요.',
  '이곳에서 상세한 안내를 받으실 수 있습니다.',
  '자세한 안내가 궁금하시다면 여기서 확인해보시면 됩니다.',
  '더 알아보고 싶으시면 이곳을 클릭해보세요.',
  '상세 정보는 여기서 확인하실 수 있습니다.',
];

interface BuildPromptInput {
  clientName: string;
  placeUrl: string | null;
  category: Category | null;
  guideText: string;
  keywords: string | null;
  contentType: 'review' | 'info';
  lengthHint: 1000 | 1500;
  imageDescriptions?: string[];
  humanExtraPrompt?: string | null;
  stylePreset?: StylePreset | null;
}

export function buildPrompt(input: BuildPromptInput): string {
  const {
    clientName,
    placeUrl,
    category,
    guideText,
    keywords,
    contentType,
    lengthHint,
    imageDescriptions = [],
    humanExtraPrompt,
    stylePreset,
  } = input;

  let prompt = '';

  // 1. 기본 지시사항 (AI 티 제거)
  prompt += `${clientName}에 대한 ${contentType === 'review' ? '후기' : '정보'} 글을 작성해주세요. 실제로 방문하거나 이용한 사람의 입장에서 솔직하고 자연스럽게 작성해주세요.\n\n`;

  // 2. 스타일 프리셋 우선 적용
  if (stylePreset) {
    if (stylePreset.tone) {
      prompt += `톤: ${stylePreset.tone}\n`;
    }
    if (stylePreset.length_hint) {
      prompt += `길이 힌트: ${stylePreset.length_hint}\n`;
    }
    if (stylePreset.platform) {
      prompt += `플랫폼: ${stylePreset.platform}\n`;
    }
    if (stylePreset.extra_rules) {
      prompt += `추가 규칙: ${stylePreset.extra_rules}\n`;
    }
    prompt += '\n';
  } else if (category && categoryStyles[category]) {
    // 3. 업종 스타일 자동 적용 (고도화 버전)
    const style = categoryStyles[category];
    prompt += `[업종 스타일: ${category}]\n`;
    prompt += `톤: ${style.tone}\n`;
    prompt += `구조: ${style.structure}\n`;
    prompt += `규칙: ${style.rules}\n`;
    prompt += `세부사항: ${style.details}\n\n`;
  }

  // 4. 가이드 텍스트
  prompt += `[가이드]\n${guideText}\n\n`;

  // 4-1. 키워드 (있는 경우)
  if (keywords && keywords.trim()) {
    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    if (keywordList.length > 0) {
      prompt += `[필수 키워드]\n다음 키워드들을 제목과 본문에 자연스럽게 여러 번 포함해야 합니다: ${keywordList.join(', ')}\n`;
      prompt += `키워드는 인위적이지 않게 문맥에 자연스럽게 녹여서 사용하세요.\n\n`;
    }
  }

  // 5. Vision Soft Embedding 규칙 (AI 티 제거 핵심)
  if (imageDescriptions.length > 0) {
    prompt += `[사진 분석 결과 - 참고용]\n${imageDescriptions.join('\n')}\n\n`;
    prompt += `⚠️ 매우 중요 - Vision Soft Embedding 규칙:\n`;
    prompt += `Vision 분석 결과의 문장을 직접 사용하지 말고, 사진을 보고 사람이 느낄 법한 분위기와 인상을 서술형 문장 안에 자연스럽게 간접적으로만 녹여내라.\n`;
    prompt += `예: X "화이트 톤의 공간이며 조명이 밝다." → O "전체적으로 빛이 부드럽게 퍼져서 분위기가 깨끗하게 느껴졌다."\n\n`;
  }

  // 6. 문장 패턴 랜덤 적용 (4~7개) - AI 패턴 차단 장치
  const patternCount = Math.floor(Math.random() * 4) + 4; // 4~7개
  const selectedPatterns = [...sentencePatternTypes]
    .sort(() => Math.random() - 0.5)
    .slice(0, patternCount);
  prompt += `[문장 리듬 변주 - AI 패턴 차단]\n다음 문장 패턴 유형들을 자연스럽게 적용하여 문장 리듬을 인간처럼 불규칙하게 만들어라:\n${selectedPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n`;
  prompt += `목적: 동일 문장 패턴 반복을 차단하고, 문장의 리듬을 인간 수준으로 변주한다.\n\n`;

  // 7. 콘텐츠 타입별 자연스러운 톤 규칙
  if (contentType === 'review') {
    prompt += `[후기형 글의 자연스러운 인간 톤 규칙]\n`;
    prompt += `- 과장형, 광고형 문장 금지 ("최고다", "완벽하다" 등)\n`;
    prompt += `- 작은 감정 + 구체적 관찰 조합\n`;
    prompt += `- 설명만 나열 금지 → 느낌·상황·맥락 섞기\n`;
    prompt += `- 미세한 감정 표현 자연스럽게 추가\n`;
    prompt += `- 표현을 동일하게 반복하지 않기\n`;
    prompt += `- 문단마다 시점·디테일·관찰 포인트 약간 변화\n`;
    prompt += `- 실제 방문 반복자처럼 "조심스러운 표현" 1~2개 삽입\n`;
    prompt += `- 말투: "~했어요", "~였어요" 같은 구어체 자연스럽게 사용\n`;
    prompt += `- 기승전결 구조로 자연스럽게 이어지게 작성\n`;
    prompt += `예: "생각보다 공간이 조용해서 마음이 편해졌다." / "설명 들으면서 자연스럽게 긴장이 풀렸던 순간이 있었다."\n\n`;
  } else {
    prompt += `[정보형 글의 중립·사실 기반 규칙]\n`;
    prompt += `- 광고성/미사여구 금지\n`;
    prompt += `- 장점/특징을 중립적 어조로 설명\n`;
    prompt += `- 사실 → 설명 → 정리 흐름 유지\n`;
    prompt += `- 너무 매뉴얼처럼 딱딱한 어조 금지\n`;
    prompt += `- 객관적·부드러운 설명 중심\n`;
    prompt += `예: O "이 공간은 자연광이 잘 들어 촬영용으로 자주 활용된다." / X "이곳은 최고의 촬영 공간이다!"\n\n`;
  }

  // 8. 텍스트 리듬(문장 흐름) 규칙
  prompt += `[텍스트 리듬 규칙]\n`;
  prompt += `- 문장 길이를 다양하게 섞기\n`;
  prompt += `- 단락마다 시작 문장의 톤 변환\n`;
  prompt += `- 시각·촉각·감정 묘사를 교차 사용\n`;
  prompt += `- 개념적 표현 + 구체적 사례 혼합\n`;
  prompt += `- 정보형/후기형 모두 '자연스러운 틈'(쉼표·여백·리듬) 허용\n`;
  prompt += `- 예측 가능성 제거: 같은 구조 반복 금지\n\n`;

  // 9. 블로그 원고 작성 규칙
  prompt += `[블로그 원고 작성 필수 규칙]\n`;
  prompt += `1. 제목을 반드시 작성하고, 후킹 요소가 들어가게 작성하세요.\n`;
  prompt += `2. 제목과 본문에 키워드를 필수로 포함하세요. (자연스럽게 여러 번 활용)\n`;
  prompt += `3. 제목에 "~후기" 단어는 사용하지 마세요.\n`;
  prompt += `4. 본문은 문단을 나누지 않고 연속으로 작성하세요.\n`;
  prompt += `5. 글 시작 부분에 이슈 얘기, 인사, 날씨 얘기 등을 자연스럽게 포함하여 진짜 블로거가 쓴 것처럼 작성하세요.\n`;
  prompt += `6. 기승전결 구조에 맞춰 자연스럽게 이어지게 작성하세요.\n`;
  prompt += `7. 사진과 요청사항을 제대로 참고하여 작성하세요.\n`;
  prompt += `8. 길이: 약 ${lengthHint}자 정도로 작성하세요.\n\n`;
  
  prompt += `[금지사항]\n`;
  prompt += `- "소개해볼까해요", "들려드릴게요" 등 부자연스러운 표현 사용 금지\n`;
  prompt += `- 과도한 홍보성 톤 사용 금지\n`;
  prompt += `- 문장들을 두서없이 나열하지 말 것\n`;
  prompt += `- 제목에 "~후기" 단어 사용 금지\n\n`;

  // 10. 플레이스 링크 삽입 위치 결정
  if (placeUrl) {
    const insertPosition = Math.floor(Math.random() * 3); // 0: 상단, 1: 중간, 2: 하단
    if (insertPosition === 0) {
      prompt += `[플레이스 링크]\n글 상단에 다음 링크를 자연스럽게 포함해주세요: ${placeUrl}\n\n`;
    } else if (insertPosition === 1) {
      const randomPhrase = placeLinkInsertPhrases[Math.floor(Math.random() * placeLinkInsertPhrases.length)];
      prompt += `[플레이스 링크]\n본문 중간(2~3단락)에 다음 문구와 함께 링크를 자연스럽게 포함해주세요: "${randomPhrase}" ${placeUrl}\n\n`;
    } else {
      prompt += `[플레이스 링크]\n글 마지막에 다음 링크를 자연스럽게 포함해주세요: ${placeUrl}\n\n`;
    }
  }

  // 11. 추가 프롬프트
  if (humanExtraPrompt) {
    prompt += `[추가 요청사항]\n${humanExtraPrompt}\n\n`;
  }

  // 12. AI 티 제거용 필수 프롬프트 문구
  prompt += `[AI 티 제거 필수 지시사항]\n`;
  prompt += `설명 문장만 나열하지 말고, 자연스러운 관찰·느낌·맥락을 섞어 사람이 직접 쓴 글처럼 표현하라.\n`;
  prompt += `문장 리듬은 규칙적이지 않게 변주하고, 같은 표현을 반복하지 마라.\n`;
  prompt += `광고 톤·과장 표현·AI 패턴은 절대 사용하지 말라.\n`;
  prompt += `검색엔진(SEO)에 잘 노출되도록 키워드를 자연스럽게 여러 번 활용하되, 인위적인 느낌이 들지 않게 해라.\n`;
  prompt += `플레이스 링크는 자연스럽게 녹여내되, 광고처럼 보이지 않게 해라.\n`;
  prompt += `진짜 블로거가 쓴 것처럼 자연스럽고 진정성 있게 작성하라.\n\n`;

  // 13. 최종 요청
  prompt += `위 모든 요구사항을 반영하여, 제목과 본문을 포함한 완전한 블로그 원고를 작성해주세요. 사람이 직접 쓴 것처럼 자연스럽고 AI 티 없는 글이어야 합니다.`;

  return prompt;
}

