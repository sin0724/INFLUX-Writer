-- 업체 테이블에 requires_confirmation 칼럼 추가
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN DEFAULT false;

-- 기존 데이터는 모두 false로 설정 (임의 작업으로 간주)
UPDATE clients 
SET requires_confirmation = false 
WHERE requires_confirmation IS NULL;

