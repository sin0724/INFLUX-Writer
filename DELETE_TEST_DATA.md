# 테스트 데이터 삭제 가이드

## 방법 1: API 엔드포인트 사용 (권장)

배포된 서버에서 다음 URL로 DELETE 요청을 보내면 모든 테스트 데이터가 삭제됩니다:

```
https://influx-writer-production.up.railway.app/api/cleanup/test-data
```

### 사용 방법

1. 브라우저 개발자 도구 열기 (F12)
2. Console 탭으로 이동
3. 다음 코드 실행:

```javascript
fetch('https://influx-writer-production.up.railway.app/api/cleanup/test-data', {
  method: 'DELETE'
})
.then(res => res.json())
.then(data => {
  console.log('삭제 결과:', data);
  alert('테스트 데이터가 삭제되었습니다.');
})
.catch(error => {
  console.error('삭제 오류:', error);
  alert('삭제 중 오류가 발생했습니다.');
});
```

또는 Postman, curl 등으로 DELETE 요청:

```bash
curl -X DELETE https://influx-writer-production.up.railway.app/api/cleanup/test-data
```

## 방법 2: Supabase 대시보드에서 직접 삭제

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택 (Project ID: syfebybkepvvlgdpkzfu)
3. SQL Editor로 이동
4. 다음 SQL 실행:

```sql
-- 모든 작업 삭제 (CASCADE로 articles, job_images도 자동 삭제)
DELETE FROM jobs;

-- 모든 업체 삭제 (CASCADE로 관련 데이터도 자동 삭제)
DELETE FROM clients;

-- Storage의 모든 이미지 삭제는 Storage 탭에서 수동으로 진행
```

## 주의사항

⚠️ **이 작업은 되돌릴 수 없습니다!**
- 모든 작업(jobs)이 삭제됩니다
- 모든 업체(clients)가 삭제됩니다
- 관련된 모든 원고(articles)가 삭제됩니다
- 관련된 모든 이미지(job_images)가 삭제됩니다
- Storage의 이미지 파일도 삭제됩니다

삭제 전에 반드시 백업이 필요하다면 데이터를 내보내세요.

